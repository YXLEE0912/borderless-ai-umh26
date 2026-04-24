from __future__ import annotations

import base64

import httpx


class ZAIClient:
    def __init__(
        self,
        api_key: str | None,
        base_url: str,
        model: str,
        timeout_seconds: float = 90.0,
        max_retries: int = 2,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max(0, max_retries)

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
                        "You are a Malaysia export scanner for SMEs. Return valid JSON only. "
                        "CRITICAL: All array fields must be JSON arrays of strings, NEVER strings themselves. "
                        "For example: materials_detected should be [\"leather\", \"metal\"], NOT \"leather metal\". "
                        "Each array element should be a complete, meaningful item (e.g., \"FSC pine wood\"), not single characters. "
                        "JSON keys (all required): "
                        "product_name (string), "
                        "materials_detected (array of material strings), "
                        "hs_code_candidates (array of HS codes), "
                        "hs_code_confidence (float 0.0-1.0), "
                        "hs_code_reasoning (short explanation of why those HS candidates were selected), "
                        "status (one of: green, conditional, restricted, review), "
                        "compliance_summary (string), "
                        "ssm_check (one of: valid, invalid_format, missing, unknown), "
                        "required_documents (array), "
                        "required_permits (array), "
                        "required_agencies (array), "
                        "logistics_extractions (object/dict), "
                        "logistics_sea_flow (array), "
                        "logistics_sea_required_documents (array), "
                        "rule_hits (array), "
                        "extraction_notes (array of note strings), "
                        "follow_up_questions (array of clarifying questions to ask user if data is unclear). "
                    ),
                },
                {"role": "user", "content": user_parts},
            ],
            "temperature": 0.2,
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}

        data = None
        last_error: Exception | None = None
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout_seconds, headers=headers) as client:
            for attempt in range(self.max_retries + 1):
                try:
                    response = await client.post("/chat/completions", json=payload)
                    response.raise_for_status()
                    data = response.json()
                    break
                except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.WriteTimeout, httpx.PoolTimeout) as error:
                    last_error = error
                    if attempt >= self.max_retries:
                        raise
                except httpx.HTTPStatusError as error:
                    last_error = error
                    if error.response.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                        continue
                    raise

        if not isinstance(data, dict):
            raise RuntimeError(
                f"Z.ai returned invalid response payload: {last_error.__class__.__name__ if last_error else 'unknown'}"
            )

        return data["choices"][0]["message"]["content"]

    async def chat_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        if not self.api_key:
            raise RuntimeError("Z.ai API key is not configured")

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [{"type": "text", "text": user_prompt}]},
            ],
            "temperature": temperature,
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=60.0, headers=headers) as client:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

        return data["choices"][0]["message"]["content"]

    async def extract_document_fields(
        self,
        text_context: str | None,
        image_bytes: bytes | None,
        image_content_type: str | None,
        file_name: str | None,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Z.ai API key is not configured")

        system_prompt = (
            "You extract shipping and customs fields from business documents. Return valid JSON only with keys: "
            "product_name, hs_code, destination_country, destination_address, origin_region, quantity, weight_kg, declared_value, unit_price, incoterm. "
            "origin_region must be one of: west, east, or null. "
            "If quantity/qty appears, map it to quantity. If a unit price is visible, map it to unit_price. "
            "Use null when missing. No markdown."
        )

        text_prompt = (
            f"file_name={file_name or 'unknown'}\n"
            f"text_context={(text_context or '')[:12000]}\n"
            "Extract the required fields from this document content."
        )

        content_parts: list[dict] = [{"type": "text", "text": text_prompt}]
        if image_bytes is not None:
            content_type = image_content_type or "image/png"
            content_parts.append(
                {
                    "type": "image_url",
                    "image_url": {"url": self._build_data_url(image_bytes, content_type)},
                }
            )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content_parts},
            ],
            "temperature": 0.0,
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=60.0, headers=headers) as client:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

        return data["choices"][0]["message"]["content"]

    async def extract_document_text(
        self,
        image_bytes: bytes,
        image_content_type: str | None,
        file_name: str | None,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Z.ai API key is not configured")

        system_prompt = (
            "You are an OCR transcriber for trade documents. "
            "Return plain text only, preserving important labels and values. "
            "No markdown, no JSON."
        )

        content_type = image_content_type or "image/png"
        content_parts: list[dict] = [
            {
                "type": "text",
                "text": (
                    f"Transcribe all visible text from this document image. file_name={file_name or 'unknown'}\n"
                    "Keep line breaks where possible."
                ),
            },
            {
                "type": "image_url",
                "image_url": {"url": self._build_data_url(image_bytes, content_type)},
            },
        ]

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content_parts},
            ],
            "temperature": 0.0,
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=60.0, headers=headers) as client:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

        return str(data["choices"][0]["message"]["content"] or "").strip()

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