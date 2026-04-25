"""
HS Classification Service — Step 3
Classifies products against the WCO Harmonized System for Malaysian exports.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from typing import Dict, Any, Optional, List
from glmservice import GLMService


CLASSIFICATION_SYSTEM = """You are an HS tariff classification expert for Malaysian exports.
You are trained on:
- WCO Harmonized System 2022
- ASEAN Harmonized Tariff Nomenclature (AHTN)
- Malaysian Customs Tariff Schedule
- ATIGA / CPTPP / RCEP duty schedules

Return JSON:
{
  "hs_code": "XXXX.XX.XX",
  "hs_description": "",
  "chapter": "",
  "chapter_description": "",
  "malaysia_export_duty": 0.0,
  "destination_import_duty": 0.0,
  "preferential_duty_rates": {
    "ATIGA": 0.0,
    "CPTPP": 0.0,
    "RCEP": 0.0
  },
  "gst_sst_applicable": false,
  "fta_available": [],
  "permit_required": [],
  "restrictions": [],
  "export_prohibited": false,
  "strategic_goods": false,
  "dual_use": false,
  "confidence": 0.95,
  "classification_notes": [],
  "tariff_schedule_reference": ""
}"""

FTA_SYSTEM = """You are a Free Trade Agreement specialist for Malaysia.
Assess FTA eligibility and Rules of Origin requirements.
Return JSON:
{
  "fta_applicable": [],
  "best_fta": "",
  "preferential_rate": 0.0,
  "mfn_rate": 0.0,
  "savings_potential_percent": 0.0,
  "form_required": "Form D|Form E|RCEP Form|AI Form|None",
  "roo_requirements": [],
  "local_content_threshold": 0,
  "ctc_rule": "",
  "cumulation_applicable": false,
  "direct_shipment_required": true,
  "notes": ""
}"""


class HSClassificationService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def classify(
        self,
        session_id: str,
        product_description: str,
        destination_country: str,
        product_category: Optional[str] = None,
    ) -> Dict[str, Any]:
        user_msg = (
            f"Product description : {product_description}\n"
            f"Product category    : {product_category or 'Not specified'}\n"
            f"Destination country : {destination_country}"
        )
        classification, fta = await self.glm.chat_json_many([
            {"system": CLASSIFICATION_SYSTEM, "user": user_msg},
            {
                "system": FTA_SYSTEM,
                "user": (
                    f"Product: {product_description}\n"
                    f"Destination: {destination_country}\n"
                    f"Category: {product_category or 'General'}"
                ),
            },
        ])
        return {
            "session_id":          session_id,
            "product_description": product_description,
            "destination_country": destination_country,
            "classification":      classification,
            "fta_eligibility":     fta,
            "step_complete":       not classification.get("parse_error"),
        }

    async def lookup_hs_code(self, hs_code: str) -> Dict[str, Any]:
        system = """You are an HS tariff database expert.
Look up this HS code and return full details.
Return JSON: {
  "hs_code": "",
  "description": "",
  "chapter": "",
  "section": "",
  "notes": [],
  "common_products": [],
  "exclusions": []
}"""
        return await self.glm.chat_json(system, f"HS Code: {hs_code}")

    async def check_restricted_goods(
        self,
        hs_code: str,
        destination: str,
    ) -> Dict[str, Any]:
        system = """You are a Malaysian Strategic Goods Control expert.
Reference: Strategic Goods (Control) Act 2010, Customs (Prohibition of Exports) Order.
Return JSON: {
  "restricted": false,
  "prohibited": false,
  "strategic_goods": false,
  "dual_use": false,
  "end_user_cert_required": false,
  "permits_required": [],
  "relevant_laws": [],
  "embargo_check": "clear|flagged"
}"""
        return await self.glm.chat_json(
            system,
            f"HS Code: {hs_code}\nDestination: {destination}",
        )

    async def check_fta_eligibility(
        self,
        hs_code: str,
        origin: str,
        destination: str,
        fob_value_myr: Optional[float] = None,
    ) -> Dict[str, Any]:
        return await self.glm.chat_json(
            FTA_SYSTEM,
            (
                f"HS Code      : {hs_code}\n"
                f"Origin       : {origin}\n"
                f"Destination  : {destination}\n"
                f"FOB value    : MYR {fob_value_myr or 'unknown'}"
            ),
        )

    async def suggest_alternatives(
        self,
        product_description: str,
        current_hs_code: str,
    ) -> Dict[str, Any]:
        system = """You are an HS classification dispute resolver.
Suggest alternative HS codes that could apply to this product.
Return JSON: {
  "alternatives": [
    {
      "hs_code": "",
      "description": "",
      "confidence": 0.0,
      "reason": ""
    }
  ],
  "recommendation": "",
  "ruling_reference": ""
}"""
        return await self.glm.chat_json(
            system,
            (
                f"Product: {product_description}\n"
                f"Current HS code: {current_hs_code}"
            ),
        )