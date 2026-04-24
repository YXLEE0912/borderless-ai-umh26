from datetime import datetime, timezone
from time import perf_counter
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Body, File, Form, HTTPException, Request, UploadFile

from app.schemas.scan import (
    ScanChatMessage,
    ScanCreateResponse,
    ScanFollowUpRequest,
    ScanFollowUpResponse,
    ScanReadResponse,
    ScanStatus,
)
from app.services.audit_repository import create_rule_execution_log
from app.services.chat_repository import create_chat_message, list_chat_messages
from app.services.scan_repository import create_scan_record, get_scan_record, update_scan_record
from app.services.storage import upload_scan_asset

router = APIRouter(prefix="/scans")


@router.post("", response_model=ScanCreateResponse)
async def create_scan(
    request: Request,
    product_prompt: Annotated[str | None, Form()] = None,
    destination_country: Annotated[str | None, Form()] = None,
    product_image: Annotated[UploadFile | None, File()] = None,
):
    scanner = request.app.state.scanner
    scan_id = str(uuid4())
    created_at = datetime.now(timezone.utc)

    image_asset = None
    image_bytes = None
    image_content_type = None
    image_filename = None
    normalized_prompt = (product_prompt or "").strip()

    if not normalized_prompt and product_image is None:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one input: product_prompt text or product_image file.",
        )

    if product_image is not None:
        image_bytes = await product_image.read()
        image_content_type = product_image.content_type
        image_filename = product_image.filename
        image_asset = await upload_scan_asset(
            supabase_client=request.app.state.supabase_client,
            bucket_name=request.app.state.settings.supabase_storage_bucket,
            scan_id=scan_id,
            filename=image_filename or "product-image",
            content=image_bytes,
            content_type=image_content_type,
        )

    scan_started = perf_counter()
    result = await scanner.analyze(
        prompt=normalized_prompt,
        destination_country=destination_country,
        image_bytes=image_bytes,
        image_content_type=image_content_type,
        image_filename=image_filename,
    )
    execution_ms = int((perf_counter() - scan_started) * 1000)

    scan_document = {
        "id": scan_id,
        "created_at": created_at,
        "updated_at": created_at,
        "prompt": normalized_prompt,
        "destination_country": destination_country,
        "image_asset": image_asset,
        "result": result.model_dump(),
    }

    await create_scan_record(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scans_table,
        scan_document,
    )

    # Audit logging should never block a valid scan response.
    try:
        await create_rule_execution_log(
            request.app.state.supabase_client,
            request.app.state.settings.supabase_rule_execution_log_table,
            {
                "scan_id": scan_id,
                "destination_country": destination_country,
                "final_status": result.status.value,
                "rule_hits": result.rule_hits,
                "required_documents": result.required_documents,
                "required_permits": result.required_permits,
                "required_agencies": result.required_agencies,
                "source": result.source,
                "execution_ms": execution_ms,
                "request_payload": {
                    "product_prompt": normalized_prompt,
                    "destination_country": destination_country,
                    "image_filename": image_filename,
                },
                "response_payload": result.model_dump(),
                "created_at": created_at,
            },
        )
    except Exception:
        pass

    return ScanCreateResponse(
        scan_id=scan_id,
        status=result.status,
        image_asset_url=image_asset,
        result=result,
    )


@router.get("/{scan_id}", response_model=ScanReadResponse)
async def read_scan(request: Request, scan_id: str):
    record = await get_scan_record(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scans_table,
        scan_id,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return ScanReadResponse.model_validate(record)


@router.get("/{scan_id}/chat", response_model=list[ScanChatMessage])
async def list_scan_chat(request: Request, scan_id: str):
    record = await get_scan_record(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scans_table,
        scan_id,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    rows = await list_chat_messages(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scan_chat_messages_table,
        scan_id,
    )
    return [ScanChatMessage.model_validate(row) for row in rows]


@router.post("/{scan_id}/follow-up", response_model=ScanFollowUpResponse)
async def continue_scan_follow_up(
    request: Request,
    scan_id: str,
    payload: Annotated[ScanFollowUpRequest, Body(...)],
):
    record = await get_scan_record(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scans_table,
        scan_id,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    scanner = request.app.state.scanner
    existing_prompt = str(record.get("prompt") or "").strip()
    follow_up_prompt = _compose_follow_up_prompt(existing_prompt=existing_prompt, user_message=payload.message)

    destination_country = payload.destination_country or record.get("destination_country")

    result = await scanner.analyze(
        prompt=follow_up_prompt,
        destination_country=destination_country,
        image_bytes=None,
        image_content_type=None,
        image_filename=None,
    )

    now = datetime.now(timezone.utc)
    await update_scan_record(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scans_table,
        scan_id,
        {
            "updated_at": now,
            "destination_country": destination_country,
            "result": result.model_dump(),
        },
    )

    # Chat persistence is best-effort so scan updates still work before migration is applied.
    await create_chat_message(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scan_chat_messages_table,
        {
            "scan_id": scan_id,
            "role": "user",
            "message": payload.message.strip(),
            "metadata": {
                "destination_country": destination_country,
            },
            "created_at": now,
            "updated_at": now,
        },
    )
    await create_chat_message(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scan_chat_messages_table,
        {
            "scan_id": scan_id,
            "role": "assistant",
            "message": result.compliance_summary or "Analysis updated.",
            "metadata": {
                "status": result.status.value,
                "follow_up_questions": result.follow_up_questions,
            },
            "created_at": now,
            "updated_at": now,
        },
    )

    rows = await list_chat_messages(
        request.app.state.supabase_client,
        request.app.state.settings.supabase_scan_chat_messages_table,
        scan_id,
    )
    return ScanFollowUpResponse(
        scan_id=scan_id,
        status=result.status,
        result=result,
        chat_messages=[ScanChatMessage.model_validate(row) for row in rows],
    )


def _compose_follow_up_prompt(*, existing_prompt: str, user_message: str) -> str:
    parts = []
    if existing_prompt:
        parts.append(existing_prompt)
    parts.append(f"Additional user information: {user_message.strip()}")
    return "\n\n".join(parts)