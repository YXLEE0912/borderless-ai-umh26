"""
app/routes/consignee_route.py
Step 2 — Consignee (Buyer) Information & Screening
ADDED: buyer_email, buyer_phone, buyer_contact_person (contact details)
       importer_of_record (who clears at destination)
       persists to session store
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/consignee", tags=["Consignee"])


class ConsigneeRequest(BaseModel):
    session_id: str
    buyer_name: str
    buyer_country: str
    buyer_address: str
    incoterm: str = "FOB"
    buyer_tax_id: Optional[str] = None
    # ── NEW: contact details (required for digital clearance systems) ─────────
    buyer_email: Optional[str] = None
    buyer_phone: Optional[str] = None
    buyer_contact_person: Optional[str] = None   # name of the contact at buyer
    importer_of_record: Optional[str] = None     # entity responsible for import customs


@router.post("/add")
async def add_consignee(req: ConsigneeRequest):
    """
    Step 2 — Screen the consignee for sanctions, denied parties,
    and incoterm suitability. Returns risk level + required permits.
    Contact details (email/phone) are stored for document generation and
    digital clearance system pre-fill.
    """
    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are a Malaysian export compliance officer.
Screen the consignee for sanctions and permit triggers.
Return JSON: {
  "risk_level": "low|medium|high",
  "sanctioned_country": false,
  "denied_party_check": "clear|flagged|manual_review_required",
  "incoterm_suitability": {
    "provided_incoterm": "",
    "suitable": true,
    "reason": "",
    "recommended_alternatives": []
  },
  "required_permits": [],
  "compliance_notes": [],
  "recommended_incoterms": ["FOB","CIF","DAP"],
  "red_flags": [],
  "screening_references": ["OFAC SDN List","UN Security Council Sanctions","Malaysian MFA"]
}""",
            user_message=(
                f"Buyer name     : {req.buyer_name}\n"
                f"Country        : {req.buyer_country}\n"
                f"Address        : {req.buyer_address}\n"
                f"Incoterm       : {req.incoterm}\n"
                f"Tax/VAT ID     : {req.buyer_tax_id or 'Not provided'}\n"
                f"Contact person : {req.buyer_contact_person or 'Not provided'}\n"
                f"Email          : {req.buyer_email or 'Not provided'}\n"
                f"Phone          : {req.buyer_phone or 'Not provided'}\n"
                f"Importer of record: {req.importer_of_record or 'Same as buyer'}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    consignee_data = {
        "buyer_name":           req.buyer_name,
        "buyer_country":        req.buyer_country,
        "buyer_address":        req.buyer_address,
        "incoterm":             req.incoterm,
        "buyer_tax_id":         req.buyer_tax_id,
        "buyer_email":          req.buyer_email,
        "buyer_phone":          req.buyer_phone,
        "buyer_contact_person": req.buyer_contact_person,
        "importer_of_record":   req.importer_of_record or req.buyer_name,
    }

    # Persist to session store
    try:
        from main import _sessions
        if req.session_id in _sessions:
            _sessions[req.session_id]["checklist"]["consignee"] = consignee_data
            _sessions[req.session_id]["current_step"] = max(
                _sessions[req.session_id].get("current_step", 1), 3
            )
            _sessions[req.session_id]["progress"] = max(
                _sessions[req.session_id].get("progress", 0), 22
            )
    except ImportError:
        pass

    return {
        "session_id":   req.session_id,
        "consignee":    consignee_data,
        "screening":    result,
        "step_complete": result.get("risk_level") in ["low", "medium"],
    }