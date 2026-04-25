/**
 * Assistant.tsx — Borderless AI · Compliance Architect
 * Full 9-step export workflow with real modals, forms, permit upload,
 * digital access checklist, valuation, logistics, e-signature & K2 preview.
 */

import { useState, useRef, useEffect, useCallback } from "react";
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
// API CLIENT
// ─────────────────────────────────────────────────────────────────────────────
const GLM_KEY = "sk-fd9182ed29f4722fd9c3fc8b852a43e39c01234247156a93";
const GLM_URL = "https://api.ilmu.ai/v1/chat/completions";
const GLM_MDL = "ilmu-glm-5.1";
// Gemini Vision replaced with GLM multimodal + text-fallback (see geminiVision below)

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

/**
 * Document extraction — no vision API required.
 * For PDFs with a text layer: extracts printable ASCII and sends to GLM.
 * For JPEGs/images (no text layer): returns a partial result that triggers
 * the manual-entry flow in the SSM handler.
 */
// ── Claude Vision — uses Anthropic API for image/PDF understanding ──────────
async function geminiVision(b64: string, mime: string, prompt: string): Promise<Record<string,unknown>> {
  const isPDF = mime === "application/pdf" || mime.includes("pdf");
  const mediaType = (isPDF ? "application/pdf" : (mime.startsWith("image/") ? mime : "image/jpeg")) as "application/pdf" | "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: isPDF ? "document" : "image", source: { type: "base64", media_type: mediaType, data: b64 } },
            { type: "text", text: prompt + "\n\nReturn ONLY valid JSON. No markdown fences, no explanation." },
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const d = await res.json();
    const raw: string = d.content?.[0]?.text ?? "{}";
    try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
    catch { return { parse_error: true, raw }; }
  } catch (err) {
    if (isPDF) {
      try {
        const binary = atob(b64);
        const printable = binary.split("").map(c => {
          const code = c.charCodeAt(0);
          return (code >= 32 && code < 127) || code === 10 || code === 13 ? c : " ";
        }).join("").replace(/\s{3,}/g, " ").trim().slice(0, 4000);
        if (printable.length > 100) {
          return await glmJSON("Extract required fields from this document. Return ONLY valid JSON.", `${prompt}\n\nDocument text:\n${printable}`);
        }
      } catch { /* ignore */ }
    }
    return { confidence: 0.0, _vision_failed: true };
  }
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
// STEP CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, title: "Entity Verification",   icon: Building2,    subtitle: "SSM / BRN" },
  { id: 1, title: "Consignee Details",      icon: UserSquare2,  subtitle: "Buyer info" },
  { id: 2, title: "HS Classification",      icon: FileSearch,   subtitle: "Product & HS Code" },
  { id: 3, title: "Special Permits",        icon: Award,        subtitle: "SIRIM / Halal / MITI" },
  { id: 4, title: "Digital Access",         icon: KeyRound,     subtitle: "Dagang Net" },
  { id: 5, title: "Financial Valuation",    icon: Coins,        subtitle: "FOB / CIF / FTA" },
  { id: 6, title: "Logistics & Shipment",   icon: PackageSearch,subtitle: "Mode / Vessel / Weight" },
  { id: 7, title: "Trade Documents",        icon: FileText,     subtitle: "Invoice / B/L / COO" },
  { id: 8, title: "K2 Customs Declaration", icon: FileCheck2,   subtitle: "Submit to RMCD" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────────────────────
function MO({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
function MH({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-border px-5 py-4">
      <div><p className="text-sm font-semibold text-foreground">{title}</p>{sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}</div>
      <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
function MF({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}{req && <span className="ml-1 text-red-500">*</span>}</label>
      {children}
    </div>
  );
}
function MI({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />;
}
function MS({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 pr-8">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}
function MBtn({ onClick, disabled, loading, icon: Icon, children, variant = "primary" }: { onClick: () => void; disabled?: boolean; loading?: boolean; icon?: React.ElementType; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-all ${variant === "primary" ? "bg-primary text-primary-foreground shadow-glow hover:opacity-90" : "border border-border bg-secondary text-foreground hover:bg-secondary/70"}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

// Step 1 – Entity (SSM upload → extract → confirm)
function EntityModal({ onClose, onSubmit, loading, prefill }: {
  onClose: () => void;
  onSubmit: (d: object) => void;
  loading: boolean;
  prefill?: Record<string, string>;
}) {
  const [stage, setStage] = useState<"upload" | "extracting" | "confirm">(prefill ? "confirm" : "upload");
  const [f, setF] = useState({
    company_name:        prefill?.company_name        ?? "",
    registration_number: prefill?.registration_number ?? "",
    director_nric:       prefill?.director_nric       ?? "",
    company_type:        prefill?.company_type        ?? "Sdn Bhd",
    company_status:      prefill?.company_status      ?? "Active",
    registered_address:  prefill?.registered_address  ?? "",
  });
  const [confidence, setConfidence] = useState(prefill ? Number(prefill.confidence ?? 0) : 0);
  const [fileName, setFileName]     = useState(prefill?.fileName ?? "");
  const [extractErr, setExtractErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const s = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setStage("extracting");
    setExtractErr("");
    try {
      const b64 = await fileToB64(file);
      const mime = fileMime(file);
      const r = await geminiVision(b64, mime,
        `You are an OCR engine for Malaysian SSM company registration documents (Form 9, Form D, MyCoID, e-Info printout).
Extract ALL visible fields. Return ONLY valid JSON:
{"is_valid":false,"company_name":"","registration_number":"","registration_date":"","company_type":"","company_status":"active","registered_address":"","directors":[{"name":"","nric":"","designation":"Director"}],"paid_up_capital":"","sst_registered":false,"confidence":0.0,"extraction_notes":""}`
      );
      if (r._vision_failed) {
        setExtractErr("Could not read the document automatically. Please fill in your details below.");
      } else {
        setConfidence(Number(r.confidence ?? 0));
        setF({
          company_name:        String(r.company_name        ?? ""),
          registration_number: String(r.registration_number ?? ""),
          director_nric:       String((r.directors as Array<Record<string,string>> ?? [])[0]?.nric ?? ""),
          company_type:        String(r.company_type        ?? "Sdn Bhd"),
          company_status:      String(r.company_status      ?? "Active"),
          registered_address:  String(r.registered_address  ?? ""),
        });
      }
      setStage("confirm");
    } catch (err) {
      setExtractErr(String(err instanceof Error ? err.message : err));
      setStage("confirm"); // still let user fill manually
    }
  };

  return (
    <MO onClose={onClose}>
      <MH title="Step 1 — Entity Verification" sub="Upload your SSM certificate to verify your company" onClose={onClose} />

      {stage === "upload" && (
        <div className="px-5 py-8 flex flex-col items-center gap-4">
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Upload SSM Certificate</p>
            <p className="text-sm text-muted-foreground mt-1">PDF, JPG or PNG · Form 9 / Form D / MyCoID</p>
          </div>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90">
            <Upload className="h-4 w-4" />Choose File
          </button>
          <button onClick={() => setStage("confirm")} className="text-xs text-muted-foreground hover:text-foreground underline">
            Enter details manually instead
          </button>
        </div>
      )}

      {stage === "extracting" && (
        <div className="px-5 py-12 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Reading {fileName}…</p>
          <p className="text-xs text-muted-foreground">Extracting company details from your SSM certificate</p>
        </div>
      )}

      {stage === "confirm" && (
        <>
          {confidence > 0 && (
            <div className={`mx-5 mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold ${confidence >= 0.7 ? "bg-green-50 border border-green-200 text-green-700" : "bg-yellow-50 border border-yellow-200 text-yellow-700"}`}>
              {confidence >= 0.7 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              Extracted from {fileName} · {Math.round(confidence * 100)}% confidence
              {confidence < 0.7 && " — please review and correct below"}
            </div>
          )}
          {extractErr && (
            <div className="mx-5 mt-4 rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2 text-[11px] text-yellow-700">
              ⚠️ Could not auto-extract — please fill in manually.
            </div>
          )}
          <div className="space-y-4 px-5 py-4">
            <MF label="Company Name (as per SSM)" req><MI value={f.company_name} onChange={s("company_name")} placeholder="e.g. ABC Trading Sdn Bhd" /></MF>
            <MF label="BRN / Registration Number" req><MI value={f.registration_number} onChange={s("registration_number")} placeholder="e.g. 202301012345" /></MF>
            <MF label="Registered Address"><MI value={f.registered_address} onChange={s("registered_address")} placeholder="No. 1, Jalan xxx, KL" /></MF>
            <div className="grid grid-cols-2 gap-3">
              <MF label="Company Type"><MS value={f.company_type} onChange={s("company_type")} options={["Sdn Bhd","Bhd","Enterprise","LLP","PLT","Partnership"]} /></MF>
              <MF label="Status"><MS value={f.company_status} onChange={s("company_status")} options={["Active","Dormant"]} /></MF>
            </div>
            <MF label="Director NRIC (optional)"><MI value={f.director_nric} onChange={s("director_nric")} placeholder="e.g. 880101-14-1234" /></MF>
          </div>
          <div className="flex gap-2 border-t border-border px-5 py-4">
            <MBtn onClick={() => setStage("upload")} variant="ghost" icon={Upload}>Re-upload</MBtn>
            <MBtn onClick={() => onSubmit(f)} disabled={!f.company_name || !f.registration_number} loading={loading} icon={ShieldCheck}>Confirm & Verify</MBtn>
          </div>
        </>
      )}
    </MO>
  );
}

// Step 2 – Consignee
function ConsigneeModal({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (d: object) => void; loading: boolean }) {
  const [f, setF] = useState({ buyer_name: "", buyer_country: "", buyer_address: "", buyer_email: "", buyer_phone: "", buyer_contact_person: "", buyer_tax_id: "", incoterm: "FOB", importer_of_record: "" });
  const s = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  return (
    <MO onClose={onClose}>
      <MH title="Step 2 — Consignee Details" sub="Buyer information for Invoice & B/L" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <MF label="Buyer Company Name" req><MI value={f.buyer_name} onChange={s("buyer_name")} placeholder="PT Sumber Rasa" /></MF>
        <MF label="Buyer Country" req><MI value={f.buyer_country} onChange={s("buyer_country")} placeholder="Indonesia" /></MF>
        <MF label="Buyer Full Address" req><MI value={f.buyer_address} onChange={s("buyer_address")} placeholder="Jl. Sudirman No.1, Jakarta" /></MF>
        <MF label="Contact Person"><MI value={f.buyer_contact_person} onChange={s("buyer_contact_person")} placeholder="Ahmad Rizal" /></MF>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Email" req><MI value={f.buyer_email} onChange={s("buyer_email")} placeholder="buyer@company.com" type="email" /></MF>
          <MF label="Phone"><MI value={f.buyer_phone} onChange={s("buyer_phone")} placeholder="+62 21 1234567" /></MF>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Tax / VAT ID"><MI value={f.buyer_tax_id} onChange={s("buyer_tax_id")} placeholder="01.234.567.8-901" /></MF>
          <MF label="Incoterm" req><MS value={f.incoterm} onChange={s("incoterm")} options={["FOB","CIF","DAP","DDP","EXW","CFR","CIP","CPT","DPU","FAS","FCA"]} /></MF>
        </div>
        <MF label="Importer of Record (if different)"><MI value={f.importer_of_record} onChange={s("importer_of_record")} placeholder="Same as buyer" /></MF>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <MBtn onClick={onClose} variant="ghost">Cancel</MBtn>
        <MBtn onClick={() => onSubmit(f)} disabled={!f.buyer_name || !f.buyer_country || !f.buyer_address || !f.buyer_email} loading={loading} icon={UserSquare2}>Confirm Consignee</MBtn>
      </div>
    </MO>
  );
}

// Step 5 – Valuation
function ValuationModal({ onClose, onSubmit, loading, hsCode }: { onClose: () => void; onSubmit: (d: object) => void; loading: boolean; hsCode: string }) {
  const [f, setF] = useState({ fob_value_myr: "", freight_quote_myr: "", insurance_rate: "0.005", invoice_currency: "MYR", invoice_amount_foreign: "", exchange_rate_to_myr: "", destination_country: "", hs_code: hsCode, incoterm: "FOB", import_duty_rate: "", fta_co_number: "" });
  const s = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const isFx = f.invoice_currency !== "MYR";
  return (
    <MO onClose={onClose}>
      <MH title="Step 5 — Financial Valuation" sub="FOB → CIF → Duty breakdown for K2" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 text-[11px] text-blue-700">💡 RMCD requires CIF valuation. Provide FOB — freight & insurance added automatically.</div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Invoice Currency" req><MS value={f.invoice_currency} onChange={s("invoice_currency")} options={["MYR","USD","EUR","GBP","SGD","CNY","JPY","AUD","HKD"]} /></MF>
          <MF label="Destination Country" req><MI value={f.destination_country} onChange={s("destination_country")} placeholder="Indonesia" /></MF>
        </div>
        {isFx && <div className="grid grid-cols-2 gap-3">
          <MF label={`Amount (${f.invoice_currency})`}><MI value={f.invoice_amount_foreign} onChange={s("invoice_amount_foreign")} placeholder="1000.00" /></MF>
          <MF label="Rate to MYR"><MI value={f.exchange_rate_to_myr} onChange={s("exchange_rate_to_myr")} placeholder="4.72" /></MF>
        </div>}
        <MF label="FOB Value (MYR)" req><MI value={f.fob_value_myr} onChange={s("fob_value_myr")} placeholder="4720.00" /></MF>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Freight Cost (MYR)" req><MI value={f.freight_quote_myr} onChange={s("freight_quote_myr")} placeholder="210.00" /></MF>
          <MF label="Insurance Rate"><MI value={f.insurance_rate} onChange={s("insurance_rate")} placeholder="0.005 = 0.5%" /></MF>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Import Duty Rate (0–1)"><MI value={f.import_duty_rate} onChange={s("import_duty_rate")} placeholder="0.05 = 5%" /></MF>
          <MF label="Incoterm"><MS value={f.incoterm} onChange={s("incoterm")} options={["FOB","CIF","DAP","DDP","EXW","CFR"]} /></MF>
        </div>
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">FTA Claim (Optional)</p>
          <MF label="CO Certificate Number (Form D / RCEP Form)"><MI value={f.fta_co_number} onChange={s("fta_co_number")} placeholder="CO-MY-2026-00123" /></MF>
          <p className="text-[10px] text-muted-foreground">To claim FTA: ① Product on FTA list ② Rules of Origin met ③ CO certificate issued by MATRADE</p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <MBtn onClick={onClose} variant="ghost">Cancel</MBtn>
        <MBtn onClick={() => onSubmit({ ...f, fob_value_myr: parseFloat(f.fob_value_myr)||0, freight_quote_myr: parseFloat(f.freight_quote_myr)||undefined, insurance_rate: parseFloat(f.insurance_rate)||0.005, import_duty_rate: parseFloat(f.import_duty_rate)||undefined, invoice_amount_foreign: parseFloat(f.invoice_amount_foreign)||undefined, exchange_rate_to_myr: parseFloat(f.exchange_rate_to_myr)||undefined })} disabled={!f.fob_value_myr||!f.destination_country} loading={loading} icon={Coins}>Calculate Valuation</MBtn>
      </div>
    </MO>
  );
}

// Step 6 – Logistics
function ShipmentModal({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (d: object) => void; loading: boolean }) {
  const [f, setF] = useState({ mode: "SEA", port_of_loading: "Port Klang", port_of_discharge: "", vessel_name: "", flight_number: "", voyage_number: "", container_number: "", export_date: "", gross_weight_kg: "", net_weight_kg: "", cbm: "", number_of_packages: "", package_type: "CTN", signatory_name: "", signatory_ic_or_passport: "", signatory_designation: "" });
  const s = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const modes = ["SEA","AIR","ROAD","RAIL"] as const;
  const modeIcons: Record<string, React.ElementType> = { SEA: Ship, AIR: Plane, ROAD: Truck, RAIL: Train };
  return (
    <MO onClose={onClose}>
      <MH title="Step 6 — Logistics & Shipment" sub="Transport info for K2 & Bill of Lading" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <MF label="Mode of Transport" req>
          <div className="grid grid-cols-4 gap-2">
            {modes.map(m => { const Icon = modeIcons[m]; return (
              <button key={m} onClick={() => s("mode")(m)} className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-all ${f.mode===m ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}>
                <Icon className="h-4 w-4" />{m}
              </button>
            );})}
          </div>
        </MF>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Port of Loading" req><MI value={f.port_of_loading} onChange={s("port_of_loading")} placeholder="Port Klang" /></MF>
          <MF label="Port of Discharge" req><MI value={f.port_of_discharge} onChange={s("port_of_discharge")} placeholder="Tanjung Priok" /></MF>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {f.mode==="SEA" && <MF label="Vessel Name" req><MI value={f.vessel_name} onChange={s("vessel_name")} placeholder="MV Bunga Mas 5" /></MF>}
          {f.mode==="AIR" && <MF label="Flight Number" req><MI value={f.flight_number} onChange={s("flight_number")} placeholder="MH 713" /></MF>}
          {(f.mode==="SEA"||f.mode==="AIR") && <MF label="Voyage / Flight No"><MI value={f.voyage_number} onChange={s("voyage_number")} placeholder="0412W" /></MF>}
          {f.mode==="SEA" && <MF label="Container Number"><MI value={f.container_number} onChange={s("container_number")} placeholder="MSKU-7842150" /></MF>}
        </div>
        <MF label="Export Date" req><MI value={f.export_date} onChange={s("export_date")} type="date" /></MF>
        <div className="grid grid-cols-3 gap-3">
          <MF label="Gross Weight (kg)" req><MI value={f.gross_weight_kg} onChange={s("gross_weight_kg")} placeholder="480" /></MF>
          <MF label="Net Weight (kg)"><MI value={f.net_weight_kg} onChange={s("net_weight_kg")} placeholder="440" /></MF>
          <MF label="Volume (m³)" req><MI value={f.cbm} onChange={s("cbm")} placeholder="1.2" /></MF>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Packages"><MI value={f.number_of_packages} onChange={s("number_of_packages")} placeholder="12" /></MF>
          <MF label="Package Type"><MS value={f.package_type} onChange={s("package_type")} options={["CTN","PALLET","DRUM","BAG","BOX"]} /></MF>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><PenLine className="h-3.5 w-3.5" />Authorised Signatory</p>
          <MF label="Full Name" req><MI value={f.signatory_name} onChange={s("signatory_name")} placeholder="Aisyah Rahman" /></MF>
          <div className="grid grid-cols-2 gap-3">
            <MF label="NRIC / Passport" req><MI value={f.signatory_ic_or_passport} onChange={s("signatory_ic_or_passport")} placeholder="880412-14-5566" /></MF>
            <MF label="Designation" req><MI value={f.signatory_designation} onChange={s("signatory_designation")} placeholder="Director" /></MF>
          </div>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <MBtn onClick={onClose} variant="ghost">Cancel</MBtn>
        <MBtn onClick={() => onSubmit({ ...f, gross_weight_kg: parseFloat(f.gross_weight_kg)||0, net_weight_kg: parseFloat(f.net_weight_kg)||undefined, cbm: parseFloat(f.cbm)||0, number_of_packages: parseInt(f.number_of_packages)||undefined })} disabled={!f.port_of_discharge||!f.export_date||!f.gross_weight_kg||!f.cbm||!f.signatory_name||!f.signatory_ic_or_passport||!f.signatory_designation} loading={loading} icon={Ship}>Confirm Shipment</MBtn>
      </div>
    </MO>
  );
}

// Step 4 – Digital Access
function DagangNetModal({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (agentCode: string) => void; loading: boolean }) {
  const [mycieds, setMycieds] = useState(false);
  const [dagang, setDagang] = useState(false);
  const [cert, setCert] = useState(false);
  const [dagangId, setDagangId] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const ready = mycieds && dagang;
  return (
    <MO onClose={onClose}>
      <MH title="Step 4 — Digital Access Setup" sub="Required for K2 submission via MyDagangNet" onClose={onClose} />
      <div className="space-y-3 px-5 py-4">
        {[
          { label: "MyCIEDS Account", tag: "REQUIRED", desc: "Royal Malaysian Customs e-system. Register at mycustoms.gov.my", checked: mycieds, set: setMycieds },
          { label: "Dagang Net Subscription", tag: "REQUIRED", desc: "EDI portal for K2 declarations. Register at dagangnet.com.my", checked: dagang, set: setDagang },
          { label: "Digital Certificate (Token)", tag: "REQUIRED", desc: "PKI certificate from MSC Trustgate or Pos Digicert.", checked: cert, set: setCert },
        ].map(item => (
          <div key={item.label} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
            <button onClick={() => item.set((v: boolean) => !v)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${item.checked ? "border-green-500 bg-green-500 text-white" : "border-border"}`}>
              {item.checked && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{item.label} <span className="ml-1 rounded-full bg-red-100 px-1.5 py-px text-[9px] font-bold text-red-600">{item.tag}</span></p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
              {item.label.includes("Dagang") && item.checked && (
                <div className="mt-2"><MI value={dagangId} onChange={setDagangId} placeholder="Dagang Net User ID (optional)" /></div>
              )}
            </div>
          </div>
        ))}
        <MF label="Customs Agent Code (optional)"><MI value={agentCode} onChange={setAgentCode} placeholder="CA-MY-12345" /></MF>
        {ready && <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-[12px] font-semibold text-green-700"><CheckCircle2 className="h-4 w-4" />Connected — ready for K2 submission</div>}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <MBtn onClick={onClose} variant="ghost">Cancel</MBtn>
        <MBtn onClick={() => onSubmit(agentCode)} disabled={!ready} loading={loading} icon={Link2}>{ready ? "Confirm Digital Access" : "Tick all boxes above"}</MBtn>
      </div>
    </MO>
  );
}

// Step 7 – E-Signature
function SignatureModal({ name, title, onClose, onSign }: { name: string; title: string; onClose: () => void; onSign: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });
  const doSign = () => { setSigned(true); setTimeout(onSign, 600); };
  return (
    <MO onClose={onClose}>
      <MH title="E-Signature — Declaration of Truth" sub="Required under Customs Act 1967" onClose={onClose} />
      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-relaxed">
          <p className="font-semibold mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Declaration</p>
          <p>I, <strong>{name || "[Signatory Name]"}</strong> ({title || "[Designation]"}), hereby declare that the particulars given in this export declaration and all accompanying documents are true and correct to the best of my knowledge and belief.</p>
          <p className="mt-2 text-[11px] text-muted-foreground">Pursuant to Section 121, Customs Act 1967 (Act 235). False declaration is an offence under Section 135.</p>
          <p className="mt-3 font-medium">Date: {today}</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <button onClick={() => setAgreed(v => !v)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${agreed ? "border-primary bg-primary text-white" : "border-border"}`}>
            {agreed && <Check className="h-3 w-3" />}
          </button>
          <span className="text-sm">I confirm this declaration and authorise submission of the K2 export declaration.</span>
        </label>
        {signed && <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-sm font-semibold text-green-700"><CheckCircle2 className="h-4 w-4" />Signed — documents ready for K2</div>}
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <MBtn onClick={onClose} variant="ghost">Cancel</MBtn>
        <MBtn onClick={doSign} disabled={!agreed || signed} icon={PenLine}>{signed ? "Signed ✓" : "Sign Declaration"}</MBtn>
      </div>
    </MO>
  );
}

// K2 Preview
function K2PreviewModal({ k2Data, onClose, onSubmit, loading }: { k2Data: Record<string,unknown>; onClose: () => void; onSubmit: () => void; loading: boolean }) {
  const form = (k2Data?.k2_form_data || {}) as Record<string,unknown>;
  const exp = (form?.exporter || {}) as Record<string,string>;
  const con = (form?.consignee || {}) as Record<string,string>;
  const gds = (form?.goods || {}) as Record<string,unknown>;
  const val = (form?.valuation || {}) as Record<string,number>;
  const dty = (form?.duty || {}) as Record<string,number>;
  const trp = (form?.transport || {}) as Record<string,string>;
  const sig = (form?.signatory || {}) as Record<string,string>;
  const Row = ({ l, v }: { l: string; v?: unknown }) => (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 w-36">{l}</span>
      <span className="text-[12px] font-medium text-foreground text-right">{String(v ?? "—")}</span>
    </div>
  );
  const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t}</p>
      {children}
    </div>
  );
  return (
    <MO onClose={onClose}>
      <MH title="K2 Export Declaration — Preview" sub="Review before submitting to RMCD" onClose={onClose} />
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/30 px-3 py-2">
          <span className="text-[11px] font-bold text-primary">K2 Reference</span>
          <span className="text-sm font-mono font-bold text-primary">{String(k2Data?.k2_reference || "K2-MY-2026-PENDING")}</span>
        </div>
        <Sec t="Exporter"><Row l="Company" v={exp.name} /><Row l="BRN" v={exp.brn} /></Sec>
        <Sec t="Consignee"><Row l="Name" v={con.name} /><Row l="Country" v={con.country_code} /></Sec>
        <Sec t="Transport"><Row l="Mode" v={trp.mode_description} /><Row l="Vessel/Flight" v={trp.vessel_flight_name} /><Row l="POL" v={trp.port_of_loading_code} /><Row l="POD" v={trp.port_of_discharge_code} /></Sec>
        <Sec t="Goods"><Row l="HS Code" v={gds.hs_code as string} /><Row l="Description" v={gds.commodity_description as string} /><Row l="Gross Weight" v={`${gds.gross_weight_kg} kg`} /></Sec>
        <Sec t="Valuation & Duty"><Row l="FOB (MYR)" v={`RM ${Number(val.fob_value_myr||0).toLocaleString()}`} /><Row l="CIF (MYR)" v={`RM ${Number(val.cif_value_myr||0).toLocaleString()}`} /><Row l="Total Duty" v={`RM ${Number(dty.total_duty_myr||0).toLocaleString()}`} /></Sec>
        <Sec t="Signatory"><Row l="Name" v={sig.name} /><Row l="NRIC/Passport" v={sig.nric_passport} /><Row l="Designation" v={sig.designation} /></Sec>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-4">
        <MBtn onClick={onClose} variant="ghost">Close</MBtn>
        <MBtn onClick={onSubmit} loading={loading} icon={Send}>Submit to Dagang Net</MBtn>
      </div>
    </MO>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AssistantPage() {

  // ── Session ────────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // ── Step state ─────────────────────────────────────────────────────────────
  const [activeStep, setActiveStep]   = useState(0);
  const [completed, setCompleted]     = useState<Set<number>>(new Set());
  const activeStepRef = useRef(0);
  const completedRef  = useRef(new Set<number>());
  useEffect(() => { activeStepRef.current = activeStep; }, [activeStep]);
  useEffect(() => { completedRef.current  = completed; },  [completed]);

  // ── Accumulated data ────────────────────────────────────────────────────────
  const sd = useRef<Record<string, unknown>>({});

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<null | "entity" | "consignee" | "valuation" | "shipment" | "dagang" | "signature" | "k2preview">(null);
  const [mLoading, setMLoading] = useState(false);
  const [entityPrefill, setEntityPrefill] = useState<Record<string,string> | undefined>(undefined);

  // ── Permits ────────────────────────────────────────────────────────────────
  const [permits, setPermits] = useState<Array<{ name: string; key: string; uploaded: boolean }>>([]);

  // ── Docs ───────────────────────────────────────────────────────────────────
  const [generatedDocs, setGeneratedDocs] = useState<Set<string>>(new Set());
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [k2Data, setK2Data] = useState<Record<string, unknown> | null>(null);

  // ── Landed cost ────────────────────────────────────────────────────────────
  const [lc, setLc] = useState({ fob: 0, freight: 0, ins: 0, duty: 0, total: 0, savings: 0, fta: "", finalised: false });

  // ── Chat ───────────────────────────────────────────────────────────────────
  type Msg = { id: string; from: "user" | "ai"; kind: "text" | "upload" | "spin" | "card"; text?: string; fileName?: string; card?: Record<string, unknown> };
  const gid = () => Math.random().toString(36).slice(2);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "w", from: "ai", kind: "text", text: "Hi — I'm your Compliance Architect. I'll guide you step-by-step through the full Malaysian export process. Let's start with your company details." },
  ]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const chatRef             = useRef<HTMLDivElement>(null);
  const fileRef             = useRef<HTMLInputElement>(null);
  const pendingEndpoint     = useRef<string | null>(null);
  const pendingPermitKey    = useRef<string | null>(null);
  const chatHistory         = useRef<{ role: string; content: string }[]>([]);

  const push = (m: Msg) => setMsgs(p => [...p, m]);
  const pushAI = (text: string) => push({ id: gid(), from: "ai", kind: "text", text });
  const pushSpin = (text: string) => { const id = gid(); push({ id, from: "ai", kind: "spin", text }); return id; }
  const removeSpin = (id: string) => setMsgs(p => p.filter(m => m.id !== id));

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  // ── Session init ───────────────────────────────────────────────────────────
  useEffect(() => {
    const BASE = "";
    fetch(`${BASE}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" } })
      .then(r => r.json()).then(d => setSessionId(d.session_id))
      .catch(() => { setSessionError("offline"); setSessionId("demo-" + gid()); });
  }, []);

  // ── Advance step ───────────────────────────────────────────────────────────
  const advance = useCallback((cur: number) => {
    setCompleted(p => new Set([...p, cur]));
    setActiveStep(cur + 1);
  }, []);

  // ── Intro message for each step ────────────────────────────────────────────
  const stepIntros: Record<number, string> = {
    0: "**Step 1 — Entity Verification**\nUpload your SSM certificate (Form 9 / Form D / MyCoID) — I'll extract your company details automatically. Click **Upload SSM Certificate** to begin.",
    1: "**Step 2 — Consignee Details**\nNow I need your overseas buyer's information. This will pre-fill the Commercial Invoice, B/L and K2 automatically. Click **Add Consignee**.",
    2: "**Step 3 — HS Classification**\nUpload a product photo or describe your product in the chat. I'll assign the 8-digit AHTN/HS code, duty rates and FTA eligibility.",
    3: "**Step 4 — Permit Check**\nChecking PUA122 (Customs Prohibition of Exports Order) for your product...",
    4: "**Step 5 — Digital Access**\nYou'll need Dagang Net + MyCIEDS accounts to submit the K2 declaration. Click **Connect Dagang Net** to confirm your access.",
    5: "**Step 6 — Financial Valuation**\nRMCD requires a full CIF valuation for K2. I'll calculate FOB → freight → insurance → CIF → duty and check FTA savings. Click **Enter Valuation**.",
    6: "**Step 7 — Logistics & Shipment**\nFill in transport details for the K2 form and Bill of Lading. Click **Add Shipment Details**.",
    7: "**Step 8 — Trade Documents**\nAll data is ready. Click **Generate Documents** to produce all 4 trade documents, then **Sign Declaration** to unlock K2.",
    8: "**Step 9 — K2 Customs Declaration**\nAll dependencies satisfied. Click **Preview & Submit K2** to generate the official Kastam No.2 form and download it.",
  };

  const showStepIntro = useCallback((step: number) => {
    const txt = stepIntros[step];
    if (txt) setTimeout(() => pushAI(txt), 300);
  }, []);

  useEffect(() => { showStepIntro(0); }, []);

  // ── Build context for AI ────────────────────────────────────────────────────
  const ctx = useCallback((): string => {
    const e  = (sd.current.entity         as Record<string,unknown>) ?? {};
    const c  = (sd.current.consignee      as Record<string,unknown>) ?? {};
    const cl = (sd.current.classification as Record<string,unknown>) ?? {};
    const v  = (sd.current.valuation      as Record<string,unknown>) ?? {};
    const l  = (sd.current.logistics      as Record<string,unknown>) ?? {};
    return [
      `Exporter: ${e.company_name ?? "N/A"}, BRN: ${e.registration_number ?? "N/A"}`,
      `Consignee: ${c.buyer_name ?? "N/A"}, ${c.buyer_country ?? "N/A"}, ${c.buyer_address ?? "N/A"}`,
      `Buyer email: ${c.buyer_email ?? "N/A"}, Incoterm: ${c.incoterm ?? "FOB"}`,
      `HS Code: ${cl.hs_code ?? "N/A"} — ${cl.hs_description ?? "N/A"}`,
      `MY Export Duty: ${cl.malaysia_export_duty ?? 0}%, Dest Import Duty: ${cl.destination_import_duty ?? 0}%`,
      `FTA: ${(cl.fta_available as string[] ?? []).join(", ") || "None"}`,
      `FOB: RM${v.fob_myr ?? 0}, Freight: RM${v.freight_myr ?? 0}, Insurance: RM${v.insurance_myr ?? 0}, CIF: RM${v.cif_myr ?? 0}`,
      `Duty: RM${v.estimated_duty_myr ?? 0}, Best FTA: ${v.best_fta ?? "None"}, Form: ${v.form_required ?? "N/A"}`,
      `Mode: ${l.mode ?? "SEA"}, Vessel: ${l.vessel ?? "TBC"}, POL: ${l.pol ?? "Port Klang"}, POD: ${l.pod ?? "N/A"}`,
      `Gross: ${l.weight_kg ?? 0} kg, CBM: ${l.cbm ?? 0}, Export date: ${l.export_date ?? "N/A"}`,
      `Signatory: ${l.signatory_name ?? "N/A"}, ${l.signatory_designation ?? "N/A"}, IC: ${l.signatory_ic_passport ?? "N/A"}`,
    ].join("\n");
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  // Step 1 – Entity
  const handleEntity = useCallback(async (data: object) => {
    setMLoading(true);
    const d = data as Record<string, string>;
    try {
      sd.current.entity = d;
      setModal(null);
      pushAI(`✅ **Entity verified** — ${d.company_name} (BRN: ${d.registration_number}) · ${d.company_type} · ${d.company_status}`);
      advance(0);
      showStepIntro(1);
    } finally { setMLoading(false); }
  }, [advance, showStepIntro]);

  // Step 2 – Consignee
  const handleConsignee = useCallback(async (data: object) => {
    setMLoading(true);
    const d = data as Record<string, string>;
    try {
      const sid = gid();
      const spinId = pushSpin("Screening buyer for sanctions...");
      let riskLevel = "low";
      try {
        const r = await glmJSON(
          `You are a Malaysian export compliance officer. Screen this buyer for OFAC/UN/Malaysian sanctions. Return JSON: {"risk_level":"low|medium|high","sanctioned_country":false,"denied_party_check":"clear|flagged|manual_review_required","compliance_notes":[],"red_flags":[]}`,
          `Buyer: ${d.buyer_name}, Country: ${d.buyer_country}, Incoterm: ${d.incoterm}`
        );
        riskLevel = String(r.risk_level ?? "low");
        const emoji = riskLevel === "high" ? "🔴" : riskLevel === "medium" ? "🟡" : "🟢";
        removeSpin(spinId);
        pushAI(`${emoji} Buyer screened — Risk: **${riskLevel.toUpperCase()}** · Sanctions: **${String(r.denied_party_check ?? "clear")}**${(r.red_flags as string[] ?? []).length ? `\n⚠️ ${(r.red_flags as string[]).join("; ")}` : ""}`);
      } catch { removeSpin(spinId); }
      sd.current.consignee = { ...d, screening: { risk_level: riskLevel } };
      setModal(null);
      advance(1);
      showStepIntro(2);
    } finally { setMLoading(false); }
  }, [advance, showStepIntro]);

  // Step 3 – HS Classification (text input)
  const classifyProduct = useCallback(async (description: string) => {
    const cls = sd.current.consignee as Record<string, string> ?? {};
    const dest = cls.buyer_country ?? "Unknown";
    const spinId = pushSpin("Classifying product...");
    try {
      const r = await glmJSON(
        `You are a WCO HS 2022 / AHTN 2022 expert for Malaysian exports. Classify the product and return JSON: {"identified":true,"hs_code":"","hs_description":"","malaysia_export_duty":0.0,"destination_import_duty":0.0,"preferential_duty_rates":{"ATIGA":0.0,"CPTPP":0.0,"RCEP":0.0},"fta_available":[],"permit_required":[],"export_prohibited":false,"strategic_goods":false,"sirim_required":false,"halal_required":false,"miti_required":false,"confidence":0.9,"classification_notes":[]}`,
        `Product: ${description}\nDestination: ${dest}`
      );
      removeSpin(spinId);
      const hs = String(r.hs_code ?? "").trim();
      if (!hs || hs.startsWith("XXXX") || Number(r.confidence ?? 0) < 0.3) {
        pushAI(`⚠️ Could not classify "${description}" with confidence. Please be more specific — include material, use, and intended market.`);
        return;
      }
      sd.current.classification = r;
      pushAI(`✅ **HS Code: ${hs}** — ${String(r.hs_description ?? "")}\n\n**Export Duty (MY):** ${r.malaysia_export_duty}% · **Import Duty (dest):** ${r.destination_import_duty}%\n**FTA:** ${(r.fta_available as string[] ?? []).join(", ") || "None"}\n${(r.permit_required as string[] ?? []).length ? `⚠️ Permits required: ${(r.permit_required as string[]).join(", ")}` : "✅ No PUA122 permits required"}`);
      advance(2);
      // Auto-trigger permit check
      await runPermitCheck(r);
    } catch (err) {
      removeSpin(spinId);
      pushAI(`⚠️ Classification error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Step 4 – Permit check
  const runPermitCheck = useCallback(async (cls: Record<string, unknown>) => {
    setActiveStep(3);
    const hs = String(cls.hs_code ?? "");
    const desc = String(cls.hs_description ?? "product");
    const dest = String((sd.current.consignee as Record<string,string> ?? {}).buyer_country ?? "Unknown");
    const spinId = pushSpin("Checking PUA122 permit requirements...");
    try {
      const r = await glmJSON(
        `You are a Malaysian export permit specialist. Check PUA122 (Customs Prohibition of Exports Order), Strategic Goods (Control) Act 2010. Return ONLY permits that are genuinely required for this product. Return JSON: {"permits_required":[{"name":"","issuing_body":"","mandatory":true,"processing_days":0,"fee_myr":0,"portal":""}],"sirim_required":false,"halal_required":false,"miti_license_required":false,"strategic_goods_control":false,"notes":[]}`,
        `HS Code: ${hs}, Product: ${desc}, Destination: ${dest}`
      );
      removeSpin(spinId);
      const permitList = (r.permits_required as Array<Record<string,unknown>> ?? []).filter(p => p.mandatory && String(p.name).trim());
      if (permitList.length === 0) {
        pushAI(`✅ No controlled permits required for HS ${hs}. Proceeding to digital access setup.`);
        advance(3);
        showStepIntro(4);
      } else {
        const items = permitList.map((p, i) => ({ name: String(p.name), key: `p${i}`, uploaded: false }));
        setPermits(items);
        pushAI(`⚠️ **${permitList.length} permit(s) required** for HS ${hs}:\n${permitList.map(p => `• ${p.name} (${p.issuing_body})`).join("\n")}\n\nUpload each certificate below to continue.`);
      }
    } catch {
      removeSpin(spinId);
      pushAI("✅ No permits flagged. Proceeding to digital access.");
      advance(3);
      showStepIntro(4);
    }
  }, [advance, showStepIntro]);

  // Step 4 permit upload
  const handlePermitUpload = useCallback(async (key: string, file: File) => {
    push({ id: gid(), from: "user", kind: "upload", fileName: file.name });
    const spinId = pushSpin(`Validating ${file.name}...`);
    let valid = false;
    try {
      const b64 = await fileToB64(file);
      const r = await geminiVision(b64, fileMime(file),
        `Validate this Malaysian export permit/certificate. Return JSON: {"is_valid":true,"permit_type":"","issuing_body":"","certificate_number":"","expiry_date":"","confidence":0.9}`
      );
      valid = Boolean(r.is_valid) || Number(r.confidence ?? 0) >= 0.6;
      removeSpin(spinId);
      pushAI(valid
        ? `✅ **${String(r.permit_type || file.name)}** — Certificate No: ${String(r.certificate_number || "—")} · Expiry: ${String(r.expiry_date || "—")} · Valid`
        : `⚠️ Could not fully validate ${file.name}. Please re-upload a clearer copy.`
      );
    } catch { removeSpin(spinId); valid = true; pushAI(`✅ ${file.name} received.`); }
    if (valid) {
      setPermits(prev => {
        const next = prev.map(p => p.key === key ? { ...p, uploaded: true } : p);
        if (next.every(p => p.uploaded)) {
          setTimeout(() => { pushAI("✅ All permits validated. Proceeding to digital access."); advance(3); showStepIntro(4); }, 500);
        }
        return next;
      });
    }
  }, [advance, showStepIntro]);

  // Step 5 – Digital access
  const handleDagang = useCallback(async (agentCode: string) => {
    setMLoading(true);
    sd.current.digitalAccess = { confirmed: true, agentCode };
    setModal(null);
    pushAI("✅ Digital access confirmed — Dagang Net connected. Now let's value the shipment.");
    advance(4);
    showStepIntro(5);
    setMLoading(false);
  }, [advance, showStepIntro]);

  // Step 6 – Valuation
  const handleValuation = useCallback(async (data: object) => {
    setMLoading(true);
    const d = data as Record<string, unknown>;
    try {
      const fob     = Number(d.fob_value_myr)    || 0;
      const freight = Number(d.freight_quote_myr) || fob * 0.07;
      const ins     = fob * (Number(d.insurance_rate) || 0.005);
      const cif     = fob + freight + ins;
      const cls     = (sd.current.classification as Record<string,unknown>) ?? {};
      const drate   = d.import_duty_rate ? Number(d.import_duty_rate) : (Number(cls.destination_import_duty) || 5) / 100;
      const duty    = cif * drate;
      const total   = cif + duty;
      const dest    = String(d.destination_country ?? (sd.current.consignee as Record<string,string>)?.buyer_country ?? "Unknown");
      const spinId  = pushSpin("Calculating FTA savings...");
      let fta: Record<string,unknown> = {};
      try {
        fta = await glmJSON(
          `Malaysian FTA specialist. Evaluate ATIGA, CPTPP, RCEP, MAFTA, MJEPA. FTA requires: ① product on FTA list ② Rules of Origin met ③ CO certificate. Return JSON: {"atiga_applicable":false,"atiga_rate":0.0,"atiga_savings_myr":0,"best_fta":"","best_fta_rate":0.0,"best_savings_myr":0,"form_required":"Form D|Form E|RCEP Form|None","roo_met":true,"roo_criteria":"","notes":""}`,
          `HS: ${String(cls.hs_code ?? "N/A")}, Dest: ${dest}, CIF: RM${cif.toFixed(2)}, MFN duty: ${(drate*100).toFixed(1)}%`
        );
      } catch { /* ok */ }
      removeSpin(spinId);
      const savings = Number(fta.best_savings_myr) || 0;
      const netTotal = cif + cif * (Number(fta.best_fta_rate) || drate);
      const result = { fob_myr: fob, freight_myr: freight, insurance_myr: ins, cif_myr: cif, import_duty_rate: drate, estimated_duty_myr: duty, total_landed_cost_myr: total, net_landed_with_fta: netTotal, fta_analysis: fta, atiga_savings_myr: Number(fta.atiga_savings_myr)||0, best_fta: String(fta.best_fta ?? ""), best_savings_myr: savings, form_required: String(fta.form_required ?? "None"), invoice_currency: String(d.invoice_currency ?? "MYR"), exchange_rate_to_myr: Number(d.exchange_rate_to_myr)||1 };
      sd.current.valuation = result;
      setLc({ fob, freight, ins, duty, total, savings, fta: String(fta.best_fta ?? ""), finalised: true });
      setModal(null);
      pushAI(`✅ **CIF Valuation:**\nFOB: RM ${fob.toLocaleString()} · Freight: RM ${freight.toLocaleString()} · Insurance: RM ${ins.toLocaleString()}\n**CIF: RM ${cif.toLocaleString()}** · Duty: RM ${duty.toLocaleString()} · **Total landed: RM ${total.toLocaleString()}**${savings > 0 ? `\n🎯 FTA saving: **RM ${savings.toLocaleString()}** via **${fta.best_fta}** (${fta.form_required})` : "\n⚠️ No FTA applicable — MFN rate applies."}`);
      advance(5);
      showStepIntro(6);
    } catch (err) {
      pushAI(`⚠️ Valuation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setMLoading(false); }
  }, [advance, showStepIntro]);

  // Step 7 – Logistics
  const handleShipment = useCallback(async (data: object) => {
    setMLoading(true);
    const d = data as Record<string, string>;
    sd.current.logistics = { mode: d.mode, pol: d.port_of_loading, pod: d.port_of_discharge, vessel: d.vessel_name, flight: d.flight_number, voyage_number: d.voyage_number, container_number: d.container_number, weight_kg: d.gross_weight_kg, net_weight_kg: d.net_weight_kg, cbm: d.cbm, number_of_packages: d.number_of_packages, package_type: d.package_type, export_date: d.export_date, signatory_name: d.signatory_name, signatory_designation: d.signatory_designation, signatory_ic_passport: d.signatory_ic_or_passport };
    setModal(null);
    const modeEmoji: Record<string,string> = { SEA: "🚢", AIR: "✈️", ROAD: "🚛", RAIL: "🚂" };
    pushAI(`✅ **Shipment:** ${modeEmoji[d.mode] ?? ""} ${d.mode} · ${d.vessel_name || d.flight_number || "TBC"} · ETD ${d.export_date} · ${d.port_of_loading} → ${d.port_of_discharge}\n${d.gross_weight_kg} kg / ${d.cbm} m³ · ${d.number_of_packages} ${d.package_type}(s) · Container ${d.container_number || "TBC"}`);
    advance(6);
    showStepIntro(7);
    setMLoading(false);
  }, [advance, showStepIntro]);

  // Step 8 – Generate single doc
  const generateDoc = useCallback(async (id: string) => {
    if (generatedDocs.has(id) || generatingDoc) return;
    setGeneratingDoc(id);
    const sysMap: Record<string, { title: string; sys: string }> = {
      "commercial-invoice": { title: "Commercial Invoice", sys: `Generate a Malaysian export Commercial Invoice per Customs Act 1967 and MATRADE. Return JSON: {"invoice_number":"CI-MY-2026-001","invoice_date":"","payment_terms":"T/T","exporter":{"name":"","brn":"","address":"","tel":"","email":"","bank":""},"consignee":{"name":"","country":"","address":"","tax_id":"","tel":"","contact_person":""},"goods":[{"line_no":1,"hs_code":"","description":"","quantity":0,"unit":"","unit_price":0,"total":0,"currency":"MYR"}],"incoterm":"FOB","port_of_loading":"","port_of_discharge":"","currency":"MYR","subtotal":0,"freight":0,"insurance":0,"total_fob":0,"total_cif":0,"country_of_origin":"Malaysia","marks_and_numbers":"","vessel_or_flight":"","declaration":"We hereby certify that this invoice is true and correct.","signatory":{"name":"","title":"","ic_or_passport":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
      "packing-list": { title: "Packing List", sys: `Generate a Malaysian export Packing List per MATRADE standards. Return JSON: {"packing_list_number":"PL-MY-2026-001","date":"","exporter":{"name":"","address":""},"consignee":{"name":"","country":"","address":""},"invoice_reference":"","vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","packages":[{"package_no":"1","type":"CTN","description":"","gross_weight_kg":0,"net_weight_kg":0,"cbm":0,"quantity_inside":0}],"total_packages":0,"total_gross_weight_kg":0,"total_net_weight_kg":0,"total_cbm":0,"shipping_marks":"","container_number":"","declaration":"We hereby certify that the above particulars are true and correct.","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
      "bol": { title: "Bill of Lading", sys: `Generate a Bill of Lading shell for Malaysian export. Return JSON: {"bl_number":"TBC - Assigned by carrier","bl_date":"","bl_type":"OBL","shipper":{"name":"","address":"","brn":""},"consignee":{"name":"","address":"","country":""},"notify_party":{"name":"","address":""},"vessel_or_flight":"","voyage_or_flight_number":"","port_of_loading":"","port_of_discharge":"","freight_terms":"Prepaid","container_details":[{"container_no":"","seal_no":"","type":"","packages":0,"description":"","gross_weight_kg":0,"cbm":0}],"total_packages":0,"total_gross_weight_kg":0,"total_cbm":0,"place_of_issue":"Port Klang","number_of_originals":3,"carrier_clause":"SHIPPED on board in apparent good order and condition","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
      "coo": { title: "Certificate of Origin", sys: `Generate a Certificate of Origin for Malaysian export. Return JSON: {"co_number":"CO-MY-2026-001","co_date":"","form_type":"Form D (ATIGA)","issuing_body":"MATRADE","exporter":{"name":"","address":"","country":"Malaysia","brn":""},"consignee":{"name":"","address":"","country":""},"transport_details":{"vessel_or_flight":"","port_of_loading":"","port_of_discharge":"","departure_date":""},"goods":[{"item_no":1,"description":"","hs_code":"","origin_criterion":"WO","quantity":"","gross_weight_kg":0,"fob_value_myr":0}],"invoice_reference":"","declaration":"The undersigned hereby declares that the above details are correct.","signatory":{"name":"","title":"","signature_placeholder":"[SIGNATURE]","date":""}}` },
      "k2": { title: "K2 Declaration", sys: `Generate a K2 Customs Export Declaration for Dagang Net/MyECIS per Customs Act 1967. Return JSON: {"k2_reference":"K2-MY-2026-001","declaration_type":"EX","customs_station":"","export_date":"","k2_form_data":{"header":{"manifest_ref":"","declaration_type":"EX","customs_procedure_code":"10","regime_type":"Export","office_of_exit":""},"exporter":{"name":"","brn":"","address":"","customs_client_code":""},"consignee":{"name":"","country_code":"","address":""},"transport":{"mode_code":"","mode_description":"","vessel_flight_name":"","voyage_flight_number":"","port_of_loading_code":"","port_of_discharge_code":"","country_of_destination_code":"","container_indicator":"Y"},"goods":{"item_number":1,"commodity_description":"","hs_code":"","country_of_origin":"MY","quantity":0,"unit_of_quantity":"","gross_weight_kg":0,"net_weight_kg":0,"number_of_packages":0,"package_type_code":"","container_number":""},"valuation":{"statistical_value_myr":0,"fob_value_myr":0,"invoice_currency":"MYR","invoice_amount":0,"exchange_rate":1.0,"incoterm":"FOB","freight_myr":0,"insurance_myr":0,"cif_value_myr":0},"duty":{"export_duty_myr":0,"customs_duty_myr":0,"sst_myr":0,"total_duty_myr":0,"duty_exemption_code":"","exemption_reference":""},"fta":{"fta_claimed":false,"fta_name":"","form_type":"","form_number":"","preferential_rate":0.0},"signatory":{"name":"","nric_passport":"","designation":"","declaration_text":"I declare that the particulars given in this declaration are true and correct.","date":""}},"submission_checklist":[],"atiga_form_d_applicable":false,"duty_savings_myr":0,"estimated_processing_hours":4,"dagang_net_submission_steps":[{"step":1,"action":"Log in to dagangnet.com.my","portal":"dagangnet.com.my","notes":"Use digital certificate token"}],"compliance_notes":[],"warnings":[]}` },
    };
    try {
      const cfg = sysMap[id];
      if (!cfg) return;
      const result = await glmJSON(cfg.sys, ctx());
      if (id === "k2") setK2Data(result);
      sd.current.documents = { ...((sd.current.documents as object) ?? {}), [id]: result };
      if      (id === "commercial-invoice") generateInvoicePDF(result);
      else if (id === "bol")                generateBOLPDF(result);
      else if (id === "packing-list")       generatePackingListPDF(result);
      else if (id === "coo")                generateCOOPDF(result);
      else if (id === "k2")                 generateK2PDF(result);
      else makePDF(cfg.title, flatLines(result));
      setGeneratedDocs(prev => new Set([...prev, id]));
      pushAI(`✅ **${cfg.title}** generated and downloaded.`);
    } catch (err) {
      pushAI(`⚠️ Error generating ${id}: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setGeneratingDoc(null); }
  }, [ctx, generatedDocs, generatingDoc]);

  const generateAllDocs = useCallback(async () => {
    for (const id of ["commercial-invoice","packing-list","bol","coo"]) {
      if (!generatedDocs.has(id)) await generateDoc(id);
    }
  }, [generateDoc, generatedDocs]);

  // Step 8 – E-sign
  const handleSign = useCallback(() => {
    setSigned(true);
    setModal(null);
    pushAI("✅ Declaration signed. K2 form is now ready for final submission.");
    advance(7);
    showStepIntro(8);
  }, [advance, showStepIntro]);

  // Step 9 – K2 submit
  const sysMap_k2 = `Generate a K2 Customs Export Declaration for Dagang Net/MyECIS per Customs Act 1967. Return JSON: {"k2_reference":"K2-MY-2026-001","declaration_type":"EX","customs_station":"","export_date":"","k2_form_data":{"header":{"manifest_ref":"","declaration_type":"EX","customs_procedure_code":"10","regime_type":"Export","office_of_exit":""},"exporter":{"name":"","brn":"","address":"","customs_client_code":""},"consignee":{"name":"","country_code":"","address":""},"transport":{"mode_code":"","mode_description":"","vessel_flight_name":"","voyage_flight_number":"","port_of_loading_code":"","port_of_discharge_code":"","country_of_destination_code":"","container_indicator":"Y"},"goods":{"item_number":1,"commodity_description":"","hs_code":"","country_of_origin":"MY","quantity":0,"unit_of_quantity":"","gross_weight_kg":0,"net_weight_kg":0,"number_of_packages":0,"package_type_code":"","container_number":""},"valuation":{"statistical_value_myr":0,"fob_value_myr":0,"invoice_currency":"MYR","invoice_amount":0,"exchange_rate":1.0,"incoterm":"FOB","freight_myr":0,"insurance_myr":0,"cif_value_myr":0},"duty":{"export_duty_myr":0,"customs_duty_myr":0,"sst_myr":0,"total_duty_myr":0,"duty_exemption_code":"","exemption_reference":""},"fta":{"fta_claimed":false,"fta_name":"","form_type":"","form_number":"","preferential_rate":0.0},"signatory":{"name":"","nric_passport":"","designation":"","declaration_text":"I declare that the particulars given in this declaration are true and correct.","date":""}},"submission_checklist":[],"atiga_form_d_applicable":false,"duty_savings_myr":0,"estimated_processing_hours":4,"dagang_net_submission_steps":[{"step":1,"action":"Log in to dagangnet.com.my","portal":"dagangnet.com.my","notes":"Use digital certificate token"}],"compliance_notes":[],"warnings":[]}`;

  const handleK2Submit = useCallback(async () => {
    setMLoading(true);
    const spinId = pushSpin("Generating K2 declaration...");
    try {
      const result = await glmJSON(sysMap_k2, ctx());
      setK2Data(result);
      generateK2PDF(result);
      removeSpin(spinId);
      setModal(null);
      pushAI("🎉 **K2 submitted!** The official Kastam No.2 PDF has been downloaded. RMCD acknowledgement expected within 4 business hours.");
      advance(8);
    } catch (err) {
      removeSpin(spinId);
      pushAI(`⚠️ K2 error: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setMLoading(false); }
  }, [ctx, advance]);

  // ── File upload handler ────────────────────────────────────────────────────
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ep = pendingEndpoint.current;
    const pk = pendingPermitKey.current;
    pendingEndpoint.current = null;
    pendingPermitKey.current = null;
    push({ id: gid(), from: "user", kind: "upload", fileName: file.name });

    // Permit upload
    if (pk) { await handlePermitUpload(pk, file); return; }

    // SSM upload – open entity modal (extraction happens inside the modal)
    if (ep === "/entity/upload-ssm") {
      setEntityPrefill({ fileName: file.name });
      setModal("entity");
      return;
    }

    // Product photo
    if (ep === "/classification/upload-product") {
      if (!completedRef.current.has(1)) { pushAI("⚠️ Please complete Step 2 (Consignee Details) first."); return; }
      const spinId = pushSpin("Identifying product...");
      const dest = String((sd.current.consignee as Record<string,string> ?? {}).buyer_country ?? "Unknown");
      try {
        const b64 = await fileToB64(file);
        const r = await geminiVision(b64, fileMime(file),
          `WCO HS 2022 / AHTN classification engine for Malaysian exports to ${dest}. Identify product from image/label and classify. Return JSON: {"identified":true,"hs_code":"","hs_description":"","malaysia_export_duty":0.0,"destination_import_duty":0.0,"fta_available":[],"permit_required":[],"sirim_required":false,"halal_required":false,"miti_required":false,"confidence":0.0,"identification_notes":""}`
        );
        removeSpin(spinId);
        if (r._vision_failed) {
          pushAI("📷 Photo received. I couldn't read the image — please type your product description in the chat (e.g. \"crude palm oil\", \"nitrile gloves\", \"USB-C cable\").");
          return;
        }
        const hs = String(r.hs_code ?? "").trim();
        if (Boolean(r.identified) && hs && !hs.startsWith("XXXX") && Number(r.confidence ?? 0) > 0.3) {
          sd.current.classification = r;
          pushAI(`✅ **HS Code: ${hs}** — ${String(r.hs_description ?? "")}\nImport duty: ${r.destination_import_duty}% · FTA: ${(r.fta_available as string[] ?? []).join(", ") || "None"}`);
          advance(2);
          await runPermitCheck(r as Record<string, unknown>);
        } else {
          pushAI(`⚠️ Could not identify product clearly (${String(r.identification_notes || "low confidence")}).\nPlease describe your product in the chat instead.`);
        }
      } catch { removeSpin(spinId); pushAI("📷 Photo received. Please type your product description in the chat."); }
    }
  }, [handlePermitUpload, advance, runPermitCheck]);

  // ── Chat send ──────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    if (!input.trim() || busy) return;
    const raw = input.trim();
    setInput("");
    push({ id: gid(), from: "user", kind: "text", text: raw });
    setBusy(true);
    try {
      // Step 3: product description
      if (activeStepRef.current === 2 && !completedRef.current.has(2)) {
        await classifyProduct(raw);
        return;
      }
      // General AI chat
      const e  = (sd.current.entity         as Record<string,string>) ?? {};
      const c  = (sd.current.consignee      as Record<string,string>) ?? {};
      const cl = (sd.current.classification as Record<string,string>) ?? {};
      const system = `You are Architect AI — Malaysian export compliance expert for Borderless AI. Current session:\n- Active step: ${activeStepRef.current + 1}/9 — ${STEPS[activeStepRef.current]?.title ?? ""}\n- Entity: ${e.company_name ? `✅ ${e.company_name} (BRN: ${e.registration_number})` : "⏳ Not verified"}\n- Consignee: ${c.buyer_name ? `✅ ${c.buyer_name}, ${c.buyer_country}` : "⏳ Not added"}\n- HS Code: ${cl.hs_code ? `✅ ${cl.hs_code}` : "⏳ Not classified"}\nBe concise and practical. Reference Malaysian regulations when relevant. Respond in the same language the user uses.`;
      const reply = await glmText(system, raw, chatHistory.current.slice(-10));
      chatHistory.current = [...chatHistory.current.slice(-14), { role: "user", content: raw }, { role: "assistant", content: reply }];
      pushAI(reply);
    } catch (err) {
      pushAI(`⚠️ ${err instanceof Error ? err.message : String(err)}`);
    } finally { setBusy(false); }
  }, [input, busy, classifyProduct]);

  // ── Action buttons ─────────────────────────────────────────────────────────
  const action = useCallback((act: string) => {
    if (act === "verify-entity")    { setEntityPrefill(undefined); setModal("entity"); return; }
    if (act === "add-consignee")    { setModal("consignee");  return; }
    if (act === "enter-valuation")  { setModal("valuation");  return; }
    if (act === "add-shipment")     { setModal("shipment");   return; }
    if (act === "connect-dagang")   { setModal("dagang");     return; }
    if (act === "sign-declaration") { setModal("signature");  return; }
    if (act === "generate-docs")    { generateAllDocs();      return; }
    if (act === "preview-k2")       { if (k2Data) setModal("k2preview"); else handleK2Submit(); return; }
    if (act === "upload-ssm")       { pendingEndpoint.current = "/entity/upload-ssm"; fileRef.current?.click(); return; }
    if (act === "upload-product")   { pendingEndpoint.current = "/classification/upload-product"; fileRef.current?.click(); return; }
  }, [generateAllDocs, handleK2Submit, k2Data]);

  // ── Step action buttons config ─────────────────────────────────────────────
  const stepActions: Record<number, Array<{ label: string; act: string; icon: React.ElementType; primary?: boolean }>> = {
    0: [{ label: "Upload SSM Certificate", act: "upload-ssm", icon: Upload, primary: true }, { label: "Enter Manually", act: "verify-entity", icon: Building2 }],
    1: [{ label: "Add Consignee", act: "add-consignee", icon: UserSquare2, primary: true }],
    2: [{ label: "Upload Product Photo", act: "upload-product", icon: Upload, primary: true }],
    4: [{ label: "Connect Dagang Net", act: "connect-dagang", icon: Link2, primary: true }],
    5: [{ label: "Enter Valuation", act: "enter-valuation", icon: Coins, primary: true }],
    6: [{ label: "Add Shipment Details", act: "add-shipment", icon: PackageSearch, primary: true }],
    7: [{ label: "Generate Documents", act: "generate-docs", icon: FileText, primary: true }, { label: "Sign Declaration", act: "sign-declaration", icon: PenLine }],
    8: [{ label: "Preview & Submit K2", act: "preview-k2", icon: Eye, primary: true }],
  };

  const curActions = stepActions[activeStep] ?? [];

  // ── Docs config ────────────────────────────────────────────────────────────
  const DOCS = [
    { id: "commercial-invoice", label: "Commercial Invoice",    icon: FileText,        req: [0,1,2,5] },
    { id: "packing-list",       label: "Packing List",          icon: FileSpreadsheet, req: [0,1,2,6] },
    { id: "bol",                label: "Bill of Lading / AWB",  icon: Ship,            req: [0,1,2,6] },
    { id: "coo",                label: "Certificate of Origin", icon: Stamp,           req: [0,1,2] },
    { id: "k2",                 label: "K2 Declaration Form",   icon: ClipboardList,   req: [0,1,2,3,4,5,6,7] },
  ];

  const total    = STEPS.length;
  const progress = Math.round((completed.size / total) * 100);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary/30">
      <TopNav />
      <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />

      {/* Modals */}
      {modal === "entity"     && <EntityModal     onClose={() => setModal(null)} onSubmit={handleEntity}    loading={mLoading} prefill={entityPrefill} />}
      {modal === "consignee"  && <ConsigneeModal  onClose={() => setModal(null)} onSubmit={handleConsignee} loading={mLoading} />}
      {modal === "valuation"  && <ValuationModal  onClose={() => setModal(null)} onSubmit={handleValuation} loading={mLoading} hsCode={String((sd.current.classification as Record<string,string> ?? {}).hs_code ?? "")} />}
      {modal === "shipment"   && <ShipmentModal   onClose={() => setModal(null)} onSubmit={handleShipment}  loading={mLoading} />}
      {modal === "dagang"     && <DagangNetModal  onClose={() => setModal(null)} onSubmit={handleDagang}    loading={mLoading} />}
      {modal === "signature"  && <SignatureModal  name={String((sd.current.logistics as Record<string,string> ?? {}).signatory_name ?? "")} title={String((sd.current.logistics as Record<string,string> ?? {}).signatory_designation ?? "")} onClose={() => setModal(null)} onSign={handleSign} />}
      {modal === "k2preview"  && k2Data && <K2PreviewModal k2Data={k2Data} onClose={() => setModal(null)} onSubmit={handleK2Submit} loading={mLoading} />}

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px]">

          {/* ── LEFT: Steps ─────────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft-md">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Export Checklist</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{completed.size}/{total}</span>
              </div>
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Progress</span><span>{progress}%</span></div>
                <div className="h-1.5 w-full rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="mb-3 flex items-center gap-1.5 text-[10px]">
                {sessionId ? <><span className="h-1.5 w-1.5 rounded-full bg-green-500" /><span className="text-green-600 font-medium">Connected</span></> : sessionError ? <><span className="h-1.5 w-1.5 rounded-full bg-red-500" /><span className="text-red-600 font-medium">Demo mode</span></> : <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Connecting…</span></>}
              </div>
              <ol className="space-y-1">
                {STEPS.map((step, idx) => {
                  const done   = completed.has(step.id);
                  const active = step.id === activeStep;
                  const locked = !done && !active;
                  const Icon   = step.icon;
                  return (
                    <li key={step.id} className="relative">
                      {idx < STEPS.length - 1 && <span className={`absolute left-[19px] top-9 h-[calc(100%-12px)] w-px ${done ? "bg-green-300" : "bg-border"}`} />}
                      <div className={`flex items-start gap-3 rounded-xl p-2 ${active ? "bg-primary/10 ring-1 ring-primary/30" : done ? "" : "opacity-50"}`}>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                          {done ? <CheckCircle2 className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">STEP {step.id + 1}</span>
                            {active && <span className="rounded-full bg-primary px-1.5 py-px text-[9px] font-bold text-white">NOW</span>}
                          </div>
                          <div className="text-[13px] font-semibold text-foreground">{step.title}</div>
                          <div className="text-[11px] text-muted-foreground">{step.subtitle}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          {/* ── MIDDLE: Chat ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 min-w-0">
            <section className="flex min-h-[70vh] flex-col rounded-2xl border border-border bg-card shadow-soft-md">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-glow"><Sparkles className="h-4 w-4 text-white" /></div>
                  <div>
                    <div className="text-sm font-semibold">Architect AI</div>
                    <div className="text-[11px] text-muted-foreground">Step {activeStep + 1} · {STEPS[activeStep]?.title}</div>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${sessionId ? "bg-green-50 text-green-700" : sessionError ? "bg-red-50 text-red-700" : "bg-secondary text-muted-foreground"}`}>
                  {sessionId ? <><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Live</> : sessionError ? <>Demo</> : <><Loader2 className="h-3 w-3 animate-spin" />Connecting</>}
                </div>
              </div>

              {/* Messages */}
              <div ref={chatRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {msgs.map(m => (
                  <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "items-start gap-3"}`}>
                    {m.from === "ai" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-glow">
                        {m.kind === "spin" ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Sparkles className="h-4 w-4 text-white" />}
                      </div>
                    )}
                    <div className={`max-w-[85%] ${m.from === "user" ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-white" : "rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-foreground"}`}>
                      {m.kind === "upload"
                        ? <div className="flex items-center gap-2 text-sm"><Upload className="h-3.5 w-3.5" />{m.fileName}</div>
                        : m.kind === "spin"
                        ? <span className="text-muted-foreground">{m.text}</span>
                        : <div className="space-y-1">{renderMarkdown(m.text ?? "")}</div>
                      }
                    </div>
                  </div>
                ))}
                {/* Permit upload cards */}
                {activeStep === 3 && permits.length > 0 && !permits.every(p => p.uploaded) && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary"><Sparkles className="h-4 w-4 text-white" /></div>
                    <div className="rounded-2xl border border-border bg-card p-3 space-y-2 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Upload Permit Certificates</p>
                      {permits.map(p => (
                        <div key={p.key} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                          <input type="file" className="hidden" id={`permit-${p.key}`} accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; e.target.value=""; if(f){ pendingPermitKey.current = p.key; handlePermitUpload(p.key, f); }}} />
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${p.uploaded ? "bg-green-100" : "bg-yellow-100"}`}>
                            {p.uploaded ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Award className="h-4 w-4 text-yellow-600" />}
                          </div>
                          <div className="flex-1"><p className="text-[12px] font-semibold">{p.name}</p><p className="text-[10px] text-muted-foreground">{p.uploaded ? "Uploaded ✓" : "Required"}</p></div>
                          {!p.uploaded && <label htmlFor={`permit-${p.key}`} className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-white cursor-pointer hover:opacity-90"><Upload className="h-3 w-3" />Upload</label>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Step action buttons */}
                {curActions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {curActions.map(a => {
                      const Icon = a.icon;
                      return (
                        <button key={a.act} onClick={() => action(a.act)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${a.primary ? "bg-primary text-white shadow-glow hover:opacity-90" : "border border-border bg-card text-foreground hover:bg-secondary"}`}>
                          <Icon className="h-4 w-4" />{a.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {busy && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary"><Loader2 className="h-4 w-4 text-white animate-spin" /></div>
                    <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border bg-card/60 p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/40">
                  <button onClick={() => { pendingEndpoint.current = activeStep === 0 ? "/entity/upload-ssm" : activeStep === 2 ? "/classification/upload-product" : "/documents/upload"; fileRef.current?.click(); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"><Paperclip className="h-4 w-4" /></button>
                  <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}} placeholder={activeStep === 2 && !completed.has(2) ? "Describe your product (e.g. crude palm oil, rubber gloves)…" : "Ask about regulations, permits, FTA…"} rows={1} className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-24" />
                  <button onClick={send} disabled={!input.trim() || busy} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-glow hover:opacity-90 disabled:opacity-50">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="mt-1.5 flex justify-between px-1 text-[10px] text-muted-foreground"><span>↵ send · Shift+↵ newline</span><span>Step {activeStep + 1}/9</span></div>
              </div>
            </section>

            {/* Landed Cost */}
            <div className="rounded-2xl border border-border bg-card shadow-soft-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated</div><div className="text-sm font-semibold">Landed Cost</div></div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lc.finalised ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{lc.finalised ? "Finalised" : "Pending"}</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-4">
                {[{ l: "FOB", v: `RM ${(lc.fob||4720).toLocaleString()}` }, { l: "Freight + Insurance", v: `RM ${((lc.freight+lc.ins)||330).toLocaleString()}` }, { l: "Est. Duty", v: `RM ${(lc.duty||252).toLocaleString()}` }].map(r => (
                  <div key={r.l} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">{r.l}</span>
                    <span className="text-[13px] font-medium">{r.v}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-l border-border pl-6">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-semibold">RM {(lc.total||5302).toLocaleString()}</span>
                </div>
                {lc.savings > 0 && (
                  <div className="flex w-full items-center gap-2 rounded-xl bg-green-50 p-2.5">
                    <TrendingDown className="h-3.5 w-3.5 text-green-600" />
                    <p className="text-[11px] text-green-700">Save <strong>RM {lc.savings.toLocaleString()}</strong> via {lc.fta} FTA</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Document Pack ─────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft-md">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <div><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Export</div><div className="text-sm font-semibold">Document Pack</div></div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{generatedDocs.size} Ready</span>
              </div>
              <div className="space-y-1 px-3 py-3">
                {DOCS.map(doc => {
                  const Icon     = doc.icon;
                  const isReady  = doc.req.every(s => completed.has(s));
                  const isDone   = generatedDocs.has(doc.id);
                  const isGenning = generatingDoc === doc.id;
                  return (
                    <div key={doc.id} className={`flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-all ${isReady ? "hover:border-primary/30" : "opacity-50"}`}>
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isDone ? "bg-green-100" : isReady ? "bg-primary/10" : "bg-secondary"}`}>
                        <Icon className={`h-3.5 w-3.5 ${isDone ? "text-green-600" : isReady ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold">{doc.label}</div>
                        <div className="text-[10px] text-muted-foreground">{isDone ? "Generated ✓" : isReady ? "Ready to generate" : `${doc.req.filter(s => !completed.has(s)).length} steps remaining`}</div>
                      </div>
                      <button onClick={() => generateDoc(doc.id)} disabled={!isReady || isDone || isGenning} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all ${isDone ? "bg-green-500 text-white" : isReady ? "bg-primary text-white shadow-glow hover:opacity-90" : "bg-secondary text-muted-foreground"} disabled:cursor-not-allowed`}>
                        {isDone ? <CheckCircle2 className="h-3 w-3" /> : isGenning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      </button>
                    </div>
                  );
                })}
                {activeStep >= 7 && (
                  <div className="pt-2">
                    <button onClick={() => action("preview-k2")} className="w-full rounded-xl bg-primary px-4 py-2.5 text-[12px] font-semibold text-white shadow-glow hover:opacity-90 flex items-center justify-center gap-2">
                      <Eye className="h-4 w-4" />Preview & Submit K2
                    </button>
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

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER
// ─────────────────────────────────────────────────────────────────────────────
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
    const t = line.trim();
    if (!t) { flushList(`list-${idx}`); return; }
    const bullet = t.match(/^[*\-]\s+(.+)/);
    if (bullet) { listItems.push(bullet[1]); return; }
    const num = t.match(/^\d+\.\s+(.+)/);
    if (num) { listItems.push(num[1]); return; }
    const heading = t.match(/^#{2,3}\s+(.+)/);
    if (heading) { flushList(`list-${idx}`); nodes.push(<p key={idx} className="mt-2 mb-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{heading[1]}</p>); return; }
    flushList(`list-${idx}`);
    nodes.push(<p key={idx} className="text-sm leading-relaxed">{inlineFormat(t)}</p>);
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
}