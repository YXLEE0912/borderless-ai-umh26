import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(supabase_url, supabase_key)

# Execute SQL directly
sql = """
CREATE TABLE IF NOT EXISTS scraped_content (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    content TEXT NOT NULL,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    content_length INTEGER,
    has_changed BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS scrape_history (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    event TEXT NOT NULL,
    content_length INTEGER,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS qa_history (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    asked_at TIMESTAMPTZ DEFAULT NOW(),
    sources_used INTEGER
);

CREATE INDEX IF NOT EXISTS idx_content_url_time 
ON scraped_content(url, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_url 
ON scrape_history(url, scraped_at DESC);
"""

try:
    result = supabase.rpc('exec_sql', {'sql': sql}).execute()
    print("✅ Tables created successfully!")
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nTry running the SQL manually in Supabase Dashboard:")
    print("https://supabase.com/dashboard/project/xpuqnzfonkeymedezzhw/sql/new")