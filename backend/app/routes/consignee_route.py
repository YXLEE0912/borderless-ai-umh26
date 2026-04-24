from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/consignee", tags=["Consignee"])

# ── Models ────────────────────────────────────────────────────────────────────

class ConsigneeRequest(BaseModel):
    session_id: str
    buyer_name: str
    buyer_country: str
    buyer_address: str
    incoterm: str = "FOB"
    buyer_tax_id: Optional[str] = None

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/add")
async def add_consignee(req: ConsigneeRequest):
    """
    Step 2 — Screen the consignee for sanctions, denied parties,
    and incoterm suitability. Returns risk level + required permits.
    """
    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are a Malaysian export compliance officer.
Screen the consignee for sanctions and permit triggers.
Return JSON: {
  "risk_level": "low|medium|high",
  "sanctioned_country": false,
  "denied_party_check": "clear|flagged",
  "required_permits": [],
  "compliance_notes": [],
  "recommended_incoterms": ["FOB","CIF","DAP"]
}""",
            user_message=(
                f"Buyer: {req.buyer_name}\n"
                f"Country: {req.buyer_country}\n"
                f"Address: {req.buyer_address}\n"
                f"Incoterm: {req.incoterm}\n"
                f"Tax ID: {req.buyer_tax_id or 'Not provided'}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "session_id": req.session_id,
        "consignee": {
            "buyer_name":   req.buyer_name,
            "country":      req.buyer_country,
            "address":      req.buyer_address,
            "incoterm":     req.incoterm,
            "buyer_tax_id": req.buyer_tax_id,
        },
        "screening": result,
    }