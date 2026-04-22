import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  Upload, FileText, FileCheck2, FileSpreadsheet, CheckCircle2,
  Plane, Ship, ArrowRight, Sparkles, TrendingDown, Info,
  Clock, Leaf, Shield, ClipboardList, ShieldCheck, Stamp,
  X, Loader2, Download
} from "lucide-react";

type DocStatus = "carried" | "uploaded" | "uploading" | "missing";

type LogisticsState = {
  carriedDocs?: { id: string; label: string; sublabel: string; status: string }[];
};

type ShipDoc = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  status: DocStatus;
  size?: string;
  optional?: boolean;
  fileName?: string;
};

const ALL_DOC_DEFS: Omit<ShipDoc, "status" | "size" | "fileName">[] = [
  { id: "commercial-invoice", title: "Commercial Invoice", subtitle: "Buyer & seller details, goods value", icon: FileText, optional: false },
  { id: "packing-list", title: "Packing List", subtitle: "Item weights, dimensions & quantities", icon: FileSpreadsheet, optional: false },
  { id: "bol", title: "Bill of Lading / Air Waybill", subtitle: "Carrier & routing information", icon: Ship, optional: false },
  { id: "k2", title: "K2 Declaration Form", subtitle: "Customs export declaration", icon: ClipboardList, optional: false },
  { id: "coo", title: "Certificate of Origin", subtitle: "ATIGA / FTA Form D", icon: Stamp, optional: true },
  { id: "sirim", title: "SIRIM Certificate", subtitle: "Standards & quality compliance", icon: ShieldCheck, optional: true },
  { id: "halal", title: "Halal Certificate", subtitle: "JAKIM-recognised certification", icon: Leaf, optional: true },
];

const breakdown = [
  { label: "Goods Value",    value: 4200, note: null,    waived: false },
  { label: "Import Duty",    value: 0,    note: "Waived — ATIGA Form D", waived: true },
  { label: "VAT / GST (7%)", value: 294,  note: null,    waived: false },
  { label: "Shipping Fee",   value: 180,  note: "Air freight, insured", waived: false },
  { label: "Service Fee",    value: 49,   note: "Borderless AI platform", waived: false },
];

// ── PDF generation (client-side via HTML → print) ──────────────────────
const generateAndDownloadPDF = (docs: ShipDoc[], shipping: "air" | "sea") => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  const total = breakdown.reduce((s, r) => s + r.value, 0);
  const uploadedCount = docs.filter(d => d.status === "uploaded" || d.status === "carried").length;

  const docStatusRows = docs.map(d => {
    const statusLabel = d.status === "carried" ? "Carried" : d.status === "uploaded" ? "Uploaded" : d.status === "uploading" ? "Parsing" : d.optional ? "Optional" : "Missing";
    const statusColor = (d.status === "carried" || d.status === "uploaded") ? "#059669" : d.status === "uploading" ? "#2563EB" : d.optional ? "#6B7280" : "#D97706";
    const statusBg = (d.status === "carried" || d.status === "uploaded") ? "#ECFDF5" : d.status === "uploading" ? "#EFF6FF" : d.optional ? "#F3F4F6" : "#FFFBEB";
    return `
      <tr>
        <td style="padding:10px 12px;font-size:13px;color:#111827;font-weight:600;">${d.title}</td>
        <td style="padding:10px 12px;font-size:12px;color:#6B7280;">${d.subtitle}</td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="background:${statusBg};color:${statusColor};font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;">${statusLabel}</span>
        </td>
      </tr>`;
  }).join("");

  const breakdownRows = breakdown.map(r => `
    <tr style="${r.waived ? "background:#ECFDF5;" : ""}">
      <td style="padding:11px 14px;font-size:13px;color:#111827;font-weight:600;">${r.label}</td>
      <td style="padding:11px 14px;font-size:12px;color:#6B7280;">${r.note || "—"}</td>
      <td style="padding:11px 14px;text-align:right;font-size:13px;font-weight:700;color:${r.waived ? "#059669" : "#111827"};">
        ${r.waived ? `RM 0 <span style="font-size:10px;font-weight:600;">(saved RM 420)</span>` : `RM ${r.value.toLocaleString()}`}
      </td>
    </tr>`).join("");

  const complianceItems = [
    { title: "Business Registration (SSM)", note: "Active · Reg No. 202301234567", done: true },
    { title: "MITI Export Permit", note: "Approved — valid 90 days", done: true },
    { title: "ATIGA Form D (FTA)", note: "Tariff reduction applied", done: true },
    { title: "Destination Compliance (SG)", note: "No restrictions", done: true },
    { title: "Logistics Readiness", note: "Packaging & labelling checked", done: true },
    { title: "Pre-Clearance Report", note: "Pending final sign-off", done: false },
  ];

  const complianceCards = complianceItems.map(c => `
    <div style="background:${c.done ? "#ECFDF5" : "#FFFBEB"};border-left:3px solid ${c.done ? "#059669" : "#D97706"};border-radius:6px;padding:12px 14px;flex:1;min-width:160px;">
      <div style="font-size:10px;font-weight:700;color:${c.done ? "#059669" : "#D97706"};letter-spacing:0.5px;margin-bottom:4px;">${c.done ? "✓  COMPLETED" : "◷  PENDING"}</div>
      <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:3px;">${c.title}</div>
      <div style="font-size:11px;color:#6B7280;">${c.note}</div>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Export Summary — SHP-MYS-00481</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#fff; color:#111827; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display:none; }
      @page { margin: 14mm 16mm; }
    }
    .page { max-width:820px; margin:0 auto; padding:32px; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; }
    .section-label { font-size:9px;font-weight:700;color:#2563EB;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px; }
    .section-title { font-size:15px;font-weight:700;color:#111827;margin-bottom:10px; }
    hr { border:none;border-top:1px solid #E5E7EB;margin-bottom:12px; }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="background:#0F172A;border-radius:10px;padding:28px 32px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:9px;font-weight:700;color:#93C5FD;letter-spacing:2px;margin-bottom:8px;">BORDERLESS AI</div>
      <div style="font-size:24px;font-weight:700;color:#fff;margin-bottom:5px;">Export Shipment Summary</div>
      <div style="font-size:12px;color:#BFDBFE;">Official trade documentation &amp; tax summary</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;font-weight:700;color:#93C5FD;letter-spacing:1px;margin-bottom:5px;">SHIPMENT ID</div>
      <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px;">SHP-MYS-00481</div>
      <div style="font-size:11px;color:#BFDBFE;">Generated ${dateStr}, ${timeStr}</div>
    </div>
  </div>

  <!-- SHIPMENT DETAILS -->
  <div class="section-label">Shipment Details</div>
  <hr/>
  <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
    ${[
      ["Exporter", "Aiman Trading Sdn Bhd"],
      ["Route", "🇲🇾 Malaysia (KL) → 🇸🇬 Singapore"],
      ["Product", "Batik Silk Scarves"],
      ["HS Code", "6214.10.0000"],
      ["Incoterm", "DAP — Delivered at Place"],
      ["Gross Weight", "12.4 kg"],
    ].map(([k, v]) => `
      <div style="background:#F3F4F6;border-radius:6px;padding:10px 14px;flex:1;min-width:160px;">
        <div style="font-size:10px;color:#6B7280;margin-bottom:3px;">${k}</div>
        <div style="font-size:13px;font-weight:700;color:#111827;">${v}</div>
      </div>`).join("")}
  </div>

  <!-- TAX BREAKDOWN -->
  <div class="section-label">Tax &amp; Cost Breakdown</div>
  <hr/>
  <table style="margin-bottom:10px;">
    <thead>
      <tr style="background:#F3F4F6;">
        <th style="padding:9px 14px;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:0.5px;width:30%;">DESCRIPTION</th>
        <th style="padding:9px 14px;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:0.5px;width:45%;">NOTE</th>
        <th style="padding:9px 14px;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-align:right;width:25%;">AMOUNT (RM)</th>
      </tr>
    </thead>
    <tbody>${breakdownRows}</tbody>
  </table>

  <!-- Savings banner -->
  <div style="background:#ECFDF5;border-left:3px solid #059669;border-radius:6px;padding:11px 16px;margin-bottom:10px;font-size:12px;font-weight:700;color:#059669;">
    ✓  Duty waived under ATIGA trade agreement — You save RM 420 on this shipment
  </div>

  <!-- Total bar -->
  <div style="background:#0F172A;border-radius:8px;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
    <div>
      <div style="font-size:9px;font-weight:700;color:#93C5FD;letter-spacing:1.2px;margin-bottom:5px;">TOTAL LANDED COST</div>
      <div style="font-size:11px;color:#BFDBFE;">All taxes &amp; fees included</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:30px;font-weight:700;color:#fff;">RM ${total.toLocaleString()}</div>
      <div style="font-size:11px;color:#93C5FD;margin-top:3px;">approx. USD ${(total/4.7).toFixed(0)} · approx. SGD ${(total/3.45).toFixed(0)}</div>
    </div>
  </div>

  <!-- DOCUMENTS -->
  <div class="section-label">Export Documents</div>
  <hr/>
  <table style="margin-bottom:20px;">
    <thead>
      <tr style="background:#F3F4F6;">
        <th style="padding:9px 12px;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:0.5px;width:38%;">DOCUMENT</th>
        <th style="padding:9px 12px;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:0.5px;width:44%;">NOTE</th>
        <th style="padding:9px 12px;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-align:center;width:18%;">STATUS</th>
      </tr>
    </thead>
    <tbody>${docStatusRows}</tbody>
  </table>

  <!-- COMPLIANCE -->
  <div class="section-label">Compliance Status</div>
  <hr/>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px;">
    ${complianceCards}
  </div>

  <!-- SHIPPING -->
  <div class="section-label">Selected Shipping Method</div>
  <hr/>
  <div style="background:#EFF6FF;border-left:3px solid #2563EB;border-radius:8px;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
    <div>
      <div style="font-size:9px;font-weight:700;color:#2563EB;letter-spacing:1px;margin-bottom:5px;">${shipping === "air" ? "AIR FREIGHT" : "SEA FREIGHT"}</div>
      <div style="font-size:15px;font-weight:700;color:#0F172A;margin-bottom:4px;">${shipping === "air" ? "Express Delivery" : "Economy Shipping"}</div>
      <div style="font-size:12px;color:#6B7280;">${shipping === "air" ? "3–5 business days  ·  Insured  ·  Door to door" : "14–21 business days  ·  Insured  ·  ECO −62% CO₂"}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#6B7280;margin-bottom:4px;">SHIPPING COST</div>
      <div style="font-size:24px;font-weight:700;color:#0F172A;">${shipping === "air" ? "RM 480" : "RM 180"}</div>
      <div style="font-size:11px;font-weight:700;color:#2563EB;margin-top:3px;">✓  Selected</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #E5E7EB;padding-top:12px;text-align:center;font-size:10px;color:#9CA3AF;line-height:1.6;">
    This document was generated by Borderless AI on ${dateStr} at ${timeStr}.<br/>
    It is for informational purposes only and does not constitute official customs clearance.<br/>
    Shipment ID: SHP-MYS-00481 · borderless.ai
  </div>

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="margin-top:24px;text-align:center;">
    <button onclick="window.print()" style="background:#0F172A;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:14px;font-weight:600;cursor:pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => {
      setTimeout(() => win.print(), 500);
    };
  }
};

const Logistics = () => {
  const location = useLocation();
  const { carriedDocs = [] } = (location.state ?? {}) as LogisticsState;
  const carriedIds = new Set(carriedDocs.map((d) => d.id));

  const [docs, setDocs] = useState<ShipDoc[]>(
    ALL_DOC_DEFS.map((def) => {
      const carried = carriedIds.has(def.id);
      const carriedDoc = carriedDocs.find((d) => d.id === def.id);
      return {
        ...def,
        status: carried ? "carried" : "missing",
        size: carried ? "From AI Assistant" : undefined,
        fileName: carried ? carriedDoc?.label : undefined,
      };
    })
  );

  const [shipping, setShipping] = useState<"air" | "sea">("air");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadedCount = docs.filter((d) => d.status === "uploaded" || d.status === "carried").length;
  const hasAnyDoc = uploadedCount > 0;

  const handleFileSelect = (docId: string, file: File) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, status: "uploading", fileName: file.name, size: `${(file.size / 1024).toFixed(0)} KB` }
          : d
      )
    );
    setTimeout(() => {
      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: "uploaded" } : d))
      );
    }, 1800);
  };

  const handleRemove = (docId: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId && d.status !== "carried"
          ? { ...d, status: "missing", fileName: undefined, size: undefined }
          : d
      )
    );
  };

  const handleDrop = (docId: string, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(docId, file);
  };

  const handleDownloadSummary = () => {
    setGeneratingSummary(true);
    setTimeout(() => {
      setGeneratingSummary(false);
      generateAndDownloadPDF(docs, shipping);
    }, 800);
  };

  const total = breakdown.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        {/* Header */}
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

            {/* Carried docs banner */}
            {carriedIds.size > 0 && (
              <div className="flex items-start gap-4 rounded-2xl border border-success/25 bg-success-soft px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success text-success-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-success">
                    {carriedIds.size} document{carriedIds.size > 1 ? "s" : ""} carried over from AI Assistant
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {carriedDocs.map((d) => (
                      <span key={d.id} className="text-[11px] text-success/80">✓ {d.label}</span>
                    ))}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-success px-2.5 py-1 text-[10px] font-semibold text-success-foreground">Auto-filled</span>
              </div>
            )}

            {/* Section 1: Documents */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Export Documents</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Carried docs are pre-filled. Upload any missing ones.</p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  {uploadedCount} / {docs.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {docs.map((doc) => {
                  const Icon = doc.icon;
                  const isCarried = doc.status === "carried";
                  const isUploaded = doc.status === "uploaded";
                  const isUploading = doc.status === "uploading";
                  const isMissing = doc.status === "missing";
                  const isDone = isCarried || isUploaded;

                  return (
                    <div
                      key={doc.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => isMissing && handleDrop(doc.id, e)}
                      className={`group relative overflow-hidden rounded-2xl border-2 p-5 transition-base ${
                        isCarried ? "border-success/30 bg-success-soft/30" :
                        isUploaded ? "border-success/40 bg-success-soft/40" :
                        isUploading ? "border-primary/40 bg-primary-soft/40" :
                        "border-dashed border-border bg-secondary/30 hover:border-primary/40 hover:bg-primary-soft/30 cursor-pointer"
                      }`}
                      onClick={() => isMissing && fileInputRefs.current[doc.id]?.click()}
                    >
                      <input
                        ref={(el) => { fileInputRefs.current[doc.id] = el; }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                        className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(doc.id, file); }}
                      />

                      <div className="flex items-start justify-between">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                          isCarried ? "bg-success/20 text-success" :
                          isUploaded ? "bg-success text-success-foreground" :
                          isUploading ? "bg-primary text-primary-foreground" :
                          "bg-card text-muted-foreground"
                        }`}>
                          {isDone ? <CheckCircle2 className="h-5 w-5" /> :
                           isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> :
                           <Icon className="h-5 w-5" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {doc.optional && (
                            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">Optional</span>
                          )}
                          {isCarried && (
                            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Carried</span>
                          )}
                          {isUploaded && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemove(doc.id); }}
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border hover:text-destructive transition-base"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="text-sm font-semibold text-foreground">{doc.title}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">{doc.subtitle}</div>
                      </div>

                      {isDone && (
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-card/60 px-2.5 py-1.5 text-[11px]">
                          <span className="truncate font-medium text-foreground max-w-[120px]">
                            {isCarried ? "From AI Assistant" : doc.fileName}
                          </span>
                          <span className="font-semibold shrink-0 ml-2 text-success">
                            {isCarried ? "Pre-filled" : "Verified"}
                          </span>
                        </div>
                      )}

                      {isUploading && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[11px] text-foreground">
                            <span className="truncate font-medium max-w-[120px]">{doc.fileName}</span>
                            <span className="font-semibold text-primary shrink-0 ml-2">Parsing…</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full w-[68%] rounded-full bg-gradient-primary animate-pulse" />
                          </div>
                        </div>
                      )}

                      {isMissing && (
                        <button
                          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground transition-base hover:border-primary hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); fileInputRefs.current[doc.id]?.click(); }}
                        >
                          <Upload className="h-3.5 w-3.5" /> Drop file or browse
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Section 2: Cost Breakdown */}
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

                <div className="mt-6 divide-y divide-border">
                  {breakdown.map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-muted-foreground">{row.label}</span>
                        {row.note && row.waived && (
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">Waived</span>
                        )}
                      </div>
                      <span className={`text-[15px] font-medium tabular-nums ${
                        row.waived ? "text-success line-through decoration-success/40" : "text-foreground"
                      }`}>
                        RM {row.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-end justify-between rounded-2xl bg-foreground p-6 text-background">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-background/60">Total landed cost</div>
                    <div className="mt-1 text-[12px] text-background/70">All taxes & fees included</div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-semibold tracking-tight tabular-nums lg:text-5xl">
                      RM {total.toLocaleString()}
                    </div>
                    <div className="mt-1 text-[11px] text-background/60">
                      ≈ USD {(total / 4.7).toFixed(0)} · ≈ SGD {(total / 3.45).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Shipping */}
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
                      <Clock className="h-3.5 w-3.5" /> 3–5 business days
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
                      <Clock className="h-3.5 w-3.5" /> 14–21 business days
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

            {/* Section 4: Download Summary */}
            <section className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft-md">
              <div className="flex items-start gap-5 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <FileCheck2 className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Export Report</div>
                  <h3 className="text-lg font-semibold text-foreground">Download Shipment Summary</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    Generate a full PDF summary of your shipment — includes tax breakdown, ATIGA savings, document status, compliance checklist, and selected shipping method.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleDownloadSummary}
                      disabled={generatingSummary}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary/90 disabled:opacity-70 transition-base"
                    >
                      {generatingSummary ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                      ) : (
                        <><Download className="h-4 w-4" /> Download Export Summary PDF</>
                      )}
                    </button>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {["Tax breakdown", "Document status", "Compliance report", "Shipping details"].map(tag => (
                        <span key={tag} className="rounded-full border border-border bg-card px-2.5 py-1 font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar showing doc completeness */}
              <div className="border-t border-border bg-card/40 px-6 py-3 flex items-center gap-4">
                <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-primary transition-smooth"
                    style={{ width: `${Math.round((uploadedCount / docs.length) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                  {uploadedCount}/{docs.length} documents ready
                </span>
              </div>
            </section>

          </div>

          {/* Right rail */}
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
              <h3 className="text-sm font-semibold text-foreground">Document status</h3>
              <div className="mt-4 space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-foreground truncate flex-1">{doc.title}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      doc.status === "carried" || doc.status === "uploaded" ? "bg-success-soft text-success" :
                      doc.status === "uploading" ? "bg-primary-soft text-primary" :
                      doc.optional ? "bg-secondary text-muted-foreground" : "bg-warning-soft text-warning"
                    }`}>
                      {doc.status === "carried" ? "Carried" : doc.status === "uploaded" ? "Uploaded" : doc.status === "uploading" ? "Parsing" : doc.optional ? "Optional" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-primary transition-smooth"
                  style={{ width: `${Math.round((uploadedCount / docs.length) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 text-right text-[11px] text-muted-foreground">
                {uploadedCount} / {docs.length} documents
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
                      row.status === "Completed" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                    }`}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Logistics;