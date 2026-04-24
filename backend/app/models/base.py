"""
models/base.py
Shared primitive models and enums used across all workflow steps.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# ENUMS / LITERALS
# ─────────────────────────────────────────────────────────────────────────────

StepStatus   = Literal["pending", "in_progress", "complete", "failed"]
RiskLevel    = Literal["low", "medium", "high"]
DocStatus    = Literal["locked", "required", "ready", "generated", "submitted"]
TradeMode    = Literal["SEA", "AIR", "ROAD", "RAIL"]
IncotermType = Literal["EXW", "FCA", "FAS", "FOB", "CFR", "CIF",
                        "CPT", "CIP", "DAP", "DPU", "DDP"]


# ─────────────────────────────────────────────────────────────────────────────
# CHAT
# ─────────────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    ts: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="ISO 8601 timestamp",
    )


class ChatRequest(BaseModel):
    session_id: str
    message: str
    stream: bool = False


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    stream: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# SESSION
# ─────────────────────────────────────────────────────────────────────────────

class ExportSession(BaseModel):
    session_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    current_step: int = 1
    progress: int = 0              # 0–100 %
    chat_history: List[Dict[str, str]] = Field(default_factory=list)
    checklist: Dict[str, Any] = Field(default_factory=dict)
    documents: Dict[str, Any] = Field(default_factory=dict)
    landed_cost: Optional[Dict[str, Any]] = None


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT STATUS
# ─────────────────────────────────────────────────────────────────────────────

class DocumentStatusItem(BaseModel):
    name: str
    status: DocStatus
    steps_remaining: int = 0
    locked: bool = True


class DocumentStatusResponse(BaseModel):
    session_id: str
    documents: List[DocumentStatusItem]


# ─────────────────────────────────────────────────────────────────────────────
# TRADE DOCUMENT (generated output)
# ─────────────────────────────────────────────────────────────────────────────

class TradeDoc(BaseModel):
    doc_type: str
    content: Dict[str, Any]
    generated_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
    )
    status: Literal["draft", "signed", "submitted"] = "draft"


# ─────────────────────────────────────────────────────────────────────────────
# CHECKLIST ITEM
# ─────────────────────────────────────────────────────────────────────────────

class ChecklistItem(BaseModel):
    step: int
    label: str
    status: StepStatus = "pending"
    data: Optional[Dict[str, Any]] = None


class ChecklistResponse(BaseModel):
    session_id: str
    current_step: int
    progress: int
    items: List[ChecklistItem]