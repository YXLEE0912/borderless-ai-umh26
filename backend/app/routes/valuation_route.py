from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/valuation", tags=["Financial Valuation"])

# ── Models ────────────────────────────────────────────────────────────────────

class ValuationRequest(BaseModel):
    session_id: str
    fob_value_myr: float
    destination_country: str
    hs_code: Optional[str] = None
    incoterm: str = "FOB"
    freight_quote_myr: Optional[float] = None
    insurance_rate: float = 0.005
    import_duty_rate: Optional[float] = None

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/calculate")
async def calculate_valuation(req: ValuationRequest):
    """
    Step 6 — Calculate full landed cost breakdown (FOB → CIF → duty → total).
    Also checks FTA savings potential (ATIGA Form D, CPTPP, RCEP).
    """
    # Deterministic cost calc
    freight      = req.freight_quote_myr or round(req.fob_value_myr * 0.07, 2)
    insurance    = round(req.fob_value_myr * req.insurance_rate, 2)
    cif          = round(req.fob_value_myr + freight + insurance, 2)
    duty_rate    = req.import_duty_rate if req.import_duty_rate is not None else 0.05
    duty         = round(cif * duty_rate, 2)
    total_landed = round(cif + duty, 2)

    try:
        glm = get_glm()
        fta = await glm.chat_json(
            system_prompt="""You are a Malaysian FTA duty-savings specialist.
Evaluate ATIGA, CPTPP, RCEP, and bilateral FTAs.
Return JSON: {
  "atiga_applicable": false,
  "atiga_savings_myr": 0,
  "cptpp_applicable": false,
  "cptpp_savings_myr": 0,
  "rcep_applicable": false,
  "rcep_savings_myr": 0,
  "best_fta": "",
  "best_savings_myr": 0,
  "form_required": "Form D|Form E|RCEP Form|None",
  "roo_met": true,
  "notes": ""
}""",
            user_message=(
                f"HS Code: {req.hs_code or 'unknown'}\n"
                f"Destination: {req.destination_country}\n"
                f"CIF: MYR {cif}\n"
                f"MFN duty rate: {duty_rate * 100:.1f}%"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "session_id":            req.session_id,
        "fob_myr":               req.fob_value_myr,
        "freight_myr":           freight,
        "insurance_myr":         insurance,
        "cif_myr":               cif,
        "import_duty_rate":      duty_rate,
        "estimated_duty_myr":    duty,
        "total_landed_cost_myr": total_landed,
        "fta_analysis":          fta,
        "atiga_savings_myr":     fta.get("atiga_savings_myr", 0),
        "best_fta":              fta.get("best_fta", ""),
        "best_savings_myr":      fta.get("best_savings_myr", 0),
        "is_final":              False,
        "note":                  "Duty rate updates automatically once HS classification is complete.",
    }