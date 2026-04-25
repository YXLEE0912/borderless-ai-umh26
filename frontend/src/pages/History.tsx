import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { getScan, listScans, type BackendScanHistoryItem, type BackendScanReadResponse } from "@/lib/api";
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  FileText,
  History as HistoryIcon,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const statusMeta = {
  green: {
    label: "Allowed",
    className: "bg-success-soft text-success border-success/20",
    icon: CheckCircle2,
  },
  conditional: {
    label: "Conditional",
    className: "bg-warning-soft text-warning border-warning/30",
    icon: AlertTriangle,
  },
  restricted: {
    label: "Restricted",
    className: "bg-[hsl(var(--error-soft))] text-destructive border-destructive/20",
    icon: ShieldAlert,
  },
  review: {
    label: "Under review",
    className: "bg-secondary text-foreground border-border",
    icon: HistoryIcon,
  },
} as const;

const formatTimestamp = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-MY", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<BackendScanHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<BackendScanReadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const loadHistory = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const nextItems = await listScans(50);
      setItems(nextItems);
      setSelectedId((current) => current || nextItems[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scan history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadScanDetail = async (scanId: string) => {
    setDetailLoading(true);
    try {
      const record = await getScan(scanId);
      setSelectedScan(record);
    } catch {
      setSelectedScan(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedScan(null);
      return;
    }
    void loadScanDetail(selectedId);
  }, [selectedId]);

  const detail = selectedScan ?? null;
  const activeItem = selectedItem || (detail ? items.find((item) => item.id === detail.id) || null : null);
  const activeStatus = (detail?.result.status || activeItem?.status || "review") as keyof typeof statusMeta;
  const status = statusMeta[activeStatus] || statusMeta.review;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1">
              <HistoryIcon className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Decision log</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Scan History</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review prior trade decisions, compare scans, and reopen any record.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void loadHistory()} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button asChild>
              <Link to="/scan">
                New Scan
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-destructive/20 bg-[hsl(var(--error-soft))] px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft-sm lg:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Recent scans</h2>
                <p className="text-sm text-muted-foreground">Each card is a decision record, not a chat transcript.</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {items.length} records
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-secondary/40" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 px-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">No scans yet</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Run a scan first and it will show up here as a compact compliance record.
                </p>
                <Button asChild className="mt-5">
                  <Link to="/scan">Start a scan</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const isSelected = item.id === selectedId;
                  const itemStatus = statusMeta[item.status] || statusMeta.review;
                  const ItemIcon = itemStatus.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-base ${
                        isSelected
                          ? "border-primary/40 bg-primary-soft/30 shadow-soft-sm"
                          : "border-border bg-background hover:border-primary/30 hover:bg-primary-soft/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${itemStatus.className}`}>
                              <ItemIcon className="h-3 w-3" />
                              {itemStatus.label}
                            </span>
                            {item.destination_country && (
                              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                                {item.destination_country}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-2 line-clamp-1 text-base font-semibold text-foreground">
                            {item.product_name || item.prompt || "Untitled scan"}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {item.compliance_summary || item.prompt}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                          HS {item.hs_code || "--"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatTimestamp(item.created_at)}
                        </div>
                        <div className="flex items-center gap-1.5 text-primary">
                          Open details <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm lg:sticky lg:top-24 lg:self-start">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Scan details</h2>
                <p className="text-sm text-muted-foreground">Open any record to inspect the saved decision output.</p>
              </div>
              {detailLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>

            {!selectedItem ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 px-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Select a scan</h3>
                <p className="mt-2 text-sm text-muted-foreground">Pick any history item to view its saved result and metadata.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-2xl border px-4 py-4 ${status.className}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Current decision</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {detail?.result.product_name || selectedItem.product_name || selectedItem.prompt || "Untitled scan"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium">
                        <span className="rounded-full bg-background/70 px-2.5 py-1 text-foreground">
                          HS {detail?.result.hs_code_candidates?.[0] || selectedItem.hs_code || "--"}
                        </span>
                        {selectedItem.destination_country && (
                          <span className="rounded-full bg-background/70 px-2.5 py-1 text-foreground">
                            {selectedItem.destination_country}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-background/50 bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-border bg-secondary/20 p-4 text-sm">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prompt</div>
                    <div className="mt-1 text-foreground">{selectedItem.prompt || "No prompt saved."}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</div>
                    <div className="mt-1 text-foreground">
                      {detail?.result.compliance_summary || selectedItem.compliance_summary || "No summary stored."}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{formatTimestamp(selectedItem.created_at)}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Destination</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{selectedItem.destination_country || "Not set"}</div>
                  </div>
                </div>

                {selectedItem.image_asset && (
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Image asset
                    </div>
                    <a
                      href={selectedItem.image_asset}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      Open uploaded image <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}

                {detail?.result.rule_hits?.length ? (
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rule hits</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {detail.result.rule_hits.map((rule) => (
                        <span key={rule} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground">
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(detail?.result.required_documents?.length || detail?.result.required_permits?.length || detail?.result.required_agencies?.length) ? (
                  <div className="grid gap-3 rounded-2xl border border-border bg-background/60 p-4 text-sm">
                    {!!detail?.result.required_documents?.length && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Required documents</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {detail.result.required_documents.map((item) => (
                            <span key={item} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!!detail?.result.required_permits?.length && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Required permits</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {detail.result.required_permits.map((item) => (
                            <span key={item} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!!detail?.result.required_agencies?.length && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Required agencies</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {detail.result.required_agencies.map((item) => (
                            <span key={item} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild variant="outline">
                    <Link to="/scan">Run another scan</Link>
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/logistics")}>Go to logistics</Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default HistoryPage;