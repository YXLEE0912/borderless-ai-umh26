"""
setup_pua122_db.py
==================

Import 4 sheets from PUA122_Export_Control_Schedule.xlsx into PostgreSQL,
with an expanded HS code index for exact, prefix, and range matching.

Usage:
    python setup_pua122_db.py

Dependencies:
    pip install pandas openpyxl psycopg2-binary
"""

import os
import re
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# ── Configuration (read from environment variables, consistent with your .env) ─────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("HS_DB_HOST",     "localhost"),
    "port":     int(os.getenv("HS_DB_PORT", "5432")),
    "dbname":   os.getenv("HS_DB_NAME",     "hsdb"),
    "user":     os.getenv("HS_DB_USER",     "postgres"),
    "password": os.getenv("HS_DB_PASSWORD", "ra9b0L%z"),
}
EXCEL_FILE = os.getenv("PUA122_EXCEL", "PUA122_Export_Control_Schedule.xlsx")


# ── HS Code interpretation functions ──────────────────────────────────────────────────────────

def _normalize_hs(raw: str) -> str:
    """Remove whitespace and standardize to XXXX.XX.XX format prefix (take first 4 digits for range comparison)"""
    return re.sub(r"\s+", "", raw)


def _extract_chapter(code: str) -> str:
    """Extract chapter number from HS code, e.g., '0602.20' -> '06', 'Chapter 1' -> '01'"""
    m = re.match(r"Chapter\s*(\d+)", code, re.I)
    if m:
        return m.group(1).zfill(2)
    digits = re.sub(r"[^\d]", "", code)
    return digits[:2] if len(digits) >= 2 else ""


def _hs_to_numeric(code: str) -> int:
    """
    Convert HS code to a sortable integer (take the first 10 digits), used for range comparison.
    Example: '0602.20.00' -> 6022000, '06.02' -> 602 (Chapter.Section)
    """
    digits = re.sub(r"[^\d]", "", code)
    # Uniformly extend to 10 digits
    digits = digits.ljust(10, "0")[:10]
    return int(digits)


def _parse_hs_cell(cell_value: str) -> list[dict]:
    """
    Parse an HS Code cell and return a list of expanded records.
    Each record contains: hs_prefix, hs_numeric_start, hs_numeric_end, hs_raw_token, is_range, is_chapter

    Supported formats:
    - Single:  0602.20.00 00
    - Comma-separated: 0602.20.00 00, 0602.90.90 00
    - Range:  01.01–01.05
    - Chapter range: Chapter 1–2
    - With exclusion: 44.03 (excl. Indonesia)
    """
    results = []
    if not cell_value or pd.isna(cell_value):
        return results

    cell_str = str(cell_value).strip()

    # Split by comma at the top level (ignore commas inside parentheses)
    tokens = _split_top_level(cell_str)

    for token in tokens:
        token = token.strip()
        if not token:
            continue

        # Extract exclusion notes (keep them, don't affect matching)
        excl_match = re.search(r"\(excl\.[^)]*\)", token, re.I)
        exclusion = excl_match.group(0) if excl_match else ""
        token_clean = re.sub(r"\([^)]*\)", "", token).strip()

        # Determine if it's a chapter-level entry (e.g., "Chapter 1" or "Chapter 1–2")
        is_chapter = bool(re.match(r"Chapter", token_clean, re.I))

        # Check for range (e.g., "01.01–01.05" or "Chapter 1–2")
        range_match = re.match(r"(.+?)\s*[–\-]\s*(.+)", token_clean)

        if range_match:
            start_raw = range_match.group(1).strip()
            end_raw = range_match.group(2).strip()
            start_n = _hs_to_numeric(_normalize_hs(re.sub(r"[^\d.]", "", start_raw)))
            end_n   = _hs_to_numeric(_normalize_hs(re.sub(r"[^\d.]", "", end_raw)))
            results.append({
                "hs_raw_token":      token.strip(),
                "hs_prefix":         _normalize_hs(re.sub(r"[^\d.]", "", start_raw))[:7],
                "hs_numeric_start":  start_n,
                "hs_numeric_end":    end_n,
                "is_range":          True,
                "is_chapter":        is_chapter,
                "exclusion_note":    exclusion,
            })
        else:
            # Single code, treat as both prefix and exact match
            code_digits = re.sub(r"[^\d.]", "", token_clean)
            norm = _normalize_hs(code_digits)
            n = _hs_to_numeric(norm)
            results.append({
                "hs_raw_token":      token.strip(),
                "hs_prefix":         norm[:7],
                "hs_numeric_start":  n,
                "hs_numeric_end":    n,
                "is_range":          False,
                "is_chapter":        is_chapter,
                "exclusion_note":    exclusion,
            })

    return results


def _split_top_level(s: str) -> list[str]:
    """Split a string at the top level, ignoring commas inside parentheses."""
    parts, depth, buf = [], 0, []
    for ch in s:
        if ch == "(":
            depth += 1
            buf.append(ch)
        elif ch == ")":
            depth -= 1
            buf.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return parts


# ── Reading Excel ────────────────────────────────────────────────────────────────

def load_sheets(filepath: str) -> dict:
    raw = pd.read_excel(filepath, sheet_name=None, header=None)
    sheets = {}
    for name, df in raw.items():
        if name == "Summary":
            df.columns = df.iloc[2].tolist()
            df = df.iloc[3:].reset_index(drop=True)
        else:
            df.columns = df.iloc[0].tolist()
            df = df.iloc[1:].reset_index(drop=True)
        df.dropna(how="all", inplace=True)
        df = df.astype(str).replace("nan", None)
        sheets[name] = df
    return sheets


# ── DDL ───────────────────────────────────────────────────────────────────────

DDL = """
-- Main table：contains original entries from the Excel, one row per schedule item
CREATE TABLE IF NOT EXISTS pua122_entries (
    id                  SERIAL PRIMARY KEY,
    schedule            TEXT NOT NULL,          -- 'Second', 'Third', 'Third (CITES)'
    item_no             TEXT,
    description         TEXT,
    hs_code_raw         TEXT,                   -- Original HS Code cell content
    destination         TEXT,
    issuing_body        TEXT
);

-- HS Code expanded index table (for fast querying)
CREATE TABLE IF NOT EXISTS pua122_hs_index (
    id                  SERIAL PRIMARY KEY,
    entry_id            INTEGER REFERENCES pua122_entries(id) ON DELETE CASCADE,
    hs_raw_token        TEXT,                   -- Original token, e.g., "01.01–01.05"
    hs_prefix           TEXT,                   -- Standardized prefix for prefix matching
    hs_numeric_start    BIGINT,                 -- Numerical start (for range matching)
    hs_numeric_end      BIGINT,                 -- Numerical end
    is_range            BOOLEAN DEFAULT FALSE,
    is_chapter          BOOLEAN DEFAULT FALSE,
    exclusion_note      TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pua122_hs_prefix  ON pua122_hs_index (hs_prefix);
CREATE INDEX IF NOT EXISTS idx_pua122_hs_range    ON pua122_hs_index (hs_numeric_start, hs_numeric_end);
CREATE INDEX IF NOT EXISTS idx_pua122_schedule    ON pua122_entries (schedule);
"""

SHEET_SCHEDULE_MAP = {
    "Second Schedule":        "Second",
    "Third Schedule":         "Third",
    "Third Schedule (CITES)": "Third (CITES)",
}


# ── Main function ────────────────────────────────────────────────────────────────────

def main():
    print("📂 Reading Excel …")
    sheets = load_sheets(EXCEL_FILE)

    print("🔌 Connecting to PostgreSQL …")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    print("🏗  Creating table structures …")
    # Drop existing tables to avoid duplicates, then create new ones
    cur.execute("DROP TABLE IF EXISTS pua122_hs_index CASCADE;")
    cur.execute("DROP TABLE IF EXISTS pua122_entries CASCADE;")
    for stmt in DDL.strip().split(";"):
        stmt = stmt.strip()
        if stmt:
            cur.execute(stmt)
    conn.commit()

    total_entries = 0
    total_index   = 0

    for sheet_name, schedule_label in SHEET_SCHEDULE_MAP.items():
        if sheet_name not in sheets:
            print(f"  ⚠  Sheet「{sheet_name}」dont exist in the Excel, skipping.")
            continue

        df = sheets[sheet_name]
        print(f"\n📥 Importing [{sheet_name}] → schedule='{schedule_label}' ({len(df)} rows)")

        for _, row in df.iterrows():
            item_no      = row.get("Item No.")
            description  = row.get("Description")
            hs_code_raw  = row.get("HS Code")
            destination  = row.get("Destination")
            issuing_body = row.get("Issuing Body / Permit Condition")

            if not description and not hs_code_raw:
                continue

            # Insert into main table
            cur.execute(
                """INSERT INTO pua122_entries
                   (schedule, item_no, description, hs_code_raw, destination, issuing_body)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                (schedule_label, item_no, description, hs_code_raw, destination, issuing_body),
            )
            entry_id = cur.fetchone()[0]
            total_entries += 1

            # Parse the HS Code cell and insert into index table
            if hs_code_raw and hs_code_raw != "None":
                tokens = _parse_hs_cell(hs_code_raw)
                if tokens:
                    execute_values(
                        cur,
                        """INSERT INTO pua122_hs_index
                           (entry_id, hs_raw_token, hs_prefix, hs_numeric_start,
                            hs_numeric_end, is_range, is_chapter, exclusion_note)
                           VALUES %s""",
                        [
                            (
                                entry_id,
                                t["hs_raw_token"],
                                t["hs_prefix"],
                                t["hs_numeric_start"],
                                t["hs_numeric_end"],
                                t["is_range"],
                                t["is_chapter"],
                                t["exclusion_note"],
                            )
                            for t in tokens
                        ],
                    )
                    total_index += len(tokens)

        conn.commit()
        print(f"  ✓ Complete")

    cur.close()
    conn.close()

    print(f"\n✅ Import completed!")
    print(f"   pua122_entries : {total_entries} rows")
    print(f"   pua122_hs_index: {total_index} index rows")
    print(f"\nYou can now use permit_lookup_service.py to query permits.")

if __name__ == "__main__":
    main()