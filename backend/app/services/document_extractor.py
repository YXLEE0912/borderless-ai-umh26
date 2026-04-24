from __future__ import annotations

import base64
import io
import json
import re

import httpx
from docx import Document as DocxDocument
from openpyxl import load_workbook
from pypdf import PdfReader

from app.schemas.documents import DocumentExtractedData, DocumentExtractionResponse
from app.services.zai_client import ZAIClient


def normalize_document_data(data: DocumentExtractedData) -> DocumentExtractedData:
    quantity = data.quantity if data.quantity is not None and data.quantity > 0 else None
    weight_kg = data.weight_kg if data.weight_kg is not None and data.weight_kg > 0 else None
    declared_value = data.declared_value if data.declared_value is not None and data.declared_value > 0 else None
    unit_price = data.unit_price if data.unit_price is not None and data.unit_price > 0 else None

    if declared_value is None and quantity is not None and unit_price is not None:
        declared_value = round(quantity * unit_price, 2)

    if unit_price is None and quantity is not None and declared_value is not None:
        unit_price = round(declared_value / quantity, 2)

    if declared_value is not None and quantity is not None and unit_price is not None:
        expected_declared_value = round(quantity * unit_price, 2)
        if abs(expected_declared_value - declared_value) > 0.01:
            declared_value = expected_declared_value

    return DocumentExtractedData(
        product_name=data.product_name,
        hs_code=data.hs_code,
        destination_country=data.destination_country,
        destination_address=data.destination_address,
        origin_region=data.origin_region,
        quantity=quantity,
        weight_kg=weight_kg,
        declared_value=declared_value,
        unit_price=unit_price,
        incoterm=data.incoterm,
    )


def _normalize_label_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _looks_like_weight_label(value: str) -> bool:
    normalized = _normalize_label_text(value)
    return normalized in {
        "weight",
        "grossweight",
        "netweight",
        "chargeableweight",
        "billableweight",
        "itemweight",
        "packageweight",
        "shipmentweight",
        "cargoweight",
        "grosswt",
        "netwt",
        "chargeablewt",
        "billablewt",
        "packagewt",
        "weightkg",
        "grossweightkg",
        "netweightkg",
    }


def _looks_like_quantity_label(value: str) -> bool:
    normalized = _normalize_label_text(value)
    return normalized in {
        "quantity",
        "qty",
        "totalqty",
        "itemqty",
        "piece",
        "pieces",
        "unit",
        "units",
        "carton",
        "cartons",
        "box",
        "boxes",
        "pack",
        "packs",
        "package",
        "packages",
        "pcs",
        "nos",
        "no",
        "count",
        "totalcount",
        "shippingunits",
    }


class DocumentExtractor:
    def __init__(
        self,
        zai_client: ZAIClient,
        has_zai_key: bool,
        google_cloud_api_key: str | None = None,
        openai_api_key: str | None = None,
        openai_model: str = "gpt-4o-mini",
    ):
        self.zai_client = zai_client
        self.has_zai_key = has_zai_key
        self.google_cloud_api_key = google_cloud_api_key
        self.openai_api_key = openai_api_key
        self.openai_model = openai_model

    async def extract(self, file_name: str, mime_type: str | None, content: bytes) -> DocumentExtractionResponse:
        notes: list[str] = []
        text = self._extract_text(file_name=file_name, mime_type=mime_type, content=content)

        is_image = bool(mime_type and mime_type.startswith("image/"))
        if is_image and self.google_cloud_api_key:
            try:
                ocr_text = await self._extract_text_with_google_vision(
                    image_bytes=content,
                    image_content_type=mime_type,
                )
                if ocr_text:
                    text = ocr_text
                    notes.append("OCR text extracted from image via Google Vision.")
            except Exception as error:
                notes.append(f"Google Vision OCR fallback used: {error.__class__.__name__}.")

        regex_data = self._extract_with_regex(text)
        regex_data = normalize_document_data(regex_data)

        used_zai = False
        result = regex_data

        if self.openai_api_key:
            try:
                openai_raw = await self._extract_with_openai(text_context=text, file_name=file_name)
                openai_data = parse_document_fields_json(openai_raw)
                result = normalize_document_data(self._merge_data(regex_data, openai_data))
                notes.append("Document fields extracted with OpenAI.")
            except Exception as error:
                notes.append(f"OpenAI extraction fallback used: {error.__class__.__name__}.")

        if self.has_zai_key:
            try:
                zai_raw = await self.zai_client.extract_document_fields(
                    text_context=text,
                    image_bytes=content if is_image else None,
                    image_content_type=mime_type,
                    file_name=file_name,
                )
                zai_data = parse_document_fields_json(zai_raw)
                result = normalize_document_data(self._merge_data(regex_data, zai_data))
                used_zai = True
                notes.append("Document fields extracted with Z.ai.")
            except Exception as error:
                notes.append(f"Z.ai extraction fallback used: {error.__class__.__name__}.")

        preview = text[:500] if text else None
        if not preview:
            notes.append("No text content detected in document.")

        return DocumentExtractionResponse(
            file_name=file_name,
            mime_type=mime_type,
            used_zai=used_zai,
            extracted_text_preview=preview,
            data=result,
            notes=notes,
        )

    def _extract_text(self, file_name: str, mime_type: str | None, content: bytes) -> str:
        lower_name = file_name.lower()
        mime = (mime_type or "").lower()

        if lower_name.endswith((".txt", ".csv", ".json", ".md")) or mime.startswith("text/"):
            return content.decode("utf-8", errors="ignore")

        if lower_name.endswith(".pdf") or mime == "application/pdf":
            reader = PdfReader(io.BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages)

        if lower_name.endswith(".docx") or mime in {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }:
            document = DocxDocument(io.BytesIO(content))
            return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())

        if lower_name.endswith(".xlsx") or mime in {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        }:
            workbook = load_workbook(io.BytesIO(content), data_only=True)
            cells: list[str] = []
            for sheet in workbook.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    for value in row:
                        if value is None:
                            continue
                        text = str(value).strip()
                        if text:
                            cells.append(text)
            return "\n".join(cells)

        return ""

    async def _extract_text_with_google_vision(self, image_bytes: bytes, image_content_type: str | None) -> str:
        encoded_image = base64.b64encode(image_bytes).decode("ascii")
        payload = {
            "requests": [
                {
                    "image": {"content": encoded_image},
                    "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
                }
            ]
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://vision.googleapis.com/v1/images:annotate",
                params={"key": self.google_cloud_api_key},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        responses = data.get("responses") or []
        if not responses:
            return ""

        first = responses[0] or {}
        text = ""
        full_text = first.get("fullTextAnnotation") or {}
        if isinstance(full_text, dict):
            text = str(full_text.get("text") or "").strip()

        if not text:
            annotations = first.get("textAnnotations") or []
            if annotations and isinstance(annotations, list):
                first_annotation = annotations[0] or {}
                text = str(first_annotation.get("description") or "").strip()

        return text

    async def _extract_with_openai(self, text_context: str | None, file_name: str | None) -> str:
        system_prompt = (
            "You extract shipping and customs fields from business documents. Return valid JSON only with keys: "
            "product_name, hs_code, destination_country, destination_address, origin_region, quantity, weight_kg, declared_value, unit_price, incoterm. "
            "origin_region must be one of: west, east, or null. "
            "If quantity/qty appears, map it to quantity. If a unit price is visible, map it to unit_price. "
            "Use null when missing. No markdown. Keep declared_value aligned with quantity x unit_price when both exist."
        )

        user_prompt = (
            f"file_name={file_name or 'unknown'}\n"
            f"text_context={(text_context or '')[:12000]}\n"
            "Extract the required fields from this document content."
        )

        payload = {
            "model": self.openai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }

        headers = {"Authorization": f"Bearer {self.openai_api_key}"}
        async with httpx.AsyncClient(base_url="https://api.openai.com/v1", timeout=60.0, headers=headers) as client:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

        return str(data["choices"][0]["message"]["content"] or "").strip()

    def _extract_with_regex(self, text: str) -> DocumentExtractedData:
        raw_text = text or ""
        content = raw_text.replace("\n", " ")

        hs_match = re.search(
            r"(?im)\b(?:hs(?:\s*code)?|tariff(?:\s*code)?)\s*[:=#-]?\s*([0-9]{4}(?:\.[0-9]{2}(?:\.[0-9]{2,4})?)?)\b",
            raw_text,
        )
        if not hs_match:
            hs_match = re.search(r"\b[0-9]{4}\.[0-9]{2}(?:\.[0-9]{2,4})?\b", raw_text)

        quantity_match = re.search(
            r"(?im)^\s*(?:quantity|qty|total\s*qty|total\s*quantity|item\s*qty|item\s*quantity|pcs|pieces|units|unit|cartons|boxes|packages|package|packs|pack|count|nos?)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:pcs|pieces|units|unit|cartons|boxes|packages|package|packs|pack|count|nos?)?\s*$",
            raw_text,
        )
        if not quantity_match:
            quantity_match = re.search(
                r"(?:quantity|qty|total\s*qty|total\s*quantity|item\s*qty|item\s*quantity|pcs|pieces|units|unit|cartons|boxes|packages|package|packs|pack|count|nos?)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)",
                content,
                flags=re.IGNORECASE,
            )

        if not quantity_match:
            quantity_match = re.search(
                r"(?im)^\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:pcs|pieces|units|unit|cartons|boxes|packages|package|packs|pack|count|nos?)\s*$",
                raw_text,
            )

        unit_price_match = re.search(
            r"(?im)^\s*(?:unit\s*price|price\s*per\s*(?:item|good|unit)|per\s*unit|item\s*price|unit\s*cost|rate|price)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)\s*$",
            raw_text,
        )
        if not unit_price_match:
            unit_price_match = re.search(
                r"(?:unit\s*price|price\s*per\s*(?:item|good|unit)|per\s*unit|item\s*price|unit\s*cost|rate|price)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)",
                content,
                flags=re.IGNORECASE,
            )

        goods_value_match = re.search(
            r"(?im)^\s*(?:goods\s*value|declared\s*value|invoice\s*value|invoice\s*amount|total\s*value|total\s*amount|item\s*value|merchandise\s*value|value|amount|total\s*price)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)\s*$",
            raw_text,
        )
        if not goods_value_match:
            goods_value_match = re.search(
                r"(?:goods\s*value|declared\s*value|invoice\s*value|invoice\s*amount|total\s*value|total\s*amount|item\s*value|merchandise\s*value|value|amount|total\s*price)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)",
                content,
                flags=re.IGNORECASE,
            )

        weight_match = re.search(
            r"(?im)^\s*(?:weight|gross\s*weight|net\s*weight|cargo\s*weight|shipment\s*weight|billable\s*weight|chargeable\s*weight|package\s*weight|item\s*weight|mass|gross\s*wt|net\s*wt|chargeable\s*wt|billable\s*wt|package\s*wt|grossweight|netweight|chargeableweight|billableweight)\s*[:=]?\s*([0-9]+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)?\b",
            raw_text,
        )
        if not weight_match:
            weight_match = re.search(
                r"(?:weight|gross\s*weight|net\s*weight|cargo\s*weight|shipment\s*weight|billable\s*weight|chargeable\s*weight|package\s*weight|item\s*weight|mass|gross\s*wt|net\s*wt|chargeable\s*wt|billable\s*wt|package\s*wt|grossweight|netweight|chargeableweight|billableweight)\s*[:=]?\s*([0-9]+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)?\b",
                content,
                flags=re.IGNORECASE,
            )

        if not weight_match:
            weight_match = re.search(
                r"(?im)^\s*([0-9]+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\s*(?:gross\s*weight|net\s*weight|cargo\s*weight|shipment\s*weight|billable\s*weight|chargeable\s*weight|package\s*weight|item\s*weight|weight|gross\s*wt|net\s*wt)\s*$",
                raw_text,
            )

        incoterm_match = re.search(r"\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DPU|DAP|DDP)\b", content, flags=re.IGNORECASE)

        destination_match = re.search(
            r"(?im)^\s*(?:destination(?:\s*country)?|country\s*of\s*destination|ship\s*-?\s*to|shipper\s*to|consignee\s*country|delivery\s*country|recipient\s*country|receiver\s*country|to)\s*[:=-]\s*([A-Za-z][A-Za-z ]{1,60})\s*$",
            raw_text,
        )
        if not destination_match:
            destination_match = re.search(
                r"(?:destination(?:\s*country)?|country\s*of\s*destination|ship\s*-?\s*to|shipper\s*to|consignee\s*country|delivery\s*country|recipient\s*country|receiver\s*country)\s*[:=-]\s*([A-Za-z][A-Za-z ]{1,60})",
                content,
                flags=re.IGNORECASE,
            )

        destination_address_match = re.search(
            r"(?im)^\s*(?:complete\s*address|full\s*address|destination\s*address|delivery\s*address|ship\s*-?\s*to\s*address|ship\s*-?\s*to|consignee\s*address|shipping\s*address|delivery\s*location|recipient\s*address|receiver\s*address|consignee\s*details|address\s*line(?:\s*[1-3])?|address)\s*[:=-]\s*([^\n]{3,200})\s*$",
            raw_text,
        )
        if not destination_address_match:
            destination_address_match = re.search(
                r"(?:complete\s*address|full\s*address|destination\s*address|delivery\s*address|ship\s*-?\s*to\s*address|ship\s*-?\s*to|consignee\s*address|shipping\s*address|delivery\s*location|recipient\s*address|receiver\s*address|consignee\s*details|address\s*line(?:\s*[1-3])?)\s*[:=-]\s*([^\n]{3,200})",
                content,
                flags=re.IGNORECASE,
            )

        product_match = re.search(
            r"(?im)^\s*(?:product\s*name|product|item\s*description|item\s*desc|goods\s*description|description|commodity|merchandise|cargo\s*description|goods|item)\s*[:=]\s*([^\n]{2,120})\s*$",
            raw_text,
        )
        if not product_match:
            product_match = re.search(
                r"(?:product\s*name|product|item\s*description|item\s*desc|goods\s*description|description|commodity|merchandise|cargo\s*description|goods|item)\s*[:=]\s*([A-Za-z0-9 .,'\-()]{3,120})",
                content,
                flags=re.IGNORECASE,
            )

        origin_region = self._infer_origin_region(raw_text)

        return DocumentExtractedData(
            product_name=product_match.group(1).strip() if product_match else None,
            hs_code=hs_match.group(0) if hs_match else None,
            destination_country=destination_match.group(1).strip() if destination_match else None,
            destination_address=destination_address_match.group(1).strip() if destination_address_match else None,
            origin_region=origin_region,
            quantity=float(quantity_match.group(1).replace(",", "")) if quantity_match else None,
            weight_kg=float(weight_match.group(1)) if weight_match else None,
            declared_value=float(goods_value_match.group(1).replace(",", "")) if goods_value_match else None,
            unit_price=float(unit_price_match.group(1).replace(",", "")) if unit_price_match else None,
            incoterm=incoterm_match.group(1).upper() if incoterm_match else None,
        )

    def _infer_origin_region(self, content: str):
        lowered = (content or "").lower()

        # Prefer explicit East Malaysia markers first.
        east_markers = (
            "east malaysia",
            "sabah",
            "sarawak",
            "kuching",
            "kota kinabalu",
            "bintulu",
            "miri",
        )
        if any(marker in lowered for marker in east_markers):
            return "east"

        west_markers = (
            "west malaysia",
            "peninsular malaysia",
            "selangor",
            "kuala lumpur",
            "johor",
            "penang",
            "malacca",
            "melaka",
            "perak",
            "kedah",
            "kelantan",
            "terengganu",
            "pahang",
            "negeri sembilan",
            "perlis",
        )
        if any(marker in lowered for marker in west_markers):
            return "west"

        # If document says origin from Malaysia without east-state markers,
        # default to west to match existing rate-card baseline.
        if "origin" in lowered and "malaysia" in lowered:
            return "west"

        return None

    def _merge_data(self, base: DocumentExtractedData, overlay: DocumentExtractedData) -> DocumentExtractedData:
        return DocumentExtractedData(
            product_name=overlay.product_name or base.product_name,
            hs_code=overlay.hs_code or base.hs_code,
            destination_country=overlay.destination_country or base.destination_country,
            destination_address=overlay.destination_address or base.destination_address,
            origin_region=overlay.origin_region or base.origin_region,
            quantity=overlay.quantity if overlay.quantity is not None else base.quantity,
            weight_kg=overlay.weight_kg if overlay.weight_kg is not None else base.weight_kg,
            declared_value=overlay.declared_value if overlay.declared_value is not None else base.declared_value,
            unit_price=overlay.unit_price if overlay.unit_price is not None else base.unit_price,
            incoterm=overlay.incoterm or base.incoterm,
        )


def parse_document_fields_json(content: str) -> DocumentExtractedData:
    text = (content or "").strip()
    if not text:
        raise ValueError("Empty JSON content from Z.ai")

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object for document extraction")

    def _num(key: str) -> float | None:
        value = data.get(key)
        if value is None or value == "":
            return None
        return float(value)

    def _num_any(keys: list[str]) -> float | None:
        for key in keys:
            value = data.get(key)
            if value is None or value == "":
                continue
            return float(value)
        return None

    def _txt(key: str) -> str | None:
        value = data.get(key)
        if value is None:
            return None
        text_value = str(value).strip()
        return text_value or None

    def _txt_any(keys: list[str]) -> str | None:
        for key in keys:
            text_value = _txt(key)
            if text_value:
                return text_value
        return None

    return DocumentExtractedData(
        product_name=_txt_any(["product_name", "product", "item", "item_description", "item description", "goods_description", "goods description", "description", "commodity", "merchandise", "cargo_description", "cargo description"]),
        hs_code=_txt_any(["hs_code", "hs code", "tariff_code", "tariff code", "customs_code", "customs code"]),
        destination_country=_txt_any(["destination_country", "destination country", "country_of_destination", "country of destination", "destination", "ship_to_country", "ship to country", "consignee_country", "consignee country", "delivery_country", "delivery country"]),
        destination_address=_txt_any(["destination_address", "destination address", "complete_address", "complete address", "full_address", "full address", "delivery_address", "delivery address", "ship_to_address", "ship to address", "consignee_address", "consignee address", "shipping_address", "shipping address", "recipient_address", "recipient address", "receiver_address", "receiver address", "address", "address_line_1", "address line 1", "address_line_2", "address line 2", "address_line_3", "address line 3"]),
        origin_region=_txt_any(["origin_region", "origin region", "origin"]),
        quantity=_num_any(["quantity", "qty", "total_qty", "total qty", "item_qty", "item qty", "pcs", "pieces", "units", "cartons", "boxes"]),
        weight_kg=_num_any(["weight_kg", "weight kg", "weight", "gross_weight", "gross weight", "net_weight", "net weight", "billable_weight", "billable weight", "chargeable_weight", "chargeable weight", "cargo_weight", "cargo weight"]),
        declared_value=_num_any(["declared_value", "declared value", "invoice_value", "invoice value", "goods_value", "goods value", "total_value", "total value", "item_value", "item value", "amount"]),
        unit_price=_num_any(["unit_price", "unit price", "price_per_unit", "price per unit", "price_per_item", "price per item", "item_price", "item price", "rate", "cost per unit"]),
        incoterm=_txt_any(["incoterm", "incoterms"]),
    )