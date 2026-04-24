"""Diagnostic script to test Supabase connectivity and storage bucket."""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import Settings
from app.core.supabase import build_supabase_client
from PIL import Image
from io import BytesIO

# Load settings
settings = Settings()
print(f"✓ Settings loaded")
print(f"  SUPABASE_URL: {settings.supabase_url}")
print(f"  SUPABASE_STORAGE_BUCKET: {settings.supabase_storage_bucket}")

# Build Supabase client
try:
    supabase_client = build_supabase_client(settings)
    print(f"✓ Supabase client created")
except Exception as e:
    print(f"✗ Failed to create Supabase client: {e}")
    sys.exit(1)

# List buckets
try:
    buckets = supabase_client.storage.list_buckets()
    print(f"✓ Buckets listed: {[b.name for b in buckets]}")
except Exception as e:
    print(f"✗ Failed to list buckets: {e}")
    sys.exit(1)

# Check if our bucket exists
bucket_exists = any(b.name == settings.supabase_storage_bucket for b in buckets)
if bucket_exists:
    print(f"✓ Bucket '{settings.supabase_storage_bucket}' exists")
else:
    print(f"✗ Bucket '{settings.supabase_storage_bucket}' DOES NOT EXIST")
    print(f"  → Create it in Supabase console: Storage → Create bucket → {settings.supabase_storage_bucket}")
    sys.exit(1)

# Test upload
try:
    img = Image.new("RGB", (256, 256), "blue")
    img_bytes = BytesIO()
    img.save(img_bytes, format="JPEG")
    img_bytes.seek(0)
    
    test_path = f"scans/test-diagnostic-{Path('__file__').stem}.jpg"
    storage = supabase_client.storage.from_(settings.supabase_storage_bucket)
    response = storage.upload(
        test_path,
        img_bytes.getvalue(),
        file_options={"content-type": "image/jpeg"},
    )
    print(f"✓ Test upload successful to: {test_path}")
    
    # Try to get public URL
    try:
        url = storage.get_public_url(test_path)
        print(f"✓ Public URL: {url}")
    except Exception as e:
        print(f"⚠ Could not get public URL: {e}")
        
except Exception as e:
    print(f"✗ Upload failed: {e}")
    print(f"  Check your RLS policies in Supabase:")
    print(f"  Storage → {settings.supabase_storage_bucket} → Policies")
    sys.exit(1)

print(f"\n✓ All checks passed! Image storage should work.")
