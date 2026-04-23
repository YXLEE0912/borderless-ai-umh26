"""
GLM Service - ilmu.ai API wrapper
Base URL: https://api.ilmu.ai/v1
Model: nemo-super
"""

import httpx
import json
import asyncio
from typing import AsyncGenerator, List, Dict, Any


GLM_BASE_URL = "https://api.ilmu.ai/v1"
GLM_MODEL = "nemo-super"
GLM_API_KEY = "sk-7ee2b5de82cc11fe04e972376925558057920892f0c53dc0"  


class GLMService:
    def __init__(self, api_key: str = GLM_API_KEY, model: str = GLM_MODEL):
        self.api_key = api_key
        self.model = model
        self.base_url = GLM_BASE_URL
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    # ─────────────────────────────────────────
    # BASIC CHAT (returns string)
    # ─────────────────────────────────────────

    async def chat(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        """Send chat messages and return assistant response string"""
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
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
            data = resp.json()

        return data["choices"][0]["message"]["content"]

    # ─────────────────────────────────────────
    # JSON CHAT (returns parsed dict)
    # ─────────────────────────────────────────

    async def chat_json(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        """Chat and parse JSON response. Strips markdown fences."""
        full_system = system_prompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation, no backticks."

        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": full_system},
                {"role": "user", "content": user_message},
            ],
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        raw = data["choices"][0]["message"]["content"]
        return self._parse_json_safe(raw)

    # ─────────────────────────────────────────
    # STREAMING CHAT
    # ─────────────────────────────────────────

    async def stream_chat(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """Stream chat response as SSE"""
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "stream": True,
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
                            data = json.loads(chunk)
                            delta = data["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield f"data: {json.dumps({'text': delta})}\n\n"
                        except (json.JSONDecodeError, KeyError):
                            continue

    # ─────────────────────────────────────────
    # COMPLIANCE ANALYSIS (specialized)
    # ─────────────────────────────────────────

    async def analyze_compliance(
        self,
        context: str,
        regulation_area: str,
        country: str = "Malaysia",
    ) -> Dict[str, Any]:
        """Deep compliance analysis for a specific regulatory area"""
        system = f"""You are a certified trade compliance officer specializing in {country} {regulation_area}.
        Provide detailed, actionable compliance analysis.
        Always cite specific regulations, acts, and government portals.
        Respond in JSON: {{
            "compliant": true/false,
            "risk_score": 0-100,
            "issues": [],
            "required_actions": [],
            "regulatory_references": [],
            "estimated_timeline_days": 0,
            "estimated_cost_myr": 0
        }}"""

        return await self.chat_json(system, context)

    # ─────────────────────────────────────────
    # DOCUMENT EXTRACTION
    # ─────────────────────────────────────────

    async def extract_document_data(
        self,
        doc_text: str,
        doc_type: str,
    ) -> Dict[str, Any]:
        """Extract structured data from uploaded documents"""
        system = f"""You are an expert at reading and extracting data from {doc_type} documents.
        Extract all relevant fields and validate the document.
        Respond in JSON with extracted fields and a 'is_valid' boolean."""

        return await self.chat_json(system, f"Document content:\n{doc_text}")

    # ─────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────

    def _parse_json_safe(self, raw: str) -> Dict[str, Any]:
        """Parse JSON from LLM response, handling markdown fences"""
        text = raw.strip()
        # Strip ```json ... ``` or ``` ... ```
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Return as raw text in a wrapper
            return {"raw_response": raw, "parse_error": True}