"""
Permit Service — Step 4
Checks all mandatory and conditional permits required for Malaysian exports.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import json
from typing import Dict, Any, List, Optional
from glmservice import GLMService


PERMIT_SYSTEM = """You are a Malaysian export permits specialist with full knowledge of:
- SIRIM QAS International (Standards & quality)
- JAKIM Halal certification
- MITI export licence (Embargo and strategic goods)
- Department of Veterinary Services (DVS) — animal products
- Department of Agriculture (DOA) — phytosanitary / plant products
- Atomic Energy Licensing Board (AELB) — radioactive / nuclear items
- Strategic Goods (Control) Act 2010
- Customs (Prohibition of Exports) Order 1988

Return JSON:
{
  "permits_required": [
    {
      "name": "",
      "issuing_body": "",
      "mandatory": true,
      "processing_days": 0,
      "fee_myr": 0,
      "portal": "",
      "document_required": []
    }
  ],
  "sirim_required": false,
  "halal_required": false,
  "miti_license_required": false,
  "dvs_required": false,
  "doa_phytosanitary_required": false,
  "aelb_required": false,
  "strategic_goods_control": false,
  "dual_use_item": false,
  "end_user_certificate_required": false,
  "total_estimated_days": 0,
  "total_estimated_cost_myr": 0,
  "fast_track_available": false,
  "notes": []
}"""

COMPLIANCE_SYSTEM = """You are a Malaysian trade compliance auditor.
Run a full compliance check for this export shipment.
Reference: Customs Act 1967, Trade Descriptions Act 2011, Strategic Goods (Control) Act 2010.
Return JSON:
{
  "overall_status": "compliant|non_compliant|pending",
  "compliance_score": 0,
  "critical_issues": [],
  "warnings": [],
  "passed_checks": [],
  "estimated_delay_days": 0,
  "regulatory_citations": []
}"""


class PermitService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def check_permits(
        self,
        session_id: str,
        hs_code: str,
        product_type: str,
        destination_country: str,
    ) -> Dict[str, Any]:
        permit_msg = (
            f"HS Code      : {hs_code}\n"
            f"Product type : {product_type}\n"
            f"Destination  : {destination_country}"
        )
        strategic_system = """You are a Malaysian Strategic Goods Control expert.
Reference: Strategic Goods (Control) Act 2010.
Return JSON: {
  "is_strategic_good": false,
  "is_dual_use": false,
  "control_list_reference": "",
  "end_user_cert_required": false,
  "miti_approval_required": false,
  "notes": ""
}"""
        results = await self.glm.chat_json_many([
            {"system": PERMIT_SYSTEM,    "user": permit_msg},
            {"system": strategic_system, "user": permit_msg},
        ])
        permits, strategic = results[0], results[1]
        if not strategic.get("error"):
            permits["strategic_goods_control"] = strategic.get("is_strategic_good", False)
            permits["dual_use_item"]            = strategic.get("is_dual_use", False)
            permits["strategic_details"]        = strategic
        return {
            "session_id": session_id,
            "hs_code":    hs_code,
            "permits":    permits,
            "flags": {
                "sirim":           permits.get("sirim_required", False),
                "halal":           permits.get("halal_required", False),
                "miti":            permits.get("miti_license_required", False),
                "strategic_goods": permits.get("strategic_goods_control", False),
                "dvs":             permits.get("dvs_required", False),
                "phytosanitary":   permits.get("doa_phytosanitary_required", False),
            },
            "step_complete": True,
        }

    async def check_sirim_requirements(
        self,
        product_description: str,
        hs_code: str,
    ) -> Dict[str, Any]:
        system = """You are a SIRIM QAS International specialist.
Return JSON: {
  "required": false,
  "certification_type": "MS|SIRIM|MCMC|JKR|None",
  "scheme": "",
  "standards_applicable": [],
  "processing_weeks": 0,
  "fee_range_myr": {"min": 0, "max": 0},
  "portal": "https://www.sirim-qas.com.my",
  "documents_needed": [],
  "notes": ""
}"""
        return await self.glm.chat_json(
            system,
            f"Product: {product_description}\nHS Code: {hs_code}",
        )

    async def check_halal_requirements(
        self,
        product_description: str,
        destination_country: str,
    ) -> Dict[str, Any]:
        system = """You are a JAKIM Halal certification specialist.
Return JSON: {
  "required": false,
  "recommended": false,
  "reason": "",
  "jakim_scheme": "",
  "recognised_bodies_at_destination": [],
  "processing_weeks": 0,
  "fee_myr": 0,
  "portal": "https://www.halal.gov.my",
  "product_categories_covered": [],
  "notes": ""
}"""
        return await self.glm.chat_json(
            system,
            f"Product: {product_description}\nDestination: {destination_country}",
        )

    async def full_compliance_check(
        self,
        session_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        return await self.glm.chat_json(
            COMPLIANCE_SYSTEM,
            f"Session data:\n{session_data}",
        )

    async def get_permit_timeline(
        self,
        permits: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        system = """You are a project planning expert for Malaysian export permits.
Return JSON: {
  "critical_path_days": 0,
  "parallel_permits": [],
  "sequential_permits": [],
  "start_immediately": [],
  "gantt_milestones": [
    {"permit": "", "start_day": 0, "end_day": 0, "depends_on": []}
  ],
  "recommended_start_date": "",
  "estimated_ready_date": "",
  "notes": ""
}"""
        return await self.glm.chat_json(
            system,
            f"Permits to obtain:\n{json.dumps(permits, indent=2)}",
        )