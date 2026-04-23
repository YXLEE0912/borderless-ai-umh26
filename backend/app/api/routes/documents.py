from typing import Annotated

from fastapi import APIRouter, Body, Request

from app.schemas.documents import DocumentGenerationRequest, DocumentGenerationResponse

router = APIRouter(prefix="/documents")


@router.post("/generate", response_model=DocumentGenerationResponse)
async def generate_documents(
    request: Request,
    payload: Annotated[DocumentGenerationRequest, Body(...)],
) -> DocumentGenerationResponse:
    document_agent = request.app.state.document_agent
    return await document_agent.generate(payload)