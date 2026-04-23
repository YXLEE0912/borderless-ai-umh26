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
        regex_data = self._extract_with_regex(text)

        used_zai = False
        result = regex_data

        is_image = bool(mime_type and mime_type.startswith("image/"))
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
        content = (text or "").replace("\n", " ")
        hs_match = re.search(r"\b\d{4}(?:\.\d{2}(?:\.\d{2,4})?)?\b", content)
        goods_value_match = re.search(
            r"(?:goods\s*value|declared\s*value|invoice\s*value|total\s*value)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)",
            content,
            flags=re.IGNORECASE,
        )
        weight_match = re.search(r"(?:weight|gross\s*weight|net\s*weight)\s*[:=]?\s*([0-9]+(?:\.\d+)?)\s*kg", content, flags=re.IGNORECASE)
        incoterm_match = re.search(r"\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DPU|DAP|DDP)\b", content, flags=re.IGNORECASE)
        destination_match = re.search(r"(?:destination|ship\s*to|consignee\s*country)\s*[:=]\s*([A-Za-z ]{2,60})", content, flags=re.IGNORECASE)
        product_match = re.search(r"(?:product|item\s*description|goods)\s*[:=]\s*([A-Za-z0-9 .,'\-()]{3,120})", content, flags=re.IGNORECASE)

        return DocumentExtractedData(
            product_name=product_match.group(1).strip() if product_match else None,
            hs_code=hs_match.group(0) if hs_match else None,
            destination_country=destination_match.group(1).strip() if destination_match else None,
            weight_kg=float(weight_match.group(1)) if weight_match else None,
            declared_value=float(goods_value_match.group(1).replace(",", "")) if goods_value_match else None,
            incoterm=incoterm_match.group(1).upper() if incoterm_match else None,
        )

    def _merge_data(self, base: DocumentExtractedData, overlay: DocumentExtractedData) -> DocumentExtractedData:
        return DocumentExtractedData(
            product_name=overlay.product_name or base.product_name,
            hs_code=overlay.hs_code or base.hs_code,
            destination_country=overlay.destination_country or base.destination_country,
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

    def _txt(key: str) -> str | None:
        value = data.get(key)
        if value is None:
            return None
        text_value = str(value).strip()
        return text_value or None

    return DocumentExtractedData(
        product_name=_txt("product_name"),
        hs_code=_txt("hs_code"),
        destination_country=_txt("destination_country"),
        weight_kg=_num("weight_kg"),
        declared_value=_num("declared_value"),
        incoterm=_txt("incoterm"),
    )