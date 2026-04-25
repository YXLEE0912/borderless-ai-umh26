"""
models/hs_code.py
Step 3 — HS Code Classification
WCO Harmonized System, AHTN, duty rates, FTA eligibility, restricted goods.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# CORE DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────

class HSClassification(BaseModel):
    product_description: str
    hs_code: Optional[str] = None                  # e.g. "8471.30.00"
    destination_country: str
    export_duty_rate: float = 0.0
    import_duty_rate: float = 0.0
    fta_applicable: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# GLM RESPONSE SHAPES
# ─────────────────────────────────────────────────────────────────────────────

class PreferentialDutyRates(BaseModel):
    ATIGA: float = 0.0
    CPTPP: float = 0.0
    RCEP: float = 0.0


class HSClassificationResult(BaseModel):
    """Full classification result from GLM."""
    hs_code: str = ""
    hs_description: str = ""
    chapter: str = ""
    chapter_description: str = ""
    malaysia_export_duty: float = 0.0
    destination_import_duty: float = 0.0
    preferential_duty_rates: PreferentialDutyRates = Field(
        default_factory=PreferentialDutyRates
    )
    gst_sst_applicable: bool = False
    fta_available: List[str] = Field(default_factory=list)
    permit_required: List[str] = Field(default_factory=list)
    restrictions: List[str] = Field(default_factory=list)
    export_prohibited: bool = False
    strategic_goods: bool = False
    dual_use: bool = False
    confidence: float = 0.0
    classification_notes: List[str] = Field(default_factory=list)
    tariff_schedule_reference: str = ""


class FTAEligibilityResult(BaseModel):
    """FTA eligibility and Rules of Origin from GLM."""
    fta_applicable: List[str] = Field(default_factory=list)
    best_fta: str = ""
    preferential_rate: float = 0.0
    mfn_rate: float = 0.0
    savings_potential_percent: float = 0.0
    form_required: Literal[
        "Form D", "Form E", "RCEP Form", "AI Form", "None"
    ] = "None"
    roo_requirements: List[str] = Field(default_factory=list)
    local_content_threshold: int = 0
    ctc_rule: str = ""
    cumulation_applicable: bool = False
    direct_shipment_required: bool = True
    notes: str = ""


class RestrictedGoodsResult(BaseModel):
    restricted: bool = False
    prohibited: bool = False
    strategic_goods: bool = False
    dual_use: bool = False
    end_user_cert_required: bool = False
    permits_required: List[str] = Field(default_factory=list)
    relevant_laws: List[str] = Field(default_factory=list)
    embargo_check: Literal["clear", "flagged"] = "clear"


class HSAlternative(BaseModel):
    hs_code: str
    description: str
    confidence: float
    reason: str


class HSAlternativesResult(BaseModel):
    alternatives: List[HSAlternative] = Field(default_factory=list)
    recommendation: str = ""
    ruling_reference: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

class HSCodeRequest(BaseModel):
    session_id: str
    product_description: str
    destination_country: str
    product_category: Optional[str] = None


class HSCodeResponse(BaseModel):
    session_id: str
    product_description: str
    destination_country: str
    classification: Dict[str, Any]               # HSClassificationResult
    fta_eligibility: Dict[str, Any]              # FTAEligibilityResult
    step_complete: bool