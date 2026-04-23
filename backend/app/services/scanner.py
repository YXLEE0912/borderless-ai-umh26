from __future__ import annotations

import json
import re

import httpx

from app.core.config import Settings
from app.schemas.scan import ScanResult, ScanStatus
from app.services.rules_engine import apply_rules
from app.services.rules_repository import RulesRepository
from app.services.zai_client import ZAIClient


class ProductScanner:
    def __init__(self, settings: Settings, supabase_client=None):
        self.settings = settings
        self.supabase_client = supabase_client
        self.zai_client = ZAIClient(
            api_key=settings.z_ai_api_key,
            base_url=settings.z_ai_base_url,
            model=settings.z_ai_model,
        )
        self.rules_repository = RulesRepository(settings=settings, supabase_client=supabase_client)

    async def analyze(
        self,
        prompt: str,
        destination_country: str | None = None,
        image_bytes: bytes | None = None,
        image_content_type: str | None = None,
        image_filename: str | None = None,
        merchant_name: str | None = None,
        merchant_ssm: str | None = None,
    ) -> ScanResult:
        base_result: ScanResult
        if self.settings.z_ai_api_key:
            try:
                raw_result = await self.zai_client.analyze(
                    prompt=prompt,
                    destination_country=destination_country,
                    image_bytes=image_bytes,
                    image_content_type=image_content_type,
                    image_filename=image_filename,
                    merchant_name=merchant_name,
                    merchant_ssm=merchant_ssm,
                )
                parsed = _parse_model_result(raw_result)
                base_result = _normalize_result(parsed, source="z-ai")
            except httpx.HTTPStatusError as error:
                base_result = _fallback_result(prompt=prompt)
                response_text = (error.response.text or "").strip()
                if response_text:
                    response_text = response_text[:240]
                base_result.extraction_notes.append(
                    f"Z.ai request failed: {error.response.status_code} {response_text or 'no response body'}"
                )
            except Exception as error:
                base_result = _fallback_result(prompt=prompt)
                base_result.extraction_notes.append(
                    f"Z.ai request failed, fallback mode used: {error.__class__.__name__}"
                )
        else:
            base_result = _fallback_result(prompt=prompt)

        rules_bundle = await self.rules_repository.get_active_rules_bundle()

        return apply_rules(
            result=base_result,
            prompt=prompt,
            destination_country=destination_country,
            merchant_ssm=merchant_ssm,
            rules_bundle=rules_bundle,
        )


def _parse_model_result(raw_result: str) -> dict:
    cleaned = raw_result.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        parsed = {
            "product_name": cleaned[:120],
            "compliance_summary": cleaned,
        }
    if not isinstance(parsed, dict):
        return {"compliance_summary": cleaned}
    return parsed


def _normalize_result(data: dict, source: str) -> ScanResult:
    status_value = str(data.get("status", ScanStatus.review.value)).lower()
    status = ScanStatus.review
    if status_value in {"green", "conditional", "restricted", "review"}:
        status = ScanStatus(status_value)

    return ScanResult(
        product_name=str(data.get("product_name", "")).strip(),
        materials_detected=[str(item) for item in data.get("materials_detected", []) if str(item).strip()],
        hs_code_candidates=[str(item) for item in data.get("hs_code_candidates", []) if str(item).strip()],
        hs_code_confidence=float(data.get("hs_code_confidence", 0.0) or 0.0),
        status=status,
        compliance_summary=str(data.get("compliance_summary", "")).strip(),
        ssm_check=str(data.get("ssm_check", "unknown")).strip() or "unknown",
        required_documents=[str(item) for item in data.get("required_documents", []) if str(item).strip()],
        required_permits=[str(item) for item in data.get("required_permits", []) if str(item).strip()],
        required_agencies=[str(item) for item in data.get("required_agencies", []) if str(item).strip()],
        logistics_extractions={
            str(k): str(v) for k, v in dict(data.get("logistics_extractions", {})).items() if str(k).strip()
        },
        logistics_sea_flow=[str(item) for item in data.get("logistics_sea_flow", []) if str(item).strip()],
        logistics_sea_required_documents=[
            str(item) for item in data.get("logistics_sea_required_documents", []) if str(item).strip()
        ],
        rule_hits=[str(item) for item in data.get("rule_hits", []) if str(item).strip()],
        extraction_notes=_normalize_string_list(data.get("extraction_notes", [])),
        source=source,
    )


def _fallback_result(prompt: str) -> ScanResult:
    text = prompt.lower()
    restricted_keywords = ["weapon", "gun", "explosive", "drug", "narcotic", "poison"]
    conditional_keywords = ["animal", "plant", "food", "wildlife", "meat", "seed", "fish"]

    if any(keyword in text for keyword in restricted_keywords):
        status = ScanStatus.restricted
        summary = "The product appears to fall into a restricted export category and should be blocked until reviewed."
        permits: list[str] = []
        documents: list[str] = []
        agencies: list[str] = ["Royal Malaysian Customs Department"]
    elif any(keyword in text for keyword in conditional_keywords):
        status = ScanStatus.conditional
        summary = "The product may be exportable, but it likely needs a permit, inspection, or agency clearance."
        permits = ["Export permit"]
        documents = ["Commercial invoice", "Packing list", "Supporting certificate"]
        agencies = ["MAQIS", "Royal Malaysian Customs Department"]
    else:
        status = ScanStatus.green
        summary = "No obvious restriction was detected from the prompt, but HS and compliance review should still be confirmed."
        permits = []
        documents = ["Commercial invoice", "Packing list"]
        agencies = ["Royal Malaysian Customs Department"]

    return ScanResult(
        product_name=prompt[:120],
        materials_detected=_detect_materials(prompt),
        hs_code_candidates=[],
        hs_code_confidence=0.35,
        status=status,
        compliance_summary=summary,
        ssm_check="unknown",
        required_documents=documents,
        required_permits=permits,
        required_agencies=agencies,
        logistics_extractions={},
        logistics_sea_flow=[],
        logistics_sea_required_documents=[],
        rule_hits=[],
        extraction_notes=["Fallback rule-based result used because Z.ai API key is not configured."],
        source="fallback",
    )


def _detect_materials(prompt: str) -> list[str]:
    material_map = {
        "leather": "leather",
        "cotton": "cotton",
        "plastic": "plastic",
        "steel": "steel",
        "wood": "wood",
        "food": "food",
        "animal": "animal",
        "plant": "plant",
        "electronics": "electronics",
    }
    lowered = prompt.lower()
    return [value for key, value in material_map.items() if key in lowered]


def _normalize_string_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        normalized = value.strip()
        return [normalized] if normalized else []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value).strip()] if str(value).strip() else []