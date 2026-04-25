import { useState } from "react";
import TopNav from "@/components/TopNav";
import {
  Upload, FileText, FileCheck2, FileSpreadsheet, CheckCircle2,
  Plane, Ship, ArrowRight, Sparkles, TrendingDown, Info,
  Clock, Leaf, Shield
} from "lucide-react";

type DocStatus = "uploaded" | "uploading" | "missing";

const docs: { id: string; title: string; subtitle: string; icon: React.ElementType; status: DocStatus; size?: string; optional?: boolean }[] = [
  { id: "ci", title: "Commercial Invoice", subtitle: "Required", icon: FileText, status: "uploaded", size: "245 KB · PDF" },
  { id: "pl", title: "Packing List", subtitle: "Required", icon: FileSpreadsheet, status: "uploading", size: "Parsing…" },
  { id: "co", title: "Certificate of Origin", subtitle: "Optional · Boosts savings", icon: FileCheck2, status: "missing", optional: true },
];

const breakdown = [
  { label: "Goods Value", value: 4200 },
  { label: "Import Duty", value: 0, note: "Waived" },
  { label: "VAT / GST", value: 294 },
  { label: "Shipping Fee", value: 180 },
  { label: "Service Fee", value: 49 },
];

const Logistics = () => {
  const [shipping, setShipping] = useState<"air" | "sea">("air");
  const total = breakdown.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        {/* Page header */}
        <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-soft px-2.5 py-1">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">Logistics & Tax Executor</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Finalize your shipment</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">Upload documents, confirm landed cost, and book freight.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs shadow-xs">
              <div className="text-muted-foreground">Shipment ID</div>
              <div className="font-mono text-[13px] font-semibold text-foreground">SHP-MYS-00481</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {/* SECTION 1: Upload */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Upload Shipping Documents</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Drag & drop or click to upload. AI will parse fields.</p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">2 / 3</span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {docs.map((doc) => {
                  const Icon = doc.icon;
                  const isUploaded = doc.status === "uploaded";
                  const isUploading = doc.status === "uploading";
                  const isMissing = doc.status === "missing";
                  return (
                    <div
                      key={doc.id}
                      className={`group relative overflow-hidden rounded-2xl border-2 border-dashed p-5 transition-base ${
                        isUploaded ? "border-success/40 bg-success-soft/40" :
                        isUploading ? "border-primary/40 bg-primary-soft/40" :
                        "border-border bg-secondary/30 hover:border-primary/40 hover:bg-primary-soft/30 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                          isUploaded ? "bg-success text-success-foreground" :
                          isUploading ? "bg-primary text-primary-foreground" :
                          "bg-card text-muted-foreground"
                        }`}>
                          {isUploaded ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        {doc.optional && (
                          <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
                            Optional
                          </span>
                        )}
                      </div>
                      <div className="mt-4">
                        <div className="text-sm font-semibold text-foreground">{doc.title}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">{doc.subtitle}</div>
                      </div>

                      {isUploaded && (
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-card/60 px-2.5 py-1.5 text-[11px]">
                          <span className="font-medium text-foreground">{doc.size}</span>
                          <span className="font-semibold text-success">Verified</span>
                        </div>
                      )}
                      {isUploading && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[11px] text-foreground">
                            <span className="font-medium">{doc.size}</span>
                            <span className="font-semibold text-primary">68%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full w-[68%] rounded-full bg-gradient-primary" />
                          </div>
                        </div>
                      )}
                      {isMissing && (
                        <button className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground transition-base hover:border-primary hover:text-primary">
                          <Upload className="h-3.5 w-3.5" /> Drop file or browse
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 2: Cost Breakdown */}
            <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-7 shadow-soft-md">
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Final Calculation</div>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Final Landed Cost</h2>
                  </div>
                  <div className="hidden items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-success md:inline-flex">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-[12px] font-semibold">Duty waived under ATIGA</span>
                  </div>
                </div>

                {/* Savings banner */}
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-success/20 bg-success-soft px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success text-success-foreground">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-success">✅ Duty waived under trade agreement</div>
                    <div className="mt-0.5 text-[12px] text-success/80">
                      You save <strong className="font-semibold">RM 420</strong> via ATIGA Form D (Singapore).
                    </div>
                  </div>
                  <Info className="h-4 w-4 text-success/60" />
                </div>

                {/* Breakdown rows */}
                <div className="mt-6 divide-y divide-border">
                  {breakdown.map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-muted-foreground">{row.label}</span>
                        {row.note && (
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                            {row.note}
                          </span>
                        )}
                      </div>
                      <span className={`text-[15px] font-medium tabular-nums ${
                        row.value === 0 ? "text-success line-through decoration-success/40" : "text-foreground"
                      }`}>
                        RM {row.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-4 flex items-end justify-between rounded-2xl bg-foreground p-6 text-background">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-background/60">Total landed cost</div>
                    <div className="mt-1 text-[12px] text-background/70">All taxes & fees included</div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-semibold tracking-tight tabular-nums lg:text-5xl">
                      RM {total.toLocaleString()}
                    </div>
                    <div className="mt-1 text-[11px] text-background/60">≈ USD {(total / 4.7).toFixed(0)} · ≈ SGD {(total / 3.45).toFixed(0)}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: Shipping Options */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Choose Shipping</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Pick the option that fits your timeline.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Air Freight */}
                <button
                  onClick={() => setShipping("air")}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-card p-6 text-left shadow-soft-sm transition-smooth hover:-translate-y-0.5 hover:shadow-soft-lg ${
                    shipping === "air" ? "border-primary ring-4 ring-primary/10" : "border-border"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
                  <div className="relative flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Plane className="h-6 w-6" />
                    </div>
                    {shipping === "air" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
                        <CheckCircle2 className="h-3 w-3" /> SELECTED
                      </span>
                    )}
                  </div>

                  <div className="relative mt-5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Express</div>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Air Freight</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      3–5 business days
                    </div>
                  </div>

                  <div className="relative mt-5 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Estimated cost</div>
                      <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">RM 480</div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" /> Insured
                    </div>
                  </div>

                  <div className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-base group-hover:bg-primary/90">
                    Book Air Shipping <ArrowRight className="h-4 w-4" />
                  </div>
                </button>

                {/* Sea Freight */}
                <button
                  onClick={() => setShipping("sea")}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-card p-6 text-left shadow-soft-sm transition-smooth hover:-translate-y-0.5 hover:shadow-soft-lg ${
                    shipping === "sea" ? "border-accent ring-4 ring-accent/10" : "border-border"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/10 blur-2xl" />
                  <div className="relative flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Ship className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">
                      <Leaf className="h-3 w-3" /> ECO · −62% CO₂
                    </span>
                  </div>

                  <div className="relative mt-5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Economy</div>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Sea Freight</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      14–21 business days
                    </div>
                  </div>

                  <div className="relative mt-5 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Estimated cost</div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">RM 180</div>
                        <span className="text-[11px] font-semibold text-success">Save RM 300</span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" /> Insured
                    </div>
                  </div>

                  <div className={`relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-base ${
                    shipping === "sea"
                      ? "bg-accent text-accent-foreground shadow-accent-glow group-hover:bg-accent/90"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  }`}>
                    Book Sea Shipping <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              </div>
            </section>
          </div>

          {/* Right rail summary */}
          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm">
              <h3 className="text-sm font-semibold text-foreground">Shipment summary</h3>
              <div className="mt-4 space-y-3 text-[13px]">
                {[
                  ["Route", "🇲🇾 KL → 🇸🇬 SG"],
                  ["Product", "Batik Silk Scarves"],
                  ["HS Code", "6214.10.0000"],
                  ["Weight", "12.4 kg"],
                  ["Incoterm", "DAP"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm">
              <h3 className="text-sm font-semibold text-foreground">Compliance status</h3>
              <div className="mt-4 space-y-2.5">
                {[
                  { label: "MITI permit", status: "Completed" },
                  { label: "ATIGA Form D", status: "Completed" },
                  { label: "Destination compliance", status: "Pending" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[13px] text-foreground">{row.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.status === "Completed" ? "bg-success-soft text-success" :
                      row.status === "Pending" ? "bg-warning-soft text-warning" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-5 text-primary-foreground shadow-glow">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <Sparkles className="h-5 w-5" />
                <p className="mt-3 text-[13px] leading-relaxed">
                  Need a human? Our trade specialists review every shipment ≥ RM 10K free of charge.
                </p>
                <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-medium backdrop-blur transition-base hover:bg-white/25">
                  Talk to a specialist <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Logistics;
