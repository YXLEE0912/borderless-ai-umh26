"""
scripts/setup_db.py
===================
Run once after cloning the project to set up the database.

This script will:
  1. Read database credentials from your .env file
  2. Create the pua122_entries and pua122_hs_index tables
  3. Import PUA122 permit data from the Excel file (if present)

Usage:
    cd backend
    python scripts/setup_db.py

Requirements:
    pip install -r requirements.txt
    PostgreSQL running with 'hsdb' database created
    .env file configured (copy from .env.example)
"""

import os, re, sys, pathlib

# ── Load .env file ────────────────────────────────────────────────────────────
def load_env():
    for candidate in [".env", "../.env"]:
        p = pathlib.Path(candidate)
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
            print(f"✅ Loaded {p.resolve()}")
            return
    print("⚠️  No .env found — using system environment variables")

load_env()

# ── Check dependencies ────────────────────────────────────────────────────────
try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("❌ Missing dependency: pip install psycopg2-binary")
    sys.exit(1)

# ── Database config (from .env) ───────────────────────────────────────────────
DB = {
    "host":     os.getenv("HS_DB_HOST",     "localhost"),
    "port":     int(os.getenv("HS_DB_PORT", "5432")),
    "dbname":   os.getenv("HS_DB_NAME",     "hsdb"),
    "user":     os.getenv("HS_DB_USER",     "postgres"),
    "password": os.getenv("HS_DB_PASSWORD", ""),
}

EXCEL_FILE = os.getenv("PUA122_EXCEL", "PUA122_Export_Control_Schedule.xlsx")

# ── Connect to PostgreSQL ─────────────────────────────────────────────────────
print(f"\n🔌 Connecting to {DB['user']}@{DB['host']}:{DB['port']}/{DB['dbname']} ...")
try:
    conn = psycopg2.connect(**DB)
    cur  = conn.cursor()
    print("✅ Connected\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print("\nTroubleshooting:")
    print("  1. Is PostgreSQL running?")
    print("  2. Does the database exist? Run: CREATE DATABASE hsdb;")
    print("  3. Check HS_DB_PASSWORD in your .env file")
    sys.exit(1)

# ── Create tables ─────────────────────────────────────────────────────────────
print("🏗  Creating tables ...")

# Drop existing tables first to avoid duplicate data on re-runs
cur.execute("DROP TABLE IF EXISTS pua122_hs_index CASCADE")
cur.execute("DROP TABLE IF EXISTS pua122_entries  CASCADE")

# Main table: one row per schedule item from the Excel
cur.execute("""
CREATE TABLE pua122_entries (
    id           SERIAL PRIMARY KEY,
    schedule     TEXT NOT NULL,    -- 'Second', 'Third', or 'Third (CITES)'
    item_no      TEXT,
    description  TEXT,
    hs_code_raw  TEXT,             -- Original HS Code cell (may contain multiple codes)
    destination  TEXT,
    issuing_body TEXT
)""")

# Index table: expanded HS codes for fast lookup (one row per parsed token)
cur.execute("""
CREATE TABLE pua122_hs_index (
    id                SERIAL PRIMARY KEY,
    entry_id          INTEGER REFERENCES pua122_entries(id) ON DELETE CASCADE,
    hs_raw_token      TEXT,        -- Original token, e.g. "01.01-01.05"
    hs_prefix         TEXT,        -- Normalized prefix for prefix matching
    hs_numeric_start  BIGINT,      -- Numeric start value for range matching
    hs_numeric_end    BIGINT,      -- Numeric end value for range matching
    is_range          BOOLEAN DEFAULT FALSE,
    is_chapter        BOOLEAN DEFAULT FALSE,
    exclusion_note    TEXT         -- e.g. "(excl. Indonesia)"
)""")

# Indexes for fast querying
cur.execute("CREATE INDEX idx_pua122_prefix   ON pua122_hs_index (hs_prefix)")
cur.execute("CREATE INDEX idx_pua122_range    ON pua122_hs_index (hs_numeric_start, hs_numeric_end)")
cur.execute("CREATE INDEX idx_pua122_schedule ON pua122_entries  (schedule)")
conn.commit()
print("✅ Tables created\n")

# ── HS Code parsing utilities ─────────────────────────────────────────────────

def _hs_to_numeric(code: str) -> int:
    """Convert an HS code string to a 10-digit integer for numeric range comparison."""
    digits = re.sub(r"[^\d]", "", code).ljust(10, "0")[:10]
    return int(digits)

def _split_top_level(s: str) -> list:
    """Split string by commas, ignoring commas inside parentheses."""
    parts, depth, buf = [], 0, []
    for ch in s:
        if ch == "(":   depth += 1; buf.append(ch)
        elif ch == ")": depth -= 1; buf.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(buf).strip()); buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return parts

def _parse_hs_cell(cell: str) -> list:
    """
    Parse a raw HS Code cell into individual indexable tokens.

    Handles formats:
      - Single code:      "1511.10.00 00"
      - Multiple codes:   "0602.20.00, 0602.90.90"
      - Range:            "01.01-01.05"
      - Chapter range:    "Chapter 1-2"
      - With exclusion:   "44.03 (excl. Indonesia)"
    """
    results = []
    if not cell or str(cell) in ("nan", "None", ""):
        return results

    for token in _split_top_level(str(cell).strip()):
        token = token.strip()
        if not token:
            continue

        # Extract and remove exclusion note before parsing
        excl_match = re.search(r"\(excl\.[^)]*\)", token, re.I)
        exclusion  = excl_match.group(0) if excl_match else ""
        clean      = re.sub(r"\([^)]*\)", "", token).strip()

        is_chapter = bool(re.match(r"Chapter", clean, re.I))

        # Check if this token is a range (e.g., "01.01-01.05")
        range_match = re.match(r"(.+?)\s*[–\-]\s*(.+)", clean)

        if range_match:
            start_raw = range_match.group(1).strip()
            end_raw   = range_match.group(2).strip()
            prefix    = re.sub(r"[^\d.]", "", start_raw)[:7]
            results.append({
                "hs_raw_token":     token,
                "hs_prefix":        prefix,
                "hs_numeric_start": _hs_to_numeric(prefix),
                "hs_numeric_end":   _hs_to_numeric(re.sub(r"[^\d.]", "", end_raw)),
                "is_range":         True,
                "is_chapter":       is_chapter,
                "exclusion_note":   exclusion,
            })
        else:
            norm = re.sub(r"[^\d.]", "", clean)[:7]
            n    = _hs_to_numeric(norm)
            results.append({
                "hs_raw_token":     token,
                "hs_prefix":        norm,
                "hs_numeric_start": n,
                "hs_numeric_end":   n,
                "is_range":         False,
                "is_chapter":       is_chapter,
                "exclusion_note":   exclusion,
            })
    return results

# ── Import Excel data ─────────────────────────────────────────────────────────

# Search for the Excel file in common locations
excel_candidates = [
    EXCEL_FILE,
    "data/PUA122_Export_Control_Schedule.xlsx",
    "../data/PUA122_Export_Control_Schedule.xlsx",
]
excel_path = next((p for p in excel_candidates if p and pathlib.Path(p).exists()), None)

if not excel_path:
    print("⚠️  PUA122 Excel file not found — skipping data import.")
    print("   Place the file here and re-run:  backend/PUA122_Export_Control_Schedule.xlsx")
    conn.close()
    print("\n✅ Schema ready (tables are empty — run again with the Excel file to import data)")
    sys.exit(0)

try:
    import pandas as pd
except ImportError:
    print("⚠️  pandas not installed. Run: pip install pandas openpyxl")
    conn.close()
    sys.exit(0)

print(f"📂 Importing from: {excel_path}")

# Read all sheets
raw = pd.read_excel(excel_path, sheet_name=None, header=None)

# Map Excel sheet names to schedule labels stored in the database
SHEET_MAP = {
    "Second Schedule":        "Second",
    "Third Schedule":         "Third",
    "Third Schedule (CITES)": "Third (CITES)",
}

total_entries = 0
total_index   = 0

for sheet_name, schedule_label in SHEET_MAP.items():
    if sheet_name not in raw:
        print(f"  ⚠  Sheet '{sheet_name}' not found in Excel, skipping")
        continue

    df = raw[sheet_name]
    df.columns = df.iloc[0].tolist()          # First row is the header
    df = df.iloc[1:].reset_index(drop=True)   # Data starts from row 2
    df.dropna(how="all", inplace=True)
    df = df.astype(str).replace("nan", None)

    print(f"  [{schedule_label}] {len(df)} rows ...", end=" ", flush=True)

    for _, row in df.iterrows():
        description  = row.get("Description")
        hs_code_raw  = row.get("HS Code")
        if not description and not hs_code_raw:
            continue

        # Insert the main entry row
        cur.execute(
            "INSERT INTO pua122_entries "
            "(schedule, item_no, description, hs_code_raw, destination, issuing_body) "
            "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
            (schedule_label, row.get("Item No."), description, hs_code_raw,
             row.get("Destination"), row.get("Issuing Body / Permit Condition")),
        )
        entry_id = cur.fetchone()[0]
        total_entries += 1

        # Parse and insert HS code index rows
        tokens = _parse_hs_cell(hs_code_raw)
        if tokens:
            execute_values(cur,
                "INSERT INTO pua122_hs_index "
                "(entry_id, hs_raw_token, hs_prefix, hs_numeric_start, "
                " hs_numeric_end, is_range, is_chapter, exclusion_note) "
                "VALUES %s",
                [(entry_id, t["hs_raw_token"], t["hs_prefix"],
                  t["hs_numeric_start"], t["hs_numeric_end"],
                  t["is_range"], t["is_chapter"], t["exclusion_note"])
                 for t in tokens],
            )
            total_index += len(tokens)

    conn.commit()
    print("✓")

cur.close()
conn.close()

print(f"""
╔══════════════════════════════════════╗
║  ✅ Database setup complete!         ║
╠══════════════════════════════════════╣
║  pua122_entries : {total_entries:<5} rows          ║
║  pua122_hs_index: {total_index:<5} index rows     ║
╚══════════════════════════════════════╝

Next steps:
  uvicorn main:app --reload --port 8000
  GET http://localhost:8000/classification/permit-check?hs_code=1511.10.00
""")