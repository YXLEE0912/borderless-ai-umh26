from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.supabase import build_supabase_client
from app.services.scanner import ProductScanner


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    supabase_client = build_supabase_client(settings)
    scanner = ProductScanner(settings=settings, supabase_client=supabase_client)

    app.state.settings = settings
    app.state.supabase_client = supabase_client
    app.state.scanner = scanner

    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()