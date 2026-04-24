from __future__ import annotations

import asyncio
import json
import re


class GeminiVisionClient:
    def __init__(self, api_keys: list[str], model: str):
        self.api_keys = [key for key in api_keys if key]
        primary_model = (model or "").strip()
        self.models = _dedupe_models(
            [
                primary_model,
                "gemini-2.0-flash",
                "gemini-2.5-flash",
                "gemini-1.5-flash-latest",
            ]
        )

    @property
    def enabled(self) -> bool:
        return bool(self.api_keys)

    async def analyze_image(
        self,
        *,
        prompt: str,
        image_bytes: bytes,
        image_content_type: str | None,
    ) -> dict:
        if not self.enabled:
            raise RuntimeError("Gemini API keys are not configured")

        last_error: Exception | None = None
        for api_key in self.api_keys:
            for model_name in self.models:
                try:
                    return await self._analyze_with_key(
                        api_key=api_key,
                        model_name=model_name,
                        prompt=prompt,
                        image_bytes=image_bytes,
                        image_content_type=image_content_type,
                    )
                except Exception as error:
                    last_error = error
                    if "not found" in str(error).lower() or "not supported" in str(error).lower():
                        continue
                    break

        detail = str(last_error).strip() if last_error else "unknown error"
        if detail:
            detail = detail[:300]
        raise RuntimeError(
            f"Gemini vision failed for all configured keys: {last_error.__class__.__name__ if last_error else 'unknown'}: {detail}"
        )

    async def _analyze_with_key(
        self,
        *,
        api_key: str,
        model_name: str,
        prompt: str,
        image_bytes: bytes,
        image_content_type: str | None,
    ) -> dict:
        import google.generativeai as genai

        def _call() -> str:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                [
                    self._build_instruction(prompt),
                    {
                        "mime_type": image_content_type or "image/jpeg",
                        "data": image_bytes,
                    },
                ]
            )
            return (response.text or "").strip()

        raw = await asyncio.to_thread(_call)
        return self._parse_json(raw)

    def _build_instruction(self, prompt: str) -> str:
        return (
            "You are a product vision analyzer for export compliance. Return JSON only with keys: "
            "product_name (string), materials_detected (array of strings), visual_summary (string), "
            "brand_detected (string), packaging_text (array of strings), confidence (0..1). "
            "Do not include markdown. "
            f"User prompt context: {prompt}"
        )

    def _parse_json(self, raw: str) -> dict:
        cleaned = raw.strip()
        cleaned = re.sub(r"^```json\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        return {
            "product_name": "",
            "materials_detected": [],
            "visual_summary": cleaned[:500],
            "brand_detected": "",
            "packaging_text": [],
            "confidence": 0.0,
        }


def _dedupe_models(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = (value or "").strip()
        if not item:
            continue
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out