from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/classification", tags=["HS Classification"])

# ── Models ────────────────────────────────────────────────────────────────────

class HSCodeRequest(BaseModel):
    session_id: str
    product_description: str
    destination_country: str
    product_category: Optional[str] = None

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/hs-code")
async def classify_hs_code(req: HSCodeRequest):
    """
    Step 3 — Classify product against WCO Harmonized System.
    Returns 8-digit HS code, duty rates, FTA applicability, and restrictions.
    """
    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are an HS tariff classification expert for Malaysian exports.
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
            user_message=(
                f"Product: {req.product_description}\n"
                f"Category: {req.product_category or 'Not specified'}\n"
                f"Destination: {req.destination_country}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "session_id":          req.session_id,
        "product_description": req.product_description,
        "destination_country": req.destination_country,
        "classification":      result,
    }