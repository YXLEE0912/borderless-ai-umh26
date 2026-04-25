from fastapi import FastAPI

from app.agents.document_agent import DocumentAgent
from app.agents.cost_agent import CostAgent
from app.core.config import Settings
from app.core.supabase import build_supabase_client
from app.services.scanner import ProductScanner


def configure_runtime_state(app: FastAPI, settings: Settings) -> None:
    supabase_client = build_supabase_client(settings)
    scanner = ProductScanner(settings=settings, supabase_client=supabase_client)
    document_agent = DocumentAgent(settings=settings)
    cost_agent = CostAgent(settings=settings)

    app.state.settings = settings
    app.state.supabase_client = supabase_client
    app.state.scanner = scanner
    app.state.document_agent = document_agent
    app.state.cost_agent = cost_agent