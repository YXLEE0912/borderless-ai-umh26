import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  Mic, Sparkles, ScanLine, ArrowRight, RefreshCw,
  CheckCircle2, AlertTriangle, Image as ImageIcon, X, Loader2,
  Send,
  Info, Square
} from "lucide-react";
import { scanProduct, followUpScan, type BackendScanResult, type BackendScanAnalysis } from "@/lib/api";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtorLike = new () => SpeechRecognitionLike;

const BAHASA_VOICE_HINTS = [
  "hantar", "eksport", "produk", "dokumen", "permit", "barang", "ke", "dan", "yang", "adalah",
];

const resolveRecognitionLanguage = (queryText: string): string => {
  const storedPreference = (localStorage.getItem("app.language") || "").toLowerCase().trim();
  if (storedPreference.includes("bahasa")) return "ms-MY";
  if (storedPreference.includes("english")) return "en-US";
  if (storedPreference.includes("中文") || storedPreference.includes("chinese")) return "zh-CN";
  if (storedPreference.includes("arab")) return "ar-SA";

  const normalizedQuery = queryText.toLowerCase();
  if (BAHASA_VOICE_HINTS.some((token) => normalizedQuery.includes(token))) return "ms-MY";

  const browserLocale = (navigator.language || "en-US").toLowerCase();
  if (browserLocale.startsWith("ms")) return "ms-MY";
  if (browserLocale.startsWith("zh")) return "zh-CN";
  if (browserLocale.startsWith("ar")) return "ar-SA";
  return "en-US";
};

type MessageRole = "user" | "assistant";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  repliedTo?: string;
  type?: "text" | "hint" | "result" | "image";
  result?: ScanResult;
  imagePreview?: string;
  hints?: HintChip[];
};

type HintChip = {
  icon: React.ElementType;
  label: string;
  value: string;
};

type ScanResult = {
  scanId?: string;
  intent?: ScanIntent;
  analysis: BackendScanAnalysis;
  product: string;
  hsCode: string;
  confidence: "High" | "Medium" | "Low";
  status: "green" | "yellow" | "red" | "invalid";
  insights: { tone: "ok" | "warn" | "bad"; text: string }[];
  rawText: string;
  invalid?: boolean;
  invalidMessage?: string;
  materialsDetected?: string[];
  hsCodeCandidates?: string[];
  complianceSummary?: string;
  requiredDocuments?: string[];
  requiredPermits?: string[];
  requiredAgencies?: string[];
  extractionNotes?: string[];
  decisionSteps?: { phase: string; decision: string; reason: string }[];
  followUpQuestions?: string[];
  source?: string;
  ruleHits?: string[];
};

type ScanIntent = {
  wantsDocuments: boolean;
  wantsPermitDetails: boolean;
  wantsExportCheck: boolean;
  wantsTechnicalTrace: boolean;
};

const COUNTRY_KEYWORDS = [
  "china", "singapore", "us", "usa", "united states", "japan", "korea", "south korea", "uk", "united kingdom",
  "europe", "eu", "australia", "canada", "thailand", "vietnam", "indonesia", "malaysia",
];

const DOCUMENT_KEYWORDS = ["document", "documents", "paperwork", "permit", "permits", "cert", "certificate", "licence", "license"];

const normalizeText = (value: string) => value.toLowerCase().trim();

const extractDestinationCountry = (text: string): string | undefined => {
  const normalized = normalizeText(text);
  const countryMatch = COUNTRY_KEYWORDS.find((keyword) => normalized.includes(keyword));
  if (!countryMatch) return undefined;
  if (countryMatch === "usa") return "US";
  if (countryMatch === "united states") return "US";
  if (countryMatch === "uk" || countryMatch === "united kingdom") return "UK";
  if (countryMatch === "eu" || countryMatch === "europe") return "EU";
  return countryMatch.replace(/\b\w/g, (character) => character.toUpperCase());
};

const detectIntent = (text: string): ScanIntent => {
  const normalized = normalizeText(text);
  return {
    wantsDocuments: DOCUMENT_KEYWORDS.some((keyword) => normalized.includes(keyword)),
    wantsPermitDetails: normalized.includes("permit") || normalized.includes("licence") || normalized.includes("license"),
    wantsExportCheck: normalized.includes("can it export") || normalized.includes("can i export") || normalized.includes("export"),
    wantsTechnicalTrace:
      normalized.includes("decision trace") ||
      normalized.includes("technical") ||
      normalized.includes("rule hit") ||
      normalized.includes("why") ||
      normalized.includes("reason"),
  };
};

const compactRestriction = (line: string): string => {
  const normalized = line.trim();
  if (!normalized) return "";
  if (/^permits required:/i.test(normalized)) return normalized.replace(/^permits required:/i, "Permits:");
  if (/^agency checks:/i.test(normalized)) return normalized.replace(/^agency checks:/i, "Agencies:");
  if (/^common documents:/i.test(normalized)) return normalized.replace(/^common documents:/i, "Documents:");
  return normalized;
};

const isOpaqueRuleToken = (line: string): boolean => /^[A-Z]{2,}-[A-Z0-9-]{2,}$/i.test(line.trim());

const dedupeNormalized = (values: string[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
};

const mapBackendResult = (result: BackendScanResult, scanId?: string, intent?: ScanIntent): ScanResult => {
  const status: ScanResult["status"] =
    result.status === "green" ? "green" :
    result.status === "restricted" ? "red" :
    result.status === "conditional" ? "yellow" : "yellow";

  const wantsDocuments = Boolean(intent?.wantsDocuments);
  const baseAnalysis: BackendScanAnalysis = result.analysis || {
    verdict: "Needs More Info",
    verdict_reason: result.compliance_summary || "More details are needed before a reliable decision.",
    destination_country: null,
    why_this_status: result.compliance_summary ? [result.compliance_summary] : [],
    restrictions: [],
    missing_information: result.follow_up_questions || [],
    next_steps: [],
  };

  const reason = (baseAnalysis.verdict_reason || "").trim().toLowerCase();
  const whyThisStatus = dedupeNormalized(
    (baseAnalysis.why_this_status || [])
      .filter((line) => !isOpaqueRuleToken(line))
      .filter((line) => line.trim().toLowerCase() !== reason)
  ).slice(0, 2);

  const restrictions = dedupeNormalized((baseAnalysis.restrictions || []).map(compactRestriction));

  const analysis: BackendScanAnalysis = {
    ...baseAnalysis,
    why_this_status: whyThisStatus,
    restrictions,
  };

  return {
    scanId,
    intent,
    analysis,
    product: result.product_name || "Unknown Product",
    hsCode: result.hs_code_candidates[0] || "0000.00",
    hsCodeCandidates: result.hs_code_candidates,
    confidence:
      result.hs_code_confidence >= 0.8 ? "High" :
      result.hs_code_confidence >= 0.5 ? "Medium" : "Low",
    status,
    insights: [
      ...(wantsDocuments ? result.required_documents.slice(0, 2).map((doc) => ({ tone: "warn" as const, text: `Required document: ${doc}` })) : []),
    ],
    rawText: result.decision_steps.map((step) => `${step.phase}: ${step.decision}`).join(" · ") || result.hs_code_reasoning || "",
    materialsDetected: result.materials_detected,
    complianceSummary: result.compliance_summary,
    requiredDocuments: result.required_documents,
    requiredPermits: result.required_permits,
    requiredAgencies: result.required_agencies,
    extractionNotes: result.extraction_notes,
    decisionSteps: result.decision_steps,
    followUpQuestions: result.follow_up_questions,
    source: result.source,
    ruleHits: result.rule_hits,
  };
};

const STATUS_META: Record<Exclude<ScanResult["status"], "invalid">, { label: string; toneClass: string; icon: React.ElementType }> = {
  green: { label: "Allowed", toneClass: "bg-success-soft text-success border-success/20", icon: CheckCircle2 },
  yellow: { label: "Allowed With Restrictions", toneClass: "bg-warning-soft text-warning border-warning/30", icon: AlertTriangle },
  red: { label: "Prohibited", toneClass: "bg-[hsl(var(--error-soft))] text-destructive border-destructive/20", icon: X },
};

const CONFIDENCE_META: Record<ScanResult["confidence"], { width: string; toneClass: string }> = {
  High: { width: "88%", toneClass: "bg-success" },
  Medium: { width: "64%", toneClass: "bg-warning" },
  Low: { width: "36%", toneClass: "bg-destructive" },
};

const genId = () => Math.random().toString(36).slice(2);

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  type: "text",
  content: "Hey! I'm your AI export scanner. Tell me the product and destination. If details are too general, I will ask for material and other missing info.",
};

export default function Scan() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedReply, setSelectedReply] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, scanning]);

  useEffect(() => {
    const recognitionCtor = (
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtorLike }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtorLike }).webkitSpeechRecognition
    );

    if (!recognitionCtor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new recognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result?.[0]?.transcript || "";
      }
      const clean = transcript.trim();
      if (!clean) return;

      setQuery((previous) => (previous.trim() ? `${previous.trim()} ${clean}` : clean));
      textareaRef.current?.focus();
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleMicClick = () => {
    if (!speechSupported || !recognitionRef.current) {
      setMessages((previous) => [
        ...previous,
        {
          id: genId(),
          role: "assistant",
          type: "text",
          content: "Speech-to-text is not supported in this browser. Please type your prompt.",
        },
      ]);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    try {
      recognitionRef.current.lang = resolveRecognitionLanguage(query);
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    textareaRef.current?.focus();
  };

  const sendMessage = async (overrideQuery?: string) => {
    const typedQuery = (overrideQuery ?? query.trim()).trim();
    const replyContext = selectedReply.trim();
    const activeQuery = [replyContext, typedQuery].filter(Boolean).join("\n");
    if (!activeQuery && !file) return;

    if (!activeQuery && file) {
      setMessages(prev => [...prev, {
        id: genId(), role: "assistant", type: "hint",
        content: "Please add a short prompt so I can run an accurate scan. Example format: product, material, destination country.",
        hints: [
          { icon: Info, label: "Describe product and material", value: "This is a woven rattan handbag made from finished rattan." },
          { icon: Info, label: "Add destination country", value: "Destination country: China" },
        ],
      }]);
      return;
    }

    const activeFile = file;
    const intent = detectIntent(activeQuery);

    const userMsg: Message = {
      id: genId(), role: "user", type: "text",
      content: typedQuery || replyContext || "Please analyse this product image.",
      repliedTo: replyContext || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setSelectedReply("");

    setScanning(true);

    try {
      const activeScanId = lastResult?.scanId;
      const shouldUseFollowUp = Boolean(activeScanId) && !activeFile;

      let nextResult: ScanResult;
      if (shouldUseFollowUp) {
        const destinationCountry = extractDestinationCountry(activeQuery);
        const response = await followUpScan(activeScanId!, {
          message: activeQuery || "Please continue the compliance analysis.",
          ...(destinationCountry ? { destination_country: destinationCountry } : {}),
        });
        nextResult = mapBackendResult(response.result, response.scan_id, intent);
      } else {
        const destinationCountry = extractDestinationCountry(activeQuery);
        const response = await scanProduct({
          product_prompt: activeQuery || undefined,
          ...(destinationCountry ? { destination_country: destinationCountry } : {}),
          product_image: activeFile,
        });
        nextResult = mapBackendResult(response.result, response.scan_id, intent);
      }

      setLastResult(nextResult);

      if (nextResult.invalid) {
        setMessages(prev => [...prev, {
          id: genId(), role: "assistant", type: "text",
          content: nextResult.invalidMessage || "Hmm, I need a product name to scan! 😅",
        }]);
      } else {
        const followUpHints = (nextResult.followUpQuestions || []).slice(0, 4).map((question) => ({
          icon: Info,
          label: question,
          value: question,
        }));

        setMessages(prev => [...prev, {
          id: genId(), role: "assistant", type: "result",
          content: "", result: nextResult,
        }, ...(followUpHints.length > 0 ? [{
          id: genId(), role: "assistant" as const, type: "hint" as const,
          content: "To improve accuracy, answer one of these:",
          hints: followUpHints,
        }] : [])]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Alamak something went wrong 😅 Cuba lagi!";
      setMessages(prev => [...prev, {
        id: genId(), role: "assistant", type: "text",
        content: message,
      }]);
    } finally {
      setScanning(false);
      setFile(null);
      setPreview(null);
    }
  };

  const handleHint = (value: string) => {
    setSelectedReply(value.trim());
    textareaRef.current?.focus();
  };

  const reset = () => {
    setMessages([WELCOME_MESSAGE]);
    setFile(null);
    setPreview(null);
    setQuery("");
    setSelectedReply("");
    setLastResult(null);
  };

  const continueToPlan = (result: ScanResult) => {
    navigate("/assistant", {
      state: { from: "scan", product: result.product, hsCode: result.hsCode, confidence: result.confidence, destinationCountry: "China" },
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <main className="flex-1 flex flex-col mx-auto w-full max-w-[760px] px-4 pb-0">
        {/* Header */}
        <div className="py-6 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-xs">
            <ScanLine className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">Agent 1 · Product Scanner</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scan Your Product</h1>
          <p className="mt-1 text-sm text-muted-foreground">Check if your product can be sold globally.</p>
        </div>

        {/* Chat messages */}
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}>
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-glow mt-1">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              )}

              <div className={`max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                {/* Image message */}
                {msg.type === "image" && (
                  <div className="rounded-2xl overflow-hidden border border-border shadow-soft-sm bg-card">
                    <img src={msg.imagePreview} alt="Product" className="max-h-48 object-cover w-full" />
                    <div className="px-3 py-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ImageIcon className="h-3 w-3" />{msg.content}
                    </div>
                  </div>
                )}

                {/* Text message */}
                {msg.type === "text" && (
                  <div className="space-y-1.5">
                    {msg.role === "user" && msg.repliedTo && (
                      <div className="max-w-[85%] ml-auto rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary-foreground/90">
                        <div className="text-[10px] uppercase tracking-wider text-primary-foreground/70">Replying to</div>
                        <div className="truncate text-primary-foreground">{msg.repliedTo}</div>
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border text-foreground rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* Hint message */}
                {msg.type === "hint" && (
                  <div className="space-y-3">
                    <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-line">
                      {msg.content}
                    </div>
                    {msg.hints && (
                      <div className="flex flex-wrap gap-2">
                        {msg.hints.map((h) => {
                          const Icon = h.icon;
                          return (
                            <button
                              key={h.label}
                              onClick={() => handleHint(h.value)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary transition-base"
                            >
                              <Icon className="h-3 w-3" />
                              {h.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Result message */}
                {msg.type === "result" && msg.result && (
                  <div className="w-full rounded-2xl rounded-tl-sm border border-border bg-card shadow-soft-md overflow-hidden">
                    {/* Result header */}
                    <div className={`px-4 py-3 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                      msg.result.status === "green" ? "bg-success-soft/40" :
                      msg.result.status === "yellow" ? "bg-warning-soft/40" : "bg-[hsl(var(--error-soft))]"
                    }`}>
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scan Result</div>
                        <div className="text-base font-semibold text-foreground">{msg.result.product}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {msg.result.analysis.destination_country && (
                            <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                              Destination: {msg.result.analysis.destination_country}
                            </span>
                          )}
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">HS {msg.result.hsCode}</span>
                          <span className="rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">{msg.result.confidence} confidence</span>
                          {msg.result.source && (
                            <span className="rounded-md bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Source: {msg.result.source}</span>
                          )}
                        </div>
                      </div>
                      {msg.result.status !== "invalid" && (() => {
                        const meta = STATUS_META[msg.result.status];
                        const Icon = meta.icon;
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.toneClass}`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      <div className="rounded-xl border border-border bg-background/60 px-3 py-2.5 text-[13px] text-foreground">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Summary</div>
                        {msg.result.analysis.verdict_reason || msg.result.complianceSummary || "No summary returned."}
                      </div>

                      {msg.result.analysis.why_this_status?.map((line, i) => (
                        <div key={`why-${i}`} className="flex items-start gap-2 text-[13px] text-foreground">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="leading-relaxed">{line}</span>
                        </div>
                      ))}

                      {(msg.result.status !== "green" || msg.result.intent?.wantsExportCheck || msg.result.intent?.wantsPermitDetails) && msg.result.analysis.restrictions?.length ? (
                        <div className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Restrictions</div>
                          <ul className="mt-2 space-y-1 text-sm text-foreground">
                            {msg.result.analysis.restrictions.map((item) => (
                              <li key={item} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {msg.result.intent?.wantsDocuments && (
                        <div className="rounded-xl border border-border bg-background/50 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Required documents</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.result.requiredDocuments?.length ? msg.result.requiredDocuments.map((item) => (
                              <span key={item} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground">{item}</span>
                            )) : <span className="text-sm text-muted-foreground">None listed</span>}
                          </div>
                        </div>
                      )}

                        {msg.result.analysis.next_steps?.length ? (
                          <div className="rounded-xl border border-border bg-background/50 p-3 xl:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recommended next steps</div>
                            <ul className="mt-2 space-y-1 text-sm text-foreground">
                              {msg.result.analysis.next_steps.map((step) => (
                                <li key={step} className="flex gap-2">
                                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {msg.result.intent?.wantsTechnicalTrace && (
                          <div className="rounded-xl border border-border bg-background/50 p-3 xl:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Technical decision timeline</div>
                            <div className="mt-2 space-y-2">
                              {msg.result.decisionSteps?.length ? msg.result.decisionSteps.map((step, index) => (
                                <div key={`${step.phase}-${index}`} className="flex gap-3 rounded-lg border border-border bg-card px-3 py-2">
                                  <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{step.phase}</div>
                                    <div className="text-sm font-medium text-foreground">{step.decision}</div>
                                    <div className="text-xs text-muted-foreground">{step.reason}</div>
                                  </div>
                                </div>
                              )) : <div className="text-sm text-muted-foreground">No decision trace returned.</div>}
                            </div>
                          </div>
                        )}

                        {msg.result.intent?.wantsTechnicalTrace && msg.result.ruleHits?.length ? (
                          <div className="rounded-xl border border-border bg-background/50 p-3 xl:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rule hits</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.result.ruleHits.map((rule) => (
                                <span key={rule} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground">{rule}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {msg.result.intent?.wantsTechnicalTrace && msg.result.extractionNotes?.length ? (
                          <div className="rounded-xl border border-border bg-background/50 p-3 xl:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Extraction notes</div>
                            <ul className="mt-2 space-y-1 text-sm text-foreground">
                              {msg.result.extractionNotes.map((note) => (
                                <li key={note} className="flex gap-2">
                                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                    </div>

                    {/* CTA */}
                    {msg.result.status !== "red" && (
                      <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-card/40">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Info className="h-3 w-3 shrink-0 text-primary" />
                          Continue to step-by-step export planning
                        </div>
                        <button onClick={() => continueToPlan(msg.result!)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:bg-primary/90 transition-base">
                          Plan Export <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {msg.role === "assistant" && msg.type !== "hint" && (
                  <div className="text-[10px] text-muted-foreground px-1">Scan AI · just now</div>
                )}
              </div>
            </div>
          ))}

          {/* Scanning indicator */}
          {scanning && (
            <div className="flex gap-3 justify-start animate-fade-in-up">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-glow mt-1">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analyzing product, classifying HS code…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="sticky bottom-0 pt-2 pb-4 bg-gradient-to-t from-background via-background to-transparent">
          {/* Image preview pill */}
          {preview && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-xs">
              <img src={preview} alt="" className="h-5 w-5 rounded-full object-cover" />
              <span className="text-xs text-foreground truncate max-w-[160px]">{file?.name}</span>
              <button onClick={() => { setFile(null); setPreview(null); }}
                className="text-muted-foreground hover:text-foreground transition-base">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {selectedReply && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Replying</div>
                <div className="truncate">{selectedReply}</div>
              </div>
              <button
                onClick={() => setSelectedReply("")}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-base"
                aria-label="Clear reply"
                title="Clear reply"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />

          {/* Text input */}
          <div className="flex items-end gap-2 rounded-2xl border border-border/80 bg-card/95 px-2 py-2 shadow-soft-sm focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-base">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary-soft hover:text-primary transition-base"
              title="Add product image"
              aria-label="Add product image"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Describe the product and destination country"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-32"
            />
            <div className="flex items-center gap-1.5 pl-1">
              <button
                onClick={handleMicClick}
                disabled={scanning}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-base ${
                  isListening
                    ? "border-primary/40 bg-primary-soft text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground"
                }`}
                title={isListening ? "Stop voice input" : "Start voice input"}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
              >
                {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={scanning || (!file && !query.trim())}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-base"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isListening && (
            <div className="mt-2 flex items-center justify-start px-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] text-primary">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Listening... tap stop when done
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center justify-end px-1">
            <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground transition-base flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Reset
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}