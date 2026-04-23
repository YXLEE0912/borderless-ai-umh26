from enum import Enum
from datetime import datetime

from pydantic import BaseModel, Field


class ScanStatus(str, Enum):
    green = "green"
    conditional = "conditional"
    restricted = "restricted"
    review = "review"


class ChatMessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class ScanResult(BaseModel):
    product_name: str = ""
    materials_detected: list[str] = Field(default_factory=list)
    hs_code_candidates: list[str] = Field(default_factory=list)
    hs_code_confidence: float = 0.0
    hs_code_reasoning: str = ""
    status: ScanStatus = ScanStatus.review
    compliance_summary: str = ""
    ssm_check: str = "unknown"
    required_documents: list[str] = Field(default_factory=list)
    required_permits: list[str] = Field(default_factory=list)
    required_agencies: list[str] = Field(default_factory=list)
    logistics_extractions: dict[str, str] = Field(default_factory=dict)
    logistics_sea_flow: list[str] = Field(default_factory=list)
    logistics_sea_required_documents: list[str] = Field(default_factory=list)
    rule_hits: list[str] = Field(default_factory=list)
    extraction_notes: list[str] = Field(default_factory=list)
    decision_steps: list[dict[str, str]] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    source: str = "fallback"


class ScanCreateResponse(BaseModel):
    scan_id: str
    status: ScanStatus
    image_asset_url: str | None = None
    tts_audio_url: str | None = None
    result: ScanResult


class ScanReadResponse(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    prompt: str
    destination_country: str | None = None
    merchant_name: str | None = None
    merchant_ssm: str | None = None
    image_asset: str | None = None
    result: ScanResult


class ScanFollowUpRequest(BaseModel):
    message: str = Field(min_length=1, max_length=3000)
    destination_country: str | None = None
    merchant_name: str | None = None
    merchant_ssm: str | None = None


class ScanChatMessage(BaseModel):
    id: str | None = None
    scan_id: str
    role: ChatMessageRole
    message: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class ScanFollowUpResponse(BaseModel):
    scan_id: str
    status: ScanStatus
    result: ScanResult
    chat_messages: list[ScanChatMessage] = Field(default_factory=list)