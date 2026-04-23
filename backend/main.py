"""
Borderless AI Trade Platform - Complete Backend
FastAPI + GLM (ilmu.ai) | Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import httpx
import json
import uuid
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIG  ← paste your real API key here
# ─────────────────────────────────────────────

GLM_BASE_URL = "https://api.ilmu.ai/v1"
GLM_API_KEY  = "sk-...6bfa"
GLM_MODEL    = "nemo-super"

# ─────────────────────────────────────────────
# APP + CORS  (this is what lets the frontend talk to the backend)
# ─────────────────────────────────────────────

app = FastAPI(title="Borderless AI Trade Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in prod: ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# IN-MEMORY SESSION STORE
# ─────────────────────────────────────────────

sessions: Dict[str, dict] = {}

# ─────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    message: str
    stream: bool = False

class VerifyEntityRequest(BaseModel):
    session_id: str
    company_name: str
    registration_number: str
    director_nric: Optional[str] = None

class ConsigneeRequest(BaseModel):
    session_id: str
    buyer_name: str
    buyer_country: str
    buyer_address: str
    incoterm: str = "FOB"
    buyer_tax_id: Optional[str] = None

class HSCodeRequest(BaseModel):
    session_id: str
    product_description: str
    destination_country: str
    product_category: Optional[str] = None

class PermitsRequest(BaseModel):
    session_id: str
    hs_code: str
    product_type: str
    destination_country: str

class ValuationRequest(BaseModel):
    session_id: str
    fob_value_myr: float
    destination_country: str
    incoterm: str = "FOB"
    freight_quote_myr: Optional[float] = None
    insurance_rate: float = 0.005

class LogisticsRequest(BaseModel):
    session_id: str
    mode: str
    port_of_loading: str = "Port Klang"
    port_of_discharge: str
    gross_weight_kg: float
    cbm: float
    vessel_name: Optional[str] = None

# ─────────────────────────────────────────────
# GLM HELPERS
# ─────────────────────────────────────────────

GLM_HEADERS = {
    "Authorization": f"Bearer {GLM_API_KEY}",
    "Content-Type": "application/json",
}

async def glm_chat(system: str, messages: list, temperature: float = 0.3) -> str:
    payload = {
        "model": GLM_MODEL,
        "max_tokens": 2048,
        "temperature": temperature,
        "messages": [{"role": "system", "content": system}, *messages],
    }
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{GLM_BASE_URL}/chat/completions", headers=GLM_HEADERS, json=payload)
        r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


async def glm_json(system: str, user_msg: str, temperature: float = 0.1) -> dict:
    full_system = system + "\n\nRespond with valid JSON only. No backticks, no explanation."
    raw = await glm_chat(full_system, [{"role": "user", "content": user_msg}], temperature)
    text = raw.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": raw, "parse_error": True}


async def glm_stream(system: str, messages: list):
    payload = {
        "model": GLM_MODEL,
        "max_tokens": 2048,
        "stream": True,
        "messages": [{"role": "system", "content": system}, *messages],
    }
    async with httpx.AsyncClient(timeout=120) as c:
        async with c.stream("POST", f"{GLM_BASE_URL}/chat/completions",
                             headers=GLM_HEADERS, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk.strip() == "[DONE]":
                        break
                    try:
                        delta = json.loads(chunk)["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield f"data: {json.dumps({'text': delta})}\n\n"
                    except (json.JSONDecodeError, KeyError):
                        continue

# ─────────────────────────────────────────────
# SESSION HELPERS
# ─────────────────────────────────────────────

def get_session(session_id: str) -> dict:
    if session_id not in sessions:
        raise HTTPException(404, "Session not found. Call POST /sessions first.")
    return sessions[session_id]

def advance(session: dict, step: int, progress: int):
    session["current_step"] = max(session["current_step"], step)
    session["progress"]     = max(session["progress"], progress)

def step_status(session: dict, step: int) -> str:
    cs = session["current_step"]
    if step < cs:  return "completed"
    if step == cs: return "active"
    return "locked"

def build_context(session: dict) -> str:
    parts = []
    cl = session.get("checklist", {})
    if ev := cl.get("entity_verification"):
        parts.append(f"Entity: {ev.get('company_name')} BRN:{ev.get('brn')} [{ev.get('status')}]")
    if cs := cl.get("consignee"):
        parts.append(f"Consignee: {cs.get('buyer_name')} -> {cs.get('country')}")
    if hc := cl.get("classification"):
        parts.append(f"HS Code: {hc.get('hs_code')} - {hc.get('product_description')}")
    if fv := cl.get("financial_valuation"):
        parts.append(f"FOB: MYR {fv.get('fob_myr')}, Duty: MYR {fv.get('estimated_duty_myr')}, Total: MYR {fv.get('total_landed_cost_myr')}")
    return "\n".join(parts) or "No data yet."

NEXT_ACTIONS = {
    1: "Upload SSM Certificate to verify entity",
    2: "Add consignee / buyer details",
    3: "Classify product with HS code",
    4: "Check required special permits",
    5: "Setup MyDagangNet / MyECIS access",
    6: "Enter FOB value for financial valuation",
    7: "Add logistics details (mode, port, weight)",
    8: "Generate trade documents",
    9: "Submit K2 customs declaration",
}

# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Borderless AI Trade Platform"}


# ── SESSION ──────────────────────────────────
@app.post("/sessions")
async def create_session():
    sid = str(uuid.uuid4())
    sessions[sid] = {
        "session_id": sid,
        "created_at": datetime.utcnow().isoformat(),
        "current_step": 1,
        "progress": 0,
        "chat_history": [],
        "checklist": {},
        "documents": {},
        "landed_cost": None,
    }
    return {"session_id": sid}

@app.get("/sessions/{session_id}")
async def get_session_data(session_id: str):
    return get_session(session_id)


# ── STEP 1: ENTITY VERIFICATION ──────────────
@app.post("/entity/verify")
async def verify_entity(req: VerifyEntityRequest):
    session = get_session(req.session_id)

    result = await glm_json(
        """You are a Malaysian SSM compliance expert.
        Verify the company registration details against SSM requirements.
        Return JSON: {
          "status": "verified|pending|failed",
          "missing_docs": [],
          "compliance_notes": [],
          "ssm_requirements": ["Form 9 / Form D", "BRN", "Director NRIC"],
          "next_action": ""
        }""",
        f"Company: {req.company_name}\nBRN: {req.registration_number}\nDirector NRIC: {req.director_nric or 'Not provided'}"
    )

    session["checklist"]["entity_verification"] = {
        "company_name": req.company_name,
        "brn": req.registration_number,
        "director_nric": req.director_nric,
        "status": result.get("status", "pending"),
        "ssm_certificate_uploaded": False,
        "compliance_notes": result.get("compliance_notes", []),
    }

    if result.get("status") == "verified":
        advance(session, 2, 12)

    return {
        "verification": result,
        "checklist_items": [
            {"item": "SSM Certificate (Form 9 / Form D)", "status": "required"},
            {"item": "Business Registration Number (BRN)",
             "status": "provided" if req.registration_number else "required"},
            {"item": "Director NRIC verification",
             "status": "provided" if req.director_nric else "pending"},
        ],
    }


@app.post("/entity/upload-ssm")
async def upload_ssm(session_id: str, file: UploadFile = File(...)):
    session = get_session(session_id)
    content = await file.read()

    result = await glm_json(
        """You are an expert at reading Malaysian SSM certificates.
        Validate and extract key fields.
        Return JSON: {
          "is_valid": true,
          "company_name": "",
          "registration_number": "",
          "registration_date": "",
          "business_type": "",
          "status": "active|inactive",
          "issues": []
        }""",
        f"SSM file: {file.filename} ({len(content)} bytes). Validate."
    )

    if result.get("is_valid"):
        session["checklist"]["entity_verification"]["ssm_certificate_uploaded"] = True
        session["checklist"]["entity_verification"]["status"] = "verified"
        advance(session, 2, 12)

    return result


# ── STEP 2: CONSIGNEE ─────────────────────────
@app.post("/consignee/add")
async def add_consignee(req: ConsigneeRequest):
    session = get_session(req.session_id)

    result = await glm_json(
        """You are a Malaysian export compliance officer.
        Screen the consignee for sanctions, denied parties, and permit triggers.
        Return JSON: {
          "risk_level": "low|medium|high",
          "sanctioned_country": false,
          "denied_party_check": "clear|flagged",
          "required_permits": [],
          "compliance_notes": [],
          "recommended_incoterms": ["FOB","CIF","DAP"]
        }""",
        f"Buyer: {req.buyer_name}\nCountry: {req.buyer_country}\nIncoterm: {req.incoterm}"
    )

    session["checklist"]["consignee"] = {
        "buyer_name": req.buyer_name,
        "country": req.buyer_country,
        "address": req.buyer_address,
        "incoterm": req.incoterm,
        **result,
    }

    if result.get("risk_level") in ["low", "medium"]:
        advance(session, 3, 24)

    return result


# ── STEP 3: HS CODE ───────────────────────────
@app.post("/classification/hs-code")
async def classify_hs(req: HSCodeRequest):
    session = get_session(req.session_id)

    result = await glm_json(
        """You are an HS tariff classification expert for Malaysian exports.
        Return JSON: {
          "hs_code": "XXXX.XX.XX",
          "hs_description": "",
          "malaysia_export_duty": 0.0,
          "destination_import_duty": 0.0,
          "gst_sst_applicable": false,
          "fta_available": [],
          "permit_required": [],
          "restrictions": [],
          "confidence": 0.95
        }""",
        f"Product: {req.product_description}\nCategory: {req.product_category}\nDestination: {req.destination_country}"
    )

    session["checklist"]["classification"] = {
        "product_description": req.product_description,
        "destination": req.destination_country,
        **result,
    }
    advance(session, 4, 36)
    return result


# ── STEP 4: SPECIAL PERMITS ───────────────────
@app.post("/permits/check")
async def check_permits(req: PermitsRequest):
    session = get_session(req.session_id)

    result = await glm_json(
        """You are a Malaysian SIRIM/MITI/Halal permits specialist.
        Return JSON: {
          "permits_required": [
            {"name": "", "issuing_body": "", "mandatory": true, "processing_days": 0, "fee_myr": 0}
          ],
          "sirim_required": false,
          "halal_required": false,
          "miti_license_required": false,
          "strategic_goods_control": false,
          "total_estimated_days": 0,
          "total_estimated_cost_myr": 0
        }""",
        f"HS Code: {req.hs_code}\nProduct: {req.product_type}\nDestination: {req.destination_country}"
    )

    session["checklist"]["special_permits"] = result
    advance(session, 5, 48)
    return result


# ── STEP 5: DIGITAL ACCESS ────────────────────
@app.post("/digital-access/setup")
async def digital_access(session_id: str, company_brn: str,
                          customs_agent_code: Optional[str] = None):
    session = get_session(session_id)

    result = await glm_json(
        """You are a Malaysian customs digital systems (MyDagangNet, MyECIS, K2) expert.
        Return JSON: {
          "mydagang_net_required": true,
          "myecis_setup_steps": [],
          "k2_agent_needed": true,
          "digital_certificates_needed": [],
          "portal_registrations": [],
          "estimated_setup_days": 0
        }""",
        f"BRN: {company_brn}\nAgent: {customs_agent_code or 'None'}"
    )

    session["checklist"]["digital_access"] = result
    advance(session, 6, 60)
    return result


# ── STEP 6: FINANCIAL VALUATION ───────────────
@app.post("/valuation/calculate")
async def calculate_valuation(req: ValuationRequest):
    session = get_session(req.session_id)

    freight  = req.freight_quote_myr or (req.fob_value_myr * 0.07)
    insurance = req.fob_value_myr * req.insurance_rate
    cif      = req.fob_value_myr + freight + insurance

    import_duty_rate = (
        session["checklist"]
        .get("classification", {})
        .get("destination_import_duty", 0.05)
    )
    estimated_duty = cif * import_duty_rate
    total_landed   = cif + estimated_duty

    fta = await glm_json(
        """You are a Malaysian FTA duty savings specialist.
        Return JSON: {
          "atiga_applicable": false,
          "atiga_savings_myr": 0,
          "cptpp_applicable": false,
          "best_fta": "",
          "best_savings_myr": 0,
          "form_required": "Form D|Form E|None"
        }""",
        f"HS: {session['checklist'].get('classification', {}).get('hs_code', 'unknown')}\n"
        f"Destination: {req.destination_country}\nCIF: MYR {cif:.2f}\nDuty: {import_duty_rate*100:.1f}%"
    )

    valuation = {
        "fob_myr":               round(req.fob_value_myr, 2),
        "freight_myr":           round(freight, 2),
        "insurance_myr":         round(insurance, 2),
        "cif_myr":               round(cif, 2),
        "import_duty_rate":      import_duty_rate,
        "estimated_duty_myr":    round(estimated_duty, 2),
        "total_landed_cost_myr": round(total_landed, 2),
        "atiga_savings_myr":     fta.get("atiga_savings_myr", 0),
        "fta_details":           fta,
        "is_final":              False,
    }

    session["checklist"]["financial_valuation"] = valuation
    session["landed_cost"] = valuation
    advance(session, 7, 72)
    return valuation


# ── STEP 7: LOGISTICS ─────────────────────────
@app.post("/logistics/setup")
async def setup_logistics(req: LogisticsRequest):
    session = get_session(req.session_id)

    result = await glm_json(
        """You are a Malaysian freight logistics expert.
        Return JSON: {
          "container_type": "20GP|40GP|40HC|LCL",
          "estimated_transit_days": 0,
          "customs_clearance_days": 0,
          "bl_type": "OBL|SWB|TELEX",
          "required_shipping_docs": [],
          "port_charges_myr": 0,
          "total_logistics_cost_myr": 0,
          "shipping_line_recommendations": []
        }""",
        f"Mode: {req.mode}\nPOL: {req.port_of_loading}\nPOD: {req.port_of_discharge}\n"
        f"Weight: {req.gross_weight_kg}kg  CBM: {req.cbm}"
    )

    session["checklist"]["logistics"] = {
        "mode": req.mode, "pol": req.port_of_loading,
        "pod": req.port_of_discharge, "vessel": req.vessel_name,
        "weight_kg": req.gross_weight_kg, "cbm": req.cbm,
        **result,
    }
    advance(session, 8, 84)
    return result


# ── STEP 8: TRADE DOCS ────────────────────────
@app.post("/trade-docs/generate")
async def generate_docs(session_id: str):
    session = get_session(session_id)
    cl = session["checklist"]

    async def gen(doc_type: str, context: str) -> dict:
        return await glm_json(
            f"Generate a complete Malaysian export {doc_type} with all required fields "
            f"per Customs Act 1967 and MATRADE requirements. Return JSON.",
            context
        )

    base_ctx = (
        f"Exporter: {cl.get('entity_verification', {}).get('company_name')}\n"
        f"Consignee: {cl.get('consignee', {}).get('buyer_name')}, {cl.get('consignee', {}).get('country')}\n"
        f"Product: {cl.get('classification', {}).get('product_description')}\n"
        f"HS Code: {cl.get('classification', {}).get('hs_code')}\n"
        f"FOB: MYR {cl.get('financial_valuation', {}).get('fob_myr', 0)}\n"
        f"Incoterm: {cl.get('consignee', {}).get('incoterm', 'FOB')}"
    )

    docs = {
        "commercial_invoice":    await gen("Commercial Invoice", base_ctx),
        "packing_list":          await gen("Packing List",
                                           base_ctx + f"\nWeight: {cl.get('logistics', {}).get('weight_kg')}kg"),
        "certificate_of_origin": await gen("Certificate of Origin (Form D / ATIGA)", base_ctx),
    }

    session["documents"] = docs
    advance(session, 9, 92)
    return {"generated": list(docs.keys()), "documents": docs}


# ── STEP 9: K2 CUSTOMS SUBMISSION ─────────────
@app.post("/customs/submit-k2")
async def submit_k2(session_id: str):
    session = get_session(session_id)
    cl = session["checklist"]

    result = await glm_json(
        """You are a Malaysian Customs K2 declaration expert (Customs Act 1967).
        Return JSON: {
          "k2_form_data": {
            "declaration_type": "EX",
            "customs_station": "",
            "exporter": {},
            "consignee": {},
            "goods": {},
            "statistical_value_myr": 0,
            "freight_myr": 0,
            "insurance_myr": 0,
            "total_packages": 0,
            "gross_weight_kg": 0,
            "net_weight_kg": 0
          },
          "submission_checklist": [],
          "atiga_form_d_applicable": false,
          "duty_savings_myr": 0,
          "estimated_processing_hours": 4
        }""",
        json.dumps({k: cl.get(k, {}) for k in
                    ["entity_verification", "consignee", "classification",
                     "logistics", "financial_valuation"]})
    )

    session["checklist"]["customs_submission"] = result
    session["progress"] = 100
    session["current_step"] = 9

    savings = result.get("duty_savings_myr", 0)
    return {
        **result,
        "message": f"K2 ready. Potential MYR {savings:.0f} saved if ATIGA Form D is filed.",
        "submission_ready": True,
    }


# ── ARCHITECT AI CHAT ─────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    session = get_session(req.session_id)

    system = f"""You are the Compliance Architect AI for Borderless AI, a Malaysian export trade platform.
You guide exporters step-by-step: Entity -> Consignee -> HS Code -> Permits -> Digital Access -> Valuation -> Logistics -> Docs -> K2.

Session context:
{build_context(session)}

Current step: {session['current_step']}/9  |  Progress: {session['progress']}%
Next required action: {NEXT_ACTIONS.get(session['current_step'], 'Complete')}

Be specific and actionable. Cite Malaysian regulations (SSM Act, Customs Act 1967, Strategic Goods Act 2010).
When a document upload is needed, say exactly which one and why."""

    history = session["chat_history"][-10:]
    msgs = [{"role": m["role"], "content": m["content"]} for m in history]
    msgs.append({"role": "user", "content": req.message})

    session["chat_history"].append({
        "role": "user", "content": req.message, "ts": datetime.utcnow().isoformat()
    })

    if req.stream:
        return StreamingResponse(glm_stream(system, msgs), media_type="text/event-stream")

    response = await glm_chat(system, msgs)

    session["chat_history"].append({
        "role": "assistant", "content": response, "ts": datetime.utcnow().isoformat()
    })

    return {
        "response": response,
        "current_step": session["current_step"],
        "progress": session["progress"],
        "next_action": NEXT_ACTIONS.get(session["current_step"], "Complete"),
    }


# ── CHECKLIST ─────────────────────────────────
@app.get("/checklist/{session_id}")
async def get_checklist(session_id: str):
    session = get_session(session_id)
    steps = [
        (1, "Entity Verification",    "SSM & BRN Registration"),
        (2, "Consignee Details",       "Buyer & Importer Info"),
        (3, "Classification",          "HS Code & Duty Lookup"),
        (4, "Special Permits",         "SIRIM / Halal / MITI"),
        (5, "Digital Access",          "MyECIS & Dagang Net"),
        (6, "Financial Valuation",     "FOB, Freight & FX"),
        (7, "Logistics & Metrics",     "Mode, Vessel, Weight"),
        (8, "Trade Docs & Signatory",  "Invoice, B/L, Declaration"),
        (9, "Customs Submission",      "K2 Form Preview"),
    ]
    return {
        "steps": [{"step": n, "name": name, "sub": sub, "status": step_status(session, n)}
                  for n, name, sub in steps],
        "current_step": session["current_step"],
        "progress_percent": session["progress"],
    }


# ── DOCUMENT STATUS ────────────────────────────
@app.get("/documents/status/{session_id}")
async def doc_status(session_id: str):
    session = get_session(session_id)
    cs = session["current_step"]
    docs_cfg = [
        ("Commercial Invoice",           8),
        ("Packing List",                 8),
        ("Bill of Lading / Air Waybill", 8),
        ("K2 Declaration Form",          9),
        ("Certificate of Origin",        5),
        ("SIRIM Certificate",            5),
        ("Halal Certificate",            5),
    ]
    docs = []
    for name, needed_at in docs_cfg:
        generated = name.lower().replace(" ", "_").replace("/", "").replace(".", "") \
                    in session.get("documents", {})
        docs.append({
            "name":            name,
            "status":          "generated" if generated else ("ready" if cs >= needed_at else "locked"),
            "steps_remaining": max(0, needed_at - cs),
            "locked":          cs < needed_at,
        })
    ready = sum(1 for d in docs if d["status"] in ["ready", "generated"])
    return {"documents": docs, "ready_count": ready, "total_count": len(docs)}


# ── LANDED COST ────────────────────────────────
@app.get("/landed-cost/{session_id}")
async def landed_cost(session_id: str):
    session = get_session(session_id)
    lc = session.get("landed_cost") or session["checklist"].get("financial_valuation")
    if not lc:
        return {"message": "Complete valuation step first", "is_final": False}
    return lc
