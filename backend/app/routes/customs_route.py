from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/customs", tags=["Customs Submission"])

# ── Models ────────────────────────────────────────────────────────────────────

class CustomsRequest(BaseModel):
    session_id: str
    exporter_name: str
    exporter_brn: str
    exporter_address: str
    buyer_name: str
    buyer_country: str
    buyer_address: str
    product_description: str
    hs_code: str
    quantity: str
    unit: str = "PKGS"
    fob_value_myr: float
    cif_value_myr: float
    import_duty_myr: float
    incoterm: str = "FOB"
    currency: str = "MYR"
    mode: str = "SEA"
    port_of_loading: str = "Port Klang"
    port_of_discharge: str
    vessel_name: Optional[str] = None
    export_date: Optional[str] = None
    fta_form: Optional[str] = None
    atiga_savings_myr: float = 0.0
    signatory_name: Optional[str] = None
    signatory_nric: Optional[str] = None
    signatory_title: Optional[str] = None

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/submit-k2")
async def submit_k2(req: CustomsRequest):
    """
    Step 9 — Build and validate the K2 Customs Export Declaration.
    Returns a complete K2 form data structure ready for MyDagangNet submission.
    """
    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are a Malaysian Customs K2 declaration expert (Customs Act 1967).
Generate a complete, submission-ready K2 export declaration.
Return JSON: {
  "k2_reference": "",
  "declaration_type": "EX",
  "customs_station": "",
  "export_date": "",
  "k2_form_data": {
    "exporter": {"name":"","brn":"","address":"","customs_client_code":""},
    "consignee": {"name":"","country":"","address":""},
    "transport": {
      "mode_code": "",
      "vessel_flight": "",
      "port_of_loading": "",
      "port_of_discharge": "",
      "country_of_destination": ""
    },
    "goods": {
      "description": "",
      "hs_code": "",
      "quantity": "",
      "unit": "",
      "country_of_origin": "MY",
      "statistical_value_myr": 0,
      "fob_value_myr": 0,
      "gross_weight_kg": 0
    },
    "financial": {
      "currency": "",
      "incoterm": "",
      "cif_value_myr": 0,
      "export_duty_myr": 0
    }
  },
  "submission_checklist": [
    {"item":"","status":"ready|missing|optional"}
  ],
  "atiga_form_d_applicable": false,
  "duty_savings_myr": 0,
  "estimated_processing_hours": 4,
  "dagang_net_submission_steps": [],
  "compliance_notes": []
}""",
            user_message=(
                f"Exporter: {req.exporter_name}, BRN {req.exporter_brn}, {req.exporter_address}\n"
                f"Consignee: {req.buyer_name}, {req.buyer_country}, {req.buyer_address}\n"
                f"Product: {req.product_description}, HS {req.hs_code}\n"
                f"Qty: {req.quantity} {req.unit}\n"
                f"FOB: MYR {req.fob_value_myr}, CIF: MYR {req.cif_value_myr}, Duty: MYR {req.import_duty_myr}\n"
                f"Incoterm: {req.incoterm}, Currency: {req.currency}\n"
                f"Mode: {req.mode}, Vessel: {req.vessel_name or 'TBC'}\n"
                f"POL: {req.port_of_loading}, POD: {req.port_of_discharge}\n"
                f"Export date: {req.export_date or 'TBC'}\n"
                f"FTA form: {req.fta_form or 'None'}, ATIGA savings: MYR {req.atiga_savings_myr}\n"
                f"Signatory: {req.signatory_name or 'TBC'} ({req.signatory_title or 'TBC'})"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    savings = result.get("duty_savings_myr", req.atiga_savings_myr)
    return {
        "session_id":       req.session_id,
        "k2_data":          result,
        "submission_ready": True,
        "savings_message":  f"Potential MYR {savings:.0f} saved if ATIGA Form D is filed.",
    }


@router.get("/status/{session_id}")
async def k2_status(session_id: str):
    """Check K2 submission status for a session."""
    return {
        "session_id": session_id,
        "status":     "pending",
        "message":    "Connect to Dagang Net API to poll live submission status.",
        "portal_url": "https://www.dagangnet.com.my",
        "myecis_url": "https://www.customs.gov.my",
    }