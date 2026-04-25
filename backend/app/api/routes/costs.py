from typing import Annotated

from fastapi import APIRouter, Body, Request

from app.schemas.cost import CostQuoteRequest, CostQuoteResponse

router = APIRouter(prefix="/costs")


@router.post("/quote", response_model=CostQuoteResponse)
async def quote_costs(request: Request, payload: Annotated[CostQuoteRequest, Body(...)]) -> CostQuoteResponse:
    cost_agent = request.app.state.cost_agent
    return await cost_agent.quote(payload)