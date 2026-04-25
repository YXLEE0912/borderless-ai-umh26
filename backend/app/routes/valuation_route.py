"""
app/routes/valuation_route.py
Step 6 — Financial Valuation & Landed Cost
ADDED: invoice_currency + exchange_rate (for foreign-currency invoices),
       insurance_amount_myr (explicit rather than rate-only),
       persists to session store
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

VALUATION_PATCH = """
from app.engines.validation_engine import ValidationEngine
 
@router.post("/calculate")
async def calculate_valuation(req: ValuationRequest):
 
    # ── Local validation ───────────────────────────────────────────────────
    errors = ValidationEngine.validate_valuation(
        fob_value_myr     = req.fob_value_myr,
        currency          = req.invoice_currency,
        exchange_rate     = req.exchange_rate_to_myr,
        insurance_rate    = req.insurance_rate,
        freight_quote_myr = req.freight_quote_myr,
    )
    if errors:
        raise HTTPException(status_code=422, detail=errors)
 
    # ── rest of existing code unchanged ────────────────────────────────────
    ...
"""
 

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from glmservice import get_glm

router = APIRouter(prefix="/valuation", tags=["Financial Valuation"])


class ValuationRequest(BaseModel):
    session_id: str
    fob_value_myr: float
    destination_country: str
    hs_code: Optional[str] = None
    incoterm: str = "FOB"
    freight_quote_myr: Optional[float] = None
    insurance_rate: float = 0.005            # default 0.5%
    import_duty_rate: Optional[float] = None
    # ── NEW: foreign currency support ─────────────────────────────────────────
    invoice_currency: str = "MYR"            # e.g. "USD", "EUR", "CNY"
    invoice_amount_foreign: Optional[float] = None   # value in foreign currency
    exchange_rate_to_myr: Optional[float] = None     # 1 USD = X MYR


@router.post("/calculate")
async def calculate_valuation(req: ValuationRequest):
    """
    Step 6 — Calculate full landed cost breakdown (FOB → CIF → duty → total).
    Supports foreign-currency invoices with BNM exchange rate conversion.
    Also checks FTA savings potential (ATIGA Form D, CPTPP, RCEP).
    """
    # ── Currency conversion ───────────────────────────────────────────────────
    glm = get_glm()
    exchange_rate = req.exchange_rate_to_myr or 1.0
    fx_note = ""

    if req.invoice_currency != "MYR" and req.invoice_amount_foreign:
        if not req.exchange_rate_to_myr:
            # Ask GLM for current BNM reference rate
            try:
                fx = await glm.chat_json(
                    system_prompt="""You are a Bank Negara Malaysia (BNM) FX specialist.
Return JSON: {
  "source_currency": "",
  "target_currency": "MYR",
  "rate": 0.0,
  "rate_date": "",
  "rate_source": "Bank Negara Malaysia reference rate",
  "notes": ""
}""",
                    user_message=f"Convert 1 {req.invoice_currency} to MYR. Current approximate BNM reference rate.",
                )
                exchange_rate = float(fx.get("rate", 1.0)) or 1.0
                fx_note = f"BNM reference rate: 1 {req.invoice_currency} = MYR {exchange_rate:.4f}"
            except Exception:
                exchange_rate = 1.0
                fx_note = "Exchange rate could not be fetched — using 1:1 fallback. Please provide exchange_rate_to_myr."

        # Recompute fob in MYR from foreign invoice
        fob_myr = round(req.invoice_amount_foreign * exchange_rate, 2)
    else:
        fob_myr = req.fob_value_myr

    # ── Landed cost calculation ───────────────────────────────────────────────
    freight      = req.freight_quote_myr or round(fob_myr * 0.07, 2)
    insurance    = round(fob_myr * req.insurance_rate, 2)
    cif          = round(fob_myr + freight + insurance, 2)
    duty_rate    = req.import_duty_rate if req.import_duty_rate is not None else 0.05
    duty         = round(cif * duty_rate, 2)
    total_landed = round(cif + duty, 2)

    # ── FTA savings analysis ──────────────────────────────────────────────────
    try:
        fta = await glm.chat_json(
            system_prompt="""You are a Malaysian FTA duty-savings specialist.
Evaluate ATIGA, CPTPP, RCEP, MAFTA, MJEPA.
Return JSON: {
  "atiga_applicable": false,
  "atiga_rate": 0.0,
  "atiga_savings_myr": 0,
  "cptpp_applicable": false,
  "cptpp_savings_myr": 0,
  "rcep_applicable": false,
  "rcep_savings_myr": 0,
  "best_fta": "",
  "best_fta_rate": 0.0,
  "best_savings_myr": 0,
  "form_required": "Form D|Form E|RCEP Form|None",
  "roo_met": true,
  "roo_criteria": "",
  "direct_shipment_required": true,
  "notes": ""
}""",
            user_message=(
                f"HS Code      : {req.hs_code or 'unknown'}\n"
                f"Destination  : {req.destination_country}\n"
                f"CIF value    : MYR {cif}\n"
                f"MFN duty rate: {duty_rate * 100:.1f}%\n"
                f"Duty amount  : MYR {duty}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    best_savings = fta.get("best_savings_myr", 0)
    net_landed   = round(total_landed - best_savings, 2)

    result = {
        "session_id":             req.session_id,
        "invoice_currency":       req.invoice_currency,
        "invoice_amount_foreign": req.invoice_amount_foreign,
        "exchange_rate_to_myr":   exchange_rate,
        "fx_note":                fx_note,
        "fob_myr":                fob_myr,
        "freight_myr":            freight,
        "insurance_myr":          insurance,
        "cif_myr":                cif,
        "import_duty_rate":       duty_rate,
        "estimated_duty_myr":     duty,
        "total_landed_cost_myr":  total_landed,
        "net_landed_with_fta":    net_landed,
        "fta_analysis":           fta,
        "atiga_savings_myr":      fta.get("atiga_savings_myr", 0),
        "best_fta":               fta.get("best_fta", ""),
        "best_savings_myr":       best_savings,
        "form_required":          fta.get("form_required", "None"),
        "incoterm":               req.incoterm,
        "is_final":               False,
        "note": "Duty rate is an estimate. Finalises once HS classification and FTA eligibility are confirmed.",
    }

    # Persist to session
    try:
        from main import _sessions
        if req.session_id in _sessions:
            _sessions[req.session_id]["checklist"]["financial_valuation"] = result
            _sessions[req.session_id]["landed_cost"] = result
            _sessions[req.session_id]["current_step"] = max(
                _sessions[req.session_id].get("current_step", 1), 7
            )
            _sessions[req.session_id]["progress"] = max(
                _sessions[req.session_id].get("progress", 0), 66
            )
    except ImportError:
        pass

    return result