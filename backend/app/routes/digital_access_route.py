"""
app/routes/digital_access_route.py
Step 5 — Digital Access Setup
POST /digital-access/setup
FIX: frontend sends company_brn + session_id as query params (body=null),
     so we accept them via Query() instead of a body model.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.services.digital_access_service import DigitalAccessService
from glmservice import get_glm

router = APIRouter(prefix="/digital-access", tags=["Digital Access"])


@router.post("/setup")
async def setup_digital_access(
    session_id:         str           = Query(...),
    company_brn:        str           = Query(...),
    customs_agent_code: Optional[str] = Query(None),
):
    """
    Step 5 — Assess MyDagangNet and MyECIS / uCustoms setup requirements.
    """
    try:
        svc    = DigitalAccessService(get_glm())
        result = await svc.setup(
            session_id         = session_id,
            company_brn        = company_brn,
            customs_agent_code = customs_agent_code,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result