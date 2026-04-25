"""
app/routes/entity_route.py  ← UPDATED with ValidationEngine
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.services.entity_service import EntityService
from app.engines.validation_engine import ValidationEngine, ValidationError
from glmservice import get_glm

router = APIRouter(prefix="/entity", tags=["Entity Verification"])
MIN_FILE_BYTES = 1024


class EntityVerifyRequest(BaseModel):
    session_id: str
    company_name: str
    registration_number: str
    director_nric: Optional[str] = None


@router.post("/verify")
async def verify_entity(req: EntityVerifyRequest):
    # ── 1. Local validation first (no AI cost) ────────────────────────────────
    errors = (
        ValidationEngine.validate_brn(req.registration_number)
        + ValidationEngine.validate_company_name(req.company_name)
        + ValidationEngine.validate_nric(req.director_nric or "")
    )
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    # ── 2. AI verification ────────────────────────────────────────────────────
    try:
        svc    = EntityService(get_glm())
        result = await svc.verify(
            session_id          = req.session_id,
            company_name        = req.company_name,
            registration_number = req.registration_number,
            director_nric       = req.director_nric,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Persist to session
    try:
        from main import _sessions
        if req.session_id in _sessions:
            _sessions[req.session_id]["checklist"]["entity_verification"] = {
                **result.get("entity", {}),
                "verified": result.get("step_complete", False),
            }
            if result.get("step_complete"):
                _sessions[req.session_id]["current_step"] = max(
                    _sessions[req.session_id].get("current_step", 1), 2
                )
                _sessions[req.session_id]["progress"] = max(
                    _sessions[req.session_id].get("progress", 0), 11
                )
    except ImportError:
        pass

    return result


@router.post("/upload-ssm")
async def upload_ssm(
    session_id: str = Query(...),
    file: UploadFile = File(...),
):
    # ── 1. File validation ────────────────────────────────────────────────────
    contents = await file.read()
    file_errors = ValidationEngine.validate_upload_file(
        content_type = file.content_type,
        file_size    = len(contents),
    )
    if file_errors:
        raise HTTPException(status_code=422, detail=file_errors)

    # ── 2. Extract via AI ─────────────────────────────────────────────────────
    try:
        svc    = EntityService(get_glm())
        result = await svc.extract_ssm(
            session_id   = session_id,
            filename     = file.filename or "ssm_certificate",
            file_bytes   = contents,
            content_type = file.content_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    extracted = result.get("extracted", {})

    # ── 3. Cross-check extracted vs session input ─────────────────────────────
    try:
        from main import _sessions
        session = _sessions.get(session_id, {})
        entity_input = session.get("checklist", {}).get("entity_verification", {})

        if entity_input:
            match_errors = ValidationEngine.match_ssm_extracted_vs_input(
                extracted    = extracted,
                user_brn     = entity_input.get("registration_number", ""),
                user_company = entity_input.get("company_name", ""),
            )
            if match_errors:
                result["match_warnings"] = match_errors
    except ImportError:
        pass

    is_valid       = result.get("is_valid", False)
    missing_fields = result.get("issues", [])
    step_complete  = is_valid and len(missing_fields) == 0

    if not is_valid:
        result["step_complete"]     = False
        result["validation_status"] = "failed"
        result["user_message"] = (
            "The uploaded document could not be validated as a genuine SSM certificate. "
            f"Missing or unreadable fields: "
            f"{', '.join(missing_fields) if missing_fields else 'Registration number, Company name, Director details'}."
        )
        return result

    result["step_complete"]     = True
    result["validation_status"] = "passed"
    result["user_message"] = (
        f"SSM certificate validated. "
        f"Company: {extracted.get('company_name', 'N/A')}, "
        f"BRN: {extracted.get('registration_number', 'N/A')}."
    )

    try:
        from main import _sessions
        if session_id in _sessions:
            _sessions[session_id]["checklist"]["entity_verification"] = {
                **_sessions[session_id]["checklist"].get("entity_verification", {}),
                "company_name":             extracted.get("company_name"),
                "registration_number":      extracted.get("registration_number"),
                "ssm_certificate_uploaded": True,
                "ssm_valid":                True,
                "verified":                 True,
            }
            _sessions[session_id]["current_step"] = max(
                _sessions[session_id].get("current_step", 1), 2
            )
            _sessions[session_id]["progress"] = max(
                _sessions[session_id].get("progress", 0), 11
            )
    except ImportError:
        pass

    return result