from __future__ import annotations

import json
import re
from pathlib import Path

from app.schemas.scan import ScanResult, ScanStatus


def load_local_rules() -> dict:
    rules_path = Path(__file__).resolve().parent.parent / "rules" / "malaysia_export_rules.json"
    with rules_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def apply_rules(
    *,
    result: ScanResult,
    prompt: str,
    destination_country: str | None,
    merchant_ssm: str | None,
    rules_bundle: dict | None = None,
) -> ScanResult:
    rules = rules_bundle or load_local_rules()
    normalized_text = _normalize_text(" ".join([prompt, result.product_name, " ".join(result.materials_detected)]))

    rule_hits: list[str] = list(result.rule_hits)
    required_documents = _dedupe(result.required_documents)
    required_permits = _dedupe(result.required_permits)
    required_agencies = _dedupe(result.required_agencies)
    extraction_notes = list(result.extraction_notes)

    malaysia_rules = rules["malaysia_export"]
    status = result.status

    layer1_hits = _find_matches(malaysia_rules["layer1_absolute_prohibition"], normalized_text)
    if layer1_hits:
        status = ScanStatus.restricted
        for hit in layer1_hits:
            rule_hits.append(hit["rule_id"])
            extraction_notes.append(hit["message"])

    if status != ScanStatus.restricted:
        layer2_hits = _find_matches(malaysia_rules["layer2_license_required"], normalized_text)
        if layer2_hits:
            status = ScanStatus.conditional
            for hit in layer2_hits:
                rule_hits.append(hit["rule_id"])
                extraction_notes.append(hit["message"])
                required_permits.extend(hit.get("permits", []))
                required_agencies.extend(hit.get("agencies", []))

        layer3_hits = _find_matches(malaysia_rules["layer3_conditional"], normalized_text)
        if layer3_hits:
            status = ScanStatus.conditional if status != ScanStatus.restricted else status
            for hit in layer3_hits:
                rule_hits.append(hit["rule_id"])
                extraction_notes.append(hit["message"])
                required_permits.extend(hit.get("permits", []))
                required_agencies.extend(hit.get("agencies", []))

    required_documents.extend(malaysia_rules.get("default_required_documents", []))

    destination_notes, destination_hits = _apply_destination_rules(
        rules=rules,
        normalized_text=normalized_text,
        destination_country=destination_country,
    )
    if destination_hits:
        rule_hits.extend(destination_hits)
        extraction_notes.extend(destination_notes)
        if status == ScanStatus.green:
            status = ScanStatus.conditional

    ssm_check = _evaluate_ssm(merchant_ssm)
    if ssm_check != "valid":
        extraction_notes.append("Merchant SSM should be validated before submission to customs workflow.")

    logistics_extractions = _extract_logistics_fields(prompt)

    return ScanResult(
        product_name=result.product_name,
        materials_detected=_dedupe(result.materials_detected),
        hs_code_candidates=_dedupe(result.hs_code_candidates),
        hs_code_confidence=result.hs_code_confidence,
        status=status,
        compliance_summary=result.compliance_summary,
        ssm_check=ssm_check,
        required_documents=_dedupe(required_documents),
        required_permits=_dedupe(required_permits),
        required_agencies=_dedupe(required_agencies),
        logistics_extractions=logistics_extractions,
        logistics_sea_flow=list(malaysia_rules.get("sea_logistics_flow", [])),
        logistics_sea_required_documents=list(malaysia_rules.get("sea_required_documents", [])),
        rule_hits=_dedupe(rule_hits),
        extraction_notes=_dedupe(extraction_notes),
        source=result.source,
    )


def _apply_destination_rules(*, rules: dict, normalized_text: str, destination_country: str | None) -> tuple[list[str], list[str]]:
    if not destination_country:
        return [], []

    country_map = rules.get("destination_import", {})
    country_key = _country_to_key(destination_country)
    if country_key not in country_map:
        return [], []

    config = country_map[country_key]
    notes: list[str] = []
    hits: list[str] = []

    if _contains_any(normalized_text, config.get("absolute_prohibited_keywords", [])):
        hits.append(f"DEST-{country_key}-ABS")
        notes.append(
            f"Destination country {config.get('country_name', destination_country)} has an absolute prohibition signal for this product."
        )

    if _contains_any(normalized_text, config.get("restricted_keywords", [])):
        hits.append(f"DEST-{country_key}-RES")
        notes.append(
            f"Destination country {config.get('country_name', destination_country)} likely requires additional import checks."
        )

    if config.get("notes"):
        notes.append(str(config["notes"]))

    return notes, hits


def _find_matches(layer_rules: list[dict], normalized_text: str) -> list[dict]:
    matches: list[dict] = []
    for rule in layer_rules:
        if _contains_any(normalized_text, rule.get("keywords", [])):
            matches.append(rule)
    return matches


def _evaluate_ssm(merchant_ssm: str | None) -> str:
    if not merchant_ssm:
        return "missing"
    normalized = merchant_ssm.strip()
    if re.fullmatch(r"\d{12}", normalized):
        return "valid"
    return "invalid_format"


def _extract_logistics_fields(prompt: str) -> dict[str, str]:
    text = prompt.strip()
    extractions: dict[str, str] = {}

    incoterm_match = re.search(r"\b(EXW|FCA|FOB|CIF|CFR|DAP|DDP)\b", text, flags=re.IGNORECASE)
    if incoterm_match:
        extractions["incoterm"] = incoterm_match.group(1).upper()

    weight_match = re.search(r"(\d+(?:\.\d+)?)\s?(kg|kgs|kilogram|ton|tons)", text, flags=re.IGNORECASE)
    if weight_match:
        extractions["gross_weight"] = f"{weight_match.group(1)} {weight_match.group(2)}"

    qty_match = re.search(r"(\d+)\s?(pcs|pieces|cartons|boxes|units)", text, flags=re.IGNORECASE)
    if qty_match:
        extractions["quantity"] = f"{qty_match.group(1)} {qty_match.group(2)}"

    return extractions


def _country_to_key(value: str) -> str:
    clean = value.strip().upper()
    aliases = {
        "CHINA": "CN",
        "CN": "CN",
        "JAPAN": "JP",
        "JP": "JP",
    }
    return aliases.get(clean, clean)


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword.lower() in text for keyword in keywords)


def _normalize_text(value: str) -> str:
    return value.lower()


def _dedupe(values: list[str]) -> list[str]:
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