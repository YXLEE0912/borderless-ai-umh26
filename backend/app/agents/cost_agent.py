from __future__ import annotations

from app.core.config import Settings
from app.schemas.cost import CostQuoteRequest, CostQuoteResponse, TransportMode


class CostAgent:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def quote(self, payload: CostQuoteRequest) -> CostQuoteResponse:
        mode = self._normalize_mode(payload.transport_mode)
        billable_weight = max(payload.weight_kg, payload.volumetric_weight_kg or payload.weight_kg)

        rate_per_kg = 7.5 if mode == "air" else 2.2
        minimum_shipping = 28.0 if mode == "air" else 55.0
        shipping_fee = round(max(minimum_shipping, billable_weight * rate_per_kg) * payload.package_count, 2)

        insurance_fee = round(payload.declared_value * payload.insurance_rate, 2)
        customs_duty = round(payload.declared_value * payload.duty_rate, 2)
        import_tax_base = payload.declared_value + shipping_fee + insurance_fee + customs_duty
        import_tax = round(import_tax_base * payload.tax_rate, 2)

        required_documents = self._required_documents(mode)
        normalized_provided = self._normalize_documents(payload.provided_documents)
        missing_documents = [doc for doc in required_documents if doc not in normalized_provided]
        documents_ready = len(missing_documents) == 0

        notes = [
            "Estimated values only. Confirm final customs and carrier charges before booking.",
        ]
        if self.settings.umh_3_api_key:
            notes.append("UMH_3_API_KEY is configured for Agent 3.")
        if mode == "air":
            notes.append("Air freight estimates use a higher per-kilogram rate and lower minimum charge.")
        else:
            notes.append("Sea freight estimates use a lower per-kilogram rate and higher port handling cost.")

        estimated_total_cost = round(
            shipping_fee
            + insurance_fee
            + customs_duty
            + import_tax
            + payload.documentation_fee
            + payload.customs_broker_fee
            + payload.port_handling_fee,
            2,
        )

        return CostQuoteResponse(
            product_name=payload.product_name,
            destination_country=payload.destination_country,
            transport_mode=mode,
            currency=payload.currency,
            billable_weight_kg=round(billable_weight, 2),
            shipping_fee=shipping_fee,
            insurance_fee=insurance_fee,
            customs_duty=customs_duty,
            import_tax=import_tax,
            documentation_fee=round(payload.documentation_fee, 2),
            customs_broker_fee=round(payload.customs_broker_fee, 2),
            port_handling_fee=round(payload.port_handling_fee, 2),
            estimated_total_cost=estimated_total_cost,
            required_documents=required_documents,
            missing_documents=missing_documents,
            documents_ready=documents_ready,
            notes=notes,
            export_pack={
                "stage": "agent_3",
                "ready_to_proceed": documents_ready,
                "shipping_mode": mode,
                "document_count": int(len(normalized_provided)),
                "missing_document_count": int(len(missing_documents)),
            },
        )

    def _normalize_mode(self, transport_mode: TransportMode) -> str:
        if transport_mode in {TransportMode.sea, TransportMode.ship}:
            return "sea"
        return "air"

    def _required_documents(self, mode: str) -> list[str]:
        common_documents = ["Commercial invoice", "Packing list"]
        if mode == "sea":
            return common_documents + ["Export declaration (K2)", "Shipping instruction", "Draft bill of lading"]
        return common_documents + ["Air waybill instructions", "HS code sheet"]

    def _normalize_documents(self, documents: list[str]) -> list[str]:
        return sorted({str(document).strip() for document in documents if str(document).strip()})
