import { useState } from "react";
import { useLocation } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  Building2, Package, FileCheck2, Globe2, Award, Truck, FileSearch,
  CheckCircle2, Sparkles, Paperclip, Mic, ArrowUp,
  TrendingDown, Info, ChevronDown
} from "lucide-react";

type StepStatus = "completed" | "active" | "pending";

type ScanState = {
  from?: string;
  product?: string;
  hsCode?: string;
  confidence?: string;
};

const baseSteps = [
  { id: 1, title: "Business Identity", subtitle: "SSM Verification", icon: Building2 },
  { id: 2, title: "Product Details", subtitle: "HS Code & specs", icon: Package },
  { id: 3, title: "Export Permits", subtitle: "MITI / SIRIM", icon: FileCheck2 },
  { id: 4, title: "Destination Compliance", subtitle: "Target market rules", icon: Globe2 },
  { id: 5, title: "Origin Certification", subtitle: "ATIGA / FTA", icon: Award },
  { id: 6, title: "Logistics Readiness", subtitle: "Packaging & labels", icon: Truck },
  { id: 7, title: "Pre-Clearance Report", subtitle: "Final review", icon: FileSearch },
];

const Assistant = () => {
  const location = useLocation();
  const scan = (location.state ?? {}) as ScanState;
  const fromScan = scan.from === "scan";

  // When arriving from a scan: only Product Details is pre-filled (completed),
  // and we start at Business Identity (SSM). Otherwise, original demo state.
  const steps = baseSteps.map((s) => {
    let status: StepStatus = "pending";
    if (fromScan) {
      if (s.id === 2) status = "completed";
      else if (s.id === 1) status = "active";
    } else {
      if (s.id === 1 || s.id === 2) status = "completed";
      else if (s.id === 3) status = "active";
    }
    return { ...s, status };
  });

  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length;
  const progress = Math.round((completed / total) * 100);

  const [selected, setSelected] = useState<"yes" | "no" | null>(null);
  const [material, setMaterial] = useState("Select material…");

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-soft px-2.5 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Compliance Architect</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">AI Export Assistant</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">Guided compliance workflow</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-success" />
            Auto-saved · 12s ago
          </div>
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* LEFT — Stepper */}
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Export Roadmap</h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
                {completed}/{total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Overall progress</span>
                <span className="font-semibold text-foreground">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-primary transition-smooth"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            <ol className="relative mt-6 space-y-1">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = step.status === "active";
                const isCompleted = step.status === "completed";
                const isLast = idx === steps.length - 1;

                return (
                  <li key={step.id} className="relative">
                    {/* connector */}
                    {!isLast && (
                      <span
                        className={`absolute left-[18px] top-10 h-[calc(100%-12px)] w-[2px] ${
                          isCompleted ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}
                    <button
                      className={`relative flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-base ${
                        isActive ? "bg-primary-soft ring-1 ring-primary/20" : "hover:bg-secondary/60"
                      }`}
                    >
                      <div
                        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-base ${
                          isCompleted
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : isActive
                            ? "bg-card text-primary ring-2 ring-primary"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : isActive ? (
                          <Icon className="h-4 w-4" />
                        ) : (
                          <span>{step.id}</span>
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <div className={`text-[13px] font-semibold leading-tight ${
                          isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {step.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{step.subtitle}</div>
                      </div>
                      {isActive && (
                        <span className="ml-auto mt-1 inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                          Now
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* RIGHT — Chat + floating cost */}
          <div className="relative grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
            {/* Chat card */}
            <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft-md">
              {/* Chat header */}
              <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Architect AI</div>
                    <div className="text-[11px] text-muted-foreground">
                      {fromScan ? "Step 1 · Business Identity" : "Step 3 · Export Permits"}
                    </div>
                  </div>
                </div>
                <button className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-base">
                  History
                </button>
              </header>

              {/* Messages */}
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
                {fromScan && (
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Imported from Scan · {scan.product} · HS {scan.hsCode}
                    </div>
                  </div>
                )}

                {/* AI bubble — opening */}
                <div className="flex items-start gap-3 animate-fade-in-up">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-[14px] leading-relaxed text-foreground">
                      {fromScan ? (
                        <>
                          I've analyzed your product: <strong>{scan.product}</strong> (HS Code: <strong>{scan.hsCode}</strong>).
                          <br />
                          Let's get your export ready step-by-step.
                          <br />
                          First, I need to confirm: <strong>Is your business registered with SSM?</strong>
                        </>
                      ) : (
                        <>Great — your business identity and product details are confirmed ✅. Let's check eligibility for tariff reductions under ATIGA.</>
                      )}
                    </div>
                    <div className="mt-1 px-1 text-[10px] text-muted-foreground">Architect AI · just now</div>
                  </div>
                </div>

                {!fromScan && (
                  <div className="flex items-start justify-end gap-3 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
                    <div className="max-w-[75%]">
                      <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-[14px] leading-relaxed text-primary-foreground">
                        Yes, please continue — exporting to Singapore.
                      </div>
                      <div className="mt-1 px-1 text-right text-[10px] text-muted-foreground">You · 10:42</div>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-semibold text-primary-foreground">
                      AR
                    </div>
                  </div>
                )}

                {/* AI question with selectable buttons */}
                <div className="flex items-start gap-3 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="max-w-[80%] space-y-3">
                    <div className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-[14px] leading-relaxed text-foreground">
                      {fromScan ? (
                        <>Quick check — <strong>is your business SSM-registered</strong> and active? This determines which export permits you can apply for.</>
                      ) : (
                        <>Is your product <strong>100% made in Malaysia</strong>? This affects your eligibility for tariff reduction.</>
                      )}
                    </div>

                    {/* Selectable buttons */}
                    <div className="flex gap-2">
                      {(["yes", "no"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setSelected(v)}
                          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-base ${
                            selected === v
                              ? "border-primary bg-primary text-primary-foreground shadow-glow"
                              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft"
                          }`}
                        >
                          {v === "yes" ? "✓ Yes, fully local" : "✕ No, has imports"}
                        </button>
                      ))}
                    </div>

                    {/* Dropdown */}
                    <div className="rounded-2xl border border-border bg-card p-3.5">
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Primary material
                      </label>
                      <button className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-base">
                        <span className={material === "Select material…" ? "text-muted-foreground" : ""}>{material}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {["Cotton 100%", "Silk blend", "Polyester", "Wool", "Linen"].map((m) => (
                          <button
                            key={m}
                            onClick={() => setMaterial(m)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-base ${
                              material === m
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:bg-primary-soft hover:text-primary"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-border bg-gradient-card p-4">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-xs focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-base">
                  <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-base" title="Upload file">
                    <Paperclip className="h-[18px] w-[18px]" />
                  </button>
                  <textarea
                    rows={1}
                    placeholder="Type or upload documents…"
                    className="max-h-32 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-base" title="Voice input">
                    <Mic className="h-[18px] w-[18px]" />
                  </button>
                  <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow transition-base hover:bg-primary/90">
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                  <span>Architect AI may request supporting documents.</span>
                  <span>⌘ + ↵ to send</span>
                </div>
              </div>
            </section>

            {/* Floating Estimated Cost */}
            <aside className="xl:sticky xl:top-20 xl:self-start">
              <div className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft-md">
                <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated</div>
                    <div className="text-sm font-semibold text-foreground">Landed Cost</div>
                  </div>
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
                    Not Final
                  </span>
                </div>

                <div className="space-y-3 px-4 py-4">
                  {[
                    { label: "Goods Value", value: "RM 4,200" },
                    { label: "Estimated VAT", value: "RM 252" },
                    { label: "Estimated Shipping", value: "RM 180" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground">{row.label}</span>
                      <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                    </div>
                  ))}

                  <div className="my-2 border-t border-dashed border-border" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Total</span>
                    <span className="text-lg font-semibold tracking-tight text-foreground">RM 4,632</span>
                  </div>

                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-success-soft p-2.5">
                    <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <p className="text-[11px] leading-relaxed text-success">
                      Potential <strong>RM 320 saved</strong> if ATIGA Form D is filed.
                    </p>
                  </div>

                  <div className="flex items-start gap-2 px-1 pt-1 text-[10px] text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    Estimates update as you complete each step.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Assistant;
