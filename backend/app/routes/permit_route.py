from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/permits", tags=["Special Permits"])

# ── Models ────────────────────────────────────────────────────────────────────

class PermitsRequest(BaseModel):
    session_id: str
    hs_code: str
    product_type: str
    destination_country: str

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/check")
async def check_permits(req: PermitsRequest):
    """
    Step 4 — Check SIRIM, Halal, MITI, and strategic goods requirements
    based on HS code and destination. Returns permit list with fees and timelines.
    """
    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are a Malaysian SIRIM/MITI/Halal permits specialist.
Reference: Strategic Goods (Control) Act 2010, Customs (Prohibition of Exports) Order.
Return JSON: {
  "permits_required": [
    {
      "name": "",
      "issuing_body": "",
      "mandatory": true,
      "processing_days": 0,
      "fee_myr": 0,
      "portal": ""
    }
  ],
  "sirim_required": false,
  "halal_required": false,
  "miti_license_required": false,
  "strategic_goods_control": false,
  "dual_use_item": false,
  "total_estimated_days": 0,
  "total_estimated_cost_myr": 0,
  "notes": []
}""",
            user_message=(
                f"HS Code: {req.hs_code}\n"
                f"Product type: {req.product_type}\n"
                f"Destination: {req.destination_country}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "session_id": req.session_id,
        "hs_code":    req.hs_code,
        "permits":    result,
    }