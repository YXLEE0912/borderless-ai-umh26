from pydantic import BaseModel, Field

from app.schemas.cost import TransportMode


class DocumentGenerationRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=200)
    destination_country: str = Field(default="China", min_length=1, max_length=80)
    hs_code: str | None = None
    compliance_status: str = Field(default="review", min_length=1, max_length=40)
    required_documents: list[str] = Field(default_factory=list)
    required_permits: list[str] = Field(default_factory=list)
    required_agencies: list[str] = Field(default_factory=list)
    existing_documents: list[str] = Field(default_factory=list)
    transport_mode: TransportMode = TransportMode.sea
    declared_value: float = Field(default=1000.0, ge=0)
    weight_kg: float = Field(default=10.0, gt=0)
    volumetric_weight_kg: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=8)
    package_count: int = Field(default=1, ge=1)
    merchant_name: str | None = None


class DocumentItem(BaseModel):
    id: str
    label: str
    sublabel: str
    status: str
    required: bool = True


class CostContext(BaseModel):
    product_name: str
    destination_country: str
    transport_mode: TransportMode
    declared_value: float
    weight_kg: float
    volumetric_weight_kg: float | None = None
    currency: str = "USD"
    package_count: int = 1
    provided_documents: list[str] = Field(default_factory=list)


class DocumentGenerationResponse(BaseModel):
    workflow_stage: str = "agent_2"
    product_name: str
    destination_country: str
    hs_code: str | None = None
    compliance_status: str
    summary: str
    documents: list[DocumentItem] = Field(default_factory=list)
    carried_documents: list[DocumentItem] = Field(default_factory=list)
    missing_documents: list[str] = Field(default_factory=list)
    required_permits: list[str] = Field(default_factory=list)
    required_agencies: list[str] = Field(default_factory=list)
    workflow_steps: list[str] = Field(default_factory=list)
    can_proceed_to_cost: bool = False
    cost_context: CostContext
    notes: list[str] = Field(default_factory=list)


class DocumentExtractedData(BaseModel):
    product_name: str | None = None
    hs_code: str | None = None
    destination_country: str | None = None
    weight_kg: float | None = None
    declared_value: float | None = None
    incoterm: str | None = None


class DocumentExtractionResponse(BaseModel):
    file_name: str
    mime_type: str | None = None
    used_zai: bool = False
    extracted_text_preview: str | None = None
    data: DocumentExtractedData = Field(default_factory=DocumentExtractedData)
    notes: list[str] = Field(default_factory=list)