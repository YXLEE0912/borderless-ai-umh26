from fastapi import APIRouter

from app.api.routes.documents import router as documents_router
from app.api.routes.health import router as health_router
from app.api.routes.costs import router as costs_router
from app.api.routes.scans import router as scans_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(costs_router, tags=["costs"])
api_router.include_router(scans_router, tags=["scans"])