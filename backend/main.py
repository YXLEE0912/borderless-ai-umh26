"""
Borderless AI Trade Platform — main.py
Run:
    uvicorn main:app --reload --port 8000
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter
import os
import requests

# ── Import all routers ────────────────────────────────────────────────────────
from app.routes.entity_route          import router as entity_router
from app.routes.consignee_route       import router as consignee_router
from app.routes.hs_route              import router as hs_router
from app.routes.permit_route          import router as permit_router
from app.routes.digital_access_route  import router as digital_access_router
from app.routes.valuation_route       import router as valuation_router
from app.routes.logistics_route       import router as logistics_router
from app.routes.document_route        import router as document_router
from app.routes.customs_route         import router as customs_router

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Borderless AI Trade Platform",
    version     = "1.0.0",
    description = "Malaysian export compliance API — 9-step workflow",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins     = [FRONTEND_URL, "http://localhost:3000"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Register routers (in workflow step order) ─────────────────────────────────
app.include_router(entity_router)          # Step 1 — POST /entity/verify
app.include_router(consignee_router)       # Step 2 — POST /consignee/add
app.include_router(hs_router)              # Step 3 — POST /classification/hs-code
app.include_router(permit_router)          # Step 4 — POST /permits/check
app.include_router(digital_access_router)  # Step 5 — POST /digital-access/setup
app.include_router(valuation_router)       # Step 6 — POST /valuation/calculate
app.include_router(logistics_router)       # Step 7 — POST /logistics/setup
app.include_router(document_router)        # Step 8 — POST /trade-docs/generate
app.include_router(customs_router)         # Step 9 — POST /customs/submit-k2

# ── GLM Chat Router ──────────────────────────────────────────────────────────
glm_router = APIRouter(prefix="/glm", tags=["GLM"])

Z_AI_API_KEY  = os.getenv("Z_AI_API_KEY")
Z_AI_BASE_URL = os.getenv("Z_AI_BASE_URL")
Z_AI_MODEL    = os.getenv("Z_AI_MODEL")


@glm_router.post("/chat")
def glm_chat(message: str):
    url = f"{Z_AI_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {Z_AI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": Z_AI_MODEL,
        "messages": [
            {"role": "user", "content": message}
        ]
    }
    resp = requests.post(url, headers=headers, json=payload)
    return resp.json()

app.include_router(glm_router)

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "Borderless AI Trade Platform"}

# ── Debug (disable in production) ────────────────────────────────────────────
@app.get("/debug/env", tags=["Health"])
def debug_env():
    return {
        "Z_AI_API_KEY_set": bool(os.getenv("Z_AI_API_KEY")),
        "Z_AI_MODEL":       os.getenv("Z_AI_MODEL",    "NOT SET"),
        "Z_AI_BASE_URL":    os.getenv("Z_AI_BASE_URL", "NOT SET"),
        "FRONTEND_URL":    os.getenv("FRONTEND_URL", "NOT SET"),
        "MAX_UPLOAD_SIZE": os.getenv("MAX_UPLOAD_SIZE", "NOT SET"),
    }