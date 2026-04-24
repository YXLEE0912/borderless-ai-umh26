from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.services.entity_service import EntityService
from glmservice import get_glm

router = APIRouter(prefix="/entity", tags=["Entity Verification"])

# Minimum file size to reject obviously-empty uploads (1 KB)
MIN_FILE_BYTES = 1024


# ── Models ────────────────────────────────────────────────────────────────────

class EntityVerifyRequest(BaseModel):
    session_id: str
    company_name: str
    registration_number: str
    director_nric: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/verify")
async def verify_entity(req: EntityVerifyRequest):
    """
    Step 1a — Verify company via SSM BRN.
    Checks company status, director match, blacklist, customs registration, SST/GST status.
    step_complete is only True when verified=True AND blacklisted=False.
    """
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
    session_id: str = Query(..., description="Active session ID"),
    file: UploadFile = File(..., description="SSM certificate PDF or image — must be the actual document"),
):
    """
    Step 1b — Upload SSM certificate for extraction and validation.

    IMPORTANT: This endpoint requires the ACTUAL SSM certificate file.
    - Accepted formats: PDF, JPEG, PNG
    - Minimum size: 1 KB (rejects empty / placeholder uploads)
    - step_complete is only True when the GLM extraction confirms is_valid=True
      (i.e. the document contains readable company registration fields)
    - If the document cannot be validated, the response lists specific missing
      fields so the user knows exactly what to fix before proceeding.
    """
    # ── File type validation ──────────────────────────────────────────────────
    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                "Please upload the actual SSM certificate as a PDF, JPG, or PNG."
            ),
        )

    # ── Read file ─────────────────────────────────────────────────────────────
    max_bytes = int(os.getenv("MAX_UPLOAD_SIZE", 10 * 1024 * 1024))
    contents  = await file.read()

    # ── Minimum size gate — rejects empty / trivially small files ────────────
    if len(contents) < MIN_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"The uploaded file is too small ({len(contents)} bytes). "
                "Please upload the actual SSM certificate document, not a placeholder."
            ),
        )

    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {max_bytes // (1024*1024)} MB.",
        )

    # ── Extract & validate via GLM ────────────────────────────────────────────
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

    is_valid       = result.get("is_valid", False)
    missing_fields = result.get("issues", [])

    # ── Gate: step_complete only when document is genuinely valid ─────────────
    step_complete = is_valid and len(missing_fields) == 0

    if not is_valid:
        result["step_complete"]     = False
        result["validation_status"] = "failed"
        result["user_message"] = (
            "The uploaded document could not be validated as a genuine SSM certificate. "
            "Please ensure you upload the original SSM registration certificate "
            "(Form 9, Form 13, or Borang Pendaftaran Perniagaan). "
            f"Missing or unreadable fields: {', '.join(missing_fields) if missing_fields else 'Registration number, Company name, Director details'}."
        )
        return result

    # ── Success: persist to session ───────────────────────────────────────────
    result["step_complete"]     = True
    result["validation_status"] = "passed"
    result["user_message"] = (
        f"SSM certificate validated successfully. "
        f"Company: {result.get('extracted', {}).get('company_name', 'N/A')}, "
        f"BRN: {result.get('extracted', {}).get('registration_number', 'N/A')}."
    )

    try:
        from main import _sessions
        if session_id in _sessions:
            extracted = result.get("extracted", {})
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
