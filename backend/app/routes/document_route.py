from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import sys, os, asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/trade-docs", tags=["Trade Documents"])

# ── Models ────────────────────────────────────────────────────────────────────

class GenerateDocsRequest(BaseModel):
    session_id: str
    exporter_name: str
    exporter_brn: str
    exporter_address: str
    buyer_name: str
    buyer_country: str
    buyer_address: str
    buyer_tax_id: Optional[str] = None
    product_description: str
    hs_code: str
    quantity: str
    unit: str = "PKGS"
    fob_value_myr: float
    incoterm: str = "FOB"
    currency: str = "MYR"
    mode: Optional[str] = "SEA"
    vessel_name: Optional[str] = None
    port_of_loading: Optional[str] = "Port Klang"
    port_of_discharge: Optional[str] = None
    weight_kg: Optional[float] = None
    cbm: Optional[float] = None
    fta_form: Optional[str] = None

# ── Document generators ───────────────────────────────────────────────────────

async def _commercial_invoice(req: GenerateDocsRequest) -> Dict[str, Any]:
    glm = get_glm()
    return await glm.chat_json(
        system_prompt="""Generate a complete Malaysian export Commercial Invoice.
All fields must follow Customs Act 1967 and MATRADE requirements.
Return JSON: {
  "invoice_number": "",
  "invoice_date": "",
  "exporter": {"name":"","brn":"","address":""},
  "consignee": {"name":"","country":"","address":"","tax_id":""},
  "goods": [{"description":"","hs_code":"","quantity":"","unit_price_myr":0,"total_myr":0}],
  "incoterm": "",
  "currency": "",
  "fob_value": 0,
  "freight": 0,
  "insurance": 0,
  "total_value": 0,
  "payment_terms": "",
  "country_of_origin": "Malaysia",
  "marks_and_numbers": "",
  "declaration": ""
}""",
        user_message=(
            f"Exporter: {req.exporter_name}, BRN {req.exporter_brn}, {req.exporter_address}\n"
            f"Consignee: {req.buyer_name}, {req.buyer_country}, {req.buyer_address}\n"
            f"Product: {req.product_description}, HS {req.hs_code}\n"
            f"Qty: {req.quantity} {req.unit}\n"
            f"FOB: {req.currency} {req.fob_value_myr}, Incoterm: {req.incoterm}"
        ),
    )

async def _packing_list(req: GenerateDocsRequest) -> Dict[str, Any]:
    glm = get_glm()
    return await glm.chat_json(
        system_prompt="""Generate a complete Malaysian export Packing List.
Return JSON: {
  "packing_list_number": "",
  "date": "",
  "exporter": {"name":"","address":""},
  "consignee": {"name":"","country":""},
  "packages": [
    {"package_no":"","type":"","description":"","gross_weight_kg":0,"net_weight_kg":0,"dimensions_cm":"","cbm":0}
  ],
  "total_packages": 0,
  "total_gross_weight_kg": 0,
  "total_net_weight_kg": 0,
  "total_cbm": 0,
  "marks_and_numbers": "",
  "shipping_marks": ""
}""",
        user_message=(
            f"Exporter: {req.exporter_name}\n"
            f"Consignee: {req.buyer_name}, {req.buyer_country}\n"
            f"Product: {req.product_description}, Qty: {req.quantity} {req.unit}\n"
            f"Gross weight: {req.weight_kg or 'TBC'} kg, CBM: {req.cbm or 'TBC'}\n"
            f"Mode: {req.mode}, POL: {req.port_of_loading}, POD: {req.port_of_discharge or 'TBC'}"
        ),
    )

async def _certificate_of_origin(req: GenerateDocsRequest) -> Dict[str, Any]:
    glm = get_glm()
    return await glm.chat_json(
        system_prompt="""Generate a Certificate of Origin for Malaysian export.
Use ATIGA Form D format if FTA form is Form D, otherwise standard CO.
Return JSON: {
  "co_number": "",
  "co_date": "",
  "form_type": "Form D|Standard CO",
  "exporter": {"name":"","address":"","country":"Malaysia"},
  "consignee": {"name":"","address":"","country":""},
  "transport_details": {"vessel":"","pol":"","pod":"","departure_date":""},
  "goods": [{"item_no":1,"marks":"","description":"","hs_code":"","origin_criterion":"","quantity":"","fob_value_myr":0}],
  "declaration": "",
  "issuing_body": "MATRADE|MITI|Chamber of Commerce",
  "remarks": ""
}""",
        user_message=(
            f"Exporter: {req.exporter_name}, Malaysia\n"
            f"Consignee: {req.buyer_name}, {req.buyer_country}\n"
            f"Product: {req.product_description}, HS {req.hs_code}\n"
            f"FOB: MYR {req.fob_value_myr}, Qty: {req.quantity} {req.unit}\n"
            f"FTA form: {req.fta_form or 'Standard CO'}\n"
            f"Vessel: {req.vessel_name or 'TBC'}, POL: {req.port_of_loading}, POD: {req.port_of_discharge or 'TBC'}"
        ),
    )

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_documents(req: GenerateDocsRequest):
    """
    Step 8 — Generate Commercial Invoice, Packing List, and Certificate of Origin
    in parallel. All documents follow Malaysian Customs Act 1967 and MATRADE requirements.
    """
    try:
        results = await asyncio.gather(
            _commercial_invoice(req),
            _packing_list(req),
            _certificate_of_origin(req),
            return_exceptions=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    docs: Dict[str, Any] = {}
    names = ["commercial_invoice", "packing_list", "certificate_of_origin"]
    for name, result in zip(names, results):
        if isinstance(result, Exception):
            docs[name] = {"status": "failed", "error": str(result)}
        else:
            docs[name] = {"status": "generated", "data": result}

    generated = [k for k, v in docs.items() if v["status"] == "generated"]
    failed    = [k for k, v in docs.items() if v["status"] == "failed"]

    return {
        "session_id": req.session_id,
        "generated":  generated,
        "failed":     failed,
        "documents":  docs,
    }