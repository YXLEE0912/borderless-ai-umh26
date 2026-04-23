from enum import Enum

from pydantic import BaseModel, Field


class TransportMode(str, Enum):
    air = "air"
    sea = "sea"
    flight = "flight"
    ship = "ship"


class CostQuoteRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=200)
    destination_country: str = Field(min_length=1, max_length=80)
    transport_mode: TransportMode = TransportMode.air
    declared_value: float = Field(ge=0)
    weight_kg: float = Field(gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=8)
    package_count: int = Field(default=1, ge=1)
    volumetric_weight_kg: float | None = Field(default=None, ge=0)
    provided_documents: list[str] = Field(default_factory=list)
    insurance_rate: float = Field(default=0.01, ge=0, le=1)
    duty_rate: float = Field(default=0.05, ge=0, le=1)
    tax_rate: float = Field(default=0.1, ge=0, le=1)
    documentation_fee: float = Field(default=25.0, ge=0)
    customs_broker_fee: float = Field(default=45.0, ge=0)
    port_handling_fee: float = Field(default=35.0, ge=0)


class CostQuoteResponse(BaseModel):
    product_name: str
    destination_country: str
    transport_mode: str
    currency: str
    billable_weight_kg: float
    shipping_fee: float
    insurance_fee: float
    customs_duty: float
    import_tax: float
    documentation_fee: float
    customs_broker_fee: float
    port_handling_fee: float
    estimated_total_cost: float
    required_documents: list[str] = Field(default_factory=list)
    missing_documents: list[str] = Field(default_factory=list)
    documents_ready: bool = False
    notes: list[str] = Field(default_factory=list)
    export_pack: dict[str, object] = Field(default_factory=dict)