"""
app/routes/logistics_route.py
Step 7 — Logistics & Transport Identification
ADDED: package_type, container_type, number_of_packages,
       net_weight_kg (separate from gross), port_of_export (Malaysian side)
       signatory fields collected here so they are ready for K2 + documents
       persists to session store
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/logistics", tags=["Logistics"])


class LogisticsRequest(BaseModel):
    session_id: str
    mode: Literal["SEA", "AIR", "ROAD", "RAIL"]
    port_of_loading: str = "Port Klang"          # Malaysian export port
    port_of_discharge: str                        # destination port
    gross_weight_kg: float
    cbm: float
    # ── Physical metrics ─────────────────────────────────────────────────────
    net_weight_kg: Optional[float] = None         # NEW: net weight separate from gross
    number_of_packages: Optional[int] = None      # NEW: total package count
    package_type: Optional[str] = None            # NEW: CTN | PALLET | DRUM | BAG | BOX
    container_number: Optional[str] = None
    # ── Transport identification ──────────────────────────────────────────────
    vessel_name: Optional[str] = None
    flight_number: Optional[str] = None
    voyage_number: Optional[str] = None           # NEW: voyage/flight number
    export_date: Optional[str] = None             # ISO date e.g. "2026-05-02"
    # ── Signatory (collected here, used in docs + K2) ─────────────────────────
    signatory_name: Optional[str] = None          # NEW: full name of authorized person
    signatory_ic_or_passport: Optional[str] = None  # NEW: IC / passport number
    signatory_designation: Optional[str] = None   # NEW: job title / designation


@router.post("/setup")
async def setup_logistics(req: LogisticsRequest):
    """
    Step 7 — Recommend container type, B/L type, transit time, port charges,
    and required shipping documents. Also captures signatory identity for
    K2 declaration and trade document certification.
    """
    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are a Malaysian freight and logistics expert (sea, air, road, rail).
Return JSON: {
  "container_type": "20GP|40GP|40HC|LCL|AIR|TRUCK",
  "bl_type": "OBL|SWB|TELEX|AWB|CMR",
  "estimated_transit_days": 0,
  "customs_clearance_days": 0,
  "required_shipping_docs": [
    {"document": "", "mandatory": true, "issuing_party": ""}
  ],
  "port_charges_myr": 0,
  "handling_charges_myr": 0,
  "terminal_handling_myr": 0,
  "total_logistics_cost_myr": 0,
  "shipping_line_recommendations": [],
  "k2_transport_mode_code": "",
  "k2_port_code_pol": "",
  "k2_port_code_pod": "",
  "export_permit_needed_from_port": false,
  "hazmat_declaration_required": false,
  "notes": []
}""",
            user_message=(
                f"Mode              : {req.mode}\n"
                f"Port of loading   : {req.port_of_loading}\n"
                f"Port of discharge : {req.port_of_discharge}\n"
                f"Vessel/Flight     : {req.vessel_name or req.flight_number or 'TBC'}\n"
                f"Voyage/Flight no  : {req.voyage_number or 'TBC'}\n"
                f"Gross weight      : {req.gross_weight_kg} kg\n"
                f"Net weight        : {req.net_weight_kg or 'TBC'} kg\n"
                f"CBM               : {req.cbm}\n"
                f"Packages          : {req.number_of_packages or 'TBC'} x {req.package_type or 'TBC'}\n"
                f"Container number  : {req.container_number or 'TBC'}\n"
                f"Export date       : {req.export_date or 'TBC'}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    logistics_data = {
        "mode":                   req.mode,
        "pol":                    req.port_of_loading,
        "pod":                    req.port_of_discharge,
        "vessel":                 req.vessel_name,
        "flight":                 req.flight_number,
        "voyage_number":          req.voyage_number,
        "container_number":       req.container_number,
        "weight_kg":              req.gross_weight_kg,
        "net_weight_kg":          req.net_weight_kg,
        "cbm":                    req.cbm,
        "number_of_packages":     req.number_of_packages,
        "package_type":           req.package_type,
        "export_date":            req.export_date,
        "signatory_name":         req.signatory_name,
        "signatory_ic_passport":  req.signatory_ic_or_passport,
        "signatory_designation":  req.signatory_designation,
    }

    # Persist to session
    try:
        from main import _sessions
        if req.session_id in _sessions:
            _sessions[req.session_id]["checklist"]["logistics"] = logistics_data
            _sessions[req.session_id]["current_step"] = max(
                _sessions[req.session_id].get("current_step", 1), 8
            )
            _sessions[req.session_id]["progress"] = max(
                _sessions[req.session_id].get("progress", 0), 77
            )
    except ImportError:
        pass

    return {
        "session_id":   req.session_id,
        "logistics":    logistics_data,
        "recommendations": result,
        "step_complete": True,
    }