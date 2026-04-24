"""
GLM Service — shared Z.ai (ZhipuAI) API wrapper
Base URL : https://open.bigmodel.cn/api/paas/v4
Model    : glm-4.5v  (override via GLM_MODEL env var)
"""

import httpx
import json
import os
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

Z_AI_API_KEY  = os.getenv("Z_AI_API_KEY")
Z_AI_BASE_URL = os.getenv("Z_AI_BASE_URL")
Z_AI_MODEL    = os.getenv("Z_AI_MODEL")


class GLMService:
    def __init__(
        self,
        api_key: str  = Z_AI_API_KEY,
        model: str    = Z_AI_MODEL,
        base_url: str = Z_AI_BASE_URL,
    ):
        if not api_key:
            raise ValueError("Z_AI_API_KEY is not set. Check your .env file.")
        self.api_key  = api_key
        self.model    = model
        self.base_url = base_url
        self.headers  = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type":  "application/json",
        }

    # ─────────────────────────────────────────────────────────────────────────
    # BASIC CHAT  →  returns plain string
    # ─────────────────────────────────────────────────────────────────────────

    async def chat(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        max_tokens: int   = 2048,
        temperature: float = 0.3,
    ) -> str:
        payload = {
            "model":       self.model,
            "max_tokens":  max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages,
            ],
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    # ─────────────────────────────────────────────────────────────────────────
    # JSON CHAT  →  returns parsed dict
    # ─────────────────────────────────────────────────────────────────────────

    async def chat_json(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int   = 2048,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        full_system = (
            system_prompt
            + "\n\nIMPORTANT: Respond with valid JSON only. "
              "No markdown fences, no explanation, no backticks."
        )
        payload = {
            "model":       self.model,
            "max_tokens":  max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": full_system},
                {"role": "user",   "content": user_message},
            ],
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        return self._parse_json_safe(raw)

    # ─────────────────────────────────────────────────────────────────────────
    # PARALLEL JSON CALLS  →  runs multiple prompts concurrently
    # ─────────────────────────────────────────────────────────────────────────

    async def chat_json_many(
        self,
        calls: List[Dict[str, str]],   # [{"system": "...", "user": "..."}, ...]
        max_tokens: int   = 2048,
        temperature: float = 0.1,
    ) -> List[Dict[str, Any]]:
        tasks = [
            self.chat_json(c["system"], c["user"], max_tokens, temperature)
            for c in calls
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [
            {"error": str(r)} if isinstance(r, Exception) else r
            for r in results
        ]

    # ─────────────────────────────────────────────────────────────────────────
    # STREAMING CHAT  →  yields SSE chunks
    # ─────────────────────────────────────────────────────────────────────────

    async def stream_chat(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model":      self.model,
            "max_tokens": max_tokens,
            "stream":     True,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages,
            ],
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        chunk = line[6:]
                        if chunk.strip() == "[DONE]":
                            break
                        try:
                            delta = (
                                json.loads(chunk)["choices"][0]["delta"]
                                .get("content", "")
                            )
                            if delta:
                                yield f"data: {json.dumps({'text': delta})}\n\n"
                        except (json.JSONDecodeError, KeyError):
                            continue

    # ─────────────────────────────────────────────────────────────────────────
    # COMPLIANCE ANALYSIS  (specialised wrapper)
    # ─────────────────────────────────────────────────────────────────────────

    async def analyze_compliance(
        self,
        context: str,
        regulation_area: str,
        country: str = "Malaysia",
    ) -> Dict[str, Any]:
        system = (
            f"You are a certified trade compliance officer specialising in "
            f"{country} {regulation_area}. "
            "Provide detailed, actionable compliance analysis. "
            "Always cite specific regulations, acts, and government portals. "
            "Return JSON: {"
            '"compliant": true, '
            '"risk_score": 0, '
            '"issues": [], '
            '"required_actions": [], '
            '"regulatory_references": [], '
            '"estimated_timeline_days": 0, '
            '"estimated_cost_myr": 0}'
        )
        return await self.chat_json(system, context)

    # ─────────────────────────────────────────────────────────────────────────
    # DOCUMENT EXTRACTION
    # ─────────────────────────────────────────────────────────────────────────

    async def extract_document_data(
        self,
        doc_text: str,
        doc_type: str,
    ) -> Dict[str, Any]:
        system = (
            f"You are an expert at reading and extracting data from "
            f"{doc_type} documents. "
            "Extract all relevant fields and validate the document. "
            'Return JSON with extracted fields and an "is_valid" boolean.'
        )
        return await self.chat_json(system, f"Document content:\n{doc_text}")

    # ─────────────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    def _parse_json_safe(self, raw: str) -> Dict[str, Any]:
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text  = "\n".join(lines[1:-1])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"raw_response": raw, "parse_error": True}


# ── Singleton for import convenience ─────────────────────────────────────────
_glm_instance: Optional[GLMService] = None

def get_glm() -> GLMService:
    """Return a shared GLMService instance (lazy singleton)."""
    global _glm_instance
    if _glm_instance is None:
        _glm_instance = GLMService()
    return _glm_instance