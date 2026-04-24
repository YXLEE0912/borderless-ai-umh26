from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/logistics", tags=["Logistics"])

# ── Models ────────────────────────────────────────────────────────────────────

class LogisticsRequest(BaseModel):
    session_id: str
    mode: str                               # SEA | AIR | ROAD | RAIL
    port_of_loading: str = "Port Klang"
    port_of_discharge: str
    gross_weight_kg: float
    cbm: float
    vessel_name: Optional[str] = None
    flight_number: Optional[str] = None
    container_number: Optional[str] = None
    export_date: Optional[str] = None      # ISO date e.g. "2026-05-02"

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/setup")
async def setup_logistics(req: LogisticsRequest):
    """
    Step 7 — Recommend container type, B/L type, transit time, port charges,
    and required shipping documents for the K2 declaration.
    """
    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are a Malaysian freight and logistics expert (sea, air, road).
Return JSON: {
  "container_type": "20GP|40GP|40HC|LCL|AIR",
  "estimated_transit_days": 0,
  "customs_clearance_days": 0,
  "bl_type": "OBL|SWB|TELEX|AWB",
  "required_shipping_docs": [],
  "port_charges_myr": 0,
  "handling_charges_myr": 0,
  "total_logistics_cost_myr": 0,
  "shipping_line_recommendations": [],
  "k2_transport_mode_code": ""
}""",
            user_message=(
                f"Mode: {req.mode}\n"
                f"Port of loading: {req.port_of_loading}\n"
                f"Port of discharge: {req.port_of_discharge}\n"
                f"Vessel/Flight: {req.vessel_name or req.flight_number or 'TBC'}\n"
                f"Gross weight: {req.gross_weight_kg} kg\n"
                f"CBM: {req.cbm}\n"
                f"Container: {req.container_number or 'TBC'}\n"
                f"Export date: {req.export_date or 'TBC'}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "session_id": req.session_id,
        "logistics": {
            "mode":             req.mode,
            "pol":              req.port_of_loading,
            "pod":              req.port_of_discharge,
            "vessel":           req.vessel_name,
            "flight":           req.flight_number,
            "container_number": req.container_number,
            "weight_kg":        req.gross_weight_kg,
            "cbm":              req.cbm,
            "export_date":      req.export_date,
        },
        "recommendations": result,
    }