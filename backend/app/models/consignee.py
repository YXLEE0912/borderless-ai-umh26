"""
models/consignee.py
Step 2 — Consignee Details & Screening
Sanctions check, denied-party screening, incoterm suitability.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from .base import IncotermType, RiskLevel


# ─────────────────────────────────────────────────────────────────────────────
# CORE DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────

class ConsigneeDetails(BaseModel):
    buyer_name: str
    buyer_country: str
    buyer_address: str
    importer_of_record: Optional[str] = None
    buyer_tax_id: Optional[str] = None            # VAT / GST / EORI at destination
    incoterm: str = "FOB"


# ─────────────────────────────────────────────────────────────────────────────
# GLM RESPONSE SHAPES
# ─────────────────────────────────────────────────────────────────────────────

class IncotermSuitability(BaseModel):
    provided_incoterm: str
    suitable: bool
    reason: str = ""
    recommended_alternatives: List[str] = Field(default_factory=list)


class ConsigneeScreeningResult(BaseModel):
    """Shape returned by GLM sanctions / DPS check."""
    risk_level: RiskLevel = "low"
    sanctioned_country: bool = False
    denied_party_check: Literal["clear", "flagged", "manual_review_required"] = "clear"
    incoterm_suitability: Optional[IncotermSuitability] = None
    required_permits: List[str] = Field(default_factory=list)
    compliance_notes: List[str] = Field(default_factory=list)
    recommended_incoterms: List[str] = Field(default_factory=list)
    red_flags: List[str] = Field(default_factory=list)
    screening_references: List[str] = Field(default_factory=list)


class QuickSanctionsCheck(BaseModel):
    """Rapid country/entity check result."""
    quick_check: Literal["clear", "flagged", "unknown"] = "clear"
    country_risk: RiskLevel = "low"
    embargo_active: bool = False
    notes: str = ""


class IncotermRecommendation(BaseModel):
    recommended: str
    reason: str = ""
    alternatives: List[str] = Field(default_factory=list)
    risk_allocation: Dict[str, str] = Field(default_factory=dict)
    cost_implication: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

class ConsigneeRequest(BaseModel):
    session_id: str
    buyer_name: str
    buyer_country: str
    buyer_address: str
    incoterm: str = "FOB"
    buyer_tax_id: Optional[str] = None


class ConsigneeResponse(BaseModel):
    session_id: str
    consignee: ConsigneeDetails
    screening: Dict[str, Any]                    # raw GLM screening result
    step_complete: bool = True