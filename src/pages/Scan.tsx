import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  UploadCloud, Mic, Sparkles, ScanLine, ArrowRight, RefreshCw,
  CheckCircle2, AlertTriangle, Image as ImageIcon, X, Loader2, Info
} from "lucide-react";

type ScanResult = {
  product: string;
  hsCode: string;
  confidence: "High" | "Medium" | "Low";
  status: "green" | "yellow" | "red";
  insights: { tone: "ok" | "warn" | "bad"; text: string }[];
};

const suggestions = [
  "Can this be exported?",
  "Restrictions for China?",
  "Required documents?",
  "What's the HS code?",
];

const Scan = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const runScan = () => {
    if (!file && !query) return;
    setScanning(true);
    setResult(null);
    setTimeout(() => {
      setResult({
        product: "Rattan Handbag",
        hsCode: "4602.19",
        confidence: "Medium",
        status: "green",
        insights: [
          { tone: "ok", text: "Export allowed from Malaysia" },
          { tone: "ok", text: "Import allowed in China" },
          { tone: "warn", text: "If contains leather, CITES permit may be required" },
        ],
      });
      setScanning(false);
    }, 1400);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setQuery("");
    setResult(null);
  };

  const continueToPlan = () => {
    if (!result) return;
    navigate("/assistant", {
      state: {
        from: "scan",
        product: result.product,
        hsCode: result.hsCode,
        confidence: result.confidence,
      },
    });
  };

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="mx-auto max-w-[1100px] px-6 py-10 lg:px-10 lg:py-14">
        {/* Header */}
        <section className="mb-8 text-center animate-fade-in-up">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-xs">
            <ScanLine className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">Agent 1 · Product Scanner</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground lg:text-[42px]">
            Scan Your Product
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground lg:text-base">
            Check if your product can be sold globally.
          </p>
        </section>

        {/* Upload + query card */}
        <section className="rounded-2xl border border-border bg-gradient-card p-5 shadow-soft-md lg:p-7 animate-fade-in-up">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-card/60 px-6 py-12 text-center transition-base ${
              dragOver
                ? "border-primary bg-primary-soft"
                : "border-border hover:border-primary/50 hover:bg-primary-soft/40"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Product preview"
                  className="mx-auto max-h-56 rounded-xl object-contain shadow-soft-md"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
                  title="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {file?.name}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-glow">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Drop a product photo here
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  or <span className="font-medium text-primary">browse files</span> · PNG, JPG up to 10MB
                </p>
              </>
            )}
          </div>

          {/* Query row */}
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-xs focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-base">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Can I sell this bag to China?"
              className="flex-1 bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-base"
              title="Voice input"
            >
              <Mic className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={runScan}
              disabled={scanning || (!file && !query)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-base hover:bg-primary/90 disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" />
                  Scan
                </>
              )}
            </button>
          </div>

          {/* Suggestion chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Try
            </span>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-base hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Result */}
        {scanning && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground animate-fade-in-up">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Analyzing image, classifying HS code, cross-checking trade rules…
          </div>
        )}

        {result && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg animate-fade-in-up">
            <div className="flex flex-col gap-4 border-b border-border bg-gradient-card p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                {preview && (
                  <img
                    src={preview}
                    alt={result.product}
                    className="h-16 w-16 rounded-xl object-cover shadow-soft-sm"
                  />
                )}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Scan Result
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    {result.product}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
                      HS Code: {result.hsCode}
                    </span>
                    <span className="rounded-md bg-warning-soft px-2 py-0.5 font-medium text-warning">
                      Confidence: {result.confidence}
                    </span>
                  </div>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Green Light · Exportable
              </span>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Insights
                </div>
                <ul className="mt-3 space-y-2.5">
                  {result.insights.map((ins, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${
                        ins.tone === "ok"
                          ? "border-success/20 bg-success-soft/60 text-foreground"
                          : ins.tone === "warn"
                          ? "border-warning/30 bg-warning-soft/60 text-foreground"
                          : "border-destructive/20 bg-[hsl(var(--error-soft))] text-foreground"
                      }`}
                    >
                      {ins.tone === "ok" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : ins.tone === "warn" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <span className="leading-relaxed">{ins.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-gradient-card p-4 lg:w-64">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick stats
                </div>
                <div className="mt-3 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Origin</span>
                    <span className="font-medium text-foreground">🇲🇾 Malaysia</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Suggested market</span>
                    <span className="font-medium text-foreground">🇨🇳 China</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tariff under FTA</span>
                    <span className="font-medium text-success">0%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col items-stretch gap-3 border-t border-border bg-gradient-card px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-[12px] text-muted-foreground sm:max-w-md">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Continue to step-by-step export planning with your product data pre-filled.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-base hover:bg-secondary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Scan Another Product
                </button>
                <button
                  onClick={continueToPlan}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-base hover:bg-primary/90"
                >
                  Plan Export
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Scan;
