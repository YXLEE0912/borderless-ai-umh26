"""
app/services/digital_access_service.py
Step 5 — Digital Access Service
Assesses MyDagangNet, MyECIS / uCustoms setup requirements,
digital certificate needs, and customs agent necessity.
"""

from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from typing import Any, Dict, Optional
from glmservice import GLMService


SETUP_SYSTEM = """You are a Malaysian customs digital systems specialist with expertise in:
- MyDagangNet (EDI submission portal for K2 / K8 declarations)
- MyECIS / uCustoms (Royal Malaysian Customs Department e-services)
- PKI digital certificates (MSC Trustgate, Pos Digicert)
- Customs Approved Trader (AEO) programme
- Licensed Customs Agent requirements under Customs Act 1967

Assess what the company needs to set up before submitting a K2 export declaration.

Return JSON:
{
  "mydagang_net_required": true,
  "myecis_setup_steps": [
    {
      "step": 1,
      "action": "",
      "portal": "",
      "time_days": 0
    }
  ],
  "k2_agent_needed": true,
  "agent_code_provided": false,
  "digital_certificates_needed": [
    {
      "cert_type": "",
      "issuing_ca": "",
      "validity_years": 0
    }
  ],
  "portal_registrations": [
    {
      "portal": "",
      "url": "",
      "estimated_days": 0
    }
  ],
  "estimated_setup_days": 0,
  "can_self_declare": false,
  "self_declare_requirements": [],
  "notes": []
}"""

READINESS_SYSTEM = """You are a Malaysian customs pre-submission readiness auditor.
Check if a company is ready to submit K2 declarations via Dagang Net.

Return JSON:
{
  "ready": false,
  "readiness_score": 0,
  "blockers": [
    {"item": "", "severity": "critical|warning", "action": ""}
  ],
  "completed_items": [],
  "estimated_days_to_ready": 0,
  "recommended_path": "self_declare|appoint_agent|aeo_programme",
  "notes": ""
}"""


class DigitalAccessService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def setup(
        self,
        session_id: str,
        company_brn: str,
        customs_agent_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run both setup assessment and readiness check in parallel.
        """
        context = (
            f"Company BRN        : {company_brn}\n"
            f"Customs agent code : {customs_agent_code or 'None — evaluating self-declaration'}"
        )

        results = await self.glm.chat_json_many([
            {"system": SETUP_SYSTEM,      "user": context},
            {"system": READINESS_SYSTEM,  "user": context},
        ])

        setup_result, readiness = results[0], results[1]

        # Patch agent_code_provided flag from actual input
        setup_result["agent_code_provided"] = bool(customs_agent_code)

        return {
            "session_id":       session_id,
            "company_brn":      company_brn,
            "digital_access":   setup_result,
            "readiness":        readiness,
            "step_complete":    not setup_result.get("parse_error", False),
            "portals": {
                "dagang_net": "https://www.dagangnet.com.my",
                "myecis":     "https://www.customs.gov.my",
                "trustgate":  "https://www.trustgate.com.my",
                "pos_digicert": "https://www.posdigicert.com.my",
            },
        }

    async def check_agent_code(
        self,
        agent_code: str,
    ) -> Dict[str, Any]:
        """
        Validate a customs agent / forwarding agent code.
        """
        system = """You are a Malaysian Customs licensed agent verifier.
Validate the customs agent / forwarding agent code format.
Return JSON: {
  "valid_format": false,
  "agent_type": "Licensed Customs Agent|Forwarding Agent|Unknown",
  "licence_body": "Royal Malaysian Customs Department",
  "notes": ""
}"""
        return await self.glm.chat_json(
            system,
            f"Agent code: {agent_code}",
        )