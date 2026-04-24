"""
app/routes/entity_route.py
Step 1 — Entity Verification
POST /entity/verify
POST /entity/upload-ssm
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.services.entity_service import EntityService
from glmservice import get_glm

router = APIRouter(prefix="/entity", tags=["Entity Verification"])


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
    Checks company status, director match, blacklist, customs registration,
    SST/GST status and returns compliance flags.
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
    return result


@router.post("/upload-ssm")
async def upload_ssm(
    session_id: str = Query(..., description="Active session ID"),
    file: UploadFile = File(..., description="SSM certificate PDF or image"),
):
    """
    Step 1b — Upload SSM certificate for extraction.
    Reads the file, extracts text, runs GLM document extraction,
    returns structured company fields + validity flag.
    """
    allowed = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. "
                   f"Upload a PDF, JPG, or PNG.",
        )

    max_bytes = int(os.getenv("MAX_UPLOAD_SIZE", 10 * 1024 * 1024))  # 10 MB default
    contents  = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of "
                   f"{max_bytes // (1024*1024)} MB.",
        )

    try:
        svc    = EntityService(get_glm())
        result = await svc.extract_ssm(
            session_id   = session_id,
            filename     = file.filename,
            file_bytes   = contents,
            content_type = file.content_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result