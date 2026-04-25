/**
 * Assistant.tsx — Borderless AI · Compliance Architect
 * Complete corrected 9-step export workflow.
 */

import { useState, useRef, useEffect, useCallback } from "react";
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
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type ChecklistStatus = "REQUIRED" | "PENDING" | "COMPLETED";
type DocStatus = "ready" | "partial" | "locked";

type Step = { id: number; title: string; subtitle: string; icon: React.ElementType };

const STEPS: Step[] = [
  { id: 0, title: "Entity Verification",   subtitle: "SSM & BRN Registration",    icon: Building2 },
  { id: 1, title: "Consignee Details",      subtitle: "Buyer & Importer Info",      icon: UserSquare2 },
  { id: 2, title: "Classification",         subtitle: "HS Code & Duty Lookup",      icon: FileSearch },
  { id: 3, title: "Special Permits",        subtitle: "SIRIM / Halal / MITI",       icon: Award },
  { id: 4, title: "Digital Access",         subtitle: "MyCIEDS & Dagang Net",       icon: KeyRound },
  { id: 5, title: "Financial Valuation",    subtitle: "FOB, Freight & FX",          icon: Coins },
  { id: 6, title: "Logistics & Metrics",    subtitle: "Mode, Vessel, Weight",       icon: PackageSearch },
  { id: 7, title: "Trade Docs & Signatory", subtitle: "Invoice, B/L, Declaration",  icon: FileText },
  { id: 8, title: "Customs Submission",     subtitle: "K2 Form Preview",            icon: FileCheck2 },
];

type ChecklistItem = { label: string; status: ChecklistStatus };
type ActionButton  = { label: string; icon: React.ElementType; intent: "primary" | "ghost"; action: string };

type Message =
  | { id: string; role: "user";      kind: "text";         content: string }
  | { id: string; role: "user";      kind: "upload";       content: string; fileName: string }
  | { id: string; role: "assistant"; kind: "processing";   content: string }
  | { id: string; role: "assistant"; kind: "text";         content: string }
  | { id: string; role: "assistant"; kind: "checklist";    content: string; items: ChecklistItem[]; actions?: ActionButton[] }
  | { id: string; role: "assistant"; kind: "options";      content: string; options: { label: string; value: string }[] }
  | { id: string; role: "assistant"; kind: "blocked";      content: string }
  | { id: string; role: "assistant"; kind: "reference";    content: string; refTitle: string; refUrl: string }
  | { id: string; role: "assistant"; kind: "extracted";    content: string; fields: Record<string, string>; valid: boolean }
  | { id: string; role: "assistant"; kind: "hs-result";    content: string; hsCode: string; description: string; duty: number; fta: string[]; permitRequired: boolean; permits: string[] }
  | { id: string; role: "assistant"; kind: "permit-upload";content: string; permits: Array<{ name: string; key: string; uploaded: boolean }> }
  | { id: string; role: "assistant"; kind: "valuation";    content: string; fob: number; freight: number; insurance: number; duty: number; total: number; savings: number; bestFta: string }
  | { id: string; role: "assistant"; kind: "k2-preview";   content: string; k2Data: Record<string, unknown> };

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
  { id: "commercial-invoice", label: "Commercial Invoice",   sublabel: "Buyer & seller details, FOB value, FX",   icon: FileText,        requiredSteps: [0,1,2,5],       coreRequired: true },
  { id: "packing-list",       label: "Packing List",         sublabel: "Item weights, dimensions & quantities",    icon: FileSpreadsheet, requiredSteps: [0,1,2,6],       coreRequired: true },
  { id: "bol",                label: "Bill of Lading / AWB", sublabel: "Carrier, vessel & routing information",    icon: Ship,            requiredSteps: [0,1,2,6,7],     coreRequired: true },
  { id: "k2",                 label: "K2 Declaration Form",  sublabel: "Customs export declaration (signed)",      icon: ClipboardList,   requiredSteps: [0,1,2,3,4,5,6,7], coreRequired: true },
  { id: "coo",                label: "Certificate of Origin",sublabel: "ATIGA / FTA Form D",                       icon: Stamp,           requiredSteps: [0,1,2,3],       conditionalKey: "needsCoo" },
  { id: "sirim",              label: "SIRIM Certificate",    sublabel: "Standards & quality compliance",           icon: ShieldCheck,     requiredSteps: [0,2,3],         conditionalKey: "needsSirim" },
  { id: "halal",              label: "Halal Certificate",    sublabel: "JAKIM-recognised certification",           icon: Leaf,            requiredSteps: [0,2,3,4],       conditionalKey: "needsHalal" },
];

type PermitFlags = { needsSirim: boolean; needsHalal: boolean; needsCoo: boolean };
const DEFAULT_PERMIT_FLAGS: PermitFlags = { needsSirim: false, needsHalal: false, needsCoo: false };

const isGating = (doc: ExportDoc, flags: PermitFlags): boolean => {
  if (doc.coreRequired) return true;
  if (doc.conditionalKey && flags[doc.conditionalKey]) return true;
  return false;
};

const docStatus = (doc: ExportDoc, completed: Set<number>): DocStatus => {
  const missing = doc.requiredSteps.filter(s => !completed.has(s)).length;
  if (missing === 0) return "ready";
  if (missing <= 2)  return "partial";
  return "locked";
};

const UPLOAD_ACTION_MAP: Record<string, { accept: string; endpoint: string }> = {
  "upload-ssm":     { accept: ".pdf,.jpg,.jpeg,.png", endpoint: "/entity/upload-ssm" },
  "upload-product": { accept: ".pdf,.jpg,.jpeg,.png", endpoint: "/classification/upload-product" },
};

// ─────────────────────────────────────────────────────────────────────────────
// AI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const GLM_KEY = "sk-fd9182ed29f4722fd9c3fc8b852a43e39c01234247156a93";
const GLM_URL = "https://api.ilmu.ai/v1/chat/completions";
const GLM_MDL = "ilmu-glm-5.1";
const GEM_KEY = "AIzaSyDXnhf8TrJzUq1rkC2c5_XKuUpvDMZXU-8";
const GEM_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEM_KEY}`;

async function glmJSON(
  system: string,
  user: string,
  history: { role: string; content: string }[] = []
): Promise<Record<string, unknown>> {
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

async function glmText(
  system: string,
  user: string,
  history: { role: string; content: string }[] = []
): Promise<string> {
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

async function geminiVision(b64: string, mime: string, prompt: string): Promise<Record<string, unknown>> {
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

const fileMime = (f: File): string =>
  f.type || (f.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

const hasMeaning = (v: unknown): boolean =>
  v != null &&
  typeof v === "string" &&
  v.trim().length > 1 &&
  !["—", "-", "N/A", "null", "undefined"].includes(v.trim());

// ─────────────────────────────────────────────────────────────────────────────
// PDF BUILDER
// ─────────────────────────────────────────────────────────────────────────────
class PDFDoc {
  private ops: string[] = [];
  readonly W = 595; readonly H = 842;
  readonly LM = 34; readonly RM = 561; readonly PW = 527;
  private _y = 0;

  get y() { return this._y; }
  set y(v: number) { this._y = v; }

  rect(x: number, y: number, w: number, h: number, fill?: string): this {
    if (fill) {
      const [r, g, b] = fill.split(" ");
      this.ops.push(`${r} ${g} ${b} rg`);
    }
    this.ops.push(`${x.toFixed(1)} ${(y - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re`);
    if (fill) this.ops.push("f");
    else       this.ops.push("S");
    if (fill)  this.ops.push("0 0 0 rg");
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

  text(
    s: string, x: number, y: number,
    sz = 6.5, bold = false,
    align: "L" | "C" | "R" = "L",
    color = PDFDoc.BLACK
  ): this {
    const safe = s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").substring(0, 120);
    const font  = bold ? "F2" : "F1";
    const [r, g, b] = color.split(" ");
    this.ops.push(`BT /${font} ${sz} Tf ${r} ${g} ${b} rg`);
    this.ops.push(`${x.toFixed(1)} ${y.toFixed(1)} Td (${safe}) Tj`);
    this.ops.push("0 0 0 rg ET");
    return this;
  }

  fieldLine(x: number, y: number, w: number): this { return this.hline(x, x + w, y - 1.5, 0.3); }

  checkbox(x: number, y: number): this {
    this.ops.push(`${x.toFixed(1)} ${(y - 5).toFixed(1)} 5 5 re S`);
    return this;
  }

  build(filename: string): void {
    const stream    = this.ops.join("\n");
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
      href:     URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })),
      download: filename,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  static BLUE  = "0.15 0.30 0.55";
  static LGRAY = "0.93 0.93 0.93";
  static MGRAY = "0.83 0.83 0.83";
  static LBLUE = "0.88 0.92 0.96";
  static WHITE = "1 1 1";
  static BLACK = "0 0 0";
}

function generateK2PDF(data: Record<string, unknown>): void {
  const d    = new PDFDoc();
  const { LM, PW, W, H } = d;
  const mm   = (v: number) => v * 2.835;
  const s    = (v: unknown) => String(v ?? "");
  const form = (data.k2_form_data   || {}) as Record<string, unknown>;
  const exp  = (form.exporter       || {}) as Record<string, string>;
  const con  = (form.consignee      || {}) as Record<string, string>;
  const trp  = (form.transport      || {}) as Record<string, string>;
  const gds  = (form.goods          || {}) as Record<string, unknown>;
  const val  = (form.valuation      || {}) as Record<string, number>;
  const duty = (form.duty           || {}) as Record<string, number>;
  const sig  = (form.signatory      || {}) as Record<string, string>;

  let y = H - mm(8);

  // Header
  d.rect(LM, y, PW, mm(18), PDFDoc.BLUE);
  d.text("JABATAN KASTAM DIRAJA MALAYSIA / ROYAL MALAYSIAN CUSTOMS DEPARTMENT", W / 2, y - mm(5), 7.5, true, "C", PDFDoc.WHITE);
  d.text("PERAKUAN BARANG YANG DIEKSPORT / DECLARATION OF GOODS TO BE EXPORTED", W / 2, y - mm(10), 6.5, false, "C", PDFDoc.WHITE);
  d.text("Kastam No.2 / Customs No.2", W / 2, y - mm(14.5), 8, true, "C", PDFDoc.WHITE);
  y -= mm(18);

  // K2 reference
  d.text(`K2 Reference: ${s(data.k2_reference || "K2-MY-2026-PENDING")}`, LM, y - mm(4), 6.5, true);
  y -= mm(10);

  const LW = PW * 0.54;
  const RW = PW * 0.46;
  const BOX_H = mm(28);

  // Box 1 — Exporter
  d.rect(LM, y, LW, BOX_H);
  d.rect(LM + LW, y, RW, BOX_H, PDFDoc.LGRAY);
  d.text("1. Konsainor/Pengeksport — Consignor/Exporter", LM + 2, y - mm(4), 5.5, true);
  d.text(s(exp.name),    LM + 2, y - mm(9),  6.5);
  d.text(s(exp.address), LM + 2, y - mm(14), 5.5);
  d.text(`BRN: ${s(exp.brn)}`, LM + 2, y - mm(19), 5.5);
  d.text("UNTUK KEGUNAAN RASMI / FOR OFFICIAL USE", LM + LW + 2, y - mm(4),  5.5, true);
  d.text("No. Pendaftaran:",                          LM + LW + 2, y - mm(11), 5);
  d.fieldLine(LM + LW + 2, y - mm(11), RW - 4);
  d.text("Tarikh Terima:",                            LM + LW + 2, y - mm(18), 5);
  d.fieldLine(LM + LW + 2, y - mm(18), RW - 4);
  y -= BOX_H;

  // Box 2 — Consignee
  d.rect(LM, y, LW, BOX_H);
  d.rect(LM + LW, y, RW, BOX_H, PDFDoc.LGRAY);
  d.text("2. Konsaini/Pengimport — Consignee/Importer", LM + 2, y - mm(4), 5.5, true);
  d.text(s(con.name),                                    LM + 2, y - mm(9),  6.5);
  d.text(s(con.address || con.country_code),             LM + 2, y - mm(14), 5.5);
  d.text("5. Penerimaan Duti:",                          LM + LW + 2, y - mm(4), 5.5, true);
  d.text("Tarikh/Date:",                                 LM + LW + 2, y - mm(11), 5);
  d.fieldLine(LM + LW + 2, y - mm(17), RW / 2 - 2);
  d.text("Pegawai Kastam:",                              LM + LW + RW / 2, y - mm(11), 5);
  y -= BOX_H;

  // Transport row
  const R4H = mm(20);
  d.rect(LM, y, PW, R4H);
  d.text("Negara Destinasi:",   LM + 2,          y - mm(4), 5.5, true);
  d.text(s(con.country_code),   LM + mm(30),     y - mm(4), 6.5);
  d.text("Mod Pengangkutan:",   LM + mm(90),     y - mm(4), 5.5, true);
  d.text(s(trp.mode_description), LM + mm(125),  y - mm(4), 6);
  d.text("Kapal/Vessel:",       LM + 2,          y - mm(11), 5.5, true);
  d.text(s(trp.vessel_flight_name), LM + mm(20), y - mm(11), 6);
  d.text("POL:",                LM + mm(90),     y - mm(11), 5.5, true);
  d.text(s(trp.port_of_loading_code), LM + mm(100), y - mm(11), 6);
  d.text("POD:",                LM + mm(140),    y - mm(11), 5.5, true);
  d.text(s(trp.port_of_discharge_code), LM + mm(150), y - mm(11), 6);
  y -= R4H;

  // Goods header
  const TH = mm(14);
  const gcols: [number, string][] = [
    [mm(18), "Tanda & No. Kontena"],
    [mm(8),  "Bil"],
    [mm(24), "Jenis Bungkusan"],
    [mm(55), "Perihal Barang / Description"],
    [mm(16), "Kod HS (AHTN)"],
    [mm(9),  "Unit"],
    [mm(16), "Kuantiti"],
    [mm(16), "Nilai FOB (RM)"],
    [mm(16), "Jumlah (RM)"],
    [PW - mm(18 + 8 + 24 + 55 + 16 + 9 + 16 + 16 + 16), "Duti (RM)"],
  ];
  let hx = LM;
  gcols.forEach(([cw, hdr]) => {
    d.rect(hx, y, cw, TH, PDFDoc.LBLUE);
    d.text(hdr, hx + 2, y - mm(5), 4.5, true);
    hx += cw;
  });
  y -= TH;

  // Goods rows
  for (let r = 0; r < 6; r++) {
    hx = LM;
    gcols.forEach(([cw]) => { d.rect(hx, y, cw, mm(10), r % 2 === 0 ? PDFDoc.LGRAY : undefined); hx += cw; });
    if (r === 0) {
      const vals = [
        s(gds.container_number), "1",
        `${s(gds.number_of_packages)} ${s(gds.package_type_code)}`,
        s(gds.commodity_description), s(gds.hs_code), s(gds.unit_of_quantity),
        s(gds.quantity), s(val.fob_value_myr), s(val.fob_value_myr), s(duty.total_duty_myr),
      ];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx + 2, y - mm(10) + mm(3.5), 5.5); vx += gcols[vi][0]; });
    }
    y -= mm(10);
  }

  // Totals
  d.rect(LM, y, PW, mm(10), PDFDoc.MGRAY);
  d.text("JUMLAH / TOTAL:", LM + 2, y - mm(4), 6, true);
  d.text(`FOB RM ${s(val.fob_value_myr)}`, LM + mm(195), y - mm(4), 6, true);
  d.text(`Duti RM ${s(duty.total_duty_myr)}`, LM + mm(240), y - mm(4), 6, true);
  y -= mm(10);

  // Signatory
  const SIG_H = mm(36);
  const SW    = PW * 0.52;
  d.rect(LM, y, SW, SIG_H);
  d.rect(LM + SW, y, PW - SW, SIG_H, PDFDoc.LGRAY);
  d.text("51. Nama / Name:",              LM + 2, y - mm(4),  5.5, true);
  d.text(s(sig.name),                     LM + mm(22), y - mm(4), 6.5);
  d.text("52. No. K.P. / Passport:",      LM + 2, y - mm(10), 5.5, true);
  d.text(s(sig.nric_passport),            LM + mm(30), y - mm(10), 6);
  d.text("53. Jawatan / Designation:",    LM + 2, y - mm(16), 5.5, true);
  d.text(s(sig.designation),              LM + mm(32), y - mm(16), 6);
  d.text("54. Perakuan / Declaration:",   LM + 2, y - mm(22), 5.5, true);
  d.text("Saya memperakui perakuan ini benar.", LM + 2, y - mm(27), 5.5);
  d.fieldLine(LM + 2, y - mm(32), SW / 2 - 4);
  d.text("Tarikh / Date", LM + 2, y - mm(35), 5);
  d.fieldLine(LM + SW / 2, y - mm(32), SW / 2 - 2);
  d.text("Tandatangan / Signature", LM + SW / 2 + 2, y - mm(35), 5);
  d.text("Jumlah Duti Kena Dibayar RM:", LM + SW + 2, y - mm(7),  5.5, true);
  d.text(`RM ${s(duty.total_duty_myr)}`,  LM + SW + mm(60), y - mm(7), 7, true);
  d.text("Jumlah Amaun Kena Dibayar:",    LM + SW + 2, y - mm(18), 5.5, true);
  d.fieldLine(LM + SW + 2, y - mm(18), PW - SW - 4);
  y -= SIG_H;

  d.text("Nota: Dikehendaki di bawah Akta Kastam 1967 | Required under Customs Act 1967 (Act 235)", LM, y - mm(4), 4.8);
  d.build(`K2_Declaration_${s(data.k2_reference) || "DRAFT"}.pdf`);
}

function generateInvoicePDF(data: Record<string, unknown>): void {
  const d    = new PDFDoc();
  const { LM, PW, W, H } = d;
  const mm   = (v: number) => v * 2.835;
  const s    = (v: unknown) => String(v ?? "");
  const exp  = (data.exporter  || {}) as Record<string, string>;
  const con  = (data.consignee || {}) as Record<string, string>;
  const goods = (data.goods   || []) as Array<Record<string, unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(16), PDFDoc.BLUE);
  d.text("COMMERCIAL INVOICE / INVOIS KOMERSIL", W / 2, y - mm(7), 12, true, "C", PDFDoc.WHITE);
  d.text("MALAYSIA EXPORT DOCUMENT", W / 2, y - mm(12), 6.5, false, "C", PDFDoc.WHITE);
  y -= mm(16);

  const LW = PW * 0.52; const RW = PW - LW; const R1H = mm(48);
  d.rect(LM, y, LW, R1H);
  d.text("EXPORTER / PENGEKSPORT", LM + 2, y - mm(4), 6, true);
  d.hline(LM + 2, LM + LW - 2, y - mm(5.5), 0.4);
  [["Name:", s(exp.name)], ["Address:", s(exp.address)], ["BRN:", s(exp.brn)], ["Email:", s(exp.email)], ["Bank:", s(exp.bank)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + mm(18), y - mm(10) - i * mm(5.5), 6);
  });
  d.rect(LM + LW, y, RW, R1H, PDFDoc.LGRAY);
  [["Invoice No.:", s(data.invoice_number)], ["Date:", s(data.invoice_date)], ["Terms:", s(data.payment_terms)], ["Origin:", "Malaysia"], ["Incoterm:", s(data.incoterm)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + LW + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + LW + mm(22), y - mm(10) - i * mm(5.5), 6);
  });
  y -= R1H;

  d.rect(LM, y, LW, R1H);
  d.text("CONSIGNEE / PENERIMA", LM + 2, y - mm(4), 6, true);
  d.hline(LM + 2, LM + LW - 2, y - mm(5.5), 0.4);
  [["Name:", s(con.name)], ["Address:", s(con.address)], ["Country:", s(con.country)], ["Tax ID:", s(con.tax_id)], ["Contact:", s(con.contact_person)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + mm(18), y - mm(10) - i * mm(5.5), 6);
  });
  d.rect(LM + LW, y, RW, R1H, PDFDoc.LGRAY);
  [["POL:", s(data.port_of_loading)], ["POD:", s(data.port_of_discharge)], ["Vessel:", s(data.vessel_or_flight)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + LW + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + LW + mm(16), y - mm(10) - i * mm(5.5), 6);
  });
  y -= R1H;

  const TH = mm(14);
  const gcols: [number, string, string][] = [
    [mm(12), "QTY",         "KUANTITI"],
    [mm(10), "UNIT",        "UNIT"],
    [mm(64), "DESCRIPTION", "PERIHAL BARANG"],
    [mm(22), "HS CODE",     "AHTN 2022"],
    [mm(24), "UNIT PRICE",  "HARGA UNIT (RM)"],
    [PW - mm(12 + 10 + 64 + 22 + 24), "TOTAL", "JUMLAH (RM)"],
  ];
  let hx = LM;
  gcols.forEach(([cw, en, ms]) => {
    d.rect(hx, y, cw, TH, PDFDoc.BLUE);
    d.text(en, hx + cw / 2, y - mm(4.5), 5.5, true, "C", PDFDoc.WHITE);
    d.text(ms, hx + cw / 2, y - mm(9),   5,   false, "C", PDFDoc.WHITE);
    hx += cw;
  });
  y -= TH;

  for (let r = 0; r < 9; r++) {
    const g  = goods[r];
    hx = LM;
    gcols.forEach(([cw]) => { d.rect(hx, y, cw, mm(11), r % 2 === 0 ? PDFDoc.LGRAY : undefined); hx += cw; });
    if (g) {
      const vals = [s(g.quantity), s(g.unit), s(g.description), s(g.hs_code), s(g.unit_price), s(g.total)];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx + 2, y - mm(11) + mm(3.5), 5.5); vx += gcols[vi][0]; });
    }
    y -= mm(11);
  }

  const nW = PW - mm(56);
  [["SUBTOTAL (RM)", s(data.subtotal)], ["FREIGHT / TAMBANG (RM)", s(data.freight)], ["INSURANCE / INSURANS (RM)", s(data.insurance)]].forEach(([lbl, val]) => {
    d.rect(LM, y, nW, mm(11), PDFDoc.LGRAY);
    d.text(lbl, LM + 2, y - mm(4), 5.5, true);
    d.rect(LM + nW, y, mm(56), mm(11));
    d.text(val, LM + nW + 2, y - mm(4), 6);
    y -= mm(11);
  });
  d.rect(LM, y, PW, mm(12), PDFDoc.BLUE);
  d.text("TOTAL / JUMLAH (MYR)", LM + 2, y - mm(5), 7, true, "L", PDFDoc.WHITE);
  d.text(`RM ${s(data.total_cif || data.total_fob || data.subtotal)}`, LM + PW - mm(4), y - mm(5), 8, true, "R", PDFDoc.WHITE);
  y -= mm(12);

  d.rect(LM, y, PW, mm(34));
  d.text('"WE HEREBY CERTIFY THIS INVOICE TO BE TRUE AND CORRECT."', W / 2, y - mm(6), 7, true, "C");
  d.text('"KAMI MENGESAHKAN INVOIS INI ADALAH BENAR DAN BETUL."',     W / 2, y - mm(11), 6, false, "C");
  d.fieldLine(LM + 2, y - mm(22), PW / 2 - 4);
  d.text("Authorised Signature / Tandatangan", LM + 2, y - mm(25), 5.5, true);
  d.text("Name:", LM + PW / 2, y - mm(18), 5.5, true);
  d.fieldLine(LM + PW / 2 + mm(12), y - mm(18), PW / 2 - mm(14));
  d.text("Date:", LM + PW / 2, y - mm(28), 5.5, true);
  d.fieldLine(LM + PW / 2 + mm(12), y - mm(28), PW / 2 - mm(14));
  y -= mm(34);
  d.text("EXPORTED FROM MALAYSIA IN ACCORDANCE WITH EXPORT REGULATIONS.", LM, y - mm(4), 5);
  d.build(`Commercial_Invoice_${s(data.invoice_number) || "DRAFT"}.pdf`);
}

function generateBOLPDF(data: Record<string, unknown>): void {
  const d      = new PDFDoc();
  const { LM, PW, W, H } = d;
  const mm     = (v: number) => v * 2.835;
  const s      = (v: unknown) => String(v ?? "");
  const shipper = (data.shipper   || data.exporter || {}) as Record<string, string>;
  const con     = (data.consignee  || {}) as Record<string, string>;
  const notify  = (data.notify_party || {}) as Record<string, string>;
  const ctrs    = (data.container_details || []) as Array<Record<string, unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(16), PDFDoc.BLUE);
  d.text("BILL OF LADING / SURAT CARAAN", W / 2, y - mm(7), 13, true, "C", PDFDoc.WHITE);
  d.text("MALAYSIA EXPORT DOCUMENT  |  ORIGINAL  □   SEA WAYBILL  □   SURRENDER  □", W / 2, y - mm(12), 6, false, "C", PDFDoc.WHITE);
  y -= mm(16);

  const LW = PW * 0.52; const RW = PW - LW; const RH = mm(44);
  d.rect(LM, y, LW, RH);
  d.text("SHIPPER / PENGHANTAR", LM + 2, y - mm(4), 6, true);
  d.hline(LM + 2, LM + LW - 2, y - mm(5), 0.4);
  [["Name:", s(shipper.name)], ["Address:", s(shipper.address)], ["BRN:", s(shipper.brn)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(5.8), 5.5, true);
    d.text(val, LM + mm(18), y - mm(10) - i * mm(5.8), 6);
  });
  d.rect(LM + LW, y, RW, RH, PDFDoc.LGRAY);
  [["B/L No.:", s(data.bl_number)], ["Date:", s(data.bl_date)], ["B/L Type:", "OBL"]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + LW + 2, y - mm(10) - i * mm(5.8), 5.5, true);
    d.text(val, LM + LW + mm(20), y - mm(10) - i * mm(5.8), 6);
  });
  y -= RH;

  const RH2 = mm(38);
  d.rect(LM, y, LW, RH2);
  d.text("CONSIGNEE / PENERIMA", LM + 2, y - mm(4), 6, true);
  d.hline(LM + 2, LM + LW - 2, y - mm(5), 0.4);
  [["Name:", s(con.name)], ["Address:", s(con.address)], ["Country:", s(con.country_code || con.country)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(6), 5.5, true);
    d.text(val, LM + mm(18), y - mm(10) - i * mm(6), 6);
  });
  d.rect(LM + LW, y, RW, RH2, PDFDoc.LGRAY);
  d.text("NOTIFY PARTY", LM + LW + 2, y - mm(4), 6, true);
  d.hline(LM + LW + 2, LM + LW + RW - 2, y - mm(5), 0.4);
  [["Name:", s(notify.name)], ["Address:", s(notify.address)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + LW + 2, y - mm(10) - i * mm(6), 5.5, true);
    d.text(val, LM + LW + mm(16), y - mm(10) - i * mm(6), 6);
  });
  y -= RH2;

  const R3H = mm(18);
  d.rect(LM, y, PW, R3H);
  const r3c: [number, string, string][] = [
    [mm(38), "Carrier:", s(data.carrier_name || "")],
    [mm(34), "Vessel:", s(data.vessel_or_flight)],
    [mm(28), "Voyage:", s(data.voyage_or_flight_number)],
    [mm(34), "POL:", s(data.port_of_loading)],
    [PW - mm(38 + 34 + 28 + 34), "POD:", s(data.port_of_discharge)],
  ];
  let rx = LM;
  r3c.forEach(([cw, lbl, val2]) => {
    d.vline(rx, y, y - R3H);
    d.text(lbl, rx + 2, y - mm(4), 5, true);
    d.text(val2, rx + 2, y - mm(10), 6);
    rx += cw;
  });
  y -= R3H;

  const TH2 = mm(14);
  const gcols2: [number, string][] = [
    [mm(10), "QTY\nHU"], [mm(10), "TYPE"], [mm(70), "DESCRIPTION / PERIHAL BARANG"],
    [mm(20), "HS CODE"], [mm(20), "WEIGHT (kg)"], [PW - mm(10 + 10 + 70 + 20 + 20), "CBM"],
  ];
  let hx2 = LM;
  gcols2.forEach(([cw, hdr]) => {
    d.rect(hx2, y, cw, TH2, PDFDoc.BLUE);
    hdr.split("\n").forEach((ln, li) => d.text(ln, hx2 + cw / 2, y - mm(4) - li * mm(5), 5, true, "C", PDFDoc.WHITE));
    hx2 += cw;
  });
  y -= TH2;

  for (let r = 0; r < 7; r++) {
    const ctr = ctrs[r];
    hx2 = LM;
    gcols2.forEach(([cw]) => { d.rect(hx2, y, cw, mm(11), r % 2 === 0 ? PDFDoc.LGRAY : undefined); hx2 += cw; });
    if (ctr) {
      const vals = [s(ctr.packages), s(ctr.type || "CTN"), s(ctr.description), "", s(ctr.gross_weight_kg), ""];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx + 2, y - mm(11) + mm(3.5), 5.5); vx += gcols2[vi][0]; });
    }
    y -= mm(11);
  }

  d.rect(LM, y, PW, mm(11), PDFDoc.MGRAY);
  d.text("TOTAL:", LM + 2, y - mm(4), 6, true);
  d.text(`Pkgs: ${s(data.total_packages)}  |  Gross Wt: ${s(data.total_gross_weight_kg)} kg  |  CBM: ${s(data.total_cbm)} m³`, LM + mm(25), y - mm(4), 6);
  y -= mm(11);

  const SH = mm(40);
  const ShW = PW / 2;
  d.rect(LM, y, ShW, SH);
  d.rect(LM + ShW, y, ShW, SH);
  d.text("SHIPPER CERTIFICATION", LM + 2, y - mm(4), 6, true);
  d.text("CARRIER CERTIFICATION", LM + ShW + 2, y - mm(4), 6, true);
  d.fieldLine(LM + 2, y - mm(28), ShW - 4);
  d.text("Shipper Signature / Date", LM + 2, y - mm(31), 5, true);
  d.fieldLine(LM + ShW + 2, y - mm(28), ShW - 4);
  d.text("Carrier Signature / Date", LM + ShW + 2, y - mm(31), 5, true);
  y -= SH;
  d.text("RECEIVED subject to applicable rates and regulations. Subject to Customs Act 1967.", LM, y - mm(4), 5);
  d.build(`Bill_of_Lading_${s(data.bl_number) || "DRAFT"}.pdf`);
}

function generatePackingListPDF(data: Record<string, unknown>): void {
  const d    = new PDFDoc();
  const { LM, PW, W, H } = d;
  const mm   = (v: number) => v * 2.835;
  const s    = (v: unknown) => String(v ?? "");
  const exp  = (data.exporter  || {}) as Record<string, string>;
  const con  = (data.consignee || {}) as Record<string, string>;
  const pkgs = (data.packages  || []) as Array<Record<string, unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(16), PDFDoc.BLUE);
  d.text("PACKING LIST / SENARAI PEMBUNGKUSAN", W / 2, y - mm(7), 12, true, "C", PDFDoc.WHITE);
  d.text("MALAYSIA EXPORT DOCUMENT", W / 2, y - mm(12), 6.5, false, "C", PDFDoc.WHITE);
  y -= mm(16);

  const LW = PW * 0.52; const RW = PW - LW; const RH = mm(42);
  d.rect(LM, y, LW, RH);
  d.text("EXPORTER", LM + 2, y - mm(4), 6, true);
  [["Name:", s(exp.name)], ["Address:", s(exp.address)], ["BRN:", s(exp.brn)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + mm(18), y - mm(10) - i * mm(5.5), 6);
  });
  d.rect(LM + LW, y, RW, RH, PDFDoc.LGRAY);
  [["PL No.:", s(data.packing_list_number)], ["Date:", s(data.date)], ["Invoice Ref:", s(data.invoice_reference)], ["Vessel:", s(data.vessel_or_flight)], ["POL:", s(data.port_of_loading)], ["POD:", s(data.port_of_discharge)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + LW + 2, y - mm(10) - i * mm(5.2), 5.5, true);
    d.text(val, LM + LW + mm(22), y - mm(10) - i * mm(5.2), 6);
  });
  y -= RH;

  d.rect(LM, y, LW, mm(34));
  d.text("CONSIGNEE", LM + 2, y - mm(4), 6, true);
  [["Name:", s(con.name)], ["Address:", s(con.address)], ["Country:", s(con.country || con.country_code || "")]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + mm(18), y - mm(10) - i * mm(5.5), 6);
  });
  d.rect(LM + LW, y, RW, mm(34), PDFDoc.LGRAY);
  d.text("Shipping Marks:", LM + LW + 2, y - mm(4), 5.5, true);
  d.text(s(data.shipping_marks), LM + LW + 2, y - mm(10), 6);
  d.text("Container No.:", LM + LW + 2, y - mm(20), 5.5, true);
  d.text(s(data.container_number), LM + LW + 2, y - mm(26), 6);
  y -= mm(34);

  const TH = mm(16);
  const gcols: [number, string, string][] = [
    [mm(10), "PKG NO.", "NO."], [mm(12), "TYPE", "JENIS"], [mm(60), "DESCRIPTION", "PERIHAL BARANG"],
    [mm(22), "GROSS WT.", "BERAT KASAR (kg)"], [mm(22), "NET WT.", "BERAT BERSIH (kg)"],
    [mm(20), "VOLUME", "ISIPADU (m³)"], [PW - mm(10 + 12 + 60 + 22 + 22 + 20), "QTY", "KUANTITI"],
  ];
  let hx = LM;
  gcols.forEach(([cw, en, ms]) => {
    d.rect(hx, y, cw, TH, PDFDoc.BLUE);
    d.text(en, hx + cw / 2, y - mm(4.5), 5, true, "C", PDFDoc.WHITE);
    d.text(ms, hx + cw / 2, y - mm(9),   4.5, false, "C", PDFDoc.WHITE);
    hx += cw;
  });
  y -= TH;

  for (let r = 0; r < 10; r++) {
    const p = pkgs[r];
    hx = LM;
    gcols.forEach(([cw]) => { d.rect(hx, y, cw, mm(11), r % 2 === 0 ? PDFDoc.LGRAY : undefined); hx += cw; });
    if (p) {
      const vals = [s(p.package_no), s(p.type), s(p.description), s(p.gross_weight_kg), s(p.net_weight_kg), s(p.cbm), s(p.quantity_inside)];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx + 2, y - mm(11) + mm(4), 5.5); vx += gcols[vi][0]; });
    }
    y -= mm(11);
  }

  d.rect(LM, y, PW, mm(11), PDFDoc.MGRAY);
  d.text("TOTAL:", LM + 2, y - mm(4), 6, true);
  d.text(`Pkgs: ${s(data.total_packages)}  |  Gross: ${s(data.total_gross_weight_kg)} kg  |  Net: ${s(data.total_net_weight_kg)} kg  |  Vol: ${s(data.total_cbm)} m³`, LM + mm(20), y - mm(4), 6);
  y -= mm(11);

  d.rect(LM, y, PW, mm(34));
  d.text('"WE HEREBY CERTIFY THAT THE ABOVE PARTICULARS ARE TRUE AND CORRECT."', W / 2, y - mm(6), 7, true, "C");
  d.fieldLine(LM + 2, y - mm(22), PW / 2 - 4);
  d.text("Authorised Signature", LM + 2, y - mm(25), 5.5, true);
  d.text("Name:", LM + PW / 2, y - mm(18), 5.5, true);
  d.fieldLine(LM + PW / 2 + mm(14), y - mm(18), PW / 2 - mm(16));
  d.text("Date:", LM + PW / 2, y - mm(28), 5.5, true);
  d.fieldLine(LM + PW / 2 + mm(14), y - mm(28), PW / 2 - mm(16));
  y -= mm(34);
  d.text("EXPORTED FROM MALAYSIA IN ACCORDANCE WITH EXPORT REGULATIONS.", LM, y - mm(4), 5);
  d.build(`Packing_List_${s(data.packing_list_number) || "DRAFT"}.pdf`);
}

function generateCOOPDF(data: Record<string, unknown>): void {
  const d    = new PDFDoc();
  const { LM, PW, W, H } = d;
  const mm   = (v: number) => v * 2.835;
  const s    = (v: unknown) => String(v ?? "");
  const exp  = (data.exporter         || {}) as Record<string, string>;
  const con  = (data.consignee        || {}) as Record<string, string>;
  const trp  = (data.transport_details || {}) as Record<string, string>;
  const goods = (data.goods           || []) as Array<Record<string, unknown>>;
  let y = H - mm(8);

  d.rect(LM, y, PW, mm(20), PDFDoc.BLUE);
  d.text("CERTIFICATE OF ORIGIN", W / 2, y - mm(7), 14, true, "C", PDFDoc.WHITE);
  d.text(s(data.form_type) || "FORM D (ATIGA) / STANDARD CO", W / 2, y - mm(13), 7, false, "C", PDFDoc.WHITE);
  d.text(`CO No: ${s(data.co_number)}    Date: ${s(data.co_date)}    Issuing Body: ${s(data.issuing_body) || "MATRADE"}`, W / 2, y - mm(18), 6, false, "C", PDFDoc.WHITE);
  y -= mm(20);

  const LW = PW * 0.5; const RW = PW - LW; const RH = mm(40);
  d.rect(LM, y, LW, RH);
  d.text("1. EXPORTER / PENGEKSPORT", LM + 2, y - mm(4), 6, true);
  [["Name:", s(exp.name)], ["Address:", s(exp.address)], ["BRN:", s(exp.brn)], ["Country:", "Malaysia"]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + mm(16), y - mm(10) - i * mm(5.5), 6);
  });
  d.rect(LM + LW, y, RW, RH);
  d.text("2. CONSIGNEE / PENERIMA", LM + LW + 2, y - mm(4), 6, true);
  [["Name:", s(con.name)], ["Address:", s(con.address)], ["Country:", s(con.country)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + LW + 2, y - mm(10) - i * mm(5.5), 5.5, true);
    d.text(val, LM + LW + mm(16), y - mm(10) - i * mm(5.5), 6);
  });
  y -= RH;

  const RH2 = mm(24);
  d.rect(LM, y, LW, RH2);
  d.text("3. TRANSPORT", LM + 2, y - mm(4), 6, true);
  [["Vessel:", s(trp.vessel_or_flight)], ["POL:", s(trp.port_of_loading)], ["POD:", s(trp.port_of_discharge)]].forEach(([lbl, val], i) => {
    d.text(lbl, LM + 2, y - mm(10) - i * mm(4.5), 5.5, true);
    d.text(val, LM + mm(18), y - mm(10) - i * mm(4.5), 6);
  });
  d.rect(LM + LW, y, RW, RH2, PDFDoc.LGRAY);
  d.text("4. INVOICE REF:", LM + LW + 2, y - mm(4), 6, true);
  d.text(s(data.invoice_reference), LM + LW + 2, y - mm(11), 7, true);
  d.text("Origin Criterion: WO — Wholly Obtained", LM + LW + 2, y - mm(19), 5.5);
  y -= RH2;

  const TH = mm(14);
  const gcols: [number, string][] = [
    [mm(10), "ITEM"], [mm(72), "DESCRIPTION / PERIHAL BARANG"], [mm(20), "HS CODE"],
    [mm(14), "CRITERION"], [mm(24), "QTY (kg/pcs)"], [mm(22), "GROSS WT (kg)"],
    [PW - mm(10 + 72 + 20 + 14 + 24 + 22), "FOB (MYR)"],
  ];
  let hx = LM;
  gcols.forEach(([cw, hdr]) => {
    d.rect(hx, y, cw, TH, PDFDoc.BLUE);
    d.text(hdr, hx + cw / 2, y - mm(6), 5, true, "C", PDFDoc.WHITE);
    hx += cw;
  });
  y -= TH;

  for (let r = 0; r < 6; r++) {
    const g = goods[r];
    hx = LM;
    gcols.forEach(([cw]) => { d.rect(hx, y, cw, mm(11), r % 2 === 0 ? PDFDoc.LGRAY : undefined); hx += cw; });
    if (g) {
      const vals = [s(g.item_no), s(g.description), s(g.hs_code), s(g.origin_criterion || "WO"), s(g.quantity), s(g.gross_weight_kg), s(g.fob_value_myr)];
      let vx = LM;
      vals.forEach((v2, vi) => { d.text(v2, vx + 2, y - mm(11) + mm(3.5), 5.5); vx += gcols[vi][0]; });
    }
    y -= mm(11);
  }
  y -= mm(4);

  const SH = mm(50);
  d.rect(LM, y, PW * 0.55, SH);
  d.text("DECLARATION BY EXPORTER", LM + 2, y - mm(4), 5.5, true);
  d.hline(LM + 2, LM + PW * 0.55 - 2, y - mm(5.5), 0.3);
  ["The undersigned declares that the above stated information", "is correct and that the goods comply with the origin requirements."].forEach((ln, i) => d.text(ln, LM + 2, y - mm(11) - i * mm(5.5), 5.5));
  d.fieldLine(LM + 2, y - mm(34), PW * 0.55 - 4);
  d.text("Authorised Signature", LM + 2, y - mm(37), 5.5, true);
  d.text("Name:", LM + 2, y - mm(43), 5.5);
  d.fieldLine(LM + mm(12), y - mm(43), PW * 0.55 - mm(14));
  d.text("Date:", LM + 2, y - mm(48), 5.5);
  d.fieldLine(LM + mm(12), y - mm(48), mm(30));

  d.rect(LM + PW * 0.55, y, PW * 0.45, SH, PDFDoc.LGRAY);
  d.text("FOR OFFICIAL USE / UNTUK KEGUNAAN RASMI", LM + PW * 0.55 + 2, y - mm(4), 5.5, true);
  d.text(`Issuing Body: ${s(data.issuing_body) || "MATRADE"}`, LM + PW * 0.55 + 2, y - mm(11), 5.5, true);
  d.fieldLine(LM + PW * 0.55 + 2, y - mm(36), PW * 0.45 - 4);
  d.text("Official Signature & Stamp", LM + PW * 0.55 + 2, y - mm(39), 5.5, true);
  d.text("Date:", LM + PW * 0.55 + 2, y - mm(47), 5.5);
  d.fieldLine(LM + PW * 0.55 + mm(12), y - mm(47), PW * 0.45 - mm(14));
  y -= SH;
  d.text("Issued pursuant to ASEAN Trade in Goods Agreement (ATIGA) and Malaysian regulations on rules of origin.", LM, y - mm(5), 5);
  d.build(`Certificate_of_Origin_${s(data.co_number) || "DRAFT"}.pdf`);
}

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
  ops.push(`${M} ${y + 4} ${W - M * 2} 0.4 re f`);
  y -= 10;
  for (const l of lines) {
    if (!l.trim()) { y -= 6; continue; }
    push(l.startsWith("##") ? 10 : 8, l.startsWith("##") ? l.replace(/^##\s*/, "") : l);
  }
  const stream = ops.join("\n");
  const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W} ${H}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n9\n%%EOF`;
  const a = Object.assign(document.createElement("a"), {
    href:     URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })),
    download: `${title.replace(/\s+/g, "_")}.pdf`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function flatLines(obj: Record<string, unknown>, pre = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) return flatLines(v as Record<string, unknown>, key);
    if (Array.isArray(v)) return [`${key}: ${(v as unknown[]).join(", ")}`];
    return [`${key}: ${String(v ?? "")}`];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP FLOW
// ─────────────────────────────────────────────────────────────────────────────
const STEP_FLOW: Record<number, { intro: Message; onComplete: Message }> = {
  0: {
    intro: {
      id: "i0", role: "assistant", kind: "checklist",
      content: "To verify your entity, I need your SSM certificate. Upload a PDF or image — I'll extract and validate all fields automatically.",
      items: [
        { label: "SSM Certificate (Form 9 / Form D)", status: "REQUIRED" },
        { label: "Business Registration Number (BRN)",  status: "REQUIRED" },
        { label: "Director NRIC verification",           status: "PENDING"  },
      ],
      actions: [
        { label: "Upload SSM Certificate", icon: Upload,      intent: "primary", action: "upload-ssm"  },
        { label: "Verify SSM manually",    icon: ShieldCheck, intent: "ghost",   action: "verify-ssm"  },
      ],
    },
    onComplete: { id: "c0", role: "assistant", kind: "text", content: "✅ Entity verified. Company linked to RMCD records. Now collecting your overseas buyer details." },
  },
  1: {
    intro: {
      id: "i1", role: "assistant", kind: "checklist",
      content: "Every export declaration requires the consignee on record. This pre-fills the Commercial Invoice, B/L, and K2 automatically.",
      items: [
        { label: "Consignee (Buyer) name & full address", status: "REQUIRED" },
        { label: "Contact person, email & phone",          status: "REQUIRED" },
        { label: "Importer Tax / VAT ID",                  status: "PENDING"  },
        { label: "Incoterm & notify party",                status: "PENDING"  },
      ],
      actions: [{ label: "Add Consignee Details", icon: UserSquare2, intent: "primary", action: "add-consignee" }],
    },
    onComplete: { id: "c1", role: "assistant", kind: "text", content: "✅ Consignee captured and screened. No sanctions flags. Mapping product classification next." },
  },
  2: {
    intro: {
      id: "i2", role: "assistant", kind: "checklist",
      content: "The HS Code drives every downstream permit and duty calculation. Upload a product photo or describe the product.",
      items: [
        { label: "Product description & specs",      status: "REQUIRED" },
        { label: "HS Code lookup (8-digit AHTN)",    status: "PENDING"  },
        { label: "Import duty rate at destination",  status: "PENDING"  },
      ],
      actions: [
        { label: "Upload Product Photo", icon: Upload,     intent: "primary", action: "upload-product" },
        { label: "Search HS Code",       icon: FileSearch, intent: "ghost",   action: "lookup-hs"     },
      ],
    },
    onComplete: { id: "c2", role: "assistant", kind: "text", content: "✅ HS Classification complete. Duty rates and FTA eligibility determined. Checking permit dependencies." },
  },
  3: {
    intro: { id: "i3", role: "assistant", kind: "text", content: "Checking permit requirements against PUA122 (Customs Prohibition of Exports Order). Any SIRIM, Halal, MITI, or strategic goods triggers will appear below." },
    onComplete: { id: "c3", role: "assistant", kind: "text", content: "✅ Permit check complete. Proceeding to digital access setup." },
  },
  4: {
    intro: {
      id: "i4", role: "assistant", kind: "checklist",
      content: "K2 declaration must be submitted via Dagang Net. Confirm your digital access and authentication setup.",
      items: [
        { label: "MyCIEDS account",            status: "REQUIRED" },
        { label: "Dagang Net subscription",    status: "REQUIRED" },
        { label: "Digital Certificate (token)",status: "REQUIRED" },
      ],
      actions: [{ label: "Connect Dagang Net", icon: Link2, intent: "primary", action: "connect-dagang" }],
    },
    onComplete: { id: "c4", role: "assistant", kind: "text", content: "✅ Dagang Net linked. Digital Certificate active. Now valuing the shipment." },
  },
  5: {
    intro: {
      id: "i5", role: "assistant", kind: "checklist",
      content: "RMCD requires a full CIF valuation for K2. I'll convert foreign currency automatically using BNM reference rates.",
      items: [
        { label: "FOB value (goods at Malaysian port)", status: "REQUIRED" },
        { label: "Freight cost (MYR)",                  status: "REQUIRED" },
        { label: "Insurance cost (CIF component)",      status: "REQUIRED" },
        { label: "Invoice currency & exchange rate",    status: "PENDING"  },
        { label: "FTA exemption reference (if claiming)",status: "PENDING" },
      ],
      actions: [{ label: "Enter Valuation", icon: Coins, intent: "primary", action: "enter-valuation" }],
    },
    onComplete: { id: "c5", role: "assistant", kind: "text", content: "✅ Valuation locked. CIF and landed cost calculated. FTA savings assessed." },
  },
  6: {
    intro: {
      id: "i6", role: "assistant", kind: "checklist",
      content: "Logistics details flow directly into the K2 form and Bill of Lading.",
      items: [
        { label: "Mode of Transport (Sea/Air/Rail/Road)",  status: "REQUIRED" },
        { label: "Vessel name or Flight number",           status: "REQUIRED" },
        { label: "Port of Loading & Port of Discharge",    status: "REQUIRED" },
        { label: "Scheduled export date",                  status: "REQUIRED" },
        { label: "Gross weight (kg) & volume (m³)",        status: "PENDING"  },
        { label: "Authorised signatory (NRIC / Passport)", status: "REQUIRED" },
      ],
      actions: [{ label: "Add Shipment Details", icon: PackageSearch, intent: "primary", action: "add-shipment" }],
    },
    onComplete: { id: "c6", role: "assistant", kind: "text", content: "✅ Shipment details confirmed. Signatory recorded. Generating trade documents." },
  },
  7: {
    intro: {
      id: "i7", role: "assistant", kind: "checklist",
      content: "Generating Commercial Invoice, Packing List, Certificate of Origin, and Bill of Lading from verified data. Sign the declaration to unlock K2.",
      items: [
        { label: "Commercial Invoice",                 status: "PENDING"  },
        { label: "Packing List",                       status: "PENDING"  },
        { label: "Bill of Lading / Air Waybill",       status: "PENDING"  },
        { label: "Certificate of Origin (FTA)",        status: "PENDING"  },
        { label: "Declaration of truth (e-signature)", status: "REQUIRED" },
      ],
      actions: [
        { label: "Generate Trade Docs", icon: FileText, intent: "primary", action: "generate-docs"     },
        { label: "Sign Declaration",    icon: PenLine,  intent: "ghost",   action: "sign-declaration"  },
      ],
    },
    onComplete: { id: "c7", role: "assistant", kind: "text", content: "✅ All trade documents generated and signed. Ready for K2 submission." },
  },
  8: {
    intro: { id: "i8", role: "assistant", kind: "text", content: "All dependencies satisfied. K2 Customs Declaration is ready. Review the form below then submit to RMCD via Dagang Net." },
    onComplete: { id: "c8", role: "assistant", kind: "text", content: "🎉 K2 submitted. RMCD acknowledgement expected within 4 business hours." },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
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
      <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors pr-8"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}

// ── Consignee Modal ──────────────────────────────────────────────────────────
function ConsigneeModal({ onClose, onSubmit, loading }: {
  onClose: () => void; onSubmit: (data: object) => Promise<void>; loading: boolean;
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
          <Field label="Incoterm" required><SelectInput value={form.incoterm} onChange={set("incoterm")} options={["FOB","CIF","DAP","DDP","EXW","CFR","CIP","CPT","DPU","FAS","FCA"]} /></Field>
        </div>
        <Field label="Importer of Record (if different)"><Input value={form.importer_of_record} onChange={set("importer_of_record")} placeholder="Same as buyer" /></Field>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors">Cancel</button>
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !form.buyer_name || !form.buyer_country || !form.buyer_address || !form.buyer_email}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
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
  onClose: () => void; onSubmit: (data: object) => Promise<void>; loading: boolean; hsCode: string;
}) {
  const [form, setForm] = useState({
    fob_value_myr: "", freight_quote_myr: "", insurance_rate: "0.005",
    invoice_currency: "MYR", invoice_amount_foreign: "", exchange_rate_to_myr: "",
    destination_country: "", hs_code: hsCode, incoterm: "FOB",
    fta_exemption_ref: "", import_duty_rate: "",
  });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Step 5 — Financial Valuation" subtitle="FOB → CIF → Duty breakdown for K2 declaration" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5 text-[11px] text-primary">
          💡 RMCD requires CIF valuation. Provide FOB value — freight & insurance are added automatically.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice Currency" required><SelectInput value={form.invoice_currency} onChange={set("invoice_currency")} options={["MYR","USD","EUR","GBP","SGD","CNY","JPY","AUD","HKD"]} /></Field>
          <Field label="Destination Country" required><Input value={form.destination_country} onChange={set("destination_country")} placeholder="Indonesia" /></Field>
        </div>
        {form.invoice_currency !== "MYR" && (
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
          <Field label="Incoterm"><SelectInput value={form.incoterm} onChange={set("incoterm")} options={["FOB","CIF","DAP","DDP","EXW","CFR"]} /></Field>
        </div>
        <div className="border-t border-border pt-3">
          <Field label="FTA Exemption Reference (if claiming Form D/RCEP)">
            <Input value={form.fta_exemption_ref} onChange={set("fta_exemption_ref")} placeholder="ATIGA Form D · Ref CO-2026-00123" />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors">Cancel</button>
        <button
          onClick={() => onSubmit({
            ...form,
            fob_value_myr:           parseFloat(form.fob_value_myr)           || 0,
            freight_quote_myr:       parseFloat(form.freight_quote_myr)       || undefined,
            insurance_rate:          parseFloat(form.insurance_rate)          || 0.005,
            import_duty_rate:        parseFloat(form.import_duty_rate)        || undefined,
            invoice_amount_foreign:  parseFloat(form.invoice_amount_foreign)  || undefined,
            exchange_rate_to_myr:    parseFloat(form.exchange_rate_to_myr)    || undefined,
          })}
          disabled={loading || !form.fob_value_myr || !form.destination_country}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
          Calculate Valuation
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Shipment Modal ───────────────────────────────────────────────────────────
function ShipmentModal({ onClose, onSubmit, loading }: {
  onClose: () => void; onSubmit: (data: object) => Promise<void>; loading: boolean;
}) {
  const [form, setForm] = useState({
    mode: "SEA", port_of_loading: "Port Klang", port_of_discharge: "",
    vessel_name: "", flight_number: "", voyage_number: "", container_number: "",
    export_date: "", gross_weight_kg: "", net_weight_kg: "", cbm: "",
    number_of_packages: "", package_type: "CTN",
    signatory_name: "", signatory_ic_or_passport: "", signatory_designation: "",
  });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const modeIcons: Record<string, React.ElementType> = { SEA: Ship, AIR: Plane, ROAD: Truck, RAIL: Train };
  const ModeIcon = modeIcons[form.mode] || Ship;

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Step 6 — Shipment Details" subtitle="Logistics & transport info for K2 & Bill of Lading" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <Field label="Mode of Transport" required>
          <div className="grid grid-cols-4 gap-2">
            {(["SEA","AIR","ROAD","RAIL"] as const).map(m => {
              const Icon = modeIcons[m] || Ship;
              return (
                <button key={m} type="button" onClick={() => set("mode")(m)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-colors ${form.mode === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
                >
                  <Icon className="h-4 w-4" />{m}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Port of Loading" required><Input value={form.port_of_loading} onChange={set("port_of_loading")} placeholder="Port Klang" /></Field>
          <Field label="Port of Discharge" required><Input value={form.port_of_discharge} onChange={set("port_of_discharge")} placeholder="Tanjung Priok" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {form.mode === "SEA" && <Field label="Vessel Name" required><Input value={form.vessel_name} onChange={set("vessel_name")} placeholder="MV Bunga Mas 5" /></Field>}
          {form.mode === "AIR" && <Field label="Flight Number" required><Input value={form.flight_number} onChange={set("flight_number")} placeholder="MH 713" /></Field>}
          <Field label="Voyage / Flight No"><Input value={form.voyage_number} onChange={set("voyage_number")} placeholder="0412W" /></Field>
          {form.mode === "SEA" && <Field label="Container Number"><Input value={form.container_number} onChange={set("container_number")} placeholder="MSKU-7842150" /></Field>}
        </div>
        <Field label="Scheduled Export Date" required><Input value={form.export_date} onChange={set("export_date")} type="date" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Gross Weight (kg)" required><Input value={form.gross_weight_kg} onChange={set("gross_weight_kg")} placeholder="480" /></Field>
          <Field label="Net Weight (kg)"><Input value={form.net_weight_kg} onChange={set("net_weight_kg")} placeholder="440" /></Field>
          <Field label="Volume (m³)" required><Input value={form.cbm} onChange={set("cbm")} placeholder="1.2" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number of Packages"><Input value={form.number_of_packages} onChange={set("number_of_packages")} placeholder="12" /></Field>
          <Field label="Package Type"><SelectInput value={form.package_type} onChange={set("package_type")} options={["CTN","PALLET","DRUM","BAG","BOX"]} /></Field>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5" />Authorised Signatory for K2 & Trade Docs
          </p>
          <Field label="Full Name" required><Input value={form.signatory_name} onChange={set("signatory_name")} placeholder="Aisyah Rahman" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="NRIC / Passport No." required><Input value={form.signatory_ic_or_passport} onChange={set("signatory_ic_or_passport")} placeholder="880412-14-5566" /></Field>
            <Field label="Job Title / Designation" required><Input value={form.signatory_designation} onChange={set("signatory_designation")} placeholder="Director" /></Field>
          </div>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors">Cancel</button>
        <button
          onClick={() => onSubmit({
            ...form,
            gross_weight_kg:    parseFloat(form.gross_weight_kg)    || 0,
            net_weight_kg:      parseFloat(form.net_weight_kg)      || undefined,
            cbm:                parseFloat(form.cbm)                || 0,
            number_of_packages: parseInt(form.number_of_packages)   || undefined,
          })}
          disabled={loading || !form.port_of_discharge || !form.export_date || !form.gross_weight_kg || !form.cbm || !form.signatory_name || !form.signatory_ic_or_passport || !form.signatory_designation}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
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
  onClose: () => void; onSubmit: (brn: string, agentCode: string) => Promise<void>; loading: boolean; companyBrn: string;
}) {
  const [myciedsOk, setMyciedsOk] = useState(false);
  const [dagangOk,  setDagangOk]  = useState(false);
  const [certOk,    setCertOk]    = useState(false);
  const [agentCode, setAgentCode] = useState("");
  const connected = myciedsOk && dagangOk;

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Step 4 — Digital Access Setup" subtitle="Required for K2 submission via MyDagangNet / MyECIS" onClose={onClose} />
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          {[
            { state: myciedsOk, toggle: () => setMyciedsOk(v => !v), label: "MyCIEDS Account", badge: "REQUIRED", badgeColor: "text-red-600 bg-red-50", desc: "Royal Malaysian Customs e-customs system. Register at mycustoms.gov.my" },
            { state: dagangOk,  toggle: () => setDagangOk(v => !v),  label: "Dagang Net Subscription", badge: "REQUIRED", badgeColor: "text-red-600 bg-red-50", desc: "EDI portal for submitting K2 declarations. Register at dagangnet.com.my" },
            { state: certOk,    toggle: () => setCertOk(v => !v),    label: "Digital Certificate (Token)", badge: "REQUIRED", badgeColor: "text-amber-600 bg-amber-50", desc: "PKI certificate from MSC Trustgate or Pos Digicert." },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <button type="button" onClick={item.toggle}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${item.state ? "border-green-500 bg-green-500 text-white" : "border-border bg-background"}`}
              >
                {item.state && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {item.label} <span className={`ml-1 rounded-full px-1.5 py-px text-[9px] font-bold ${item.badgeColor}`}>{item.badge}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Field label="Customs Agent Code (optional)">
          <Input value={agentCode} onChange={setAgentCode} placeholder="e.g. CA-MY-12345" />
        </Field>
        {connected && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-[12px] font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Dagang Net connected. Ready for K2 submission.
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors">Cancel</button>
        <button
          onClick={() => onSubmit(companyBrn, agentCode)}
          disabled={loading || !connected}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
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
  signatoryName: string; signatoryTitle: string; onClose: () => void; onSign: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });

  const doSign = () => { setSigned(true); setTimeout(onSign, 800); };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Declaration of Truth — E-Signature" subtitle="Required for K2 submission under Customs Act 1967" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-foreground leading-relaxed">
          <p className="font-semibold mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Declaration</p>
          <p>I, <strong>{signatoryName || "[Signatory Name]"}</strong> ({signatoryTitle || "[Designation]"}), hereby declare that the particulars given in this export declaration and all accompanying trade documents are true and correct to the best of my knowledge and belief.</p>
          <p className="mt-2 text-[11px] text-muted-foreground">This declaration is made pursuant to Section 121 of the Customs Act 1967 (Act 235). False declaration is an offence under Section 135.</p>
          <p className="mt-3 font-medium">Date: {today}</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <button type="button" onClick={() => setAgreed(v => !v)}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${agreed ? "border-primary bg-primary text-white" : "border-border bg-background"}`}
          >
            {agreed && <Check className="h-3 w-3" />}
          </button>
          <span className="text-sm text-foreground">I confirm the declaration above and authorise submission of the K2 export declaration on my behalf.</span>
        </label>
        {signed && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-sm font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Signed. Documents are ready for final review.
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground">Cancel</button>
        <button
          onClick={doSign} disabled={!agreed || signed}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
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
  k2Data: Record<string, unknown>; onClose: () => void; onSubmit: () => void; loading: boolean;
}) {
  const form = (k2Data?.k2_form_data || {}) as Record<string, unknown>;
  const exp  = (form?.exporter  || {}) as Record<string, string>;
  const con  = (form?.consignee || {}) as Record<string, string>;
  const gds  = (form?.goods     || {}) as Record<string, unknown>;
  const val  = (form?.valuation || {}) as Record<string, number>;
  const dty  = (form?.duty      || {}) as Record<string, number>;
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
        <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/30 px-3 py-2">
          <span className="text-[11px] font-bold text-primary">K2 Reference</span>
          <span className="text-sm font-mono font-bold text-primary">{String(k2Data?.k2_reference || "K2-MY-2026-PENDING")}</span>
        </div>
        <Section title="Exporter">
          <K2Row label="Company" value={exp.name} />
          <K2Row label="BRN"     value={exp.brn} />
          <K2Row label="Address" value={exp.address} />
        </Section>
        <Section title="Consignee">
          <K2Row label="Name"    value={con.name} />
          <K2Row label="Country" value={con.country_code} />
          <K2Row label="Address" value={con.address} />
        </Section>
        <Section title="Transport">
          <K2Row label="Mode"          value={trp.mode_description} />
          <K2Row label="Vessel/Flight" value={trp.vessel_flight_name} />
          <K2Row label="POL"           value={trp.port_of_loading_code} />
          <K2Row label="POD"           value={trp.port_of_discharge_code} />
        </Section>
        <Section title="Goods">
          <K2Row label="HS Code"     value={gds.hs_code as string} />
          <K2Row label="Description" value={gds.commodity_description as string} />
          <K2Row label="Quantity"    value={`${gds.quantity} ${gds.unit_of_quantity}`} />
          <K2Row label="Gross Weight" value={`${gds.gross_weight_kg} kg`} />
        </Section>
        <Section title="Valuation & Duty">
          <K2Row label="FOB (MYR)"    value={`RM ${Number(val.fob_value_myr || 0).toLocaleString()}`} />
          <K2Row label="CIF (MYR)"    value={`RM ${Number(val.cif_value_myr || 0).toLocaleString()}`} />
          <K2Row label="Export Duty"  value={`RM ${Number(dty.export_duty_myr || 0).toLocaleString()}`} />
          <K2Row label="Total Duty"   value={`RM ${Number(dty.total_duty_myr || 0).toLocaleString()}`} />
        </Section>
        <Section title="Signatory">
          <K2Row label="Name"         value={sig.name} />
          <K2Row label="NRIC/Passport" value={sig.nric_passport} />
          <K2Row label="Designation"  value={sig.designation} />
        </Section>
        {(k2Data?.compliance_notes as string[] || []).length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-700 space-y-1">
            {(k2Data.compliance_notes as string[]).map((n, i) => <p key={i}>⚠ {n}</p>)}
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground">Close</button>
        <button
          onClick={onSubmit} disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit to Dagang Net
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AssistantPage() {
  const navigate = useNavigate();

  const [completed,   setCompleted]   = useState<Set<number>>(new Set());
  const [activeStep,  setActiveStep]  = useState(0);
  const [permitFlags, setPermitFlags] = useState<PermitFlags>(DEFAULT_PERMIT_FLAGS);

  const sessionData = useRef<Record<string, unknown>>({});

  const [modal, setModal] = useState<
    null | "consignee" | "valuation" | "shipment" | "digital-access" | "signature" | "k2-preview"
  >(null);

  const [requiredPermits, setRequiredPermits] = useState<Array<{ name: string; key: string; uploaded: boolean }>>([]);
  const [generatingId,    setGeneratingId]    = useState<string | null>(null);
  const [generatedIds,    setGeneratedIds]    = useState<Set<string>>(new Set());
  const [signed,          setSigned]          = useState(false);
  const [k2Data,          setK2Data]          = useState<Record<string, unknown> | null>(null);
  const [landedCost, setLandedCost]           = useState({ fob: 0, freight: 0, insurance: 0, duty: 0, total: 0, savings: 0, bestFta: "", finalised: false });

  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", kind: "text", content: "Hi — I'm your Compliance Architect. I'll guide you through every regulatory dependency in order: Entity → Consignee → HS Code → Permits → Digital Access → Valuation → Logistics → Docs & Signatory → K2. Let's start." },
    STEP_FLOW[0].intro,
  ]);
  const [input,        setInput]       = useState("");
  const [sending,      setSending]     = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const fileInputRef     = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ action: string; accept: string; endpoint: string } | null>(null);
  const bottomRef        = useRef<HTMLDivElement>(null);
  const chatHistoryRef   = useRef<{ role: string; content: string }[]>([]);

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

  const addMsg    = useCallback((msg: Message) => setMessages(m => [...m, msg]), []);
  const removeMsg = useCallback((pid: string)  => setMessages(m => m.filter(x => x.id !== pid)), []);

  const advanceUI = useCallback(() => {
    setActiveStep(prev => {
      const cur  = prev;
      const next = cur + 1;
      setCompleted(c => new Set([...c, cur]));
      setMessages(m => {
        const msgs = [...m];
        if (STEP_FLOW[cur])                    msgs.push(STEP_FLOW[cur].onComplete);
        if (next < total && STEP_FLOW[next])   msgs.push(STEP_FLOW[next].intro);
        return msgs;
      });
      return Math.min(next, total - 1);
    });
  }, [total]);

  const runWithFeedback = useCallback(async (fn: () => Promise<void>, label = "Processing…") => {
    const pid = genId();
    addMsg({ id: pid, role: "assistant", kind: "processing", content: label });
    setSending(true);
    try   { await fn(); }
    catch (err) { addMsg({ id: genId(), role: "assistant", kind: "text", content: `⚠️ ${err instanceof Error ? err.message : String(err)}` }); }
    finally     { removeMsg(pid); setSending(false); }
  }, [addMsg, removeMsg]);

  // ── Build context for AI doc generation ────────────────────────────────────
  const buildCtx = useCallback((): string => {
    const e  = (sessionData.current.entity        as Record<string, unknown>) ?? {};
    const c  = (sessionData.current.consignee      as Record<string, unknown>) ?? {};
    const cl = (sessionData.current.classification as Record<string, unknown>) ?? {};
    const v  = (sessionData.current.valuation      as Record<string, unknown>) ?? {};
    const l  = (sessionData.current.logistics      as Record<string, unknown>) ?? {};
    return [
      `Exporter: ${e.company_name ?? "N/A"}, BRN ${e.registration_number ?? "N/A"}, ${e.registered_address ?? "Malaysia"}`,
      `Consignee: ${c.buyer_name ?? "N/A"}, ${c.buyer_country ?? "N/A"}, ${c.buyer_address ?? "N/A"}`,
      `Incoterm: ${c.incoterm ?? "FOB"}, Tax ID: ${c.buyer_tax_id ?? "N/A"}`,
      `HS Code: ${cl.hs_code ?? "N/A"}, Description: ${cl.hs_description ?? "N/A"}`,
      `MY Export Duty: ${cl.malaysia_export_duty ?? 0}%, Destination Import Duty: ${cl.destination_import_duty ?? 0}%`,
      `FTA available: ${(cl.fta_available as string[] ?? []).join(", ") || "None"}`,
      `FOB: RM${v.fob_myr ?? 0}, Freight: RM${v.freight_myr ?? 0}, Insurance: RM${v.insurance_myr ?? 0}, CIF: RM${v.cif_myr ?? 0}`,
      `Duty: RM${v.estimated_duty_myr ?? 0}, Best FTA: ${v.best_fta ?? "None"}`,
      `Mode: ${l.mode ?? "SEA"}, Vessel: ${l.vessel ?? "TBC"}, POL: ${l.pol ?? "Port Klang"}, POD: ${l.pod ?? "N/A"}`,
      `Export date: ${l.export_date ?? "N/A"}, Gross wt: ${l.weight_kg ?? 0} kg, CBM: ${l.cbm ?? 0}`,
      `Packages: ${l.number_of_packages ?? 0} x ${l.package_type ?? "CTN"}, Container: ${l.container_number ?? "N/A"}`,
      `Signatory: ${l.signatory_name ?? "N/A"}, ${l.signatory_designation ?? "N/A"}, IC: ${l.signatory_ic_passport ?? "N/A"}`,
    ].join("\n");
  }, []);

  // ── File upload handler ────────────────────────────────────────────────────
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

      if (endpoint === "/entity/upload-ssm") {
        if (completed.has(0)) {
          addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Entity is already verified." });
          return;
        }
        const SSM_PROMPT = `You are an OCR extraction engine for Malaysian SSM company registration documents.
Extract all available fields. Return ONLY valid JSON:
{"is_valid":false,"company_name":"","registration_number":"","registration_date":"","company_type":"","company_status":"active","registered_address":"","directors":[{"name":"","nric":"","designation":"Director"}],"paid_up_capital":"","blacklisted":false,"sst_registered":false,"compliance_flags":[],"missing_fields":[],"confidence":0.0,"extraction_notes":""}`;

        const result = await geminiVision(b64, mime, SSM_PROMPT);
        sessionData.current.entity = result;

        const dirs = (result.directors as Array<{ name: string }> ?? []).map(d => d.name).filter(Boolean).join(", ");
        const extractedFields: Record<string, string> = {
          "Company Name":    hasMeaning(result.company_name)        ? String(result.company_name)        : "—",
          "BRN":             hasMeaning(result.registration_number)  ? String(result.registration_number) : "—",
          "Company Type":    hasMeaning(result.company_type)         ? String(result.company_type)        : "—",
          "Registered Date": hasMeaning(result.registration_date)    ? String(result.registration_date)   : "—",
          "Status":          hasMeaning(result.company_status)       ? String(result.company_status)      : "Active",
          "Directors":       dirs || "—",
          "SST Registered":  result.sst_registered ? "Yes" : "No",
          "Paid-up Capital": hasMeaning(result.paid_up_capital)      ? String(result.paid_up_capital)     : "—",
        };

        const nameOk = hasMeaning(result.company_name);
        const brnOk  = hasMeaning(result.registration_number);

        addMsg({
          id: genId(), role: "assistant", kind: "extracted",
          content: `SSM certificate scanned (confidence: ${Math.round(Number(result.confidence ?? 0) * 100)}%):`,
          valid:  Boolean(result.is_valid) && !result.blacklisted && nameOk && brnOk,
          fields: extractedFields,
        });

        if (result.is_valid && !result.blacklisted && nameOk && brnOk) {
          addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Entity verified successfully. Proceeding to Step 2 — Consignee Details." });
          advanceUI();
        } else if (nameOk || brnOk) {
          const missing: string[] = [];
          if (!nameOk) missing.push("Company Name");
          if (!brnOk)  missing.push("BRN");
          sessionData.current.entity = { ...result, partial_extraction: true };
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `⚠️ Partial extraction${missing.length ? ` — missing: **${missing.join(", ")}**` : ""}.\n\nType **"confirm"** if details are correct, or reply with corrections:\n\n> Company Name: ABC SDN BHD\n> BRN: 202301012345`,
          });
        } else {
          sessionData.current.entity = { ...result, partial_extraction: true };
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `❌ Could not read document clearly. Please re-upload a clearer image or enter details manually:\n\n> Company Name: ABC SDN BHD\n> BRN: 202301012345\n> Company Type: Sdn Bhd\n> Directors: Ahmad bin Ali`,
          });
        }

      } else if (endpoint === "/classification/upload-product") {
        if (!completed.has(1)) {
          addMsg({ id: genId(), role: "assistant", kind: "blocked", content: "Complete Step 2 — Consignee Details — before classifying your product." });
          return;
        }
        if (completed.has(2)) {
          addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Product is already classified." });
          return;
        }
        const destCountry = String((sessionData.current.consignee as Record<string, string>)?.buyer_country ?? "Unknown");
        const result = await geminiVision(b64, mime,
          `You are a WCO HS 2022/AHTN 2022 tariff classification engine for Malaysian exports to ${destCountry}.
Identify the product and classify to 8-digit AHTN code. Return ONLY valid JSON:
{"identified":false,"hs_code":"","hs_description":"","product_name":"","malaysia_export_duty":0.0,"destination_import_duty":0.0,"fta_available":[],"permit_required":[],"sirim_required":false,"halal_required":false,"miti_required":false,"confidence":0.0,"identification_notes":""}`
        );

        const hsCode     = String(result.hs_code ?? "").trim();
        const identified = Boolean(result.identified) && hsCode.length > 0 && !hsCode.startsWith("XXXX") && Number(result.confidence ?? 0) > 0.3;

        if (!identified) {
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `⚠️ Could not identify the product.\n${result.identification_notes ? `Reason: ${result.identification_notes}\n\n` : ""}Please upload a clearer photo or type your product description.`,
          });
          return;
        }
        sessionData.current.classification = result;
        addMsg({
          id: genId(), role: "assistant", kind: "hs-result",
          content: "Product identified and classified:",
          hsCode, description: String(result.hs_description ?? "—"),
          duty: Number(result.destination_import_duty ?? 0),
          fta:  (result.fta_available as string[] ?? []),
          permitRequired: Boolean((result.permit_required as unknown[])?.length || result.sirim_required || result.halal_required || result.miti_required),
          permits: (result.permit_required as string[] ?? []),
        });
        await runPermitCheckFromResult(result);

      } else {
        const result = await geminiVision(b64, mime,
          `You are an OCR engine for Malaysian export permits. Extract all fields. Return ONLY valid JSON:
{"is_valid":false,"permit_type":"","issuing_body":"","certificate_number":"","company_name":"","issue_date":"","expiry_date":"","scope":"","confidence":0.0}`
        );
        addMsg({
          id: genId(), role: "assistant", kind: "extracted",
          content: result.is_valid ? "✅ Permit validated:" : "⚠️ Permit issues — please re-upload:",
          valid: Boolean(result.is_valid),
          fields: {
            "Permit Type":    String(result.permit_type        ?? "—"),
            "Certificate No": String(result.certificate_number ?? "—"),
            "Issuing Body":   String(result.issuing_body       ?? "—"),
            "Expiry Date":    String(result.expiry_date        ?? "—"),
          },
        });
        if (result.is_valid) advanceUI();
      }
    }, "Scanning document…");
  }, [addMsg, runWithFeedback, advanceUI, completed]);

  // ── Step 1: Consignee ─────────────────────────────────────────────────────
  const handleConsigneeSubmit = useCallback(async (data: object) => {
    setModalLoading(true);
    const d = data as Record<string, string>;
    try {
      const result = await glmJSON(
        `Screen this buyer for sanctions (OFAC SDN, UN Security Council, Malaysian MFA). Return JSON: {"risk_level":"low","sanctioned_country":false,"denied_party_check":"clear","compliance_notes":[],"red_flags":[]}`,
        `Buyer: ${d.buyer_name}, Country: ${d.buyer_country}, Incoterm: ${d.incoterm}`
      );
      sessionData.current.consignee = { ...data, screening: result };
      setModal(null);
      const risk = String(result.risk_level ?? "low");
      addMsg({ id: genId(), role: "user",      kind: "text", content: `Consignee: ${d.buyer_name}, ${d.buyer_country}` });
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `${risk === "high" ? "🔴" : risk === "medium" ? "🟡" : "🟢"} Buyer screened — Risk: **${risk.toUpperCase()}** · Sanctions: **${String(result.denied_party_check ?? "clear")}**` +
          ((result.compliance_notes as string[] ?? []).length ? `\n\nNotes: ${(result.compliance_notes as string[]).join("; ")}` : ""),
      });
      advanceUI();
    } catch {
      sessionData.current.consignee = data;
      setModal(null);
      addMsg({ id: genId(), role: "user",      kind: "text", content: `Consignee: ${d.buyer_name}, ${d.buyer_country}` });
      addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Consignee saved." });
      advanceUI();
    } finally { setModalLoading(false); }
  }, [advanceUI, addMsg]);

  // ── Step 4: Digital Access ────────────────────────────────────────────────
  const handleDigitalAccessSubmit = useCallback(async (brn: string, agentCode: string) => {
    setModalLoading(true);
    sessionData.current.digitalAccess = { brn, agentCode, confirmed: true };
    setModal(null);
    advanceUI();
    setModalLoading(false);
  }, [advanceUI]);

  // ── Step 5: Financial Valuation ───────────────────────────────────────────
  const handleValuationSubmit = useCallback(async (data: object) => {
    setModalLoading(true);
    const d = data as Record<string, unknown>;
    try {
      const fob      = Number(d.fob_value_myr)    || 0;
      const freight  = Number(d.freight_quote_myr) || fob * 0.07;
      const ins      = fob * (Number(d.insurance_rate) || 0.005);
      const cif      = fob + freight + ins;
      const clsData  = (sessionData.current.classification as Record<string, unknown>) ?? {};
      const dutyRate = d.import_duty_rate ? Number(d.import_duty_rate) : (Number(clsData.destination_import_duty) || 5) / 100;
      const duty     = cif * dutyRate;
      const total    = cif + duty;
      const hsCode   = String(clsData.hs_code ?? "");
      const destCo   = String(d.destination_country ?? (sessionData.current.consignee as Record<string, string>)?.buyer_country ?? "Unknown");

      const fta = await glmJSON(
        `Evaluate ATIGA, CPTPP, RCEP, MAFTA FTA duty savings for this Malaysian export. Return JSON: {"best_fta":"","best_fta_rate":0.0,"best_savings_myr":0,"form_required":"None","roo_met":true,"notes":""}`,
        `HS Code: ${hsCode}, Destination: ${destCo}, CIF: RM${cif.toFixed(2)}, MFN duty: ${(dutyRate * 100).toFixed(1)}%`
      );

      const savings = Number(fta.best_savings_myr) || 0;
      sessionData.current.valuation = {
        fob_myr: fob, freight_myr: freight, insurance_myr: ins, cif_myr: cif,
        estimated_duty_myr: duty, best_fta: String(fta.best_fta ?? ""),
        best_savings_myr: savings, form_required: String(fta.form_required ?? "None"),
      };
      setLandedCost({ fob, freight, insurance: ins, duty, total, savings, bestFta: String(fta.best_fta ?? ""), finalised: true });
      setModal(null);
      addMsg({ id: genId(), role: "assistant", kind: "valuation", content: "Valuation calculated:", fob, freight, insurance: ins, duty, total, savings, bestFta: String(fta.best_fta ?? "") });
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: savings > 0
          ? `✅ CIF valuation locked.\n\n🎯 **FTA saving: RM ${savings.toLocaleString()}** via **${fta.best_fta}** (${fta.form_required})`
          : "✅ CIF valuation locked. No FTA applicable — MFN rate applies.",
      });
      advanceUI();
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text", content: `⚠️ Valuation error: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setModalLoading(false); }
  }, [advanceUI, addMsg]);

  // ── Step 6: Logistics ─────────────────────────────────────────────────────
  const handleShipmentSubmit = useCallback(async (data: object) => {
    setModalLoading(true);
    const d = data as Record<string, string>;
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
    const modeEmoji: Record<string, string> = { SEA: "🚢", AIR: "✈️", ROAD: "🚛", RAIL: "🚂" };
    addMsg({ id: genId(), role: "user", kind: "text",
      content: `${modeEmoji[d.mode] ?? ""} ${d.mode} · ${d.vessel_name || d.flight_number || "TBC"} · ETD ${d.export_date} · ${d.port_of_loading} → ${d.port_of_discharge} · ${d.gross_weight_kg} kg / ${d.cbm} m³`,
    });
    advanceUI();
    setModalLoading(false);
  }, [advanceUI, addMsg]);

  // ── Step 7: Generate All Trade Documents ──────────────────────────────────
  const handleGenerateDocs = useCallback(async () => {
    await runWithFeedback(async () => {
      const ctx = buildCtx();
      const configs = [
        { id: "commercial-invoice", title: "Commercial Invoice",
          sys: `Generate a complete Malaysian export Commercial Invoice. Return JSON: {"invoice_number":"CI-MY-2026-001","invoice_date":"","payment_terms":"T/T","exporter":{"name":"","brn":"","address":"","tel":"","email":"","bank":""},"consignee":{"name":"","country":"","address":"","tax_id":"","tel":"","contact_person":""},"goods":[{"line_no":1,"hs_code":"","description":"","quantity":0,"unit":"","unit_price":0,"total":0}],"incoterm":"FOB","port_of_loading":"","port_of_discharge":"","currency":"MYR","subtotal":0,"freight":0,"insurance":0,"total_fob":0,"total_cif":0,"vessel_or_flight":""}` },
        { id: "packing-list", title: "Packing List",
          sys: `Generate a complete Malaysian export Packing List. Return JSON: {"packing_list_number":"PL-MY-2026-001","date":"","exporter":{"name":"","address":""},"consignee":{"name":"","country":"","address":""},"invoice_reference":"","vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","packages":[{"package_no":"1","type":"CTN","description":"","gross_weight_kg":0,"net_weight_kg":0,"cbm":0,"quantity_inside":0}],"total_packages":0,"total_gross_weight_kg":0,"total_net_weight_kg":0,"total_cbm":0,"shipping_marks":"","container_number":""}` },
        { id: "coo", title: "Certificate of Origin",
          sys: `Generate a Certificate of Origin for Malaysian export (ATIGA Form D). Return JSON: {"co_number":"CO-MY-2026-001","co_date":"","form_type":"Form D (ATIGA)","issuing_body":"MATRADE","exporter":{"name":"","address":"","country":"Malaysia","brn":""},"consignee":{"name":"","address":"","country":""},"transport_details":{"vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","departure_date":""},"goods":[{"item_no":1,"description":"","hs_code":"","origin_criterion":"WO","quantity":"","gross_weight_kg":0,"fob_value_myr":0}],"invoice_reference":""}` },
        { id: "bol", title: "Bill of Lading",
          sys: `Generate a Bill of Lading for Malaysian export. Return JSON: {"bl_number":"TBC - Assigned by carrier","bl_date":"","bl_type":"OBL","shipper":{"name":"","address":"","brn":""},"consignee":{"name":"","address":"","country":""},"notify_party":{"name":"","address":""},"vessel_or_flight":"","voyage_or_flight_number":"","port_of_loading":"","port_of_discharge":"","freight_terms":"Prepaid","container_details":[{"container_no":"","seal_no":"","type":"","packages":0,"description":"","gross_weight_kg":0,"cbm":0}],"total_packages":0,"total_gross_weight_kg":0,"total_cbm":0,"place_of_issue":"Port Klang","number_of_originals":3}` },
      ];

      const settled = await Promise.allSettled(configs.map(c => glmJSON(c.sys, ctx)));
      const generated: string[] = [];
      const failed: string[]    = [];

      settled.forEach((res, i) => {
        const cfg = configs[i];
        if (res.status === "fulfilled" && !res.value.parse_error) {
          sessionData.current.documents = { ...(sessionData.current.documents as object ?? {}), [cfg.id.replace(/-/g, "_")]: res.value };
          setGeneratedIds(prev => new Set([...prev, cfg.id]));
          if      (cfg.id === "commercial-invoice") generateInvoicePDF(res.value);
          else if (cfg.id === "bol")                generateBOLPDF(res.value);
          else if (cfg.id === "packing-list")       generatePackingListPDF(res.value);
          else if (cfg.id === "coo")                generateCOOPDF(res.value);
          generated.push(cfg.title);
        } else {
          failed.push(cfg.title);
        }
      });

      if (generated.length) addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `✅ **${generated.length} document(s) generated & downloaded:** ${generated.join(", ")}.\n\nNow add your **e-signature** to unlock the K2 form.`,
      });
      if (failed.length) addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `⚠️ Failed to generate: ${failed.join(", ")}. Please try again.`,
      });
    }, "Generating 4 trade documents…");
  }, [runWithFeedback, buildCtx, addMsg]);

  // ── Step 7: E-Signature ───────────────────────────────────────────────────
  const handleSign = useCallback(() => {
    setSigned(true);
    setModal(null);
    addMsg({ id: genId(), role: "assistant", kind: "text",
      content: "✅ Declaration signed. K2 export declaration is now ready for preview and submission.",
    });
    advanceUI();
  }, [advanceUI, addMsg]);

  // ── Step 8: K2 Preview ────────────────────────────────────────────────────
  const handlePreviewK2 = useCallback(async () => {
    await runWithFeedback(async () => {
      const K2_SYS = `Generate a complete K2 Customs Export Declaration for MyDagangNet/MyECIS (Customs Act 1967). Return JSON: {"k2_reference":"K2-MY-2026-001","declaration_type":"EX","export_date":"","k2_form_data":{"header":{"declaration_type":"EX","customs_procedure_code":"10","regime_type":"Export"},"exporter":{"name":"","brn":"","address":""},"consignee":{"name":"","country_code":"","address":""},"transport":{"mode_code":"1","mode_description":"Sea","vessel_flight_name":"","voyage_flight_number":"","port_of_loading_code":"","port_of_discharge_code":"","country_of_destination_code":"","container_indicator":"Y"},"goods":{"item_number":1,"commodity_description":"","hs_code":"","country_of_origin":"MY","quantity":0,"unit_of_quantity":"","gross_weight_kg":0,"net_weight_kg":0,"number_of_packages":0,"package_type_code":"CTN","container_number":""},"valuation":{"fob_value_myr":0,"invoice_currency":"MYR","invoice_amount":0,"exchange_rate":1.0,"incoterm":"FOB","freight_myr":0,"insurance_myr":0,"cif_value_myr":0},"duty":{"export_duty_myr":0,"customs_duty_myr":0,"sst_myr":0,"total_duty_myr":0},"fta":{"fta_claimed":false,"fta_name":"","form_type":"","preferential_rate":0.0},"signatory":{"name":"","nric_passport":"","designation":"","date":""}},"compliance_notes":[],"warnings":[]}`;
      const k2 = await glmJSON(K2_SYS, buildCtx());
      setK2Data(k2);
      setModal("k2-preview");
    }, "Building K2 declaration…");
  }, [runWithFeedback, buildCtx]);

  // ── Step 8: K2 Submit ─────────────────────────────────────────────────────
  const handleK2Submit = useCallback(async () => {
    setModalLoading(true);
    try {
      if (k2Data) generateK2PDF(k2Data);
      setModal(null);
      advanceUI();
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `⚠️ K2 error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally { setModalLoading(false); }
  }, [k2Data, advanceUI, addMsg]);

  // ── Step 3: Permit check ──────────────────────────────────────────────────
  const runPermitCheckFromResult = useCallback(async (cls: Record<string, unknown>) => {
    const hsCode      = String(cls.hs_code       ?? "0000.00.00");
    const description = String(cls.hs_description ?? "unknown");
    const destCountry = String((sessionData.current.consignee as Record<string, string>)?.buyer_country ?? "Unknown");
    try {
      const result = await glmJSON(
        `You are a Malaysian export permits specialist. Reference: Strategic Goods (Control) Act 2010, Customs (Prohibition of Exports) Order 1988.
Return JSON: {"permits_required":[{"name":"","issuing_body":"","mandatory":true,"processing_days":0,"portal":""}],"sirim_required":false,"halal_required":false,"miti_license_required":false,"strategic_goods_control":false,"none_required":true,"notes":[]}`,
        `HS Code: ${hsCode}, Product: ${description}, Destination: ${destCountry}`
      );
      setPermitFlags({
        needsSirim: Boolean(result.sirim_required || cls.sirim_required),
        needsHalal: Boolean(result.halal_required || cls.halal_required),
        needsCoo: true,
      });
      const permits = (result.permits_required as Array<Record<string, string>> ?? [])
        .filter(p => String(p.mandatory) !== "false" && p.name?.trim() && !result.none_required);

      if (permits.length === 0 || result.none_required) {
        addMsg({ id: genId(), role: "assistant", kind: "text",
          content: `✅ HS ${hsCode} — No controlled permits required. Proceeding to Step 5: Digital Access.`,
        });
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
        content: "✅ Permit check complete. No controlled permits flagged. Proceeding to Step 5: Digital Access.",
      });
      setCompleted(prev => new Set([...prev, 3]));
      setActiveStep(4);
      setMessages(m => [...m, STEP_FLOW[4].intro]);
    }
  }, [addMsg]);

  // Step 3 auto-trigger
  useEffect(() => {
    if (activeStep === 3 && !completed.has(3)) {
      const cls = (sessionData.current.classification ?? {}) as Record<string, unknown>;
      runPermitCheckFromResult(cls);
    }
  }, [activeStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-permit certificate upload ─────────────────────────────────────────
  const handlePermitUpload = useCallback(async (permitKey: string, file: File) => {
    addMsg({ id: genId(), role: "user", kind: "upload", content: "uploaded-file", fileName: file.name });
    let valid = false;
    try {
      const b64    = await fileToB64(file);
      const result = await geminiVision(b64, fileMime(file),
        `Validate this Malaysian export permit or certificate. Return JSON: {"is_valid":true,"permit_type":"","issuing_body":"","certificate_number":"","expiry_date":"","confidence":0.9}`
      );
      valid = Boolean(result.is_valid);
      addMsg({
        id: genId(), role: "assistant", kind: "extracted",
        content: valid ? "✅ Permit validated:" : "⚠️ Issues — please re-upload:",
        valid,
        fields: {
          "Permit Type":    String(result.permit_type        ?? "—"),
          "Certificate No": String(result.certificate_number ?? "—"),
          "Issuing Body":   String(result.issuing_body       ?? "—"),
          "Expiry Date":    String(result.expiry_date        ?? "—"),
        },
      });
    } catch { valid = true; }

    if (valid) {
      setRequiredPermits(prev => {
        const next    = prev.map(p => p.key === permitKey ? { ...p, uploaded: true } : p);
        const allDone = next.every(p => p.uploaded);
        if (allDone) {
          setTimeout(() => {
            addMsg({ id: genId(), role: "assistant", kind: "text",
              content: "✅ All permit certificates validated. Proceeding to Step 5: Digital Access.",
            });
            setCompleted(c => new Set([...c, 3]));
            setActiveStep(4);
            setMessages(m => [...m, STEP_FLOW[4].intro]);
          }, 500);
        }
        return next;
      });
    }
  }, [addMsg]);

  // ── Right-panel individual doc download ───────────────────────────────────
  const handleGenerate = useCallback(async (id: string) => {
    if (generatedIds.has(id) || generatingId) return;
    setGeneratingId(id);
    try {
      const ctx = buildCtx();
      const sysMap: Record<string, { title: string; sys: string }> = {
        "commercial-invoice": { title: "Commercial Invoice",
          sys: `Generate a Malaysian export Commercial Invoice. Return JSON: {"invoice_number":"CI-MY-2026-001","invoice_date":"","payment_terms":"T/T","exporter":{"name":"","brn":"","address":"","tel":"","email":"","bank":""},"consignee":{"name":"","country":"","address":"","tax_id":"","contact_person":""},"goods":[{"line_no":1,"hs_code":"","description":"","quantity":0,"unit":"","unit_price":0,"total":0}],"incoterm":"FOB","port_of_loading":"","port_of_discharge":"","currency":"MYR","subtotal":0,"freight":0,"insurance":0,"total_fob":0,"total_cif":0,"vessel_or_flight":""}` },
        "packing-list": { title: "Packing List",
          sys: `Generate a Malaysian export Packing List. Return JSON: {"packing_list_number":"PL-MY-2026-001","date":"","exporter":{"name":"","address":""},"consignee":{"name":"","country":"","address":""},"invoice_reference":"","vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","packages":[{"package_no":"1","type":"CTN","description":"","gross_weight_kg":0,"net_weight_kg":0,"cbm":0,"quantity_inside":0}],"total_packages":0,"total_gross_weight_kg":0,"total_net_weight_kg":0,"total_cbm":0}` },
        "bol": { title: "Bill of Lading",
          sys: `Generate a Bill of Lading for Malaysian export. Return JSON: {"bl_number":"TBC - Assigned by carrier","bl_date":"","bl_type":"OBL","shipper":{"name":"","address":"","brn":""},"consignee":{"name":"","address":"","country":""},"notify_party":{"name":"","address":""},"vessel_or_flight":"","voyage_or_flight_number":"","port_of_loading":"","port_of_discharge":"","freight_terms":"Prepaid","container_details":[{"container_no":"","type":"","packages":0,"description":"","gross_weight_kg":0,"cbm":0}],"total_packages":0,"total_gross_weight_kg":0,"total_cbm":0}` },
        "coo": { title: "Certificate of Origin",
          sys: `Generate a Certificate of Origin for Malaysian export (ATIGA Form D). Return JSON: {"co_number":"CO-MY-2026-001","co_date":"","form_type":"Form D (ATIGA)","issuing_body":"MATRADE","exporter":{"name":"","address":"","country":"Malaysia","brn":""},"consignee":{"name":"","address":"","country":""},"transport_details":{"vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","departure_date":""},"goods":[{"item_no":1,"description":"","hs_code":"","origin_criterion":"WO","quantity":"","gross_weight_kg":0,"fob_value_myr":0}],"invoice_reference":""}` },
        "k2": { title: "K2 Customs Export Declaration",
          sys: `Generate a K2 export declaration. Return JSON: {"k2_reference":"K2-MY-2026-001","declaration_type":"EX","export_date":"","k2_form_data":{"exporter":{"name":"","brn":"","address":""},"consignee":{"name":"","country_code":"","address":""},"transport":{"mode_code":"1","mode_description":"Sea","vessel_flight_name":"","port_of_loading_code":"","port_of_discharge_code":"","country_of_destination_code":""},"goods":{"commodity_description":"","hs_code":"","country_of_origin":"MY","quantity":0,"unit_of_quantity":"","gross_weight_kg":0,"number_of_packages":0,"container_number":""},"valuation":{"fob_value_myr":0,"cif_value_myr":0,"invoice_currency":"MYR","incoterm":"FOB"},"duty":{"export_duty_myr":0,"total_duty_myr":0},"signatory":{"name":"","nric_passport":"","designation":"","date":""}}}` },
        "sirim": { title: "SIRIM Checklist",
          sys: `Generate a SIRIM export compliance checklist. Return JSON: {"checklist_items":[{"item":"","status":"required","reference":""}],"sirim_scheme":"","processing_weeks":0,"portal":"https://www.sirim-qas.com.my"}` },
        "halal": { title: "Halal Checklist",
          sys: `Generate a JAKIM Halal export checklist. Return JSON: {"checklist_items":[{"item":"","status":"required"}],"jakim_scheme":"","processing_weeks":0,"portal":"https://www.halal.gov.my"}` },
      };
      const cfg = sysMap[id];
      if (!cfg) return;
      const result = await glmJSON(cfg.sys, ctx);
      if (id === "k2") setK2Data(result);
      sessionData.current.documents = { ...(sessionData.current.documents as object ?? {}), [id.replace(/-/g, "_")]: result };
      if      (id === "commercial-invoice") generateInvoicePDF(result);
      else if (id === "bol")                generateBOLPDF(result);
      else if (id === "k2")                 generateK2PDF(result);
      else if (id === "packing-list")       generatePackingListPDF(result);
      else if (id === "coo")                generateCOOPDF(result);
      else makePDF(cfg.title, [`## ${cfg.title}`, ...flatLines(result)]);
      setGeneratedIds(prev => new Set([...prev, id]));
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `⚠️ Error generating ${id}: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally { setGeneratingId(null); }
  }, [generatedIds, generatingId, buildCtx, addMsg]);

  // ── Action button dispatcher ───────────────────────────────────────────────
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
    if (requiredStep !== undefined && activeStep < requiredStep && !completed.has(requiredStep)) {
      const blocking = STEPS[requiredStep];
      addMsg({ id: genId(), role: "assistant", kind: "blocked",
        content: `Step ${requiredStep + 1} — "${blocking.title}" — is not active yet. Complete the current step first.`,
      });
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
    if (action === "generate-docs")    { await handleGenerateDocs();  return; }
    if (action === "lookup-hs") {
      addMsg({ id: genId(), role: "user", kind: "text", content: label });
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: "Please type your product description in the chat and I'll classify it to AHTN 2022 automatically.",
      });
      return;
    }

    // verify-ssm fallback
    if (action === "verify-ssm") {
      addMsg({ id: genId(), role: "user", kind: "text", content: label });
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: "Please provide your company details manually:\n\n> Company Name: ABC SDN BHD\n> BRN: 202301012345\n> Company Type: Sdn Bhd\n> Directors: Ahmad bin Ali",
      });
    }
  }, [activeStep, completed, addMsg, handleGenerateDocs]);

  // ── Step jump ─────────────────────────────────────────────────────────────
  const tryJumpTo = useCallback((stepId: number) => {
    if (stepId === activeStep) return;
    if (completed.has(stepId)) { setActiveStep(stepId); return; }
    const blocking = STEPS.slice(0, stepId).find(s => !completed.has(s.id));
    if (!blocking) { setActiveStep(stepId); return; }
    addMsg({ id: genId(), role: "assistant", kind: "blocked",
      content: `Step ${stepId + 1} is locked. Complete Step ${blocking.id + 1} — "${blocking.title}" — first.`,
    });
  }, [completed, activeStep, addMsg]);

  // ── Chat send ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const raw = input.trim();
    setInput("");
    addMsg({ id: genId(), role: "user", kind: "text", content: raw });
    setSending(true);

    // Step 0: handle partial SSM extraction — confirm or correct
    if (activeStep === 0 && !completed.has(0) && sessionData.current.entity) {
      const entity = sessionData.current.entity as Record<string, unknown>;
      if (entity.partial_extraction) {
        const lower = raw.toLowerCase().trim();
        const isConfirm = ["confirm", "ok", "proceed", "yes", "correct", "looks good"].some(k => lower === k || lower.startsWith(k));
        if (isConfirm) {
          sessionData.current.entity = { ...entity, partial_extraction: false, is_valid: true };
          addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Confirmed — proceeding with extracted details." });
          setSending(false);
          advanceUI();
          return;
        }
        try {
          const corrected = await glmJSON(
            `Extract company registration details from the user's message. Return ONLY valid JSON:
{"company_name":"","registration_number":"","company_type":"Sdn Bhd","company_status":"active","directors":[{"name":"","nric":"","designation":"Director"}],"paid_up_capital":"","sst_registered":false}`,
            `Existing data: company_name="${entity.company_name}", BRN="${entity.registration_number}". User correction: ${raw}`
          );
          const merged: Record<string, unknown> = {
            ...entity, ...corrected,
            company_name:        hasMeaning(corrected.company_name)        ? corrected.company_name        : entity.company_name,
            registration_number: hasMeaning(corrected.registration_number) ? corrected.registration_number : entity.registration_number,
            partial_extraction: false, is_valid: true,
          };
          sessionData.current.entity = merged;
          const dirs = (merged.directors as Array<{ name: string }> ?? []).map(d => d.name).filter(Boolean).join(", ");
          addMsg({
            id: genId(), role: "assistant", kind: "extracted",
            content: "Updated details:",
            valid: true,
            fields: {
              "Company Name": hasMeaning(merged.company_name)       ? String(merged.company_name)        : "—",
              "BRN":          hasMeaning(merged.registration_number) ? String(merged.registration_number) : "—",
              "Company Type": hasMeaning(merged.company_type)        ? String(merged.company_type)        : "—",
              "Directors":    dirs || "—",
            },
          });
          if (hasMeaning(merged.company_name) && hasMeaning(merged.registration_number)) {
            addMsg({ id: genId(), role: "assistant", kind: "text", content: "✅ Company Name and BRN confirmed. Proceeding to Step 2." });
            setSending(false);
            advanceUI();
            return;
          } else {
            addMsg({ id: genId(), role: "assistant", kind: "text",
              content: `Still missing: **${!hasMeaning(merged.company_name) ? "Company Name" : ""}${!hasMeaning(merged.registration_number) ? " BRN" : ""}**. Please provide, or type **"confirm"** to proceed.`,
            });
          }
        } catch {
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `Please use this format:\n\n> Company Name: ABC SDN BHD\n> BRN: 202301012345\n\nOr type **"confirm"** to proceed.`,
          });
        }
        setSending(false);
        return;
      }
    }

    // Step 2: treat chat input as product description for HS classification
    if (activeStep === 2 && !completed.has(2)) {
      try {
        const destCountry = String((sessionData.current.consignee as Record<string, string>)?.buyer_country ?? "Unknown");
        const result = await glmJSON(
          `You are an HS tariff classification expert for Malaysian exports (WCO HS 2022 / AHTN 2022). Destination: ${destCountry}.
Return JSON: {"identified":true,"hs_code":"","hs_description":"","product_name":"","malaysia_export_duty":0.0,"destination_import_duty":0.0,"fta_available":[],"permit_required":[],"sirim_required":false,"halal_required":false,"miti_required":false,"confidence":0.9}`,
          `Product: ${raw}`
        );
        const hsCode     = String(result.hs_code ?? "").trim();
        const identified = Boolean(result.identified) && hsCode.length > 0 && !hsCode.startsWith("XXXX") && Number(result.confidence ?? 0) > 0.3;
        if (identified) {
          sessionData.current.classification = result;
          addMsg({
            id: genId(), role: "assistant", kind: "hs-result",
            content: "Product classified:",
            hsCode, description: String(result.hs_description ?? "—"),
            duty:   Number(result.destination_import_duty ?? 0),
            fta:    (result.fta_available as string[] ?? []),
            permitRequired: Boolean((result.permit_required as unknown[])?.length || result.sirim_required || result.halal_required || result.miti_required),
            permits: (result.permit_required as string[] ?? []),
          });
          await runPermitCheckFromResult(result);
        } else {
          addMsg({ id: genId(), role: "assistant", kind: "text",
            content: `⚠️ Could not classify "${raw}" with confidence. Please be more specific or upload a product photo.`,
          });
        }
      } catch (err) {
        addMsg({ id: genId(), role: "assistant", kind: "text",
          content: `⚠️ Classification error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally { setSending(false); }
      return;
    }

    // General AI chat
    try {
      const e  = (sessionData.current.entity        as Record<string, string>) ?? {};
      const c  = (sessionData.current.consignee      as Record<string, string>) ?? {};
      const cl = (sessionData.current.classification as Record<string, string>) ?? {};
      const v  = (sessionData.current.valuation      as Record<string, unknown>) ?? {};
      const l  = (sessionData.current.logistics      as Record<string, unknown>) ?? {};
      const system = `You are Architect AI, a Malaysian export compliance expert for Borderless AI.
You guide exporters through a 9-step workflow. The user has ALREADY COMPLETED the steps shown — do NOT ask them to redo any completed step.

Current session state:
- Active step: ${activeStep + 1}/9 — ${STEPS[activeStep]?.title ?? ""}
- Entity: ${e.company_name ? `✅ ${e.company_name} (BRN: ${e.registration_number})` : "⏳ Not yet verified"}
- Consignee: ${c.buyer_name ? `✅ ${c.buyer_name}, ${c.buyer_country}` : "⏳ Not yet added"}
- HS Code: ${cl.hs_code ? `✅ ${cl.hs_code} — ${cl.hs_description}` : "⏳ Not yet classified"}
- Valuation: ${v.fob_myr ? `✅ FOB RM${v.fob_myr}` : "⏳ Not yet entered"}
- Logistics: ${l.mode ? `✅ ${l.mode} — ${l.pol} → ${l.pod}` : "⏳ Not yet set"}

Be concise and practical. Reference Malaysian regulations when relevant (Customs Act 1967, ATIGA, PUA122). Respond in the same language as the user.`;

      const reply = await glmText(system, raw, chatHistoryRef.current.slice(-10));
      chatHistoryRef.current = [...chatHistoryRef.current.slice(-14), { role: "user", content: raw }, { role: "assistant", content: reply }];
      addMsg({ id: genId(), role: "assistant", kind: "text", content: reply });
    } catch (err) {
      addMsg({ id: genId(), role: "assistant", kind: "text",
        content: `⚠️ ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally { setSending(false); }
  }, [input, sending, activeStep, completed, advanceUI, addMsg, runPermitCheckFromResult]);

  const signatoryName  = ((sessionData.current.logistics as Record<string, string>)?.signatory_name)        || "";
  const signatoryTitle = ((sessionData.current.logistics as Record<string, string>)?.signatory_designation) || "";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary/30">
      <TopNav />

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

      {/* MODALS */}
      {modal === "consignee"      && <ConsigneeModal      onClose={() => setModal(null)} onSubmit={handleConsigneeSubmit}      loading={modalLoading} />}
      {modal === "valuation"      && <ValuationModal      onClose={() => setModal(null)} onSubmit={handleValuationSubmit}      loading={modalLoading} hsCode={((sessionData.current.classification as Record<string, string>)?.hs_code) || ""} />}
      {modal === "shipment"       && <ShipmentModal       onClose={() => setModal(null)} onSubmit={handleShipmentSubmit}       loading={modalLoading} />}
      {modal === "digital-access" && <DigitalAccessModal  onClose={() => setModal(null)} onSubmit={handleDigitalAccessSubmit}  loading={modalLoading} companyBrn={((sessionData.current.entity as Record<string, string>)?.registration_number) || "202301045678"} />}
      {modal === "signature"      && <SignatureModal signatoryName={signatoryName} signatoryTitle={signatoryTitle} onClose={() => setModal(null)} onSign={handleSign} />}
      {modal === "k2-preview" && k2Data && <K2PreviewModal k2Data={k2Data} onClose={() => setModal(null)} onSubmit={handleK2Submit} loading={modalLoading} />}

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px] xl:grid-cols-[260px_1fr_320px]">

          {/* ── LEFT: Step Checklist ─────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Export Checklist</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{completed.size}/{total}</span>
              </div>
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
                  <span>Progress</span><span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
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
                      {!isLast && (
                        <span className={`absolute left-[19px] top-9 h-[calc(100%-12px)] w-px ${isCompleted ? "bg-green-300" : "bg-border"}`} />
                      )}
                      <button type="button" onClick={() => tryJumpTo(step.id)}
                        className={`relative flex w-full items-start gap-3 rounded-xl p-2 text-left transition-colors ${isActive ? "bg-primary/10 ring-1 ring-primary/30" : isCompleted ? "hover:bg-secondary/60" : "opacity-60 hover:opacity-80"}`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isCompleted ? "bg-green-500 text-white" : isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
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
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Doc Status</h3>
                <ul className="space-y-1.5">
                  {EXPORT_DOCS.map(doc => {
                    const isDone      = generatedIds.has(doc.id);
                    const missing     = doc.requiredSteps.filter(s => !completed.has(s));
                    const blockingStep = missing.length > 0 ? STEPS[missing[0]] : null;
                    const gating      = isGating(doc, permitFlags);
                    return (
                      <li key={doc.id} className="flex items-center gap-2 text-[11px]">
                        {isDone
                          ? <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                          : blockingStep
                          ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />}
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
            <section className="flex min-h-[70vh] flex-col rounded-2xl border border-border bg-card shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Architect AI</div>
                    <div className="text-[11px] text-muted-foreground">Step {activeStep + 1} · {STEPS[activeStep]?.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />AI Active
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onAction={handleAction}
                    onPermitUpload={handlePermitUpload}
                    onPreviewK2={handlePreviewK2}
                    signed={signed}
                    activeStep={activeStep}
                  />
                ))}
                {sending && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Cog className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">Processing…</div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border bg-card/60 p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/40">
                  <button
                    type="button"
                    onClick={() => {
                      pendingUploadRef.current = { action: "chat-attachment", accept: ".pdf,.jpg,.jpeg,.png", endpoint: "/documents/upload" };
                      if (fileInputRef.current) { fileInputRef.current.accept = ".pdf,.jpg,.jpeg,.png"; fileInputRef.current.click(); }
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type business details or ask about a regulation…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-24"
                  />
                  <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    type="button" onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                  <span>Architect AI may request supporting documents.</span><span>↵ to send</span>
                </div>
              </div>
            </section>

            {/* Landed Cost */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated</div>
                  <div className="text-sm font-semibold text-foreground">Landed Cost</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${landedCost.finalised ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {landedCost.finalised ? "Finalised" : "Not Final"}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-4">
                {[
                  { label: "FOB Value",           value: `RM ${landedCost.fob > 0 ? landedCost.fob.toLocaleString() : "0"}` },
                  { label: "Insurance + Freight",  value: `RM ${landedCost.fob > 0 ? (landedCost.freight + landedCost.insurance).toLocaleString() : "0"}` },
                  { label: "Estimated Duty",       value: `RM ${landedCost.fob > 0 ? landedCost.duty.toLocaleString() : "0"}` },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-l border-border pl-6">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-semibold text-foreground">
                    RM {landedCost.fob > 0 ? (landedCost.fob + landedCost.freight + landedCost.insurance + landedCost.duty).toLocaleString() : "0"}
                  </span>
                </div>
                {landedCost.savings > 0 && (
                  <div className="flex w-full items-start gap-2 rounded-xl bg-green-50 p-2.5">
                    <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <p className="text-[11px] leading-relaxed text-green-700">
                      Potential <strong>RM {landedCost.savings.toLocaleString()} saved</strong>
                      {landedCost.bestFta ? ` via ${landedCost.bestFta}` : " if ATIGA Form D is filed"}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Document Pack ──────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Export</div>
                  <div className="text-sm font-semibold text-foreground">Document Pack</div>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{generatedIds.size} Ready</span>
              </div>
              <div className="max-h-[540px] space-y-1 overflow-y-auto px-3 py-3">
                {readyDocs.length > 0 && (
                  <>
                    <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-600">✓ Ready to Generate</div>
                    {readyDocs.map(doc => {
                      const Icon        = doc.icon;
                      const isGenerating = generatingId === doc.id;
                      const isGenerated  = generatedIds.has(doc.id);
                      const gating       = isGating(doc, permitFlags);
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-50"><Icon className="h-3.5 w-3.5 text-green-600" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                              {gating && <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-px text-[8px] font-bold uppercase text-primary">Req</span>}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">{doc.sublabel}</div>
                          </div>
                          <button
                            type="button" onClick={() => handleGenerate(doc.id)}
                            disabled={isGenerated || isGenerating}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors ${isGenerated ? "bg-green-500 text-white" : isGenerating ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                          >
                            {isGenerated ? <CheckCircle2 className="h-3 w-3" /> : isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {partialDocs.length > 0 && (
                  <>
                    <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-amber-600">⚡ Needs More Info</div>
                    {partialDocs.map(doc => {
                      const Icon    = doc.icon;
                      const missing = doc.requiredSteps.filter(s => !completed.has(s)).map(s => STEPS.find(st => st.id === s)?.title).filter(Boolean);
                      return (
                        <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 opacity-75">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50"><Icon className="h-3.5 w-3.5 text-amber-600" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-foreground">{doc.label}</div>
                            <div className="truncate text-[10px] text-amber-600">Need: {missing.slice(0, 2).join(", ")}</div>
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
                      const Icon        = doc.icon;
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
                    <button
                      type="button" onClick={handlePreviewK2} disabled={sending}
                      className="w-full rounded-xl bg-primary px-4 py-2.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />Preview & Submit K2
                    </button>
                  </div>
                )}

                {readyDocs.filter(d => !generatedIds.has(d.id)).length > 1 && (
                  <div className="pb-1 pt-3">
                    <button
                      type="button"
                      onClick={() => readyDocs.forEach(d => !generatedIds.has(d.id) && handleGenerate(d.id))}
                      className="w-full rounded-xl bg-primary px-4 py-2.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90 transition-colors"
                    >
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
          <button
            type="button"
            onClick={() => navigate("/logistics", {
              state: {
                carriedDocs: EXPORT_DOCS
                  .filter(d => generatedIds.has(d.id))
                  .map(d => ({ id: d.id, label: d.label, sublabel: d.sublabel, status: "ready" })),
              },
            })}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-primary/40 transition-all hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
          >
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
function MessageBubble({ msg, onAction, onPermitUpload, onPreviewK2, signed, activeStep }: {
  msg: Message;
  onAction: (action: string, label: string) => void;
  onPermitUpload: (permitKey: string, file: File) => void;
  onPreviewK2: () => void;
  signed: boolean;
  activeStep: number;
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
          {msg.kind === "upload"
            ? <div className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /><span>{(msg as { fileName: string }).fileName}</span></div>
            : msg.content}
        </div>
      </div>
    );
  }

  if (msg.kind === "blocked") {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50"><AlertTriangle className="h-4 w-4 text-red-500" /></div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50/50 px-4 py-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-red-500">Dependency Blocked</div>
          <p className="text-sm text-foreground">{msg.content}</p>
        </div>
      </div>
    );
  }

  if (msg.kind === "processing") {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Link2 className="h-4 w-4 text-primary" /></div>
        <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">{msg.content}</div>
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
          <div className={`rounded-2xl border p-3 ${m.valid ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}`}>
            <div className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${m.valid ? "text-green-600" : "text-amber-600"}`}>
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
              <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold font-mono text-primary">{m.hsCode}</span>
              <span className="text-sm font-semibold text-foreground flex-1">{m.description}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-secondary px-2 py-1.5">
                <span className="text-muted-foreground">Import Duty: </span>
                <span className="font-bold text-foreground">{m.duty}%</span>
              </div>
              {m.fta.length > 0 && (
                <div className="rounded-lg bg-green-50 px-2 py-1.5">
                  <span className="text-green-700 font-medium">FTA: {m.fta.join(", ")}</span>
                </div>
              )}
            </div>
            {m.permitRequired && m.permits.length > 0
              ? <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-2 text-[11px]"><span className="font-semibold text-amber-700">⚠ Permit(s): </span><span className="text-amber-700">{m.permits.join(", ")}</span></div>
              : <div className="rounded-lg bg-green-50 px-2 py-1.5 text-[11px] font-semibold text-green-700">✅ No PUA122 permits required</div>
            }
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
                <input ref={el => { fileRefs.current[p.key] = el; }} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPermitUpload(p.key, f); }}
                />
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${p.uploaded ? "bg-green-50" : "bg-amber-50"}`}>
                  {p.uploaded ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Award className="h-4 w-4 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-foreground truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.uploaded ? "Uploaded ✓" : "Certificate required"}</div>
                </div>
                {!p.uploaded && (
                  <button type="button" onClick={() => fileRefs.current[p.key]?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 transition-colors"
                  >
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
              { l: "FOB Value",       v: `RM ${m.fob.toLocaleString()}` },
              { l: "Freight",         v: `RM ${m.freight.toLocaleString()}` },
              { l: "Insurance",       v: `RM ${m.insurance.toLocaleString()}` },
              { l: "Est. Import Duty",v: `RM ${m.duty.toLocaleString()}` },
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
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-2.5 py-2 text-[11px] font-semibold text-green-700">
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
                  <button key={i} type="button" onClick={() => onAction(a.action, a.label)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${a.intent === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border bg-card text-foreground hover:bg-secondary"}`}
                  >
                    <Icon className="h-4 w-4" />{a.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // default: text
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-foreground space-y-1">
          {renderMarkdown(msg.content)}
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
      <Sparkles className="h-4 w-4 text-primary-foreground" />
    </div>
  );
}

function StatusTag({ status }: { status: ChecklistStatus }) {
  const styles: Record<ChecklistStatus, string> = {
    REQUIRED:  "bg-red-50 text-red-600",
    PENDING:   "bg-amber-50 text-amber-600",
    COMPLETED: "bg-green-50 text-green-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles[status]}`}>
      [{status}]
    </span>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines    = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={key} className="my-1.5 space-y-1 pl-1">
        {listItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{inlineFormat(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(`list-${idx}`); return; }
    const bulletMatch  = trimmed.match(/^[*\-]\s+(.+)/);
    if (bulletMatch)  { listItems.push(bulletMatch[1]); return; }
    const numMatch     = trimmed.match(/^\d+\.\s+(.+)/);
    if (numMatch)     { listItems.push(numMatch[1]); return; }
    const headingMatch = trimmed.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) {
      flushList(`list-${idx}`);
      nodes.push(<p key={idx} className="mt-2 mb-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{headingMatch[1]}</p>);
      return;
    }
    flushList(`list-${idx}`);
    nodes.push(<p key={idx} className="text-sm leading-relaxed">{inlineFormat(trimmed)}</p>);
  });
  flushList("list-end");
  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="rounded bg-secondary px-1 py-0.5 text-[12px] font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}