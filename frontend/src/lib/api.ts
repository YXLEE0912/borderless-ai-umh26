function resolveApiBaseUrl(): string {
  const fallback = "/api/v1";
  const raw = (import.meta.env.VITE_API_BASE_URL || fallback).trim();

  if (!raw) return fallback;

  // Keep relative values as same-origin paths so they work with Vite proxy.
  if (raw.startsWith("/")) {
    return raw.replace(/\/$/, "");
  }

  try {
    const parsed = new URL(raw);

    if (typeof window !== "undefined") {
      const pageOrigin = window.location.origin;
      const isSameOrigin = parsed.origin === pageOrigin;
      const isLoopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
      const isMixedContent = window.location.protocol === "https:" && parsed.protocol === "http:";

      // In hosted/HTTPS contexts, force same-origin API path to avoid unsafe frame/navigation errors.
      if ((isLoopback && !isSameOrigin) || isMixedContent) {
        return fallback;
      }
    }

    return raw.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

const API_BASE_URL = resolveApiBaseUrl();

export type CarriedDocument = {
  id: string;
  label: string;
  sublabel: string;
  status: string;
};

export type DocumentItem = {
  id: string;
  label: string;
  sublabel: string;
  status: string;
  required: boolean;
};

export type CostContext = {
  product_name: string;
  destination_country: string;
  transport_mode: "air" | "sea" | "flight" | "ship";
  declared_value: number;
  weight_kg: number;
  volumetric_weight_kg?: number | null;
  currency: string;
  package_count: number;
  provided_documents: string[];
};

export type DocumentGenerationResponse = {
  workflow_stage: string;
  product_name: string;
  destination_country: string;
  hs_code?: string | null;
  compliance_status: string;
  summary: string;
  documents: DocumentItem[];
  carried_documents: DocumentItem[];
  missing_documents: string[];
  required_permits: string[];
  required_agencies: string[];
  workflow_steps: string[];
  can_proceed_to_cost: boolean;
  cost_context: CostContext;
  notes: string[];
};

export type DocumentGenerationRequest = {
  product_name: string;
  destination_country: string;
  hs_code?: string | null;
  compliance_status: string;
  required_documents: string[];
  required_permits: string[];
  required_agencies: string[];
  existing_documents: string[];
  transport_mode: "air" | "sea" | "flight" | "ship";
  declared_value?: number;
  weight_kg?: number;
  volumetric_weight_kg?: number | null;
  currency?: string;
  package_count?: number;
  merchant_name?: string | null;
};

export type CostQuoteRequest = {
  product_name: string;
  destination_country: string;
  transport_mode: "air" | "sea" | "flight" | "ship";
  declared_value: number;
  weight_kg: number;
  currency: string;
  package_count: number;
  volumetric_weight_kg?: number | null;
  provided_documents: string[];
  insurance_rate?: number;
  duty_rate?: number;
  tax_rate?: number;
  documentation_fee?: number;
  customs_broker_fee?: number;
  port_handling_fee?: number;
};

export type CostQuoteResponse = {
  product_name: string;
  destination_country: string;
  transport_mode: string;
  currency: string;
  billable_weight_kg: number;
  shipping_fee: number;
  insurance_fee: number;
  customs_duty: number;
  import_tax: number;
  documentation_fee: number;
  customs_broker_fee: number;
  port_handling_fee: number;
  estimated_total_cost: number;
  required_documents: string[];
  missing_documents: string[];
  documents_ready: boolean;
  notes: string[];
  export_pack: Record<string, unknown>;
};

export type DocumentExtractedData = {
  product_name?: string | null;
  hs_code?: string | null;
  destination_country?: string | null;
  weight_kg?: number | null;
  declared_value?: number | null;
  incoterm?: string | null;
};

export type DocumentExtractionResponse = {
  file_name: string;
  mime_type?: string | null;
  used_zai: boolean;
  extracted_text_preview?: string | null;
  data: DocumentExtractedData;
  notes: string[];
};

export type BackendScanStatus = "green" | "conditional" | "restricted" | "review";

export type BackendScanResult = {
  product_name: string;
  materials_detected: string[];
  hs_code_candidates: string[];
  hs_code_confidence: number;
  hs_code_reasoning: string;
  status: BackendScanStatus;
  compliance_summary: string;
  ssm_check: string;
  required_documents: string[];
  required_permits: string[];
  required_agencies: string[];
  logistics_extractions: Record<string, string>;
  logistics_sea_flow: string[];
  logistics_sea_required_documents: string[];
  rule_hits: string[];
  extraction_notes: string[];
  decision_steps: { phase: string; decision: string; reason: string }[];
  follow_up_questions: string[];
  source: string;
};

export type BackendScanCreateResponse = {
  scan_id: string;
  status: BackendScanStatus;
  image_asset_url: string | null;
  tts_audio_url: string | null;
  result: BackendScanResult;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function generateDocuments(payload: DocumentGenerationRequest): Promise<DocumentGenerationResponse> {
  return requestJson<DocumentGenerationResponse>("/documents/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function quoteCosts(payload: CostQuoteRequest): Promise<CostQuoteResponse> {
  return requestJson<CostQuoteResponse>("/costs/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function extractDocumentFields(file: File, documentLabel?: string): Promise<DocumentExtractionResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (documentLabel) formData.append("document_label", documentLabel);

  const response = await fetch(`${API_BASE_URL}/documents/extract`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<DocumentExtractionResponse>;
}

export async function scanProduct(payload: {
  product_prompt?: string;
  destination_country?: string;
  merchant_name?: string;
  merchant_ssm?: string;
  product_image?: File | null;
}): Promise<BackendScanCreateResponse> {
  const formData = new FormData();
  if (payload.product_prompt) formData.append("product_prompt", payload.product_prompt);
  if (payload.destination_country) formData.append("destination_country", payload.destination_country);
  if (payload.merchant_name) formData.append("merchant_name", payload.merchant_name);
  if (payload.merchant_ssm) formData.append("merchant_ssm", payload.merchant_ssm);
  if (payload.product_image) formData.append("product_image", payload.product_image);

  const response = await fetch(`${API_BASE_URL}/scans`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<BackendScanCreateResponse>;
}

export { API_BASE_URL };