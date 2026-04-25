/**
 * Mock replacements for glmJSON / glmText / geminiVision.
 * No real network calls — returns canned data after a short delay,
 * so the rest of the Assistant flow runs as-is.
 */

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function pickByKeywords(prompt: string, ...pairs: Array<[RegExp, () => Record<string, unknown>]>): Record<string, unknown> | null {
  for (const [re, fn] of pairs) if (re.test(prompt)) return fn();
  return null;
}

// ── Vision (document upload) mocks ──────────────────────────────────────────
export async function geminiVision(_b64: string, _mime: string, prompt: string): Promise<Record<string, unknown>> {
  await sleep(900);

  const ssm = pickByKeywords(prompt,
    [/SSM|company registration|registration_number/i, () => ({
      is_valid: true,
      company_name: "GREEN HARVEST EXPORTS SDN BHD",
      registration_number: "202301045678",
      registration_date: "2023-04-15",
      company_type: "Sdn Bhd",
      company_status: "active",
      registered_address: "No. 12, Jalan Perindustrian 5, Taman Klang Jaya, 41200 Klang, Selangor, Malaysia",
      directors: [
        { name: "Aisyah binti Rahman", nric: "880412-14-5566", designation: "Managing Director" },
        { name: "Tan Wei Ming", nric: "850722-10-3344", designation: "Director" },
      ],
      paid_up_capital: "RM 500,000",
      blacklisted: false,
      sst_registered: true,
      compliance_flags: [],
      missing_fields: [],
      confidence: 0.94,
      extraction_notes: "Mock SSM extraction",
    })],
    [/AHTN|HS 2022|tariff classification|hs_code/i, () => ({
      identified: true,
      hs_code: "2008.99.90",
      hs_description: "Prepared/preserved tropical fruit, sweetened (durian paste)",
      product_name: "Frozen Durian Paste",
      malaysia_export_duty: 0,
      destination_import_duty: 5,
      fta_available: ["ATIGA", "RCEP"],
      permit_required: [],
      sirim_required: false,
      halal_required: true,
      miti_required: false,
      confidence: 0.91,
      identification_notes: "Mock product classification",
    })],
    [/permit|certificate|JAKIM|SIRIM/i, () => ({
      is_valid: true,
      permit_type: "Halal Certificate",
      issuing_body: "JAKIM Malaysia",
      certificate_number: "MS1500-2024-00891",
      company_name: "GREEN HARVEST EXPORTS SDN BHD",
      issue_date: "2024-06-01",
      expiry_date: "2026-05-31",
      scope: "Frozen prepared fruits",
      confidence: 0.92,
    })],
  );
  return ssm ?? { is_valid: true, confidence: 0.8 };
}

// ── Chat / JSON (no file) mocks ─────────────────────────────────────────────
export async function glmJSON(system: string, user: string, _history: Array<{ role: string; content: string }> = []): Promise<Record<string, unknown>> {
  await sleep(700);
  const all = `${system}\n${user}`;

  // Sanctions screening
  if (/sanctions|OFAC|denied_party/i.test(all)) {
    return { risk_level: "low", sanctioned_country: false, denied_party_check: "clear", compliance_notes: ["Buyer matched against UN/OFAC/MFA — no hits."], red_flags: [] };
  }

  // FTA evaluation
  if (/ATIGA|CPTPP|RCEP|MAFTA|best_fta/i.test(all) && /CIF/i.test(all)) {
    const cifMatch = user.match(/CIF:\s*RM([\d.]+)/i);
    const cif = cifMatch ? parseFloat(cifMatch[1]) : 5000;
    return {
      best_fta: "ATIGA",
      best_fta_rate: 0.0,
      best_savings_myr: Math.round(cif * 0.05),
      form_required: "Form D",
      roo_met: true,
      notes: "Wholly Obtained Malaysian product qualifies for ATIGA preferential rate.",
    };
  }

  // Permit check
  if (/permits_required|Strategic Goods|PUA122|PUA 122/i.test(all)) {
    const isHalal = /durian|food|halal|frozen|paste/i.test(all);
    return {
      permits_required: isHalal
        ? [{ name: "Halal Certificate (JAKIM)", issuing_body: "JAKIM", mandatory: true, processing_days: 21, portal: "https://www.halal.gov.my" }]
        : [],
      sirim_required: false,
      halal_required: isHalal,
      miti_license_required: false,
      strategic_goods_control: false,
      none_required: !isHalal,
      notes: isHalal ? ["Halal certification recommended for Muslim-majority destination."] : [],
    };
  }

  // HS classification from text product description
  if (/HS tariff classification|WCO HS|AHTN/i.test(all)) {
    return {
      identified: true,
      hs_code: "2008.99.90",
      hs_description: "Prepared/preserved tropical fruit (durian paste)",
      product_name: "Frozen Durian Paste",
      malaysia_export_duty: 0,
      destination_import_duty: 5,
      fta_available: ["ATIGA", "RCEP"],
      permit_required: [],
      sirim_required: false,
      halal_required: true,
      miti_required: false,
      confidence: 0.9,
    };
  }

  // SSM correction (manual)
  if (/Extract company registration details|company_name.*registration_number/i.test(system)) {
    return {
      company_name: "GREEN HARVEST EXPORTS SDN BHD",
      registration_number: "202301045678",
      company_type: "Sdn Bhd",
      company_status: "active",
      directors: [{ name: "Aisyah binti Rahman", nric: "880412-14-5566", designation: "Director" }],
      paid_up_capital: "RM 500,000",
      sst_registered: true,
    };
  }

  // Documents — Commercial Invoice
  if (/Commercial Invoice/i.test(system)) return mockInvoice(user);
  if (/Packing List/i.test(system))       return mockPackingList(user);
  if (/Certificate of Origin/i.test(system)) return mockCOO(user);
  if (/Bill of Lading/i.test(system))     return mockBOL(user);
  if (/K2 Customs Export Declaration|k2_form_data/i.test(system)) return mockK2(user);
  if (/SIRIM export compliance/i.test(system)) {
    return { checklist_items: [{ item: "Product testing report", status: "required", reference: "SIRIM-MS-1234" }], sirim_scheme: "Voluntary Certification", processing_weeks: 4, portal: "https://www.sirim-qas.com.my" };
  }
  if (/JAKIM Halal export checklist/i.test(system)) {
    return { checklist_items: [{ item: "Halal MS1500:2019 audit", status: "required" }], jakim_scheme: "MS1500:2019", processing_weeks: 6, portal: "https://www.halal.gov.my" };
  }

  return { ok: true };
}

// ── Plain-text chat fallback ────────────────────────────────────────────────
export async function glmText(_system: string, user: string, _history: Array<{ role: string; content: string }> = []): Promise<string> {
  await sleep(600);
  if (/duty|tariff|hs/i.test(user)) return "Mock answer: AHTN 2022 classification 2008.99.90 attracts 5% MFN at most ASEAN destinations. With ATIGA Form D, the preferential rate drops to 0%.";
  if (/k2|declaration|customs/i.test(user)) return "Mock answer: K2 is the RMCD export declaration, submitted via Dagang Net under the Customs Act 1967. You'll need a digital certificate and signed declaration.";
  if (/fta|atiga|rcep/i.test(user)) return "Mock answer: ATIGA gives 0% duty between ASEAN members provided Rules of Origin (Wholly Obtained or RVC≥40%) are met. RCEP overlaps but adds China/Japan/Korea/AU/NZ.";
  return "Mock response: I'm running in demo mode — no live AI calls. Continue through the workflow and I'll generate sample documents for you.";
}

// ── helpers to read context ─────────────────────────────────────────────────
function readCtx(ctx: string) {
  const get = (re: RegExp) => (ctx.match(re)?.[1] ?? "").trim();
  return {
    exporterName: get(/Exporter:\s*([^,\n]+)/i) || "GREEN HARVEST EXPORTS SDN BHD",
    brn:          get(/BRN\s+([^\s,\n]+)/i)     || "202301045678",
    expAddress:   get(/Exporter:[^,]+,[^,]+,\s*([^\n]+)/i) || "Klang, Selangor, Malaysia",
    consigneeName:    get(/Consignee:\s*([^,\n]+)/i) || "PT Sumber Rasa",
    consigneeCountry: get(/Consignee:[^,]+,\s*([^,\n]+)/i) || "Indonesia",
    consigneeAddr:    get(/Consignee:[^,]+,[^,]+,\s*([^\n]+)/i) || "Jakarta, Indonesia",
    incoterm:  get(/Incoterm:\s*([A-Z]+)/) || "FOB",
    hsCode:    get(/HS Code:\s*([^,\n]+)/) || "2008.99.90",
    hsDesc:    get(/Description:\s*([^,\n]+)/) || "Frozen Durian Paste",
    fob:       parseFloat(get(/FOB:\s*RM([\d.]+)/)) || 4720,
    freight:   parseFloat(get(/Freight:\s*RM([\d.]+)/)) || 210,
    insurance: parseFloat(get(/Insurance:\s*RM([\d.]+)/)) || 24,
    cif:       parseFloat(get(/CIF:\s*RM([\d.]+)/)) || 4954,
    duty:      parseFloat(get(/Duty:\s*RM([\d.]+)/)) || 248,
    mode:      get(/Mode:\s*([A-Z]+)/) || "SEA",
    vessel:    get(/Vessel:\s*([^,\n]+)/) || "MV Bunga Mas 5",
    pol:       get(/POL:\s*([^,\n]+)/) || "Port Klang",
    pod:       get(/POD:\s*([^,\n]+)/) || "Tanjung Priok",
    exportDate:get(/Export date:\s*([^,\n]+)/) || new Date().toISOString().slice(0, 10),
    weight:    parseFloat(get(/Gross wt:\s*([\d.]+)/)) || 480,
    cbm:       parseFloat(get(/CBM:\s*([\d.]+)/)) || 1.2,
    pkgs:      parseInt(get(/Packages:\s*(\d+)/)) || 12,
    pkgType:   get(/Packages:\s*\d+\s*x\s*([A-Z]+)/) || "CTN",
    container: get(/Container:\s*([^,\n]+)/) || "MSKU-7842150",
    sigName:   get(/Signatory:\s*([^,\n]+)/) || "Aisyah binti Rahman",
    sigTitle:  get(/Signatory:[^,]+,\s*([^,\n]+)/) || "Director",
    sigIc:     get(/IC:\s*([^,\n]+)/) || "880412-14-5566",
  };
}

function mockInvoice(ctx: string) {
  const c = readCtx(ctx);
  const subtotal = c.fob;
  return {
    invoice_number: `CI-MY-2026-${Math.floor(Math.random() * 900 + 100)}`,
    invoice_date: new Date().toISOString().slice(0, 10),
    payment_terms: "T/T 30 days",
    exporter: { name: c.exporterName, brn: c.brn, address: c.expAddress, tel: "+603-3344 5566", email: "exports@greenharvest.my", bank: "Maybank · 5141-2233-4455" },
    consignee: { name: c.consigneeName, country: c.consigneeCountry, address: c.consigneeAddr, tax_id: "01.234.567.8-901.000", contact_person: "Ahmad Rizal" },
    goods: [{ line_no: 1, hs_code: c.hsCode, description: c.hsDesc, quantity: c.weight, unit: "KG", unit_price: +(c.fob / c.weight).toFixed(2), total: c.fob }],
    incoterm: c.incoterm, port_of_loading: c.pol, port_of_discharge: c.pod, currency: "MYR",
    subtotal, freight: c.freight, insurance: c.insurance,
    total_fob: c.fob, total_cif: c.cif, vessel_or_flight: c.vessel,
  };
}

function mockPackingList(ctx: string) {
  const c = readCtx(ctx);
  const pkgs = Array.from({ length: Math.min(c.pkgs, 5) }, (_, i) => ({
    package_no: `${i + 1}`,
    type: c.pkgType,
    description: c.hsDesc,
    gross_weight_kg: +(c.weight / Math.min(c.pkgs, 5)).toFixed(1),
    net_weight_kg: +(c.weight * 0.92 / Math.min(c.pkgs, 5)).toFixed(1),
    cbm: +(c.cbm / Math.min(c.pkgs, 5)).toFixed(3),
    quantity_inside: 24,
  }));
  return {
    packing_list_number: `PL-MY-2026-${Math.floor(Math.random() * 900 + 100)}`,
    date: new Date().toISOString().slice(0, 10),
    exporter: { name: c.exporterName, address: c.expAddress },
    consignee: { name: c.consigneeName, country: c.consigneeCountry, address: c.consigneeAddr },
    invoice_reference: "CI-MY-2026-001",
    vessel_or_flight: c.vessel, port_of_loading: c.pol, port_of_discharge: c.pod,
    packages: pkgs,
    total_packages: c.pkgs,
    total_gross_weight_kg: c.weight,
    total_net_weight_kg: +(c.weight * 0.92).toFixed(1),
    total_cbm: c.cbm,
    shipping_marks: `${c.consigneeName.substring(0, 3).toUpperCase()}/2026/001`,
    container_number: c.container,
  };
}

function mockCOO(ctx: string) {
  const c = readCtx(ctx);
  return {
    co_number: `CO-MY-2026-${Math.floor(Math.random() * 900 + 100)}`,
    co_date: new Date().toISOString().slice(0, 10),
    form_type: "Form D (ATIGA)",
    issuing_body: "MATRADE",
    exporter: { name: c.exporterName, address: c.expAddress, country: "Malaysia", brn: c.brn },
    consignee: { name: c.consigneeName, address: c.consigneeAddr, country: c.consigneeCountry },
    transport_details: { vessel_or_flight: c.vessel, port_of_loading: c.pol, port_of_discharge: c.pod, departure_date: c.exportDate },
    goods: [{ item_no: 1, description: c.hsDesc, hs_code: c.hsCode, origin_criterion: "WO", quantity: `${c.weight} kg`, gross_weight_kg: c.weight, fob_value_myr: c.fob }],
    invoice_reference: "CI-MY-2026-001",
  };
}

function mockBOL(ctx: string) {
  const c = readCtx(ctx);
  return {
    bl_number: `MAEU${Math.floor(Math.random() * 900000 + 100000)}`,
    bl_date: new Date().toISOString().slice(0, 10),
    bl_type: "OBL",
    shipper: { name: c.exporterName, address: c.expAddress, brn: c.brn },
    consignee: { name: c.consigneeName, address: c.consigneeAddr, country: c.consigneeCountry },
    notify_party: { name: c.consigneeName, address: c.consigneeAddr },
    vessel_or_flight: c.vessel,
    voyage_or_flight_number: "0412W",
    port_of_loading: c.pol, port_of_discharge: c.pod,
    freight_terms: "Prepaid",
    container_details: [{
      container_no: c.container, seal_no: "SL-998877",
      type: "20'GP", packages: c.pkgs, description: c.hsDesc,
      gross_weight_kg: c.weight, cbm: c.cbm,
    }],
    total_packages: c.pkgs, total_gross_weight_kg: c.weight, total_cbm: c.cbm,
    place_of_issue: "Port Klang", number_of_originals: 3,
    carrier_name: "Maersk Line",
  };
}

function mockK2(ctx: string) {
  const c = readCtx(ctx);
  return {
    k2_reference: `K2-MY-2026-${Math.floor(Math.random() * 900 + 100)}`,
    declaration_type: "EX",
    export_date: c.exportDate,
    k2_form_data: {
      header: { declaration_type: "EX", customs_procedure_code: "10", regime_type: "Export" },
      exporter: { name: c.exporterName, brn: c.brn, address: c.expAddress },
      consignee: { name: c.consigneeName, country_code: c.consigneeCountry === "Indonesia" ? "ID" : "XX", address: c.consigneeAddr },
      transport: {
        mode_code: "1", mode_description: c.mode,
        vessel_flight_name: c.vessel, voyage_flight_number: "0412W",
        port_of_loading_code: "MYPKG", port_of_discharge_code: "IDJKT",
        country_of_destination_code: "ID", container_indicator: "Y",
      },
      goods: {
        item_number: 1, commodity_description: c.hsDesc, hs_code: c.hsCode,
        country_of_origin: "MY", quantity: c.weight, unit_of_quantity: "KG",
        gross_weight_kg: c.weight, net_weight_kg: +(c.weight * 0.92).toFixed(1),
        number_of_packages: c.pkgs, package_type_code: c.pkgType,
        container_number: c.container,
      },
      valuation: {
        fob_value_myr: c.fob, invoice_currency: "MYR", invoice_amount: c.fob,
        exchange_rate: 1.0, incoterm: c.incoterm,
        freight_myr: c.freight, insurance_myr: c.insurance, cif_value_myr: c.cif,
      },
      duty: { export_duty_myr: 0, customs_duty_myr: c.duty, sst_myr: 0, total_duty_myr: c.duty },
      fta: { fta_claimed: true, fta_name: "ATIGA", form_type: "Form D", preferential_rate: 0.0 },
      signatory: { name: c.sigName, nric_passport: c.sigIc, designation: c.sigTitle, date: new Date().toISOString().slice(0, 10) },
    },
    compliance_notes: ["Mock K2 generated — for demo only."],
    warnings: [],
  };
}

// File → base64 (kept for parity, but mock api ignores the contents)
export function fileToB64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload  = () => res((fr.result as string).split(",")[1] ?? "");
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

export const fileMime = (f: File): string =>
  f.type || (f.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
