"""
Borderless AI Trade Platform — main.py
Run:
    uvicorn main:app --reload --port 8000
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from typing import Optional
import os, uuid, asyncio
from datetime import datetime

# ── Import all routers ────────────────────────────────────────────────────────
from app.routes.entity_route             import router as entity_router
from app.routes.consignee_route          import router as consignee_router
from app.routes.permit_route             import router as permit_router
from app.routes.digital_access_route    import router as digital_access_router
from app.routes.valuation_route          import router as valuation_router
from app.routes.logistics_route          import router as logistics_router
from app.routes.document_route           import router as document_router
from app.routes.customs_route            import router as customs_router
from app.routes.hs_search_route          import router as hs_search_router
# FIX: hs_classification_route replaces hs_route — do NOT import both.
# hs_route.py registered POST /classification/hs-code, and so does
# hs_classification_route.py. Registering both causes a silent duplicate
# where only the last-registered handler runs.
from app.routes.hs_classification_route import router as hs_classification_router

from glmservice import get_glm


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Borderless AI Trade Platform",
    version     = "1.0.0",
    description = "Malaysian export compliance API — 9-step workflow",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_FRONTEND_URL = os.getenv("FRONTEND_URL", "")
_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",   # Vite default
    "http://127.0.0.1:5173",
    "http://localhost:4173",   # Vite preview
]
if _FRONTEND_URL and _FRONTEND_URL not in _CORS_ORIGINS:
    _CORS_ORIGINS.append(_FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store (replace with DB in production) ───────────────────
_sessions: dict = {}

def _new_session() -> dict:
    return {
        "session_id":   str(uuid.uuid4()),
        "created_at":   datetime.utcnow().isoformat(),
        "current_step": 1,
        "progress":     0,
        "chat_history": [],
        "checklist":    {},
        "documents":    {},
        "landed_cost":  None,
    }

# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(entity_router)            # Step 1  — /entity
app.include_router(consignee_router)         # Step 2  — /consignee
# Step 3 — /classification  (hs_classification_route is the full hybrid version;
#           hs_route.py is the old simple version — do NOT register both)
app.include_router(hs_classification_router) # Step 3  — /classification/hs-code
app.include_router(permit_router)            # Step 4  — /permits
app.include_router(digital_access_router)   # Step 5  — /digital-access
app.include_router(valuation_router)         # Step 6  — /valuation
app.include_router(logistics_router)         # Step 7  — /logistics
app.include_router(document_router)          # Step 8  — /trade-docs
app.include_router(customs_router)           # Step 9  — /customs
app.include_router(hs_search_router)         # Util    — /hs/search


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "Borderless AI Trade Platform"}


# ── Sessions ──────────────────────────────────────────────────────────────────
@app.post("/sessions", tags=["Sessions"])
async def create_session():
    session = _new_session()
    _sessions[session["session_id"]] = session
    return session

@app.get("/sessions/{session_id}", tags=["Sessions"])
async def get_session(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        session = _new_session()
        session["session_id"] = session_id
        _sessions[session_id] = session
    return session


# ── Checklist ─────────────────────────────────────────────────────────────────
@app.get("/checklist/{session_id}", tags=["Checklist"])
async def get_checklist(session_id: str):
    session   = _sessions.get(session_id, {})
    checklist = session.get("checklist", {})
    steps = [
        {"step": 1, "label": "Entity Verification",   "key": "entity_verification"},
        {"step": 2, "label": "Consignee Details",      "key": "consignee"},
        {"step": 3, "label": "HS Classification",      "key": "classification"},
        {"step": 4, "label": "Special Permits",        "key": "permits"},
        {"step": 5, "label": "Digital Access Setup",   "key": "digital_access"},
        {"step": 6, "label": "Financial Valuation",    "key": "financial_valuation"},
        {"step": 7, "label": "Logistics Setup",        "key": "logistics"},
        {"step": 8, "label": "Trade Documents",        "key": "documents"},
        {"step": 9, "label": "K2 Customs Declaration", "key": "k2"},
    ]
    items = []
    for s in steps:
        done = s["key"] in checklist
        items.append({
            "step":   s["step"],
            "label":  s["label"],
            "status": "complete" if done else "pending",
            "data":   checklist.get(s["key"]),
        })
    return {
        "session_id":   session_id,
        "current_step": session.get("current_step", 1),
        "progress":     session.get("progress", 0),
        "items":        items,
    }


# ── Document status ───────────────────────────────────────────────────────────
@app.get("/documents/status/{session_id}", tags=["Documents"])
async def get_doc_status(session_id: str):
    session   = _sessions.get(session_id, {})
    docs_data = session.get("documents", {})
    doc_names = [
        "commercial_invoice",
        "packing_list",
        "certificate_of_origin",
        "bill_of_lading",
    ]
    docs = []
    for name in doc_names:
        if name in docs_data:
            status = docs_data[name].get("status", "generated")
        else:
            steps_done = session.get("current_step", 1)
            status = "required" if steps_done >= 7 else "locked"
        docs.append({
            "name":            name,
            "status":          status,
            "steps_remaining": max(0, 8 - session.get("current_step", 1)),
            "locked":          status == "locked",
        })
    return {"session_id": session_id, "documents": docs}


# ── Landed cost ────────────────────────────────────────────────────────────────
@app.get("/landed-cost/{session_id}", tags=["Valuation"])
async def get_landed_cost(session_id: str):
    session = _sessions.get(session_id, {})
    landed  = session.get("landed_cost")
    if not landed:
        return {
            "session_id": session_id,
            "available":  False,
            "message":    "Complete valuation step (Step 6) to see landed cost breakdown.",
        }
    return {"session_id": session_id, "available": True, **landed}


# ── Chat ──────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    session_id: str
    message: str
    stream: bool = False


@app.post("/chat", tags=["Chat"])
async def chat(req: ChatRequest):
    session = _sessions.get(req.session_id, {})
    history = session.get("chat_history", [])

    system_prompt = """You are Borderless AI, an expert Malaysian export compliance assistant.
You guide exporters through a 9-step workflow:
1. Entity Verification (SSM / BRN)
2. Consignee Screening (sanctions, incoterms)
3. HS Code Classification (WCO / AHTN)
4. Special Permits (SIRIM, Halal, MITI, Strategic Goods)
5. Digital Access Setup (MyDagangNet / MyECIS)
6. Financial Valuation (FOB → CIF → Landed Cost, FTA savings)
7. Logistics Setup (container, B/L, port charges)
8. Trade Document Generation (Invoice, Packing List, COO, B/L)
9. K2 Customs Declaration (Dagang Net submission)

Reference Malaysian regulations: Customs Act 1967, Strategic Goods (Control) Act 2010,
Companies Act 2016, Sales Tax Act 2018.
Always be concise, practical, and cite specific portals or regulations when relevant."""

    glm = get_glm()

    if req.stream:
        async def event_stream():
            async for chunk in glm.stream_chat(
                system_prompt,
                [*history, {"role": "user", "content": req.message}],
            ):
                yield chunk
        return StreamingResponse(event_stream(), media_type="text/event-stream")

    # Non-streaming
    reply = await glm.chat(
        system_prompt,
        [*history, {"role": "user", "content": req.message}],
    )

    # Persist chat history in session
    if req.session_id in _sessions:
        _sessions[req.session_id]["chat_history"].append(
            {"role": "user",      "content": req.message}
        )
        _sessions[req.session_id]["chat_history"].append(
            {"role": "assistant", "content": reply}
        )

    return {"session_id": req.session_id, "reply": reply, "stream": False}


# ── Debug ─────────────────────────────────────────────────────────────────────
@app.get("/debug/env", tags=["Health"])
def debug_env():
    return {
        "Z_AI_API_KEY_set": bool(os.getenv("Z_AI_API_KEY")),
        "Z_AI_MODEL":       os.getenv("Z_AI_MODEL",    "NOT SET"),
        "Z_AI_BASE_URL":    os.getenv("Z_AI_BASE_URL", "NOT SET"),
        "FRONTEND_URL":     os.getenv("FRONTEND_URL",  "NOT SET"),
        "MAX_UPLOAD_SIZE":  os.getenv("MAX_UPLOAD_SIZE", "NOT SET"),
        "active_sessions":  len(_sessions),
    }