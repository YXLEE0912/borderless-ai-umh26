from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
import sys, os, asyncio

DOCUMENT_PATCH = """
from app.engines.validation_engine import ValidationEngine
 
@router.post("/generate")
async def generate_documents(session_id: str = Query(...)):
 
    session   = _sessions.get(session_id, {})
    checklist = session.get("checklist", {})
 
    # ── Gate: all upstream steps must be done ─────────────────────────────
    errors = ValidationEngine.validate_session_for_documents(checklist)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
 
    # ── rest of existing code unchanged ────────────────────────────────────
    ...
"""

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/trade-docs", tags=["Trade Documents"])


# ── Document generators ───────────────────────────────────────────────────────

async def _commercial_invoice(ctx: dict) -> Dict[str, Any]:
    return await get_glm().chat_json(
        system_prompt="""Generate a complete Malaysian export Commercial Invoice.
Follow: Customs Act 1967, MATRADE standards, UCP 600.
Return JSON: {
  "invoice_number": "", "invoice_date": "",
  "payment_terms": "T/T|L/C|D/P|D/A|Open Account",
  "exporter": {"name":"","brn":"","address":"","tel":"","email":"","bank":""},
  "consignee": {"name":"","country":"","address":"","tax_id":"","tel":"","contact_person":""},
  "goods": [{"line_no":1,"hs_code":"","description":"","quantity":0,"unit":"",
             "unit_price":0,"total":0,"currency":""}],
  "incoterm": "", "port_of_loading": "", "port_of_discharge": "",
  "currency": "", "subtotal": 0, "freight": 0, "insurance": 0,
  "total_fob": 0, "total_cif": 0,
  "country_of_origin": "Malaysia", "marks_and_numbers": "",
  "vessel_or_flight": "", "voyage_number": "",
  "exchange_rate": {"currency_from":"","currency_to":"MYR","rate":1.0},
  "declaration": "We hereby certify that this invoice is true and correct.",
  "signatory": {
    "name": "", "title": "", "ic_or_passport": "",
    "declaration_statement": "I declare that the particulars given are true and correct.",
    "signature_placeholder": "[SIGNATURE]", "date": ""
  }
}""",
        user_message=_ctx_str(ctx),
    )


async def _packing_list(ctx: dict) -> Dict[str, Any]:
    return await get_glm().chat_json(
        system_prompt="""Generate a complete Malaysian export Packing List per MATRADE standards.
Return JSON: {
  "packing_list_number": "", "date": "",
  "exporter": {"name":"","address":""},
  "consignee": {"name":"","country":"","address":""},
  "invoice_reference": "",
  "vessel_or_flight": "", "voyage_number": "",
  "port_of_loading": "", "port_of_discharge": "",
  "packages": [
    {"package_no":"","type":"CTN|PALLET|DRUM|BAG|BOX","description":"",
     "gross_weight_kg":0,"net_weight_kg":0,"tare_weight_kg":0,
     "length_cm":0,"width_cm":0,"height_cm":0,"cbm":0,"quantity_inside":0}
  ],
  "total_packages": 0, "total_gross_weight_kg": 0,
  "total_net_weight_kg": 0, "total_cbm": 0,
  "shipping_marks": "", "container_number": "", "seal_number": "",
  "declaration": "We hereby certify that the above particulars are true and correct.",
  "signatory": {
    "name": "", "title": "", "ic_or_passport": "",
    "declaration_statement": "I declare that the particulars given are true and correct.",
    "signature_placeholder": "[SIGNATURE]", "date": ""
  }
}""",
        user_message=_ctx_str(ctx),
    )


async def _certificate_of_origin(ctx: dict) -> Dict[str, Any]:
    fta_note = f"\nGenerate specifically for: {ctx['fta_form']}" if ctx.get("fta_form") else ""
    return await get_glm().chat_json(
        system_prompt=f"""Generate a Certificate of Origin for Malaysian export.
Use ATIGA Form D if fta_form is 'Form D', otherwise Standard CO.
Return JSON: {{
  "co_number": "", "co_date": "",
  "form_type": "Form D (ATIGA)|Form E (ASEAN-China)|RCEP Form|Standard CO",
  "issuing_body": "MATRADE|MITI|Chamber of Commerce|MCCI",
  "exporter": {{"name":"","address":"","country":"Malaysia","brn":""}},
  "consignee": {{"name":"","address":"","country":""}},
  "transport_details": {{"vessel_or_flight":"","voyage_number":"",
    "port_of_loading":"","port_of_discharge":"","departure_date":""}},
  "goods": [{{
    "item_no":1,"marks_and_numbers":"","description":"","hs_code":"",
    "origin_criterion":"WO|CTH|CTSH|RVC40|RVC35+CC|PE",
    "quantity":"","gross_weight_kg":0,"fob_value_myr":0,"local_content_percent":0
  }}],
  "invoice_reference": "",
  "exemption_reference": "",
  "declaration": "",
  "remarks": "",
  "back_to_back": false,
  "signatory": {{
    "name": "", "title": "", "ic_or_passport": "",
    "declaration_statement": "I declare that the particulars given are true and correct.",
    "signature_placeholder": "[SIGNATURE]", "date": ""
  }}
}}{fta_note}""",
        user_message=_ctx_str(ctx),
    )


async def _bill_of_lading_or_awb(ctx: dict) -> Dict[str, Any]:
    """Generate B/L shell for sea; AWB shell for air."""
    mode = ctx.get("mode", "SEA").upper()
    if mode == "AIR":
        doc_type = "Air Waybill (AWB)"
        bl_field = '"awb_number": "TBC - Assigned by airline"'
    else:
        doc_type = "Bill of Lading (B/L)"
        bl_field = '"bl_number": "TBC - Assigned by carrier"'

    return await get_glm().chat_json(
        system_prompt=f"""Generate a {doc_type} shell for Malaysian export.
Carrier/agent completes the transport-assigned numbers (B/L no, AWB no).
Return JSON: {{
  {bl_field},
  "document_type": "{doc_type}",
  "date": "",
  "bl_type": "OBL|SWB|TELEX|AWB",
  "shipper": {{"name":"","address":"","brn":""}},
  "consignee": {{"name":"","address":"","country":"","contact":""}},
  "notify_party": {{"name":"","address":""}},
  "vessel_or_flight": "",
  "voyage_or_flight_number": "",
  "port_of_loading": "",
  "port_of_discharge": "",
  "place_of_delivery": "",
  "freight_payable_at": "Origin|Destination",
  "freight_terms": "Prepaid|Collect",
  "container_details": [{{
    "container_no":"","seal_no":"","type":"",
    "packages":0,"description":"","gross_weight_kg":0,"cbm":0
  }}],
  "total_packages": 0,
  "total_gross_weight_kg": 0,
  "total_net_weight_kg": 0,
  "total_cbm": 0,
  "marks_and_numbers": "",
  "on_board_date": "",
  "place_of_issue": "Port Klang",
  "number_of_originals": 3,
  "carrier_clause": "SHIPPED on board in apparent good order and condition",
  "special_instructions": "",
  "exemption_reference": ""
}}""",
        user_message=_ctx_str(ctx),
    )


def _ctx_str(ctx: dict) -> str:
    return (
        f"Exporter      : {ctx.get('exporter_name','N/A')}, BRN {ctx.get('exporter_brn','N/A')}\n"
        f"Address       : {ctx.get('exporter_address','N/A')}\n"
        f"Consignee     : {ctx.get('buyer_name','N/A')}, {ctx.get('buyer_country','N/A')}\n"
        f"Buyer address : {ctx.get('buyer_address','N/A')}\n"
        f"Buyer email   : {ctx.get('buyer_email','N/A')}\n"
        f"Buyer phone   : {ctx.get('buyer_phone','N/A')}\n"
        f"Buyer contact : {ctx.get('buyer_contact_person','N/A')}\n"
        f"Product       : {ctx.get('product_description','N/A')}, HS {ctx.get('hs_code','N/A')}\n"
        f"Qty           : {ctx.get('quantity','N/A')} {ctx.get('unit','PKGS')}\n"
        f"FOB           : {ctx.get('currency','MYR')} {ctx.get('fob_value_myr',0)}, Incoterm: {ctx.get('incoterm','FOB')}\n"
        f"Invoice curr  : {ctx.get('invoice_currency','MYR')}, FX rate: {ctx.get('exchange_rate_to_myr',1.0)}\n"
        f"Mode          : {ctx.get('mode','SEA')}\n"
        f"Vessel/Flight : {ctx.get('vessel_name','TBC')}, Voyage: {ctx.get('voyage_number','TBC')}\n"
        f"POL           : {ctx.get('pol','Port Klang')}, POD: {ctx.get('pod','TBC')}\n"
        f"Gross weight  : {ctx.get('weight_kg','TBC')} kg, Net: {ctx.get('net_weight_kg','TBC')} kg\n"
        f"CBM           : {ctx.get('cbm','TBC')}\n"
        f"Packages      : {ctx.get('number_of_packages','TBC')} x {ctx.get('package_type','TBC')}\n"
        f"Container no  : {ctx.get('container_number','TBC')}\n"
        f"FTA form      : {ctx.get('fta_form','Standard CO')}\n"
        f"Exemption ref : {ctx.get('exemption_reference','N/A')}\n"
        f"Signatory     : {ctx.get('signatory_name','TBC')}, "
        f"{ctx.get('signatory_designation','TBC')}, IC/Passport: {ctx.get('signatory_ic_passport','TBC')}\n"
        f"Export date   : {ctx.get('export_date','TBC')}"
    )


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_documents(session_id: str = Query(...)):
    """
    Step 8 — Generate all 4 trade documents in parallel:
    Commercial Invoice, Packing List, Certificate of Origin, Bill of Lading / AWB.
    Reads context from the session store accumulated in Steps 1–7.
    """
    try:
        from main import _sessions
    except ImportError:
        _sessions = {}

    session = _sessions.get(session_id, {})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    checklist = session.get("checklist", {})

    entity    = checklist.get("entity_verification", {})
    consignee = checklist.get("consignee", {})
    classif   = checklist.get("classification", {})
    valuation = checklist.get("financial_valuation", {})
    logistics = checklist.get("logistics", {})

    ctx = {
        # Exporter
        "exporter_name":        entity.get("company_name", ""),
        "exporter_brn":         entity.get("registration_number", ""),
        "exporter_address":     entity.get("address", ""),
        # Consignee — includes contact details
        "buyer_name":           consignee.get("buyer_name", ""),
        "buyer_country":        consignee.get("buyer_country", ""),
        "buyer_address":        consignee.get("buyer_address", ""),
        "buyer_email":          consignee.get("buyer_email", ""),
        "buyer_phone":          consignee.get("buyer_phone", ""),
        "buyer_contact_person": consignee.get("buyer_contact_person", ""),
        # Goods
        "product_description":  classif.get("product_description", ""),
        "hs_code":              classif.get("hs_code", ""),
        "quantity":             classif.get("quantity", ""),
        "unit":                 classif.get("unit", "PKGS"),
        "fob_value_myr":        valuation.get("fob_myr", 0),
        "incoterm":             consignee.get("incoterm", "FOB"),
        "currency":             "MYR",
        # Financial — includes foreign currency fields
        "invoice_currency":     valuation.get("invoice_currency", "MYR"),
        "exchange_rate_to_myr": valuation.get("exchange_rate_to_myr", 1.0),
        # Logistics — full physical metrics
        "mode":                 logistics.get("mode", "SEA"),
        "vessel_name":          logistics.get("vessel", ""),
        "voyage_number":        logistics.get("voyage_number", ""),
        "pol":                  logistics.get("pol", "Port Klang"),
        "pod":                  logistics.get("pod", ""),
        "weight_kg":            logistics.get("weight_kg", ""),
        "net_weight_kg":        logistics.get("net_weight_kg", ""),
        "cbm":                  logistics.get("cbm", ""),
        "number_of_packages":   logistics.get("number_of_packages", ""),
        "package_type":         logistics.get("package_type", ""),
        "container_number":     logistics.get("container_number", ""),
        "export_date":          logistics.get("export_date", ""),
        # FTA & exemption
        "fta_form":             valuation.get("form_required", ""),
        "exemption_reference":  valuation.get("best_fta", ""),
        # Signatory — IC/passport + designation + declaration
        "signatory_name":        logistics.get("signatory_name", ""),
        "signatory_ic_passport": logistics.get("signatory_ic_passport", ""),
        "signatory_designation": logistics.get("signatory_designation", ""),
    }

    try:
        results = await asyncio.gather(
            _commercial_invoice(ctx),
            _packing_list(ctx),
            _certificate_of_origin(ctx),
            _bill_of_lading_or_awb(ctx),
            return_exceptions=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    names = ["commercial_invoice", "packing_list", "certificate_of_origin", "bill_of_lading"]
    docs: Dict[str, Any] = {}
    for name, result in zip(names, results):
        if isinstance(result, Exception):
            docs[name] = {"status": "failed", "error": str(result)}
        else:
            docs[name] = {"status": "generated", "data": result}

    generated = [k for k, v in docs.items() if v["status"] == "generated"]
    failed    = [k for k, v in docs.items() if v["status"] == "failed"]

    # Persist back to session
    if session_id in _sessions:
        _sessions[session_id].setdefault("documents", {}).update(docs)
        _sessions[session_id]["checklist"]["documents"] = {"generated": generated, "failed": failed}
        _sessions[session_id]["current_step"] = max(
            _sessions[session_id].get("current_step", 1), 9
        )
        _sessions[session_id]["progress"] = max(
            _sessions[session_id].get("progress", 0), 88
        )

    return {
        "session_id": session_id,
        "generated":  generated,
        "failed":     failed,
        "documents":  docs,
    }
