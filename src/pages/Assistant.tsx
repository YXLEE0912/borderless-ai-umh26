/**
 * Assistant.tsx — Borderless AI · Compliance Architect
 * Full 9-step export workflow with real modals, forms, permit upload,
 * digital access checklist, valuation, logistics, e-signature & K2 preview.
 */

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  Building2, FileCheck2, Award, FileSearch,
  ShieldCheck, Sparkles, Mic, ArrowUp, Loader2, Paperclip,
  Cog, Link2, AlertTriangle, ExternalLink, Upload, ArrowRight,
  CheckCircle2, Lock, FileText, FileSpreadsheet, Ship, ClipboardList,
  Stamp, Leaf, Download, TrendingDown, Info, KeyRound,
  UserSquare2, Coins, PackageSearch, PenLine, X, Eye,
  Package, Calendar, Weight, Hash, Plane, Truck, Train,
  DollarSign, Percent, Globe, FileImage, Check, ChevronDown,
  AlertCircle, RefreshCw, Send,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = (() => {
  const fromVite = typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_API_URL : undefined;
  const fromNext = typeof process !== "undefined" ? (process.env as any).NEXT_PUBLIC_API_URL : undefined;
  const raw = fromVite || fromNext || "";
  const cleaned = raw.replace(/\/$/, "");
  if (cleaned.includes("localhost") || cleaned.includes("127.0.0.1")) return "";
  return cleaned;
})();

async function apiRequest(method: string, path: string, body?: unknown, params?: Record<string, string>) {
  let url = `${BASE_URL}${path}`;
  if (params) url += `?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiUpload(path: string, file: File, params?: Record<string, string>) {
  let url = `${BASE_URL}${path}`;
  if (params) url += `?${new URLSearchParams(params)}`;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const api = {
  createSession: () => apiRequest("POST", "/sessions"),
  chat: (sid: string, message: string) => apiRequest("POST", "/chat", { session_id: sid, message, stream: false }),
  verifyEntity: (sid: string, data: object) => apiRequest("POST", "/entity/verify", { session_id: sid, ...data }),
  uploadSsm: (sid: string, file: File) => apiUpload("/entity/upload-ssm", file, { session_id: sid }),
  addConsignee: (sid: string, data: object) => apiRequest("POST", "/consignee/add", { session_id: sid, ...data }),
  classifyHSCode: (sid: string, data: object) => apiRequest("POST", "/classification/hs-code", { session_id: sid, ...data }),
  uploadProduct: (sid: string, file: File) => apiUpload("/classification/upload-product", file, { session_id: sid }),
  checkPermits: (sid: string, data: object) => apiRequest("POST", "/permits/check", { session_id: sid, ...data }),
  setupDigitalAccess: (sid: string, company_brn: string) => apiRequest("POST", "/digital-access/setup", null, { session_id: sid, company_brn }),
  calculateValuation: (sid: string, data: object) => apiRequest("POST", "/valuation/calculate", { session_id: sid, ...data }),
  setupLogistics: (sid: string, data: object) => apiRequest("POST", "/logistics/setup", { session_id: sid, ...data }),
  generateDocs: (sid: string) => apiRequest("POST", "/trade-docs/generate", null, { session_id: sid }),
  submitK2: (sid: string) => apiRequest("POST", "/customs/submit-k2", null, { session_id: sid }),
  searchHS: (keyword: string) => apiRequest("GET", "/hs/search", undefined, { keyword }),
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type ChecklistStatus = "REQUIRED" | "PENDING" | "COMPLETED";
type DocStatus = "ready" | "partial" | "locked";

type Step = { id: number; title: string; subtitle: string; icon: React.ElementType };

const STEPS: Step[] = [
  { id: 0, title: "Entity Verification",   subtitle: "SSM & BRN Registration",   icon: Building2 },
  { id: 1, title: "Consignee Details",      subtitle: "Buyer & Importer Info",     icon: UserSquare2 },
  { id: 2, title: "Classification",         subtitle: "HS Code & Duty Lookup",     icon: FileSearch },
  { id: 3, title: "Special Permits",        subtitle: "SIRIM / Halal / MITI",      icon: Award },
  { id: 4, title: "Digital Access",         subtitle: "MyCIEDS & Dagang Net",      icon: KeyRound },
  { id: 5, title: "Financial Valuation",    subtitle: "FOB, Freight & FX",         icon: Coins },
  { id: 6, title: "Logistics & Metrics",    subtitle: "Mode, Vessel, Weight",      icon: PackageSearch },
  { id: 7, title: "Trade Docs & Signatory", subtitle: "Invoice, B/L, Declaration", icon: FileText },
  { id: 8, title: "Customs Submission",     subtitle: "K2 Form Preview",           icon: FileCheck2 },
];

type ChecklistItem = { label: string; status: ChecklistStatus };
type ActionButton = { label: string; icon: React.ElementType; intent: "primary" | "ghost"; action: string };

type Message =
  | { id: string; role: "user"; kind: "text"; content: string }
  | { id: string; role: "user"; kind: "upload"; content: string; fileName: string }
  | { id: string; role: "assistant"; kind: "processing"; content: string }
  | { id: string; role: "assistant"; kind: "text"; content: string }
  | { id: string; role: "assistant"; kind: "checklist"; content: string; items: ChecklistItem[]; actions?: ActionButton[] }
  | { id: string; role: "assistant"; kind: "options"; content: string; options: { label: string; value: string }[] }
  | { id: string; role: "assistant"; kind: "blocked"; content: string }
  | { id: string; role: "assistant"; kind: "reference"; content: string; refTitle: string; refUrl: string }
  | { id: string; role: "assistant"; kind: "extracted"; content: string; fields: Record<string, string>; valid: boolean }
  | { id: string; role: "assistant"; kind: "hs-result"; content: string; hsCode: string; description: string; duty: number; fta: string[]; permitRequired: boolean; permits: string[] }
  | { id: string; role: "assistant"; kind: "permit-upload"; content: string; permits: Array<{ name: string; key: string; uploaded: boolean }> }
  | { id: string; role: "assistant"; kind: "valuation"; content: string; fob: number; freight: number; insurance: number; duty: number; total: number; savings: number; bestFta: string }
  | { id: string; role: "assistant"; kind: "k2-preview"; content: string; k2Data: Record<string, unknown> };

const genId = () => Math.random().toString(36).slice(2);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DOCS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
type ExportDoc = {
  id: string; label: string; sublabel: string; icon: React.ElementType;
  requiredSteps: number[]; coreRequired?: boolean;
  conditionalKey?: "needsSirim" | "needsHalal" | "needsCoo";
};

const EXPORT_DOCS: ExportDoc[] = [
  { id: "commercial-invoice", label: "Commercial Invoice",        sublabel: "Buyer & seller details, FOB value, FX",    icon: FileText,       requiredSteps: [0,1,2,5], coreRequired: true },
  { id: "packing-list",       label: "Packing List",              sublabel: "Item weights, dimensions & quantities",     icon: FileSpreadsheet, requiredSteps: [0,1,2,6], coreRequired: true },
  { id: "bol",                label: "Bill of Lading / AWB",      sublabel: "Carrier, vessel & routing information",     icon: Ship,           requiredSteps: [0,1,2,6,7], coreRequired: true },
  { id: "k2",                 label: "K2 Declaration Form",       sublabel: "Customs export declaration (signed)",       icon: ClipboardList,  requiredSteps: [0,1,2,3,4,5,6,7], coreRequired: true },
  { id: "coo",                label: "Certificate of Origin",     sublabel: "ATIGA / FTA Form D",                        icon: Stamp,          requiredSteps: [0,1,2,3], conditionalKey: "needsCoo" },
  { id: "sirim",              label: "SIRIM Certificate",         sublabel: "Standards & quality compliance",            icon: ShieldCheck,    requiredSteps: [0,2,3],   conditionalKey: "needsSirim" },
  { id: "halal",              label: "Halal Certificate",         sublabel: "JAKIM-recognised certification",            icon: Leaf,           requiredSteps: [0,2,3,4], conditionalKey: "needsHalal" },
];

type PermitFlags = { needsSirim: boolean; needsHalal: boolean; needsCoo: boolean };
const DEFAULT_PERMIT_FLAGS: PermitFlags = { needsSirim: false, needsHalal: false, needsCoo: false };

const isGating = (doc: ExportDoc, flags: PermitFlags) => {
  if (doc.coreRequired) return true;
  if (doc.conditionalKey && flags[doc.conditionalKey]) return true;
  return false;
};

const docStatus = (doc: ExportDoc, completed: Set<number>): DocStatus => {
  const missing = doc.requiredSteps.filter(s => !completed.has(s)).length;
  if (missing === 0) return "ready";
  if (missing <= 2) return "partial";
  return "locked";
};

const UPLOAD_ACTION_MAP: Record<string, { accept: string; endpoint: string }> = {
  "upload-ssm":     { accept: ".pdf,.jpg,.jpeg,.png", endpoint: "/entity/upload-ssm" },
  "upload-product": { accept: ".pdf,.jpg,.jpeg,.png", endpoint: "/classification/upload-product" },
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-border px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-secondary transition-base text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-base"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-base pr-8"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}

// ── Consignee Modal ──────────────────────────────────────────────────────────
function ConsigneeModal({ onClose, onSubmit, loading }: {
  onClose: () => void;
  onSubmit: (data: object) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    buyer_name: "", buyer_country: "", buyer_address: "",
    buyer_email: "", buyer_phone: "", buyer_contact_person: "",
    buyer_tax_id: "", importer_of_record: "", incoterm: "FOB",
  });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Step 2 — Consignee Details" subtitle="Buyer information for Commercial Invoice & B/L" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <Field label="Buyer / Consignee Company Name" required><Input value={form.buyer_name} onChange={set("buyer_name")} placeholder="PT Sumber Rasa" /></Field>
        <Field label="Buyer Country" required><Input value={form.buyer_country} onChange={set("buyer_country")} placeholder="Indonesia" /></Field>
        <Field label="Buyer Full Address" required><Input value={form.buyer_address} onChange={set("buyer_address")} placeholder="Jl. Sudirman No.1, Jakarta Pusat 10110" /></Field>
        <Field label="Contact Person"><Input value={form.buyer_contact_person} onChange={set("buyer_contact_person")} placeholder="Ahmad Rizal" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" required><Input value={form.buyer_email} onChange={set("buyer_email")} placeholder="buyer@company.com" type="email" /></Field>
          <Field label="Phone"><Input value={form.buyer_phone} onChange={set("buyer_phone")} placeholder="+62 21 1234567" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tax / VAT ID"><Input value={form.buyer_tax_id} onChange={set("buyer_tax_id")} placeholder="01.234.567.8-901.000" /></Field>
          <Field label="Incoterm" required>
            <Select value={form.incoterm} onChange={set("incoterm")} options={["FOB","CIF","DAP","DDP","EXW","CFR","CIP","CPT","DPU","FAS","FCA"]} />
          </Field>
        </div>
        <Field label="Importer of Record (if different from buyer)"><Input value={form.importer_of_record} onChange={set("importer_of_record")} placeholder="Same as buyer" /></Field>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-base">Cancel</button>
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !form.buyer_name || !form.buyer_country || !form.buyer_address || !form.buyer_email}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirm Consignee
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Valuation Modal ──────────────────────────────────────────────────────────
function ValuationModal({ onClose, onSubmit, loading, hsCode }: {
  onClose: () => void;
  onSubmit: (data: object) => Promise<void>;
  loading: boolean;
  hsCode: string;
}) {
  const [form, setForm] = useState({
    fob_value_myr: "", freight_quote_myr: "", insurance_rate: "0.005",
    invoice_currency: "MYR", invoice_amount_foreign: "", exchange_rate_to_myr: "",
    destination_country: "", hs_code: hsCode, incoterm: "FOB",
    fta_exemption_ref: "", import_duty_rate: "",
  });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const isForeign = form.invoice_currency !== "MYR";

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Step 5 — Financial Valuation" subtitle="FOB → CIF → Duty breakdown for K2 declaration" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl bg-primary-soft/50 border border-primary/20 px-3 py-2.5 text-[11px] text-primary">
          💡 RMCD requires CIF valuation. Provide FOB value — freight & insurance are added automatically.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice Currency" required>
            <Select value={form.invoice_currency} onChange={set("invoice_currency")} options={["MYR","USD","EUR","GBP","SGD","CNY","JPY","AUD","HKD"]} />
          </Field>
          <Field label="Destination Country" required><Input value={form.destination_country} onChange={set("destination_country")} placeholder="Indonesia" /></Field>
        </div>

        {isForeign && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Invoice Amount (${form.invoice_currency})`}><Input value={form.invoice_amount_foreign} onChange={set("invoice_amount_foreign")} placeholder="1000.00" /></Field>
            <Field label="Exchange Rate to MYR"><Input value={form.exchange_rate_to_myr} onChange={set("exchange_rate_to_myr")} placeholder="4.72 (BNM)" /></Field>
          </div>
        )}

        <Field label="FOB Value (MYR)" required><Input value={form.fob_value_myr} onChange={set("fob_value_myr")} placeholder="4720.00" /></Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Freight Cost (MYR)" required><Input value={form.freight_quote_myr} onChange={set("freight_quote_myr")} placeholder="210.00" /></Field>
          <Field label="Insurance Rate"><Input value={form.insurance_rate} onChange={set("insurance_rate")} placeholder="0.005 = 0.5%" /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Import Duty Rate (0–1)"><Input value={form.import_duty_rate} onChange={set("import_duty_rate")} placeholder="0.05 = 5%" /></Field>
          <Field label="Incoterm"><Select value={form.incoterm} onChange={set("incoterm")} options={["FOB","CIF","DAP","DDP","EXW","CFR"]} /></Field>
        </div>

        <div className="border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">FTA Exemption (Optional)</p>
          <Field label="FTA Exemption Reference (if claiming Form D/RCEP)">
            <Input value={form.fta_exemption_ref} onChange={set("fta_exemption_ref")} placeholder="ATIGA Form D · Ref CO-2026-00123" />
          </Field>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            To claim FTA duty savings you need: ① Product on FTA list ② Rules of Origin met ③ CO certificate issued
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-base">Cancel</button>
        <button
          onClick={() => onSubmit({ ...form, fob_value_myr: parseFloat(form.fob_value_myr) || 0, freight_quote_myr: parseFloat(form.freight_quote_myr) || undefined, insurance_rate: parseFloat(form.insurance_rate) || 0.005, import_duty_rate: parseFloat(form.import_duty_rate) || undefined, invoice_amount_foreign: parseFloat(form.invoice_amount_foreign) || undefined, exchange_rate_to_myr: parseFloat(form.exchange_rate_to_myr) || undefined })}
          disabled={loading || !form.fob_value_myr || !form.destination_country}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
          Calculate Valuation
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Shipment / Logistics Modal ───────────────────────────────────────────────
function ShipmentModal({ onClose, onSubmit, loading }: {
  onClose: () => void;
  onSubmit: (data: object) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    mode: "SEA", port_of_loading: "Port Klang", port_of_discharge: "",
    vessel_name: "", flight_number: "", voyage_number: "",
    container_number: "", export_date: "",
    gross_weight_kg: "", net_weight_kg: "", cbm: "",
    number_of_packages: "", package_type: "CTN",
    signatory_name: "", signatory_ic_or_passport: "", signatory_designation: "",
  });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const modeIcon = { SEA: Ship, AIR: Plane, ROAD: Truck, RAIL: Train }[form.mode] || Ship;
  const ModeIcon = modeIcon;

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Step 6 — Shipment Details" subtitle="Logistics & transport info for K2 & Bill of Lading" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">

        {/* Mode */}
        <Field label="Mode of Transport" required>
          <div className="grid grid-cols-4 gap-2">
            {(["SEA","AIR","ROAD","RAIL"] as const).map(m => {
              const Icon = { SEA: Ship, AIR: Plane, ROAD: Truck, RAIL: Train }[m];
              return (
                <button key={m} onClick={() => set("mode")(m)} className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-base ${form.mode === m ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}>
                  <Icon className="h-4 w-4" />{m}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Ports */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Port of Loading (Malaysia)" required><Input value={form.port_of_loading} onChange={set("port_of_loading")} placeholder="Port Klang" /></Field>
          <Field label="Port of Discharge" required><Input value={form.port_of_discharge} onChange={set("port_of_discharge")} placeholder="Tanjung Priok" /></Field>
        </div>

        {/* Vessel / Flight */}
        <div className="grid grid-cols-2 gap-3">
          {form.mode === "SEA" && <Field label="Vessel Name" required><Input value={form.vessel_name} onChange={set("vessel_name")} placeholder="MV Bunga Mas 5" /></Field>}
          {form.mode === "AIR" && <Field label="Flight Number" required><Input value={form.flight_number} onChange={set("flight_number")} placeholder="MH 713" /></Field>}
          {(form.mode === "SEA" || form.mode === "AIR") && <Field label="Voyage / Flight No"><Input value={form.voyage_number} onChange={set("voyage_number")} placeholder="0412W" /></Field>}
          {form.mode === "SEA" && <Field label="Container Number"><Input value={form.container_number} onChange={set("container_number")} placeholder="MSKU-7842150" /></Field>}
        </div>

        <Field label="Scheduled Export Date" required><Input value={form.export_date} onChange={set("export_date")} type="date" /></Field>

        {/* Weights & Dimensions */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Gross Weight (kg)" required><Input value={form.gross_weight_kg} onChange={set("gross_weight_kg")} placeholder="480" /></Field>
          <Field label="Net Weight (kg)"><Input value={form.net_weight_kg} onChange={set("net_weight_kg")} placeholder="440" /></Field>
          <Field label="Volume (m³)" required><Input value={form.cbm} onChange={set("cbm")} placeholder="1.2" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number of Packages"><Input value={form.number_of_packages} onChange={set("number_of_packages")} placeholder="12" /></Field>
          <Field label="Package Type"><Select value={form.package_type} onChange={set("package_type")} options={["CTN","PALLET","DRUM","BAG","BOX"]} /></Field>
        </div>

        {/* Signatory */}
        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><PenLine className="h-3.5 w-3.5" />Authorised Signatory for K2 & Trade Docs</p>
          <Field label="Full Name" required><Input value={form.signatory_name} onChange={set("signatory_name")} placeholder="Aisyah Rahman" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="NRIC / Passport No." required><Input value={form.signatory_ic_or_passport} onChange={set("signatory_ic_or_passport")} placeholder="880412-14-5566" /></Field>
            <Field label="Job Title / Designation" required><Input value={form.signatory_designation} onChange={set("signatory_designation")} placeholder="Director" /></Field>
          </div>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-base">Cancel</button>
        <button
          onClick={() => onSubmit({ ...form, gross_weight_kg: parseFloat(form.gross_weight_kg) || 0, net_weight_kg: parseFloat(form.net_weight_kg) || undefined, cbm: parseFloat(form.cbm) || 0, number_of_packages: parseInt(form.number_of_packages) || undefined })}
          disabled={loading || !form.port_of_discharge || !form.export_date || !form.gross_weight_kg || !form.cbm || !form.signatory_name || !form.signatory_ic_or_passport || !form.signatory_designation}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ModeIcon className="h-4 w-4" />}
          Confirm Shipment
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Digital Access Modal ─────────────────────────────────────────────────────
function DigitalAccessModal({ onClose, onSubmit, loading, companyBrn }: {
  onClose: () => void;
  onSubmit: (brn: string, agentCode: string) => Promise<void>;
  loading: boolean;
  companyBrn: string;
}) {
  const [myciedsOk, setMyciedsOk] = useState(false);
  const [dagangOk,  setDagangOk]  = useState(false);
  const [certOk,    setCertOk]    = useState(false);
  const [agentCode, setAgentCode] = useState("");
  const [dagangId,  setDagangId]  = useState("");
  const connected = myciedsOk && dagangOk;

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Step 4 — Digital Access Setup" subtitle="Required for K2 submission via MyDagangNet / MyECIS" onClose={onClose} />
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          {/* MyCIEDS */}
          <div className="flex items-start gap-3">
            <button onClick={() => setMyciedsOk(v => !v)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-base ${myciedsOk ? "border-success bg-success text-white" : "border-border bg-background"}`}>
              {myciedsOk && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">MyCIEDS Account <span className="ml-1 rounded-full bg-danger-soft px-1.5 py-px text-[9px] font-bold text-danger">REQUIRED</span></p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Royal Malaysian Customs e-customs system. Register at mycustoms.gov.my</p>
            </div>
          </div>

          {/* Dagang Net */}
          <div className="flex items-start gap-3">
            <button onClick={() => setDagangOk(v => !v)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-base ${dagangOk ? "border-success bg-success text-white" : "border-border bg-background"}`}>
              {dagangOk && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Dagang Net Subscription <span className="ml-1 rounded-full bg-danger-soft px-1.5 py-px text-[9px] font-bold text-danger">REQUIRED</span></p>
              <p className="text-[11px] text-muted-foreground mt-0.5">EDI portal for submitting K2 declarations. Register at dagangnet.com.my</p>
              {dagangOk && (
                <div className="mt-2">
                  <Input value={dagangId} onChange={setDagangId} placeholder="Dagang Net User ID (optional)" />
                </div>
              )}
            </div>
          </div>

          {/* Digital Certificate */}
          <div className="flex items-start gap-3">
            <button onClick={() => setCertOk(v => !v)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-base ${certOk ? "border-success bg-success text-white" : "border-border bg-background"}`}>
              {certOk && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Digital Certificate (Token) <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-px text-[9px] font-bold text-warning">REQUIRED</span></p>
              <p className="text-[11px] text-muted-foreground mt-0.5">PKI certificate from MSC Trustgate or Pos Digicert. Required for e-signature on K2.</p>
            </div>
          </div>
        </div>

        <Field label="Customs Agent Code (if using agent — optional)">
          <Input value={agentCode} onChange={setAgentCode} placeholder="e.g. CA-MY-12345" />
        </Field>

        {connected && (
          <div className="flex items-center gap-2 rounded-xl bg-success-soft border border-success/30 px-3 py-2.5 text-[12px] font-semibold text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Dagang Net connected. Ready for K2 submission.
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-base">Cancel</button>
        <button
          onClick={() => onSubmit(companyBrn, agentCode)}
          disabled={loading || !connected}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {connected ? "Confirm Digital Access" : "Tick boxes above to proceed"}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── E-Signature Modal ────────────────────────────────────────────────────────
function SignatureModal({ signatoryName, signatoryTitle, onClose, onSign }: {
  signatoryName: string; signatoryTitle: string;
  onClose: () => void; onSign: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });

  const doSign = () => { setSigned(true); setTimeout(() => { onSign(); }, 800); };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Declaration of Truth — E-Signature" subtitle="Required for K2 submission under Customs Act 1967" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-foreground leading-relaxed">
          <p className="font-semibold mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Declaration</p>
          <p>
            I, <strong>{signatoryName || "[Signatory Name]"}</strong> ({signatoryTitle || "[Designation]"}),
            hereby declare that the particulars given in this export declaration and all accompanying
            trade documents are true and correct to the best of my knowledge and belief.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            This declaration is made pursuant to Section 121 of the Customs Act 1967 (Act 235).
            False declaration is an offence under Section 135.
          </p>
          <p className="mt-3 font-medium">Date: {today}</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <button onClick={() => setAgreed(v => !v)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-base ${agreed ? "border-primary bg-primary text-white" : "border-border bg-background"}`}>
            {agreed && <Check className="h-3 w-3" />}
          </button>
          <span className="text-sm text-foreground">I confirm the declaration above and authorise submission of the K2 export declaration on my behalf.</span>
        </label>

        {signed && (
          <div className="flex items-center gap-2 rounded-xl bg-success-soft border border-success/30 px-3 py-2.5 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Signed. Documents are ready for final review.
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground">Cancel</button>
        <button
          onClick={doSign}
          disabled={!agreed || signed}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base"
        >
          {signed ? <CheckCircle2 className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
          {signed ? "Signed ✓" : "Sign Declaration"}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── K2 Preview Modal ─────────────────────────────────────────────────────────
function K2PreviewModal({ k2Data, onClose, onSubmit, loading }: {
  k2Data: Record<string, unknown>; onClose: () => void;
  onSubmit: () => void; loading: boolean;
}) {
  const form = (k2Data?.k2_form_data || {}) as Record<string, unknown>;
  const exp  = (form?.exporter || {}) as Record<string, string>;
  const con  = (form?.consignee || {}) as Record<string, string>;
  const gds  = (form?.goods || {}) as Record<string, unknown>;
  const val  = (form?.valuation || {}) as Record<string, number>;
  const dty  = (form?.duty || {}) as Record<string, number>;
  const trp  = (form?.transport || {}) as Record<string, string>;
  const sig  = (form?.signatory || {}) as Record<string, string>;

  function K2Row({ label, value }: { label: string; value?: unknown }) {
    return (
      <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
        <span className="text-[11px] text-muted-foreground shrink-0 w-36">{label}</span>
        <span className="text-[12px] font-medium text-foreground text-right">{String(value ?? "—")}</span>
      </div>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="rounded-xl border border-border bg-background p-3 space-y-0">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        {children}
      </div>
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="K2 Export Declaration — Preview" subtitle="Review before submitting to RMCD via Dagang Net" onClose={onClose} />
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between rounded-xl bg-primary-soft border border-primary/30 px-3 py-2">
          <span className="text-[11px] font-bold text-primary">K2 Reference</span>
          <span className="text-sm font-mono font-bold text-primary">{String(k2Data?.k2_reference || "K2-MY-2026-PENDING")}</span>
        </div>

        <Section title="Exporter">
          <K2Row label="Company" value={exp.name} /><K2Row label="BRN" value={exp.brn} /><K2Row label="Address" value={exp.address} />
        </Section>
        <Section title="Consignee">
          <K2Row label="Name" value={con.name} /><K2Row label="Country" value={con.country_code} /><K2Row label="Address" value={con.address} />
        </Section>
        <Section title="Transport">
          <K2Row label="Mode" value={trp.mode_description} /><K2Row label="Vessel / Flight" value={trp.vessel_flight_name} />
          <K2Row label="POL" value={trp.port_of_loading_code} /><K2Row label="POD" value={trp.port_of_discharge_code} />
        </Section>
        <Section title="Goods">
          <K2Row label="HS Code" value={gds.hs_code as string} /><K2Row label="Description" value={gds.commodity_description as string} />
          <K2Row label="Quantity" value={`${gds.quantity} ${gds.unit_of_quantity}`} />
          <K2Row label="Gross Weight" value={`${gds.gross_weight_kg} kg`} />
        </Section>
        <Section title="Valuation & Duty">
          <K2Row label="FOB (MYR)" value={`RM ${Number(val.fob_value_myr || 0).toLocaleString()}`} />
          <K2Row label="CIF (MYR)" value={`RM ${Number(val.cif_value_myr || 0).toLocaleString()}`} />
          <K2Row label="Export Duty" value={`RM ${Number(dty.export_duty_myr || 0).toLocaleString()}`} />
          <K2Row label="Total Duty" value={`RM ${Number(dty.total_duty_myr || 0).toLocaleString()}`} />
        </Section>
        <Section title="Signatory">
          <K2Row label="Name" value={sig.name} /><K2Row label="NRIC/Passport" value={sig.nric_passport} /><K2Row label="Designation" value={sig.designation} />
        </Section>

        {(k2Data?.compliance_notes as string[] || []).length > 0 && (
          <div className="rounded-xl bg-warning-soft border border-warning/30 p-3 text-[11px] text-warning space-y-1">
            {(k2Data.compliance_notes as string[]).map((n, i) => <p key={i}>⚠ {n}</p>)}
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground">Close</button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit to Dagang Net
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP FLOW DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const STEP_FLOW: Record<number, { intro: Message; onComplete: Message }> = {
  0: {
    intro: { id: "i0", role: "assistant", kind: "checklist", content: "To verify your entity, I need your SSM (Suruhanjaya Syarikat Malaysia) certificate. Upload a PDF or image — I'll extract and validate all fields automatically.", items: [{ label: "SSM Certificate (Form 9 / Form D)", status: "REQUIRED" }, { label: "Business Registration Number (BRN)", status: "REQUIRED" }, { label: "Director NRIC verification", status: "PENDING" }], actions: [{ label: "Upload SSM Certificate", icon: Upload, intent: "primary", action: "upload-ssm" }, { label: "Verify SSM manually", icon: ShieldCheck, intent: "ghost", action: "verify-ssm" }] },
    onComplete: { id: "c0", role: "assistant", kind: "text", content: "✅ Entity verified. Company linked to RMCD records. Now collecting your overseas buyer details." },
  },
  1: {
    intro: { id: "i1", role: "assistant", kind: "checklist", content: "Every export declaration requires the consignee on record. This pre-fills the Commercial Invoice, B/L, and K2 automatically.", items: [{ label: "Consignee (Buyer) name & full address", status: "REQUIRED" }, { label: "Contact person, email & phone", status: "REQUIRED" }, { label: "Importer Tax / VAT ID (destination country)", status: "PENDING" }, { label: "Incoterm & notify party", status: "PENDING" }], actions: [{ label: "Add Consignee Details", icon: UserSquare2, intent: "primary", action: "add-consignee" }] },
    onComplete: { id: "c1", role: "assistant", kind: "text", content: "✅ Consignee captured and screened. No sanctions flags. Mapping product classification next." },
  },
  2: {
    intro: { id: "i2", role: "assistant", kind: "checklist", content: "The HS Code drives every downstream permit and duty calculation. Upload a product photo or describe the product.", items: [{ label: "Product description & specs", status: "REQUIRED" }, { label: "HS Code lookup (8-digit AHTN)", status: "PENDING" }, { label: "Import duty rate at destination", status: "PENDING" }], actions: [{ label: "Upload Product Photo", icon: Upload, intent: "primary", action: "upload-product" }, { label: "Search HS Code", icon: FileSearch, intent: "ghost", action: "lookup-hs" }] },
    onComplete: { id: "c2", role: "assistant", kind: "text", content: "✅ HS Classification complete. Duty rates and FTA eligibility determined. Checking permit dependencies." },
  },
  3: {
    intro: { id: "i3", role: "assistant", kind: "text", content: "Checking permit requirements against PUA122 (Customs Prohibition of Exports Order). Any SIRIM, Halal, MITI, or strategic goods triggers will appear below." },
    onComplete: { id: "c3", role: "assistant", kind: "text", content: "✅ Permit check complete. Proceeding to digital access setup." },
  },
  4: {
    intro: { id: "i4", role: "assistant", kind: "checklist", content: "K2 declaration must be submitted via Dagang Net. Confirm your digital access and authentication setup.", items: [{ label: "MyCIEDS account", status: "REQUIRED" }, { label: "Dagang Net subscription", status: "REQUIRED" }, { label: "Digital Certificate (token)", status: "REQUIRED" }], actions: [{ label: "Connect Dagang Net", icon: Link2, intent: "primary", action: "connect-dagang" }] },
    onComplete: { id: "c4", role: "assistant", kind: "text", content: "✅ Dagang Net linked. Digital Certificate active. Now valuing the shipment." },
  },
  5: {
    intro: { id: "i5", role: "assistant", kind: "checklist", content: "RMCD requires a full CIF valuation for K2. I'll convert foreign currency automatically using BNM reference rates.", items: [{ label: "FOB value (goods at Malaysian port)", status: "REQUIRED" }, { label: "Freight cost (MYR)", status: "REQUIRED" }, { label: "Insurance cost (CIF component)", status: "REQUIRED" }, { label: "Invoice currency & exchange rate", status: "PENDING" }, { label: "FTA exemption reference (if claiming)", status: "PENDING" }], actions: [{ label: "Enter Valuation", icon: Coins, intent: "primary", action: "enter-valuation" }] },
    onComplete: { id: "c5", role: "assistant", kind: "text", content: "✅ Valuation locked. CIF and landed cost calculated. FTA savings assessed." },
  },
  6: {
    intro: { id: "i6", role: "assistant", kind: "checklist", content: "Logistics details flow directly into the K2 form and Bill of Lading. Get this right to avoid port holds.", items: [{ label: "Mode of Transport (Sea / Air / Rail / Road)", status: "REQUIRED" }, { label: "Vessel name or Flight number", status: "REQUIRED" }, { label: "Port of Loading & Port of Discharge", status: "REQUIRED" }, { label: "Scheduled export date", status: "REQUIRED" }, { label: "Gross weight (kg) & volume (m³)", status: "PENDING" }, { label: "Packaging type & container number", status: "PENDING" }, { label: "Authorised signatory (NRIC / Passport)", status: "REQUIRED" }], actions: [{ label: "Add Shipment Details", icon: PackageSearch, intent: "primary", action: "add-shipment" }] },
    onComplete: { id: "c6", role: "assistant", kind: "text", content: "✅ Shipment details confirmed. Signatory recorded. Generating trade documents." },
  },
  7: {
    intro: { id: "i7", role: "assistant", kind: "checklist", content: "Generating Commercial Invoice, Packing List, Certificate of Origin, and Bill of Lading from verified data. Sign the declaration to unlock K2.", items: [{ label: "Commercial Invoice", status: "PENDING" }, { label: "Packing List", status: "PENDING" }, { label: "Bill of Lading / Air Waybill", status: "PENDING" }, { label: "Certificate of Origin (if FTA claimed)", status: "PENDING" }, { label: "Declaration of truth (e-signature)", status: "REQUIRED" }], actions: [{ label: "Generate Trade Docs", icon: FileText, intent: "primary", action: "generate-docs" }, { label: "Sign Declaration", icon: PenLine, intent: "ghost", action: "sign-declaration" }] },
    onComplete: { id: "c7", role: "assistant", kind: "text", content: "✅ All trade documents generated and signed. Ready for K2 submission." },
  },
  8: {
    intro: { id: "i8", role: "assistant", kind: "text", content: "All dependencies satisfied. K2 Customs Declaration is ready. Review the form below then submit to RMCD via Dagang Net." },
    onComplete: { id: "c8", role: "assistant", kind: "text", content: "🎉 K2 submitted. RMCD acknowledgement expected within 4 business hours." },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AssistantPage() {
  const navigate = useNavigate();

  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [completed, setCompleted]     = useState<Set<number>>(new Set());
  const [activeStep, setActiveStep]   = useState(0);
  const [permitFlags, setPermitFlags] = useState<PermitFlags>(DEFAULT_PERMIT_FLAGS);

  // Session data accumulated across steps
  const sessionData = useRef<Record<string, unknown>>({});

  // Modal visibility
  const [modal, setModal] = useState<
    null | "consignee" | "valuation" | "shipment" | "digital-access" | "signature" | "k2-preview"
  >(null);

  // Permit upload tracking (for Step 3)
  const [requiredPermits, setRequiredPermits] = useState<Array<{ name: string; key: string; uploaded: boolean }>>([]);

  // Generated docs & K2 data
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const [signed, setSigned] = useState(false);
  const [k2Data, setK2Data] = useState<Record<string, unknown> | null>(null);

  // Landed cost state (live)
  const [landedCost, setLandedCost] = useState({ fob: 0, freight: 0, insurance: 0, duty: 0, total: 0, savings: 0, bestFta: "", finalised: false });

  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", kind: "text", content: "Hi — I'm your Compliance Architect. I'll guide you through every regulatory dependency in order: Entity → Consignee → HS Code → Permits → Digital Access → Valuation → Logistics → Docs & Signatory → K2. Let's start." },
    STEP_FLOW[0].intro,
  ]);
  const [input, setInput]     = useState("");
  const [sending, setSending] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ action: string; accept: string; endpoint: string } | null>(null);
  const bottomRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.createSession()
      .then((s: { session_id: string }) => setSessionId(s.session_id))
      .catch((err: Error) => {
        console.warn("Demo mode:", err.message);
        setSessionError(err.message);
        setSessionId("demo-" + Math.random().toString(36).slice(2));
      });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const total    = STEPS.length;
  const progress = Math.round((completed.size / total) * 100);

  const docsWithStatus = EXPORT_DOCS.map(d => ({ ...d, status: docStatus(d, completed) }));
  const readyDocs   = docsWithStatus.filter(d => d.status === "ready");
  const partialDocs = docsWithStatus.filter(d => d.status === "partial");
  const lockedDocs  = docsWithStatus.filter(d => d.status === "locked");

  const gatingDocs      = EXPORT_DOCS.filter(d => isGating(d, permitFlags));
  const canProceed      = gatingDocs.length > 0 && gatingDocs.every(d => generatedIds.has(d.id));
  const gatingGenerated = gatingDocs.filter(d => generatedIds.has(d.id)).length;

  // ── Advance UI to next step ────────────────────────────────────────────────
  const advanceUI = useCallback(() => {
    setMessages(m => {
      const next = [...m, STEP_FLOW[activeStep].onComplete];
      const nextStep = activeStep + 1;
      if (nextStep < total && STEP_FLOW[nextStep]) next.push(STEP_FLOW[nextStep].intro);
      return next;
    });
    setCompleted(prev => new Set([...prev, activeStep]));
    setActiveStep(s => Math.min(s + 1, total - 1));
  }, [activeStep, total]);

  const waitForSession = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (sessionId) { resolve(sessionId); return; }
      const start = Date.now();
      const iv = setInterval(() => {
        setSessionId(cur => {
          if (cur) { clearInterval(iv); resolve(cur); }
          else if (Date.now() - start > 5000) { clearInterval(iv); const demo = "demo-" + genId(); resolve(demo); }
          return cur;
        });
      }, 100);
    });
  }, [sessionId]);

  const addMsg = (msg: Message) => setMessages(m => [...m, msg]);
  const removeProcessing = (pid: string) => setMessages(m => m.filter(x => x.id !== pid));

  const runWithFeedback = useCallback(async (apiCall: () => Promise<void>) => {
    const pid = genId();
    addMsg({ id: pid, role: "assistant", kind: "processing", content: "Mapping dependencies against RMCD & MITI regulations…" });
    setSending(true);
    try {
      await apiCall();
      removeProcessing(pid);
    } catch (err) {
      removeProcessing(pid);
      addMsg({ id: genId(), role: "assistant", kind: "text", content: `⚠️ Backend error (demo mode): ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSending(false);
    }
  }, []);

  // ── FILE UPLOAD handler ────────────────────────────────────────────────────
  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pendingUploadRef.current) return;
    const { endpoint } = pendingUploadRef.current;
    pendingUploadRef.current = null;

    addMsg({ id: genId(), role: "user", kind: "upload", content: "uploaded-file", fileName: file.name });
    const sid = await waitForSession();

    await runWithFeedback(async () => {
      let result: Record<string, unknown> = {};

      if (endpoint === "/entity/upload-ssm") {
        await api.verifyEntity(sid, { company_name: "Auto-extract", registration_number: "000000000000" });
        result = await apiUpload(endpoint, file, { session_id: sid }) as Record<string, unknown>;
        const ext = (result.extracted || {}) as Record<string, string>;
        sessionData.current.entity = ext;
        addMsg({
          id: genId(), role: "assistant", kind: "extracted",
          content: "SSM certificate scanned. Here's what I extracted:",
          valid: Boolean(result.is_valid),
          fields: {
            "Company Name":    ext.company_name || "—",
            "BRN":             ext.registration_number || "—",
            "Company Type":    ext.company_type || "—",
            "Registered Date": ext.registration_date || "—",
            "Status":          ext.company_status || "—",
            "Directors":       (ext.directors as unknown as Array<{name: string}>)?.map((d: {name: string}) => d.name).join(", ") || "—",
          },
        });
        if (result.is_valid) advanceUI();
        else addMsg({ id: genId(), role: "assistant", kind: "text", content: "⚠️ Some fields could not be extracted. Please verify the document and try again, or proceed with manual verification." });
      } else if (endpoint === "/classification/upload-product") {
        result = await apiUpload(endpoint, file, { session_id: sid }) as Record<string, unknown>;
        const cls = (result.classification || result) as Record<string, unknown>;
        const hsCode = (cls.hs_code || cls.top_result?.hs_code || "") as string;
        sessionData.current.classification = cls;
        addMsg({
          id: genId(), role: "assistant", kind: "hs-result",
          content: "Product identified and classified:",
          hsCode, description: (cls.hs_description || cls.top_result?.description || "") as string,
          duty: Number(cls.destination_import_duty || 0),
          fta: (cls.fta_available || []) as string[],
          permitRequired: Boolean(cls.permit_check?.requires_permit),
          permits: (cls.permit_check?.permits || []).map((p: Record<string, string>) => p.name),
        });
        advanceUI();
      } else {
        await apiUpload(endpoint, file, { session_id: sid });
        advanceUI();
      }
    });
  }, [waitForSession, runWithFeedback, advanceUI]);

  // ── CONSIGNEE SUBMIT ───────────────────────────────────────────────────────
  const handleConsigneeSubmit = useCallback(async (data: object) => {
    setModalLoading(true);
    const sid = await waitForSession();
    try {
      const result = await api.addConsignee(sid, data) as Record<string, unknown>;
      sessionData.current.consignee = data;
      setModal(null);
      addMsg({ id: genId(), role: "user", kind: "text", content: `Consignee: ${(data as Record<string,string>).buyer_name}, ${(data as Record<string,string>).buyer_country}` });
      addMsg({ id: genId(), role: "assistant", kind: "text", content: `✅ Consignee screened. Risk level: ${(result.screening as Record<string,string>)?.risk_level || "low"}. Sanctions check: ${(result.screening as Record<string,string>)?.denied_party_check || "clear"}.` });
      advanceUI();
    } catch {
      addMsg({ id: genId(), role: "assistant", kind: "text", content: "⚠️ Consignee saved in demo mode." });
      sessionData.current.consignee = data;
      setModal(null);
      advanceUI();
    } finally {
      setModalLoading(false);
    }
  }, [waitForSession, advanceUI]);

  // ── DIGITAL ACCESS SUBMIT ──────────────────────────────────────────────────
  const handleDigitalAccessSubmit = useCallback(async (brn: string, agentCode: string) => {
    setModalLoading(true);
    const sid = await waitForSession();
    try {
      await api.setupDigitalAccess(sid, brn || "202301045678");
      setModal(null);
      advanceUI();
    } catch {
      setModal(null);
      advanceUI();
    } finally {
      setModalLoading(false);
    }
  }, [waitForSession, advanceUI]);

  // ── VALUATION SUBMIT ───────────────────────────────────────────────────────
  const handleValuationSubmit = useCallback(async (data: object) => {
    setModalLoading(true);
    const sid = await waitForSession();
    try {
      const result = await api.calculateValuation(sid, data) as Record<string, number & string>;
      sessionData.current.valuation = result;
      setLandedCost({
        fob: Number(result.fob_myr || 0),
        freight: Number(result.freight_myr || 0),
        insurance: Number(result.insurance_myr || 0),
        duty: Number(result.estimated_duty_myr || 0),
        total: Number(result.total_landed_cost_myr || 0),
        savings: Number(result.atiga_savings_myr || 0),
        bestFta: String(result.best_fta || ""),
        finalised: true,
      });
      setModal(null);
      addMsg({
        id: genId(), role: "assistant", kind: "valuation",
        content: "Valuation calculated:",
        fob: Number(result.fob_myr || 0), freight: Number(result.freight_myr || 0),
        insurance: Number(result.insurance_myr || 0), duty: Number(result.estimated_duty_myr || 0),
        total: Number(result.total_landed_cost_myr || 0), savings: Number(result.atiga_savings_myr || 0),
        bestFta: String(result.best_fta || ""),
      });
      advanceUI();
    } catch {
      const d = data as Record<string, number>;
      const fob = d.fob_value_myr || 0;
      const freight = d.freight_quote_myr || fob * 0.07;
      const ins = fob * (d.insurance_rate || 0.005);
      const cif = fob + freight + ins;
      const duty = cif * 0.05;
      setLandedCost({ fob, freight, insurance: ins, duty, total: cif + duty, savings: duty * 0.8, bestFta: "ATIGA", finalised: false });
      setModal(null);
      advanceUI();
    } finally {
      setModalLoading(false);
    }
  }, [waitForSession, advanceUI]);

  // ── LOGISTICS SUBMIT ───────────────────────────────────────────────────────
  const handleShipmentSubmit = useCallback(async (data: object) => {
    setModalLoading(true);
    const sid = await waitForSession();
    try {
      await api.setupLogistics(sid, data);
      sessionData.current.logistics = data;
    } catch {
      sessionData.current.logistics = data;
    }
    const d = data as Record<string, string>;
    setModal(null);
    addMsg({
      id: genId(), role: "user", kind: "text",
      content: `Shipment: ${d.mode} · ${d.vessel_name || d.flight_number || "TBC"} · ETD ${d.export_date || "TBC"} · ${d.port_of_loading} → ${d.port_of_discharge}. ${d.gross_weight_kg} kg / ${d.cbm} m³ · ${d.number_of_packages} ${d.package_type}(s) · ${d.container_number || "No container yet"}`
    });
    setModalLoading(false);
    advanceUI();
  }, [waitForSession, advanceUI]);

  // ── GENERATE DOCS ──────────────────────────────────────────────────────────
  const handleGenerateDocs = useCallback(async () => {
    const sid = await waitForSession();
    await runWithFeedback(async () => {
      try {
        const result = await api.generateDocs(sid) as Record<string, unknown>;
        const generated = (result.generated || []) as string[];
        generated.forEach(name => {
          const id = name.replace(/_/g, "-");
          setGeneratedIds(prev => new Set([...prev, id]));
        });
        addMsg({ id: genId(), role: "assistant", kind: "text", content: `✅ ${generated.length} document(s) generated: ${generated.map(g => g.replace(/_/g," ")).join(", ")}. Now add your e-signature to unlock the K2 form.` });
      } catch {
        // Demo mode — generate all
        ["commercial-invoice", "packing-list", "bol", "coo"].forEach(id => setGeneratedIds(prev => new Set([...prev, id])));
        addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ All 4 trade documents generated (demo). Now add your e-signature to unlock K2." });
      }
    });
  }, [waitForSession, runWithFeedback]);

  // ── SIGN DECLARATION ───────────────────────────────────────────────────────
  const handleSign = useCallback(() => {
    setSigned(true);
    setModal(null);
    addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Declaration signed. K2 export declaration is now ready for preview and submission." });
    advanceUI();
  }, [advanceUI]);

  // ── SUBMIT K2 ──────────────────────────────────────────────────────────────
  const handleK2Submit = useCallback(async () => {
    const sid = await waitForSession();
    setModalLoading(true);
    try {
      const result = await api.submitK2(sid) as Record<string, unknown>;
      setK2Data((result.k2_data as Record<string, unknown>) || result);
      setModal(null);
      advanceUI();
    } catch {
      setModal(null);
      advanceUI();
    } finally {
      setModalLoading(false);
    }
  }, [waitForSession, advanceUI]);

  // ── PERMIT CHECK (Step 3 auto-run) ────────────────────────────────────────
  const runPermitCheck = useCallback(async (sid: string) => {
    const cls = (sessionData.current.classification || {}) as Record<string, unknown>;
    const hsCode = (cls.hs_code || cls.top_result?.hs_code || "0000.00.00") as string;
    try {
      const result = await api.checkPermits(sid, {
        hs_code: hsCode,
        product_type: (cls.description || "general goods") as string,
        destination_country: (sessionData.current.consignee as Record<string, string>)?.buyer_country || "Unknown",
      }) as Record<string, unknown>;

      const flags = (result.flags || {}) as Record<string, boolean>;
      setPermitFlags({ needsSirim: flags.sirim || false, needsHalal: flags.halal || false, needsCoo: true });

      const permits = (result.permits as Record<string, unknown>)?.permits_required as Array<Record<string, string>> || [];
      if (permits.length === 0) {
        addMsg({ id: genId(), role: "assistant", kind: "text", content: `✅ HS ${hsCode} — No PUA122 controlled permits required for this product. Proceeding to digital access.` });
        advanceUI();
      } else {
        const permitList = permits.map((p, i) => ({ name: p.name, key: `permit-${i}`, uploaded: false }));
        setRequiredPermits(permitList);
        addMsg({
          id: genId(), role: "assistant", kind: "permit-upload",
          content: `${permits.length} permit(s) required for HS ${hsCode}. Please upload each certificate to continue.`,
          permits: permitList,
        });
      }
    } catch {
      setPermitFlags({ needsSirim: false, needsHalal: false, needsCoo: true });
      advanceUI();
    }
  }, [advanceUI]);

  // ── ACTION BUTTON HANDLER ─────────────────────────────────────────────────
  const handleAction = useCallback(async (action: string, label: string) => {
    const uploadConfig = UPLOAD_ACTION_MAP[action];
    if (uploadConfig) {
      pendingUploadRef.current = { action, ...uploadConfig };
      if (fileInputRef.current) { fileInputRef.current.accept = uploadConfig.accept; fileInputRef.current.click(); }
      return;
    }

    if (action === "add-consignee")    { setModal("consignee"); return; }
    if (action === "enter-valuation")  { setModal("valuation"); return; }
    if (action === "add-shipment")     { setModal("shipment"); return; }
    if (action === "connect-dagang")   { setModal("digital-access"); return; }
    if (action === "sign-declaration") { setModal("signature"); return; }
    if (action === "generate-docs")    { handleGenerateDocs(); return; }
    if (action === "lookup-hs")        { addMsg({ id: genId(), role: "user", kind: "text", content: label }); return; }

    addMsg({ id: genId(), role: "user", kind: "text", content: label });
    const sid = await waitForSession();

    await runWithFeedback(async () => {
      if (action === "verify-ssm") {
        await api.verifyEntity(sid, { company_name: "Manual verify", registration_number: "202301045678" });
        advanceUI();
      } else if (action === "pull-carrier") {
        addMsg({ id: genId(), role: "assistant", kind: "text", content: "Carrier booking integration coming soon. Please fill in shipment details manually." });
        setModal("shipment");
      } else {
        advanceUI();
      }
    });
  }, [waitForSession, runWithFeedback, advanceUI, handleGenerateDocs]);

  // ── PERMIT UPLOAD (for each permit cert) ─────────────────────────────────
  const handlePermitUpload = useCallback(async (permitKey: string, file: File) => {
    const sid = await waitForSession();
    addMsg({ id: genId(), role: "user", kind: "upload", content: "uploaded-file", fileName: file.name });
    setRequiredPermits(prev => {
      const next = prev.map(p => p.key === permitKey ? { ...p, uploaded: true } : p);
      const allDone = next.every(p => p.uploaded);
      if (allDone) {
        setTimeout(() => {
          addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ All permit certificates uploaded and validated. Proceeding to digital access setup." });
          advanceUI();
        }, 500);
      }
      return next;
    });
  }, [waitForSession, advanceUI]);

  // ── STEP 3 auto-trigger ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeStep === 3 && !completed.has(3)) {
      waitForSession().then(sid => runPermitCheck(sid));
    }
  }, [activeStep]);

  // ── PREVIEW K2 (Step 8) ───────────────────────────────────────────────────
  const handlePreviewK2 = useCallback(async () => {
    const sid = await waitForSession();
    await runWithFeedback(async () => {
      try {
        const result = await api.submitK2(sid) as Record<string, unknown>;
        setK2Data((result.k2_data as Record<string, unknown>) || { k2_reference: "K2-MY-2026-PREVIEW", k2_form_data: {} });
      } catch {
        setK2Data({ k2_reference: "K2-MY-2026-DEMO", compliance_notes: [], k2_form_data: { exporter: { name: "Demo Exporter", brn: "202301045678" }, consignee: {}, transport: {}, goods: { hs_code: "0902.30.10", commodity_description: "Black Tea" }, valuation: {}, duty: {}, signatory: {} } });
      }
      setModal("k2-preview");
    });
  }, [waitForSession, runWithFeedback]);

  // ── DOC GENERATION individual ─────────────────────────────────────────────
  const handleGenerate = useCallback((id: string) => {
    if (generatedIds.has(id) || generatingId) return;
    setGeneratingId(id);
    setTimeout(() => { setGeneratingId(null); setGeneratedIds(prev => new Set([...prev, id])); }, 1400);
  }, [generatedIds, generatingId]);

  // ── CHAT SEND ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const raw = input.trim();
    setInput("");
    addMsg({ id: genId(), role: "user", kind: "text", content: raw });
    setSending(true);
    try {
      const sid = await waitForSession();
      const res = await api.chat(sid, raw) as Record<string, string>;
      addMsg({ id: genId(), role: "assistant", kind: "text", content: res.reply || res.response || "No response from server." });
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text", content: `⚠️ ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSending(false);
    }
  }, [input, sending, waitForSession]);

  const tryJumpTo = useCallback((stepId: number) => {
    if (completed.has(stepId) || stepId === activeStep) { setActiveStep(stepId); return; }
    const blocking = STEPS.slice(0, stepId).find(s => !completed.has(s.id));
    if (!blocking) return;
    addMsg({ id: genId(), role: "assistant", kind: "blocked", content: `Action Blocked: Complete "${blocking.title}" before accessing "${STEPS[stepId].title}".` });
  }, [completed, activeStep]);

  const signatoryName  = ((sessionData.current.logistics as Record<string, string>)?.signatory_name) || "";
  const signatoryTitle = ((sessionData.current.logistics as Record<string, string>)?.signatory_designation) || "";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary/30">
      <TopNav />

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

      {/* MODALS */}
      {modal === "consignee"     && <ConsigneeModal     onClose={() => setModal(null)} onSubmit={handleConsigneeSubmit} loading={modalLoading} />}
      {modal === "valuation"     && <ValuationModal     onClose={() => setModal(null)} onSubmit={handleValuationSubmit} loading={modalLoading} hsCode={((sessionData.current.classification as Record<string, string>)?.hs_code) || ""} />}
      {modal === "shipment"      && <ShipmentModal      onClose={() => setModal(null)} onSubmit={handleShipmentSubmit}  loading={modalLoading} />}
      {modal === "digital-access"&& <DigitalAccessModal onClose={() => setModal(null)} onSubmit={handleDigitalAccessSubmit} loading={modalLoading} companyBrn={((sessionData.current.entity as Record<string, string>)?.registration_number) || "202301045678"} />}
      {modal === "signature"     && <SignatureModal signatoryName={signatoryName} signatoryTitle={signatoryTitle} onClose={() => setModal(null)} onSign={handleSign} />}
      {modal === "k2-preview" && k2Data && <K2PreviewModal k2Data={k2Data} onClose={() => setModal(null)} onSubmit={handleK2Submit} loading={modalLoading} />}

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px] xl:grid-cols-[260px_1fr_320px]">

          {/* ── LEFT: Step Checklist ─────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-gradient-card p-4 shadow-soft-md">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Export Checklist</h2>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">{completed.size}/{total}</span>
              </div>
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground"><span>Progress</span><span>{progress}%</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="mb-3 flex items-center gap-1.5 text-[10px]">
                {sessionId ? (<><span className="h-1.5 w-1.5 rounded-full bg-success" /><span className="text-success font-medium">Backend connected</span></>) :
                 sessionError ? (<><span className="h-1.5 w-1.5 rounded-full bg-danger" /><span className="text-danger font-medium">Demo mode</span></>) :
                 (<><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Connecting…</span></>)}
              </div>
              <ol className="relative space-y-1">
                {STEPS.map((step, idx) => {
                  const isCompleted = completed.has(step.id);
                  const isActive    = step.id === activeStep;
                  const isLocked    = !isCompleted && !isActive;
                  const Icon        = step.icon;
                  const isLast      = idx === STEPS.length - 1;
                  return (
                    <li key={step.id} className="relative">
                      {!isLast && <span className={`absolute left-[19px] top-9 h-[calc(100%-12px)] w-px ${isCompleted ? "bg-success/40" : "bg-border"}`} />}
                      <button onClick={() => tryJumpTo(step.id)} className={`relative flex w-full items-start gap-3 rounded-xl p-2 text-left transition-base ${isActive ? "bg-primary-soft ring-1 ring-primary/30" : isCompleted ? "hover:bg-secondary/60" : "opacity-60 hover:opacity-80"}`}>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isCompleted ? "bg-success text-primary-foreground" : isActive ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-muted-foreground">STEP {step.id + 1}</span>
                            {isActive && <span className="rounded-full bg-primary px-1.5 py-px text-[9px] font-bold text-primary-foreground">NOW</span>}
                          </div>
                          <div className="text-[13px] font-semibold text-foreground">{step.title}</div>
                          <div className="text-[11px] text-muted-foreground">{step.subtitle}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {/* Doc status summary */}
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Doc Status</h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{generatedIds.size}/{EXPORT_DOCS.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {EXPORT_DOCS.map(doc => {
                    const isDone = generatedIds.has(doc.id);
                    const missing = doc.requiredSteps.filter(s => !completed.has(s));
                    const blockingStep = missing.length > 0 ? STEPS[missing[0]] : null;
                    const gating = isGating(doc, permitFlags);
                    return (
                      <li key={doc.id} className="flex items-center gap-2 text-[11px]">
                        {isDone ? <CheckCircle2 className="h-3 w-3 shrink-0 text-success" /> : blockingStep ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />}
                        <span className={`flex-1 truncate ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>{doc.label}</span>
                        {gating && <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-px text-[8px] font-bold uppercase text-primary">Req</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </aside>

          {/* ── MIDDLE: Chat ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 min-w-0">
            <section className="flex min-h-[70vh] flex-col rounded-2xl border border-border bg-gradient-card shadow-soft-md">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Architect AI</div>
                    <div className="text-[11px] text-muted-foreground">Step {activeStep + 1} · {STEPS[activeStep]?.title}</div>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${sessionId ? "bg-success-soft text-success" : sessionError ? "bg-danger-soft text-danger" : "bg-secondary text-muted-foreground"}`}>
                  {sessionId ? <><span className="h-1.5 w-1.5 rounded-full bg-success" />Live</> : sessionError ? <><AlertTriangle className="h-3 w-3" />Demo</> : <><Loader2 className="h-3 w-3 animate-spin" />Connecting</>}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onAction={handleAction}
                    isSessionReady={!!sessionId}
                    onPermitUpload={handlePermitUpload}
                    onPreviewK2={handlePreviewK2}
                    signed={signed}
                    activeStep={activeStep}
                  />
                ))}
                {sending && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft"><Cog className="h-4 w-4 animate-spin text-primary" /></div>
                    <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">Calling backend API…</div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border bg-card/60 p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/40">
                  <button type="button" onClick={() => { pendingUploadRef.current = { action: "chat-attachment", accept: ".pdf,.jpg,.jpeg,.png,.docx,.xlsx", endpoint: "/documents/upload" }; if (fileInputRef.current) { fileInputRef.current.accept = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx"; fileInputRef.current.click(); } }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-base">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Type business details or ask about a regulation…" rows={1} className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-24" />
                  <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-base"><Mic className="h-4 w-4" /></button>
                  <button type="button" onClick={handleSend} disabled={!input.trim() || sending} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base">
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                  <span>Architect AI may request supporting documents.</span><span>↵ to send</span>
                </div>
              </div>
            </section>

            {/* Landed Cost */}
            <div className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft-sm">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated</div><div className="text-sm font-semibold text-foreground">Landed Cost</div></div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${landedCost.finalised ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{landedCost.finalised ? "Finalised" : "Not Final"}</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-4">
                {[
                  { label: "FOB Value",           value: `RM ${landedCost.fob > 0 ? landedCost.fob.toLocaleString() : "4,720"}` },
                  { label: "Insurance + Freight", value: `RM ${landedCost.fob > 0 ? (landedCost.freight + landedCost.insurance).toLocaleString() : "330"}` },
                  { label: "Estimated Duty",      value: `RM ${landedCost.fob > 0 ? landedCost.duty.toLocaleString() : "252"}` },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-l border-border pl-6">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-semibold text-foreground">RM {landedCost.fob > 0 ? landedCost.total.toLocaleString() : "5,302"}</span>
                </div>
                <div className="flex w-full items-start gap-2 rounded-xl bg-success-soft p-2.5">
                  <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <p className="text-[11px] leading-relaxed text-success">
                    Potential <strong>RM {landedCost.savings > 0 ? landedCost.savings.toLocaleString() : "320"} saved</strong>
                    {landedCost.bestFta ? ` via ${landedCost.bestFta}` : " if ATIGA Form D is filed"}.
                  </p>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground"><Info className="h-3 w-3 shrink-0" />Updates as you progress.</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Document Pack ──────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft-md">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Export</div><div className="text-sm font-semibold text-foreground">Document Pack</div></div>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">{generatedIds.size} Ready</span>
              </div>
              <div className="max-h-[540px] space-y-1 overflow-y-auto px-3 py-3">
                {readyDocs.length > 0 && (
                  <>
                    <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">✓ Ready to Generate</div>
                    {readyDocs.map(doc => {
                      const Icon = doc.icon;
                      const isGenerating = generatingId === doc.id;
                      const isGenerated  = generatedIds.has(doc.id);
                      const gating       = isGating(doc, permitFlags);
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-base hover:border-primary/30 hover:bg-primary-soft/30">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-soft"><Icon className="h-3.5 w-3.5 text-success" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                              {gating && <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-px text-[8px] font-bold uppercase text-primary">Req</span>}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">{doc.sublabel}</div>
                          </div>
                          <button type="button" onClick={() => handleGenerate(doc.id)} disabled={isGenerated || isGenerating} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-base ${isGenerated ? "bg-success text-primary-foreground" : isGenerating ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground shadow-glow hover:opacity-90"}`}>
                            {isGenerated ? <CheckCircle2 className="h-3 w-3" /> : isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {partialDocs.length > 0 && (
                  <>
                    <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-warning">⚡ Needs More Info</div>
                    {partialDocs.map(doc => {
                      const Icon = doc.icon;
                      const missing = doc.requiredSteps.filter(s => !completed.has(s)).map(s => STEPS.find(st => st.id === s)?.title).filter(Boolean);
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 opacity-75">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft"><Icon className="h-3.5 w-3.5 text-warning" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                            <div className="truncate text-[10px] text-warning">Need: {missing.slice(0, 2).join(", ")}</div>
                          </div>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Lock className="h-3 w-3" /></div>
                        </div>
                      );
                    })}
                  </>
                )}

                {lockedDocs.length > 0 && (
                  <>
                    <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">🔒 Locked</div>
                    {lockedDocs.map(doc => {
                      const Icon = doc.icon;
                      const missingCount = doc.requiredSteps.filter(s => !completed.has(s)).length;
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2.5 opacity-50">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-muted-foreground">{doc.label}</div>
                            <div className="truncate text-[10px] text-muted-foreground">{missingCount} step{missingCount > 1 ? "s" : ""} remaining</div>
                          </div>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Lock className="h-3 w-3" /></div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* K2 Submit button */}
                {activeStep === 8 && signed && (
                  <div className="pb-1 pt-3">
                    <button type="button" onClick={handlePreviewK2} disabled={sending} className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-[12px] font-semibold text-primary-foreground shadow-glow transition-base hover:opacity-90 flex items-center justify-center gap-2">
                      <Eye className="h-4 w-4" />Preview & Submit K2
                    </button>
                  </div>
                )}

                {readyDocs.filter(d => !generatedIds.has(d.id)).length > 1 && (
                  <div className="pb-1 pt-3">
                    <button type="button" onClick={() => readyDocs.forEach(d => !generatedIds.has(d.id) && handleGenerate(d.id))} className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-[12px] font-semibold text-primary-foreground shadow-glow transition-base hover:opacity-90">
                      Generate All Ready Docs
                    </button>
                    <p className="mt-1.5 text-center text-[10px] text-muted-foreground">More docs unlock as you progress</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Proceed FAB */}
      {canProceed && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          <span className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-primary opacity-20" />
          <button type="button" onClick={() => navigate("/logistics", { state: { carriedDocs: EXPORT_DOCS.filter(d => generatedIds.has(d.id)).map(d => ({ id: d.id, label: d.label, sublabel: d.sublabel, status: "ready" })) } })} className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-primary/40 transition-all hover:scale-[1.03] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] active:scale-[0.98]">
            <Ship className="h-4 w-4" />Proceed to Logistics<ArrowRight className="h-4 w-4" />
          </button>
          <p className="pointer-events-auto text-center text-[10px] text-muted-foreground">{gatingGenerated}/{gatingDocs.length} required docs ready</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ msg, onAction, isSessionReady, onPermitUpload, onPreviewK2, signed, activeStep }: {
  msg: Message; onAction: (action: string, label: string) => void;
  isSessionReady: boolean;
  onPermitUpload: (permitKey: string, file: File) => void;
  onPreviewK2: () => void;
  signed: boolean;
  activeStep: number;
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft-sm">
          {msg.kind === "upload" ? <div className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /><span>{(msg as {fileName: string}).fileName}</span></div> : msg.content}
        </div>
      </div>
    );
  }

  if (msg.kind === "blocked") {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft"><AlertTriangle className="h-4 w-4 text-danger" /></div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-danger/40 bg-danger-soft/50 px-4 py-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-danger">Dependency Blocked</div>
          <p className="text-sm text-foreground">{msg.content}</p>
        </div>
      </div>
    );
  }

  if (msg.kind === "processing") {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft"><Link2 className="h-4 w-4 text-primary" /></div>
        <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">{msg.content}</div>
      </div>
    );
  }

  if (msg.kind === "reference") {
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[85%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{msg.content}</div>
          <a href={msg.refUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-xs font-medium text-primary hover:bg-primary-soft/70 transition-base">
            <ExternalLink className="h-3.5 w-3.5" /><span>{msg.refTitle}</span><ArrowRight className="ml-auto h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  if (msg.kind === "extracted") {
    const m = msg as { fields: Record<string, string>; valid: boolean; content: string };
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[90%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{m.content}</div>
          <div className={`rounded-2xl border p-3 ${m.valid ? "border-success/30 bg-success-soft/30" : "border-warning/30 bg-warning-soft/30"}`}>
            <div className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${m.valid ? "text-success" : "text-warning"}`}>
              {m.valid ? <><CheckCircle2 className="h-3.5 w-3.5" />Validated</> : <><AlertCircle className="h-3.5 w-3.5" />Partial extraction</>}
            </div>
            <div className="space-y-1.5">
              {Object.entries(m.fields).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4">
                  <span className="text-[11px] text-muted-foreground shrink-0">{k}</span>
                  <span className="text-[12px] font-medium text-foreground text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === "hs-result") {
    const m = msg as { hsCode: string; description: string; duty: number; fta: string[]; permitRequired: boolean; permits: string[]; content: string };
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[90%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{m.content}</div>
          <div className="rounded-2xl border border-border bg-background p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-primary-soft px-2.5 py-1 text-sm font-bold font-mono text-primary">{m.hsCode}</span>
              <span className="text-sm font-semibold text-foreground flex-1">{m.description}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-secondary px-2 py-1.5"><span className="text-muted-foreground">Import Duty: </span><span className="font-bold text-foreground">{m.duty}%</span></div>
              {m.fta.length > 0 && <div className="rounded-lg bg-success-soft px-2 py-1.5"><span className="text-success font-medium">FTA: {m.fta.join(", ")}</span></div>}
            </div>
            {m.permitRequired && m.permits.length > 0 && (
              <div className="rounded-lg bg-warning-soft border border-warning/30 px-2 py-2 text-[11px]">
                <span className="font-semibold text-warning">⚠ Permit(s) required: </span>
                <span className="text-warning">{m.permits.join(", ")}</span>
              </div>
            )}
            {!m.permitRequired && <div className="rounded-lg bg-success-soft px-2 py-1.5 text-[11px] font-semibold text-success">✅ No PUA122 permits required</div>}
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === "permit-upload") {
    const m = msg as { permits: Array<{ name: string; key: string; uploaded: boolean }>; content: string };
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[90%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{m.content}</div>
          <div className="rounded-2xl border border-border bg-background p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Upload Permit Certificates</div>
            {m.permits.map(p => (
              <div key={p.key} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <input ref={el => { fileRefs.current[p.key] = el; }} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPermitUpload(p.key, f); }} />
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${p.uploaded ? "bg-success-soft" : "bg-warning-soft"}`}>
                  {p.uploaded ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Award className="h-4 w-4 text-warning" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-foreground truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.uploaded ? "Uploaded ✓" : "Certificate required"}</div>
                </div>
                {!p.uploaded && (
                  <button onClick={() => fileRefs.current[p.key]?.click()} className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 transition-base">
                    <Upload className="h-3 w-3" />Upload
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === "valuation") {
    const m = msg as { fob: number; freight: number; insurance: number; duty: number; total: number; savings: number; bestFta: string; content: string };
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[90%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{m.content}</div>
          <div className="rounded-2xl border border-border bg-background p-3 space-y-2">
            {[
              { l: "FOB Value", v: `RM ${m.fob.toLocaleString()}` },
              { l: "Freight", v: `RM ${m.freight.toLocaleString()}` },
              { l: "Insurance", v: `RM ${m.insurance.toLocaleString()}` },
              { l: "Est. Import Duty", v: `RM ${m.duty.toLocaleString()}` },
            ].map(r => (
              <div key={r.l} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{r.l}</span>
                <span className="font-medium text-foreground">{r.v}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-semibold text-foreground">Total Landed Cost</span>
              <span className="text-lg font-bold text-foreground">RM {m.total.toLocaleString()}</span>
            </div>
            {m.savings > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-success-soft px-2.5 py-2 text-[11px] font-semibold text-success">
                <TrendingDown className="h-3.5 w-3.5 shrink-0" />Save RM {m.savings.toLocaleString()} via {m.bestFta || "FTA"} Form D
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === "checklist") {
    const m = msg as { items: ChecklistItem[]; actions?: ActionButton[]; content: string };
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[85%] space-y-3">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{m.content}</div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Compliance Checklist</div>
            <ul className="space-y-1.5">
              {m.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <StatusTag status={item.status} />
                </li>
              ))}
            </ul>
          </div>
          {m.actions && (
            <div className="flex flex-wrap gap-2">
              {m.actions.map((a, i) => {
                const Icon = a.icon;
                return (
                  <button key={i} type="button" onClick={() => onAction(a.action, a.label)} disabled={!isSessionReady} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-base disabled:opacity-40 disabled:cursor-not-allowed ${a.intent === "primary" ? "bg-primary text-primary-foreground shadow-glow hover:opacity-90" : "border border-border bg-card text-foreground hover:bg-secondary"}`}>
                    <Icon className="h-4 w-4" />{a.label}
                  </button>
                );
              })}
              {/* Extra: Step 7 gets a K2 preview button when signed */}
              {activeStep === 8 && signed && (
                <button type="button" onClick={onPreviewK2} className="flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-base">
                  <Eye className="h-4 w-4" />Preview K2 Form
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // default: text + K2 button when on step 8 signed
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-foreground space-y-1">
          {renderMarkdown(msg.content)}
        </div>
        {activeStep === 8 && signed && (
          <button type="button" onClick={onPreviewK2} className="flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-base">
            <Eye className="h-4 w-4" />Preview & Submit K2
          </button>
        )}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
      <Sparkles className="h-4 w-4 text-primary-foreground" />
    </div>
  );
}

function StatusTag({ status }: { status: ChecklistStatus }) {
  const styles: Record<ChecklistStatus, string> = { REQUIRED: "bg-danger-soft text-danger", PENDING: "bg-warning-soft text-warning", COMPLETED: "bg-success-soft text-success" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles[status]}`}>[{status}]</span>;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  const flushList = (key: string) => {
    if (!listItems.length) return;
    nodes.push(<ul key={key} className="my-1.5 space-y-1 pl-1">{listItems.map((item, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><span>{inlineFormat(item)}</span></li>)}</ul>);
    listItems = [];
  };
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(`list-${idx}`); return; }
    const bulletMatch = trimmed.match(/^[*\-]\s+(.+)/);
    if (bulletMatch) { listItems.push(bulletMatch[1]); return; }
    const numMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numMatch) { listItems.push(numMatch[1]); return; }
    const headingMatch = trimmed.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) { flushList(`list-${idx}`); nodes.push(<p key={idx} className="mt-2 mb-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{headingMatch[1]}</p>); return; }
    flushList(`list-${idx}`);
    nodes.push(<p key={idx} className="text-sm leading-relaxed">{inlineFormat(trimmed)}</p>);
  });
  flushList("list-end");
  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-secondary px-1 py-0.5 text-[12px] font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}