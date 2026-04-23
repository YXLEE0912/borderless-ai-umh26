from __future__ import annotations

from uuid import uuid4


async def upload_scan_asset(
    supabase_client,
    bucket_name: str,
    scan_id: str,
    filename: str,
    content: bytes,
    content_type: str | None,
) -> str | None:
    if supabase_client is None:
        return None

    safe_filename = filename.replace(" ", "_")
    object_path = f"scans/{scan_id}/{uuid4().hex}-{safe_filename}"

    try:
        storage = supabase_client.storage.from_(bucket_name)
        storage.upload(
            object_path,
            content,
            file_options={"content-type": content_type or "application/octet-stream"},
        )
        return storage.get_public_url(object_path)
    except Exception:
        return None