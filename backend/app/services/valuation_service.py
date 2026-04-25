"""
Valuation Service — Step 6
Calculates full landed cost breakdown and FTA duty savings.
FOB → CIF → Duty → Total Landed Cost
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from typing import Dict, Any, Optional
from glmservice import GLMService


FTA_SYSTEM = """You are a Malaysian FTA duty-savings specialist with expertise in:
- ASEAN Free Trade Area (ATIGA) — Form D
- Comprehensive and Progressive Agreement for Trans-Pacific Partnership (CPTPP)
- Regional Comprehensive Economic Partnership (RCEP)
- Malaysia-Australia FTA (MAFTA)
- Malaysia-Japan Economic Partnership Agreement (MJEPA)
- Malaysia-Pakistan Closer Economic Partnership (MPCEPA)

Return JSON:
{
  "atiga_applicable": false,
  "atiga_rate": 0.0,
  "atiga_savings_myr": 0,
  "cptpp_applicable": false,
  "cptpp_rate": 0.0,
  "cptpp_savings_myr": 0,
  "rcep_applicable": false,
  "rcep_rate": 0.0,
  "rcep_savings_myr": 0,
  "mafta_applicable": false,
  "mafta_savings_myr": 0,
  "best_fta": "",
  "best_fta_rate": 0.0,
  "best_savings_myr": 0,
  "form_required": "Form D|Form E|RCEP Form|None",
  "roo_met": true,
  "roo_criteria": "",
  "direct_shipment_required": true,
  "notes": ""
}"""

FX_SYSTEM = """You are a Bank Negara Malaysia (BNM) foreign exchange specialist.
Provide the MYR exchange rate and convert the given amount.
Return JSON:
{
  "source_currency": "",
  "target_currency": "MYR",
  "rate": 0.0,
  "source_amount": 0,
  "myr_amount": 0,
  "rate_date": "",
  "rate_source": "Bank Negara Malaysia reference rate",
  "notes": ""
}"""


class ValuationService:
    def __init__(self, glm: GLMService):
        self.glm = glm

    async def calculate(
        self,
        session_id: str,
        fob_value_myr: float,
        destination_country: str,
        hs_code: Optional[str] = None,
        incoterm: str = "FOB",
        freight_quote_myr: Optional[float] = None,
        insurance_rate: float = 0.005,
        import_duty_rate: Optional[float] = None,
    ) -> Dict[str, Any]:
        freight      = freight_quote_myr or round(fob_value_myr * 0.07, 2)
        insurance    = round(fob_value_myr * insurance_rate, 2)
        cif          = round(fob_value_myr + freight + insurance, 2)
        duty_rate    = import_duty_rate if import_duty_rate is not None else 0.05
        duty         = round(cif * duty_rate, 2)
        total_landed = round(cif + duty, 2)

        fta = await self.glm.chat_json(
            FTA_SYSTEM,
            (
                f"HS Code     : {hs_code or 'unknown'}\n"
                f"Destination : {destination_country}\n"
                f"CIF value   : MYR {cif}\n"
                f"MFN duty    : {duty_rate * 100:.1f}%\n"
                f"Duty amount : MYR {duty}"
            ),
        )

        best_savings = fta.get("best_savings_myr", 0)
        net_landed   = round(total_landed - best_savings, 2)

        return {
            "session_id":            session_id,
            "fob_myr":               fob_value_myr,
            "freight_myr":           freight,
            "insurance_myr":         insurance,
            "cif_myr":               cif,
            "import_duty_rate":      duty_rate,
            "estimated_duty_myr":    duty,
            "total_landed_cost_myr": total_landed,
            "net_landed_with_fta":   net_landed,
            "fta_analysis":          fta,
            "atiga_savings_myr":     fta.get("atiga_savings_myr", 0),
            "best_fta":              fta.get("best_fta", ""),
            "best_savings_myr":      best_savings,
            "form_required":         fta.get("form_required", "None"),
            "incoterm":              incoterm,
            "is_final":              False,
            "note": (
                "Duty rate is an estimate. It finalises once HS classification "
                "and FTA form eligibility are confirmed."
            ),
        }

    async def convert_currency(
        self,
        amount: float,
        from_currency: str,
        to_currency: str = "MYR",
    ) -> Dict[str, Any]:
        return await self.glm.chat_json(
            FX_SYSTEM,
            (
                f"Amount        : {amount}\n"
                f"From currency : {from_currency}\n"
                f"To currency   : {to_currency}"
            ),
        )

    async def get_freight_estimate(
        self,
        mode: str,
        port_of_loading: str,
        port_of_discharge: str,
        weight_kg: float,
        cbm: float,
    ) -> Dict[str, Any]:
        system = """You are a Malaysian freight pricing specialist.
Return JSON: {
  "estimated_freight_myr": 0,
  "estimated_freight_usd": 0,
  "basis": "W/M|Weight|CBM",
  "chargeable_weight_kg": 0,
  "rate_per_unit_usd": 0,
  "surcharges": [{"name": "", "amount_usd": 0}],
  "total_with_surcharges_myr": 0,
  "shipping_lines": [],
  "transit_days": 0,
  "confidence": "estimate|indicative|firm",
  "notes": ""
}"""
        return await self.glm.chat_json(
            system,
            (
                f"Mode              : {mode}\n"
                f"Port of loading   : {port_of_loading}\n"
                f"Port of discharge : {port_of_discharge}\n"
                f"Gross weight      : {weight_kg} kg\n"
                f"CBM               : {cbm}"
            ),
        )

    async def breakdown_for_k2(
        self,
        fob_myr: float,
        cif_myr: float,
        duty_myr: float,
        currency: str = "MYR",
        exchange_rate: float = 1.0,
    ) -> Dict[str, Any]:
        system = """You are a Malaysian Customs valuation specialist (Customs Act 1967, Section 14).
Return JSON: {
  "customs_value_method": "Transaction Value (Method 1)",
  "statistical_value_myr": 0,
  "fob_value_myr": 0,
  "cif_value_myr": 0,
  "export_duty_myr": 0,
  "currency_code": "",
  "exchange_rate_to_myr": 0,
  "valuation_date": "",
  "declaration_statement": "",
  "customs_act_reference": "Section 14, Customs Act 1967"
}"""
        return await self.glm.chat_json(
            system,
            (
                f"FOB value MYR    : {fob_myr}\n"
                f"CIF value MYR    : {cif_myr}\n"
                f"Export duty MYR  : {duty_myr}\n"
                f"Invoice currency : {currency}\n"
                f"Exchange rate    : {exchange_rate}"
            ),
        )