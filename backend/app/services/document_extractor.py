from __future__ import annotations

import io
import json
import re

from docx import Document as DocxDocument
from openpyxl import load_workbook
from pypdf import PdfReader

from app.schemas.documents import DocumentExtractedData, DocumentExtractionResponse
from app.services.zai_client import ZAIClient


class DocumentExtractor:
    def __init__(self, zai_client: ZAIClient, has_zai_key: bool):
        self.zai_client = zai_client
        self.has_zai_key = has_zai_key

    async def extract(self, file_name: str, mime_type: str | None, content: bytes) -> DocumentExtractionResponse:
        notes: list[str] = []
        text = self._extract_text(file_name=file_name, mime_type=mime_type, content=content)

        is_image = bool(mime_type and mime_type.startswith("image/"))
        if is_image and self.has_zai_key:
            try:
                ocr_text = await self.zai_client.extract_document_text(
                    image_bytes=content,
                    image_content_type=mime_type,
                    file_name=file_name,
                )
                if ocr_text:
                    text = ocr_text
                    notes.append("OCR text extracted from image via Z.ai.")
            except Exception as error:
                notes.append(f"Z.ai OCR fallback used: {error.__class__.__name__}.")

        regex_data = self._extract_with_regex(text)

        used_zai = False
        result = regex_data

        if self.has_zai_key:
            try:
                zai_raw = await self.zai_client.extract_document_fields(
                    text_context=text,
                    image_bytes=content if is_image else None,
                    image_content_type=mime_type,
                    file_name=file_name,
                )
                zai_data = parse_document_fields_json(zai_raw)
                result = self._merge_data(regex_data, zai_data)
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

    def _extract_with_regex(self, text: str) -> DocumentExtractedData:
        raw_text = text or ""
        content = raw_text.replace("\n", " ")

        hs_match = re.search(
            r"(?im)\b(?:hs(?:\s*code)?|tariff(?:\s*code)?)\s*[:=#-]?\s*([0-9]{4}(?:\.[0-9]{2}(?:\.[0-9]{2,4})?)?)\b",
            raw_text,
        )
        if not hs_match:
            hs_match = re.search(r"\b[0-9]{4}\.[0-9]{2}(?:\.[0-9]{2,4})?\b", raw_text)

        goods_value_match = re.search(
            r"(?im)^\s*(?:goods\s*value|declared\s*value|invoice\s*value|invoice\s*amount|total\s*value|total\s*amount|item\s*value|merchandise\s*value|value|amount|quantity|qty)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)\s*$",
            raw_text,
        )
        if not goods_value_match:
            goods_value_match = re.search(
                r"(?:goods\s*value|declared\s*value|invoice\s*value|invoice\s*amount|total\s*value|total\s*amount|item\s*value|merchandise\s*value|value|amount|quantity|qty)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)",
                content,
                flags=re.IGNORECASE,
            )

        weight_match = re.search(
            r"(?im)^\s*(?:weight|gross\s*weight|net\s*weight|cargo\s*weight|shipment\s*weight|billable\s*weight|chargeable\s*weight|package\s*weight|item\s*weight|mass)\s*[:=]?\s*([0-9]+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\b",
            raw_text,
        )
        if not weight_match:
            weight_match = re.search(
                r"(?:weight|gross\s*weight|net\s*weight|cargo\s*weight|shipment\s*weight|billable\s*weight|chargeable\s*weight|package\s*weight|item\s*weight|mass)\s*[:=]?\s*([0-9]+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\b",
                content,
                flags=re.IGNORECASE,
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
            weight_kg=float(weight_match.group(1)) if weight_match else None,
            declared_value=float(goods_value_match.group(1).replace(",", "")) if goods_value_match else None,
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
            weight_kg=overlay.weight_kg if overlay.weight_kg is not None else base.weight_kg,
            declared_value=overlay.declared_value if overlay.declared_value is not None else base.declared_value,
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
        weight_kg=_num_any(["weight_kg", "weight kg", "weight", "gross_weight", "gross weight", "net_weight", "net weight", "billable_weight", "billable weight", "chargeable_weight", "chargeable weight", "cargo_weight", "cargo weight"]),
        declared_value=_num_any(["declared_value", "declared value", "invoice_value", "invoice value", "goods_value", "goods value", "total_value", "total value", "item_value", "item value", "amount", "quantity", "qty"]),
        incoterm=_txt_any(["incoterm", "incoterms"]),
    )