"""
models/valuation.py
Step 6 — Financial Valuation & Landed Cost
FOB → CIF → Duty → Total Landed Cost.
FTA savings: ATIGA, CPTPP, RCEP, MAFTA, MJEPA.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# CORE DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────

class FinancialValuation(BaseModel):
    fob_value_myr: float
    freight_myr: float
    insurance_myr: float
    cif_myr: float
    estimated_duty_myr: float
    total_landed_cost_myr: float
    currency: str = "MYR"
    atiga_savings_myr: float = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# GLM RESPONSE SHAPES
# ─────────────────────────────────────────────────────────────────────────────

class FTAAnalysisResult(BaseModel):
    """FTA duty savings analysis from GLM."""
    atiga_applicable: bool = False
    atiga_rate: float = 0.0
    atiga_savings_myr: float = 0.0
    cptpp_applicable: bool = False
    cptpp_rate: float = 0.0
    cptpp_savings_myr: float = 0.0
    rcep_applicable: bool = False
    rcep_rate: float = 0.0
    rcep_savings_myr: float = 0.0
    mafta_applicable: bool = False
    mafta_savings_myr: float = 0.0
    best_fta: str = ""
    best_fta_rate: float = 0.0
    best_savings_myr: float = 0.0
    form_required: Literal[
        "Form D", "Form E", "RCEP Form", "None"
    ] = "None"
    roo_met: bool = True
    roo_criteria: str = ""
    direct_shipment_required: bool = True
    notes: str = ""


class FreightEstimate(BaseModel):
    estimated_freight_myr: float = 0.0
    estimated_freight_usd: float = 0.0
    basis: Literal["W/M", "Weight", "CBM"] = "W/M"
    chargeable_weight_kg: float = 0.0
    rate_per_unit_usd: float = 0.0
    surcharges: List[Dict[str, Any]] = Field(default_factory=list)
    total_with_surcharges_myr: float = 0.0
    shipping_lines: List[str] = Field(default_factory=list)
    transit_days: int = 0
    confidence: Literal["estimate", "indicative", "firm"] = "estimate"
    notes: str = ""


class CurrencyConversionResult(BaseModel):
    source_currency: str
    target_currency: str = "MYR"
    rate: float
    source_amount: float
    myr_amount: float
    rate_date: str = ""
    rate_source: str = "Bank Negara Malaysia reference rate"
    notes: str = ""


class CustomsValuationBreakdown(BaseModel):
    """K2-ready valuation per Customs Act 1967 Section 14."""
    customs_value_method: str = "Transaction Value (Method 1)"
    statistical_value_myr: float = 0.0
    fob_value_myr: float = 0.0
    cif_value_myr: float = 0.0
    export_duty_myr: float = 0.0
    currency_code: str = "MYR"
    exchange_rate_to_myr: float = 1.0
    valuation_date: str = ""
    declaration_statement: str = ""
    customs_act_reference: str = "Section 14, Customs Act 1967"


class ChargeableWeightResult(BaseModel):
    gross_weight_kg: float
    cbm: float
    volumetric_factor: float
    volumetric_weight_kg: float
    chargeable_weight_kg: float
    basis: Literal["Volumetric", "Gross"]
    mode: str


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

class ValuationRequest(BaseModel):
    session_id: str
    fob_value_myr: float
    destination_country: str
    hs_code: Optional[str] = None
    incoterm: str = "FOB"
    freight_quote_myr: Optional[float] = None
    insurance_rate: float = 0.005                # default 0.5 %
    import_duty_rate: Optional[float] = None     # defaults to 5 % if omitted


class ValuationResponse(BaseModel):
    session_id: str
    fob_myr: float
    freight_myr: float
    insurance_myr: float
    cif_myr: float
    import_duty_rate: float
    estimated_duty_myr: float
    total_landed_cost_myr: float
    net_landed_with_fta: float
    fta_analysis: Dict[str, Any]                 # FTAAnalysisResult
    atiga_savings_myr: float
    best_fta: str
    best_savings_myr: float
    form_required: str
    incoterm: str
    is_final: bool = False
    note: str = ""