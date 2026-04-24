from typing import Annotated

from fastapi import APIRouter, Body, File, Form, Request, UploadFile

from app.schemas.documents import DocumentGenerationRequest, DocumentGenerationResponse, DocumentExtractionResponse
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
    )
    response = await extractor.extract(
        file_name=file.filename or (document_label or "uploaded-document"),
        mime_type=file.content_type,
        content=content,
    )
    if document_label:
        response.notes.append(f"Document label: {document_label}")
    return response