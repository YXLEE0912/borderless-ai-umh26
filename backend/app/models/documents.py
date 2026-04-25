"""
models/documents.py
Step 8 — Trade Document Generation
Commercial Invoice, Packing List, Certificate of Origin, Bill of Lading.
All follow Malaysian Customs Act 1967 and MATRADE requirements.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from .base import IncotermType, TradeMode


# ─────────────────────────────────────────────────────────────────────────────
# SHARED SUB-MODELS
# ─────────────────────────────────────────────────────────────────────────────

class ExporterInfo(BaseModel):
    name: str
    brn: str = ""
    address: str = ""
    tel: str = ""
    email: str = ""
    bank: str = ""


class ConsigneeInfo(BaseModel):
    name: str
    country: str
    address: str = ""
    tax_id: str = ""
    tel: str = ""


class SignatoryInfo(BaseModel):
    name: str = ""
    title: str = ""
    signature_placeholder: str = "[SIGNATURE]"


# ─────────────────────────────────────────────────────────────────────────────
# COMMERCIAL INVOICE
# ─────────────────────────────────────────────────────────────────────────────

class InvoiceLineItem(BaseModel):
    line_no: int = 1
    hs_code: str = ""
    description: str
    quantity: float
    unit: str
    unit_price: float
    total: float
    currency: str = "MYR"


class CommercialInvoice(BaseModel):
    invoice_number: str = ""
    invoice_date: str = ""
    payment_terms: Literal[
        "T/T", "L/C", "D/P", "D/A", "Open Account"
    ] = "T/T"
    exporter: ExporterInfo
    consignee: ConsigneeInfo
    notify_party: Optional[Dict[str, str]] = None
    goods: List[InvoiceLineItem] = Field(default_factory=list)
    incoterm: str = "FOB"
    port_of_loading: str = ""
    port_of_discharge: str = ""
    currency: str = "MYR"
    subtotal: float = 0.0
    freight: float = 0.0
    insurance: float = 0.0
    total_fob: float = 0.0
    total_cif: float = 0.0
    country_of_origin: str = "Malaysia"
    marks_and_numbers: str = ""
    vessel_or_flight: str = ""
    letter_of_credit_no: str = ""
    declaration: str = (
        "We hereby certify that this invoice is true and correct."
    )
    signatory: SignatoryInfo = Field(default_factory=SignatoryInfo)


# ─────────────────────────────────────────────────────────────────────────────
# PACKING LIST
# ─────────────────────────────────────────────────────────────────────────────

class PackageItem(BaseModel):
    package_no: str
    type: Literal["CTN", "PALLET", "DRUM", "BAG", "BOX"] = "CTN"
    description: str
    gross_weight_kg: float = 0.0
    net_weight_kg: float = 0.0
    tare_weight_kg: float = 0.0
    length_cm: float = 0.0
    width_cm: float = 0.0
    height_cm: float = 0.0
    cbm: float = 0.0
    quantity_inside: int = 0


class PackingList(BaseModel):
    packing_list_number: str = ""
    date: str = ""
    exporter: ExporterInfo
    consignee: ConsigneeInfo
    invoice_reference: str = ""
    vessel_or_flight: str = ""
    port_of_loading: str = ""
    port_of_discharge: str = ""
    packages: List[PackageItem] = Field(default_factory=list)
    total_packages: int = 0
    total_gross_weight_kg: float = 0.0
    total_net_weight_kg: float = 0.0
    total_cbm: float = 0.0
    shipping_marks: str = ""
    container_number: str = ""
    seal_number: str = ""
    declaration: str = (
        "We hereby certify that the above particulars are true and correct."
    )
    signatory: SignatoryInfo = Field(default_factory=SignatoryInfo)


# ─────────────────────────────────────────────────────────────────────────────
# CERTIFICATE OF ORIGIN
# ─────────────────────────────────────────────────────────────────────────────

class COOGoodsItem(BaseModel):
    item_no: int = 1
    marks_and_numbers: str = ""
    description: str
    hs_code: str = ""
    origin_criterion: Literal[
        "WO", "CTH", "CTSH", "RVC40", "RVC35+CC", "PE"
    ] = "WO"
    quantity: str = ""
    gross_weight_kg: float = 0.0
    fob_value_myr: float = 0.0
    local_content_percent: float = 0.0


class TransportDetails(BaseModel):
    vessel_or_flight: str = ""
    port_of_loading: str = ""
    port_of_discharge: str = ""
    departure_date: str = ""
    arrival_date_estimated: str = ""


class CertificateOfOrigin(BaseModel):
    co_number: str = ""
    co_date: str = ""
    form_type: Literal[
        "Form D (ATIGA)", "Form E (ASEAN-China)", "RCEP Form", "Standard CO"
    ] = "Standard CO"
    issuing_body: Literal[
        "MATRADE", "MITI", "Chamber of Commerce", "MCCI"
    ] = "MATRADE"
    exporter: ExporterInfo
    consignee: ConsigneeInfo
    transport_details: TransportDetails = Field(default_factory=TransportDetails)
    goods: List[COOGoodsItem] = Field(default_factory=list)
    invoice_reference: str = ""
    declaration: str = ""
    remarks: str = ""
    back_to_back: bool = False
    third_country_invoice: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# BILL OF LADING (shell — completed by shipping agent)
# ─────────────────────────────────────────────────────────────────────────────

class ContainerDetail(BaseModel):
    container_no: str = ""
    seal_no: str = ""
    type: str = ""
    packages: int = 0
    description: str = ""
    gross_weight_kg: float = 0.0
    cbm: float = 0.0


class BillOfLading(BaseModel):
    bl_number: str = "TBC - Assigned by carrier"
    bl_date: str = ""
    bl_type: Literal["OBL", "SWB", "TELEX"] = "OBL"
    shipper: ExporterInfo
    consignee: ConsigneeInfo
    notify_party: Optional[Dict[str, str]] = None
    vessel_name: str = ""
    voyage_number: str = ""
    port_of_loading: str = ""
    port_of_discharge: str = ""
    place_of_delivery: str = ""
    freight_payable_at: Literal["Origin", "Destination"] = "Origin"
    freight_terms: Literal["Prepaid", "Collect"] = "Prepaid"
    container_details: List[ContainerDetail] = Field(default_factory=list)
    total_packages: int = 0
    total_gross_weight_kg: float = 0.0
    total_cbm: float = 0.0
    marks_and_numbers: str = ""
    on_board_date: str = ""
    place_of_issue: str = "Port Klang"
    number_of_originals: int = 3
    special_instructions: str = ""
    carrier_clause: str = (
        "SHIPPED on board in apparent good order and condition"
    )


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

class DocumentValidationResult(BaseModel):
    valid: bool = True
    missing_fields: List[str] = Field(default_factory=list)
    invalid_fields: List[Dict[str, str]] = Field(default_factory=list)
    compliance_issues: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    ready_to_sign: bool = True


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

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
    mode: TradeMode = "SEA"
    vessel_name: Optional[str] = None
    port_of_loading: str = "Port Klang"
    port_of_discharge: Optional[str] = None
    weight_kg: Optional[float] = None
    cbm: Optional[float] = None
    fta_form: Optional[str] = None


class GenerateDocsResponse(BaseModel):
    session_id: str
    generated: List[str]                         # names of successful docs
    failed: List[str]                            # names of failed docs
    documents: Dict[str, Any]                   # keyed by doc name