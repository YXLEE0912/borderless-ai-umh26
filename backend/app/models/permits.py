"""
models/permits.py
Step 4 — Special Permits & Regulatory Checks
SIRIM, JAKIM Halal, MITI, DVS, DOA, AELB, Strategic Goods Control.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# CORE DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────

class SpecialPermits(BaseModel):
    sirim_required: bool = False
    halal_required: bool = False
    miti_required: bool = False
    dvs_required: bool = False
    doa_phytosanitary_required: bool = False
    aelb_required: bool = False
    strategic_goods_control: bool = False
    permits: List[Dict[str, Any]] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# GLM RESPONSE SHAPES
# ─────────────────────────────────────────────────────────────────────────────

class PermitItem(BaseModel):
    name: str
    issuing_body: str
    mandatory: bool = True
    processing_days: int = 0
    fee_myr: float = 0.0
    portal: str = ""
    document_required: List[str] = Field(default_factory=list)


class PermitCheckResult(BaseModel):
    """Full permit requirements result from GLM."""
    permits_required: List[PermitItem] = Field(default_factory=list)
    sirim_required: bool = False
    halal_required: bool = False
    miti_license_required: bool = False
    dvs_required: bool = False
    doa_phytosanitary_required: bool = False
    aelb_required: bool = False
    strategic_goods_control: bool = False
    dual_use_item: bool = False
    end_user_certificate_required: bool = False
    total_estimated_days: int = 0
    total_estimated_cost_myr: float = 0.0
    fast_track_available: bool = False
    notes: List[str] = Field(default_factory=list)


class StrategicGoodsResult(BaseModel):
    is_strategic_good: bool = False
    is_dual_use: bool = False
    control_list_reference: str = ""
    end_user_cert_required: bool = False
    miti_approval_required: bool = False
    notes: str = ""


class SIRIMRequirements(BaseModel):
    required: bool = False
    certification_type: str = "None"
    scheme: str = ""
    standards_applicable: List[str] = Field(default_factory=list)
    processing_weeks: int = 0
    fee_range_myr: Dict[str, float] = Field(default_factory=dict)
    portal: str = "https://www.sirim-qas.com.my"
    documents_needed: List[str] = Field(default_factory=list)
    notes: str = ""


class HalalRequirements(BaseModel):
    required: bool = False
    recommended: bool = False
    reason: str = ""
    jakim_scheme: str = ""
    recognised_bodies_at_destination: List[str] = Field(default_factory=list)
    processing_weeks: int = 0
    fee_myr: float = 0.0
    portal: str = "https://www.halal.gov.my"
    product_categories_covered: List[str] = Field(default_factory=list)
    notes: str = ""


class GanttMilestone(BaseModel):
    permit: str
    start_day: int
    end_day: int
    depends_on: List[str] = Field(default_factory=list)


class PermitTimeline(BaseModel):
    critical_path_days: int = 0
    parallel_permits: List[str] = Field(default_factory=list)
    sequential_permits: List[str] = Field(default_factory=list)
    start_immediately: List[str] = Field(default_factory=list)
    gantt_milestones: List[GanttMilestone] = Field(default_factory=list)
    recommended_start_date: str = ""
    estimated_ready_date: str = ""
    notes: str = ""


class ComplianceCheckResult(BaseModel):
    overall_status: Literal["compliant", "non_compliant", "pending"] = "pending"
    compliance_score: int = 0
    critical_issues: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    passed_checks: List[str] = Field(default_factory=list)
    estimated_delay_days: int = 0
    regulatory_citations: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# PERMIT FLAGS SUMMARY (used in session checklist)
# ─────────────────────────────────────────────────────────────────────────────

class PermitFlags(BaseModel):
    sirim: bool = False
    halal: bool = False
    miti: bool = False
    strategic_goods: bool = False
    dvs: bool = False
    phytosanitary: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

class PermitsRequest(BaseModel):
    session_id: str
    hs_code: str
    product_type: str
    destination_country: str


class PermitsResponse(BaseModel):
    session_id: str
    hs_code: str
    permits: Dict[str, Any]                      # PermitCheckResult
    flags: PermitFlags
    step_complete: bool = True