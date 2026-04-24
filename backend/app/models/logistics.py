"""
models/logistics.py
Step 7 — Logistics Setup
Mode of transport, container type, B/L, port charges, K2 transport codes.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from .base import TradeMode


# ─────────────────────────────────────────────────────────────────────────────
# CORE DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────

class LogisticsMetrics(BaseModel):
    mode: TradeMode
    vessel_name: Optional[str] = None
    flight_number: Optional[str] = None
    container_number: Optional[str] = None
    port_of_loading: str
    port_of_discharge: str
    gross_weight_kg: float
    cbm: float
    export_date: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# GLM RESPONSE SHAPES
# ─────────────────────────────────────────────────────────────────────────────

class RequiredShippingDoc(BaseModel):
    document: str
    mandatory: bool = True
    issuing_party: str = ""


class LogisticsRecommendation(BaseModel):
    container_type: Literal[
        "20GP", "40GP", "40HC", "LCL", "AIR", "TRUCK"
    ] = "20GP"
    estimated_transit_days: int = 0
    customs_clearance_days: int = 0
    bl_type: Literal["OBL", "SWB", "TELEX", "AWB", "CMR"] = "OBL"
    required_shipping_docs: List[RequiredShippingDoc] = Field(default_factory=list)
    port_charges_myr: float = 0.0
    handling_charges_myr: float = 0.0
    terminal_handling_myr: float = 0.0
    total_logistics_cost_myr: float = 0.0
    shipping_line_recommendations: List[str] = Field(default_factory=list)
    k2_transport_mode_code: str = ""
    export_permit_needed_from_port: bool = False
    hazmat_declaration_required: bool = False
    notes: List[str] = Field(default_factory=list)


class MandatoryDoc(BaseModel):
    name: str
    issuing_party: str = ""
    copies_needed: int = 1
    digital_accepted: bool = True


class ConditionalDoc(BaseModel):
    name: str
    condition: str
    issuing_party: str = ""


class ShippingDocsResult(BaseModel):
    mandatory_docs: List[MandatoryDoc] = Field(default_factory=list)
    conditional_docs: List[ConditionalDoc] = Field(default_factory=list)
    k2_attachments: List[str] = Field(default_factory=list)
    total_doc_count: int = 0
    estimated_preparation_days: int = 0


class ContainerRecommendation(BaseModel):
    recommended_container: Literal["20GP", "40GP", "40HC", "LCL"] = "20GP"
    container_capacity_cbm: float = 0.0
    utilisation_percent: float = 0.0
    stuffing_plan: str = ""
    alternative: str = ""
    cost_comparison: Dict[str, Any] = Field(default_factory=dict)
    notes: str = ""


class PortInfo(BaseModel):
    port_name: str
    port_code: str = ""
    country: str = ""
    customs_office: str = ""
    operating_hours: str = ""
    typical_dwell_days: int = 0
    free_time_days: int = 0
    charges: Dict[str, float] = Field(default_factory=dict)
    digital_submission: bool = True
    portal: str = ""
    notes: List[str] = Field(default_factory=list)


class LogisticsK2Validation(BaseModel):
    valid: bool = True
    missing_fields: List[str] = Field(default_factory=list)
    invalid_fields: List[Dict[str, str]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    k2_transport_code: str = ""
    k2_port_code_pol: str = ""
    k2_port_code_pod: str = ""
    ready_for_submission: bool = True


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

class LogisticsRequest(BaseModel):
    session_id: str
    mode: TradeMode
    port_of_loading: str = "Port Klang"
    port_of_discharge: str
    gross_weight_kg: float
    cbm: float
    vessel_name: Optional[str] = None
    flight_number: Optional[str] = None
    container_number: Optional[str] = None
    export_date: Optional[str] = None            # ISO date e.g. "2026-05-02"


class LogisticsResponse(BaseModel):
    session_id: str
    logistics: LogisticsMetrics
    recommendations: Dict[str, Any]              # LogisticsRecommendation
    shipping_documents: Dict[str, Any]           # ShippingDocsResult
    step_complete: bool