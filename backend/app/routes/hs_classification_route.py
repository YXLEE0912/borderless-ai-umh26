"""
HS Classification Route — Step 3  (updated)
============================================
Hybrid: AI classification (GLM) + DB similarity search run simultaneously.
classification success，automatic use of TOP HS code to query PUA122 database for permit requirements.

New flow: AI + HS DB classification → Get best HS code → Check PUA122 DB → Return precise permit list
If PUA122 DB unavailable, fallback to AI-only permit check.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional, List
import os
import asyncio
import logging

from glmservice import get_glm
from app.services.permit_lookup_service import get_permit_lookup_service

HS_PATCH = """
from app.engines.validation_engine import ValidationEngine
 
@router.post("/hs-code")
async def classify_hs_code(req: HSCodeRequest):
 
    errors = ValidationEngine.validate_product_description(req.product_description)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
 
    # ── rest of existing code unchanged ────────────────────────────────────
    ...
"""

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/classification", tags=["HS Classification"])

# ── DB config ─────────────────────────────────────────────────────────────────
DB_CONFIG = {
    "dbname":   os.getenv("HS_DB_NAME", "hsdb"),
    "user":     os.getenv("HS_DB_USER", "postgres"),
    "password": os.getenv("HS_DB_PASSWORD", ""),
    "host":     os.getenv("HS_DB_HOST", "localhost"),
    "port":     int(os.getenv("HS_DB_PORT", "5432")),
}
DB_AVAILABLE = bool(os.getenv("HS_DB_PASSWORD"))

# ── Models ────────────────────────────────────────────────────────────────────

class HSCodeRequest(BaseModel):
    session_id: str
    product_description: str
    destination_country: str
    product_category: Optional[str] = None


# ── AI Classification ─────────────────────────────────────────────────────────

async def _classify_with_ai(
    product_description: str,
    destination_country: str,
    product_category: Optional[str],
) -> List[dict]:
    glm = get_glm()
    result = await glm.chat_json(
        system_prompt="""You are an HS tariff classification expert for Malaysian exports.
Reference: WCO Harmonized System 2022, ASEAN Harmonized Tariff Nomenclature (AHTN),
Malaysian Customs Tariff Schedule.

Return JSON:
{
  "top_results": [
    {
      "hs_code": "XXXX.XX.XX",
      "description": "",
      "confidence": 0.95,
      "explanation": "",
      "malaysia_export_duty": 0.0,
      "destination_import_duty": 0.0,
      "fta_available": [],
      "permit_required": [],
      "restrictions": [],
      "strategic_goods": false
    }
  ],
  "classification_notes": [],
  "tariff_schedule_reference": ""
}

Return exactly 3 candidates sorted by confidence descending.""",
        user_message=(
            f"Product: {product_description}\n"
            f"Category: {product_category or 'Not specified'}\n"
            f"Destination: {destination_country}"
        ),
    )
    candidates = result.get("top_results", [])
    return [
        {
            "hs_code":                   c.get("hs_code", ""),
            "description":               c.get("description", ""),
            "confidence":                float(c.get("confidence", 0.5)),
            "source":                    "ai",
            "explanation":               c.get("explanation", ""),
            "malaysia_export_duty":      c.get("malaysia_export_duty", 0.0),
            "destination_import_duty":   c.get("destination_import_duty", 0.0),
            "fta_available":             c.get("fta_available", []),
            "permit_required":           c.get("permit_required", []),
            "restrictions":              c.get("restrictions", []),
            "strategic_goods":           c.get("strategic_goods", False),
        }
        for c in candidates
    ]


# ── DB Similarity Search ──────────────────────────────────────────────────────

async def _search_db(product_description: str) -> List[dict]:
    if not DB_AVAILABLE:
        return []
    try:
        import psycopg2
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        words = " | ".join(product_description.split()[:8])
        cur.execute("""
            SELECT hscode, description,
                   ts_rank(to_tsvector('english', description),
                            to_tsquery('english', %s)) AS rank
            FROM hs_codes
            WHERE to_tsvector('english', description) @@ to_tsquery('english', %s)
               OR description ILIKE %s
            ORDER BY rank DESC
            LIMIT 3
        """, (words, words, f"%{product_description[:40]}%"))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {
                "hs_code":     r[0],
                "description": r[1],
                "confidence":  min(float(r[2]) * 0.7 + 0.3, 0.99),
                "source":      "db",
                "explanation": f"Database full-text match: '{r[1]}'",
            }
            for r in rows
        ]
    except Exception as e:
        logger.warning(f"HS DB search unavailable: {e}")
        return []


# ── Merge ─────────────────────────────────────────────────────────────────────

def _merge_results(ai_results: List[dict], db_results: List[dict]) -> List[dict]:
    merged = {r["hs_code"]: r for r in ai_results}
    for db in db_results:
        code = db["hs_code"]
        if code in merged:
            merged[code]["confidence"] = min(merged[code]["confidence"] * 1.15, 0.99)
            merged[code]["source"] = "ai+db"
            merged[code]["explanation"] += f" ✓ DB confirmed: '{db['description']}'"
        else:
            merged[code] = db
    return sorted(merged.values(), key=lambda x: x["confidence"], reverse=True)[:3]


# ── FTA ───────────────────────────────────────────────────────────────────────

async def _get_fta_eligibility(hs_code: str, destination_country: str, product_description: str) -> dict:
    glm = get_glm()
    return await glm.chat_json(
        system_prompt="""You are a Free Trade Agreement specialist for Malaysia.
Return JSON:
{
  "best_fta": "",
  "preferential_rate": 0.0,
  "mfn_rate": 0.0,
  "savings_potential_percent": 0.0,
  "form_required": "Form D|Form E|RCEP Form|AI Form|None",
  "roo_requirements": [],
  "direct_shipment_required": true,
  "notes": ""
}""",
        user_message=f"HS Code: {hs_code}\nProduct: {product_description}\nDestination: {destination_country}",
    )


# ── AI fallback permit check ──────────────────────────────────────────────────

async def _ai_permit_check(hs_code: str, destination_country: str, product_description: str) -> dict:
    """当 PUA122 DB without data，use AI determine permit requirements。"""
    glm = get_glm()
    return await glm.chat_json(
        system_prompt="""You are a Malaysian export permits specialist.
Reference: Customs (Prohibition of Exports) Order (PUA 122), Strategic Goods (Control) Act 2010.
Return JSON:
{
  "requires_permit": false,
  "schedules_triggered": [],
  "permits": [
    {
      "name": "",
      "issuing_body": "",
      "mandatory": true,
      "processing_days": 0,
      "fee_myr": 0,
      "portal": "",
      "notes": ""
    }
  ],
  "sirim_required": false,
  "halal_required": false,
  "miti_license_required": false,
  "strategic_goods_control": false,
  "export_prohibited": false,
  "notes": []
}""",
        user_message=(
            f"HS Code: {hs_code}\n"
            f"Product: {product_description}\n"
            f"Destination: {destination_country}"
        ),
    )


# ── Build permit response from PUA122 DB result ───────────────────────────────

def _build_permit_from_db(db_result: dict) -> dict:
    """
    PUA122 DB query result convert to format compatible with permit_route.py.
    """
    if not db_result.get("permits_found"):
        return {
            "requires_permit":       False,
            "schedules_triggered":   [],
            "issuing_bodies":        [],
            "permits":               [],
            "source":                "pua122_db",
            "db_available":          db_result.get("db_available", False),
        }

    summary = db_result.get("permit_summary", {})
    matches = db_result.get("matches", [])


    seen_bodies = set()
    permits = []
    for m in matches:
        body = m.get("issuing_body", "")
        if body and body not in seen_bodies:
            seen_bodies.add(body)
            permits.append({
                "name":          f"Export Permit — {m.get('schedule', '')} Schedule",
                "issuing_body":  body,
                "mandatory":     True,
                "schedule":      m.get("schedule", ""),
                "description":   m.get("description", ""),
                "destination":   m.get("destination", ""),
                "hs_matched":    m.get("hs_raw_token", ""),
                "match_type":    m.get("match_type", ""),
                "portal":        _get_portal(body),
                "notes":         f"PUA 122 {m.get('schedule','')} Schedule, Item {m.get('item_no','')}",
            })

    return {
        "requires_permit":       True,
        "schedules_triggered":   summary.get("schedules_triggered", []),
        "issuing_bodies":        summary.get("issuing_bodies", []),
        "destinations_affected": summary.get("destinations_affected", []),
        "permits":               permits,
        "source":                "pua122_db",
        "db_available":          True,
        "raw_matches":           matches,
    }


def _get_portal(issuing_body: str) -> str:
    PORTALS = {
        "Ministry of Plantation":     "https://www.mpic.gov.my",
        "Malaysian Palm Oil Board":   "https://www.mpob.gov.my",
        "Malaysian Timber":           "https://www.mtib.gov.my",
        "MAQIS":                      "https://www.maqis.gov.my",
        "Ministry of Natural":        "https://www.nre.gov.my",
        "Ministry of Defence":        "https://www.mod.gov.my",
        "Ministry of Domestic":       "https://www.kpdnhep.gov.my",
        "Ministry of International":  "https://www.miti.gov.my",
        "Pharmaceutical":             "https://www.pharmacy.gov.my",
        "Department of Environment":  "https://www.doe.gov.my",
        "Wildlife":                   "https://www.wildlife.gov.my",
        "Fisheries":                  "https://www.dof.gov.my",
        "Agriculture":                "https://www.doa.gov.my",
        "Veterinary":                 "https://www.dvs.gov.my",
        "Rubber Board":               "https://www.lgm.gov.my",
        "Pesticides":                 "https://www.doa.gov.my",
        "Atomic Energy":              "https://www.aelb.gov.my",
        "Controller of Supplies":     "https://www.mod.gov.my",
        "Forestry":                   "https://www.forestry.gov.my",
    }
    for key, url in PORTALS.items():
        if key.lower() in issuing_body.lower():
            return url
    return "https://www.customs.gov.my"


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.post("/hs-code")
async def classify_hs_code(req: HSCodeRequest):
    """
    Step 3 — Hybrid HS Classification + PUA122 Permit Lookup.

    流程：
    1. AI + HS DB → 分类出最优 HS code
    2. 用最优 HS code → 查 PUA122 DB → 精确 permit 要求
    3. PUA122 DB 无数据 → 降级到 AI permit 判断
    """
    try:
        # ── Phase 1: HS Classification（AI + DB parallel）────────────────────────
        ai_task = _classify_with_ai(
            req.product_description,
            req.destination_country,
            req.product_category,
        )
        db_task = _search_db(req.product_description)

        ai_results, db_results = await asyncio.gather(ai_task, db_task)
        merged = _merge_results(ai_results, db_results)

        if not merged:
            raise HTTPException(status_code=422, detail="No HS code candidates found.")

        best = merged[0]
        best_hs_code = best["hs_code"]

        # ── Phase 2: FTA + PUA122 Permit Lookup（parallel）───────────────────────
        pua122_service = get_permit_lookup_service()

        fta_task    = _get_fta_eligibility(best_hs_code, req.destination_country, req.product_description)
        permit_task = pua122_service.lookup(best_hs_code, req.destination_country)

        fta_result, pua122_result = await asyncio.gather(fta_task, permit_task)

        # ── Phase 3: construct permit response ─────────────────────────────────────────
        if pua122_result.get("db_available") and pua122_result.get("permits_found"):
            # ✅ PUA122 DB matched → use real permit data
            permit_info = _build_permit_from_db(pua122_result)
            permit_source = "pua122_db"
        elif pua122_result.get("db_available") and not pua122_result.get("permits_found"):
            # ✅ DB available but no match → this HS code is not controlled by PUA122
            permit_info = {
                "requires_permit":     False,
                "schedules_triggered": [],
                "issuing_bodies":      [],
                "permits":             [],
                "source":              "pua122_db",
                "db_available":        True,
                "note":                "HS code not found in PUA122 controlled goods list.",
            }
            permit_source = "pua122_db"
        else:
            # ⚠️ DB unavailable → AI fallback
            ai_permit = await _ai_permit_check(best_hs_code, req.destination_country, req.product_description)
            permit_info = {**ai_permit, "source": "ai_fallback", "db_available": False}
            permit_source = "ai_fallback"

        # ── Final Response ──────────────────────────────────────────────────────────
        return {
            "session_id":          req.session_id,
            "product":             req.product_description,
            "destination_country": req.destination_country,

            # HS Classification results
            "top_result": {
                **best,
                "fta_eligibility": fta_result,
            },
            "alternatives":    merged[1:],
            "db_search_used":  bool(db_results),
            "consensus_found": any(r["source"] == "ai+db" for r in merged),

            # ✅ Permit Check Results (Core Addition)
            "permit_check": {
                "hs_code":        best_hs_code,
                "permit_source":  permit_source,   # "pua122_db" | "ai_fallback"
                **permit_info,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HS classification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Standalone permit check by HS code ───────────────────────────────────────

@router.get("/permit-check")
async def check_permit_by_hs(
    hs_code: str = Query(..., description="HS code, e.g. 1511.10.00"),
    destination_country: str = Query("", description="Destination country"),
):
    """
    Standalone permit check endpoint.
    First checks the PUA122 DB, and falls back to AI if the DB is unavailable.
    """
    try:
        pua122_service = get_permit_lookup_service()
        pua122_result  = await pua122_service.lookup(hs_code, destination_country)

        if pua122_result.get("db_available"):
            permit_info   = _build_permit_from_db(pua122_result)
            permit_source = "pua122_db"
        else:
            # fallback to AI + permit PDF
            glm = get_glm()
            permit_pdf_text = _load_permit_pdf_text()
            user_msg = (
                f"HS Code: {hs_code}\nDestination: {destination_country or 'Not specified'}"
                + (f"\n\nReference:\n{permit_pdf_text[:4000]}" if permit_pdf_text else "")
            )
            ai_result = await glm.chat_json(
                system_prompt="""You are a Malaysian export permits specialist.
Reference: Customs (Prohibition of Exports) Order (PUA 122).
Return JSON:
{
  "requires_permit": false,
  "schedules_triggered": [],
  "permits": [{"name":"","issuing_body":"","mandatory":true,"processing_days":0,"fee_myr":0,"portal":"","notes":""}],
  "sirim_required": false,
  "halal_required": false,
  "miti_license_required": false,
  "strategic_goods_control": false,
  "export_prohibited": false,
  "notes": []
}""",
                user_message=user_msg,
            )
            permit_info   = {**ai_result, "source": "ai_fallback", "db_available": False}
            permit_source = "pdf+ai" if permit_pdf_text else "ai_fallback"

        return {
            "hs_code":       hs_code,
            "permit_source": permit_source,
            **permit_info,
        }

    except Exception as e:
        logger.error(f"Permit check error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Upload permit PDF ─────────────────────────────────────────────────────────

@router.post("/upload-permit-pdf")
async def upload_permit_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    try:
        import pdfplumber, tempfile, pathlib
        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        text_pages = []
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages[:30]:
                t = page.extract_text()
                if t:
                    text_pages.append(t)
        full_text = "\n\n".join(text_pages)
        out_path  = pathlib.Path(os.getenv("PERMIT_PDF_PATH", "/tmp/permit_schedule.txt"))
        out_path.write_text(full_text, encoding="utf-8")
        os.environ["PERMIT_PDF_PATH"] = str(out_path)
        import os as _os
        _os.unlink(tmp_path)
        return {"status": "ok", "pages_extracted": len(text_pages), "characters": len(full_text)}
    except ImportError:
        raise HTTPException(status_code=501, detail="pip install pdfplumber")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _load_permit_pdf_text() -> Optional[str]:
    path = os.getenv("PERMIT_PDF_PATH", "")
    if not path:
        return None
    try:
        import pathlib
        p = pathlib.Path(path)
        if p.exists():
            return p.read_text(encoding="utf-8")
    except Exception:
        pass
    return None