"""
models/customs.py
Step 9 — K2 Customs Export Declaration
Malaysian Customs Act 1967, Dagang Net / MyECIS submission.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from .base import IncotermType, TradeMode


# ─────────────────────────────────────────────────────────────────────────────
# K2 SUB-MODELS
# ─────────────────────────────────────────────────────────────────────────────

class K2Header(BaseModel):
    manifest_ref: str = ""
    declaration_type: str = "EX"
    customs_procedure_code: str = "10"
    regime_type: str = "Export"
    office_of_exit: str = ""


class K2Exporter(BaseModel):
    name: str
    brn: str
    address: str
    customs_client_code: str = ""
    eori_equivalent: str = ""


class K2Consignee(BaseModel):
    name: str
    country_code: str
    address: str = ""


class K2Transport(BaseModel):
    mode_code: str = ""                          # 1=Sea, 4=Air, 3=Road, 2=Rail
    mode_description: str = ""
    vessel_flight_name: str = ""
    voyage_flight_number: str = ""
    flag_of_vessel: str = ""
    port_of_loading_code: str = ""
    port_of_discharge_code: str = ""
    country_of_destination_code: str = ""
    container_indicator: Literal["Y", "N"] = "Y"


class K2Goods(BaseModel):
    item_number: int = 1
    commodity_description: str = ""
    hs_code: str = ""
    country_of_origin: str = "MY"
    quantity: float = 0.0
    unit_of_quantity: str = ""
    gross_weight_kg: float = 0.0
    net_weight_kg: float = 0.0
    number_of_packages: int = 0
    package_type_code: str = ""
    marks_and_numbers: str = ""
    container_number: str = ""


class K2Valuation(BaseModel):
    statistical_value_myr: float = 0.0
    fob_value_myr: float = 0.0
    invoice_currency: str = "MYR"
    invoice_amount: float = 0.0
    exchange_rate: float = 1.0
    incoterm: str = "FOB"
    freight_myr: float = 0.0
    insurance_myr: float = 0.0
    cif_value_myr: float = 0.0


class K2Duty(BaseModel):
    export_duty_myr: float = 0.0
    customs_duty_myr: float = 0.0
    sst_myr: float = 0.0
    total_duty_myr: float = 0.0
    duty_exemption_code: str = ""
    exemption_reference: str = ""


class K2FTA(BaseModel):
    fta_claimed: bool = False
    fta_name: str = ""
    form_type: str = ""
    form_number: str = ""
    preferential_rate: float = 0.0


class K2Signatory(BaseModel):
    name: str = ""
    nric_passport: str = ""
    designation: str = ""
    declaration_text: str = (
        "I declare that the particulars given in this declaration "
        "are true and correct."
    )
    date: str = ""


class K2FormData(BaseModel):
    header: K2Header = Field(default_factory=K2Header)
    exporter: K2Exporter
    consignee: K2Consignee
    transport: K2Transport = Field(default_factory=K2Transport)
    goods: K2Goods = Field(default_factory=K2Goods)
    valuation: K2Valuation = Field(default_factory=K2Valuation)
    duty: K2Duty = Field(default_factory=K2Duty)
    fta: K2FTA = Field(default_factory=K2FTA)
    signatory: K2Signatory = Field(default_factory=K2Signatory)


# ─────────────────────────────────────────────────────────────────────────────
# K2 RESULT SHAPES
# ─────────────────────────────────────────────────────────────────────────────

class ChecklistEntry(BaseModel):
    item: str
    status: Literal["ready", "missing", "optional"]
    document_ref: str = ""


class DagangNetStep(BaseModel):
    step: int
    action: str
    portal: str = ""
    notes: str = ""


class K2DeclarationResult(BaseModel):
    """Full K2 declaration result from GLM."""
    k2_reference: str = ""
    declaration_type: str = "EX"
    customs_station: str = ""
    export_date: str = ""
    k2_form_data: Optional[Dict[str, Any]] = None
    submission_checklist: List[ChecklistEntry] = Field(default_factory=list)
    atiga_form_d_applicable: bool = False
    duty_savings_myr: float = 0.0
    estimated_processing_hours: int = 4
    dagang_net_submission_steps: List[DagangNetStep] = Field(default_factory=list)
    compliance_notes: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# PRE-SUBMISSION VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

class DutyCalculationCheck(BaseModel):
    correct: bool = True
    expected_duty_myr: float = 0.0
    declared_duty_myr: float = 0.0
    variance_myr: float = 0.0


class K2ValidationResult(BaseModel):
    ready_to_submit: bool = True
    critical_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    missing_mandatory_fields: List[str] = Field(default_factory=list)
    field_format_errors: List[Dict[str, str]] = Field(default_factory=list)
    duty_calculation_check: DutyCalculationCheck = Field(
        default_factory=DutyCalculationCheck
    )
    atiga_eligibility_confirmed: bool = False
    estimated_ack_hours: int = 4


# ─────────────────────────────────────────────────────────────────────────────
# DUTY ESTIMATE
# ─────────────────────────────────────────────────────────────────────────────

class DutyEstimate(BaseModel):
    hs_code: str = ""
    cif_value_myr: float = 0.0
    mfn_rate_percent: float = 0.0
    mfn_duty_myr: float = 0.0
    fta_rate_percent: float = 0.0
    fta_duty_myr: float = 0.0
    savings_myr: float = 0.0
    sst_applicable: bool = False
    sst_myr: float = 0.0
    total_payable_mfn_myr: float = 0.0
    total_payable_fta_myr: float = 0.0
    recommendation: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

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
    mode: TradeMode = "SEA"
    port_of_loading: str = "Port Klang"
    port_of_discharge: str
    vessel_name: Optional[str] = None
    export_date: Optional[str] = None
    fta_form: Optional[str] = None
    atiga_savings_myr: float = 0.0
    signatory_name: Optional[str] = None
    signatory_nric: Optional[str] = None
    signatory_title: Optional[str] = None


class CustomsResponse(BaseModel):
    session_id: str
    k2_data: Dict[str, Any]                      # K2DeclarationResult
    pre_validation: Dict[str, Any]               # K2ValidationResult
    submission_ready: bool
    savings_message: str
    next_step: str = (
        "Submit via Dagang Net portal or appointed customs agent."
    )


class K2StatusResponse(BaseModel):
    session_id: str
    status: Literal["pending", "submitted", "acknowledged", "rejected"] = "pending"
    message: str = ""
    portal_url: str = "https://www.dagangnet.com.my"
    myecis_url: str = "https://www.customs.gov.my"
    rmcd_url: str = "https://www.customs.gov.my/en/Pages/eCustoms.aspx"