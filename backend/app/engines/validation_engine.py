"""
app/engines/validation_engine.py
==================================
Local validation — runs BEFORE any AI/GLM call.
Fast, free, no network needed.

Usage in a route:
    from app.engines.validation_engine import ValidationEngine, ValidationError

    errs = ValidationEngine.validate_entity(req.registration_number, req.company_name)
    if errs:
        raise HTTPException(status_code=422, detail=errs)
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Optional

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

SUPPORTED_CURRENCIES = {
    "MYR", "USD", "EUR", "GBP", "SGD", "CNY", "JPY",
    "AUD", "HKD", "THB", "IDR", "PHP", "VND", "INR",
}

VALID_INCOTERMS = {
    "EXW", "FCA", "FAS", "FOB", "CFR", "CIF",
    "CPT", "CIP", "DAP", "DPU", "DDP",
}

VALID_TRANSPORT_MODES = {"SEA", "AIR", "ROAD", "RAIL"}

VALID_PACKAGE_TYPES = {"CTN", "PALLET", "DRUM", "BAG", "BOX"}

# Malaysian ports of loading (common ones)
MY_PORTS = {
    "port klang", "klang", "penang port", "penang", "johor port",
    "johor", "kuching port", "kuching", "bintulu port", "bintulu",
    "kota kinabalu", "miri", "sandakan", "tanjung pelepas",
    "pelabuhan klang", "westport", "northport",
}

# Countries under active embargo / high-risk (simplified)
EMBARGOED_COUNTRIES = {
    "iran", "north korea", "dprk", "syria", "cuba",
    "myanmar", "russia", "belarus",
}

# ─────────────────────────────────────────────────────────────────────────────
# RESULT HELPERS
# ─────────────────────────────────────────────────────────────────────────────

class ValidationError(Exception):
    """Raise this to return a 422 with structured errors."""
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def _ok() -> list[str]:
    return []


def _err(*msgs: str) -> list[str]:
    return list(msgs)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class ValidationEngine:
    """
    All methods return a list[str] of error messages.
    Empty list = valid.
    Call raise_if_errors() to convert into an HTTPException-ready exception.
    """

    # ── Step 1: Entity / SSM ─────────────────────────────────────────────────

    @staticmethod
    def validate_brn(brn: str) -> list[str]:
        """
        Malaysian SSM Business Registration Number.
        Modern format: 12 digits, e.g. 202301045678
        Old format:    ######-## or similar (also accepted)
        """
        if not brn or not brn.strip():
            return _err("Registration number is required.")
        clean = re.sub(r"[\-\s]", "", brn.strip())
        if not clean.isdigit():
            return _err(f"BRN '{brn}' must contain digits only (dashes allowed).")
        if len(clean) not in (6, 7, 12):
            return _err(
                f"BRN '{brn}' has {len(clean)} digits — "
                "expected 12 (new format) or 6-7 (old format)."
            )
        return _ok()

    @staticmethod
    def validate_nric(nric: str) -> list[str]:
        """
        Malaysian NRIC: YYMMDD-PB-XXXX (12 digits, dashes optional).
        """
        if not nric:
            return _ok()   # Optional field
        clean = re.sub(r"[\-\s]", "", nric.strip())
        if not re.match(r"^\d{12}$", clean):
            return _err(
                f"Director NRIC '{nric}' invalid — "
                "must be 12 digits in format YYMMDD-PB-XXXX."
            )
        return _ok()

    @staticmethod
    def validate_company_name(name: str) -> list[str]:
        if not name or not name.strip():
            return _err("Company name is required.")
        if len(name.strip()) < 3:
            return _err("Company name is too short.")
        if len(name) > 200:
            return _err("Company name exceeds 200 characters.")
        return _ok()

    @staticmethod
    def match_ssm_extracted_vs_input(
        extracted: dict[str, Any],
        user_brn: str,
        user_company: str,
    ) -> list[str]:
        """
        After SSM upload, compare extracted fields vs what user typed.
        Returns mismatch warnings (not hard errors — user may have typed
        a trading name vs registered name).
        """
        errors: list[str] = []
        ext_brn = re.sub(r"[\-\s]", "", extracted.get("registration_number", ""))
        inp_brn = re.sub(r"[\-\s]", "", user_brn)
        if ext_brn and inp_brn and ext_brn != inp_brn:
            errors.append(
                f"BRN mismatch: SSM document shows '{ext_brn}', "
                f"you entered '{inp_brn}'. Please correct."
            )

        ext_name = extracted.get("company_name", "").strip().lower()
        inp_name = user_company.strip().lower()
        if ext_name and inp_name and ext_name != inp_name:
            errors.append(
                f"Company name mismatch: SSM document shows "
                f"'{extracted.get('company_name')}', you entered '{user_company}'. "
                "Minor differences (Sdn Bhd vs Sdn. Bhd.) are acceptable."
            )

        ext_status = extracted.get("company_status", "").lower()
        if ext_status and ext_status != "active":
            errors.append(
                f"SSM document shows company status as '{ext_status}'. "
                "Company must be ACTIVE to export."
            )

        exp = extracted.get("expiry_date", "")
        if exp:
            try:
                exp_date = datetime.strptime(exp, "%Y-%m-%d").date()
                if exp_date < date.today():
                    errors.append(
                        f"SSM certificate expired on {exp}. "
                        "Please renew before proceeding."
                    )
            except ValueError:
                pass   # Date format unknown — skip

        return errors

    # ── Step 2: Consignee ────────────────────────────────────────────────────

    @staticmethod
    def validate_consignee(
        buyer_name: str,
        buyer_country: str,
        buyer_address: str,
        incoterm: str,
    ) -> list[str]:
        errors: list[str] = []

        if not buyer_name or not buyer_name.strip():
            errors.append("Buyer name is required.")
        elif len(buyer_name.strip()) < 2:
            errors.append("Buyer name is too short.")

        if not buyer_country or not buyer_country.strip():
            errors.append("Buyer country is required.")
        else:
            country_lower = buyer_country.strip().lower()
            if country_lower in EMBARGOED_COUNTRIES:
                errors.append(
                    f"⚠️ '{buyer_country}' is flagged as high-risk / under sanctions. "
                    "Export may be prohibited. Contact MITI before proceeding."
                )
            if country_lower in ("malaysia", "my"):
                errors.append(
                    "Destination country cannot be Malaysia — "
                    "this is an export declaration system."
                )

        if not buyer_address or not buyer_address.strip():
            errors.append("Buyer address is required.")
        elif len(buyer_address.strip()) < 10:
            errors.append(
                "Buyer address is too short — include street, city, and country."
            )

        incoterm_upper = incoterm.upper().strip()
        if incoterm_upper not in VALID_INCOTERMS:
            errors.append(
                f"Incoterm '{incoterm}' is not recognised. "
                f"Valid options: {', '.join(sorted(VALID_INCOTERMS))}."
            )

        return errors

    @staticmethod
    def validate_buyer_email(email: Optional[str]) -> list[str]:
        if not email:
            return _ok()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email.strip()):
            return _err(f"Buyer email '{email}' is not a valid email address.")
        return _ok()

    # ── Step 3: HS Code ──────────────────────────────────────────────────────

    @staticmethod
    def validate_hs_code(hs: str) -> list[str]:
        """
        HS code: 8–10 digits, dots allowed (e.g. 1511.10.00 or 151110).
        """
        if not hs or not hs.strip():
            return _err("HS code is required.")
        clean = re.sub(r"[.\-\s]", "", hs.strip())
        if not clean.isdigit():
            return _err(
                f"HS code '{hs}' must contain digits only (dots allowed)."
            )
        if len(clean) not in range(6, 11):   # 6-10 digits
            return _err(
                f"HS code '{hs}' has {len(clean)} digits — "
                "expected 6–10 digits (e.g. 1511.10.00)."
            )
        return _ok()

    @staticmethod
    def validate_product_description(desc: str) -> list[str]:
        if not desc or not desc.strip():
            return _err("Product description is required.")
        if len(desc.strip()) < 5:
            return _err(
                "Product description is too short — "
                "provide enough detail for HS classification."
            )
        if len(desc) > 2000:
            return _err("Product description exceeds 2000 characters.")
        return _ok()

    # ── Step 4: Permit upload validation ─────────────────────────────────────

    @staticmethod
    def validate_permit_document(
        extracted: dict[str, Any],
        expected_hs_code: Optional[str] = None,
    ) -> list[str]:
        """
        After a permit cert is uploaded and extracted, validate it.
        """
        errors: list[str] = []

        exp = extracted.get("expiry_date", "")
        if exp:
            try:
                exp_date = datetime.strptime(exp[:10], "%Y-%m-%d").date()
                if exp_date < date.today():
                    errors.append(
                        f"Permit expired on {exp}. "
                        "Please obtain a renewed permit before proceeding."
                    )
                elif (exp_date - date.today()).days < 30:
                    errors.append(
                        f"Permit expires soon ({exp}). "
                        "Consider renewing to avoid delays."
                    )
            except ValueError:
                pass

        status = extracted.get("status", "").lower()
        if status and status not in ("valid", "active", "approved", ""):
            errors.append(
                f"Permit status is '{status}' — must be Valid/Active/Approved."
            )

        return errors

    # ── Step 5: Financial Valuation ──────────────────────────────────────────

    @staticmethod
    def validate_valuation(
        fob_value_myr: float,
        currency: str,
        exchange_rate: Optional[float],
        insurance_rate: float,
        freight_quote_myr: Optional[float],
    ) -> list[str]:
        errors: list[str] = []

        if fob_value_myr <= 0:
            errors.append("FOB value must be greater than 0.")
        if fob_value_myr > 500_000_000:
            errors.append(
                f"FOB value MYR {fob_value_myr:,.2f} seems extremely high. "
                "Please verify — this may be a data entry error."
            )

        currency_upper = currency.upper().strip()
        if currency_upper not in SUPPORTED_CURRENCIES:
            errors.append(
                f"Currency '{currency}' is not supported. "
                f"Supported: {', '.join(sorted(SUPPORTED_CURRENCIES))}."
            )

        if exchange_rate is not None:
            if exchange_rate <= 0:
                errors.append("Exchange rate must be greater than 0.")
            if currency_upper == "USD" and not (2.0 <= exchange_rate <= 8.0):
                errors.append(
                    f"USD/MYR rate {exchange_rate} is outside the expected range "
                    "(2.0–8.0). Please verify against BNM reference rate."
                )
            if currency_upper == "SGD" and not (2.0 <= exchange_rate <= 6.0):
                errors.append(
                    f"SGD/MYR rate {exchange_rate} is outside the expected range "
                    "(2.0–6.0). Please verify against BNM reference rate."
                )

        if not (0 < insurance_rate <= 0.05):
            errors.append(
                f"Insurance rate {insurance_rate * 100:.2f}% is outside "
                "the expected range (0.01%–5.00%)."
            )

        if freight_quote_myr is not None and freight_quote_myr < 0:
            errors.append("Freight cost cannot be negative.")

        return errors

    # ── Step 6: Logistics ────────────────────────────────────────────────────

    @staticmethod
    def validate_logistics(
        mode: str,
        port_of_loading: str,
        port_of_discharge: str,
        gross_weight_kg: float,
        cbm: float,
        export_date: Optional[str],
        vessel_name: Optional[str],
        flight_number: Optional[str],
    ) -> list[str]:
        errors: list[str] = []

        mode_upper = mode.upper().strip()
        if mode_upper not in VALID_TRANSPORT_MODES:
            errors.append(
                f"Transport mode '{mode}' is invalid. "
                f"Must be one of: {', '.join(VALID_TRANSPORT_MODES)}."
            )

        if not port_of_loading or not port_of_loading.strip():
            errors.append("Port of loading is required.")
        else:
            pol_lower = port_of_loading.strip().lower()
            if not any(p in pol_lower for p in MY_PORTS):
                errors.append(
                    f"Port of loading '{port_of_loading}' is not recognised as a "
                    "Malaysian port. Common ports: Port Klang, Penang Port, "
                    "Johor Port, Kuching Port, Tanjung Pelepas."
                )

        if not port_of_discharge or not port_of_discharge.strip():
            errors.append("Port of discharge is required.")

        if port_of_loading.strip().lower() == port_of_discharge.strip().lower():
            errors.append(
                "Port of loading and port of discharge cannot be the same."
            )

        if gross_weight_kg <= 0:
            errors.append("Gross weight must be greater than 0 kg.")
        if gross_weight_kg > 50000:
            errors.append(
                f"Gross weight {gross_weight_kg:,.0f} kg is very high. "
                "Please verify — single-shipment limit for most modes is 50,000 kg."
            )

        if cbm <= 0:
            errors.append("CBM (volume) must be greater than 0.")
        if cbm > 70:
            errors.append(
                f"CBM {cbm} exceeds a standard 40HC container (67 CBM). "
                "Please verify or split into multiple containers."
            )

        if export_date:
            try:
                exp = date.fromisoformat(export_date)
                if exp <= date.today():
                    errors.append(
                        f"Export date '{export_date}' must be in the future."
                    )
                if (exp - date.today()).days > 365:
                    errors.append(
                        f"Export date '{export_date}' is more than 1 year away. "
                        "Please verify."
                    )
            except ValueError:
                errors.append(
                    f"Export date '{export_date}' is invalid — use YYYY-MM-DD format."
                )

        if mode_upper == "SEA" and not vessel_name:
            errors.append(
                "Vessel name is required for sea shipments."
            )
        if mode_upper == "AIR" and not flight_number:
            errors.append(
                "Flight number is required for air shipments."
            )

        return errors

    @staticmethod
    def validate_signatory(
        name: Optional[str],
        ic_or_passport: Optional[str],
        designation: Optional[str],
    ) -> list[str]:
        errors: list[str] = []
        if not name or not name.strip():
            errors.append("Signatory name is required for K2 declaration.")
        if not ic_or_passport or not ic_or_passport.strip():
            errors.append(
                "Signatory IC or passport number is required for K2 declaration."
            )
        else:
            clean = re.sub(r"[\-\s]", "", ic_or_passport.strip())
            if len(clean) < 8:
                errors.append(
                    f"Signatory IC/passport '{ic_or_passport}' seems too short."
                )
        if not designation or not designation.strip():
            errors.append(
                "Signatory designation (job title) is required for K2 declaration."
            )
        return errors

    # ── Step 7: Document context completeness ────────────────────────────────

    @staticmethod
    def validate_session_for_documents(checklist: dict[str, Any]) -> list[str]:
        """
        Before generating trade docs (Step 8), check that all required
        upstream steps have data in the session.
        """
        REQUIRED_KEYS = {
            "entity_verification": "Step 1 — Entity Verification",
            "consignee":           "Step 2 — Consignee Details",
            "classification":      "Step 3 — HS Classification",
            "financial_valuation": "Step 6 — Financial Valuation",
            "logistics":           "Step 7 — Logistics Setup",
        }
        missing = []
        for key, label in REQUIRED_KEYS.items():
            if key not in checklist or not checklist[key]:
                missing.append(label)
        if missing:
            return [
                f"Cannot generate documents — the following steps are incomplete: "
                f"{', '.join(missing)}. Complete them first."
            ]
        return _ok()

    @staticmethod
    def validate_session_for_k2(checklist: dict[str, Any]) -> list[str]:
        """
        Before K2 submission (Step 9), all 8 prior steps must be done.
        """
        REQUIRED_KEYS = {
            "entity_verification": "Step 1 — Entity Verification",
            "consignee":           "Step 2 — Consignee Details",
            "classification":      "Step 3 — HS Classification",
            "financial_valuation": "Step 6 — Financial Valuation",
            "logistics":           "Step 7 — Logistics Setup",
            "documents":           "Step 8 — Trade Documents",
        }
        missing = []
        for key, label in REQUIRED_KEYS.items():
            if key not in checklist or not checklist[key]:
                missing.append(label)
        if missing:
            return [
                f"Cannot submit K2 — incomplete steps: {', '.join(missing)}."
            ]
        return _ok()

    # ── File upload validation ────────────────────────────────────────────────

    @staticmethod
    def validate_upload_file(
        content_type: str,
        file_size: int,
        allowed_types: Optional[set[str]] = None,
        max_bytes: int = 10 * 1024 * 1024,   # 10 MB
        min_bytes: int = 1024,                # 1 KB
    ) -> list[str]:
        errors: list[str] = []
        _allowed = allowed_types or {
            "application/pdf", "image/jpeg", "image/png", "image/jpg"
        }
        if content_type not in _allowed:
            errors.append(
                f"File type '{content_type}' is not accepted. "
                f"Allowed: {', '.join(sorted(_allowed))}."
            )
        if file_size < min_bytes:
            errors.append(
                f"File is too small ({file_size} bytes). "
                "Please upload the actual document, not a placeholder."
            )
        if file_size > max_bytes:
            errors.append(
                f"File size {file_size / (1024*1024):.1f} MB exceeds the "
                f"{max_bytes // (1024*1024)} MB limit."
            )
        return errors

    # ── Convenience: raise if any errors ─────────────────────────────────────

    @staticmethod
    def raise_if_errors(errors: list[str], status_code: int = 422) -> None:
        """
        Call this at the top of a route after collecting all errors.
        Raises ValidationError which the route should convert to HTTPException.

        Example:
            errs = (
                ValidationEngine.validate_brn(req.registration_number)
                + ValidationEngine.validate_company_name(req.company_name)
            )
            ValidationEngine.raise_if_errors(errs)
        """
        if errors:
            raise ValidationError(errors)