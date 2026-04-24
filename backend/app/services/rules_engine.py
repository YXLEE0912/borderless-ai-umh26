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
    rules_bundle: dict | None = None,
) -> ScanResult:
    rules = rules_bundle or load_local_rules()
    normalized_text = _normalize_text(" ".join([prompt, result.product_name, " ".join(result.materials_detected)]))
    material_context = _build_material_context(normalized_text)

    rule_hits: list[str] = list(result.rule_hits)
    required_documents = _dedupe(result.required_documents)
    required_permits = _dedupe(result.required_permits)
    required_agencies = _dedupe(result.required_agencies)
    extraction_notes = list(result.extraction_notes)
    decision_steps = list(result.decision_steps)

    malaysia_rules = rules["malaysia_export"]
    status = result.status
    hs_gate = _parse_hs_confidence_gate(malaysia_rules.get("hs_confidence_policy", {}))
    hs_gate_triggered = False
    strict_hs_mode = hs_gate["strict_hs_mode"]

    _add_decision_step(
        decision_steps,
        phase="input",
        decision="start_scan_rules",
        reason=f"strict_hs_mode={strict_hs_mode}, hs_confidence={result.hs_code_confidence:.2f}",
    )

    if result.hs_code_candidates and result.hs_code_confidence < hs_gate["min_confidence"]:
        hs_gate_triggered = True
        extraction_notes.append(
            (
                "HS confidence is "
                f"{result.hs_code_confidence:.2f}, below gate {hs_gate['min_confidence']:.2f}; "
                "manual HS review is required before final customs decision."
            )
        )
        if status != ScanStatus.restricted:
            status = ScanStatus.review
        _add_decision_step(
            decision_steps,
            phase="hs_gate",
            decision="forced_review",
            reason=f"confidence {result.hs_code_confidence:.2f} < gate {hs_gate['min_confidence']:.2f}",
        )

    hs_status = ScanStatus.green
    hs_notes: list[str] = []
    hs_hits: list[str] = []
    hs_permits: list[str] = []
    hs_agencies: list[str] = []
    if not hs_gate_triggered:
        hs_status, hs_notes, hs_hits, hs_permits, hs_agencies = _apply_hs_code_rules(
            hs_code_candidates=result.hs_code_candidates,
            hs_code_confidence=result.hs_code_confidence,
            hs_policies=malaysia_rules.get("hs_code_policies", []),
        )
        if hs_hits:
            status = _merge_status(status, hs_status)
            rule_hits.extend(hs_hits)
            extraction_notes.extend(hs_notes)
            required_permits.extend(hs_permits)
            required_agencies.extend(hs_agencies)
            _add_decision_step(
                decision_steps,
                phase="hs_policy",
                decision=f"status_{status.value}",
                reason=f"matched HS rules: {', '.join(hs_hits)}",
            )
        else:
            _add_decision_step(
                decision_steps,
                phase="hs_policy",
                decision="no_hs_match",
                reason="No HS prefix policy matched candidates at current confidence.",
            )

    hs_code_reasoning = str(result.hs_code_reasoning or "").strip()
    if hs_gate_triggered:
        hs_code_reasoning = (
            "HS candidates found but confidence is below required gate; "
            "manual HS classification review is required before policy mapping."
        )
    elif hs_notes:
        hs_code_reasoning = "; ".join(_dedupe(hs_notes))
    elif not hs_code_reasoning and result.hs_code_candidates:
        hs_code_reasoning = "HS candidates identified, but no HS policy mapping matched in the active ruleset."

    layer1_hits = _find_matches(malaysia_rules["layer1_absolute_prohibition"], normalized_text, material_context)
    if layer1_hits:
        status = ScanStatus.restricted
        for hit in layer1_hits:
            rule_hits.append(hit["rule_id"])
            extraction_notes.append(hit["message"])
        _add_decision_step(
            decision_steps,
            phase="keyword_layer1",
            decision="restricted",
            reason=f"Matched absolute prohibition rules: {', '.join(hit['rule_id'] for hit in layer1_hits)}",
        )

    if status != ScanStatus.restricted:
        layer2_hits = _find_matches(malaysia_rules["layer2_license_required"], normalized_text, material_context)
        if layer2_hits:
            if strict_hs_mode and hs_hits:
                for hit in layer2_hits:
                    rule_hits.append(hit["rule_id"])
                    extraction_notes.append(f"Keyword signal observed (secondary in strict HS mode): {hit['message']}")
                _add_decision_step(
                    decision_steps,
                    phase="keyword_layer2",
                    decision="secondary_warning_only",
                    reason="Strict HS mode active with HS hit, layer2 does not change status.",
                )
            else:
                status = ScanStatus.conditional
                for hit in layer2_hits:
                    rule_hits.append(hit["rule_id"])
                    extraction_notes.append(hit["message"])
                    required_permits.extend(hit.get("permits", []))
                    required_agencies.extend(hit.get("agencies", []))
                _add_decision_step(
                    decision_steps,
                    phase="keyword_layer2",
                    decision=f"status_{status.value}",
                    reason=f"Matched license-required rules: {', '.join(hit['rule_id'] for hit in layer2_hits)}",
                )

        layer3_hits = _find_matches(malaysia_rules["layer3_conditional"], normalized_text, material_context)
        if layer3_hits:
            if strict_hs_mode and hs_hits:
                for hit in layer3_hits:
                    rule_hits.append(hit["rule_id"])
                    extraction_notes.append(f"Keyword signal observed (secondary in strict HS mode): {hit['message']}")
                _add_decision_step(
                    decision_steps,
                    phase="keyword_layer3",
                    decision="secondary_warning_only",
                    reason="Strict HS mode active with HS hit, layer3 does not change status.",
                )
            else:
                status = ScanStatus.conditional if status != ScanStatus.restricted else status
                for hit in layer3_hits:
                    rule_hits.append(hit["rule_id"])
                    extraction_notes.append(hit["message"])
                    required_permits.extend(hit.get("permits", []))
                    required_agencies.extend(hit.get("agencies", []))
                _add_decision_step(
                    decision_steps,
                    phase="keyword_layer3",
                    decision=f"status_{status.value}",
                    reason=f"Matched conditional rules: {', '.join(hit['rule_id'] for hit in layer3_hits)}",
                )

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
        _add_decision_step(
            decision_steps,
            phase="destination_overlay",
            decision=f"status_{status.value}",
            reason=f"Destination overlays matched: {', '.join(destination_hits)}",
        )

    if hs_gate_triggered and status != ScanStatus.restricted:
        status = ScanStatus.review

    _add_decision_step(
        decision_steps,
        phase="final",
        decision=f"status_{status.value}",
        reason="Final status after HS, keyword, destination, and validation checks.",
    )

    logistics_extractions = _extract_logistics_fields(prompt)

    return ScanResult(
        product_name=result.product_name,
        materials_detected=_dedupe(result.materials_detected),
        hs_code_candidates=_dedupe(result.hs_code_candidates),
        hs_code_confidence=result.hs_code_confidence,
        hs_code_reasoning=hs_code_reasoning,
        status=status,
        compliance_summary=result.compliance_summary,
        required_documents=_dedupe(required_documents),
        required_permits=_dedupe(required_permits),
        required_agencies=_dedupe(required_agencies),
        logistics_extractions=logistics_extractions,
        logistics_sea_flow=list(malaysia_rules.get("sea_logistics_flow", [])),
        logistics_sea_required_documents=list(malaysia_rules.get("sea_required_documents", [])),
        rule_hits=_dedupe(rule_hits),
        extraction_notes=_dedupe(extraction_notes),
        decision_steps=_dedupe_steps(decision_steps),
        follow_up_questions=_dedupe(result.follow_up_questions),
        source=result.source,
    )


def _apply_hs_code_rules(
    *,
    hs_code_candidates: list[str],
    hs_code_confidence: float,
    hs_policies: list[dict],
) -> tuple[ScanStatus, list[str], list[str], list[str], list[str]]:
    hits: list[str] = []
    notes: list[str] = []
    permits: list[str] = []
    agencies: list[str] = []
    status = ScanStatus.green

    if not hs_code_candidates or not hs_policies:
        return status, notes, hits, permits, agencies

    for candidate in hs_code_candidates:
        normalized = _normalize_hs(candidate)
        if not normalized:
            continue
        for policy in hs_policies:
            prefix = _normalize_hs(str(policy.get("prefix", "")))
            if not prefix or not normalized.startswith(prefix):
                continue

            min_conf = float(policy.get("min_confidence", 0.0) or 0.0)
            if hs_code_confidence < min_conf:
                continue

            policy_status = _to_status(str(policy.get("status", "conditional")))
            status = _merge_status(status, policy_status)
            hits.append(str(policy.get("rule_id", f"HS-{prefix}")))
            notes.append(str(policy.get("message", f"HS {candidate} matched policy prefix {prefix}.")))
            permits.extend([str(item) for item in policy.get("permits", []) if str(item).strip()])
            agencies.extend([str(item) for item in policy.get("agencies", []) if str(item).strip()])

    return status, _dedupe(notes), _dedupe(hits), _dedupe(permits), _dedupe(agencies)


def _parse_hs_confidence_gate(config: dict) -> dict[str, float]:
    min_confidence = float(config.get("min_confidence", 0.65) or 0.65)
    if min_confidence < 0.0:
        min_confidence = 0.0
    if min_confidence > 1.0:
        min_confidence = 1.0
    strict_hs_mode = bool(config.get("strict_hs_mode", True))
    return {"min_confidence": min_confidence, "strict_hs_mode": strict_hs_mode}


def _normalize_hs(value: str) -> str:
    return re.sub(r"[^0-9]", "", value or "")


def _to_status(value: str) -> ScanStatus:
    clean = (value or "").strip().lower()
    if clean in {"green", "conditional", "restricted", "review"}:
        return ScanStatus(clean)
    return ScanStatus.conditional


def _merge_status(current: ScanStatus, incoming: ScanStatus) -> ScanStatus:
    rank = {
        ScanStatus.green: 0,
        ScanStatus.review: 1,
        ScanStatus.conditional: 2,
        ScanStatus.restricted: 3,
    }
    return incoming if rank[incoming] > rank[current] else current


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


def _find_matches(layer_rules: list[dict], normalized_text: str, material_context: dict[str, bool]) -> list[dict]:
    matches: list[dict] = []
    for rule in layer_rules:
        matched_keywords = _matched_keywords(normalized_text, rule.get("keywords", []))
        if not matched_keywords:
            continue

        if str(rule.get("rule_id", "")).strip().upper() == "MY-L3-ANIMAL":
            has_non_leather_signal = any(keyword.lower() != "leather" for keyword in matched_keywords)
            leather_only_hit = ("leather" in [keyword.lower() for keyword in matched_keywords]) and not has_non_leather_signal

            # Do not classify synthetic/faux/vegan leather as animal-based unless stronger animal signals exist.
            if material_context.get("synthetic_leather_only") and leather_only_hit:
                continue

            if not material_context.get("animal_signal") and leather_only_hit:
                continue

            matches.append(rule)
    return matches


def _build_material_context(normalized_text: str) -> dict[str, bool]:
    real_leather_terms = [
        "real leather",
        "genuine leather",
        "cowhide",
        "sheepskin",
        "goatskin",
        "animal hide",
        "animal skin",
        "hide",
        "skin",
    ]
    synthetic_leather_terms = [
        "synthetic leather",
        "faux leather",
        "vegan leather",
        "pu leather",
        "pvc leather",
        "artificial leather",
        "leatherette",
    ]
    suede_like_terms = [
        "suede-like",
        "suede like",
        "suede-look",
        "suede look",
        "mock suede",
        "imitation suede",
        "microfiber suede",
    ]
    animal_terms = ["animal", "meat", "poultry", "fish", "dairy", "egg", "gelatin"]

    has_real_leather = _contains_any(normalized_text, real_leather_terms)
    has_synthetic_leather = _contains_any(normalized_text, synthetic_leather_terms)
    has_suede_like = _contains_any(normalized_text, suede_like_terms)
    has_generic_animal_terms = _contains_any(normalized_text, animal_terms)

    animal_signal = has_real_leather or has_generic_animal_terms
    if has_synthetic_leather and not has_real_leather and not has_generic_animal_terms:
        animal_signal = False

    return {
        "has_real_leather": has_real_leather,
        "has_synthetic_leather": has_synthetic_leather,
        "has_suede_like": has_suede_like,
        "synthetic_leather_only": has_synthetic_leather and not has_real_leather and not has_generic_animal_terms,
        "animal_signal": animal_signal,
    }


def _matched_keywords(text: str, keywords: list[str]) -> list[str]:
    return [keyword for keyword in keywords if _keyword_in_text(text, str(keyword))]


def _keyword_in_text(text: str, keyword: str) -> bool:
    clean_keyword = keyword.strip().lower()
    if not clean_keyword:
        return False
    if " " in clean_keyword or "-" in clean_keyword:
        return clean_keyword in text
    return re.search(rf"\\b{re.escape(clean_keyword)}\\b", text) is not None


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
    return any(_keyword_in_text(text, str(keyword)) for keyword in keywords)


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


def _add_decision_step(steps: list[dict[str, str]], *, phase: str, decision: str, reason: str) -> None:
    steps.append({"phase": phase, "decision": decision, "reason": reason})


def _dedupe_steps(steps: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in steps:
        phase = str(item.get("phase", "")).strip()
        decision = str(item.get("decision", "")).strip()
        reason = str(item.get("reason", "")).strip()
        if not phase or not decision:
            continue
        key = f"{phase}|{decision}|{reason}".lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"phase": phase, "decision": decision, "reason": reason})
    return out