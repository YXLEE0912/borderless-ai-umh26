"""
Document Service — Step 8
Generates all Malaysian export trade documents:
- Commercial Invoice
- Packing List
- Certificate of Origin (Form D / ATIGA / Standard)
- Bill of Lading shell (for agent completion)
- SIRIM / Halal Certificate checklist

All documents follow Malaysian Customs Act 1967 and MATRADE requirements.
"""

import asyncio
from typing import Dict, Any, Optional, List
from glmservice import GLMService


INVOICE_SYSTEM = """You are a Malaysian export documentation specialist.
Generate a complete Commercial Invoice following:
- Malaysian Customs Act 1967
- MATRADE export documentation standards
- UCP 600 letter of credit compliance

Return JSON:
{
  "invoice_number": "",
  "invoice_date": "",
  "payment_terms": "T/T|L/C|D/P|D/A|Open Account",
  "exporter": {
    "name": "", "brn": "", "address": "", "tel": "", "email": "", "bank": ""
  },
  "consignee": {
    "name": "", "country": "", "address": "", "tax_id": "", "tel": ""
  },
  "notify_party": {"name": "", "address": ""},
  "goods": [
    {
      "line_no": 1, "hs_code": "", "description": "",
      "quantity": 0, "unit": "", "unit_price": 0, "total": 0, "currency": ""
    }
  ],
  "incoterm": "",
  "port_of_loading": "",
  "port_of_discharge": "",
  "currency": "",
  "subtotal": 0,
  "freight": 0,
  "insurance": 0,
  "total_fob": 0,
  "total_cif": 0,
  "country_of_origin": "Malaysia",
  "marks_and_numbers": "",
  "vessel_or_flight": "",
  "letter_of_credit_no": "",
  "declaration": "We hereby certify that this invoice is true and correct.",
  "signatory": {"name": "", "title": "", "signature_placeholder": "[SIGNATURE]"}
}"""

PACKING_LIST_SYSTEM = """You are a Malaysian export packing list specialist.
Generate a complete Packing List per Malaysian customs and MATRADE standards.
Return JSON:
{
  "packing_list_number": "",
  "date": "",
  "exporter": {"name": "", "address": ""},
  "consignee": {"name": "", "country": "", "address": ""},
  "invoice_reference": "",
  "vessel_or_flight": "",
  "port_of_loading": "",
  "port_of_discharge": "",
  "packages": [
    {
      "package_no": "",
      "type": "CTN|PALLET|DRUM|BAG|BOX",
      "description": "",
      "gross_weight_kg": 0,
      "net_weight_kg": 0,
      "tare_weight_kg": 0,
      "length_cm": 0,
      "width_cm": 0,
      "height_cm": 0,
      "cbm": 0,
      "quantity_inside": 0
    }
  ],
  "total_packages": 0,
  "total_gross_weight_kg": 0,
  "total_net_weight_kg": 0,
  "total_cbm": 0,
  "shipping_marks": "",
  "container_number": "",
  "seal_number": "",
  "declaration": "We hereby certify that the above particulars are true and correct.",
  "signatory": {"name": "", "title": "", "signature_placeholder": "[SIGNATURE]"}
}"""

COO_SYSTEM = """You are a Certificate of Origin specialist for Malaysian exports.
Generate a CO following ATIGA (Form D), MATRADE, or Chamber of Commerce formats.
Return JSON:
{
  "co_number": "",
  "co_date": "",
  "form_type": "Form D (ATIGA)|Form E (ASEAN-China)|RCEP Form|Standard CO",
  "issuing_body": "MATRADE|MITI|Chamber of Commerce|MCCI",
  "exporter": {
    "name": "", "address": "", "country": "Malaysia", "brn": ""
  },
  "consignee": {"name": "", "address": "", "country": ""},
  "transport_details": {
    "vessel_or_flight": "",
    "port_of_loading": "",
    "port_of_discharge": "",
    "departure_date": "",
    "arrival_date_estimated": ""
  },
  "goods": [
    {
      "item_no": 1,
      "marks_and_numbers": "",
      "description": "",
      "hs_code": "",
      "origin_criterion": "WO|CTH|CTSH|RVC40|RVC35+CC|PE",
      "quantity": "",
      "gross_weight_kg": 0,
      "fob_value_myr": 0,
      "local_content_percent": 0
    }
  ],
  "invoice_reference": "",
  "declaration": "",
  "remarks": "",
  "back_to_back": false,
  "third_country_invoice": false
}"""

BOL_SYSTEM = """You are a Bill of Lading documentation specialist.
Generate a B/L shell with all required fields for the shipping agent to complete.
Return JSON:
{
  "bl_number": "TBC - Assigned by carrier",
  "bl_date": "",
  "bl_type": "OBL|SWB|TELEX",
  "shipper": {"name": "", "address": "", "tel": ""},
  "consignee": {"name": "", "address": "", "notify_party": ""},
  "notify_party": {"name": "", "address": ""},
  "vessel_name": "",
  "voyage_number": "",
  "port_of_loading": "",
  "port_of_discharge": "",
  "place_of_delivery": "",
  "freight_payable_at": "Origin|Destination",
  "freight_terms": "Prepaid|Collect",
  "container_details": [
    {"container_no": "", "seal_no": "", "type": "", "packages": 0,
     "description": "", "gross_weight_kg": 0, "cbm": 0}
  ],
  "total_packages": 0,
  "total_gross_weight_kg": 0,
  "total_cbm": 0,
  "marks_and_numbers": "",
  "on_board_date": "",
  "place_of_issue": "Port Klang",
  "number_of_originals": 3,
  "special_instructions": "",
  "carrier_clause": "SHIPPED on board in apparent good order and condition"
}"""


class DocumentService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def generate_all(
        self,
        session_id: str,
        exporter_name: str,
        exporter_brn: str,
        exporter_address: str,
        buyer_name: str,
        buyer_country: str,
        buyer_address: str,
        product_description: str,
        hs_code: str,
        quantity: str,
        unit: str,
        fob_value_myr: float,
        incoterm: str,
        currency: str,
        mode: str,
        port_of_loading: str,
        port_of_discharge: str,
        vessel_name: Optional[str],
        weight_kg: Optional[float],
        cbm: Optional[float],
        fta_form: Optional[str],
        buyer_tax_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate all four trade documents in parallel.
        Returns each document keyed by type.
        """
        base_ctx = (
            f"Exporter      : {exporter_name}, BRN {exporter_brn}, {exporter_address}\n"
            f"Consignee     : {buyer_name}, {buyer_country}, {buyer_address}\n"
            f"Tax ID        : {buyer_tax_id or 'N/A'}\n"
            f"Product       : {product_description}\n"
            f"HS Code       : {hs_code}\n"
            f"Quantity      : {quantity} {unit}\n"
            f"FOB value     : {currency} {fob_value_myr}\n"
            f"Incoterm      : {incoterm}\n"
            f"Mode          : {mode}\n"
            f"Vessel/Flight : {vessel_name or 'TBC'}\n"
            f"POL           : {port_of_loading}\n"
            f"POD           : {port_of_discharge}\n"
            f"Weight        : {weight_kg or 'TBC'} kg, CBM: {cbm or 'TBC'}\n"
            f"FTA form      : {fta_form or 'Standard CO'}"
        )

        calls = [
            {"system": INVOICE_SYSTEM,  "user": base_ctx},
            {"system": PACKING_LIST_SYSTEM, "user": base_ctx},
            {"system": COO_SYSTEM,      "user": base_ctx},
            {"system": BOL_SYSTEM,      "user": base_ctx},
        ]

        results = await self.glm.chat_json_many(calls, max_tokens=2048)
        names   = ["commercial_invoice", "packing_list", "certificate_of_origin", "bill_of_lading"]

        docs: Dict[str, Any] = {}
        for name, result in zip(names, results):
            if result.get("error"):
                docs[name] = {"status": "failed", "error": result["error"]}
            else:
                docs[name] = {"status": "generated", "data": result}

        generated = [k for k, v in docs.items() if v["status"] == "generated"]
        failed    = [k for k, v in docs.items() if v["status"] == "failed"]

        return {
            "session_id": session_id,
            "generated":  generated,
            "failed":     failed,
            "documents":  docs,
        }

    async def generate_commercial_invoice(
        self, ctx: str
    ) -> Dict[str, Any]:
        return await self.glm.chat_json(INVOICE_SYSTEM, ctx)

    async def generate_packing_list(
        self, ctx: str
    ) -> Dict[str, Any]:
        return await self.glm.chat_json(PACKING_LIST_SYSTEM, ctx)

    async def generate_certificate_of_origin(
        self, ctx: str, fta_form: Optional[str] = None
    ) -> Dict[str, Any]:
        system = COO_SYSTEM
        if fta_form:
            system += f"\n\nGenerate specifically for: {fta_form}"
        return await self.glm.chat_json(system, ctx)

    async def generate_bill_of_lading(
        self, ctx: str
    ) -> Dict[str, Any]:
        return await self.glm.chat_json(BOL_SYSTEM, ctx)

    async def validate_document(
        self,
        doc_type: str,
        doc_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Validate a generated document for completeness and compliance.
        """
        import json
        system = f"""You are a Malaysian trade document validator.
Check this {doc_type} for completeness, accuracy, and regulatory compliance.
Return JSON: {{
  "valid": true,
  "missing_fields": [],
  "invalid_fields": [{{"field": "", "issue": "", "fix": ""}}],
  "compliance_issues": [],
  "warnings": [],
  "ready_to_sign": true
}}"""
        return await self.glm.chat_json(
            system,
            f"Document type: {doc_type}\n\n{json.dumps(doc_data, indent=2)}",
        )

    async def extract_from_upload(
        self,
        doc_text: str,
        doc_type: str,
    ) -> Dict[str, Any]:
        """
        Extract structured data from an uploaded document (SSM, invoice, etc).
        """
        return await self.glm.extract_document_data(doc_text, doc_type)