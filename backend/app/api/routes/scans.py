from datetime import datetime, timezone
from time import perf_counter
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.schemas.scan import ScanCreateResponse, ScanReadResponse, ScanStatus
from app.services.audit_repository import create_rule_execution_log
from app.services.scan_repository import create_scan_record, get_scan_record
from app.services.storage import upload_scan_asset

router = APIRouter(prefix="/scans")


@router.post("", response_model=ScanCreateResponse)
async def create_scan(
    request: Request,
    product_prompt: Annotated[str, Form(...)],
    destination_country: Annotated[str | None, Form()] = None,
    merchant_name: Annotated[str | None, Form()] = None,
    merchant_ssm: Annotated[str | None, Form()] = None,
    product_image: Annotated[UploadFile | None, File()] = None,
):
    scanner = request.app.state.scanner
    scan_id = str(uuid4())
    created_at = datetime.now(timezone.utc)

    image_asset = None
    image_bytes = None
    image_content_type = None
    image_filename = None

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
        prompt=product_prompt,
        destination_country=destination_country,
        image_bytes=image_bytes,
        image_content_type=image_content_type,
        image_filename=image_filename,
        merchant_name=merchant_name,
        merchant_ssm=merchant_ssm,
    )
    execution_ms = int((perf_counter() - scan_started) * 1000)

    scan_document = {
        "id": scan_id,
        "created_at": created_at,
        "updated_at": created_at,
        "prompt": product_prompt,
        "destination_country": destination_country,
        "merchant_name": merchant_name,
        "merchant_ssm": merchant_ssm,
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
                "ssm_check": result.ssm_check,
                "source": result.source,
                "execution_ms": execution_ms,
                "request_payload": {
                    "product_prompt": product_prompt,
                    "destination_country": destination_country,
                    "merchant_name": merchant_name,
                    "merchant_ssm": merchant_ssm,
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