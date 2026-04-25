"""
app/services/permit_lookup_service.py
======================================

According to HS Code, query the PUA122 database for permit requirements.
Supports: exact match, prefix match, numeric range match (for HS code ranges like 01.01–01.05)

Usage:
    from app.services.permit_lookup_service import PermitLookupService
    service = PermitLookupService()
    result  = await service.lookup(hs_code="1511.10.00", destination="All countries")
"""

from __future__ import annotations

import os
import re
import logging
from typing import Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

# ── DB Config（align with hs_classification_route.py ） ───────────────────────
_DB_CONFIG = {
    "dbname":   os.getenv("HS_DB_NAME",     "hsdb"),
    "user":     os.getenv("HS_DB_USER",     "postgres"),
    "password": os.getenv("HS_DB_PASSWORD", ""),
    "host":     os.getenv("HS_DB_HOST",     "localhost"),
    "port":     int(os.getenv("HS_DB_PORT", "5432")),
}


def _hs_to_numeric(code: str) -> int:
    """numeric function consistent with setup_pua122_db.py."""
    digits = re.sub(r"[^\d]", "", code)
    digits = digits.ljust(10, "0")[:10]
    return int(digits)


def _normalize_prefix(hs_code: str) -> str:
    """
    standardize HS code for prefix matching.
    '1511.10.00 00' → '1511.10'
    '1511.10'       → '1511.10'
    """
    cleaned = re.sub(r"\s+", "", hs_code)
    norm = re.sub(r"[^\d.]", "", cleaned)
    return norm[:7]


class PermitLookupService:
    """Queries the PUA122 database to determine if an HS code requires export permits.
Uses a connection-per-request approach (can be replaced with asyncpg pool in production)."""

    def __init__(self):
        self._available: Optional[bool] = None  # lazy check

    def _get_conn(self):
        return psycopg2.connect(**_DB_CONFIG)

    def _is_available(self) -> bool:
        if self._available is None:
            try:
                conn = self._get_conn()
                cur = conn.cursor()
                cur.execute("SELECT 1 FROM pua122_entries LIMIT 1;")
                cur.close()
                conn.close()
                self._available = True
                logger.info("PUA122 DB connected successfully.")
            except Exception as e:
                self._available = False
                logger.warning(f"PUA122 DB not available: {e}")
        return self._available

    async def lookup(
        self,
        hs_code: str,
        destination: str = "",
    ) -> dict:
        """
        Main lookup function.

        Args:
            hs_code:     8-10 digit HS code, e.g. "1511.10.00" or "15111000"
            destination: destination country, e.g. "Japan" (optional, for filtering)

        Returns:
            {
              "db_available": True/False,
              "permits_found": True/False,
              "matches": [
                {
                  "schedule": "Second",
                  "item_no": "5.",
                  "description": "Palm oil ...",
                  "hs_code_raw": "1511.10.00 00, ...",
                  "destination": "All countries",
                  "issuing_body": "Ministry of Plantation and Commodities",
                  "match_type": "exact" | "prefix" | "range" | "chapter",
                }
              ],
              "permit_summary": {
                "requires_permit": True/False,
                "schedules_triggered": ["Second", "Third (CITES)"],
                "issuing_bodies": ["Ministry of...", ...],
                "destinations_affected": ["All countries"],
              }
            }
        """
        if not self._is_available():
            return {
                "db_available": False,
                "permits_found": False,
                "matches": [],
                "permit_summary": {
                    "requires_permit": False,
                    "schedules_triggered": [],
                    "issuing_bodies": [],
                    "destinations_affected": [],
                },
                "note": "PUA122 DB unavailable, falling back to AI-only mode.",
            }

        try:
            matches = self._query(hs_code, destination)
            requires_permit = len(matches) > 0

            schedules  = list({m["schedule"] for m in matches})
            bodies     = list({m["issuing_body"] for m in matches if m["issuing_body"]})
            dest_list  = list({m["destination"]  for m in matches if m["destination"]})

            return {
                "db_available":  True,
                "permits_found": requires_permit,
                "matches":       matches,
                "permit_summary": {
                    "requires_permit":       requires_permit,
                    "schedules_triggered":   schedules,
                    "issuing_bodies":        bodies,
                    "destinations_affected": dest_list,
                },
            }

        except Exception as e:
            logger.error(f"PUA122 lookup error: {e}", exc_info=True)
            return {
                "db_available": True,
                "permits_found": False,
                "matches": [],
                "permit_summary": {
                    "requires_permit": False,
                    "schedules_triggered": [],
                    "issuing_bodies": [],
                    "destinations_affected": [],
                },
                "error": str(e),
            }

    def _query(self, hs_code: str, destination: str) -> list[dict]:
        """
        Three-level matching strategy:
        1. Exact prefix matching (hs_prefix LIKE '1511.10%')
        2. Numeric range matching (hs_numeric_start <= N <= hs_numeric_end)
        3. Chapter-level matching (is_chapter=True, chapter number matching)
        """
        conn  = self._get_conn()
        cur   = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        prefix  = _normalize_prefix(hs_code)
        numeric = _hs_to_numeric(prefix)
        chapter = prefix[:2]  # e.g. "15"

        # Four-digit prefix (for LIKE matching), e.g. "1511"
        four_digit = re.sub(r"[^\d]", "", prefix)[:4]

        SQL = """
        SELECT DISTINCT
            e.id,
            e.schedule,
            e.item_no,
            e.description,
            e.hs_code_raw,
            e.destination,
            e.issuing_body,
            i.hs_raw_token,
            i.is_range,
            i.is_chapter,
            CASE
                WHEN i.hs_prefix = %(prefix)s                                     THEN 'exact'
                WHEN i.hs_prefix LIKE %(four_pct)s AND NOT i.is_range             THEN 'prefix'
                WHEN i.is_range
                     AND %(numeric)s BETWEEN i.hs_numeric_start AND i.hs_numeric_end THEN 'range'
                WHEN i.is_chapter
                     AND i.hs_prefix LIKE %(chapter_pct)s                         THEN 'chapter'
                ELSE 'other'
            END AS match_type
        FROM pua122_hs_index i
        JOIN pua122_entries  e ON e.id = i.entry_id
        WHERE
            -- 1. Exact prefix matching
            i.hs_prefix = %(prefix)s
            -- 2. Prefix inclusion (e.g., i.hs_prefix='1511.10', query='1511.10.00')
            OR (NOT i.is_range AND i.hs_prefix LIKE %(four_pct)s)
            -- 3. Range coverage
            OR (i.is_range AND %(numeric)s BETWEEN i.hs_numeric_start AND i.hs_numeric_end)
            -- 4. Chapter-level coverage
            OR (i.is_chapter AND i.hs_prefix LIKE %(chapter_pct)s)
        ORDER BY e.schedule, e.item_no
        LIMIT 20;
        """

        cur.execute(SQL, {
            "prefix":      prefix,
            "four_pct":    four_digit + "%",
            "numeric":     numeric,
            "chapter_pct": chapter + "%",
        })
        rows = cur.fetchall()
        cur.close()
        conn.close()

        return [dict(r) for r in rows]


# ── module-level singleton (shared across the entire application) ────────────────────────────────────────────────
_service_instance: Optional[PermitLookupService] = None

def get_permit_lookup_service() -> PermitLookupService:
    global _service_instance
    if _service_instance is None:
        _service_instance = PermitLookupService()
    return _service_instance