import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import { generateDocuments, type CarriedDocument, type DocumentGenerationResponse } from "@/lib/api";
import { ArrowRight, AlertTriangle, CheckCircle2, ClipboardList, FileText, Loader2, Sparkles, Truck } from "lucide-react";

type RouteState = {
  product?: string;
  hsCode?: string;
  confidence?: string;
  destinationCountry?: string;
  carriedDocs?: CarriedDocument[];
};

const fallbackState = {
  product: "Sample export product",
  destinationCountry: "China",
  hsCode: "0000.00",
  confidence: "Medium",
};

export default function DocumentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state ?? {}) as RouteState;
  const [result, setResult] = useState<DocumentGenerationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const product = routeState.product || fallbackState.product;
  const destinationCountry = routeState.destinationCountry || fallbackState.destinationCountry;
  const hsCode = routeState.hsCode || fallbackState.hsCode;
  const confidence = routeState.confidence || fallbackState.confidence;
  const existingDocuments = useMemo(
    () => (routeState.carriedDocs || []).map((doc) => doc.label),
    [routeState.carriedDocs]
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await generateDocuments({
          product_name: product,
          destination_country: destinationCountry,
          hs_code: hsCode,
          compliance_status: "review",
          required_documents: ["Commercial invoice", "Packing list"],
          required_permits: [],
          required_agencies: [],
          existing_documents: existingDocuments,
          transport_mode: "sea",
          declared_value: 1000,
          weight_kg: 10,
          currency: "USD",
          package_count: 1,
        });
        if (active) {
          setResult(payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to generate documents");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [destinationCountry, existingDocuments, hsCode, product]);

  const carriedDocs = result?.carried_documents.map((doc) => ({
    id: doc.id,
    label: doc.label,
    sublabel: doc.sublabel,
    status: doc.status,
  })) || routeState.carriedDocs || [];

  const proceed = () => {
    if (!result) return;
    navigate("/logistics", {
      state: {
        carriedDocs,
        costContext: result.cost_context,
        product: result.product_name,
        hsCode: result.hs_code,
        destinationCountry: result.destination_country,
        transportMode: result.cost_context.transport_mode,
      },
    });
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <TopNav />

      <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-soft px-2.5 py-1">
              <ClipboardList className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">Agent 2 · Document Generator</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Generate the export pack</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Product: {product} · HS {hsCode} · Confidence {confidence} · Destination {destinationCountry}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Backend</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">POST /api/v1/documents/generate</div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-sm">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Generating document checklist from Agent 2...
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <div className="font-semibold text-warning">Document generator error</div>
                <div className="mt-1 text-muted-foreground">{error}</div>
              </div>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="rounded-2xl border border-border bg-gradient-card p-6 shadow-soft-md">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Document Pack</div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{result.summary}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${result.can_proceed_to_cost ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                  {result.can_proceed_to_cost ? "Ready for Agent 3" : "Needs Review"}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {result.documents.map((doc) => (
                  <div key={doc.id} className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{doc.label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{doc.sublabel}</div>
                      </div>
                      {doc.status === "ready" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      )}
                    </div>
                    <div className="mt-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {doc.status}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow Steps</div>
                <ol className="mt-3 space-y-3">
                  {result.workflow_steps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {index + 1}
                      </div>
                      <span className="text-sm text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-soft-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Agent 2 output
                </div>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Required permits</div>
                    <div className="mt-1 text-foreground">{result.required_permits.length ? result.required_permits.join(", ") : "None flagged"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Agencies</div>
                    <div className="mt-1 text-foreground">{result.required_agencies.length ? result.required_agencies.join(", ") : "Customs only"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Missing docs</div>
                    <div className="mt-1 text-foreground">{result.missing_documents.length ? result.missing_documents.join(", ") : "None"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Truck className="h-4 w-4 text-accent" />
                  Cost handoff
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  We pass the generated pack to Agent 3 so shipping, tax, and landed cost can be calculated from the same context.
                </div>
                <button
                  onClick={proceed}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-base hover:bg-primary/90"
                >
                  Continue to Agent 3
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}