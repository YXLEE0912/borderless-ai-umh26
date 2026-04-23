from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import (
    consignee_route,
    hs_route,
    permit_route,
    valuation_route,
    logistics_route,
    document_route,
    customs_route,
)

app = FastAPI(title="Borderless AI Trade Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(consignee_route.router, prefix="/api")
app.include_router(hs_route.router, prefix="/api")
app.include_router(permit_route.router, prefix="/api")
app.include_router(valuation_route.router, prefix="/api")
app.include_router(logistics_route.router, prefix="/api")
app.include_router(document_route.router, prefix="/api")
app.include_router(customs_route.router, prefix="/api")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import (
    consignee_route,
    hs_route,
    permit_route,
    valuation_route,
    logistics_route,
    document_route,
    customs_route
)

app = FastAPI(title="Borderless AI Trade Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(consignee_route.router, prefix="/api")
app.include_router(hs_route.router, prefix="/api")
app.include_router(permit_route.router, prefix="/api")
app.include_router(valuation_route.router, prefix="/api")
app.include_router(logistics_route.router, prefix="/api")
app.include_router(document_route.router, prefix="/api")
app.include_router(customs_route.router, prefix="/api")