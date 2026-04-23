from __future__ import annotations

import base64

import httpx


class ZAIClient:
    def __init__(self, api_key: str | None, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def analyze(
        self,
        prompt: str,
        destination_country: str | None = None,
        image_bytes: bytes | None = None,
        image_content_type: str | None = None,
        image_filename: str | None = None,
        merchant_name: str | None = None,
        merchant_ssm: str | None = None,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Z.ai API key is not configured")

        user_parts: list[dict] = [
            {
                "type": "text",
                "text": self._build_prompt(
                    prompt=prompt,
                    destination_country=destination_country,
                    merchant_name=merchant_name,
                    merchant_ssm=merchant_ssm,
                    image_filename=image_filename,
                ),
            }
        ]

        if image_bytes is not None:
            content_type = image_content_type or "image/png"
            user_parts.append(
                {
                    "type": "image_url",
                    "image_url": {"url": self._build_data_url(image_bytes, content_type)},
                }
            )

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a Malaysia export scanner for SMEs. Return JSON only with keys: "
                        "product_name, materials_detected, hs_code_candidates, hs_code_confidence, status, "
                        "compliance_summary, ssm_check, required_documents, required_permits, required_agencies, "
                        "logistics_extractions, logistics_sea_flow, logistics_sea_required_documents, rule_hits, "
                        "extraction_notes. "
                        "Use status values green, conditional, restricted, or review."
                    ),
                },
                {"role": "user", "content": user_parts},
            ],
            "temperature": 0.2,
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=60.0, headers=headers) as client:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

        return data["choices"][0]["message"]["content"]

    def _build_prompt(
        self,
        prompt: str,
        destination_country: str | None,
        merchant_name: str | None,
        merchant_ssm: str | None,
        image_filename: str | None,
    ) -> str:
        return (
            f"Product prompt: {prompt}\n"
            f"Destination country: {destination_country or 'unknown'}\n"
            f"Merchant name: {merchant_name or 'unknown'}\n"
            f"Merchant SSM: {merchant_ssm or 'unknown'}\n"
            f"Image filename: {image_filename or 'unknown'}\n"
            "Tasks: identify material, estimate HS candidates, check Malaysia prohibition layers, indicate permit and agency, "
            "validate SSM format if provided, and output sea logistics document checklist."
        )

    def _build_data_url(self, content: bytes, content_type: str) -> str:
        encoded = base64.b64encode(content).decode("ascii")
        return f"data:{content_type};base64,{encoded}"