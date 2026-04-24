"""
Consignee Service — Step 2
Screens the overseas buyer for sanctions, denied parties, and incoterm suitability.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from typing import Dict, Any, Optional
from glmservice import GLMService


SYSTEM_PROMPT = """You are a Malaysian export compliance officer with expertise in:
- OFAC, UN, EU, and Malaysian sanctions lists
- Denied Party Screening (DPS)
- Incoterm suitability for each destination market
- Customs (Prohibition of Exports) Order requirements

Screen the consignee thoroughly and return JSON:
{
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
  "recommended_incoterms": [],
  "red_flags": [],
  "screening_references": [
    "OFAC SDN List",
    "UN Security Council Sanctions",
    "Malaysian Ministry of Foreign Affairs"
  ]
}"""


class ConsigneeService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def add_consignee(
        self,
        session_id: str,
        buyer_name: str,
        buyer_country: str,
        buyer_address: str,
        incoterm: str = "FOB",
        buyer_tax_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        user_msg = (
            f"Buyer name   : {buyer_name}\n"
            f"Country      : {buyer_country}\n"
            f"Address      : {buyer_address}\n"
            f"Incoterm     : {incoterm}\n"
            f"Tax/VAT ID   : {buyer_tax_id or 'Not provided'}"
        )
        screening = await self.glm.chat_json(SYSTEM_PROMPT, user_msg)
        return {
            "session_id": session_id,
            "consignee": {
                "buyer_name":   buyer_name,
                "country":      buyer_country,
                "address":      buyer_address,
                "incoterm":     incoterm,
                "buyer_tax_id": buyer_tax_id,
            },
            "screening": screening,
            "step_complete": screening.get("risk_level") in ["low", "medium"],
        }

    async def validate_buyer_details(
        self,
        buyer_name: str,
        buyer_country: str,
    ) -> Dict[str, Any]:
        system = """You are a sanctions screening specialist.
Do a rapid check on the entity and country.
Return JSON: {
  "quick_check": "clear|flagged|unknown",
  "country_risk": "low|medium|high",
  "embargo_active": false,
  "notes": ""
}"""
        return await self.glm.chat_json(
            system,
            f"Entity: {buyer_name}\nCountry: {buyer_country}",
        )

    async def recommend_incoterms(
        self,
        destination_country: str,
        mode_of_transport: str,
        product_type: str,
    ) -> Dict[str, Any]:
        system = """You are an international trade Incoterms specialist.
Recommend the best Incoterm for this shipment.
Return JSON: {
  "recommended": "FOB|CIF|DAP|DDP|EXW|CFR",
  "reason": "",
  "alternatives": [],
  "risk_allocation": {
    "seller_risk_ends_at": "",
    "buyer_risk_starts_at": ""
  },
  "cost_implication": ""
}"""
        return await self.glm.chat_json(
            system,
            (
                f"Destination: {destination_country}\n"
                f"Transport mode: {mode_of_transport}\n"
                f"Product type: {product_type}"
            ),
        )