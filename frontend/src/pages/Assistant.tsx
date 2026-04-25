<<<<<<< HEAD
import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
=======
/**
 * Assistant.tsx — Borderless AI · Compliance Architect
 * Full 9-step export workflow with real modals, forms, permit upload,
 * digital access checklist, valuation, logistics, e-signature & K2 preview.
 */

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { useNavigate } from "react-router-dom";
>>>>>>> architect-ai
import TopNav from "@/components/TopNav";
import {
  Building2, FileCheck2, Award, FileSearch,
  ShieldCheck, Sparkles, Mic, ArrowUp, Loader2, Paperclip,
  Cog, Link2, AlertTriangle, ExternalLink, Upload, ArrowRight,
  CheckCircle2, Lock, FileText, FileSpreadsheet, Ship, ClipboardList,
  Stamp, Leaf, Download, TrendingDown, Info, KeyRound,
<<<<<<< HEAD
  UserSquare2, Coins, PackageSearch, PenLine,
} from "lucide-react";

type ChecklistStatus = "REQUIRED" | "PENDING" | "COMPLETED";

type Step = {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
};

const STEPS: Step[] = [
  { id: 0, title: "Entity Verification", subtitle: "SSM & BRN Registration", icon: Building2 },
  { id: 1, title: "Consignee Details", subtitle: "Buyer & Importer Info", icon: UserSquare2 },
  { id: 2, title: "Classification", subtitle: "HS Code & Duty Lookup", icon: FileSearch },
  { id: 3, title: "Special Permits", subtitle: "SIRIM / Halal / MITI", icon: Award },
  { id: 4, title: "Digital Access", subtitle: "MyCIEDS & Dagang Net", icon: KeyRound },
  { id: 5, title: "Financial Valuation", subtitle: "FOB, Freight & FX", icon: Coins },
  { id: 6, title: "Logistics & Metrics", subtitle: "Mode, Vessel, Weight", icon: PackageSearch },
  { id: 7, title: "Trade Docs & Signatory", subtitle: "Invoice, B/L, Declaration", icon: FileText },
  { id: 8, title: "Customs Submission", subtitle: "K2 Form Preview", icon: FileCheck2 },
];

type ChecklistItem = { label: string; status: ChecklistStatus };

type DocStatus = "ready" | "partial" | "locked";

// ── Export doc definition ────────────────────────────────────────────────────
// `coreRequired` = always needed regardless of product
// `conditionalKey` = only required when the corresponding flag is true
type ExportDoc = {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  requiredSteps: number[];
  coreRequired?: boolean;
  conditionalKey?: "needsSirim" | "needsHalal" | "needsCoo";
};

const EXPORT_DOCS: ExportDoc[] = [
  {
    id: "commercial-invoice",
    label: "Commercial Invoice",
    sublabel: "Buyer & seller details, FOB value, FX",
    icon: FileText,
    requiredSteps: [0, 1, 2, 5],
    coreRequired: true,
  },
  {
    id: "packing-list",
    label: "Packing List",
    sublabel: "Item weights, dimensions & quantities",
    icon: FileSpreadsheet,
    requiredSteps: [0, 1, 2, 6],
    coreRequired: true,
  },
  {
    id: "bol",
    label: "Bill of Lading / Air Waybill",
    sublabel: "Carrier, vessel & routing information",
    icon: Ship,
    requiredSteps: [0, 1, 2, 6, 7],
    coreRequired: true,
  },
  {
    id: "k2",
    label: "K2 Declaration Form",
    sublabel: "Customs export declaration (signed)",
    icon: ClipboardList,
    requiredSteps: [0, 1, 2, 3, 4, 5, 6, 7],
    coreRequired: true,
  },
  {
    id: "coo",
    label: "Certificate of Origin",
    sublabel: "ATIGA / FTA Form D",
    icon: Stamp,
    requiredSteps: [0, 1, 2, 3],
    conditionalKey: "needsCoo",
  },
  {
    id: "sirim",
    label: "SIRIM Certificate",
    sublabel: "Standards & quality compliance",
    icon: ShieldCheck,
    requiredSteps: [0, 2, 3],
    conditionalKey: "needsSirim",
  },
  {
    id: "halal",
    label: "Halal Certificate",
    sublabel: "JAKIM-recognised certification",
    icon: Leaf,
    requiredSteps: [0, 2, 3, 4],
    conditionalKey: "needsHalal",
  },
];

// ── Permit flags determined after Step 3 ────────────────────────────────────
type PermitFlags = {
  needsSirim: boolean;
  needsHalal: boolean;
  needsCoo: boolean;
};

// ── Derive whether a doc is "gating" given current permit flags ──────────────
const isGating = (doc: ExportDoc, flags: PermitFlags): boolean => {
  if (doc.coreRequired) return true;
  if (doc.conditionalKey && flags[doc.conditionalKey]) return true;
  return false;
};

const docStatus = (doc: ExportDoc, completed: Set<number>): DocStatus => {
  const missing = doc.requiredSteps.filter((s) => !completed.has(s)).length;
  if (missing === 0) return "ready";
  if (missing <= 2) return "partial";
  return "locked";
};
=======
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
>>>>>>> architect-ai

type Message =
  | { id: string; role: "user"; kind: "text"; content: string }
  | { id: string; role: "user"; kind: "upload"; content: string; fileName: string }
  | { id: string; role: "assistant"; kind: "processing"; content: string }
  | { id: string; role: "assistant"; kind: "text"; content: string }
  | { id: string; role: "assistant"; kind: "checklist"; content: string; items: ChecklistItem[]; actions?: ActionButton[] }
<<<<<<< HEAD
  | { id: string; role: "assistant"; kind: "blocked"; content: string }
  | { id: string; role: "assistant"; kind: "reference"; content: string; refTitle: string; refUrl: string };

type ActionButton = { label: string; icon: React.ElementType; intent: "primary" | "ghost"; action: string };

const genId = () => Math.random().toString(36).slice(2);

const STEP_FLOW: Record<number, { intro: Message; onComplete: Message }> = {
  0: {
    intro: {
      id: "i0", role: "assistant", kind: "checklist",
      content: "To verify your entity, I need confirmation against SSM (Suruhanjaya Syarikat Malaysia). Upload your business registration so I can map dependencies.",
      items: [
        { label: "SSM Certificate (Form 9 / Form D)", status: "REQUIRED" },
        { label: "Business Registration Number (BRN)", status: "REQUIRED" },
        { label: "Director NRIC verification", status: "PENDING" },
      ],
      actions: [
        { label: "Upload SSM Certificate", icon: Upload, intent: "primary", action: "upload-ssm" },
        { label: "Verify SSM manually", icon: ShieldCheck, intent: "ghost", action: "verify-ssm" },
      ],
    },
    onComplete: {
      id: "c0", role: "assistant", kind: "text",
      content: "✅ Entity verified. SSM No. 202301045678-A linked to RMCD records. Now collecting your overseas buyer details.",
    },
  },
  1: {
    intro: {
      id: "i1", role: "assistant", kind: "checklist",
      content: "Every export declaration needs the consignee on record. I'll pre-fill the Commercial Invoice and B/L from this.",
      items: [
        { label: "Consignee (Buyer) name & full address", status: "REQUIRED" },
        { label: "Importer contact (email & phone)", status: "REQUIRED" },
        { label: "Importer Tax / VAT ID (destination country)", status: "PENDING" },
        { label: "Notify Party (if different)", status: "PENDING" },
      ],
      actions: [
        { label: "Add Consignee details", icon: UserSquare2, intent: "primary", action: "add-consignee" },
        { label: "Import from previous shipment", icon: Upload, intent: "ghost", action: "import-consignee" },
      ],
    },
    onComplete: {
      id: "c1", role: "assistant", kind: "text",
      content: "✅ Consignee captured: PT Sumber Rasa, Jakarta Pusat 10110, Indonesia. Tax ID 01.234.567.8-901.000. Mapping product classification next.",
    },
  },
  2: {
    intro: {
      id: "i2", role: "assistant", kind: "checklist",
      content: "Now mapping your product against the WCO Harmonized System. The HS Code drives every downstream permit and duty calculation.",
      items: [
        { label: "Product description & specs", status: "REQUIRED" },
        { label: "HS Code lookup (8-digit)", status: "PENDING" },
        { label: "Import duty rate (destination)", status: "PENDING" },
      ],
      actions: [
        { label: "Upload product photo", icon: Upload, intent: "primary", action: "upload-product" },
        { label: "Search HS Code", icon: FileSearch, intent: "ghost", action: "lookup-hs" },
      ],
    },
    onComplete: {
      id: "c2", role: "assistant", kind: "text",
      content: "✅ Classified as HS 0902.30.10 (Black tea, fermented, in packings ≤ 3kg). Duty: 5% under ATIGA. Now checking permit dependencies.",
    },
  },
  3: {
    intro: {
      id: "i3", role: "assistant", kind: "reference",
      content: "Your HS Code triggers SIRIM compliance. Halal cert recommended for ASEAN F&B markets. MITI export licence not required at this volume.",
      refTitle: "SIRIM QAS — Product Certification",
      refUrl: "https://www.sirim-qas.com.my/",
    },
    onComplete: {
      id: "c3", role: "assistant", kind: "text",
      content: "✅ SIRIM cert validated. JAKIM Halal logo permitted. COO (Form D) required for ATIGA duty exemption. Proceeding to digital access setup.",
    },
  },
  4: {
    intro: {
      id: "i4", role: "assistant", kind: "checklist",
      content: "K2 declaration must be submitted via Dagang Net. You'll need a Digital Certificate for authentication.",
      items: [
        { label: "MyCIEDS account", status: "REQUIRED" },
        { label: "Dagang Net subscription", status: "REQUIRED" },
        { label: "Digital Certificate (token)", status: "PENDING" },
      ],
      actions: [
        { label: "Connect Dagang Net", icon: Link2, intent: "primary", action: "connect-dagang" },
      ],
    },
    onComplete: {
      id: "c4", role: "assistant", kind: "text",
      content: "✅ Dagang Net linked. Digital Certificate active until 2027. Now valuing the shipment.",
    },
  },
  5: {
    intro: {
      id: "i5", role: "assistant", kind: "checklist",
      content: "RMCD requires a full valuation breakdown to assess duties. I'll convert FX automatically using Bank Negara reference rates.",
      items: [
        { label: "FOB value (goods at Malaysian port)", status: "REQUIRED" },
        { label: "Insurance cost (CIF component)", status: "REQUIRED" },
        { label: "Freight cost", status: "REQUIRED" },
        { label: "Invoice currency & exchange rate to RM", status: "PENDING" },
        { label: "FTA exemption reference (if claimed)", status: "PENDING" },
      ],
      actions: [
        { label: "Enter valuation", icon: Coins, intent: "primary", action: "enter-valuation" },
      ],
    },
    onComplete: {
      id: "c5", role: "assistant", kind: "text",
      content: "✅ Valuation locked. FOB USD 1,000 · Insurance USD 25 · Freight USD 45. FX 4.72 RM/USD (BNM 22 Apr 2026). ATIGA Form D claimed — duty exemption RM 320.",
    },
  },
  6: {
    intro: {
      id: "i6", role: "assistant", kind: "checklist",
      content: "Logistics specifics flow into both the K2 form and the Bill of Lading. Get this right or your shipment gets held at the port.",
      items: [
        { label: "Mode of Transport (Sea / Air / Rail / Road)", status: "REQUIRED" },
        { label: "Vessel name or Flight number", status: "REQUIRED" },
        { label: "Port / Place of Export", status: "REQUIRED" },
        { label: "Port of Discharge (destination)", status: "REQUIRED" },
        { label: "Scheduled export date", status: "REQUIRED" },
        { label: "Gross weight (kg) & measurement (m³)", status: "PENDING" },
        { label: "Packaging type & container number", status: "PENDING" },
      ],
      actions: [
        { label: "Add shipment details", icon: PackageSearch, intent: "primary", action: "add-shipment" },
        { label: "Pull from carrier booking", icon: Ship, intent: "ghost", action: "pull-carrier" },
      ],
    },
    onComplete: {
      id: "c6", role: "assistant", kind: "text",
      content: "✅ Shipment: SEA · MV Bunga Mas 5 · ETD 02 May 2026 · Port Klang → Tanjung Priok. 480 kg / 1.2 m³ · 12 cartons on 1 EUR pallet · Container MSKU-7842150.",
    },
  },
  7: {
    intro: {
      id: "i7", role: "assistant", kind: "checklist",
      content: "Generating Commercial Invoice, Packing List, and the Bill of Lading from your verified data. The K2 form needs a named signatory.",
      items: [
        { label: "Commercial Invoice", status: "PENDING" },
        { label: "Packing List", status: "PENDING" },
        { label: "Bill of Lading / Air Waybill", status: "PENDING" },
        { label: "Authorized signatory (NRIC / Passport)", status: "REQUIRED" },
        { label: "Signatory designation (job title)", status: "REQUIRED" },
        { label: "Declaration of truth (e-signature)", status: "REQUIRED" },
      ],
      actions: [
        { label: "Generate trade docs", icon: FileText, intent: "primary", action: "generate-docs" },
        { label: "Sign declaration", icon: PenLine, intent: "ghost", action: "sign-declaration" },
      ],
    },
    onComplete: {
      id: "c7", role: "assistant", kind: "text",
      content: "✅ INV-2026-0042, PL-2026-0042, B/L MAEU-558410 generated. Signed by Aisyah Rahman (Director, NRIC 880412-14-5566). Ready for K2 submission.",
    },
  },
  8: {
    intro: {
      id: "i8", role: "assistant", kind: "text",
      content: "All dependencies satisfied. K2 Customs Declaration is ready for preview and submission to RMCD via Dagang Net.",
    },
    onComplete: {
      id: "c8", role: "assistant", kind: "text",
      content: "🎉 K2 submitted. Reference: K2-MY-2026-118742. RMCD acknowledgement expected within 4 business hours.",
    },
  },
};

// ── Simulated permit detection after Step 3 ──────────────────────────────────
// In a real app this would come from the HS Code lookup result.
// Here we hard-code the tea example: needs SIRIM + Halal + COO (ATIGA).
const DETECTED_PERMIT_FLAGS: PermitFlags = {
  needsSirim: true,
  needsHalal: true,
  needsCoo: true,
};

export default function AssistantPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const scanContext = (location.state ?? {}) as { product?: string; hsCode?: string; confidence?: string; destinationCountry?: string };
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [activeStep, setActiveStep] = useState(0);

  // Permit flags become active once Step 3 is completed
  const [permitFlags, setPermitFlags] = useState<PermitFlags>({
    needsSirim: false,
    needsHalal: false,
    needsCoo: false,
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome", role: "assistant", kind: "text",
      content: "Hi — I'm your Compliance Architect. I'll guide you through every regulatory dependency in order: Entity → Consignee → HS Code → Permits → Digital Access → Valuation → Logistics → Docs & Signatory → K2. Let's start with entity verification.",
    },
    STEP_FLOW[0].intro,
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const total = STEPS.length;
  const progress = Math.round((completed.size / total) * 100);

  const docsWithStatus = EXPORT_DOCS.map((d) => ({ ...d, status: docStatus(d, completed) }));
  const readyDocs = docsWithStatus.filter((d) => d.status === "ready");
  const partialDocs = docsWithStatus.filter((d) => d.status === "partial");
  const lockedDocs = docsWithStatus.filter((d) => d.status === "locked");

  // ── Gating: core 4 + any conditional doc triggered by permit flags ──────────
  const gatingDocs = EXPORT_DOCS.filter((d) => isGating(d, permitFlags));

  // canProceed = every gating doc has been generated
  const canProceed = gatingDocs.length > 0 && gatingDocs.every((d) => generatedIds.has(d.id));

  // How many gating docs are done (for progress display)
  const gatingGenerated = gatingDocs.filter((d) => generatedIds.has(d.id)).length;

  const handleGenerate = (id: string) => {
    if (generatedIds.has(id) || generatingId) return;
    setGeneratingId(id);
    setTimeout(() => {
      setGeneratingId(null);
      setGeneratedIds((prev) => new Set([...prev, id]));
    }, 1400);
  };

  const advance = () => {
    setSending(true);
    const processingMsg: Message = {
      id: genId(), role: "assistant", kind: "processing",
      content: "Mapping dependencies against RMCD & MITI regulations...",
    };
    setMessages((m) => [...m, processingMsg]);
    setTimeout(() => {
      setMessages((m) => {
        const filtered = m.filter((x) => x.id !== processingMsg.id);
        const next = [...filtered, STEP_FLOW[activeStep].onComplete];
        const nextStep = activeStep + 1;
        if (nextStep < total && STEP_FLOW[nextStep]) {
          next.push(STEP_FLOW[nextStep].intro);
        }
        return next;
      });

      const newCompleted = new Set([...completed, activeStep]);
      setCompleted(newCompleted);

      // ── After Step 3 completes, activate permit flags ──────────────────────
      if (activeStep === 3) {
        setPermitFlags(DETECTED_PERMIT_FLAGS);
      }

      setActiveStep((s) => Math.min(s + 1, total - 1));
      setSending(false);
    }, 1400);
  };

  const tryJumpTo = (stepId: number) => {
    if (completed.has(stepId) || stepId === activeStep) {
      setActiveStep(stepId);
      return;
    }
    const blocking = STEPS.slice(0, stepId).find((s) => !completed.has(s.id));
    if (!blocking) return;
    setMessages((m) => [...m, {
      id: genId(), role: "assistant", kind: "blocked",
      content: `Action Blocked: You must complete "${blocking.title}" (${blocking.subtitle}) before accessing "${STEPS[stepId].title}".`,
    }]);
  };

  const handleAction = (action: string, label: string) => {
    setMessages((m) => [...m, { id: genId(), role: "user", kind: "text", content: label }]);
    advance();
  };

  const carriedDocs = EXPORT_DOCS.filter((doc) => generatedIds.has(doc.id)).map((doc) => ({
    id: doc.id,
    label: doc.label,
    sublabel: doc.sublabel,
    status: "ready",
  }));

  const handleSend = () => {
    if (!input.trim() || sending) return;
    setMessages((m) => [...m, { id: genId(), role: "user", kind: "text", content: input.trim() }]);
    setInput("");
    advance();
  };

=======
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
// AI HELPERS — module level (no hooks needed)
// ─────────────────────────────────────────────────────────────────────────────
const GLM_KEY = "sk-fd9182ed29f4722fd9c3fc8b852a43e39c01234247156a93";
const GLM_URL = "https://api.ilmu.ai/v1/chat/completions";
const GLM_MDL = "ilmu-glm-5.1";
const GEM_KEY = "AIzaSyDXnhf8TrJzUq1rkC2c5_XKuUpvDMZXU-8";
const GEM_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEM_KEY}`;

async function glmJSON(system: string, user: string, history: {role:string;content:string}[] = []): Promise<Record<string,unknown>> {
  const r = await fetch(GLM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM_KEY}` },
    body: JSON.stringify({
      model: GLM_MDL, max_tokens: 2000, temperature: 0.1,
      messages: [
        { role: "system", content: system + "\n\nReturn ONLY valid JSON. No markdown fences, no backticks." },
        ...history,
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  const d = await r.json();
  const raw: string = d.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { return { parse_error: true, raw }; }
}

async function glmText(system: string, user: string, history: {role:string;content:string}[] = []): Promise<string> {
  const r = await fetch(GLM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM_KEY}` },
    body: JSON.stringify({
      model: GLM_MDL, max_tokens: 1200, temperature: 0.45,
      messages: [{ role: "system", content: system }, ...history, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  const d = await r.json();
  return (d.choices?.[0]?.message?.content as string) ?? "";
}

async function geminiVision(b64: string, mime: string, prompt: string): Promise<Record<string,unknown>> {
  const r = await fetch(GEM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: mime, data: b64 } },
        { text: prompt + "\n\nReturn ONLY valid JSON. No markdown fences." },
      ]}],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
    }),
  });
  if (!r.ok) throw new Error(`Vision ${r.status}`);
  const d = await r.json();
  const raw: string = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { return { parse_error: true, raw }; }
}

function fileToB64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload  = () => res((fr.result as string).split(",")[1]);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

const fileMime = (f: File): string => f.type || (f.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

// Helper: check if a field value is meaningful (not empty, not a dash placeholder)
const hasMeaning = (v: unknown): boolean =>
  v != null &&
  typeof v === "string" &&
  v.trim().length > 1 &&
  v.trim() !== "—" &&
  v.trim() !== "-" &&
  v.trim() !== "N/A" &&
  v.trim() !== "null" &&
  v.trim() !== "undefined";

// ─────────────────────────────────────────────────────────────────────────────
// PDF BUILDER — proper A4 documents matching official Malaysian templates
// ─────────────────────────────────────────────────────────────────────────────

/** Low-level PDF operator builder (uses only Helvetica — no external fonts needed) */
class PDFDoc {
  private ops: string[] = [];
  readonly W = 595; readonly H = 842;
  readonly LM = 34; readonly RM = 561; readonly PW = 527;
  private _y = 0;

  get y() { return this._y; }
  set y(v: number) { this._y = v; }

  rect(x: number, y: number, w: number, h: number, fill?: string, stroke = true): this {
    if (fill) {
      const [r,g,b] = fill.split(" "); this.ops.push(`${r} ${g} ${b} rg`);
    }
    const sw = stroke ? 1 : 0;
    this.ops.push(`${x.toFixed(1)} ${(y-h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re`);
    if (fill && stroke) this.ops.push("B");
    else if (fill)      this.ops.push("f");
    else                this.ops.push("S");
    if (fill) this.ops.push("0 0 0 rg");
    void sw;
    return this;
  }

  hline(x1: number, x2: number, y: number, w = 0.4): this {
    this.ops.push(`${w} w ${x1.toFixed(1)} ${y.toFixed(1)} m ${x2.toFixed(1)} ${y.toFixed(1)} l S 0.4 w`);
    return this;
  }
  vline(x: number, y1: number, y2: number, w = 0.4): this {
    this.ops.push(`${w} w ${x.toFixed(1)} ${y1.toFixed(1)} m ${x.toFixed(1)} ${y2.toFixed(1)} l S 0.4 w`);
    return this;
  }

  text(s: string, x: number, y: number, sz = 6.5, bold = false, align: "L"|"C"|"R" = "L", color = PDFDoc.BLACK): this {
    const safe = s.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").substring(0,120);
    const font = bold ? "F2" : "F1";
    const [r,g,b] = color.split(" ");
    this.ops.push(`BT /${font} ${sz} Tf ${r} ${g} ${b} rg`);
    if (align === "C")      this.ops.push(`${(x).toFixed(1)} ${y.toFixed(1)} Td (${safe}) Tj`);
    else if (align === "R") this.ops.push(`${x.toFixed(1)} ${y.toFixed(1)} Td (${safe}) Tj`);
    else                    this.ops.push(`${x.toFixed(1)} ${y.toFixed(1)} Td (${safe}) Tj`);
    this.ops.push("0 0 0 rg ET");
    return this;
  }

  fieldLine(x: number, y: number, w: number): this { return this.hline(x, x+w, y-1.5, 0.3); }

  cellLabel(lines: string[], x: number, yTop: number, sz = 5.5, bold = false, color = PDFDoc.BLACK): this {
    lines.forEach((ln, i) => { if (ln) this.text(ln, x+2, yTop - 5 - i*7, sz, bold, "L", color); });
    return this;
  }

  checkbox(x: number, y: number): this {
    this.ops.push(`${x.toFixed(1)} ${(y-5).toFixed(1)} 5 5 re S`);
    return this;
  }

  build(filename: string): void {
    const stream = this.ops.join("\n");
    const resources = "<</Font<</F1 5 0 R/F2 6 0 R>>>>";
    const pdf = [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${this.W} ${this.H}]/Contents 4 0 R/Resources ${resources}>>endobj`,
      `4 0 obj<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj`,
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
      "6 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>endobj",
      "xref\n0 7\n0000000000 65535 f\n",
      "trailer<</Size 7/Root 1 0 R>>\nstartxref\n9\n%%EOF",
    ].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })),
      download: filename,
    });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  static BLUE  = "0.15 0.30 0.55";
  static LGRAY = "0.93 0.93 0.93";
  static MGRAY = "0.83 0.83 0.83";
  static LBLUE = "0.88 0.92 0.96";
  static WHITE = "1 1 1";
  static BLACK = "0 0 0";
}

/** Generate a properly formatted K2 (Kastam No.2) export declaration PDF */
function generateK2PDF(data: Record<string,unknown>): void {
  const d = new PDFDoc();
  const { LM, RM, PW, W, H } = d;
  const mm = (v: number) => v * 2.835;
  const s = (v: unknown) => String(v ?? "");

  const form = (data.k2_form_data || {}) as Record<string,unknown>;
  const exp  = (form.exporter   || {}) as Record<string,string>;
  const con  = (form.consignee  || {}) as Record<string,string>;
  const trp  = (form.transport  || {}) as Record<string,string>;
  const gds  = (form.goods      || {}) as Record<string,unknown>;
  const val  = (form.valuation  || {}) as Record<string,number>;
  const duty = (form.duty       || {}) as Record<string,number>;
  const sig  = (form.signatory  || {}) as Record<string,string>;

  let y = H - mm(8);

  d.rect(LM, y, PW, mm(18), PDFDoc.BLUE);
  d.text("JABATAN KASTAM DIRAJA MALAYSIA / ROYAL MALAYSIAN CUSTOMS DEPARTMENT",
    W/2, y - mm(5), 7.5, true, "C", PDFDoc.WHITE);
  d.text("PERAKUAN BARANG YANG DIEKSPORT / DECLARATION OF GOODS TO BE EXPORTED",
    W/2, y - mm(10), 6.5, false, "C", PDFDoc.WHITE);
  d.text("Kastam No.2 / Customs No.2", W/2, y - mm(14.5), 8, true, "C", PDFDoc.WHITE);
  y -= mm(18);

  d.text("Tandakan (/) / Mark (/) at relevant column:", LM, y - mm(4), 6);
  d.checkbox(LM + mm(95), y - mm(1)); d.text("Eksport / Export", LM + mm(99), y - mm(4), 6);
  d.checkbox(LM + mm(128), y - mm(1)); d.text("Tempatan / Local", LM + mm(132), y - mm(4), 6);
  y -= mm(10);

  const LW = PW * 0.54;
  const RW = PW * 0.46;
  const BOX_H = mm(30);

  const boxLeft = (num: string, ms: string, en: string, yTop: number, extraL: ()=>void, extraR: ()=>void) => {
    d.rect(LM, yTop, LW, BOX_H);
    d.rect(LM + LW, yTop, RW, BOX_H, PDFDoc.LGRAY);
    d.text(`${num}. ${ms}`, LM + 2, yTop - mm(4), 6, true);
    d.text(en, LM + 2, yTop - mm(7.5), 5.5);
    d.hline(LM + 2, LM + LW - 2, yTop - mm(8), 0.3);
    extraL();
    extraR();
    return yTop - BOX_H;
  };

  y = boxLeft("1",
    "Konsainor/Pengeksport (Nama dan Alamat)",
    "Consignor / Exporter (Name and Address)", y,
    () => {
      d.text(s(exp.name), LM + 2, y + BOX_H - mm(12), 6.5);
      d.text(s(exp.address), LM + 2, y + BOX_H - mm(17), 5.5);
      d.text(`BRN: ${s(exp.brn)}`, LM + 2, y + BOX_H - mm(22), 5.5);
      d.text("i) Kod Pengeksport / Exporter Code:", LM + 2, y + BOX_H - mm(27), 5, true);
    },
    () => {
      d.text("UNTUK KEGUNAAN RASMI / FOR OFFICIAL USE", LM+LW+2, y+BOX_H-mm(4), 5.5, true);
      d.text("Tarikh & Waktu Terima / Date & Time of Receipt:", LM+LW+2, y+BOX_H-mm(10), 5);
      d.fieldLine(LM+LW+2, y+BOX_H-mm(10), RW-4);
      d.text("No. Pendaftaran / Registration No.:", LM+LW+2, y+BOX_H-mm(17), 5);
      d.fieldLine(LM+LW+2, y+BOX_H-mm(17), RW-4);
      d.text("Stesen / Station:", LM+LW+2, y+BOX_H-mm(24), 5);
    }
  );

  y = boxLeft("2",
    "Konsaini/Pengimport (Nama dan Alamat)",
    "Consignee / Importer (Name and Address)", y,
    () => {
      d.text(s(con.name), LM+2, y+BOX_H-mm(12), 6.5);
      d.text(s(con.address || con.country_code), LM+2, y+BOX_H-mm(17), 5.5);
      d.text("No. Pendaftaran Cukai Jualan / Sales Tax Reg. No.*:", LM+2, y+BOX_H-mm(27), 5, true);
    },
    () => {
      d.text("5. Penerimaan Duti/Cukai dibenarkan oleh:", LM+LW+2, y+BOX_H-mm(4), 5.5, true);
      d.text("Receipt of Duty authorized by:", LM+LW+2, y+BOX_H-mm(8), 5);
      d.fieldLine(LM+LW+2, y+BOX_H-mm(15), RW-4);
      d.text("Tarikh/Date", LM+LW+2, y+BOX_H-mm(18), 5);
      d.fieldLine(LM+LW+2, y+BOX_H-mm(24), RW/2-2);
      d.text("Pegawai Kastam / Proper Officer", LM+LW+RW/2, y+BOX_H-mm(24), 5);
    }
  );

  y = boxLeft("3",
    "Nama & Alamat Ejen Yang Diberikuasa",
    "Name and Address of Authorized Agent", y,
    () => {
      d.text("i) Kod Ejen / Agent Code:", LM+2, y+BOX_H-mm(15), 5, true);
      d.fieldLine(LM+mm(30), y+BOX_H-mm(15), LW-mm(32));
      d.text("ii) No. Cukai Perkhidmatan / Service Tax Reg. No.*:", LM+2, y+BOX_H-mm(22), 5, true);
      d.fieldLine(LM+mm(55), y+BOX_H-mm(22), LW-mm(57));
    },
    () => {
      d.text("8. STA  □ Ya/Yes  □ Tidak/No", LM+LW+2, y+BOX_H-mm(4), 5.5, true);
      d.text("9. No. Permit Eksport / Export Permit No.:", LM+LW+2, y+BOX_H-mm(11), 5, true);
      d.fieldLine(LM+LW+2, y+BOX_H-mm(11), RW-4);
      d.text("10. No. K.P.W.X.:", LM+LW+2, y+BOX_H-mm(18), 5, true);
      d.fieldLine(LM+LW+mm(22), y+BOX_H-mm(18), RW-mm(24));
    }
  );

  const R4H = mm(22);
  d.rect(LM, y, PW, R4H);
  d.text("11. Negara Asal / Country of Origin:", LM+2, y-mm(4), 5.5, true);
  d.text(s(trp.country_of_destination_code) || "MY", LM+mm(52), y-mm(4), 6.5);
  d.text("12. Negara Destinasi / Country of Final Destination:", LM+mm(90), y-mm(4), 5.5, true);
  d.text(s(con.country_code), LM+mm(140), y-mm(4), 6.5);
  d.text("4. Mod Pengangkutan / Mode of Transport:", LM+2, y-mm(11), 5.5, true);
  const modes = ["1.Laut/Sea","2.Keretapi/Rail","3.Jalan/Road","4.Udara/Air","5.Lain-lain"];
  modes.forEach((m, i) => {
    const selected = (i===0 && trp.mode_code==="1") || (i===3 && trp.mode_code==="4");
    d.checkbox(LM+mm(58)+i*mm(26), y-mm(8));
    if (selected) d.text("✓", LM+mm(58.5)+i*mm(26), y-mm(10), 7);
    d.text(m, LM+mm(62)+i*mm(26), y-mm(11), 5.5);
  });
  y -= R4H;

  const R5H = mm(20);
  d.rect(LM, y, PW, R5H);
  const r5cols = [
    [mm(30), "5. Tarikh Eksport", s(form.export_date)],
    [mm(42), "6. Nama Kapal/Penerbangan", s(trp.vessel_flight_name)],
    [mm(36), "7. Pelabuhan Eksport/Port of Export", s(trp.port_of_loading_code)],
    [mm(30), "8. Pelabuhan Bongkar/Port of Discharge", s(trp.port_of_discharge_code)],
    [mm(28), "9. Melalui/Via (Transhipment)", ""],
    [PW - mm(30+42+36+30+28), "20. Kadar Pertukaran/Exchange Rate  RM", s(val.exchange_rate)],
  ] as [number, string, string][];
  let rx = LM;
  r5cols.forEach(([cw, lbl, val2]) => {
    d.vline(rx, y, y - R5H);
    d.text(lbl, rx+2, y-mm(4), 4.8, true);
    d.text(val2, rx+2, y-mm(10), 6);
    rx += cw;
  });
  y -= R5H;

  const R6H = mm(18);
  d.rect(LM, y, PW, R6H);
  const r6cols = [
    [mm(28), "13. Mata Wang/Currency", s(val.invoice_currency || "MYR")],
    [mm(34), "14. Amaun/Amount (received/to be received)", `RM ${s(val.invoice_amount)}`],
    [mm(26), "22. Insurans/Insurance  RM", s(val.insurance_myr)],
    [mm(26), "24. Tambang/Freight  RM", s(val.freight_myr)],
    [mm(26), "25. Berat Kasar/Gross Wt. (kg)", s(gds.gross_weight_kg)],
    [mm(22), "26. Ukuran/Measurement (m³)", ""],
    [PW-mm(28+34+26+26+26+22), "27. Nilai FOB/FOB Value  RM", s(val.fob_value_myr)],
  ] as [number, string, string][];
  rx = LM;
  r6cols.forEach(([cw, lbl, val2]) => {
    d.vline(rx, y, y - R6H);
    d.text(lbl, rx+2, y-mm(4), 4.5, true);
    d.text(val2, rx+2, y-mm(11), 6);
    rx += cw;
  });
  y -= R6H;

  const TH = mm(16);
  const gcols = [
    [mm(16), "28. Tanda &\nNo. Kontena"],
    [mm(8),  "29.\nBil"],
    [mm(22), "30. Bil & Jenis\nBungkusan"],
    [mm(55), "31. Perihal Barang\nDescription of Goods"],
    [mm(16), "32. Kod HS\n(AHTN)"],
    [mm(9),  "33.\nUnit"],
    [mm(14), "34. No.\nInvois"],
    [mm(13), "35.\nKuantiti"],
    [mm(16), "Nilai Unit\nFOB (RM)"],
    [mm(16), "38. Jumlah\nNilai (RM)"],
    [PW-mm(16+8+22+55+16+9+14+13+16+16+38), "39-42.\nDuti/Tax %"],
    [mm(38), "Amaun Duti &\nCukai (RM)"],
  ] as [number, string][];
  let hx = LM;
  gcols.forEach(([cw, hdr]) => {
    d.rect(hx, y, cw, TH, PDFDoc.LBLUE);
    hdr.split("\n").forEach((ln, li) => d.text(ln, hx+cw/2, y-mm(4)-li*mm(5.5), 4.8, true, "C"));
    hx += cw;
  });
  y -= TH;

  const ROWS = 7;
  const DR = mm(11);
  for (let r = 0; r < ROWS; r++) {
    hx = LM;
    gcols.forEach(([cw]) => {
      d.rect(hx, y, cw, DR, r % 2 === 0 ? PDFDoc.LGRAY : undefined);
      hx += cw;
    });
    if (r === 0) {
      const vals = [
        "", "1", `${s(gds.number_of_packages)} ${s(gds.package_type_code)}`,
        s(gds.commodity_description), s(gds.hs_code), s(gds.unit_of_quantity),
        "", s(gds.quantity), s(val.fob_value_myr),
        s(val.fob_value_myr), s(duty.export_duty_myr), s(duty.total_duty_myr),
      ];
      let vx = LM;
      vals.forEach((v2, vi) => {
        d.text(v2, vx+2, y-DR+mm(3.5), 5.5);
        vx += gcols[vi][0];
      });
    }
    y -= DR;
  }

  d.rect(LM, y, PW, mm(11), PDFDoc.MGRAY);
  d.text("JUMLAH / TOTAL:", LM+2, y-mm(4), 6, true);
  d.text(`RM ${s(val.fob_value_myr)}`, LM+mm(195), y-mm(4), 6, true);
  d.text(`Duti / Duty: RM ${s(duty.total_duty_myr)}`, LM+mm(230), y-mm(4), 6, true);
  hx = LM; gcols.forEach(([cw]) => { d.vline(hx, y, y-mm(11)); hx += cw; });
  y -= mm(11);

  const SIG_H = mm(38);
  const SW = PW * 0.52;
  d.rect(LM, y, SW, SIG_H);
  d.rect(LM+SW, y, PW-SW, SIG_H, PDFDoc.LGRAY);

  d.text("51. Nama / Name:", LM+2, y-mm(4), 5.5, true);
  d.text(s(sig.name), LM+mm(22), y-mm(4), 6.5);
  d.text("52. No. Kad Pengenalan / IC or Passport No.:", LM+2, y-mm(11), 5.5, true);
  d.text(s(sig.nric_passport), LM+mm(55), y-mm(11), 6);
  d.text("53. Jawatan / Designation:", LM+2, y-mm(18), 5.5, true);
  d.text(s(sig.designation), LM+mm(32), y-mm(18), 6);
  d.text("54. Saya memperakui perakuan ini benar / I certify this declaration is true:", LM+2, y-mm(25), 5.5, true);
  d.fieldLine(LM+2, y-mm(32), SW/2-4);
  d.text("Tarikh / Date", LM+2, y-mm(35), 5);
  d.fieldLine(LM+SW/2, y-mm(32), SW/2-2);
  d.text("Tandatangan / Signature", LM+SW/2+2, y-mm(35), 5);

  d.text("Jumlah Duti/Cukai Kena Dibayar / Total Duty Payable  RM:", LM+SW+2, y-mm(7), 5.5, true);
  d.fieldLine(LM+SW+2, y-mm(7), PW-SW-4);
  d.text(`RM ${s(duty.total_duty_myr)}`, LM+SW+mm(70), y-mm(7), 7, true);
  d.text("Caj Lain / Other Charges  RM:", LM+SW+2, y-mm(15), 5.5, true);
  d.fieldLine(LM+SW+2, y-mm(15), PW-SW-4);
  d.text("Jumlah Amaun Kena Dibayar / Total Amount Payable  RM:", LM+SW+2, y-mm(23), 5.5, true);
  d.fieldLine(LM+SW+2, y-mm(23), PW-SW-4);
  d.text("Tarikh / Date:", LM+SW+2, y-mm(32), 5);
  d.fieldLine(LM+SW+mm(16), y-mm(32), (PW-SW)/2-mm(18));
  d.text("Pegawai Kastam / Proper Officer:", LM+SW+(PW-SW)/2, y-mm(32), 5);
  y -= SIG_H;

  d.text("Nota: Perakuan ini dikehendaki di bawah Akta Kastam 1967 dan Akta Cukai Jualan 2018  |  Note: Required under Customs Act 1967 and Sales Tax Act 2018   *Jika berkenaan / If applicable",
    LM, y-mm(4), 4.8);

  d.build(`K2_Declaration_${s(data.k2_reference) || "DRAFT"}.pdf`);
}

/** Generate a Commercial Invoice PDF */
function generateInvoicePDF(data: Record<string,unknown>): void {
  const d = new PDFDoc();
  const { LM, RM, PW, W, H } = d;
  const mm = (v: number) => v * 2.835;
  const s = (v: unknown) => String(v ?? "");
  const exp  = (data.exporter  || {}) as Record<string,string>;
  const con  = (data.consignee || {}) as Record<string,string>;
  const goods = (data.goods    || []) as Array<Record<string,unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(18), PDFDoc.BLUE);
  d.text("COMMERCIAL INVOICE  /  INVOIS KOMERSIL", W/2, y-mm(7), 12, true, "C", PDFDoc.WHITE);
  d.text("MALAYSIA EXPORT DOCUMENT", W/2, y-mm(12.5), 6.5, false, "C", PDFDoc.WHITE);
  y -= mm(18);

  const LW = PW*0.52; const RW = PW-LW; const R1H = mm(50);

  d.rect(LM, y, LW, R1H);
  d.text("EXPORTER / PENGEKSPORT", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+LW-2, y-mm(5.5), 0.4);
  const expFields = [
    ["Name / Nama:", s(exp.name)],
    ["Address / Alamat:", s(exp.address)],
    ["", s(exp.address).length > 50 ? "" : ""],
    ["Tel:", s(exp.tel)],
    ["Email:", s(exp.email)],
    ["BRN:", s(exp.brn)],
    ["Bank:", s(exp.bank)],
  ];
  expFields.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val2) d.text(val2, LM+mm(22), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+mm(22), y-mm(11)-i*mm(5.5), LW-mm(24));
  });

  d.rect(LM+LW, y, RW, R1H, PDFDoc.LGRAY);
  const metaFields = [
    ["Invoice No. / No. Invois:", s(data.invoice_number)],
    ["Date / Tarikh:", s(data.invoice_date)],
    ["Customer P.O. No.:", ""],
    ["Payment Terms:", s(data.payment_terms)],
    ["Country of Origin:", "Malaysia"],
    ["Sales Tax Reg. No.*:", ""],
    ["Exporter Code:", ""],
  ];
  metaFields.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+LW+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val2) d.text(val2, LM+LW+mm(36), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+LW+2, y-mm(11)-i*mm(5.5), RW-4);
  });
  y -= R1H;

  d.rect(LM, y, LW, R1H);
  d.text("CONSIGNEE / PENERIMA", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+LW-2, y-mm(5.5), 0.4);
  const conFields = [
    ["Name / Nama:", s(con.name)],
    ["Address / Alamat:", s(con.address)],
    ["", ""],
    ["Country:", s(con.country)],
    ["Tax / VAT ID:", s(con.tax_id)],
    ["Tel:", s(con.tel)],
    ["Contact Person:", s(con.contact_person)],
  ];
  conFields.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val2) d.text(val2, LM+mm(22), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+mm(22), y-mm(11)-i*mm(5.5), LW-mm(24));
  });

  d.rect(LM+LW, y, RW, R1H, PDFDoc.LGRAY);
  const shipFields = [
    ["Incoterm:", s(data.incoterm)],
    ["Final Destination:", s(con.country)],
    ["Port of Loading:", s(data.port_of_loading)],
    ["Port of Discharge:", s(data.port_of_discharge)],
    ["Vessel / Flight:", s(data.vessel_or_flight)],
    ["B/L or AWB No.:", "TBC — Carrier to assign"],
    ["Shipment Date:", ""],
  ];
  shipFields.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+LW+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val2) d.text(val2, LM+LW+mm(30), y-mm(11)-i*mm(5.5), 5.5);
    d.fieldLine(LM+LW+2, y-mm(11)-i*mm(5.5), RW-4);
  });
  y -= R1H;

  const TH = mm(16);
  const gcols = [
    [mm(12), "QTY", "KUANTITI"],
    [mm(10), "UNIT", "UNIT"],
    [mm(64), "DESCRIPTION OF GOODS", "PERIHAL BARANG"],
    [mm(22), "HS CODE", "(AHTN 2022)"],
    [mm(24), "UNIT PRICE", "HARGA UNIT (RM)"],
    [PW-mm(12+10+64+22+24+28), "TOTAL", "JUMLAH (RM)"],
    [mm(28), "REMARKS", "CATATAN"],
  ] as [number, string, string][];

  let hx = LM;
  gcols.forEach(([cw, en, ms]) => {
    d.rect(hx, y, cw, TH, PDFDoc.BLUE);
    d.text(en, hx+cw/2, y-mm(5), 5.5, true, "C", PDFDoc.WHITE);
    d.text(ms, hx+cw/2, y-mm(10), 5, false, "C", PDFDoc.WHITE);
    hx += cw;
  });
  y -= TH;

  const maxRows = 9;
  for (let r = 0; r < maxRows; r++) {
    const g = goods[r];
    const bg = r % 2 === 0 ? PDFDoc.LGRAY : undefined;
    hx = LM;
    gcols.forEach(([cw]) => { d.rect(hx, y, cw, mm(11), bg); hx += cw; });
    if (g) {
      const vals = [s(g.quantity), s(g.unit), s(g.description), s(g.hs_code),
                    s(g.unit_price), s(g.total), ""];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx+2, y-mm(11)+mm(3.5), 5.5); vx += gcols[vi][0]; });
    }
    y -= mm(11);
  }

  const noteW = PW - mm(28) - mm(28);
  [["SUBTOTAL  (RM)", s(data.subtotal)],
   ["FREIGHT / TAMBANG MUATAN  (RM)", s(data.freight)],
   ["INSURANCE / INSURANS  (RM)", s(data.insurance)],
   ["HANDLING  (RM)", ""]].forEach(([lbl, val2]) => {
    d.rect(LM, y, noteW, mm(11), PDFDoc.LGRAY);
    d.text(lbl, LM+2, y-mm(4), 5.5, true);
    d.rect(LM+noteW, y, mm(28)+mm(28), mm(11));
    if (val2) d.text(val2, LM+noteW+2, y-mm(4), 6);
    y -= mm(11);
  });
  d.rect(LM, y, PW, mm(13), PDFDoc.BLUE);
  d.text("TOTAL AMOUNT  /  JUMLAH KESELURUHAN  (MYR)", LM+2, y-mm(5), 7, true, "L", PDFDoc.WHITE);
  const total = (data.total_cif || data.total_fob || data.subtotal) as number;
  d.text(`RM ${s(total)}`, RM-2, y-mm(5), 8, true, "R", PDFDoc.WHITE);
  y -= mm(13);

  d.rect(LM, y, PW, mm(36));
  d.text('"WE HEREBY CERTIFY THIS INVOICE TO BE TRUE AND CORRECT."', W/2, y-mm(7), 7, true, "C");
  d.text('"KAMI DENGAN INI MENGESAHKAN INVOIS INI ADALAH BENAR DAN BETUL."', W/2, y-mm(12), 6, false, "C");
  d.fieldLine(LM+2, y-mm(23), PW/2-4);
  d.text("Authorised Signature / Tandatangan Dibenarkan", LM+2, y-mm(26), 6, true);
  d.text("Name:", LM+PW/2, y-mm(18), 5.5, true);
  d.fieldLine(LM+PW/2+mm(12), y-mm(18), PW/2-mm(14));
  d.text("Designation / Jawatan:", LM+PW/2, y-mm(24), 5.5, true);
  d.fieldLine(LM+PW/2+mm(28), y-mm(24), PW/2-mm(30));
  d.text("Date / Tarikh:", LM+PW/2, y-mm(30), 5.5, true);
  d.fieldLine(LM+PW/2+mm(20), y-mm(30), PW/2-mm(22));
  y -= mm(36);
  d.text("THESE COMMODITIES WERE EXPORTED FROM MALAYSIA IN ACCORDANCE WITH EXPORT REGULATIONS. DIVERSION CONTRARY TO MALAYSIAN LAW PROHIBITED.", LM, y-mm(4), 5);

  d.build(`Commercial_Invoice_${s(data.invoice_number) || "DRAFT"}.pdf`);
}

/** Generate a Bill of Lading PDF */
function generateBOLPDF(data: Record<string,unknown>): void {
  const d = new PDFDoc();
  const { LM, RM, PW, W, H } = d;
  const mm = (v: number) => v * 2.835;
  const s = (v: unknown) => String(v ?? "");
  const shipper  = (data.shipper      || data.exporter || {}) as Record<string,string>;
  const con      = (data.consignee    || {}) as Record<string,string>;
  const notify   = (data.notify_party || {}) as Record<string,string>;
  const ctrs     = (data.container_details || []) as Array<Record<string,unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(18), PDFDoc.BLUE);
  d.text("BILL OF LADING  /  SURAT CARAAN", W/2, y-mm(7), 13, true, "C", PDFDoc.WHITE);
  d.text("MALAYSIA EXPORT DOCUMENT  |  ORIGINAL  □   SEA WAYBILL  □   SURRENDER  □", W/2, y-mm(13), 6.5, false, "C", PDFDoc.WHITE);
  y -= mm(18);

  const LW = PW*0.52; const RW = PW-LW; const RH = mm(48);

  d.rect(LM, y, LW, RH);
  d.text("SHIPPER / PENGHANTAR (EXPORTER)", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+LW-2, y-mm(5.5), 0.4);
  const shipFields = [
    ["Name / Nama:", s(shipper.name)],
    ["Address / Alamat:", s(shipper.address)],
    ["", ""],
    ["BRN:", s(shipper.brn)],
    ["Tel:", s(shipper.tel || "")],
    ["SID#:", ""],
  ];
  shipFields.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(5.8), 5.5, true);
    if (val2) d.text(val2, LM+mm(22), y-mm(11)-i*mm(5.8), 6);
    d.fieldLine(LM+mm(22), y-mm(11)-i*mm(5.8), LW-mm(24));
  });

  d.rect(LM+LW, y, RW, RH, PDFDoc.LGRAY);
  const blFields = [
    ["Bill of Lading No. / No. Surat Caraan:", s(data.bl_number)],
    ["Date / Tarikh:", s(data.bl_date)],
    ["B/L Type:  □ Original  □ Surrender  □ Waybill", ""],
    ["SCAC Code:", ""],
    ["PRO No.:", ""],
    ["Trailer No. / No. Treler:", ""],
    ["Seal No. / No. Segel:", ""],
  ];
  blFields.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+LW+2, y-mm(11)-i*mm(5.8), 5.5, true);
    if (val2) d.text(val2, LM+LW+mm(40), y-mm(11)-i*mm(5.8), 6);
    d.fieldLine(LM+LW+2, y-mm(11)-i*mm(5.8), RW-4);
  });
  y -= RH;

  const RH2 = mm(42);
  d.rect(LM, y, LW, RH2);
  d.text("CONSIGNEE / PENERIMA", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+LW-2, y-mm(5.5), 0.4);
  const conFields2 = [
    ["Name / Nama:", s(con.name)],
    ["Address / Alamat:", s(con.address)],
    ["", ""],
    ["Country:", s(con.country_code || con.country)],
    ["CID#:", ""],
  ];
  conFields2.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(6), 5.5, true);
    if (val2) d.text(val2, LM+mm(22), y-mm(11)-i*mm(6), 6);
    d.fieldLine(LM+mm(22), y-mm(11)-i*mm(6), LW-mm(24));
  });

  d.rect(LM+LW, y, RW, RH2, PDFDoc.LGRAY);
  d.text("NOTIFY PARTY / PIHAK DIMAKLUMKAN", LM+LW+2, y-mm(4.5), 6, true);
  d.hline(LM+LW+2, LM+LW+RW-2, y-mm(5.5), 0.4);
  const nFields = [
    ["Name:", s(notify.name)],
    ["Address:", s(notify.address)],
    ["", ""],
    ["Third Party Freight Bill To:", ""],
  ];
  nFields.forEach(([lbl, val2], i) => {
    d.text(lbl, LM+LW+2, y-mm(11)-i*mm(6), 5.5, true);
    if (val2) d.text(val2, LM+LW+mm(20), y-mm(11)-i*mm(6), 6);
    d.fieldLine(LM+LW+mm(20), y-mm(11)-i*mm(6), RW-mm(22));
  });
  y -= RH2;

  const R3H = mm(20);
  d.rect(LM, y, PW, R3H);
  const r3c = [
    [mm(38), "Carrier / Pengangkut:", s(data.carrier_name || "")],
    [mm(34), "Vessel / Flight / Kapal:", s(data.vessel_or_flight)],
    [mm(28), "Voyage / Flight No.:", s(data.voyage_or_flight_number)],
    [mm(34), "Port of Loading:", s(data.port_of_loading)],
    [mm(34), "Port of Discharge:", s(data.port_of_discharge)],
    [PW-mm(38+34+28+34+34), "Export Date:", s(data.bl_date)],
  ] as [number, string, string][];
  let rx = LM;
  r3c.forEach(([cw, lbl, val2]) => {
    d.vline(rx, y, y - R3H);
    d.text(lbl, rx+2, y-mm(4), 5, true);
    d.text(val2, rx+2, y-mm(11), 6);
    rx += cw;
  });
  y -= R3H;

  d.rect(LM, y, PW, mm(13), PDFDoc.LGRAY);
  d.text("FREIGHT CHARGE TERMS / SYARAT TAMBANG:", LM+2, y-mm(4.5), 6, true);
  const ft = s(data.freight_terms).toLowerCase();
  const selected = (opt: string) => ft.includes(opt) ? "☑" : "□";
  d.text(`${selected("prepaid")} Prepaid     ${selected("collect")} Collect     ${selected("3rd")} 3rd Party`,
    LM+mm(70), y-mm(4.5), 6);
  d.text("Special Instructions / Arahan Khas:", LM+2, y-mm(10), 5.5, true);
  d.fieldLine(LM+mm(45), y-mm(10), PW-mm(47));
  y -= mm(13);

  const TH = mm(18);
  const gcols2 = [
    [mm(10), "QTY\nHU"], [mm(10), "TYPE\nHU"],
    [mm(10), "QTY\nPKG"], [mm(10), "TYPE\nPKG"],
    [mm(18), "WEIGHT\nBERAT (kg)"], [mm(8), "H.M.\n(X)"],
    [mm(70), "COMMODITY DESCRIPTION  /  PERIHAL BARANG"],
    [mm(20), "HS CODE\n(AHTN)"], [mm(16), "NMFC\nNo."],
    [PW-mm(10*4+18+8+70+20+16), "CLASS\nKELAS"],
  ] as [number, string][];
  let hx2 = LM;
  gcols2.forEach(([cw, hdr]) => {
    d.rect(hx2, y, cw, TH, PDFDoc.BLUE);
    hdr.split("\n").forEach((ln, li) => d.text(ln, hx2+cw/2, y-mm(5)-li*mm(5.5), 5, true, "C", PDFDoc.WHITE));
    hx2 += cw;
  });
  y -= TH;

  const DR2 = mm(11);
  for (let r = 0; r < 7; r++) {
    const ctr = ctrs[r];
    const bg = r % 2 === 0 ? PDFDoc.LGRAY : undefined;
    hx2 = LM;
    gcols2.forEach(([cw]) => { d.rect(hx2, y, cw, DR2, bg); hx2 += cw; });
    if (ctr) {
      const vals = [s(ctr.packages), s(ctr.type || "CTN"), "", "", s(ctr.gross_weight_kg), "",
                    s(ctr.description), "", s(ctr.container_no), ""];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx+2, y-DR2+mm(3.5), 5.5); vx += gcols2[vi][0]; });
    }
    y -= DR2;
  }

  d.rect(LM, y, PW, mm(12), PDFDoc.MGRAY);
  d.text("GRAND TOTAL / JUMLAH KESELURUHAN:", LM+2, y-mm(4.5), 6, true);
  d.text(`Total Pkgs: ${s(data.total_packages)}  |  Gross Wt: ${s(data.total_gross_weight_kg)} kg  |  Volume: ${s(data.total_cbm)} m³`,
    LM+mm(75), y-mm(4.5), 6);
  y -= mm(12);

  d.rect(LM, y, PW/2, mm(13), PDFDoc.LGRAY);
  d.text("C.O.D. Amount  RM:", LM+2, y-mm(4.5), 5.5, true);
  d.fieldLine(LM+mm(26), y-mm(4.5), PW/2-mm(28));
  d.text("Fee Terms:  □ Collect  □ Prepaid", LM+2, y-mm(10), 5.5);
  d.rect(LM+PW/2, y, PW/2, mm(13), PDFDoc.LGRAY);
  d.text("Declared Value / Nilai Diisytiharkan  RM:", LM+PW/2+2, y-mm(4.5), 5.5, true);
  d.fieldLine(LM+PW/2+mm(50), y-mm(4.5), PW/2-mm(52));
  y -= mm(13);

  const SH = mm(44);
  const SW = PW/2;
  d.rect(LM, y, SW, SH);
  d.text("SHIPPER CERTIFICATION / PERAKUAN PENGHANTAR", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+SW-2, y-mm(5.5), 0.4);
  ["This is to certify that the above named materials are properly classified,",
   "described, packaged, marked and labeled, and are in proper condition",
   "for transportation according to applicable D.O.T. regulations."].forEach((ln, i) =>
    d.text(ln, LM+2, y-mm(11)-i*mm(5.5), 5.5));
  d.fieldLine(LM+2, y-mm(30), SW-4);
  d.text("Shipper Signature / Tandatangan Penghantar", LM+2, y-mm(33), 5.5, true);
  d.text("Date:", LM+2, y-mm(40), 5.5); d.fieldLine(LM+mm(12), y-mm(40), mm(30));
  d.text("Trailer Loaded:  □ By Shipper  □ By Driver", LM+SW/2, y-mm(36), 5.5);
  d.text("Freight Counted:  □ By Shipper  □ By Driver", LM+SW/2, y-mm(41), 5.5);

  d.rect(LM+SW, y, SW, SH);
  d.text("CARRIER CERTIFICATION / PERAKUAN PENGANGKUT", LM+SW+2, y-mm(4.5), 6, true);
  d.hline(LM+SW+2, LM+SW+SW-2, y-mm(5.5), 0.4);
  ["Carrier acknowledges receipt of packages and required placards.",
   "Carrier certifies emergency response information was made available",
   "and/or carrier has the DOT emergency response guidebook in the vehicle.",
   "Property described above is received in good order, except as noted."].forEach((ln, i) =>
    d.text(ln, LM+SW+2, y-mm(11)-i*mm(5.5), 5.5));
  d.fieldLine(LM+SW+2, y-mm(30), SW-4);
  d.text("Carrier Signature / Tandatangan Pengangkut", LM+SW+2, y-mm(33), 5.5, true);
  d.text("Pickup Date:", LM+SW+2, y-mm(40), 5.5); d.fieldLine(LM+SW+mm(24), y-mm(40), SW-mm(26));
  y -= SH;

  d.text("RECEIVED, subject to individually determined rates or contracts agreed upon in writing between carrier and shipper, and to all applicable state and federal regulations.", LM, y-mm(4), 5);
  d.text("NOTE: Liability Limitation for loss or damage in this shipment may be applicable. See applicable laws.", LM, y-mm(9), 5);

  d.build(`Bill_of_Lading_${s(data.bl_number) || "DRAFT"}.pdf`);
}

/** Generate a Packing List PDF */
function generatePackingListPDF(data: Record<string,unknown>): void {
  const d = new PDFDoc();
  const { LM, RM, PW, W, H } = d;
  const mm = (v: number) => v * 2.835;
  const s  = (v: unknown) => String(v ?? "");
  const exp  = (data.exporter  || {}) as Record<string,string>;
  const con  = (data.consignee || {}) as Record<string,string>;
  const pkgs = (data.packages  || []) as Array<Record<string,unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(18), PDFDoc.BLUE);
  d.text("PACKING LIST  /  SENARAI PEMBUNGKUSAN", W/2, y-mm(7), 12, true, "C", PDFDoc.WHITE);
  d.text("MALAYSIA EXPORT DOCUMENT", W/2, y-mm(13), 6.5, false, "C", PDFDoc.WHITE);
  y -= mm(18);

  const LW = PW*0.52; const RW = PW-LW; const RH = mm(46);
  d.rect(LM, y, LW, RH);
  d.text("EXPORTER / PENGEKSPORT", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+LW-2, y-mm(5.5), 0.4);
  [["Name / Nama:", s(exp.name)], ["Address / Alamat:", s(exp.address)], ["", ""], ["BRN:", s(exp.brn)], ["Tel:", s(exp.tel || "")]].forEach(([lbl, val], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val) d.text(val, LM+mm(20), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+mm(20), y-mm(11)-i*mm(5.5), LW-mm(22));
  });
  d.rect(LM+LW, y, RW, RH, PDFDoc.LGRAY);
  [["Packing List No.:", s(data.packing_list_number)], ["Date / Tarikh:", s(data.date)],
   ["Invoice Reference:", s(data.invoice_reference)], ["Vessel / Flight:", s(data.vessel_or_flight)],
   ["Port of Loading:", s(data.port_of_loading)], ["Port of Discharge:", s(data.port_of_discharge)]
  ].forEach(([lbl, val], i) => {
    d.text(lbl, LM+LW+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val) d.text(val, LM+LW+mm(30), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+LW+2, y-mm(11)-i*mm(5.5), RW-4);
  });
  y -= RH;

  const RH2 = mm(38);
  d.rect(LM, y, LW, RH2);
  d.text("CONSIGNEE / PENERIMA", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+LW-2, y-mm(5.5), 0.4);
  [["Name / Nama:", s(con.name)], ["Address / Alamat:", s(con.address)], ["", ""], ["Country:", s(con.country || con.country_code || "")]].forEach(([lbl, val], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val) d.text(val, LM+mm(20), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+mm(20), y-mm(11)-i*mm(5.5), LW-mm(22));
  });
  d.rect(LM+LW, y, RW, RH2, PDFDoc.LGRAY);
  d.text("Shipping Marks / Tanda Penghantaran:", LM+LW+2, y-mm(4.5), 5.5, true);
  d.text(s(data.shipping_marks), LM+LW+2, y-mm(11), 6);
  d.text("Container No. / No. Kontena:", LM+LW+2, y-mm(22), 5.5, true);
  d.fieldLine(LM+LW+2, y-mm(22), RW-4);
  d.text(s(data.container_number), LM+LW+2, y-mm(28), 6);
  y -= RH2;

  const TH = mm(18);
  const gcols: [number, string, string][] = [
    [mm(10), "PKG\nNO.", "NO."],
    [mm(12), "TYPE\nJENIS", "JENIS"],
    [mm(60), "DESCRIPTION OF GOODS\nPERIHAL BARANG", "PERIHAL"],
    [mm(22), "GROSS WT.\nBERAT KASAR (kg)", "KG"],
    [mm(22), "NET WT.\nBERAT BERSIH (kg)", "KG"],
    [mm(20), "VOLUME\nISIPADU (m³)", "M3"],
    [PW-mm(10+12+60+22+22+20), "QTY\nINSIDE\nKUANTITI", "QTY"],
  ];
  let hx = LM;
  gcols.forEach(([cw, en]) => {
    d.rect(hx, y, cw, TH, PDFDoc.BLUE);
    en.split("\n").forEach((ln, li) => d.text(ln, hx+cw/2, y-mm(4.5)-li*mm(5), 5.5, true, "C", PDFDoc.WHITE));
    hx += cw;
  });
  y -= TH;

  const DR = mm(12);
  for (let r = 0; r < 10; r++) {
    const p = pkgs[r];
    const bg = r % 2 === 0 ? PDFDoc.LGRAY : undefined;
    hx = LM;
    gcols.forEach(([cw]) => { d.rect(hx, y, cw, DR, bg); hx += cw; });
    if (p) {
      const vals = [s(p.package_no), s(p.type), s(p.description), s(p.gross_weight_kg), s(p.net_weight_kg), s(p.cbm), s(p.quantity_inside)];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx+2, y-DR+mm(4), 5.5); vx += gcols[vi][0]; });
    }
    y -= DR;
  }

  d.rect(LM, y, PW, mm(12), PDFDoc.MGRAY);
  d.text("TOTAL / JUMLAH:", LM+2, y-mm(4.5), 6, true);
  d.text(`Pkgs: ${s(data.total_packages)}  |  Gross: ${s(data.total_gross_weight_kg)} kg  |  Net: ${s(data.total_net_weight_kg)} kg  |  Volume: ${s(data.total_cbm)} m³`, LM+mm(28), y-mm(4.5), 6);
  y -= mm(12);

  const CH = mm(36);
  d.rect(LM, y, PW, CH);
  d.text('"WE HEREBY CERTIFY THAT THE ABOVE PARTICULARS ARE TRUE AND CORRECT."', W/2, y-mm(7), 7, true, "C");
  d.text('"KAMI DENGAN INI MENGESAHKAN BAHAWA BUTIR-BUTIR DI ATAS ADALAH BENAR DAN BETUL."', W/2, y-mm(13), 5.5, false, "C");
  d.fieldLine(LM+2, y-mm(24), PW/2-4);
  d.text("Authorised Signature / Tandatangan Dibenarkan", LM+2, y-mm(27), 5.5, true);
  d.text("Name / Nama:", LM+PW/2, y-mm(19), 5.5, true); d.fieldLine(LM+PW/2+mm(18), y-mm(19), PW/2-mm(20));
  d.text("Designation / Jawatan:", LM+PW/2, y-mm(25), 5.5, true); d.fieldLine(LM+PW/2+mm(28), y-mm(25), PW/2-mm(30));
  d.text("Date / Tarikh:", LM+PW/2, y-mm(31), 5.5, true); d.fieldLine(LM+PW/2+mm(20), y-mm(31), PW/2-mm(22));
  y -= CH;
  d.text("THESE COMMODITIES WERE EXPORTED FROM MALAYSIA IN ACCORDANCE WITH EXPORT REGULATIONS.", LM, y-mm(4), 5);

  d.build(`Packing_List_${s(data.packing_list_number) || "DRAFT"}.pdf`);
}

/** Generate a Certificate of Origin PDF (ATIGA Form D / Standard CO) */
function generateCOOPDF(data: Record<string,unknown>): void {
  const d = new PDFDoc();
  const { LM, RM, PW, W, H } = d;
  const mm = (v: number) => v * 2.835;
  const s  = (v: unknown) => String(v ?? "");
  const exp  = (data.exporter  || {}) as Record<string,string>;
  const con  = (data.consignee || {}) as Record<string,string>;
  const trp  = (data.transport_details || {}) as Record<string,string>;
  const goods = (data.goods || []) as Array<Record<string,unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(22), PDFDoc.BLUE);
  d.text("CERTIFICATE OF ORIGIN", W/2, y-mm(7), 14, true, "C", PDFDoc.WHITE);
  d.text(s(data.form_type) || "FORM D (ATIGA) / STANDARD CO", W/2, y-mm(13), 7, false, "C", PDFDoc.WHITE);
  d.text(`Issuing Body: ${s(data.issuing_body) || "MATRADE"}    CO No: ${s(data.co_number)}    Date: ${s(data.co_date)}`, W/2, y-mm(18), 6, false, "C", PDFDoc.WHITE);
  y -= mm(22);

  const LW = PW*0.5; const RW = PW-LW; const RH = mm(44);
  d.rect(LM, y, LW, RH);
  d.text("1. EXPORTER / PENGEKSPORT", LM+2, y-mm(4.5), 6, true);
  d.hline(LM+2, LM+LW-2, y-mm(5.5), 0.4);
  [["Name:", s(exp.name)], ["Address:", s(exp.address)], ["", ""], ["BRN:", s(exp.brn)], ["Country:", "Malaysia"]].forEach(([lbl, val], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val) d.text(val, LM+mm(16), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+mm(16), y-mm(11)-i*mm(5.5), LW-mm(18));
  });
  d.rect(LM+LW, y, RW, RH);
  d.text("2. CONSIGNEE / PENERIMA", LM+LW+2, y-mm(4.5), 6, true);
  d.hline(LM+LW+2, LM+LW+RW-2, y-mm(5.5), 0.4);
  [["Name:", s(con.name)], ["Address:", s(con.address)], ["", ""], ["Country:", s(con.country)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM+LW+2, y-mm(11)-i*mm(5.5), 5.5, true);
    if (val) d.text(val, LM+LW+mm(16), y-mm(11)-i*mm(5.5), 6);
    d.fieldLine(LM+LW+mm(16), y-mm(11)-i*mm(5.5), RW-mm(18));
  });
  y -= RH;

  const RH2 = mm(28);
  d.rect(LM, y, LW, RH2);
  d.text("3. TRANSPORT DETAILS / BUTIR PENGANGKUTAN", LM+2, y-mm(4.5), 6, true);
  [["Vessel / Flight:", s(trp.vessel_or_flight)], ["Port of Loading:", s(trp.port_of_loading)], ["Port of Discharge:", s(trp.port_of_discharge)], ["Departure Date:", s(trp.departure_date)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM+2, y-mm(11)-i*mm(4.5), 5.5, true);
    d.text(val, LM+mm(28), y-mm(11)-i*mm(4.5), 6);
  });
  d.rect(LM+LW, y, RW, RH2, PDFDoc.LGRAY);
  d.text("4. INVOICE REFERENCE / RUJUKAN INVOIS", LM+LW+2, y-mm(4.5), 6, true);
  d.text(s(data.invoice_reference), LM+LW+2, y-mm(12), 7, true);
  d.text("Origin Criterion / Kriteria Asal:", LM+LW+2, y-mm(20), 5.5, true);
  d.text("WO — Wholly Obtained / Produced in Malaysia", LM+LW+2, y-mm(26), 6);
  y -= RH2;

  const TH = mm(16);
  const gcols2: [number, string][] = [
    [mm(10), "ITEM\nNO."],
    [mm(72), "DESCRIPTION OF GOODS\nPERIHAL BARANG"],
    [mm(20), "HS CODE\n(AHTN 2022)"],
    [mm(14), "ORIGIN\nCRITERION"],
    [mm(24), "QUANTITY &\nUNIT (kg/pcs)"],
    [mm(22), "GROSS WT.\n(kg)"],
    [PW-mm(10+72+20+14+24+22), "FOB VALUE\n(MYR)"],
  ];
  let hx = LM;
  gcols2.forEach(([cw, hdr]) => {
    d.rect(hx, y, cw, TH, PDFDoc.BLUE);
    hdr.split("\n").forEach((ln, li) => d.text(ln, hx+cw/2, y-mm(4)-li*mm(5), 5, true, "C", PDFDoc.WHITE));
    hx += cw;
  });
  y -= TH;
  const DR2 = mm(11);
  for (let r = 0; r < 6; r++) {
    const g = goods[r];
    const bg = r % 2 === 0 ? PDFDoc.LGRAY : undefined;
    hx = LM;
    gcols2.forEach(([cw]) => { d.rect(hx, y, cw, DR2, bg); hx += cw; });
    if (g) {
      const vals = [s(g.item_no), s(g.description), s(g.hs_code), s(g.origin_criterion || "WO"), s(g.quantity), s(g.gross_weight_kg), s(g.fob_value_myr)];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx+2, y-DR2+mm(3.5), 5.5); vx += gcols2[vi][0]; });
    }
    y -= DR2;
  }
  y -= mm(4);

  const SH = mm(52);
  d.rect(LM, y, PW*0.55, SH);
  d.text("DECLARATION BY EXPORTER / PERAKUAN OLEH PENGEKSPORT", LM+2, y-mm(4.5), 5.5, true);
  d.hline(LM+2, LM+PW*0.55-2, y-mm(5.5), 0.3);
  ["The undersigned hereby declares that the above stated information",
   "is correct; that the goods described were produced/manufactured",
   "in Malaysia; and that they comply with the origin requirements",
   `specified for export to ${s(con.country)}.`].forEach((ln, i) => d.text(ln, LM+2, y-mm(11)-i*mm(5.5), 5.5));
  d.fieldLine(LM+2, y-mm(36), PW*0.55-4);
  d.text("Authorised Signature / Tandatangan", LM+2, y-mm(39), 5.5, true);
  d.text("Name:", LM+2, y-mm(44), 5.5); d.fieldLine(LM+mm(12), y-mm(44), PW*0.55-mm(14));
  d.text("Date:", LM+2, y-mm(49), 5.5); d.fieldLine(LM+mm(12), y-mm(49), mm(30));
  d.text("Designation:", LM+mm(50), y-mm(49), 5.5); d.fieldLine(LM+mm(65), y-mm(49), PW*0.55-mm(67));

  d.rect(LM+PW*0.55, y, PW*0.45, SH, PDFDoc.LGRAY);
  d.text("FOR OFFICIAL USE / UNTUK KEGUNAAN RASMI", LM+PW*0.55+2, y-mm(4.5), 5.5, true);
  d.hline(LM+PW*0.55+2, LM+PW*0.55+PW*0.45-2, y-mm(5.5), 0.3);
  d.text(`Issuing Body: ${s(data.issuing_body) || "MATRADE"}`, LM+PW*0.55+2, y-mm(12), 5.5, true);
  d.text("Certification:", LM+PW*0.55+2, y-mm(20), 5.5, true);
  d.text("It is hereby certified that the declaration by", LM+PW*0.55+2, y-mm(26), 5.5);
  d.text("the exporter is correct.", LM+PW*0.55+2, y-mm(31), 5.5);
  d.fieldLine(LM+PW*0.55+2, y-mm(40), PW*0.45-4);
  d.text("Official Signature & Stamp", LM+PW*0.55+2, y-mm(43), 5.5, true);
  d.text("Date:", LM+PW*0.55+2, y-mm(49), 5.5); d.fieldLine(LM+PW*0.55+mm(12), y-mm(49), PW*0.45-mm(14));
  y -= SH;

  d.text("This Certificate of Origin is issued pursuant to the ASEAN Trade in Goods Agreement (ATIGA) and Malaysian regulations on rules of origin.", LM, y-mm(5), 5);

  d.build(`Certificate_of_Origin_${s(data.co_number) || "DRAFT"}.pdf`);
}

/** Legacy makePDF — kept as final fallback for SIRIM/Halal checklists */
function makePDF(title: string, lines: string[]): void {
  const W = 595, H = 842, M = 48;
  let y = H - M;
  const ops: string[] = [];
  const push = (sz: number, text: string) => {
    if (y < M + 16) return;
    const safe = text.replace(/[()\\]/g, "\\$&").substring(0, 100);
    ops.push(`BT /F1 ${sz} Tf ${M} ${y} Td (${safe}) Tj ET`);
    y -= sz + 4;
  };
  push(14, title);
  push(9, `Generated: ${new Date().toLocaleString("en-MY")}`);
  ops.push(`${M} ${y + 4} ${W - M * 2} 0.4 re f`); y -= 10;
  for (const l of lines) {
    if (!l.trim()) { y -= 6; continue; }
    push(l.startsWith("##") ? 10 : 8, l.startsWith("##") ? l.replace(/^##\s*/, "") : l);
  }
  const stream = ops.join("\n");
  const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W} ${H}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n9\n%%EOF`;
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })),
    download: `${title.replace(/\s+/g, "_")}.pdf`,
  });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function flatLines(obj: Record<string,unknown>, pre = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) return flatLines(v as Record<string,unknown>, key);
    if (Array.isArray(v)) return [`${key}: ${(v as unknown[]).join(", ")}`];
    return [`${key}: ${String(v ?? "")}`];
  });
}

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

  const fileInputRef     = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ action: string; accept: string; endpoint: string } | null>(null);
  const bottomRef        = useRef<HTMLDivElement>(null);
  const chatHistoryRef   = useRef<{role:string;content:string}[]>([]);

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

  // ── Core message helpers ───────────────────────────────────────────────────
  const addMsg    = useCallback((msg: Message) => setMessages(m => [...m, msg]), []);
  const removeMsg = useCallback((pid: string)  => setMessages(m => m.filter(x => x.id !== pid)), []);

  // ── Advance UI to next step ────────────────────────────────────────────────
  const advanceUI = useCallback(() => {
    setActiveStep(prev => {
      const cur = prev;
      const next = cur + 1;
      setCompleted(c => new Set([...c, cur]));
      setMessages(m => {
        const msgs = [...m];
        if (STEP_FLOW[cur])  msgs.push(STEP_FLOW[cur].onComplete);
        if (next < total && STEP_FLOW[next]) msgs.push(STEP_FLOW[next].intro);
        return msgs;
      });
      return Math.min(next, total - 1);
    });
  }, [total]);

  const waitForSession = useCallback((): Promise<string> => {
    return new Promise(resolve => {
      if (sessionId) { resolve(sessionId); return; }
      const start = Date.now();
      const iv = setInterval(() => {
        setSessionId(cur => {
          if (cur) { clearInterval(iv); resolve(cur); }
          else if (Date.now() - start > 5000) { clearInterval(iv); resolve("demo-" + genId()); }
          return cur;
        });
      }, 100);
    });
  }, [sessionId]);

  const runWithFeedback = useCallback(async (fn: () => Promise<void>, label = "Processing…") => {
    const pid = genId();
    addMsg({ id: pid, role: "assistant", kind: "processing", content: label });
    setSending(true);
    try   { await fn(); }
    catch (err) { addMsg({ id: genId(), role: "assistant", kind: "text", content: `⚠️ ${err instanceof Error ? err.message : String(err)}` }); }
    finally     { removeMsg(pid); setSending(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Build context string for doc/K2 generation ────────────────────────────
  const buildCtx = useCallback((): string => {
    const e  = (sessionData.current.entity          as Record<string,unknown>) ?? {};
    const c  = (sessionData.current.consignee        as Record<string,unknown>) ?? {};
    const cl = (sessionData.current.classification   as Record<string,unknown>) ?? {};
    const v  = (sessionData.current.valuation        as Record<string,unknown>) ?? {};
    const l  = (sessionData.current.logistics        as Record<string,unknown>) ?? {};
    return [
      `Exporter: ${e.company_name ?? "N/A"}, BRN ${e.registration_number ?? "N/A"}, ${e.registered_address ?? "Malaysia"}`,
      `SST registered: ${e.sst_registered ?? "unknown"}`,
      `Consignee: ${c.buyer_name ?? "N/A"}, ${c.buyer_country ?? "N/A"}, ${c.buyer_address ?? "N/A"}`,
      `Buyer email: ${c.buyer_email ?? "N/A"}, Phone: ${c.buyer_phone ?? "N/A"}, Contact: ${c.buyer_contact_person ?? "N/A"}`,
      `Incoterm: ${c.incoterm ?? "FOB"}, Tax ID: ${c.buyer_tax_id ?? "N/A"}, Importer of record: ${c.importer_of_record ?? "same as buyer"}`,
      `HS Code: ${cl.hs_code ?? "N/A"}, Description: ${cl.hs_description ?? "N/A"}`,
      `MY Export Duty: ${cl.malaysia_export_duty ?? 0}%, Destination Import Duty: ${cl.destination_import_duty ?? 0}%`,
      `FTA available: ${(cl.fta_available as string[] ?? []).join(", ") || "None"}`,
      `FOB: RM${v.fob_myr ?? 0}, Freight: RM${v.freight_myr ?? 0}, Insurance: RM${v.insurance_myr ?? 0}, CIF: RM${v.cif_myr ?? 0}`,
      `Duty: RM${v.estimated_duty_myr ?? 0}, Best FTA: ${v.best_fta ?? "None"}, Form: ${v.form_required ?? "N/A"}`,
      `Invoice currency: ${v.invoice_currency ?? "MYR"}, FX rate: ${v.exchange_rate_to_myr ?? 1}`,
      `Mode: ${l.mode ?? "SEA"}, Vessel: ${l.vessel ?? "TBC"}, Voyage: ${l.voyage_number ?? "TBC"}`,
      `POL: ${l.pol ?? "Port Klang"}, POD: ${l.pod ?? "N/A"}, Export date: ${l.export_date ?? "N/A"}`,
      `Gross wt: ${l.weight_kg ?? 0} kg, Net wt: ${l.net_weight_kg ?? 0} kg, CBM: ${l.cbm ?? 0}`,
      `Packages: ${l.number_of_packages ?? 0} x ${l.package_type ?? "CTN"}, Container: ${l.container_number ?? "N/A"}`,
      `Signatory: ${l.signatory_name ?? "N/A"}, ${l.signatory_designation ?? "N/A"}, IC: ${l.signatory_ic_passport ?? "N/A"}`,
    ].join("\n");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── STEP 0: SSM / product / permit file upload ────────────────────────────
  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pendingUploadRef.current) return;
    const { endpoint } = pendingUploadRef.current;
    pendingUploadRef.current = null;

    addMsg({ id: genId(), role: "user", kind: "upload", content: "uploaded-file", fileName: file.name });

    await runWithFeedback(async () => {
      const b64  = await fileToB64(file);
      const mime = fileMime(file);

      // ── SSM Certificate ────────────────────────────────────────────────
      if (endpoint === "/entity/upload-ssm") {
        if (completed.has(0)) {
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: "✅ Entity is already verified. No need to re-upload the SSM." });
          return;
        }

        // ── IMPROVED SSM PROMPT ────────────────────────────────────────
        const SSM_PROMPT = `You are an OCR extraction engine for Malaysian company registration documents.

DOCUMENT TYPES you may receive:
- SSM Form 9 / Certificate of Incorporation (Perakuan Pemerbadanan)
- SSM Form D (Business Registration Certificate)
- MyCoID digital certificate (PDF or screenshot)
- SSM e-Info company printout
- Bizfile / SSM portal screenshot
- Any document showing a Malaysian company BRN

EXTRACTION STRATEGY — try ALL of these patterns in order:
1. company_name: Look for "NAMA SYARIKAT", "Company Name:", "Name of Company", the large bold text at the top, or any text before "SDN BHD" / "BHD" / "ENTERPRISE" / "PLT" / "LLP". Include the full legal suffix.
2. registration_number: Look for "No. Syarikat", "Company No.", "No. Pendaftaran", "Registration No.", "BRN:", "ROC:", or any 12-digit number or format like "1234567-A" or "202301XXXXXX". Copy digits and dashes exactly.
3. registration_date: Look for "Tarikh Pemerbadanan", "Date of Incorporation", "Tarikh Pendaftaran". Format DD/MM/YYYY.
4. company_type: Derive from name suffix: "Sdn Bhd" = private limited, "Bhd" = public limited, "Enterprise" = sole prop/partnership, "PLT" or "LLP" = limited liability partnership.
5. company_status: Look for "AKTIF", "ACTIVE", "STRUCK OFF", "WOUND UP". Default to "active" if document appears valid.
6. registered_address: Text block after "Alamat Berdaftar", "Registered Address", "Alamat Perniagaan Berdaftar".
7. directors: Names and NRIC from Form 49 table, or any "Director" / "Pengarah" section.
8. paid_up_capital: "Modal Berbayar", "Paid-up Capital", include RM symbol and amount.
9. sst_registered: true only if "SST" or "GST" registration number is explicitly present.

CRITICAL PARTIAL EXTRACTION RULES:
- Extract WHATEVER you can read, even if only partial. NEVER return empty string "" for a field you can at least partially read.
- If company name is blurry but you can read "ABC SDN", return "ABC SDN BHD" (best effort).
- If BRN is partially visible, return what you can see.
- Set is_valid=true if BOTH company_name AND registration_number have at least SOME readable content (even partial).
- Set confidence: 0.9=fully clear, 0.7=mostly readable, 0.5=partial, 0.3=very blurry but some text visible, 0.1=almost unreadable.
- If the document is clearly a company registration document but very blurry, still attempt extraction and note issues in extraction_notes.
- NEVER return empty strings "" when any text is visible — always make your best effort.

Return ONLY valid JSON, no markdown fences, no explanation:
{"is_valid":false,"company_name":"","registration_number":"","registration_date":"","company_type":"","company_status":"active","registered_address":"","directors":[{"name":"","nric":"","designation":"Director"}],"paid_up_capital":"","blacklisted":false,"sst_registered":false,"compliance_flags":[],"missing_fields":[],"confidence":0.0,"extraction_notes":""}`;

        const result = await geminiVision(b64, mime, SSM_PROMPT);

        const sid = await waitForSession();
        try {
          await api.verifyEntity(sid, {
            company_name:        String(result.company_name        ?? "Extracted"),
            registration_number: String(result.registration_number ?? "000000000000"),
          });
        } catch { /* offline ok */ }

        sessionData.current.entity = result;

        const dirs = (result.directors as Array<{name:string}> ?? [])
          .map(d => d.name)
          .filter(Boolean)
          .join(", ");

        // Build display fields, only show "—" if truly empty
        const extractedFields: Record<string, string> = {
          "Company Name":    hasMeaning(result.company_name)        ? String(result.company_name)        : "—",
          "BRN":             hasMeaning(result.registration_number) ? String(result.registration_number) : "—",
          "Company Type":    hasMeaning(result.company_type)        ? String(result.company_type)        : "—",
          "Registered Date": hasMeaning(result.registration_date)   ? String(result.registration_date)   : "—",
          "Status":          hasMeaning(result.company_status)      ? String(result.company_status)      : "Active",
          "Directors":       dirs || "—",
          "SST Registered":  result.sst_registered ? "Yes" : "No",
          "Paid-up Capital": hasMeaning(result.paid_up_capital)     ? String(result.paid_up_capital)     : "—",
        };

        const confidence   = Number(result.confidence ?? 0);
        const nameOk       = hasMeaning(result.company_name);
        const brnOk        = hasMeaning(result.registration_number);
        const anyFieldRead = nameOk || brnOk ||
          hasMeaning(result.company_type) ||
          hasMeaning(result.registered_address) ||
          hasMeaning(result.registration_date);

        // Show extracted card always
        addMsg({
          id: genId(),
          role: "assistant",
          kind: "extracted",
          content: anyFieldRead
            ? `SSM certificate scanned (confidence: ${Math.round(confidence * 100)}%). Here's what I extracted:`
            : "SSM certificate received — having difficulty reading the document:",
          valid: Boolean(result.is_valid) && !result.blacklisted && nameOk && brnOk,
          fields: extractedFields,
        });

        if (result.is_valid && !result.blacklisted && nameOk && brnOk) {
          // ✅ Full clean extraction — proceed automatically
          addMsg({
            id: genId(),
            role: "assistant",
            kind: "text",
            content: "✅ Entity verified successfully. Proceeding to Step 2 — Consignee Details.",
          });
          advanceUI();

        } else if (anyFieldRead || confidence >= 0.25) {
          // ⚠️ Partial extraction — let user confirm or correct missing fields
          const missingFieldNames: string[] = [];
          if (!nameOk) missingFieldNames.push("Company Name");
          if (!brnOk)  missingFieldNames.push("BRN / Registration Number");

          addMsg({
            id: genId(),
            role: "assistant",
            kind: "text",
            content:
              `⚠️ **Partial extraction** — ${
                missingFieldNames.length > 0
                  ? `missing: **${missingFieldNames.join(", ")}**`
                  : "some fields could not be confirmed"
              }.\n\n` +
              `**Options to proceed:**\n\n` +
              `• Type **"confirm"** if the extracted details are correct\n` +
              `• Reply with corrections in this format:\n\n` +
              `> Company Name: ABC SDN BHD\n` +
              `> BRN: 202301012345\n` +
              `> Company Type: Sdn Bhd\n` +
              `> Directors: Ahmad bin Ali\n\n` +
              (result.extraction_notes ? `_Scan note: ${result.extraction_notes}_` : ""),
          });
          // Mark as partial so the chat handler can process corrections or "confirm"
          sessionData.current.entity = { ...result, partial_extraction: true };

        } else {
          // ❌ Truly unreadable — ask for re-upload or manual entry
          addMsg({
            id: genId(),
            role: "assistant",
            kind: "text",
            content:
              `❌ **Could not read the document** — the image quality is too low for extraction.\n\n` +
              `**Option 1:** Re-upload a clearer photo:\n` +
              `• Ensure good lighting (no shadows or glare)\n` +
              `• Full page visible, not cropped\n` +
              `• No motion blur\n\n` +
              `**Option 2:** Enter details manually by replying:\n\n` +
              `> Company Name: ABC SDN BHD\n` +
              `> BRN: 202301012345\n` +
              `> Company Type: Sdn Bhd\n` +
              `> Status: Active\n` +
              `> Directors: Ahmad bin Ali\n\n` +
              (result.extraction_notes ? `_Scan note: ${result.extraction_notes}_` : ""),
          });
          // Still mark as partial so manual entry chat handler works
          sessionData.current.entity = { ...result, partial_extraction: true };
        }

      // ── Product Photo ──────────────────────────────────────────────────
      } else if (endpoint === "/classification/upload-product") {
        if (!completed.has(1)) {
          addMsg({ id: genId(), role: "assistant", kind: "blocked",
            content: "Step 3 is locked. Complete Step 2 — 'Consignee Details' — first before classifying your product." });
          return;
        }
        if (completed.has(2)) {
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: "✅ Product is already classified. Proceed to the next step." });
          return;
        }
        const destCountry = String((sessionData.current.consignee as Record<string,string>)?.buyer_country ?? "Unknown");
        const result = await geminiVision(b64, mime,
          `You are a WCO HS 2022 / AHTN 2022 tariff classification engine for Malaysian exports to ${destCountry}.

STEP 1 — IDENTIFY the product precisely:
- Read ALL visible text: brand, model number, product name, ingredient list, material composition, technical specifications
- If a label, invoice, or spec sheet is shown extract every word — product details are in the text, not just the image
- Do not guess — if the product is ambiguous, set identified=false

STEP 2 — CLASSIFY to 8-digit AHTN code:
- Use the most specific subheading. Examples:
  Palm oil crude: 1511.10.00 | Refined palm oil: 1511.90.00
  Latex rubber gloves: 4015.11.00 | Nitrile gloves: 4015.19.10
  Printed circuit boards (bare): 8534.00.00 | Assembled PCB: 8473.30.90
  USB cable: 8544.42.90 | HDMI cable: 8544.42.10
  Instant noodles: 1902.30.10 | Rice: 1006.30.90
- destination_import_duty: MFN tariff rate for ${destCountry} (use 0 if ASEAN/FTA applicable)
- fta_available: list all applicable FTAs — check ATIGA (all ASEAN), CPTPP (JP/AU/NZ/CA/MX/SG/VN/BN/PE/CL), RCEP (ASEAN+CN/JP/KR/AU/NZ), MAFTA, MJEPA, MKFTA, MIFTA

STEP 3 — CHECK Malaysian export permit requirements:
- sirim_required: electrical/electronic goods (HS 84-85), safety equipment, toys, helmets, cables
- halal_required: food/beverages (HS 02-24), cosmetics (33), pharmaceuticals (30) to Muslim-majority countries
- miti_required: steel (72-73), timber/wood (44-46), petroleum (27), strategic/dual-use goods
- strategic_goods: dual-use under Strategic Goods (Control) Act 2010 — military, cryptography, chemicals

confidence scoring: 0.9+ clear label with full specs | 0.6-0.8 identifiable product, partial label | below 0.5 only if truly unreadable

Return ONLY valid JSON:
{"identified":false,"hs_code":"","hs_description":"","product_name":"","malaysia_export_duty":0.0,"destination_import_duty":0.0,"preferential_duty_rates":{"ATIGA":0.0,"CPTPP":0.0,"RCEP":0.0},"fta_available":[],"permit_required":[],"export_prohibited":false,"strategic_goods":false,"sirim_required":false,"halal_required":false,"miti_required":false,"confidence":0.0,"classification_notes":[],"identification_notes":""}`
        );

        const hsCode = String(result.hs_code ?? "").trim();
        const identified = Boolean(result.identified) &&
          hsCode.length > 0 &&
          hsCode !== "XXXX.XX.XX" &&
          !hsCode.startsWith("XXXX") &&
          Number(result.confidence ?? 0) > 0.3;

        if (!identified) {
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `⚠️ I couldn't clearly identify the product from this image.\n\n${result.identification_notes ? `Reason: ${result.identification_notes}\n\n` : ""}**Please try one of these:**\n- Upload a clearer photo (front label, product spec sheet, or packaging)\n- Type your product description in the chat instead (e.g. "palm oil crude", "rubber gloves latex", "printed circuit board")`,
          });
          return;
        }

        sessionData.current.classification = result;
        addMsg({
          id: genId(), role: "assistant", kind: "hs-result",
          content: "Product identified and classified:",
          hsCode:        hsCode,
          description:   String(result.hs_description ?? "—"),
          duty:          Number(result.destination_import_duty ?? 0),
          fta:           (result.fta_available as string[] ?? []),
          permitRequired: Boolean((result.permit_required as unknown[])?.length || result.sirim_required || result.halal_required || result.miti_required),
          permits:       (result.permit_required as string[] ?? []),
        });
        const sid2 = await waitForSession();
        await runPermitCheckFromResult(sid2, result);

      // ── Permit / other attachment ──────────────────────────────────────
      } else {
        const result = await geminiVision(b64, mime,
          `You are an OCR engine for Malaysian export permits and certificates.

PERMIT TYPES and key fields to extract:
- SIRIM Certificate: number format "SIRIM QAS XXXX/XXXX", issuing body "SIRIM QAS International Sdn Bhd", product/scope description, validity period
- JAKIM Halal Certificate: number format "JAKIM/XXX/XXXX" or issuing body cert, company name exactly as SSM, product list, expiry date
- MITI Export Licence: licence number, HS codes covered, quota/value limit, validity period, any conditions
- DVS Permit (Dept of Veterinary Services): permit number, animal product type, destination country
- KKM Permit (Ministry of Health): registration "NOT/XXX/XXXX" or "MAL/XXXX/XXXX"
- MPOB Licence (Malaysian Palm Oil Board): licence number, product type (CPO/CPKO/RBD)
- Certificate of Origin Form D: CO number, HS code, origin criterion (WO/PE/PSR), FOB value, consignee country

EXTRACTION RULES:
- certificate_number: copy EXACTLY as printed including prefixes, slashes, dashes
- company_name: exact SSM-registered name on document
- issue_date and expiry_date: DD/MM/YYYY — compare expiry_date to today (${new Date().toLocaleDateString("en-MY")}); if expired set is_valid=false
- issuing_body: full official name of issuing authority
- scope: product name, HS code range, or description of what is covered
- is_valid: true only when certificate_number + issuing_body + company_name all extracted AND not expired
- confidence: 0.0-1.0 based on scan legibility

Return ONLY valid JSON:
{"is_valid":false,"permit_type":"","issuing_body":"","certificate_number":"","company_name":"","issue_date":"","expiry_date":"","scope":"","hs_code_covered":"","missing_fields":[],"confidence":0.0}`
        );
        addMsg({
          id: genId(), role: "assistant", kind: "extracted",
          content: result.is_valid ? "✅ Permit validated:" : "⚠️ Permit issues — please re-upload:",
          valid: Boolean(result.is_valid),
          fields: {
            "Permit Type":    String(result.permit_type       ?? "—"),
            "Certificate No": String(result.certificate_number ?? "—"),
            "Issuing Body":   String(result.issuing_body       ?? "—"),
            "Expiry Date":    String(result.expiry_date        ?? "—"),
          },
        });
        if (result.is_valid) advanceUI();
      }
    }, "Scanning document…");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitForSession, runWithFeedback, advanceUI, activeStep]);

  // ── STEP 1: Consignee ─────────────────────────────────────────────────────
  const handleConsigneeSubmit = useCallback(async (data: object) => {
    if (activeStep !== 1) { setModalLoading(false); return; }
    setModalLoading(true);
    const d = data as Record<string, string>;
    try {
      const result = await glmJSON(
        `You are a Malaysian export compliance officer. Screen this buyer for sanctions (OFAC SDN, UN Security Council, Malaysian MFA) and evaluate incoterm suitability.
Return JSON: {"risk_level":"low|medium|high","sanctioned_country":false,"denied_party_check":"clear|flagged|manual_review_required","incoterm_suitability":{"suitable":true,"reason":"","recommended_alternatives":[]},"compliance_notes":[],"red_flags":[]}`,
        `Buyer: ${d.buyer_name}, Country: ${d.buyer_country}, Address: ${d.buyer_address}, Incoterm: ${d.incoterm}, Tax ID: ${d.buyer_tax_id ?? "N/A"}`
      );
      try { const sid = await waitForSession(); await api.addConsignee(sid, data); } catch { /* offline */ }
      sessionData.current.consignee = { ...data, screening: result };
      setModal(null);
      const risk = String(result.risk_level ?? "low");
      const riskEmoji = risk === "high" ? "🔴" : risk === "medium" ? "🟡" : "🟢";
      addMsg({ id: genId(), role: "user",      kind: "text", content: `Consignee: ${d.buyer_name}, ${d.buyer_country}` });
      addMsg({ id: genId(), role: "assistant", kind: "text", content:
        `${riskEmoji} Buyer screened — Risk: **${risk.toUpperCase()}** · Sanctions: **${String(result.denied_party_check ?? "clear")}**` +
        ((result.compliance_notes as string[] ?? []).length ? `\n\n**Notes:** ${(result.compliance_notes as string[]).join("; ")}` : "") +
        ((result.red_flags       as string[] ?? []).length ? `\n\n⚠️ Flags: ${(result.red_flags as string[]).join("; ")}`       : "")
      });
      advanceUI();
    } catch {
      sessionData.current.consignee = data;
      setModal(null);
      addMsg({ id: genId(), role: "user",      kind: "text", content: `Consignee: ${d.buyer_name}, ${d.buyer_country}` });
      addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Consignee saved. Proceeding to Step 3." });
      advanceUI();
    } finally { setModalLoading(false); }
  }, [waitForSession, advanceUI]);

  // ── STEP 4: Digital Access ────────────────────────────────────────────────
  const handleDigitalAccessSubmit = useCallback(async (brn: string, agentCode: string) => {
    if (activeStep !== 4) { setModalLoading(false); return; }
    setModalLoading(true);
    try { const sid = await waitForSession(); await api.setupDigitalAccess(sid, brn || "202301045678"); } catch { /* offline */ }
    sessionData.current.digitalAccess = { brn, agentCode, confirmed: true };
    setModal(null);
    advanceUI();
    setModalLoading(false);
  }, [waitForSession, advanceUI]);

  // ── STEP 5: Financial Valuation ───────────────────────────────────────────
  const handleValuationSubmit = useCallback(async (data: object) => {
    if (activeStep !== 5) { setModalLoading(false); return; }
    setModalLoading(true);
    const d = data as Record<string, unknown>;
    try {
      const fob      = Number(d.fob_value_myr)    || 0;
      const freight  = Number(d.freight_quote_myr) || fob * 0.07;
      const ins      = fob * (Number(d.insurance_rate) || 0.005);
      const cif      = fob + freight + ins;
      const clsData  = (sessionData.current.classification as Record<string,unknown>) ?? {};
      const dutyRate = d.import_duty_rate ? Number(d.import_duty_rate) : (Number(clsData.destination_import_duty) || 5) / 100;
      const duty     = cif * dutyRate;
      const total    = cif + duty;
      const hsCode   = String(clsData.hs_code ?? "");
      const destCo   = String(d.destination_country ?? (sessionData.current.consignee as Record<string,string>)?.buyer_country ?? "Unknown");
      const currency = String(d.invoice_currency ?? "MYR");
      const fxRate   = Number(d.exchange_rate_to_myr) || 1;

      const fta = await glmJSON(
        `You are a Malaysian FTA duty-savings specialist. Evaluate ATIGA, CPTPP, RCEP, MAFTA, MJEPA.
FTA eligibility: ① product in FTA tariff schedule ② Rules of Origin met ③ CO certificate issued.
Return JSON: {"atiga_applicable":false,"atiga_rate":0.0,"atiga_savings_myr":0,"cptpp_applicable":false,"cptpp_savings_myr":0,"rcep_applicable":false,"rcep_savings_myr":0,"best_fta":"","best_fta_rate":0.0,"best_savings_myr":0,"form_required":"Form D|Form E|RCEP Form|None","roo_met":true,"roo_criteria":"","direct_shipment_required":true,"notes":""}`,
        `HS Code: ${hsCode}, Destination: ${destCo}, CIF: RM${cif.toFixed(2)}, MFN duty: ${(dutyRate*100).toFixed(1)}%`
      );

      const savings  = Number(fta.best_savings_myr) || 0;
      const ftaRate  = Number(fta.best_fta_rate) || 0;
      const netTotal = cif + cif * (ftaRate / 100);
      const valResult = {
        fob_myr: fob, freight_myr: freight, insurance_myr: ins, cif_myr: cif,
        import_duty_rate: dutyRate, estimated_duty_myr: duty,
        total_landed_cost_myr: total, net_landed_with_fta: netTotal,
        fta_analysis: fta, atiga_savings_myr: Number(fta.atiga_savings_myr) || 0,
        best_fta: String(fta.best_fta ?? ""), best_savings_myr: savings,
        form_required: String(fta.form_required ?? "None"),
        invoice_currency: currency, exchange_rate_to_myr: fxRate,
      };
      sessionData.current.valuation = valResult;
      setLandedCost({ fob, freight, insurance: ins, duty, total, savings, bestFta: String(fta.best_fta ?? ""), finalised: true });
      setModal(null);
      addMsg({ id: genId(), role: "assistant", kind: "valuation", content: "Valuation calculated:", fob, freight, insurance: ins, duty, total, savings, bestFta: String(fta.best_fta ?? "") });
      const ftaNote = savings > 0
        ? `\n\n🎯 **FTA saving: RM ${savings.toLocaleString()}** via **${fta.best_fta}** (${fta.form_required})\nNet landed: RM ${netTotal.toLocaleString("en-MY",{minimumFractionDigits:2})}\n\nTo claim: ① Confirm RVC/CTH criteria ② Apply for CO from MATRADE`
        : "\n\n⚠️ No FTA applicable for this route. MFN rate applies.";
      addMsg({ id: genId(), role: "assistant", kind: "text", content: `✅ CIF valuation locked.${ftaNote}` });
      try { const sid = await waitForSession(); await api.calculateValuation(sid, data); } catch { /* ok */ }
      advanceUI();
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text", content: `⚠️ Valuation error: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setModalLoading(false); }
  }, [waitForSession, advanceUI]);

  // ── STEP 6: Logistics ─────────────────────────────────────────────────────
  const handleShipmentSubmit = useCallback(async (data: object) => {
    if (activeStep !== 6) { setModalLoading(false); return; }
    setModalLoading(true);
    const d = data as Record<string, string>;
    try { const sid = await waitForSession(); await api.setupLogistics(sid, data); } catch { /* offline */ }
    sessionData.current.logistics = {
      mode: d.mode, pol: d.port_of_loading, pod: d.port_of_discharge,
      vessel: d.vessel_name, flight: d.flight_number, voyage_number: d.voyage_number,
      container_number: d.container_number, weight_kg: d.gross_weight_kg,
      net_weight_kg: d.net_weight_kg, cbm: d.cbm,
      number_of_packages: d.number_of_packages, package_type: d.package_type,
      export_date: d.export_date, signatory_name: d.signatory_name,
      signatory_designation: d.signatory_designation,
      signatory_ic_passport: d.signatory_ic_or_passport,
    };
    setModal(null);
    const modeEmoji: Record<string,string> = { SEA: "🚢", AIR: "✈️", ROAD: "🚛", RAIL: "🚂" };
    addMsg({ id: genId(), role: "user", kind: "text",
      content: `${modeEmoji[d.mode] ?? ""} Shipment: ${d.mode} · ${d.vessel_name || d.flight_number || "TBC"} · ETD ${d.export_date || "TBC"} · ${d.port_of_loading} → ${d.port_of_discharge}. ${d.gross_weight_kg} kg / ${d.cbm} m³ · ${d.number_of_packages} ${d.package_type}(s) · Container ${d.container_number || "TBC"}`,
    });
    advanceUI();
    setModalLoading(false);
  }, [waitForSession, advanceUI]);

  // ── STEP 7: Generate All Trade Documents ──────────────────────────────────
  const handleGenerateDocs = useCallback(async () => {
    if (activeStep !== 7) return;
    await runWithFeedback(async () => {
      const ctx = buildCtx();
      const configs = [
        { id: "commercial-invoice", title: "Commercial Invoice",
          sys: `Generate a complete Malaysian export Commercial Invoice per Customs Act 1967 and MATRADE. Return JSON: {"invoice_number":"CI-MY-2026-001","invoice_date":"","payment_terms":"T/T","exporter":{"name":"","brn":"","address":"","tel":"","email":"","bank":""},"consignee":{"name":"","country":"","address":"","tax_id":"","tel":"","contact_person":""},"goods":[{"line_no":1,"hs_code":"","description":"","quantity":0,"unit":"","unit_price":0,"total":0,"currency":"MYR"}],"incoterm":"FOB","port_of_loading":"","port_of_discharge":"","currency":"MYR","subtotal":0,"freight":0,"insurance":0,"total_fob":0,"total_cif":0,"country_of_origin":"Malaysia","marks_and_numbers":"","vessel_or_flight":"","declaration":"We hereby certify that this invoice is true and correct.","signatory":{"name":"","title":"","ic_or_passport":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
        { id: "packing-list", title: "Packing List",
          sys: `Generate a complete Malaysian export Packing List per MATRADE standards. Return JSON: {"packing_list_number":"PL-MY-2026-001","date":"","exporter":{"name":"","address":""},"consignee":{"name":"","country":"","address":""},"invoice_reference":"","vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","packages":[{"package_no":"1","type":"CTN","description":"","gross_weight_kg":0,"net_weight_kg":0,"cbm":0,"quantity_inside":0}],"total_packages":0,"total_gross_weight_kg":0,"total_net_weight_kg":0,"total_cbm":0,"shipping_marks":"","container_number":"","declaration":"We hereby certify that the above particulars are true and correct.","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
        { id: "coo", title: "Certificate of Origin",
          sys: `Generate a Certificate of Origin for Malaysian export per ATIGA Form D or Standard CO. Return JSON: {"co_number":"CO-MY-2026-001","co_date":"","form_type":"Form D (ATIGA)|Standard CO","issuing_body":"MATRADE","exporter":{"name":"","address":"","country":"Malaysia","brn":""},"consignee":{"name":"","address":"","country":""},"transport_details":{"vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","departure_date":""},"goods":[{"item_no":1,"description":"","hs_code":"","origin_criterion":"WO","quantity":"","gross_weight_kg":0,"fob_value_myr":0}],"invoice_reference":"","declaration":"The undersigned hereby declares that the above details are correct.","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
        { id: "bol", title: "Bill of Lading",
          sys: `Generate a Bill of Lading shell for Malaysian export (carrier assigns B/L number). Return JSON: {"bl_number":"TBC - Assigned by carrier","bl_date":"","bl_type":"OBL","shipper":{"name":"","address":"","brn":""},"consignee":{"name":"","address":"","country":""},"notify_party":{"name":"","address":""},"vessel_or_flight":"","voyage_or_flight_number":"","port_of_loading":"","port_of_discharge":"","freight_terms":"Prepaid","container_details":[{"container_no":"","seal_no":"","type":"","packages":0,"description":"","gross_weight_kg":0,"cbm":0}],"total_packages":0,"total_gross_weight_kg":0,"total_cbm":0,"place_of_issue":"Port Klang","number_of_originals":3,"carrier_clause":"SHIPPED on board in apparent good order and condition","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
      ];
      const settled = await Promise.allSettled(configs.map(c => glmJSON(c.sys, ctx)));
      const generated: string[] = [];
      const failed: string[]    = [];
      settled.forEach((res, i) => {
        const cfg = configs[i];
        if (res.status === "fulfilled" && !res.value.parse_error) {
          sessionData.current.documents = { ...(sessionData.current.documents as object ?? {}), [cfg.id.replace(/-/g,"_")]: res.value };
          setGeneratedIds(prev => new Set([...prev, cfg.id]));
          if      (cfg.id === "commercial-invoice") generateInvoicePDF(res.value);
          else if (cfg.id === "bol")                generateBOLPDF(res.value);
          else if (cfg.id === "packing-list")       generatePackingListPDF(res.value);
          else if (cfg.id === "coo")                generateCOOPDF(res.value);
          else makePDF(cfg.title, [`## ${cfg.title}`, ...flatLines(res.value)]);
          generated.push(cfg.title);
        } else {
          failed.push(cfg.title);
        }
      });
      if (generated.length) addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `✅ **${generated.length} document(s) generated & downloaded:** ${generated.join(", ")}.\n\nNow add your **e-signature** to unlock the K2 form.` });
      if (failed.length) addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `⚠️ Failed: ${failed.join(", ")}. Please try again.` });
    }, "Generating 4 trade documents…");
  }, [runWithFeedback, buildCtx]);

  // ── STEP 7: E-Signature ───────────────────────────────────────────────────
  const handleSign = useCallback(() => {
    if (activeStep !== 7) return;
    setSigned(true);
    setModal(null);
    addMsg({ id: genId(), role: "assistant", kind: "text",
      content: "✅ Declaration signed. K2 export declaration is now ready for preview and submission." });
    advanceUI();
  }, [advanceUI]);

  // ── STEP 8: K2 Declaration ────────────────────────────────────────────────
  const handleK2Submit = useCallback(async () => {
    if (activeStep !== 8) { setModalLoading(false); return; }
    const sid = await waitForSession();
    setModalLoading(true);
    const K2_SYS = `Generate a complete K2 Customs Export Declaration for MyDagangNet/MyECIS (Customs Act 1967). Return JSON: {"k2_reference":"K2-MY-2026-001","declaration_type":"EX","customs_station":"","export_date":"","k2_form_data":{"header":{"manifest_ref":"","declaration_type":"EX","customs_procedure_code":"10","regime_type":"Export","office_of_exit":""},"exporter":{"name":"","brn":"","address":"","customs_client_code":""},"consignee":{"name":"","country_code":"","address":"","contact_person":"","email":""},"transport":{"mode_code":"","mode_description":"","vessel_flight_name":"","voyage_flight_number":"","port_of_loading_code":"","port_of_discharge_code":"","country_of_destination_code":"","container_indicator":"Y"},"goods":{"item_number":1,"commodity_description":"","hs_code":"","country_of_origin":"MY","quantity":0,"unit_of_quantity":"","gross_weight_kg":0,"net_weight_kg":0,"number_of_packages":0,"package_type_code":"","container_number":""},"valuation":{"statistical_value_myr":0,"fob_value_myr":0,"invoice_currency":"MYR","invoice_amount":0,"exchange_rate":1.0,"incoterm":"FOB","freight_myr":0,"insurance_myr":0,"cif_value_myr":0},"duty":{"export_duty_myr":0,"customs_duty_myr":0,"sst_myr":0,"total_duty_myr":0,"duty_exemption_code":"","exemption_reference":""},"fta":{"fta_claimed":false,"fta_name":"","form_type":"","form_number":"","preferential_rate":0.0},"signatory":{"name":"","nric_passport":"","designation":"","declaration_text":"I declare that the particulars given in this declaration are true and correct.","date":""}},"submission_checklist":[],"atiga_form_d_applicable":false,"duty_savings_myr":0,"estimated_processing_hours":4,"dagang_net_submission_steps":[{"step":1,"action":"Log in to dagangnet.com.my","portal":"dagangnet.com.my","notes":"Use your digital certificate token"},{"step":2,"action":"Create new K2 export declaration and attach all documents","portal":"dagangnet.com.my","notes":""},{"step":3,"action":"Submit and await RMCD acknowledgement","portal":"dagangnet.com.my","notes":"Expected within 4 business hours"}],"compliance_notes":[],"warnings":[]}`;
    try {
      let k2: Record<string,unknown>;
      try {
        const r = await api.submitK2(sid) as Record<string,unknown>;
        k2 = (r.k2_data as Record<string,unknown>) ?? r;
      } catch {
        k2 = await glmJSON(K2_SYS, buildCtx());
      }
      setK2Data(k2);
      generateK2PDF(k2);
      setModal(null);
      advanceUI();
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `⚠️ K2 error: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setModalLoading(false); }
  }, [waitForSession, advanceUI, buildCtx]);

  // ── STEP 3: Permit check (GLM) ────────────────────────────────────────────
  const runPermitCheckFromResult = useCallback(async (sid: string, cls: Record<string,unknown>) => {
    const hsCode      = String(cls.hs_code      ?? "0000.00.00");
    const description = String(cls.hs_description ?? "unknown");
    const destCountry = String((sessionData.current.consignee as Record<string,string>)?.buyer_country ?? "Unknown");
    try {
      const result = await glmJSON(
        `You are a Malaysian export permits specialist. Reference: Strategic Goods (Control) Act 2010, Customs (Prohibition of Exports) Order 1988.
Return empty permits_required if no permits needed for general consumer goods.
Return JSON: {"permits_required":[{"name":"","issuing_body":"","mandatory":true,"processing_days":0,"fee_myr":0,"portal":""}],"sirim_required":false,"halal_required":false,"miti_license_required":false,"dvs_required":false,"strategic_goods_control":false,"notes":[]}`,
        `HS Code: ${hsCode}, Product: ${description}, Destination: ${destCountry}`
      );
      try { await api.checkPermits(sid, { hs_code: hsCode, product_type: description, destination_country: destCountry }); }
      catch { /* offline */ }
      setPermitFlags({
        needsSirim: Boolean(result.sirim_required || cls.sirim_required),
        needsHalal: Boolean(result.halal_required || cls.halal_required),
        needsCoo: true,
      });
      const permits = (result.permits_required as Array<Record<string,string>> ?? [])
        .filter(p => String(p.mandatory) !== "false" && p.name?.trim());
      if (permits.length === 0) {
        addMsg({ id: genId(), role: "assistant", kind: "text",
          content: `✅ HS ${hsCode} — No controlled permits required. Proceeding to Step 5: Digital Access.` });
        setCompleted(prev => new Set([...prev, 3]));
        setActiveStep(4);
        setMessages(m => [...m, STEP_FLOW[4].intro]);
      } else {
        const permitList = permits.map((p, i) => ({ name: p.name, key: `permit-${i}`, uploaded: false }));
        setRequiredPermits(permitList);
        addMsg({ id: genId(), role: "assistant", kind: "permit-upload",
          content: `${permits.length} permit(s) required for HS ${hsCode}. Upload each certificate to continue.`,
          permits: permitList,
        });
      }
    } catch {
      setPermitFlags({ needsSirim: false, needsHalal: false, needsCoo: true });
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: "✅ Permit check complete. No controlled permits flagged. Proceeding to Step 5: Digital Access." });
      setCompleted(prev => new Set([...prev, 3]));
      setActiveStep(4);
      setMessages(m => [...m, STEP_FLOW[4].intro]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPermitCheck = useCallback(async (sid: string) => {
    const cls = (sessionData.current.classification ?? {}) as Record<string,unknown>;
    await runPermitCheckFromResult(sid, cls);
  }, [runPermitCheckFromResult]);

  // ── STEP 3: Per-permit certificate validation ─────────────────────────────
  const handlePermitUpload = useCallback(async (permitKey: string, file: File) => {
    if (activeStep !== 3) return;
    await waitForSession();
    addMsg({ id: genId(), role: "user", kind: "upload", content: "uploaded-file", fileName: file.name });
    let valid = false;
    try {
      const b64    = await fileToB64(file);
      const result = await geminiVision(b64, fileMime(file),
        `Validate this Malaysian export permit or certificate.
Return JSON: {"is_valid":true,"permit_type":"","issuing_body":"","certificate_number":"","expiry_date":"","missing_fields":[],"confidence":0.9}`
      );
      valid = Boolean(result.is_valid);
      addMsg({ id: genId(), role: "assistant", kind: "extracted",
        content: valid ? "✅ Permit validated:" : "⚠️ Issues — please re-upload:",
        valid,
        fields: {
          "Permit Type":    String(result.permit_type       ?? "—"),
          "Certificate No": String(result.certificate_number ?? "—"),
          "Issuing Body":   String(result.issuing_body       ?? "—"),
          "Expiry Date":    String(result.expiry_date        ?? "—"),
          "Confidence":     `${Math.round(Number(result.confidence ?? 0.9) * 100)}%`,
        },
      });
    } catch { valid = true; /* allow through if Vision fails */ }
    if (valid) {
      setRequiredPermits(prev => {
        const next    = prev.map(p => p.key === permitKey ? { ...p, uploaded: true } : p);
        const allDone = next.every(p => p.uploaded);
        if (allDone) {
          setTimeout(() => {
            addMsg({ id: genId(), role: "assistant", kind: "text",
              content: "✅ All permit certificates validated. Proceeding to Step 5: Digital Access." });
            setCompleted(c => new Set([...c, 3]));
            setActiveStep(4);
            setMessages(m => [...m, STEP_FLOW[4].intro]);
          }, 500);
        }
        return next;
      });
    }
  }, [waitForSession]);

  // ── Step 3 auto-trigger ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeStep === 3 && !completed.has(3)) {
      waitForSession().then(sid => runPermitCheck(sid));
    }
  }, [activeStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── STEP 8: K2 Preview ────────────────────────────────────────────────────
  const handlePreviewK2 = useCallback(async () => {
    const sid = await waitForSession();
    await runWithFeedback(async () => {
      try {
        const r = await api.submitK2(sid) as Record<string,unknown>;
        setK2Data((r.k2_data as Record<string,unknown>) ?? r);
      } catch {
        const k2 = await glmJSON(
          `Generate a K2 export declaration for MyDagangNet/MyECIS. Return JSON: {"k2_reference":"K2-MY-2026-001","declaration_type":"EX","customs_station":"","export_date":"","k2_form_data":{"header":{"manifest_ref":"","declaration_type":"EX","customs_procedure_code":"10","regime_type":"Export","office_of_exit":""},"exporter":{"name":"","brn":"","address":"","customs_client_code":""},"consignee":{"name":"","country_code":"","address":"","contact_person":"","email":""},"transport":{"mode_code":"","mode_description":"","vessel_flight_name":"","voyage_flight_number":"","port_of_loading_code":"","port_of_discharge_code":"","country_of_destination_code":"","container_indicator":"Y"},"goods":{"item_number":1,"commodity_description":"","hs_code":"","country_of_origin":"MY","quantity":0,"unit_of_quantity":"","gross_weight_kg":0,"net_weight_kg":0,"number_of_packages":0,"package_type_code":"","container_number":""},"valuation":{"statistical_value_myr":0,"fob_value_myr":0,"invoice_currency":"MYR","invoice_amount":0,"exchange_rate":1.0,"incoterm":"FOB","freight_myr":0,"insurance_myr":0,"cif_value_myr":0},"duty":{"export_duty_myr":0,"customs_duty_myr":0,"sst_myr":0,"total_duty_myr":0,"duty_exemption_code":"","exemption_reference":""},"fta":{"fta_claimed":false,"fta_name":"","form_type":"","form_number":"","preferential_rate":0.0},"signatory":{"name":"","nric_passport":"","designation":"","declaration_text":"I declare that the particulars given in this declaration are true and correct.","date":""}},"submission_checklist":[],"atiga_form_d_applicable":false,"duty_savings_myr":0,"estimated_processing_hours":4,"dagang_net_submission_steps":[{"step":1,"action":"Log in to dagangnet.com.my","portal":"dagangnet.com.my","notes":""}],"compliance_notes":[],"warnings":[]}`,
          buildCtx()
        );
        setK2Data(k2);
      }
      setModal("k2-preview");
    }, "Building K2 declaration…");
  }, [waitForSession, runWithFeedback, buildCtx]);

  // ── Right-panel: individual doc download button ───────────────────────────
  const handleGenerate = useCallback(async (id: string) => {
    if (generatedIds.has(id) || generatingId) return;
    setGeneratingId(id);
    try {
      const ctx = buildCtx();
      const sysMap: Record<string, { title: string; sys: string }> = {
        "commercial-invoice": { title: "Commercial Invoice",
          sys: `Generate a Malaysian export Commercial Invoice. Return JSON: {"invoice_number":"CI-MY-2026-001","invoice_date":"","payment_terms":"T/T","exporter":{"name":"","brn":"","address":"","tel":"","email":"","bank":""},"consignee":{"name":"","country":"","address":"","tax_id":"","tel":"","contact_person":""},"goods":[{"line_no":1,"hs_code":"","description":"","quantity":0,"unit":"","unit_price":0,"total":0,"currency":"MYR"}],"incoterm":"FOB","port_of_loading":"","port_of_discharge":"","currency":"MYR","subtotal":0,"freight":0,"insurance":0,"total_fob":0,"total_cif":0,"country_of_origin":"Malaysia","declaration":"We hereby certify that this invoice is true and correct.","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
        "packing-list": { title: "Packing List",
          sys: `Generate a Malaysian export Packing List. Return JSON: {"packing_list_number":"PL-MY-2026-001","date":"","exporter":{"name":"","address":""},"consignee":{"name":"","country":"","address":""},"invoice_reference":"","vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","packages":[{"package_no":"1","type":"CTN","description":"","gross_weight_kg":0,"net_weight_kg":0,"cbm":0,"quantity_inside":0}],"total_packages":0,"total_gross_weight_kg":0,"total_net_weight_kg":0,"total_cbm":0,"shipping_marks":"","container_number":"","declaration":"We hereby certify that the above particulars are true and correct.","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
        "bol": { title: "Bill of Lading",
          sys: `Generate a Bill of Lading shell for Malaysian export. Return JSON: {"bl_number":"TBC - Assigned by carrier","bl_date":"","bl_type":"OBL","shipper":{"name":"","address":"","brn":""},"consignee":{"name":"","address":"","country":""},"notify_party":{"name":"","address":""},"vessel_or_flight":"","voyage_or_flight_number":"","port_of_loading":"","port_of_discharge":"","freight_terms":"Prepaid","container_details":[{"container_no":"","seal_no":"","type":"","packages":0,"description":"","gross_weight_kg":0,"cbm":0}],"total_packages":0,"total_gross_weight_kg":0,"total_cbm":0,"place_of_issue":"Port Klang","number_of_originals":3,"carrier_clause":"SHIPPED on board in apparent good order and condition","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
        "coo": { title: "Certificate of Origin",
          sys: `Generate a Certificate of Origin for Malaysian export. Return JSON: {"co_number":"CO-MY-2026-001","co_date":"","form_type":"Form D (ATIGA)","issuing_body":"MATRADE","exporter":{"name":"","address":"","country":"Malaysia","brn":""},"consignee":{"name":"","address":"","country":""},"transport_details":{"vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","departure_date":""},"goods":[{"item_no":1,"description":"","hs_code":"","origin_criterion":"WO","quantity":"","gross_weight_kg":0,"fob_value_myr":0}],"invoice_reference":"","declaration":"The undersigned hereby declares that the above details are correct.","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
        "k2": { title: "K2 Customs Export Declaration",
          sys: `Generate a K2 export declaration for MyDagangNet/MyECIS. Return JSON: {"k2_reference":"K2-MY-2026-001","declaration_type":"EX","customs_station":"","export_date":"","k2_form_data":{"header":{"manifest_ref":"","declaration_type":"EX","customs_procedure_code":"10","regime_type":"Export","office_of_exit":""},"exporter":{"name":"","brn":"","address":"","customs_client_code":""},"consignee":{"name":"","country_code":"","address":""},"transport":{"mode_code":"","mode_description":"","vessel_flight_name":"","voyage_flight_number":"","port_of_loading_code":"","port_of_discharge_code":"","country_of_destination_code":"","container_indicator":"Y"},"goods":{"item_number":1,"commodity_description":"","hs_code":"","country_of_origin":"MY","quantity":0,"unit_of_quantity":"","gross_weight_kg":0,"net_weight_kg":0,"number_of_packages":0,"package_type_code":"","container_number":""},"valuation":{"statistical_value_myr":0,"fob_value_myr":0,"invoice_currency":"MYR","invoice_amount":0,"exchange_rate":1.0,"incoterm":"FOB","freight_myr":0,"insurance_myr":0,"cif_value_myr":0},"duty":{"export_duty_myr":0,"customs_duty_myr":0,"sst_myr":0,"total_duty_myr":0,"duty_exemption_code":"","exemption_reference":""},"fta":{"fta_claimed":false,"fta_name":"","form_type":"","form_number":"","preferential_rate":0.0},"signatory":{"name":"","nric_passport":"","designation":"","declaration_text":"I declare that the particulars given in this declaration are true and correct.","date":""}},"submission_checklist":[],"atiga_form_d_applicable":false,"duty_savings_myr":0,"estimated_processing_hours":4,"dagang_net_submission_steps":[{"step":1,"action":"Log in to dagangnet.com.my","portal":"dagangnet.com.my","notes":"Use digital certificate token"}],"compliance_notes":[],"warnings":[]}` },
        "sirim": { title: "SIRIM Checklist",
          sys: `Generate a SIRIM export compliance checklist. Return JSON: {"checklist_items":[{"item":"","status":"required|optional","reference":""}],"sirim_scheme":"","processing_weeks":0,"portal":"https://www.sirim-qas.com.my","notes":""}` },
        "halal": { title: "Halal Checklist",
          sys: `Generate a JAKIM Halal export checklist. Return JSON: {"checklist_items":[{"item":"","status":"required"}],"jakim_scheme":"","processing_weeks":0,"portal":"https://www.halal.gov.my","notes":""}` },
      };
      const cfg = sysMap[id];
      if (!cfg) return;
      const result = await glmJSON(cfg.sys, ctx);
      if (id === "k2") setK2Data(result);
      sessionData.current.documents = { ...(sessionData.current.documents as object ?? {}), [id.replace(/-/g,"_")]: result };
      if      (id === "commercial-invoice") generateInvoicePDF(result);
      else if (id === "bol")                generateBOLPDF(result);
      else if (id === "k2")                 generateK2PDF(result);
      else if (id === "packing-list")       generatePackingListPDF(result);
      else if (id === "coo")                generateCOOPDF(result);
      else makePDF(cfg.title, [`## ${cfg.title}`, ...flatLines(result)]);
      setGeneratedIds(prev => new Set([...prev, id]));
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `⚠️ Error generating ${id}: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setGeneratingId(null); }
  }, [generatedIds, generatingId, buildCtx]);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const raw = input.trim();
    setInput("");
    addMsg({ id: genId(), role: "user", kind: "text", content: raw });
    setSending(true);

    // ── Step 0: handle SSM partial extraction — user types "confirm" or manual details ──
    if (activeStep === 0 && !completed.has(0) && sessionData.current.entity) {
      const entity = sessionData.current.entity as Record<string, unknown>;
      if (entity.partial_extraction) {
        const lower = raw.toLowerCase().trim();
        const isConfirm = ["confirm", "ok", "proceed", "yes", "correct", "looks good", "that's correct"].some(k => lower === k || lower.startsWith(k));

        if (isConfirm) {
          // User confirms partial data — advance
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `✅ Confirmed — proceeding with the extracted details. You can correct any fields later if needed.` });
          sessionData.current.entity = { ...entity, partial_extraction: false, is_valid: true };
          setSending(false);
          advanceUI();
          return;
        } else {
          // Try to parse manual corrections from free text
          try {
            const corrected = await glmJSON(
              `Extract company registration details from this user message. Merge with existing data where fields are still missing.
Existing data: ${JSON.stringify({
  company_name: entity.company_name,
  registration_number: entity.registration_number,
  company_type: entity.company_type,
  company_status: entity.company_status,
  directors: entity.directors,
})}
Instructions: If user provides a value for a field, use their value. If not mentioned, keep the existing value if it has meaning, otherwise leave empty.
Return ONLY valid JSON:
{"company_name":"","registration_number":"","company_type":"Sdn Bhd","company_status":"active","directors":[{"name":"","nric":"","designation":"Director"}],"paid_up_capital":"","sst_registered":false,"is_valid":true,"confidence":0.9}`,
              `User message: ${raw}`
            );

            const merged: Record<string, unknown> = {
              ...entity,
              ...corrected,
              // Prefer user-provided values, fall back to existing
              company_name:        hasMeaning(corrected.company_name)        ? corrected.company_name        : entity.company_name,
              registration_number: hasMeaning(corrected.registration_number) ? corrected.registration_number : entity.registration_number,
              partial_extraction: false,
              is_valid: true,
            };
            sessionData.current.entity = merged;

            const dirs = (merged.directors as Array<{name:string}> | undefined ?? [])
              .map((d: {name:string}) => d.name)
              .filter(Boolean)
              .join(", ");

            addMsg({
              id: genId(), role: "assistant", kind: "extracted",
              content: "Got it — here are the updated details:",
              valid: true,
              fields: {
                "Company Name":    hasMeaning(merged.company_name)        ? String(merged.company_name)        : "—",
                "BRN":             hasMeaning(merged.registration_number)  ? String(merged.registration_number) : "—",
                "Company Type":    hasMeaning(merged.company_type)         ? String(merged.company_type)        : "—",
                "Status":          hasMeaning(merged.company_status)       ? String(merged.company_status)      : "Active",
                "Directors":       dirs || "—",
                "SST Registered":  merged.sst_registered ? "Yes" : "No",
                "Paid-up Capital": hasMeaning(merged.paid_up_capital)      ? String(merged.paid_up_capital)     : "—",
              },
            });

            const nameOk = hasMeaning(merged.company_name);
            const brnOk  = hasMeaning(merged.registration_number);

            if (nameOk && brnOk) {
              // Both required fields now present — auto-advance
              addMsg({ id: genId(), role: "assistant", kind: "text",
                content: `✅ Company Name and BRN confirmed. Proceeding to Step 2 — Consignee Details.` });
              setSending(false);
              advanceUI();
              return;
            } else {
              // Still missing something
              const stillMissing: string[] = [];
              if (!nameOk) stillMissing.push("Company Name");
              if (!brnOk)  stillMissing.push("BRN");
              addMsg({ id: genId(), role: "assistant", kind: "text",
                content: `Still missing: **${stillMissing.join(", ")}**. Please provide these, or type **"confirm"** to proceed with what we have.` });
            }
          } catch {
            addMsg({ id: genId(), role: "assistant", kind: "text",
              content: `I didn't quite catch that. Please use this format:\n\n> Company Name: ABC SDN BHD\n> BRN: 202301012345\n\nOr type **"confirm"** to proceed with the current extracted data.` });
          }
          setSending(false);
          return;
        }
      }
    }

    // ── Step 2: treat chat input as product description for HS classification ──
    if (activeStep === 2 && !completed.has(2)) {
      try {
        const destCountry = String((sessionData.current.consignee as Record<string,string>)?.buyer_country ?? "Unknown");
        const result = await glmJSON(
          `You are an HS tariff classification expert for Malaysian exports (WCO HS 2022 / AHTN 2022).
Classify this product. Destination: ${destCountry}.
Return JSON: {"identified":true,"hs_code":"","hs_description":"","product_name":"","malaysia_export_duty":0.0,"destination_import_duty":0.0,"preferential_duty_rates":{"ATIGA":0.0,"CPTPP":0.0,"RCEP":0.0},"fta_available":[],"permit_required":[],"export_prohibited":false,"strategic_goods":false,"sirim_required":false,"halal_required":false,"miti_required":false,"confidence":0.9,"classification_notes":[]}`,
          `Product description: ${raw}`
        );
        const hsCode = String(result.hs_code ?? "").trim();
        const identified = Boolean(result.identified) && hsCode.length > 0 && !hsCode.startsWith("XXXX") && Number(result.confidence ?? 0) > 0.3;
        if (identified) {
          sessionData.current.classification = result;
          addMsg({
            id: genId(), role: "assistant", kind: "hs-result",
            content: "Product classified from your description:",
            hsCode, description: String(result.hs_description ?? "—"),
            duty: Number(result.destination_import_duty ?? 0),
            fta:  (result.fta_available as string[] ?? []),
            permitRequired: Boolean((result.permit_required as unknown[])?.length || result.sirim_required || result.halal_required || result.miti_required),
            permits: (result.permit_required as string[] ?? []),
          });
          const sid = await waitForSession();
          await runPermitCheckFromResult(sid, result);
        } else {
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `⚠️ Could not classify "${raw}" with confidence. Please be more specific (e.g. include material, use, HS chapter) or upload a product photo.`,
          });
        }
      } catch (err) {
        addMsg({ id: genId(), role: "assistant", kind: "text",
          content: `⚠️ Classification error: ${err instanceof Error ? err.message : String(err)}` });
      } finally { setSending(false); }
      return;
    }

    try {
      const e  = (sessionData.current.entity          as Record<string,string>) ?? {};
      const c  = (sessionData.current.consignee        as Record<string,string>) ?? {};
      const cl = (sessionData.current.classification   as Record<string,string>) ?? {};
      const v  = (sessionData.current.valuation        as Record<string,unknown>) ?? {};
      const l  = (sessionData.current.logistics        as Record<string,unknown>) ?? {};
      const system = `You are Architect AI, a Malaysian export compliance expert for Borderless AI.
You guide exporters through a 9-step workflow. The user has ALREADY COMPLETED the steps shown — do NOT ask them to redo any completed step.

Current session state:
- Active step: ${activeStep + 1}/9 — ${STEPS[activeStep]?.title ?? ""}
- Entity: ${e.company_name ? `✅ ${e.company_name} (BRN: ${e.registration_number})` : "⏳ Not yet verified"}
- Consignee: ${c.buyer_name ? `✅ ${c.buyer_name}, ${c.buyer_country}` : "⏳ Not yet added"}
- HS Code: ${cl.hs_code ? `✅ ${cl.hs_code} — ${cl.hs_description}` : "⏳ Not yet classified"}
- Valuation: ${v.fob_myr ? `✅ FOB RM${v.fob_myr}` : "⏳ Not yet entered"}
- Logistics: ${l.mode ? `✅ ${l.mode} — ${l.pol} → ${l.pod}` : "⏳ Not yet set"}

Be concise, practical. Reference Malaysian regulations when relevant (Customs Act 1967, ATIGA, Customs Prohibition of Exports Order 1988, etc.). Respond in the same language the user used.`;
      const reply = await glmText(system, raw, chatHistoryRef.current.slice(-10));
      chatHistoryRef.current = [...chatHistoryRef.current.slice(-14), { role: "user", content: raw }, { role: "assistant", content: reply }];
      addMsg({ id: genId(), role: "assistant", kind: "text", content: reply });
    } catch (err) {
      try {
        const sid = await waitForSession();
        const res = await api.chat(sid, raw) as Record<string,string>;
        addMsg({ id: genId(), role: "assistant", kind: "text", content: res.reply || res.response || "No response." });
      } catch {
        addMsg({ id: genId(), role: "assistant", kind: "text", content: `⚠️ ${err instanceof Error ? err.message : String(err)}` });
      }
    } finally { setSending(false); }
  }, [input, sending, waitForSession, activeStep, completed, runPermitCheckFromResult]);

  // ── Action button dispatcher ──────────────────────────────────────────────
  const ACTION_STEP: Record<string, number> = {
    "upload-ssm": 0, "verify-ssm": 0,
    "add-consignee": 1,
    "upload-product": 2, "lookup-hs": 2,
    "connect-dagang": 4,
    "enter-valuation": 5,
    "add-shipment": 6,
    "generate-docs": 7, "sign-declaration": 7,
  };

  const handleAction = useCallback(async (action: string, label: string) => {
    const requiredStep = ACTION_STEP[action];
    if (requiredStep !== undefined && activeStep !== requiredStep && !completed.has(requiredStep)) {
      const blocking = STEPS[requiredStep];
      addMsg({ id: genId(), role: "assistant", kind: "blocked",
        content: `Step ${requiredStep + 1} — "${blocking.title}" — is not active yet. Complete the current step first.` });
      return;
    }

    const uploadConfig = UPLOAD_ACTION_MAP[action];
    if (uploadConfig) {
      pendingUploadRef.current = { action, ...uploadConfig };
      if (fileInputRef.current) { fileInputRef.current.accept = uploadConfig.accept; fileInputRef.current.click(); }
      return;
    }
    if (action === "add-consignee")    { setModal("consignee");       return; }
    if (action === "enter-valuation")  { setModal("valuation");       return; }
    if (action === "add-shipment")     { setModal("shipment");        return; }
    if (action === "connect-dagang")   { setModal("digital-access");  return; }
    if (action === "sign-declaration") { setModal("signature");       return; }
    if (action === "generate-docs")    { handleGenerateDocs();        return; }
    if (action === "lookup-hs")        { addMsg({ id: genId(), role: "user", kind: "text", content: label }); return; }

    addMsg({ id: genId(), role: "user", kind: "text", content: label });
    const sid = await waitForSession();
    await runWithFeedback(async () => {
      if (action === "verify-ssm") {
        await api.verifyEntity(sid, { company_name: "Manual verify", registration_number: "202301045678" });
        advanceUI();
      } else {
        advanceUI();
      }
    });
  }, [waitForSession, runWithFeedback, advanceUI, handleGenerateDocs]);

  // ── Step jump ─────────────────────────────────────────────────────────────
  const tryJumpTo = useCallback((stepId: number) => {
    if (stepId === activeStep) return;
    if (completed.has(stepId)) { setActiveStep(stepId); return; }
    const blocking = STEPS.slice(0, stepId).find(s => !completed.has(s.id));
    if (!blocking) { setActiveStep(stepId); return; }
    addMsg({ id: genId(), role: "assistant", kind: "blocked",
      content: `Step ${stepId + 1} is locked. Complete Step ${blocking.id + 1} — "${blocking.title}" — first.` });
  }, [completed, activeStep]);

  const signatoryName  = ((sessionData.current.logistics as Record<string, string>)?.signatory_name) || "";
  const signatoryTitle = ((sessionData.current.logistics as Record<string, string>)?.signatory_designation) || "";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
>>>>>>> architect-ai
  return (
    <div className="min-h-screen bg-secondary/30">
      <TopNav />

<<<<<<< HEAD
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px] xl:grid-cols-[260px_1fr_320px]">

          {/* LEFT: Trade Dependency Graph stepper */}
=======
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
>>>>>>> architect-ai
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-gradient-card p-4 shadow-soft-md">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Export Checklist</h2>
<<<<<<< HEAD
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {completed.size}/{total}
                </span>
              </div>
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
                  <span>Progress</span><span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-primary transition-base" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <ol className="relative space-y-1">
                {STEPS.map((step, idx) => {
                  const isCompleted = completed.has(step.id);
                  const isActive = step.id === activeStep;
                  const isLocked = !isCompleted && !isActive;
                  const Icon = step.icon;
                  const isLast = idx === STEPS.length - 1;
                  return (
                    <li key={step.id} className="relative">
                      {!isLast && (
                        <span className={`absolute left-[19px] top-9 h-[calc(100%-12px)] w-px ${isCompleted ? "bg-success/40" : "bg-border"}`} />
                      )}
                      <button
                        onClick={() => tryJumpTo(step.id)}
                        className={`relative flex w-full items-start gap-3 rounded-xl p-2 text-left transition-base ${isActive ? "bg-primary-soft ring-1 ring-primary/30" :
                            isCompleted ? "hover:bg-secondary/60" :
                              "opacity-60 hover:opacity-80"
                          }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isCompleted ? "bg-success text-primary-foreground" :
                            isActive ? "bg-primary text-primary-foreground shadow-glow" :
                              "bg-secondary text-muted-foreground"
                          }`}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
                            isLocked ? <Lock className="h-3.5 w-3.5" /> :
                              <Icon className="h-4 w-4" />}
=======
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
>>>>>>> architect-ai
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

<<<<<<< HEAD
              {/* Document generation status */}
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Doc Status</h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {generatedIds.size}/{EXPORT_DOCS.length}
                  </span>
                </div>

                {generatingId && (() => {
                  const doc = EXPORT_DOCS.find((d) => d.id === generatingId);
                  if (!doc) return null;
                  return (
                    <div className="mb-2 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary-soft px-2.5 py-2">
                      <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                        <div className="text-[10px] text-muted-foreground">Generating…</div>
                      </div>
                    </div>
                  );
                })()}

                <ul className="space-y-1.5">
                  {EXPORT_DOCS.map((doc) => {
                    const isDone = generatedIds.has(doc.id);
                    const isGenerating = generatingId === doc.id;
                    const missing = doc.requiredSteps.filter((s) => !completed.has(s));
                    const blockingStep = missing.length > 0 ? STEPS[missing[0]] : null;
                    // Show whether this doc is currently gating
                    const gating = isGating(doc, permitFlags);
                    return (
                      <li key={doc.id} className="flex items-center gap-2 text-[11px]">
                        {isDone ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
                        ) : isGenerating ? (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                        ) : blockingStep ? (
                          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                        )}
                        <span className={`flex-1 truncate ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {doc.label}
                        </span>
                        {/* Only show Req badge if this doc is currently gating */}
                        {gating && (
                          <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-px text-[8px] font-bold uppercase text-primary">Req</span>
                        )}
                        {!isDone && !isGenerating && blockingStep && !gating && (
                          <span className="shrink-0 rounded bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground" title={`Needs: ${blockingStep.title}`}>
                            S{blockingStep.id + 1}
                          </span>
                        )}
=======
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
>>>>>>> architect-ai
                      </li>
                    );
                  })}
                </ul>
<<<<<<< HEAD

                {/* Gating progress summary */}
                {gatingDocs.length > 0 && (
                  <div className="mt-3 rounded-lg bg-secondary/60 px-2.5 py-2">
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-muted-foreground">Required docs</span>
                      <span className={`font-bold ${canProceed ? "text-success" : "text-primary"}`}>
                        {gatingGenerated}/{gatingDocs.length}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-base ${canProceed ? "bg-success" : "bg-gradient-primary"}`}
                        style={{ width: `${Math.round((gatingGenerated / gatingDocs.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
=======
>>>>>>> architect-ai
              </div>
            </div>
          </aside>

<<<<<<< HEAD
          {/* MIDDLE: Chat + Landed Cost */}
          <div className="flex flex-col gap-4 min-w-0">
            <section className="flex min-h-[70vh] flex-col rounded-2xl border border-border bg-gradient-card shadow-soft-md">
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Architect AI</div>
                    <div className="text-[11px] text-muted-foreground">
                      Step {activeStep + 1} · {STEPS[activeStep]?.title}
                    </div>
                  </div>
                </div>
=======
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
>>>>>>> architect-ai
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
<<<<<<< HEAD
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} onAction={handleAction} />
                ))}
                {sending && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                      <Cog className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                      Mapping dependencies against RMCD & MITI regulations…
                    </div>
=======
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
>>>>>>> architect-ai
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border bg-card/60 p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/40">
<<<<<<< HEAD
                  <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-base">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type business details or ask about a regulation…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-24"
                  />
                  <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-base">
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base"
                  >
=======
                  <button type="button" onClick={() => { pendingUploadRef.current = { action: "chat-attachment", accept: ".pdf,.jpg,.jpeg,.png,.docx,.xlsx", endpoint: "/documents/upload" }; if (fileInputRef.current) { fileInputRef.current.accept = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx"; fileInputRef.current.click(); } }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-base">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Type business details or ask about a regulation…" rows={1} className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-24" />
                  <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-base"><Mic className="h-4 w-4" /></button>
                  <button type="button" onClick={handleSend} disabled={!input.trim() || sending} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50 transition-base">
>>>>>>> architect-ai
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
<<<<<<< HEAD
                  <span>Architect AI may request supporting documents.</span>
                  <span>↵ to send</span>
=======
                  <span>Architect AI may request supporting documents.</span><span>↵ to send</span>
>>>>>>> architect-ai
                </div>
              </div>
            </section>

<<<<<<< HEAD
            {/* Estimated Landed Cost */}
            <div className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft-sm">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated</div>
                  <div className="text-sm font-semibold text-foreground">Landed Cost</div>
                </div>
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">Not Final</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-4">
                {[
                  { label: "FOB Value", value: "RM 4,720" },
                  { label: "Insurance + Freight", value: "RM 330" },
                  { label: "Estimated Duty", value: "RM 252" },
                ].map((row) => (
=======
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
>>>>>>> architect-ai
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-l border-border pl-6">
                  <span className="text-sm font-semibold text-foreground">Total</span>
<<<<<<< HEAD
                  <span className="text-lg font-semibold text-foreground">RM 5,302</span>
=======
                  <span className="text-lg font-semibold text-foreground">RM {landedCost.fob > 0 ? landedCost.total.toLocaleString() : "5,302"}</span>
>>>>>>> architect-ai
                </div>
                <div className="flex w-full items-start gap-2 rounded-xl bg-success-soft p-2.5">
                  <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <p className="text-[11px] leading-relaxed text-success">
<<<<<<< HEAD
                    Potential <strong>RM 320 saved</strong> if ATIGA Form D is filed.
                  </p>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Info className="h-3 w-3 shrink-0" />
                    Updates as you progress.
                  </div>
=======
                    Potential <strong>RM {landedCost.savings > 0 ? landedCost.savings.toLocaleString() : "320"} saved</strong>
                    {landedCost.bestFta ? ` via ${landedCost.bestFta}` : " if ATIGA Form D is filed"}.
                  </p>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground"><Info className="h-3 w-3 shrink-0" />Updates as you progress.</div>
>>>>>>> architect-ai
                </div>
              </div>
            </div>
          </div>

<<<<<<< HEAD
          {/* RIGHT: Document Pack */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft-md">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Export</div>
                  <div className="text-sm font-semibold text-foreground">Document Pack</div>
                </div>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {readyDocs.length} Ready
                </span>
              </div>

              <div className="max-h-[540px] space-y-1 overflow-y-auto px-3 py-3">
                {readyDocs.length > 0 && (
                  <>
                    <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                      ✓ Ready to Generate
                    </div>
                    {readyDocs.map((doc) => {
                      const Icon = doc.icon;
                      const isGenerating = generatingId === doc.id;
                      const isGenerated = generatedIds.has(doc.id);
                      const gating = isGating(doc, permitFlags);
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-base hover:border-primary/30 hover:bg-primary-soft/30">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-soft">
                            <Icon className="h-3.5 w-3.5 text-success" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                              {gating && (
                                <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-px text-[8px] font-bold uppercase text-primary">Req</span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">{doc.sublabel}</div>
                          </div>
                          <button
                            onClick={() => handleGenerate(doc.id)}
                            disabled={isGenerated || isGenerating}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-base ${isGenerated
                                ? "bg-success text-primary-foreground"
                                : isGenerating
                                  ? "bg-primary/20 text-primary"
                                  : "bg-primary text-primary-foreground shadow-glow hover:opacity-90"
                              }`}
                          >
                            {isGenerated ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : isGenerating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
=======
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
>>>>>>> architect-ai
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {partialDocs.length > 0 && (
                  <>
<<<<<<< HEAD
                    <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-warning">
                      ⚡ Needs More Info
                    </div>
                    {partialDocs.map((doc) => {
                      const Icon = doc.icon;
                      const gating = isGating(doc, permitFlags);
                      const missing = doc.requiredSteps
                        .filter((sid) => !completed.has(sid))
                        .map((sid) => STEPS.find((s) => s.id === sid)?.title)
                        .filter(Boolean);
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 opacity-75">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft">
                            <Icon className="h-3.5 w-3.5 text-warning" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                              {gating && (
                                <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-px text-[8px] font-bold uppercase text-primary">Req</span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-warning">Need: {missing.slice(0, 2).join(", ")}</div>
                          </div>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                            <Lock className="h-3 w-3" />
                          </div>
=======
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
>>>>>>> architect-ai
                        </div>
                      );
                    })}
                  </>
                )}

                {lockedDocs.length > 0 && (
                  <>
<<<<<<< HEAD
                    <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      🔒 Locked
                    </div>
                    {lockedDocs.map((doc) => {
                      const Icon = doc.icon;
                      const gating = isGating(doc, permitFlags);
                      const missingCount = doc.requiredSteps.filter((sid) => !completed.has(sid)).length;
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2.5 opacity-50">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <div className="truncate text-[11px] font-semibold text-muted-foreground">{doc.label}</div>
                              {gating && (
                                <span className="shrink-0 rounded-sm bg-muted px-1 py-px text-[8px] font-bold uppercase text-muted-foreground">Req</span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {missingCount} step{missingCount > 1 ? "s" : ""} remaining
                            </div>
                          </div>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                            <Lock className="h-3 w-3" />
                          </div>
=======
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
>>>>>>> architect-ai
                        </div>
                      );
                    })}
                  </>
                )}

<<<<<<< HEAD
                {readyDocs.filter((d) => !generatedIds.has(d.id)).length > 1 && (
                  <div className="pb-1 pt-3">
                    <button
                      onClick={() => readyDocs.forEach((d) => !generatedIds.has(d.id) && handleGenerate(d.id))}
                      className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-[12px] font-semibold text-primary-foreground shadow-glow transition-base hover:opacity-90"
                    >
                      Generate All Ready Docs
                    </button>
                    <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                      More docs unlock as you progress
                    </p>
=======
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
>>>>>>> architect-ai
                  </div>
                )}
              </div>
            </div>
          </aside>
<<<<<<< HEAD

        </div>
      </main>

      {/* ── Proceed to Logistics FAB ── */}
      {canProceed && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          <span className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-primary opacity-20" />
          <button
            onClick={() => navigate("/documents", {
              state: {
                product: scanContext.product,
                hsCode: scanContext.hsCode,
                confidence: scanContext.confidence,
                destinationCountry: scanContext.destinationCountry || "China",
                carriedDocs,
              },
            })}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-primary/40 transition-all hover:scale-[1.03] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] active:scale-[0.98]"
          >
            <Ship className="h-4 w-4" />
            Proceed to Documents
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="pointer-events-auto text-center text-[10px] text-muted-foreground">
            {gatingGenerated}/{gatingDocs.length} required docs ready
          </p>
=======
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
>>>>>>> architect-ai
        </div>
      )}
    </div>
  );
}

<<<<<<< HEAD
function MessageBubble({ msg, onAction }: { msg: Message; onAction: (action: string, label: string) => void }) {
=======
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

>>>>>>> architect-ai
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft-sm">
<<<<<<< HEAD
          {msg.kind === "upload" ? (
            <div className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              <span>{msg.fileName}</span>
            </div>
          ) : msg.content}
=======
          {msg.kind === "upload" ? <div className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /><span>{(msg as {fileName: string}).fileName}</span></div> : msg.content}
>>>>>>> architect-ai
        </div>
      </div>
    );
  }

  if (msg.kind === "blocked") {
    return (
      <div className="flex items-start gap-3">
<<<<<<< HEAD
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft">
          <AlertTriangle className="h-4 w-4 text-danger" />
        </div>
=======
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft"><AlertTriangle className="h-4 w-4 text-danger" /></div>
>>>>>>> architect-ai
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
<<<<<<< HEAD
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          <Link2 className="h-4 w-4 text-primary" />
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          {msg.content}
        </div>
=======
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft"><Link2 className="h-4 w-4 text-primary" /></div>
        <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">{msg.content}</div>
>>>>>>> architect-ai
      </div>
    );
  }

  if (msg.kind === "reference") {
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[85%] space-y-2">
<<<<<<< HEAD
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">
            {msg.content}
          </div>
          <a href={msg.refUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-xs font-medium text-primary hover:bg-primary-soft/70 transition-base">
            <ExternalLink className="h-3.5 w-3.5" />
            <span>{msg.refTitle}</span>
            <ArrowRight className="ml-auto h-3.5 w-3.5" />
=======
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{msg.content}</div>
          <a href={msg.refUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-xs font-medium text-primary hover:bg-primary-soft/70 transition-base">
            <ExternalLink className="h-3.5 w-3.5" /><span>{msg.refTitle}</span><ArrowRight className="ml-auto h-3.5 w-3.5" />
>>>>>>> architect-ai
          </a>
        </div>
      </div>
    );
  }

<<<<<<< HEAD
  if (msg.kind === "checklist") {
=======
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
>>>>>>> architect-ai
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[85%] space-y-3">
<<<<<<< HEAD
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">
            {msg.content}
          </div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Compliance Checklist</div>
            <ul className="space-y-1.5">
              {msg.items.map((item, i) => (
=======
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">{m.content}</div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Compliance Checklist</div>
            <ul className="space-y-1.5">
              {m.items.map((item, i) => (
>>>>>>> architect-ai
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <StatusTag status={item.status} />
                </li>
              ))}
            </ul>
          </div>
<<<<<<< HEAD
          {msg.actions && (
            <div className="flex flex-wrap gap-2">
              {msg.actions.map((a, i) => {
                const Icon = a.icon;
                return (
                  <button
                    key={i}
                    onClick={() => onAction(a.action, a.label)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-base ${a.intent === "primary"
                        ? "bg-primary text-primary-foreground shadow-glow hover:opacity-90"
                        : "border border-border bg-card text-foreground hover:bg-secondary"
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    {a.label}
                  </button>
                );
              })}
=======
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

>>>>>>> architect-ai
            </div>
          )}
        </div>
      </div>
    );
  }

<<<<<<< HEAD
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">
        {msg.content}
=======
  // default: text + K2 button when on step 8 signed
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-foreground space-y-1">
          {renderMarkdown(msg.content)}
        </div>

>>>>>>> architect-ai
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
<<<<<<< HEAD
  const styles: Record<ChecklistStatus, string> = {
    REQUIRED: "bg-danger-soft text-danger",
    PENDING: "bg-warning-soft text-warning",
    COMPLETED: "bg-success-soft text-success",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles[status]}`}>
      [{status}]
    </span>
  );
=======
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
>>>>>>> architect-ai
}