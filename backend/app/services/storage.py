from __future__ import annotations

import logging
from pathlib import Path
from uuid import uuid4

logger = logging.getLogger(__name__)

# Local storage fallback directory
LOCAL_UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
LOCAL_UPLOADS_DIR.mkdir(exist_ok=True, parents=True)


async def upload_scan_asset(
    supabase_client,
    bucket_name: str,
    scan_id: str,
    filename: str,
    content: bytes,
    content_type: str | None,
) -> str | None:
    """Upload image to Supabase, fallback to local storage if unavailable."""
    safe_filename = filename.replace(" ", "_")
    object_path = f"scans/{scan_id}/{uuid4().hex}-{safe_filename}"

    # Try Supabase first
    if supabase_client is not None:
        try:
            storage = supabase_client.storage.from_(bucket_name)
            storage.upload(
                object_path,
                content,
                file_options={"content-type": content_type or "application/octet-stream"},
            )
            public_url = storage.get_public_url(object_path)
            logger.info(f"✓ Image uploaded to Supabase: {object_path}")
            return public_url
        except Exception as error:
            logger.warning(
                f"Supabase upload failed ({error.__class__.__name__}): {str(error)[:100]}. "
                f"Falling back to local storage."
            )

    # Fallback to local storage
    try:
        local_dir = LOCAL_UPLOADS_DIR / scan_id
        local_dir.mkdir(exist_ok=True, parents=True)
        
        local_filename = f"{uuid4().hex}-{safe_filename}"
        local_path = local_dir / local_filename
        
        with local_path.open("wb") as f:
            f.write(content)
        
        # Return a relative path that can be served by the app
        relative_path = f"/uploads/{scan_id}/{local_filename}"
        logger.info(f"✓ Image saved locally: {relative_path}")
        return relative_path
    except Exception as error:
        logger.error(
            f"Local storage also failed ({error.__class__.__name__}): {str(error)}. "
            f"Image will not be persisted."
        )
        return None