import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  Building2, Package, FileCheck2, Globe2, Award, Truck, FileSearch,
  ShieldCheck, Sparkles, Mic, ArrowUp, Loader2, Paperclip,
  Cog, Link2, AlertTriangle, ExternalLink, Upload, ArrowRight,
  CheckCircle2, Lock, FileText, FileSpreadsheet, Ship, ClipboardList,
  Stamp, Leaf, Download, TrendingDown, Info, KeyRound,
} from "lucide-react";

type StepStatus = "completed" | "active" | "locked";
type ChecklistStatus = "REQUIRED" | "PENDING" | "COMPLETED";

type Step = {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
};

const STEPS: Step[] = [
  { id: 0, title: "Entity Verification", subtitle: "SSM & BRN Registration", icon: Building2 },
  { id: 1, title: "Classification", subtitle: "HS Code & Duty Lookup", icon: FileSearch },
  { id: 2, title: "Special Permits", subtitle: "SIRIM / Halal / MITI", icon: Award },
  { id: 3, title: "Digital Access", subtitle: "MyCIEDS & Dagang Net", icon: KeyRound },
  { id: 4, title: "Trade Docs", subtitle: "Invoice & Packing List", icon: FileText },
  { id: 5, title: "Customs Submission", subtitle: "K2 Form Preview", icon: FileCheck2 },
];

type ChecklistItem = { label: string; status: ChecklistStatus };

type DocStatus = "ready" | "partial" | "locked";
type ExportDoc = {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  requiredSteps: number[];
};

const EXPORT_DOCS: ExportDoc[] = [
  { id: "commercial-invoice", label: "Commercial Invoice", sublabel: "Buyer & seller details, goods value", icon: FileText, requiredSteps: [0, 1] },
  { id: "packing-list", label: "Packing List", sublabel: "Item weights, dimensions & quantities", icon: FileSpreadsheet, requiredSteps: [0, 1] },
  { id: "bol", label: "Bill of Lading / Air Waybill", sublabel: "Carrier & routing information", icon: Ship, requiredSteps: [0, 1, 4] },
  { id: "k2", label: "K2 Declaration Form", sublabel: "Customs export declaration", icon: ClipboardList, requiredSteps: [0, 1, 2, 3] },
  { id: "coo", label: "Certificate of Origin", sublabel: "ATIGA / FTA Form D", icon: Stamp, requiredSteps: [0, 1, 2] },
  { id: "sirim", label: "SIRIM Certificate", sublabel: "Standards & quality compliance", icon: ShieldCheck, requiredSteps: [0, 1, 2] },
  { id: "halal", label: "Halal Certificate", sublabel: "JAKIM-recognised certification", icon: Leaf, requiredSteps: [0, 1, 2, 3] },
];

const docStatus = (doc: ExportDoc, completed: Set<number>): DocStatus => {
  const missing = doc.requiredSteps.filter((s) => !completed.has(s)).length;
  if (missing === 0) return "ready";
  if (missing <= 1) return "partial";
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

const STEP_FLOW: Record<number, {
  intro: Message;
  onComplete: Message;
}> = {
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
      content: "✅ Entity verified. SSM No. 202301045678-A linked to RMCD records. Moving to product classification.",
    },
  },
  1: {
    intro: {
      id: "i1", role: "assistant", kind: "checklist",
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
      id: "c1", role: "assistant", kind: "text",
      content: "✅ Classified as HS 0902.30.10 (Black tea, fermented, in packings ≤ 3kg). Duty: 5% under ATIGA. Now checking permit dependencies.",
    },
  },
  2: {
    intro: {
      id: "i2", role: "assistant", kind: "reference",
      content: "Your HS Code triggers SIRIM compliance. Halal cert recommended for ASEAN F&B markets. MITI export licence not required at this volume.",
      refTitle: "SIRIM QAS — Product Certification",
      refUrl: "https://www.sirim-qas.com.my/",
    },
    onComplete: {
      id: "c2", role: "assistant", kind: "text",
      content: "✅ SIRIM cert validated. JAKIM Halal logo permitted. Proceeding to digital access setup.",
    },
  },
  3: {
    intro: {
      id: "i3", role: "assistant", kind: "checklist",
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
      id: "c3", role: "assistant", kind: "text",
      content: "✅ Dagang Net linked. Digital Certificate active until 2027. Generating trade documents next.",
    },
  },
  4: {
    intro: {
      id: "i4", role: "assistant", kind: "checklist",
      content: "Generating draft Commercial Invoice and Packing List from your verified entity + classification data.",
      items: [
        { label: "Commercial Invoice", status: "PENDING" },
        { label: "Packing List", status: "PENDING" },
        { label: "Certificate of Origin (Form D)", status: "PENDING" },
      ],
      actions: [
        { label: "Generate Trade Docs", icon: FileText, intent: "primary", action: "generate-docs" },
      ],
    },
    onComplete: {
      id: "c4", role: "assistant", kind: "text",
      content: "✅ Invoice INV-2026-0042 and Packing List PL-2026-0042 generated. Ready for K2 submission.",
    },
  },
  5: {
    intro: {
      id: "i5", role: "assistant", kind: "text",
      content: "All dependencies satisfied. K2 Customs Declaration is ready for preview and submission to RMCD via Dagang Net.",
    },
    onComplete: {
      id: "c5", role: "assistant", kind: "text",
      content: "🎉 K2 submitted. Reference: K2-MY-2026-118742. RMCD acknowledgement expected within 4 business hours.",
    },
  },
};

export default function AssistantPage() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [activeStep, setActiveStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome", role: "assistant", kind: "text",
      content: "Hi — I'm your Compliance Architect. I'll guide you through each regulatory dependency in order: SSM → HS Code → Permits → Digital Access → Docs → K2. Let's start with entity verification.",
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
      setCompleted((c) => new Set([...c, activeStep]));
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

  const handleSend = () => {
    if (!input.trim() || sending) return;
    setMessages((m) => [...m, { id: genId(), role: "user", kind: "text", content: input.trim() }]);
    setInput("");
    advance();
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* ── Top Nav (replaces the inline header from doc4) ── */}
      <TopNav />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px] xl:grid-cols-[260px_1fr_320px]">

          {/* LEFT: Trade Dependency Graph stepper */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-gradient-card p-4 shadow-soft-md">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Trade Dependency Graph</h2>
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
                        className={`relative flex w-full items-start gap-3 rounded-xl p-2 text-left transition-base ${
                          isActive ? "bg-primary-soft ring-1 ring-primary/30" :
                          isCompleted ? "hover:bg-secondary/60" :
                          "opacity-60 hover:opacity-80"
                        }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isCompleted ? "bg-success text-primary-foreground" :
                          isActive ? "bg-primary text-primary-foreground shadow-glow" :
                          "bg-secondary text-muted-foreground"
                        }`}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
                            isLocked ? <Lock className="h-3.5 w-3.5" /> :
                            <Icon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-muted-foreground">STEP {step.id}</span>
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
                        {!isDone && !isGenerating && blockingStep && (
                          <span className="shrink-0 rounded bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground" title={`Needs: ${blockingStep.title}`}>
                            S{blockingStep.id}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
                      Step {activeStep} · {STEPS[activeStep]?.title}
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
                  { label: "Goods Value", value: "RM 4,200" },
                  { label: "Estimated VAT", value: "RM 252" },
                  { label: "Estimated Shipping", value: "RM 180" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-l border-border pl-6">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-semibold text-foreground">RM 4,632</span>
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

              <div className="max-h-[640px] space-y-1 overflow-y-auto px-3 py-3">
                {readyDocs.length > 0 && (
                  <>
                    <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                      ✓ Ready to Generate
                    </div>
                    {readyDocs.map((doc) => {
                      const Icon = doc.icon;
                      const isGenerating = generatingId === doc.id;
                      const isGenerated = generatedIds.has(doc.id);
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-base hover:border-primary/30 hover:bg-primary-soft/30">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-soft">
                            <Icon className="h-3.5 w-3.5 text-success" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                            <div className="truncate text-[10px] text-muted-foreground">{doc.sublabel}</div>
                          </div>
                          <button
                            onClick={() => handleGenerate(doc.id)}
                            disabled={isGenerated || isGenerating}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-base ${
                              isGenerated
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
                            <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                            <div className="truncate text-[10px] text-warning">Complete: {missing.join(", ")}</div>
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
                      const missingCount = doc.requiredSteps.filter((sid) => !completed.has(sid)).length;
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2.5 opacity-50">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-muted-foreground">{doc.label}</div>
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

                {readyDocs.length > 1 && (
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
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-base ${
                      a.intent === "primary"
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