from __future__ import annotations

import json
import re

import httpx

from app.core.config import Settings
from app.schemas.scan import ScanAnalysis, ScanResult, ScanStatus
from app.services.gemini_vision_client import GeminiVisionClient
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
            timeout_seconds=settings.z_ai_timeout_seconds,
            max_retries=settings.z_ai_max_retries,
        )
        gemini_keys = [key for key in [settings.gemini_api_key, settings.gemini_api_key_backup] if key]
        self.gemini_vision_client = GeminiVisionClient(
            api_keys=gemini_keys,
            model=settings.gemini_vision_model,
        )
        self.rules_repository = RulesRepository(settings=settings, supabase_client=supabase_client)

    async def analyze(
        self,
        prompt: str,
        destination_country: str | None = None,
        image_bytes: bytes | None = None,
        image_content_type: str | None = None,
        image_filename: str | None = None,
    ) -> ScanResult:
        # Step 1: Analyze image with Gemini vision if provided
        gemini_vision_summary = None
        if image_bytes and self.gemini_vision_client.enabled:
            try:
                vision_result = await self.gemini_vision_client.analyze_image(
                    prompt=prompt,
                    image_bytes=image_bytes,
                    image_content_type=image_content_type,
                )
                gemini_vision_summary = vision_result
            except Exception as error:
                # Gemini vision failure is not blocking; we can still use ILMU with original prompt
                pass

        effective_destination_country = destination_country or _extract_destination_country_from_prompt(prompt)

        # Step 2: Build enhanced prompt with Gemini vision results
        enhanced_prompt = _build_enhanced_prompt(
            original_prompt=prompt,
            gemini_vision_summary=gemini_vision_summary,
        )

        # Step 3: Analyze with ILMU using enhanced prompt
        base_result: ScanResult
        if self.settings.z_ai_api_key:
            try:
                raw_result = await self.zai_client.analyze(
                    prompt=enhanced_prompt,
                    destination_country=effective_destination_country,
                    image_bytes=image_bytes,
                    image_content_type=image_content_type,
                    image_filename=image_filename,
                )
                parsed = _parse_model_result(raw_result)
                base_result = _normalize_result(parsed, source="z-ai")
            except httpx.HTTPStatusError as error:
                response_text = (error.response.text or "").strip()
                if response_text:
                    response_text = response_text[:240]
                base_result = _fallback_result(
                    prompt=enhanced_prompt,
                    reason=f"ILMU reasoning service unavailable (HTTP {error.response.status_code}).",
                )
            except Exception as error:
                base_result = _fallback_result(
                    prompt=enhanced_prompt,
                    reason=f"ILMU reasoning service unavailable ({error.__class__.__name__}).",
                )
        else:
            base_result = _fallback_result(prompt=enhanced_prompt, reason="Z.ai API key is not configured.")

        rules_bundle = await self.rules_repository.get_active_rules_bundle()
        result = apply_rules(
            result=base_result,
            prompt=enhanced_prompt,
            destination_country=effective_destination_country,
            rules_bundle=rules_bundle,
        )

        follow_up_questions = _build_follow_up_questions(
            result=result,
            prompt=enhanced_prompt,
            destination_country=effective_destination_country,
            image_bytes=image_bytes,
        )

        analysis = _build_structured_analysis(
            result=result,
            destination_country=effective_destination_country,
            follow_up_questions=follow_up_questions,
            prompt=enhanced_prompt,
        )

        base_updates = {
            "analysis": analysis,
        }

        if follow_up_questions and result.status != ScanStatus.restricted:
            base_updates["follow_up_questions"] = follow_up_questions
            base_updates["extraction_notes"] = _dedupe_string_list(
                result.extraction_notes + ["Additional details are needed to improve classification confidence."]
            )

        return result.model_copy(update=base_updates)


def _build_enhanced_prompt(original_prompt: str, gemini_vision_summary: dict | None) -> str:
    """Merge Gemini vision analysis results with the original prompt for ILMU processing.
    
    Args:
        original_prompt: The user-provided text prompt
        gemini_vision_summary: Dictionary with vision analysis results from Gemini (product_name,
                               materials_detected, visual_summary, etc.)
    
    Returns:
        Enhanced prompt string that includes both original context and vision analysis
    """
    if not gemini_vision_summary:
        return original_prompt

    # Extract key information from Gemini vision results
    product_name = (gemini_vision_summary.get("product_name") or "").strip()
    materials = gemini_vision_summary.get("materials_detected") or []
    visual_summary = (gemini_vision_summary.get("visual_summary") or "").strip()
    brand = (gemini_vision_summary.get("brand_detected") or "").strip()
    packaging_text = gemini_vision_summary.get("packaging_text") or []

    # Build vision context block
    vision_context_parts = []
    
    if product_name:
        vision_context_parts.append(f"Product name (from image): {product_name}")
    
    if materials:
        materials_str = ", ".join([str(m).strip() for m in materials if str(m).strip()])
        if materials_str:
            vision_context_parts.append(f"Materials detected: {materials_str}")
    
    if brand:
        vision_context_parts.append(f"Brand/Manufacturer: {brand}")
    
    if packaging_text:
        packaging_str = " | ".join([str(p).strip() for p in packaging_text if str(p).strip()])
        if packaging_str:
            vision_context_parts.append(f"Packaging text: {packaging_str}")
    
    if visual_summary:
        vision_context_parts.append(f"Visual description: {visual_summary}")

    # If no vision data was extracted, return original prompt
    if not vision_context_parts:
        return original_prompt

    # Combine original prompt with vision analysis
    vision_block = "\n".join(vision_context_parts)
    enhanced = f"{original_prompt}\n\n[Image Analysis from Gemini Vision]\n{vision_block}"
    
    return enhanced


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
        materials_detected=_normalize_array_field(data.get("materials_detected", [])),
        hs_code_candidates=_normalize_array_field(data.get("hs_code_candidates", [])),
        hs_code_confidence=float(data.get("hs_code_confidence", 0.0) or 0.0),
        hs_code_reasoning=str(data.get("hs_code_reasoning", "")).strip(),
        status=status,
        compliance_summary=str(data.get("compliance_summary", "")).strip(),
        required_documents=[str(item) for item in data.get("required_documents", []) if str(item).strip()],
        required_permits=[str(item) for item in data.get("required_permits", []) if str(item).strip()],
        required_agencies=[str(item) for item in data.get("required_agencies", []) if str(item).strip()],
        logistics_extractions={
            str(k): str(v) for k, v in dict(data.get("logistics_extractions", {})).items() if str(k).strip()
        },
        logistics_sea_flow=_normalize_array_field(data.get("logistics_sea_flow", [])),
        logistics_sea_required_documents=_normalize_array_field(data.get("logistics_sea_required_documents", [])),
        rule_hits=_normalize_array_field(data.get("rule_hits", [])),
        extraction_notes=_normalize_string_list(data.get("extraction_notes", [])),
        decision_steps=_normalize_decision_steps(data.get("decision_steps", [])),
        follow_up_questions=_normalize_string_list(data.get("follow_up_questions", [])),
        source=source,
    )


def _fallback_result(prompt: str, reason: str | None = None) -> ScanResult:
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
        hs_code_reasoning="Fallback mode: HS code needs manual confirmation.",
        status=status,
        compliance_summary=summary,
        required_documents=documents,
        required_permits=permits,
        required_agencies=agencies,
        logistics_extractions={},
        logistics_sea_flow=[],
        logistics_sea_required_documents=[],
        rule_hits=[],
        extraction_notes=[reason or "Fallback rule-based result used because AI analysis is unavailable."],
        decision_steps=[],
        follow_up_questions=[],
        source="fallback",
    )


def _detect_materials(prompt: str) -> list[str]:
    material_map = {
        "synthetic leather": "synthetic leather",
        "faux leather": "synthetic leather",
        "vegan leather": "synthetic leather",
        "pu leather": "synthetic leather",
        "pvc leather": "synthetic leather",
        "genuine leather": "leather",
        "real leather": "leather",
        "cowhide": "leather",
        "hide": "leather",
        "skin": "leather",
        "leather": "leather",
        "suede-like": "suede-like textile",
        "suede look": "suede-like textile",
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
    detected = [value for key, value in material_map.items() if key in lowered]

    if "synthetic leather" in detected and "leather" in detected and not any(term in lowered for term in ["real leather", "genuine leather", "cowhide", "hide", "skin"]):
        detected = [item for item in detected if item != "leather"]

    return _dedupe_string_list(detected)


def _normalize_string_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        normalized = value.strip()
        return [normalized] if normalized else []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value).strip()] if str(value).strip() else []


def _normalize_array_field(value) -> list[str]:
    """Convert string or list to clean array, avoiding character splitting.
    
    If value is a string, returns it as a single-element array.
    If value is a list, filters out empty strings and single-char items 
    that might result from iterating over a string by accident.
    """
    if value is None:
        return []
    if isinstance(value, str):
        normalized = value.strip()
        return [normalized] if normalized else []
    if isinstance(value, list):
        result = []
        for item in value:
            item_str = str(item).strip()
            if item_str and len(item_str) > 1:
                result.append(item_str)
        return result
    return []


def _normalize_decision_steps(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        phase = str(item.get("phase", "")).strip()
        decision = str(item.get("decision", "")).strip()
        reason = str(item.get("reason", "")).strip()
        if not (phase and decision):
            continue
        out.append({"phase": phase, "decision": decision, "reason": reason})
    return out


def _build_follow_up_questions(
    *,
    result: ScanResult,
    prompt: str,
    destination_country: str | None,
    image_bytes: bytes | None,
) -> list[str]:
    if result.status == ScanStatus.restricted:
        return []

    context = _classify_material_context(prompt=prompt, materials=result.materials_detected)
    questions = _filter_follow_up_questions(result.follow_up_questions, context)
    lowered_prompt = prompt.lower()

    if image_bytes is None:
        questions.append(
            "Please upload clear product photos (front, back, label/packaging close-up) so I can verify what the item is."
        )
    else:
        image_confidence_low = (
            result.status == ScanStatus.review
            or result.hs_code_confidence < 0.55
            or not result.materials_detected
            or not result.hs_code_candidates
        )
        if image_confidence_low:
            questions.append(
                "The image may be unclear for compliance checks. Can you upload 2 to 3 sharper photos under good lighting, including any label text?"
            )

    if not destination_country:
        questions.append("Which destination country will this product be exported to?")

    if not result.materials_detected:
        questions.append("Please tell me the product material (for example solid wood, MDF, plastic, metal, fabric, food ingredient).")

    if not result.hs_code_candidates or result.hs_code_confidence < 0.55:
        questions.append(
            "Please share product specs: exact material composition (%), intended use, and product dimensions/weight."
        )

    if any(keyword in lowered_prompt for keyword in ["food", "cosmetic", "chemical", "plant"]) or context["animal_signal"]:
        questions.append(
            "Do you have supporting certificates (for example health, phytosanitary, or safety certificates) for this product category?"
        )

    return _dedupe_string_list(questions)[:6]


def _build_structured_analysis(
    *,
    result: ScanResult,
    destination_country: str | None,
    follow_up_questions: list[str],
    prompt: str,
) -> ScanAnalysis:
    intent = _detect_user_intent(prompt=prompt)

    if result.status == ScanStatus.restricted:
        verdict = "Prohibited"
        verdict_reason = "This item matches hard prohibition rules and should not be exported."
    elif result.status == ScanStatus.conditional:
        verdict = "Allowed With Restrictions"
        verdict_reason = "Export is allowed only after the listed permits and compliance checks are completed."
    elif result.status == ScanStatus.green:
        verdict = "Allowed"
        verdict_reason = "No blocking rule was matched, but standard export compliance checks still apply."
    else:
        verdict = "Needs More Info"
        verdict_reason = "The classification confidence is low, so more details are required before a reliable decision."

    why_this_status = [result.compliance_summary] if result.compliance_summary else []

    if result.status == ScanStatus.restricted and result.rule_hits:
        why_this_status.extend([f"Blocked by rule: {hit}" for hit in result.rule_hits[:4]])
    elif result.rule_hits:
        why_this_status.extend([item for item in (_humanize_rule_hit(hit) for hit in result.rule_hits[:4]) if item])

    restrictions = []
    if result.required_permits:
        restrictions.append(f"Permits required: {', '.join(result.required_permits)}")
    if result.required_agencies:
        agency_preview = result.required_agencies[:3]
        if len(result.required_agencies) > 3:
            agency_preview.append("others")
        restrictions.append(f"Agency checks: {', '.join(agency_preview)}")
    if result.required_documents and intent["wants_documents"]:
        doc_preview = result.required_documents[:4]
        if len(result.required_documents) > 4:
            doc_preview.append("others")
        restrictions.append(f"Common documents: {', '.join(doc_preview)}")

    missing_information = [] if result.status == ScanStatus.restricted else list(follow_up_questions[:4])

    next_steps: list[str] = []
    if verdict == "Prohibited":
        next_steps.append("Do not ship this item until a compliance specialist confirms legal alternatives.")
    elif verdict == "Allowed With Restrictions":
        next_steps.append("Prepare permits and agency checks before booking shipment.")
    elif verdict == "Allowed":
        next_steps.append("Proceed with export planning and confirm final HS code and destination procedures.")
    else:
        next_steps.append("Provide missing details so the system can finalize the compliance decision.")

    if destination_country is None:
        next_steps.append("Specify destination country to run destination-specific restrictions.")

    return ScanAnalysis(
        verdict=verdict,
        verdict_reason=verdict_reason,
        destination_country=destination_country,
        why_this_status=_dedupe_string_list(why_this_status),
        restrictions=_dedupe_string_list(restrictions),
        missing_information=_dedupe_string_list(missing_information),
        next_steps=_dedupe_string_list(next_steps),
    )


def _classify_material_context(*, prompt: str, materials: list[str] | None = None) -> dict[str, bool]:
    combined = f"{prompt} {' '.join(materials or [])}".lower()

    real_leather_terms = ["real leather", "genuine leather", "cowhide", "hide", "skin"]
    synthetic_leather_terms = ["synthetic leather", "faux leather", "vegan leather", "pu leather", "pvc leather", "leatherette"]
    suede_like_terms = ["suede-like", "suede look", "imitation suede", "mock suede", "microfiber suede"]

    has_real_leather = any(term in combined for term in real_leather_terms)
    has_synthetic_leather = any(term in combined for term in synthetic_leather_terms)
    has_suede_like = any(term in combined for term in suede_like_terms)
    has_animal_terms = any(term in combined for term in ["animal", "meat", "poultry", "fish", "dairy", "egg", "gelatin"])

    animal_signal = has_real_leather or has_animal_terms
    if has_synthetic_leather and not has_real_leather and not has_animal_terms:
        animal_signal = False

    return {
        "animal_signal": animal_signal,
        "synthetic_leather_only": has_synthetic_leather and not has_real_leather and not has_animal_terms,
        "has_suede_like": has_suede_like,
    }


def _filter_follow_up_questions(questions: list[str], context: dict[str, bool]) -> list[str]:
    if not questions:
        return []

    filtered: list[str] = []
    for question in questions:
        lowered = question.lower()
        if context["synthetic_leather_only"] and any(token in lowered for token in ["species", "raw/unprocessed", "unprocessed", "heat treatment", "fumigation"]):
            continue
        filtered.append(question)
    return filtered


def _humanize_rule_hit(rule_id: str) -> str:
    mapping = {
        "MY-L3-ANIMAL": "Animal-origin material controls may apply.",
        "MY-L3-PLANT": "Plant-origin material controls may apply.",
        "MY-L3-FOOD": "Food-related certification checks may apply.",
        "MY-L3-WILDLIFE": "Wildlife or protected-species checks may apply.",
        "MY-L2-DUALUSE": "Possible dual-use control identified; licensing may be required.",
        "MY-L2-TELECOM": "Telecom-related regulatory approval may be required.",
    }
    return mapping.get(rule_id, "")


def _extract_destination_country_from_prompt(prompt: str) -> str | None:
    lowered = prompt.lower()

    aliases = {
        "united states": "US",
        "usa": "US",
        "us": "US",
        "united kingdom": "UK",
        "uk": "UK",
        "china": "China",
        "singapore": "Singapore",
        "japan": "Japan",
        "korea": "Korea",
        "south korea": "Korea",
        "europe": "EU",
        "eu": "EU",
        "canada": "Canada",
        "australia": "Australia",
        "thailand": "Thailand",
        "vietnam": "Vietnam",
        "indonesia": "Indonesia",
        "malaysia": "Malaysia",
    }

    direct_match = re.search(
        r"\b(?:to|into|for)\s+(united\s+states|usa|us|united\s+kingdom|uk|china|singapore|japan|korea|south\s+korea|europe|eu|canada|australia|thailand|vietnam|indonesia|malaysia)\b",
        lowered,
    )
    if direct_match:
        return aliases.get(direct_match.group(1), direct_match.group(1).title())

    for key, value in aliases.items():
        if re.search(rf"\b{re.escape(key)}\b", lowered):
            return value

    return None


def _dedupe_string_list(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in values:
        normalized = str(item).strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(normalized)
    return out


def _detect_user_intent(*, prompt: str) -> dict[str, bool]:
    text = (prompt or "").lower()

    return {
        "wants_documents": any(keyword in text for keyword in ["document", "paperwork", "permit", "certificate", "license", "licence"]),
    }