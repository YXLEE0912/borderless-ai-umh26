from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.agent_runtime import configure_runtime_state
from app.api.router import api_router
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_runtime_state(app, settings)

    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    configure_runtime_state(app, settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "status": "running",
            "health": f"{settings.api_prefix}/health",
        }

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon() -> Response:
        return Response(status_code=204)

    return app


app = create_app()