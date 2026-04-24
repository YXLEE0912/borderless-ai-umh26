from typing import Annotated

from fastapi import APIRouter, Body, File, Form, HTTPException, Request, UploadFile

from app.schemas.cost import CostQuoteRequest, OriginRegion, TransportMode
from app.schemas.documents import (
    DocumentExtractionAndQuoteResponse,
    DocumentGenerationRequest,
    DocumentGenerationResponse,
    DocumentExtractionResponse,
)
from app.services.document_extractor import DocumentExtractor

router = APIRouter(prefix="/documents")


@router.post("/generate", response_model=DocumentGenerationResponse)
async def generate_documents(
    request: Request,
    payload: Annotated[DocumentGenerationRequest, Body(...)],
) -> DocumentGenerationResponse:
    document_agent = request.app.state.document_agent
    return await document_agent.generate(payload)


@router.post("/extract", response_model=DocumentExtractionResponse)
async def extract_document_fields(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    document_label: Annotated[str | None, Form()] = None,
) -> DocumentExtractionResponse:
    settings = request.app.state.settings
    content = await file.read()

    extractor = DocumentExtractor(
        zai_client=request.app.state.scanner.zai_client,
        has_zai_key=bool(settings.z_ai_api_key),
        google_cloud_api_key=settings.google_cloud_api_key,
        openai_api_key=settings.openai_api_key,
        openai_model=settings.openai_model,
    )
    response = await extractor.extract(
        file_name=file.filename or (document_label or "uploaded-document"),
        mime_type=file.content_type,
        content=content,
    )
    if document_label:
        response.notes.append(f"Document label: {document_label}")
    return response


@router.post("/extract-and-quote", response_model=DocumentExtractionAndQuoteResponse)
async def extract_and_quote_document(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    document_label: Annotated[str | None, Form()] = None,
    transport_mode: Annotated[str | None, Form()] = None,
    currency: Annotated[str | None, Form()] = None,
    package_count: Annotated[int | None, Form()] = None,
    destination_country: Annotated[str | None, Form()] = None,
    destination_address: Annotated[str | None, Form()] = None,
    product_name: Annotated[str | None, Form()] = None,
    origin_region: Annotated[str | None, Form()] = None,
    weight_kg: Annotated[float | None, Form()] = None,
    declared_value: Annotated[float | None, Form()] = None,
) -> DocumentExtractionAndQuoteResponse:
    settings = request.app.state.settings
    content = await file.read()

    extractor = DocumentExtractor(
        zai_client=request.app.state.scanner.zai_client,
        has_zai_key=bool(settings.z_ai_api_key),
        google_cloud_api_key=settings.google_cloud_api_key,
        openai_api_key=settings.openai_api_key,
        openai_model=settings.openai_model,
    )
    extraction = await extractor.extract(
        file_name=file.filename or (document_label or "uploaded-document"),
        mime_type=file.content_type,
        content=content,
    )
    if document_label:
        extraction.notes.append(f"Document label: {document_label}")

    extracted = extraction.data

    normalized_product = (product_name or extracted.product_name or "").strip()
    normalized_destination = (destination_country or extracted.destination_country or destination_address or extracted.destination_address or "").strip()

    if not normalized_product:
        raise HTTPException(status_code=422, detail="Missing product_name in uploaded document extraction.")
    if not normalized_destination:
        raise HTTPException(status_code=422, detail="Missing destination_country/destination_address in uploaded document extraction.")

    try:
        normalized_origin = OriginRegion(origin_region) if origin_region else (extracted.origin_region or OriginRegion.west)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="origin_region must be 'west' or 'east'.") from error

    try:
        normalized_mode = TransportMode(transport_mode) if transport_mode else TransportMode.air
    except ValueError as error:
        raise HTTPException(status_code=422, detail="transport_mode must be one of: air, sea, flight, ship.") from error

    normalized_weight = weight_kg if weight_kg is not None else extracted.weight_kg
    if normalized_weight is None or normalized_weight <= 0:
        raise HTTPException(status_code=422, detail="Missing weight_kg in uploaded document extraction.")

    normalized_declared_value = declared_value if declared_value is not None else extracted.declared_value
    if (normalized_declared_value is None or normalized_declared_value <= 0) and extracted.quantity and extracted.quantity > 0 and extracted.unit_price and extracted.unit_price > 0:
        normalized_declared_value = round(extracted.quantity * extracted.unit_price, 2)
    if normalized_declared_value is None or normalized_declared_value <= 0:
        raise HTTPException(status_code=422, detail="Missing declared_value (or quantity x unit_price) in uploaded document extraction.")

    normalized_currency = (currency or "MYR").strip().upper() or "MYR"
    normalized_package_count = package_count if package_count and package_count > 0 else 1

    normalized_request = CostQuoteRequest(
        product_name=normalized_product,
        destination_country=normalized_destination,
        origin_region=normalized_origin,
        transport_mode=normalized_mode,
        declared_value=normalized_declared_value,
        weight_kg=normalized_weight,
        currency=normalized_currency,
        package_count=normalized_package_count,
        provided_documents=[document_label] if document_label else [],
    )

    cost_agent = request.app.state.cost_agent
    quote = await cost_agent.quote(normalized_request)

    return DocumentExtractionAndQuoteResponse(
        extraction=extraction,
        normalized_quote_request=normalized_request,
        quote=quote,
    )