"""
models/entity.py
Step 1 — Entity Verification
SSM company lookup, BRN validation, director NRIC check, SSM cert upload.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# CORE DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────

class EntityVerification(BaseModel):
    company_name: str
    registration_number: str                       # SSM BRN e.g. "202301012345"
    director_nric: Optional[str] = None            # e.g. "880101-14-1234"
    ssm_certificate_uploaded: bool = False
    status: Literal["pending", "verified", "failed"] = "pending"


# ─────────────────────────────────────────────────────────────────────────────
# GLM RESPONSE SHAPE
# ─────────────────────────────────────────────────────────────────────────────

class EntityVerificationResult(BaseModel):
    """Shape returned by GLM compliance check."""
    verified: bool = False
    company_status: Literal["active", "struck_off", "wound_up", "unknown"] = "unknown"
    director_match: bool = False
    blacklisted: bool = False
    customs_client_code: Optional[str] = None       # uCustoms / MyECIS code
    gst_registered: bool = False
    sst_registered: bool = False
    compliance_flags: List[str] = Field(default_factory=list)
    required_actions: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

class EntityVerifyRequest(BaseModel):
    session_id: str
    company_name: str
    registration_number: str
    director_nric: Optional[str] = None

# FIX: models/__init__.py imports EntityVerificationRequest (old name) as an
# alias. Keep both names so nothing breaks regardless of which is used.
EntityVerificationRequest = EntityVerifyRequest


class EntityVerifyResponse(BaseModel):
    session_id: str
    entity: EntityVerification
    verification: Dict[str, Any]                  # raw GLM result
    step_complete: bool


class SSMUploadResponse(BaseModel):
    session_id: str
    filename: str
    extracted: Dict[str, Any]                     # fields pulled from SSM PDF
    is_valid: bool
    issues: List[str] = Field(default_factory=list)