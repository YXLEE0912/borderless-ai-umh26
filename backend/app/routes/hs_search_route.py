"""
HS Search Route — keyword search against the hs_codes table.
Falls back to AI-powered search if DB is unavailable.
"""

from fastapi import APIRouter, Query, HTTPException
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hs", tags=["HS Search"])

# ── DB config from env — NEVER hardcode passwords ─────────────────────────────
DB_CONFIG = {
    "dbname":   os.getenv("HS_DB_NAME", "hsdb"),
    "user":     os.getenv("HS_DB_USER", "postgres"),
    "password": os.getenv("HS_DB_PASSWORD", ""),
    "host":     os.getenv("HS_DB_HOST", "localhost"),
    "port":     int(os.getenv("HS_DB_PORT", "5432")),
}
DB_AVAILABLE = bool(os.getenv("HS_DB_PASSWORD"))


async def _ai_search_fallback(keyword: str) -> list:
    """Use AI to suggest HS codes when DB is unavailable."""
    from glmservice import get_glm
    glm = get_glm()
    result = await glm.chat_json(
        system_prompt="""You are an HS tariff expert. Given a search keyword,
return the top 5 most relevant HS codes.
Return JSON: {"results": [{"hscode": "XXXX.XX.XX", "description": ""}]}""",
        user_message=f"Search keyword: {keyword}",
    )
    return result.get("results", [])


@router.get("/search")
async def search_hs(
    keyword: str = Query(..., description="Keyword to search HS codes"),
):
    """
    Search HS codes by keyword.
    Uses DB if available, falls back to AI-powered search.
    """
    if DB_AVAILABLE:
        try:
            import psycopg2
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()
            cur.execute(
                """
                SELECT hscode, description
                FROM hs_codes
                WHERE description ILIKE %s OR hscode ILIKE %s
                ORDER BY
                    CASE WHEN hscode ILIKE %s THEN 0 ELSE 1 END,
                    length(description)
                LIMIT 10
                """,
                (f"%{keyword}%", f"%{keyword}%", f"{keyword}%"),
            )
            rows = cur.fetchall()
            cur.close()
            conn.close()
            if rows:
                return {
                    "source": "database",
                    "results": [{"hscode": r[0], "description": r[1]} for r in rows],
                }
        except Exception as e:
            logger.warning(f"DB search failed, falling back to AI: {e}")

    # AI fallback
    try:
        results = await _ai_search_fallback(keyword)
        return {"source": "ai", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")