"""
Customs Service — Step 9
Builds and validates the K2 Malaysian Customs Export Declaration.
References: Customs Act 1967, Customs (Prohibition of Exports) Order 1988,
            Dagang Net / MyECIS submission procedures.
"""

import json
from typing import Dict, Any, Optional, List
from glmservice import GLMService


K2_SYSTEM = """You are a Malaysian Customs K2 declaration expert.
References: Customs Act 1967, Customs (Prohibition of Exports) Order 1988.
Generate a complete, submission-ready K2 export declaration for MyDagangNet / MyECIS.

Return JSON:
{
  "k2_reference": "K2-MY-{YEAR}-{SEQ}",
  "declaration_type": "EX",
  "customs_station": "",
  "export_date": "",
  "k2_form_data": {
    "header": {
      "manifest_ref": "",
      "declaration_type": "EX",
      "customs_procedure_code": "10|11|23",
      "regime_type": "Export",
      "office_of_exit": ""
    },
    "exporter": {
      "name": "",
      "brn": "",
      "address": "",
      "customs_client_code": "",
      "eori_equivalent": ""
    },
    "consignee": {
      "name": "",
      "country_code": "",
      "address": ""
    },
    "transport": {
      "mode_code": "1=Sea|4=Air|3=Road|2=Rail",
      "mode_description": "",
      "vessel_flight_name": "",
      "voyage_flight_number": "",
      "flag_of_vessel": "",
      "port_of_loading_code": "",
      "port_of_discharge_code": "",
      "country_of_destination_code": "",
      "container_indicator": "Y|N"
    },
    "goods": {
      "item_number": 1,
      "commodity_description": "",
      "hs_code": "",
      "country_of_origin": "MY",
      "quantity": 0,
      "unit_of_quantity": "",
      "gross_weight_kg": 0,
      "net_weight_kg": 0,
      "number_of_packages": 0,
      "package_type_code": "",
      "marks_and_numbers": "",
      "container_number": ""
    },
    "valuation": {
      "statistical_value_myr": 0,
      "fob_value_myr": 0,
      "invoice_currency": "",
      "invoice_amount": 0,
      "exchange_rate": 1.0,
      "incoterm": "",
      "freight_myr": 0,
      "insurance_myr": 0,
      "cif_value_myr": 0
    },
    "duty": {
      "export_duty_myr": 0,
      "customs_duty_myr": 0,
      "sst_myr": 0,
      "total_duty_myr": 0,
      "duty_exemption_code": "",
      "exemption_reference": ""
    },
    "fta": {
      "fta_claimed": false,
      "fta_name": "",
      "form_type": "",
      "form_number": "",
      "preferential_rate": 0.0
    },
    "signatory": {
      "name": "",
      "nric_passport": "",
      "designation": "",
      "declaration_text": "I declare that the particulars given in this declaration are true and correct.",
      "date": ""
    }
  },
  "submission_checklist": [
    {"item": "", "status": "ready|missing|optional", "document_ref": ""}
  ],
  "atiga_form_d_applicable": false,
  "duty_savings_myr": 0,
  "estimated_processing_hours": 4,
  "dagang_net_submission_steps": [
    {"step": 1, "action": "", "portal": "", "notes": ""}
  ],
  "compliance_notes": [],
  "warnings": []
}"""

VALIDATION_SYSTEM = """You are a Malaysian Customs pre-submission validator.
Check the K2 declaration for errors before submission.
Return JSON:
{
  "ready_to_submit": true,
  "critical_errors": [],
  "warnings": [],
  "missing_mandatory_fields": [],
  "field_format_errors": [{"field": "", "value": "", "expected_format": ""}],
  "duty_calculation_check": {
    "correct": true,
    "expected_duty_myr": 0,
    "declared_duty_myr": 0,
    "variance_myr": 0
  },
  "atiga_eligibility_confirmed": false,
  "estimated_ack_hours": 4
}"""


class CustomsService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def submit_k2(
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
        cif_value_myr: float,
        import_duty_myr: float,
        incoterm: str,
        currency: str,
        mode: str,
        port_of_loading: str,
        port_of_discharge: str,
        vessel_name: Optional[str] = None,
        export_date: Optional[str] = None,
        fta_form: Optional[str] = None,
        atiga_savings_myr: float = 0.0,
        signatory_name: Optional[str] = None,
        signatory_nric: Optional[str] = None,
        signatory_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Build, validate, and return a submission-ready K2 declaration.
        Runs K2 generation and pre-validation concurrently.
        """
        k2_msg = (
            f"Exporter      : {exporter_name}, BRN {exporter_brn}, {exporter_address}\n"
            f"Consignee     : {buyer_name}, {buyer_country}, {buyer_address}\n"
            f"Product       : {product_description}\n"
            f"HS Code       : {hs_code}\n"
            f"Quantity      : {quantity} {unit}\n"
            f"FOB           : MYR {fob_value_myr}\n"
            f"CIF           : MYR {cif_value_myr}\n"
            f"Duty          : MYR {import_duty_myr}\n"
            f"Incoterm      : {incoterm}, Currency: {currency}\n"
            f"Mode          : {mode}\n"
            f"Vessel        : {vessel_name or 'TBC'}\n"
            f"POL           : {port_of_loading}\n"
            f"POD           : {port_of_discharge}\n"
            f"Export date   : {export_date or 'TBC'}\n"
            f"FTA form      : {fta_form or 'None'}\n"
            f"ATIGA savings : MYR {atiga_savings_myr}\n"
            f"Signatory     : {signatory_name or 'TBC'} "
            f"({signatory_title or 'TBC'}) NRIC: {signatory_nric or 'TBC'}"
        )

        results = await self.glm.chat_json_many([
            {"system": K2_SYSTEM,         "user": k2_msg},
            {"system": VALIDATION_SYSTEM, "user": k2_msg},
        ])

        k2_data, validation = results[0], results[1]
        savings = k2_data.get("duty_savings_myr", atiga_savings_myr)

        return {
            "session_id":       session_id,
            "k2_data":          k2_data,
            "pre_validation":   validation,
            "submission_ready": validation.get("ready_to_submit", True),
            "savings_message":  f"Potential MYR {savings:.0f} saved if ATIGA Form D is filed.",
            "next_step":        "Submit via Dagang Net portal or appointed customs agent.",
        }

    async def validate_k2(
        self,
        k2_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Run pre-submission validation on a completed K2 form.
        """
        return await self.glm.chat_json(
            VALIDATION_SYSTEM,
            f"K2 declaration data:\n{json.dumps(k2_data, indent=2)}",
        )

    async def check_digital_access(
        self,
        company_brn: str,
        customs_agent_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Step 5 — Check Dagang Net / MyECIS setup requirements.
        """
        system = """You are a Malaysian customs digital systems specialist.
Assess MyDagangNet and MyECIS setup requirements.
Return JSON: {
  "mydagang_net_required": true,
  "myecis_setup_steps": [{"step": 1, "action": "", "portal": "", "time_days": 0}],
  "k2_agent_needed": true,
  "digital_certificates_needed": [{"cert_type": "", "issuing_ca": "", "validity_years": 0}],
  "portal_registrations": [{"portal": "", "url": "", "estimated_days": 0}],
  "estimated_setup_days": 0,
  "agent_code_provided": false,
  "notes": []
}"""
        return await self.glm.chat_json(
            system,
            (
                f"Company BRN          : {company_brn}\n"
                f"Customs agent code   : {customs_agent_code or 'None — will self-declare'}"
            ),
        )

    async def get_k2_status(self, session_id: str) -> Dict[str, Any]:
        """
        Placeholder for live Dagang Net / MyECIS status polling.
        In production, replace with a real webhook or polling call.
        """
        return {
            "session_id":  session_id,
            "status":      "pending",
            "message":     "Connect to Dagang Net API to poll live submission status.",
            "portal_url":  "https://www.dagangnet.com.my",
            "myecis_url":  "https://www.customs.gov.my",
            "rmcd_url":    "https://www.customs.gov.my/en/Pages/eCustoms.aspx",
        }

    async def estimate_duties(
        self,
        hs_code: str,
        cif_value_myr: float,
        destination_country: str,
        fta_form: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Estimate total duties payable including any FTA preferential rate.
        """
        system = """You are a Malaysian Customs duty calculator.
Calculate all duties and taxes payable for this export/re-import scenario.
Return JSON: {
  "hs_code": "",
  "cif_value_myr": 0,
  "mfn_rate_percent": 0,
  "mfn_duty_myr": 0,
  "fta_rate_percent": 0,
  "fta_duty_myr": 0,
  "savings_myr": 0,
  "sst_applicable": false,
  "sst_myr": 0,
  "total_payable_mfn_myr": 0,
  "total_payable_fta_myr": 0,
  "recommendation": ""
}"""
        return await self.glm.chat_json(
            system,
            (
                f"HS Code     : {hs_code}\n"
                f"CIF value   : MYR {cif_value_myr}\n"
                f"Destination : {destination_country}\n"
                f"FTA form    : {fta_form or 'None — MFN rate applies'}"
            ),
        )