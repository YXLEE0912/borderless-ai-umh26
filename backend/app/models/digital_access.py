"""
models/digital_access.py
Step 5 — Digital Access Setup
MyDagangNet, MyECIS / uCustoms registration, digital certificates.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# GLM RESPONSE SHAPES
# ─────────────────────────────────────────────────────────────────────────────

class SetupStep(BaseModel):
    step: int
    action: str
    portal: str = ""
    time_days: int = 0


class DigitalCertificate(BaseModel):
    cert_type: str
    issuing_ca: str
    validity_years: int = 1


class PortalRegistration(BaseModel):
    portal: str
    url: str
    estimated_days: int = 0


class DigitalAccessResult(BaseModel):
    """GLM response for digital access setup check."""
    mydagang_net_required: bool = True
    myecis_setup_steps: List[SetupStep] = Field(default_factory=list)
    k2_agent_needed: bool = True
    digital_certificates_needed: List[DigitalCertificate] = Field(default_factory=list)
    portal_registrations: List[PortalRegistration] = Field(default_factory=list)
    estimated_setup_days: int = 0
    agent_code_provided: bool = False
    notes: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE
# ─────────────────────────────────────────────────────────────────────────────

class DigitalAccessRequest(BaseModel):
    session_id: str
    company_brn: str
    customs_agent_code: Optional[str] = None


class DigitalAccessResponse(BaseModel):
    session_id: str
    company_brn: str
    digital_access: Dict[str, Any]               # DigitalAccessResult
    step_complete: bool = True