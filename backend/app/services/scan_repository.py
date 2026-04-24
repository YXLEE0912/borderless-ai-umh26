from __future__ import annotations

from datetime import datetime
import json


def _table(client, table_name: str):
    return client.table(table_name)


async def create_scan_record(client, table_name: str, record: dict) -> None:
    if client is None:
        return None

    payload = dict(record)
    payload["created_at"] = _to_iso(payload.get("created_at"))
    payload["updated_at"] = _to_iso(payload.get("updated_at"))
    payload["result"] = payload.get("result")

    _table(client, table_name).insert(payload).execute()
    return None


async def get_scan_record(client, table_name: str, scan_id: str) -> dict | None:
    if client is None:
        return None

    response = _table(client, table_name).select("*").eq("id", scan_id).limit(1).execute()
    data = response.data or []
    if not data:
        return None
    record = dict(data[0])
    record["result"] = _parse_result(record.get("result"))
    return record


async def list_scan_records(client, table_name: str, limit: int = 25) -> list[dict]:
    if client is None:
        return []

    response = _table(client, table_name).select("*").order("created_at", desc=True).limit(limit).execute()
    rows = response.data or []
    records: list[dict] = []
    for row in rows:
        record = dict(row)
        record["result"] = _parse_result(record.get("result"))
        records.append(record)
    return records


async def update_scan_record(client, table_name: str, scan_id: str, updates: dict) -> dict | None:
    if client is None:
        return None

    payload = dict(updates)
    payload["updated_at"] = _to_iso(payload.get("updated_at"))

    response = _table(client, table_name).update(payload).eq("id", scan_id).execute()
    rows = response.data or []
    if not rows:
        return None
    return dict(rows[0])


def _to_iso(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _parse_result(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return {}
    if isinstance(value, dict):
        return value
    return {}