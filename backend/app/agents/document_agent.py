from __future__ import annotations

from app.core.config import Settings
from app.schemas.documents import CostContext, DocumentGenerationRequest, DocumentGenerationResponse, DocumentItem
from app.schemas.cost import OriginRegion, TransportMode


class DocumentAgent:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(self, payload: DocumentGenerationRequest) -> DocumentGenerationResponse:
        mode = self._normalize_mode(payload.transport_mode)
        existing_documents = self._normalize_documents(payload.existing_documents)
        required_documents = self._build_required_documents(payload, mode)

        documents: list[DocumentItem] = []
        carried_documents: list[DocumentItem] = []
        missing_documents: list[str] = []

        for document in required_documents:
            is_carried = document["label"] in existing_documents
            status = "ready" if is_carried else document["status"]
            item = DocumentItem(
                id=document["id"],
                label=document["label"],
                sublabel=document["sublabel"],
                status=status,
                required=document["required"],
            )
            documents.append(item)
            if is_carried:
                carried_documents.append(item)
            else:
                missing_documents.append(document["label"])

        workflow_steps = [
            "Confirm exporter profile and consignee details",
            "Populate the commercial invoice and packing list",
            "Attach permits, certificates, and agency references",
            "Hand off the export pack to the cost calculator",
        ]

        notes = [
            "This pack is generated from the product scan and can be reused in Agent 3.",
        ]
        if payload.hs_code:
            notes.append(f"HS code context received: {payload.hs_code}.")
        if payload.required_permits:
            notes.append("Permits were carried into the document checklist.")

        can_proceed_to_cost = len(missing_documents) == 0
        declared_value = payload.declared_value if payload.declared_value > 0 else 1000.0
        weight_kg = payload.weight_kg if payload.weight_kg > 0 else 10.0

        return DocumentGenerationResponse(
            product_name=payload.product_name,
            destination_country=payload.destination_country,
            hs_code=payload.hs_code,
            compliance_status=payload.compliance_status,
            summary=self._build_summary(payload, can_proceed_to_cost),
            documents=documents,
            carried_documents=carried_documents,
            missing_documents=missing_documents,
            required_permits=payload.required_permits,
            required_agencies=payload.required_agencies,
            workflow_steps=workflow_steps,
            can_proceed_to_cost=can_proceed_to_cost,
            cost_context=CostContext(
                product_name=payload.product_name,
                destination_country=payload.destination_country,
                origin_region=OriginRegion.west,
                transport_mode=payload.transport_mode,
                declared_value=declared_value,
                weight_kg=weight_kg,
                volumetric_weight_kg=payload.volumetric_weight_kg,
                currency=payload.currency,
                package_count=payload.package_count,
                provided_documents=[item.label for item in carried_documents],
            ),
            notes=notes,
        )

    def _normalize_mode(self, transport_mode: TransportMode) -> TransportMode:
        if transport_mode in {TransportMode.air, TransportMode.flight}:
            return TransportMode.air
        return TransportMode.sea

    def _normalize_documents(self, documents: list[str]) -> list[str]:
        return sorted({str(document).strip() for document in documents if str(document).strip()})

    def _build_required_documents(self, payload: DocumentGenerationRequest, mode: TransportMode) -> list[dict]:
        documents: list[dict] = [
            {
                "id": "commercial-invoice",
                "label": "Commercial Invoice",
                "sublabel": "Buyer, seller, value, and terms",
                "status": "missing",
                "required": True,
            },
            {
                "id": "packing-list",
                "label": "Packing List",
                "sublabel": "Weights, dimensions, and quantities",
                "status": "missing",
                "required": True,
            },
            {
                "id": "declaration-form",
                "label": "Export Declaration (K2)",
                "sublabel": "Customs export declaration",
                "status": "missing",
                "required": True,
            },
        ]

        if mode == TransportMode.sea:
            documents.append(
                {
                    "id": "sea-shipping-instructions",
                    "label": "Shipping Instruction",
                    "sublabel": "Carrier booking and routing details",
                    "status": "missing",
                    "required": True,
                }
            )
            documents.append(
                {
                    "id": "draft-bill-lading",
                    "label": "Draft Bill of Lading",
                    "sublabel": "Ocean freight documentation",
                    "status": "missing",
                    "required": True,
                }
            )
        else:
            documents.append(
                {
                    "id": "air-waybill",
                    "label": "Air Waybill Instructions",
                    "sublabel": "Air freight booking and routing details",
                    "status": "missing",
                    "required": True,
                }
            )

        for document in payload.required_documents:
            label = str(document).strip()
            if not label:
                continue
            if any(existing["label"] == label for existing in documents):
                continue
            documents.append(
                {
                    "id": self._slugify(label),
                    "label": label,
                    "sublabel": "Triggered by the product scan",
                    "status": "conditional",
                    "required": False,
                }
            )

        permit_docs = [
            {
                "id": self._slugify(permit),
                "label": permit,
                "sublabel": "Permit to be collected before shipment",
                "status": "conditional",
                "required": False,
            }
            for permit in payload.required_permits
            if str(permit).strip()
        ]

        agency_docs = [
            {
                "id": self._slugify(agency),
                "label": f"{agency} clearance note",
                "sublabel": "Agency reference to attach in the export pack",
                "status": "conditional",
                "required": False,
            }
            for agency in payload.required_agencies
            if str(agency).strip()
        ]

        return documents + permit_docs + agency_docs

    def _build_summary(self, payload: DocumentGenerationRequest, can_proceed_to_cost: bool) -> str:
        if can_proceed_to_cost:
            return (
                f"All export documents for {payload.product_name} are ready for {payload.destination_country}. "
                "Proceed to Agent 3 for landed cost and shipping estimates."
            )
        return (
            f"Document pack started for {payload.product_name}. "
            "Some items still need to be completed before Agent 3 can calculate the final cost."
        )

    def _slugify(self, value: str) -> str:
        return "-".join(part for part in "".join(ch.lower() if ch.isalnum() else " " for ch in value).split())
