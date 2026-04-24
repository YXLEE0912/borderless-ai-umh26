from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.agent_runtime import configure_runtime_state
from app.api.router import api_router
from app.core.config import get_settings


class AccessLogProbeFilter(logging.Filter):
    """Hide noisy hidden-dot probe requests from uvicorn access logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = getattr(record, "args", ())
        if len(args) >= 3:
            method = str(args[1])
            path = str(args[2])
            if method == "HEAD" and path.startswith("/."):
                return False
        return True


def _configure_access_log_filter() -> None:
    logger = logging.getLogger("uvicorn.access")
    if any(isinstance(log_filter, AccessLogProbeFilter) for log_filter in logger.filters):
        return
    logger.addFilter(AccessLogProbeFilter())


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_runtime_state(app, settings)

    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    favicon_path = Path(__file__).resolve().parents[2] / "frontend" / "public" / "favicon.ico"

    _configure_access_log_filter()

    configure_runtime_state(app, settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.middleware("http")
    async def block_hidden_probe_paths(request: Request, call_next):
        # Common internet probes hit hidden dot-paths; return fast 404.
        if request.url.path.startswith("/."):
            return Response(status_code=404)
        return await call_next(request)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "status": "running",
            "health": f"{settings.api_prefix}/health",
        }

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon() -> Response:
        if favicon_path.exists():
            return FileResponse(favicon_path)
        return Response(status_code=204)

    return app


app = create_app()