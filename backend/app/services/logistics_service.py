"""
Logistics Service — Step 7
Handles mode-of-transport selection, container recommendations,
B/L type, port charges, shipping docs, and K2 transport codes.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import json
from typing import Dict, Any, Optional, List
from glmservice import GLMService


LOGISTICS_SYSTEM = """You are a Malaysian freight and customs logistics expert with knowledge of:
- Port Klang, Penang Port, Johor Port, Kuching Port operations
- Sea (FCL/LCL), Air, Road (ASEAN land bridge), and Rail logistics
- Malaysian customs transport mode codes for K2 declarations
- IATA/FIATA documentation standards
- Incoterm-to-document mapping

Return JSON:
{
  "container_type": "20GP|40GP|40HC|LCL|AIR|TRUCK",
  "estimated_transit_days": 0,
  "customs_clearance_days": 0,
  "bl_type": "OBL|SWB|TELEX|AWB|CMR",
  "required_shipping_docs": [
    {"document": "", "mandatory": true, "issuing_party": ""}
  ],
  "port_charges_myr": 0,
  "handling_charges_myr": 0,
  "terminal_handling_myr": 0,
  "total_logistics_cost_myr": 0,
  "shipping_line_recommendations": [],
  "k2_transport_mode_code": "",
  "export_permit_needed_from_port": false,
  "hazmat_declaration_required": false,
  "notes": []
}"""

SHIPPING_DOCS_SYSTEM = """You are a Malaysian trade documentation specialist.
List all shipping documents required for this export.
Return JSON: {
  "mandatory_docs": [
    {"name": "", "issuing_party": "", "copies_needed": 0, "digital_accepted": true}
  ],
  "conditional_docs": [
    {"name": "", "condition": "", "issuing_party": ""}
  ],
  "k2_attachments": [],
  "total_doc_count": 0,
  "estimated_preparation_days": 0
}"""


class LogisticsService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def setup(
        self,
        session_id: str,
        mode: str,
        port_of_loading: str,
        port_of_discharge: str,
        gross_weight_kg: float,
        cbm: float,
        vessel_name: Optional[str] = None,
        flight_number: Optional[str] = None,
        container_number: Optional[str] = None,
        export_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        logistics_msg = (
            f"Mode              : {mode}\n"
            f"Port of loading   : {port_of_loading}\n"
            f"Port of discharge : {port_of_discharge}\n"
            f"Vessel/Flight     : {vessel_name or flight_number or 'TBC'}\n"
            f"Container number  : {container_number or 'TBC'}\n"
            f"Gross weight      : {gross_weight_kg} kg\n"
            f"CBM               : {cbm}\n"
            f"Export date       : {export_date or 'TBC'}"
        )
        results = await self.glm.chat_json_many([
            {"system": LOGISTICS_SYSTEM,     "user": logistics_msg},
            {"system": SHIPPING_DOCS_SYSTEM, "user": logistics_msg},
        ])
        logistics_result, docs_result = results[0], results[1]
        return {
            "session_id": session_id,
            "logistics": {
                "mode":             mode,
                "pol":              port_of_loading,
                "pod":              port_of_discharge,
                "vessel":           vessel_name,
                "flight":           flight_number,
                "container_number": container_number,
                "weight_kg":        gross_weight_kg,
                "cbm":              cbm,
                "export_date":      export_date,
            },
            "recommendations":   logistics_result,
            "shipping_documents": docs_result,
            "step_complete":     not logistics_result.get("parse_error"),
        }

    async def recommend_container(
        self,
        weight_kg: float,
        cbm: float,
        cargo_type: str,
        destination: str,
    ) -> Dict[str, Any]:
        system = """You are a container planning specialist.
Return JSON: {
  "recommended_container": "20GP|40GP|40HC|LCL",
  "container_capacity_cbm": 0,
  "utilisation_percent": 0,
  "stuffing_plan": "",
  "alternative": "",
  "cost_comparison": {"fcl_myr": 0, "lcl_myr": 0, "recommended": "FCL|LCL"},
  "notes": ""
}"""
        return await self.glm.chat_json(
            system,
            (
                f"Weight       : {weight_kg} kg\n"
                f"CBM          : {cbm}\n"
                f"Cargo type   : {cargo_type}\n"
                f"Destination  : {destination}"
            ),
        )

    async def get_port_info(
        self,
        port_name: str,
        mode: str,
    ) -> Dict[str, Any]:
        system = """You are a Malaysian port operations specialist.
Return JSON: {
  "port_name": "",
  "port_code": "",
  "country": "",
  "customs_office": "",
  "operating_hours": "",
  "typical_dwell_days": 0,
  "free_time_days": 0,
  "charges": {
    "thc_myr": 0,
    "documentation_myr": 0,
    "storage_per_day_myr": 0
  },
  "digital_submission": true,
  "portal": "",
  "notes": []
}"""
        return await self.glm.chat_json(
            system,
            f"Port: {port_name}\nMode: {mode}",
        )

    async def calculate_chargeable_weight(
        self,
        gross_weight_kg: float,
        cbm: float,
        mode: str,
    ) -> Dict[str, Any]:
        volumetric_factor = 167.0 if mode.upper() == "AIR" else 1000.0
        volumetric_weight = round(cbm * volumetric_factor, 2)
        chargeable        = max(gross_weight_kg, volumetric_weight)
        return {
            "gross_weight_kg":      gross_weight_kg,
            "cbm":                  cbm,
            "volumetric_factor":    volumetric_factor,
            "volumetric_weight_kg": volumetric_weight,
            "chargeable_weight_kg": chargeable,
            "basis":                "Volumetric" if volumetric_weight > gross_weight_kg else "Gross",
            "mode":                 mode,
        }

    async def validate_for_k2(
        self,
        logistics_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        system = """You are a Malaysian Customs K2 declaration validator.
Return JSON: {
  "valid": true,
  "missing_fields": [],
  "invalid_fields": [{"field": "", "issue": "", "fix": ""}],
  "warnings": [],
  "k2_transport_code": "",
  "k2_port_code_pol": "",
  "k2_port_code_pod": "",
  "ready_for_submission": true
}"""
        return await self.glm.chat_json(
            system,
            f"Logistics data:\n{json.dumps(logistics_data, indent=2)}",
        )