from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agent2.glm_core import GLMArchitectCore
from agent2.glm_workflow import GLMWorkflowEngine
from live_agent_intelligence.live_agent_intelligence import LiveAgentIntelligence


class ProcessRequest(BaseModel):
    raw_input: str = Field(..., min_length=1)
    source_type: str = "message"
    source_meta: dict = Field(default_factory=dict)


app = FastAPI(title="Borderless Agent2 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_glm = GLMArchitectCore(language_mode="manglish", persona_mode="expert")
_researcher = LiveAgentIntelligence(glm=_glm)
_engine = GLMWorkflowEngine(glm=_glm, policy_researcher=_researcher)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "agent2", "version": "1.0.0"}


@app.post("/api/agent2/process")
def process(req: ProcessRequest) -> dict:
    out = _engine.process_unstructured_input(
        raw_input=req.raw_input,
        source_type=req.source_type,
        source_meta=req.source_meta,
    )
    return {
        "ok": out.ok,
        "message": out.message,
        "state": out.state,
        "actions": out.actions,
        "checklist": out.checklist,
    }
