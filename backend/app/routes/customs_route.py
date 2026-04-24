"""
app/routes/customs_route.py
Step 9 — K2 Customs Export Declaration
POST /customs/submit-k2  (session_id as query param — body=null from frontend)
ADDED: signatory IC/passport + designation + declaration statement
       exemption reference number (FTA duty exemption)
       full physical metrics in K2 goods block
       persists K2 result to session
"""

from fastapi import APIRouter, HTTPException, Query
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/customs", tags=["Customs Submission"])


@router.post("/submit-k2")
async def submit_k2(session_id: str = Query(...)):
    """
    Step 9 — Build and validate the K2 Customs Export Declaration.
    Reads all required data from the session store populated by Steps 1-8,
    including signatory identity, physical metrics, and exemption references.
    """
    try:
        from main import _sessions
    except ImportError:
        _sessions = {}

    session   = _sessions.get(session_id, {})
    checklist = session.get("checklist", {})

    entity    = checklist.get("entity_verification", {})
    consignee = checklist.get("consignee", {})
    classif   = checklist.get("classification", {})
    valuation = checklist.get("financial_valuation", {})
    logistics = checklist.get("logistics", {})

    # Signatory pulled from logistics step (Step 7)
    signatory_name  = logistics.get("signatory_name", "TBC")
    signatory_ic    = logistics.get("signatory_ic_passport", "TBC")
    signatory_title = logistics.get("signatory_designation", "TBC")

    try:
        glm = get_glm()
        result = await glm.chat_json(
            system_prompt="""You are a Malaysian Customs K2 declaration expert (Customs Act 1967).
Generate a complete, submission-ready K2 export declaration for MyDagangNet / MyECIS.
Return JSON: {
  "k2_reference": "K2-MY-{YEAR}-{SEQ}",
  "declaration_type": "EX",
  "customs_station": "",
  "export_date": "",
  "k2_form_data": {
    "header": {
      "manifest_ref": "", "declaration_type": "EX",
      "customs_procedure_code": "10", "regime_type": "Export", "office_of_exit": ""
    },
    "exporter": {"name":"","brn":"","address":"","customs_client_code":""},
    "consignee": {"name":"","country_code":"","address":"",
                  "contact_person":"","email":"","phone":""},
    "transport": {
      "mode_code": "", "mode_description": "",
      "vessel_flight_name": "", "voyage_flight_number": "",
      "port_of_loading_code": "", "port_of_discharge_code": "",
      "country_of_destination_code": "", "container_indicator": "Y|N"
    },
    "goods": {
      "item_number": 1, "commodity_description": "", "hs_code": "",
      "country_of_origin": "MY",
      "quantity": 0, "unit_of_quantity": "",
      "gross_weight_kg": 0, "net_weight_kg": 0,
      "number_of_packages": 0, "package_type_code": "",
      "marks_and_numbers": "", "container_number": ""
    },
    "valuation": {
      "statistical_value_myr": 0, "fob_value_myr": 0,
      "invoice_currency": "", "invoice_amount": 0,
      "exchange_rate": 1.0, "incoterm": "",
      "freight_myr": 0, "insurance_myr": 0, "cif_value_myr": 0
    },
    "duty": {
      "export_duty_myr": 0, "customs_duty_myr": 0, "sst_myr": 0,
      "total_duty_myr": 0,
      "duty_exemption_code": "", "exemption_reference": ""
    },
    "fta": {
      "fta_claimed": false, "fta_name": "", "form_type": "",
      "form_number": "", "preferential_rate": 0.0
    },
    "signatory": {
      "name": "", "nric_passport": "", "designation": "",
      "declaration_text": "I declare that the particulars given in this declaration are true and correct.",
      "date": ""
    }
  },
  "submission_checklist": [
    {"item":"","status":"ready|missing|optional","document_ref":""}
  ],
  "atiga_form_d_applicable": false,
  "duty_savings_myr": 0,
  "estimated_processing_hours": 4,
  "dagang_net_submission_steps": [
    {"step":1,"action":"","portal":"","notes":""}
  ],
  "compliance_notes": [],
  "warnings": []
}""",
            user_message=(
                f"Exporter     : {entity.get('company_name','N/A')}, BRN {entity.get('registration_number','N/A')}\n"
                f"Consignee    : {consignee.get('buyer_name','N/A')}, {consignee.get('buyer_country','N/A')}\n"
                f"Buyer contact: {consignee.get('buyer_contact_person','N/A')}\n"
                f"Buyer email  : {consignee.get('buyer_email','N/A')}\n"
                f"Product      : {classif.get('product_description','N/A')}, HS {classif.get('hs_code','N/A')}\n"
                f"Quantity     : {classif.get('quantity','N/A')} {classif.get('unit','PKGS')}\n"
                f"Gross weight : {logistics.get('weight_kg','N/A')} kg\n"
                f"Net weight   : {logistics.get('net_weight_kg','N/A')} kg\n"
                f"Packages     : {logistics.get('number_of_packages','N/A')} x {logistics.get('package_type','N/A')}\n"
                f"Container no : {logistics.get('container_number','N/A')}\n"
                f"FOB          : MYR {valuation.get('fob_myr',0)}\n"
                f"CIF          : MYR {valuation.get('cif_myr',0)}\n"
                f"Duty         : MYR {valuation.get('estimated_duty_myr',0)}\n"
                f"Invoice curr : {valuation.get('invoice_currency','MYR')}, "
                f"FX rate: {valuation.get('exchange_rate_to_myr',1.0)}\n"
                f"Incoterm     : {consignee.get('incoterm','FOB')}\n"
                f"Mode         : {logistics.get('mode','SEA')}\n"
                f"Vessel/Flight: {logistics.get('vessel','N/A')}, Voyage: {logistics.get('voyage_number','N/A')}\n"
                f"POL          : {logistics.get('pol','Port Klang')}\n"
                f"POD          : {logistics.get('pod','N/A')}\n"
                f"Export date  : {logistics.get('export_date','N/A')}\n"
                f"FTA form     : {valuation.get('form_required','None')}\n"
                f"FTA name     : {valuation.get('best_fta','None')}\n"
                f"ATIGA saving : MYR {valuation.get('atiga_savings_myr',0)}\n"
                f"Signatory    : {signatory_name}, {signatory_title}, IC/Passport: {signatory_ic}\n"
                f"Declaration  : I declare that the particulars given in this declaration are true and correct."
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    savings = result.get("duty_savings_myr", valuation.get("atiga_savings_myr", 0))

    # Persist to session
    try:
        from main import _sessions
        if session_id in _sessions:
            _sessions[session_id]["checklist"]["k2"] = result
            _sessions[session_id]["current_step"] = 9
            _sessions[session_id]["progress"] = 99
    except ImportError:
        pass

    return {
        "session_id":       session_id,
        "k2_data":          result,
        "submission_ready": True,
        "savings_message":  f"Potential MYR {savings:.0f} saved if ATIGA Form D is filed.",
        "next_step":        "Submit via Dagang Net portal or appointed customs agent.",
        "portals": {
            "dagang_net": "https://www.dagangnet.com.my",
            "myecis":     "https://www.customs.gov.my",
        },
    }


@router.get("/status/{session_id}")
async def k2_status(session_id: str):
    return {
        "session_id": session_id,
        "status":     "pending",
        "message":    "Connect to Dagang Net API to poll live submission status.",
        "portal_url": "https://www.dagangnet.com.my",
        "myecis_url": "https://www.customs.gov.my",
    }