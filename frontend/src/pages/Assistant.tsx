import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  Building2, FileCheck2, Award, FileSearch,
  ShieldCheck, Sparkles, Mic, ArrowUp, Loader2, Paperclip,
  Cog, Link2, AlertTriangle, ExternalLink, Upload, ArrowRight,
  CheckCircle2, Lock, FileText, FileSpreadsheet, Ship, ClipboardList,
  Stamp, Leaf, Download, TrendingDown, Info, KeyRound,
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

type Message =
  | { id: string; role: "user"; kind: "text"; content: string }
  | { id: string; role: "user"; kind: "upload"; content: string; fileName: string }
  | { id: string; role: "assistant"; kind: "processing"; content: string }
  | { id: string; role: "assistant"; kind: "text"; content: string }
  | { id: string; role: "assistant"; kind: "checklist"; content: string; items: ChecklistItem[]; actions?: ActionButton[] }
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

  return (
    <div className="min-h-screen bg-secondary/30">
      <TopNav />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px] xl:grid-cols-[260px_1fr_320px]">

          {/* LEFT: Trade Dependency Graph stepper */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-gradient-card p-4 shadow-soft-md">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Export Checklist</h2>
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
                      </li>
                    );
                  })}
                </ul>

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
              </div>
            </div>
          </aside>

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
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
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
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border bg-card/60 p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/40">
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
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                  <span>Architect AI may request supporting documents.</span>
                  <span>↵ to send</span>
                </div>
              </div>
            </section>

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
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-l border-border pl-6">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-semibold text-foreground">RM 5,302</span>
                </div>
                <div className="flex w-full items-start gap-2 rounded-xl bg-success-soft p-2.5">
                  <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <p className="text-[11px] leading-relaxed text-success">
                    Potential <strong>RM 320 saved</strong> if ATIGA Form D is filed.
                  </p>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Info className="h-3 w-3 shrink-0" />
                    Updates as you progress.
                  </div>
                </div>
              </div>
            </div>
          </div>

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
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {partialDocs.length > 0 && (
                  <>
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
                        </div>
                      );
                    })}
                  </>
                )}

                {lockedDocs.length > 0 && (
                  <>
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
                        </div>
                      );
                    })}
                  </>
                )}

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
                  </div>
                )}
              </div>
            </div>
          </aside>

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
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, onAction }: { msg: Message; onAction: (action: string, label: string) => void }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft-sm">
          {msg.kind === "upload" ? (
            <div className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              <span>{msg.fileName}</span>
            </div>
          ) : msg.content}
        </div>
      </div>
    );
  }

  if (msg.kind === "blocked") {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft">
          <AlertTriangle className="h-4 w-4 text-danger" />
        </div>
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          <Link2 className="h-4 w-4 text-primary" />
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.kind === "reference") {
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[85%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">
            {msg.content}
          </div>
          <a href={msg.refUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-xs font-medium text-primary hover:bg-primary-soft/70 transition-base">
            <ExternalLink className="h-3.5 w-3.5" />
            <span>{msg.refTitle}</span>
            <ArrowRight className="ml-auto h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  if (msg.kind === "checklist") {
    return (
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="max-w-[85%] space-y-3">
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">
            {msg.content}
          </div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Compliance Checklist</div>
            <ul className="space-y-1.5">
              {msg.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <StatusTag status={item.status} />
                </li>
              ))}
            </ul>
          </div>
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
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">
        {msg.content}
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
}