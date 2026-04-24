"""
app/routes/digital_access_route.py
Step 5 — Digital Access Setup
POST /digital-access/setup
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.services.digital_access_service import DigitalAccessService
from glmservice import get_glm

router = APIRouter(prefix="/digital-access", tags=["Digital Access"])


# ── Models ────────────────────────────────────────────────────────────────────

class DigitalAccessRequest(BaseModel):
    session_id: str
    company_brn: str
    customs_agent_code: Optional[str] = None


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/setup")
async def setup_digital_access(req: DigitalAccessRequest):
    """
    Step 5 — Assess MyDagangNet and MyECIS / uCustoms setup requirements.
    Returns portal registration steps, digital certificate needs,
    estimated setup timeline, and whether a customs agent is required.
    """
    try:
        svc    = DigitalAccessService(get_glm())
        result = await svc.setup(
            session_id          = req.session_id,
            company_brn         = req.company_brn,
            customs_agent_code  = req.customs_agent_code,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result