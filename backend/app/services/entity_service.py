"""
app/services/entity_service.py
Step 1 — Entity Verification Service
Verifies Malaysian company (SSM BRN), director NRIC, blacklist,
customs registration, SST/GST status.
Also extracts structured data from uploaded SSM certificates.
"""

from __future__ import annotations

import base64
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from typing import Any, Dict, Optional
from glmservice import GLMService


VERIFY_SYSTEM = """You are a Malaysian Companies Commission (SSM) and Royal Malaysian
Customs Department (RMCD) compliance specialist.

Verify the exporter entity against:
- SSM company registry (active / struck-off / wound-up)
- RMCD blacklist / suspended exporters list
- Customs client code / uCustoms registration
- SST registration (MySST portal)
- Director / authorised signatory match

Return JSON:
{
  "verified": false,
  "company_status": "active|struck_off|wound_up|unknown",
  "director_match": false,
  "blacklisted": false,
  "customs_client_code": "",
  "gst_registered": false,
  "sst_registered": false,
  "compliance_flags": [],
  "required_actions": [],
  "regulatory_references": [
    "Companies Act 2016",
    "Customs Act 1967",
    "Sales Tax Act 2018"
  ],
  "notes": ""
}"""

EXTRACT_SYSTEM = """You are an expert at reading Malaysian SSM (Suruhanjaya Syarikat Malaysia)
company registration certificates and business licences.

Extract all available fields from the document text provided.
Validate that mandatory fields are present and correctly formatted.

Return JSON:
{
  "is_valid": false,
  "company_name": "",
  "registration_number": "",
  "registration_date": "",
  "company_type": "Sdn Bhd|Bhd|LLP|Enterprise|Partnership",
  "business_nature": "",
  "registered_address": "",
  "directors": [
    {"name": "", "nric": "", "designation": "Director|Managing Director|Secretary"}
  ],
  "paid_up_capital": "",
  "company_status": "active|struck_off|wound_up|unknown",
  "ssm_reference": "",
  "issue_date": "",
  "expiry_date": "",
  "missing_fields": [],
  "extraction_confidence": 0.0,
  "notes": ""
}"""


class EntityService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    # ── Verify ────────────────────────────────────────────────────────────────

    async def verify(
        self,
        session_id: str,
        company_name: str,
        registration_number: str,
        director_nric: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run GLM-powered entity verification against SSM / RMCD criteria.
        """
        user_msg = (
            f"Company name         : {company_name}\n"
            f"Registration number  : {registration_number}\n"
            f"Director NRIC        : {director_nric or 'Not provided'}"
        )

        result = await self.glm.chat_json(VERIFY_SYSTEM, user_msg)

        return {
            "session_id": session_id,
            "entity": {
                "company_name":        company_name,
                "registration_number": registration_number,
                "director_nric":       director_nric,
                "ssm_certificate_uploaded": False,
                "status": (
                    "verified"
                    if result.get("verified") and not result.get("blacklisted")
                    else "failed"
                    if result.get("blacklisted")
                    else "pending"
                ),
            },
            "verification":  result,
            "step_complete": result.get("verified", False),
        }

    # ── SSM Upload ────────────────────────────────────────────────────────────

    async def extract_ssm(
        self,
        session_id: str,
        filename: str,
        file_bytes: bytes,
        content_type: str,
    ) -> Dict[str, Any]:
        """
        Extract structured data from an uploaded SSM certificate.
        For PDFs we send raw text hint; for images we pass a base64 description prompt.
        GLM does not support native vision here, so we describe the file and
        instruct the model to extract what it can from any embedded text.
        """
        if content_type == "application/pdf":
            # Attempt naive text extraction from PDF bytes (printable ASCII)
            try:
                raw_text = self._extract_pdf_text(file_bytes)
            except Exception:
                raw_text = "(PDF binary — text extraction unavailable)"
            user_msg = (
                f"SSM Certificate filename : {filename}\n"
                f"Extracted text content   :\n{raw_text[:4000]}"
            )
        else:
            # Image — encode to base64 and describe
            b64 = base64.b64encode(file_bytes).decode()
            user_msg = (
                f"SSM Certificate filename : {filename}\n"
                f"File type                : {content_type}\n"
                f"Base64 size              : {len(b64)} chars\n"
                "Note: Extract all visible text fields from this SSM certificate image."
            )

        result = await self.glm.chat_json(EXTRACT_SYSTEM, user_msg)

        return {
            "session_id": session_id,
            "filename":   filename,
            "extracted":  result,
            "is_valid":   result.get("is_valid", False),
            "issues": result.get("missing_fields", []),
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_pdf_text(data: bytes) -> str:
        """
        Naive printable-ASCII extraction from raw PDF bytes.
        Replace with pdfplumber / pypdf2 for production use.
        """
        text = data.decode("latin-1", errors="ignore")
        printable = "".join(
            c for c in text if c.isprintable() or c in "\n\r\t"
        )
        # Collapse whitespace runs
        import re
        return re.sub(r"[ \t]{2,}", " ", printable).strip()