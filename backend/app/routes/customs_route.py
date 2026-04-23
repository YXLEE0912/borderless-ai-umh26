from fastapi import APIRouter
from app.models.customs import CustomsRequest
from app.services.customs_service import submit

router = APIRouter()

@router.post("/customs")
async def customs(req: CustomsRequest):
    return await submit(req)