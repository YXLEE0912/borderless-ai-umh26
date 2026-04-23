from __future__ import annotations

from datetime import datetime


def _table(client, table_name: str):
    return client.table(table_name)


async def create_rule_execution_log(client, table_name: str, payload: dict) -> None:
    if client is None:
        return None
    if not table_name:
        return None

    body = dict(payload)
    for field in ("created_at", "updated_at"):
        value = body.get(field)
        if isinstance(value, datetime):
            body[field] = value.isoformat()

    _table(client, table_name).insert(body).execute()
    return None