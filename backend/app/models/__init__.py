"""
models/__init__.py
Re-exports all models for clean imports across the app.

Usage:
    from app.models import ExportSession, ConsigneeRequest, K2FormData
"""

# Base / shared
from .base import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChecklistItem,
    ChecklistResponse,
    DocumentStatusItem,
    DocumentStatusResponse,
    ExportSession,
    TradeDoc,
    # Literals / type aliases
    DocStatus,
    IncotermType,
    RiskLevel,
    StepStatus,
    TradeMode,
)

# Step 1 — Entity
from .entity import (
    EntityVerification,
    EntityVerificationRequest,   # alias kept for backwards compat
    EntityVerifyRequest,
    EntityVerifyResponse,
    EntityVerificationResult,
    SSMUploadResponse,
)

# Step 2 — Consignee
from .consignee import (
    ConsigneeDetails,
    ConsigneeRequest,
    ConsigneeResponse,
    ConsigneeScreeningResult,
    IncotermRecommendation,
    IncotermSuitability,
    QuickSanctionsCheck,
)

# Step 3 — HS Classification
# FIX: was importing from .hs_classification which does not exist.
# The actual model file is hs_code.py.
from .hs_code import (
    FTAEligibilityResult,
    HSAlternative,
    HSAlternativesResult,
    HSClassification,
    HSClassificationResult,
    HSCodeRequest,
    HSCodeResponse,
    PreferentialDutyRates,
    RestrictedGoodsResult,
)

# Step 4 — Permits
from .permits import (
    ComplianceCheckResult,
    GanttMilestone,
    HalalRequirements,
    PermitCheckResult,
    PermitFlags,
    PermitItem,
    PermitTimeline,
    PermitsRequest,
    PermitsResponse,
    SIRIMRequirements,
    SpecialPermits,
    StrategicGoodsResult,
)

# Step 5 — Digital Access
from .digital_access import (
    DigitalAccessRequest,
    DigitalAccessResponse,
    DigitalAccessResult,
    DigitalCertificate,
    PortalRegistration,
    SetupStep,
)

# Step 6 — Valuation
from .valuation import (
    ChargeableWeightResult,
    CurrencyConversionResult,
    CustomsValuationBreakdown,
    FinancialValuation,
    FreightEstimate,
    FTAAnalysisResult,
    ValuationRequest,
    ValuationResponse,
)

# Step 7 — Logistics
from .logistics import (
    ConditionalDoc,
    ContainerRecommendation,
    LogisticsK2Validation,
    LogisticsMetrics,
    LogisticsRecommendation,
    LogisticsRequest,
    LogisticsResponse,
    MandatoryDoc,
    PortInfo,
    RequiredShippingDoc,
    ShippingDocsResult,
)

# Step 8 — Documents
from .documents import (
    BillOfLading,
    CertificateOfOrigin,
    CommercialInvoice,
    ConsigneeInfo,
    ContainerDetail,
    COOGoodsItem,
    DocumentValidationResult,
    ExporterInfo,
    GenerateDocsRequest,
    GenerateDocsResponse,
    InvoiceLineItem,
    PackageItem,
    PackingList,
    SignatoryInfo,
    TransportDetails,
)

# Step 9 — Customs / K2
from .customs import (
    ChecklistEntry,
    CustomsRequest,
    CustomsResponse,
    DagangNetStep,
    DutyCalculationCheck,
    DutyEstimate,
    K2Consignee,
    K2DeclarationResult,
    K2Duty,
    K2Exporter,
    K2FormData,
    K2FTA,
    K2Goods,
    K2Header,
    K2Signatory,
    K2StatusResponse,
    K2Transport,
    K2ValidationResult,
    K2Valuation,
)

__all__ = [
    # base
    "ChatMessage", "ChatRequest", "ChatResponse",
    "ChecklistItem", "ChecklistResponse",
    "DocumentStatusItem", "DocumentStatusResponse",
    "ExportSession", "TradeDoc",
    "DocStatus", "IncotermType", "RiskLevel", "StepStatus", "TradeMode",
    # entity
    "EntityVerification", "EntityVerificationRequest", "EntityVerifyRequest",
    "EntityVerifyResponse", "EntityVerificationResult", "SSMUploadResponse",
    # consignee
    "ConsigneeDetails", "ConsigneeRequest", "ConsigneeResponse",
    "ConsigneeScreeningResult", "IncotermRecommendation",
    "IncotermSuitability", "QuickSanctionsCheck",
    # hs
    "FTAEligibilityResult", "HSAlternative", "HSAlternativesResult",
    "HSClassification", "HSClassificationResult", "HSCodeRequest",
    "HSCodeResponse", "PreferentialDutyRates", "RestrictedGoodsResult",
    # permits
    "ComplianceCheckResult", "GanttMilestone", "HalalRequirements",
    "PermitCheckResult", "PermitFlags", "PermitItem", "PermitTimeline",
    "PermitsRequest", "PermitsResponse", "SIRIMRequirements",
    "SpecialPermits", "StrategicGoodsResult",
    # digital access
    "DigitalAccessRequest", "DigitalAccessResponse", "DigitalAccessResult",
    "DigitalCertificate", "PortalRegistration", "SetupStep",
    # valuation
    "ChargeableWeightResult", "CurrencyConversionResult",
    "CustomsValuationBreakdown", "FinancialValuation", "FreightEstimate",
    "FTAAnalysisResult", "ValuationRequest", "ValuationResponse",
    # logistics
    "ConditionalDoc", "ContainerRecommendation", "LogisticsK2Validation",
    "LogisticsMetrics", "LogisticsRecommendation", "LogisticsRequest",
    "LogisticsResponse", "MandatoryDoc", "PortInfo",
    "RequiredShippingDoc", "ShippingDocsResult",
    # documents
    "BillOfLading", "CertificateOfOrigin", "CommercialInvoice",
    "ConsigneeInfo", "ContainerDetail", "COOGoodsItem",
    "DocumentValidationResult", "ExporterInfo", "GenerateDocsRequest",
    "GenerateDocsResponse", "InvoiceLineItem", "PackageItem",
    "PackingList", "SignatoryInfo", "TransportDetails",
    # customs
    "ChecklistEntry", "CustomsRequest", "CustomsResponse",
    "DagangNetStep", "DutyCalculationCheck", "DutyEstimate",
    "K2Consignee", "K2DeclarationResult", "K2Duty", "K2Exporter",
    "K2FormData", "K2FTA", "K2Goods", "K2Header", "K2Signatory",
    "K2StatusResponse", "K2Transport", "K2ValidationResult", "K2Valuation",
]