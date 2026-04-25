from __future__ import annotations

from datetime import datetime


def _table(client, table_name: str):
    return client.table(table_name)


async def create_chat_message(client, table_name: str, payload: dict) -> None:
    if client is None or not table_name:
        return None

    body = dict(payload)
    for field in ("created_at", "updated_at"):
        value = body.get(field)
        if isinstance(value, datetime):
            body[field] = value.isoformat()

    try:
        _table(client, table_name).insert(body).execute()
    except Exception:
        return None
    return None


async def list_chat_messages(client, table_name: str, scan_id: str) -> list[dict]:
    if client is None or not table_name:
        return []

    try:
        response = (
            _table(client, table_name)
            .select("id,scan_id,role,message,metadata,created_at")
            .eq("scan_id", scan_id)
            .order("created_at", desc=False)
            .execute()
        )
    except Exception:
        return []
    return [dict(row) for row in (response.data or [])]
