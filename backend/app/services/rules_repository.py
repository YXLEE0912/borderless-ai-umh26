from __future__ import annotations

import json
import time
from pathlib import Path

from app.core.config import Settings


class RulesRepository:
    def __init__(self, settings: Settings, supabase_client=None):
        self.settings = settings
        self.supabase_client = supabase_client
        self._cached_bundle: dict | None = None
        self._cached_at: float = 0.0

    async def get_active_rules_bundle(self) -> dict:
        ttl = max(5, int(self.settings.rules_cache_ttl_seconds))
        now = time.monotonic()
        if self._cached_bundle is not None and (now - self._cached_at) < ttl:
            return self._cached_bundle

        bundle = self._load_local_rules()

        if self.supabase_client is not None:
            try:
                db_bundle = self._load_rules_from_db()
                if db_bundle is not None:
                    bundle = db_bundle
            except Exception:
                # Keep service available by falling back to local checked-in rules.
                bundle = bundle

        self._cached_bundle = bundle
        self._cached_at = now
        return bundle

    def _load_rules_from_db(self) -> dict | None:
        ruleset_resp = (
            self.supabase_client.table(self.settings.supabase_rulesets_table)
            .select("id,name,version,jurisdiction,sources")
            .eq("status", "published")
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
        rulesets = ruleset_resp.data or []
        if not rulesets:
            return None

        ruleset = rulesets[0]
        ruleset_id = ruleset["id"]

        rules_resp = (
            self.supabase_client.table(self.settings.supabase_rules_table)
            .select("layer,rule_code,title,keywords,action,message,permits,agencies,severity")
            .eq("ruleset_id", ruleset_id)
            .eq("enabled", True)
            .order("severity", desc=False)
            .execute()
        )
        rules_rows = rules_resp.data or []

        destination_resp = (
            self.supabase_client.table(self.settings.supabase_destination_policies_table)
            .select("country_code,country_name,absolute_prohibited_keywords,restricted_keywords,notes")
            .eq("ruleset_id", ruleset_id)
            .execute()
        )
        destination_rows = destination_resp.data or []

        docs_resp = (
            self.supabase_client.table(self.settings.supabase_document_profiles_table)
            .select("profile_key,items")
            .eq("ruleset_id", ruleset_id)
            .execute()
        )
        docs_rows = docs_resp.data or []

        layer1: list[dict] = []
        layer2: list[dict] = []
        layer3: list[dict] = []

        for row in rules_rows:
            item = {
                "rule_id": row.get("rule_code", ""),
                "title": row.get("title", ""),
                "keywords": _json_array(row.get("keywords")),
                "message": row.get("message", ""),
                "permits": _json_array(row.get("permits")),
                "agencies": _json_array(row.get("agencies")),
            }
            layer = str(row.get("layer", "")).lower().strip()
            if layer == "layer1":
                layer1.append(item)
            elif layer == "layer2":
                layer2.append(item)
            elif layer == "layer3":
                layer3.append(item)

        destination_import: dict[str, dict] = {}
        for row in destination_rows:
            code = str(row.get("country_code", "")).upper().strip()
            if not code:
                continue
            destination_import[code] = {
                "country_name": row.get("country_name", code),
                "absolute_prohibited_keywords": _json_array(row.get("absolute_prohibited_keywords")),
                "restricted_keywords": _json_array(row.get("restricted_keywords")),
                "notes": row.get("notes") or "",
            }

        docs_map = {str(row.get("profile_key", "")): _json_array(row.get("items")) for row in docs_rows}

        return {
            "version": f"{ruleset.get('name', 'ruleset')}:{ruleset.get('version', 'unknown')}",
            "sources": _json_array(ruleset.get("sources")),
            "malaysia_export": {
                "layer1_absolute_prohibition": layer1,
                "layer2_license_required": layer2,
                "layer3_conditional": layer3,
                "default_required_documents": docs_map.get("default_required_documents", []),
                "sea_logistics_flow": docs_map.get("sea_logistics_flow", []),
                "sea_required_documents": docs_map.get("sea_required_documents", []),
            },
            "destination_import": destination_import,
        }

    def _load_local_rules(self) -> dict:
        rules_path = Path(__file__).resolve().parent.parent / "rules" / "malaysia_export_rules.json"
        with rules_path.open("r", encoding="utf-8") as file:
            return json.load(file)


def _json_array(value) -> list:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    return list(value)