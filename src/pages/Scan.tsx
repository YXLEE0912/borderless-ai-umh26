import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import {
  UploadCloud, Mic, Sparkles, ScanLine, ArrowRight, RefreshCw,
  CheckCircle2, AlertTriangle, Image as ImageIcon, X, Loader2,
  PackageSearch, Globe2, FileText, Tag, Lightbulb, Send,
  ChevronRight, Info
} from "lucide-react";

type MessageRole = "user" | "assistant";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
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
  product: string;
  hsCode: string;
  confidence: "High" | "Medium" | "Low";
  status: "green" | "yellow" | "red" | "invalid";
  insights: { tone: "ok" | "warn" | "bad"; text: string }[];
  rawText: string;
  invalid?: boolean;
  invalidMessage?: string;
};

const QUICK_HINTS: HintChip[] = [
  { icon: Globe2, label: "Restrictions for China?", value: " restrictions for China" },
  { icon: Tag, label: "What's the HS code?", value: " what is the HS code?" },
  { icon: FileText, label: "Required documents?", value: " what documents are required for export?" },
  { icon: PackageSearch, label: "Can this be exported?", value: " can this be exported from Malaysia?" },
];

const EXAMPLE_PROMPTS = [
  "rattan bag to China",
  "wood furniture to US",
  "dried mango to Singapore",
  "electronics to Japan",
  "batik fabric to UK",
  "palm oil to EU",
];

const PRODUCT_HINTS: HintChip[] = [
  { icon: PackageSearch, label: "Rattan bag to China", value: "rattan bag to China" },
  { icon: PackageSearch, label: "Wood furniture to US", value: "wood furniture to US" },
  { icon: PackageSearch, label: "Dried mango to Japan", value: "dried mango to Japan" },
  { icon: PackageSearch, label: "Electronics to Singapore", value: "electronics to Singapore" },
];

const SYSTEM_PROMPT = `You are the "Product Entry Specialist" for Borderless AI.
PERSONALITY:
- Friendly, localized tone (Manglish / mixed English + simple Chinese OK)
- Sound like a helpful Malaysian friend (casual but clear)
- No jargon, no long explanations

---
STEP 1 — VALIDITY CHECK (do this first, strictly):

Mark as INVALID if ANY of these are true:
- Input is ONLY a greeting (hi, hello, hey, yo, wassup, apa khabar, etc.) with NO product mentioned
- Input is random/nonsense text with no identifiable product
- Input has a greeting + question but ZERO product noun (e.g. "hi what is the HS code?" — no product = invalid)

Mark as VALID if:
- A real product is mentioned (e.g. bag, chair, mango, laptop, rattan furniture, dried fruit, electronics)
- Even casual phrasing like "eh can send this?" with an image counts as valid
- Greeting + product is OK: "hi can I export rattan bag to China?" = VALID

If INVALID, return:
{
  "invalid": true,
  "message": "Eh bro, you never tell me what product leh 😅 Try something like: 'rattan bag to China' or 'dried mango to Japan'"
}

---
STEP 2 — If VALID product detected, do ALL of these:

A. IDENTIFY PRODUCT
- Detect product type (bag, chair, food, electronics, etc.)
- Detect material if possible (wood, leather, fabric, metal)

B. IDENTIFY TARGET MARKET
- Extract country from query (China, Singapore, US, Japan, etc.)
- If no country mentioned, assume China as default

C. HS CODE
- Estimate a real 6-digit HS Code based on the product
- Must be a real HS code, not 0000.00

D. FEASIBILITY
Classify into ONE:
✅ Green Light — generally allowed
⚠️ Conditional — allowed with permits/certs/registration
❌ Restricted — prohibited or heavily restricted

E. INSIGHTS — THIS IS THE MOST IMPORTANT PART
- ALWAYS answer the user's specific question in the insights if they asked one
- Plus add any relevant practical blockers (SSM, permits, quarantine, VAT hint)
- Tone: casual Manglish, short sentences, max 5 insight items

---
OUTPUT FORMAT (STRICT JSON only, no markdown, no extra text):

{
  "feasibility": "green" | "yellow" | "red",
  "feasibilityLabel": "✅ Green Light" | "⚠️ Conditional" | "❌ Restricted",
  "product": {
    "name": "Product name",
    "material": "Material"
  },
  "hsCode": "XXXX.XX",
  "confidence": "High" | "Medium" | "Low",
  "insights": [
    { "tone": "ok" | "warn" | "bad", "text": "insight text" }
  ],
  "transition": "transition message"
}

TRANSITION RULE:
- Green or Conditional: "Can move one 👍 Want me to show you step-by-step how to export this? I build roadmap for you."
- Restricted: suggest a brief alternative`;

const parseAIResponse = (text: string): ScanResult => {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed.invalid) {
      return {
        product: "", hsCode: "", confidence: "Medium", status: "invalid",
        insights: [], rawText: "", invalid: true,
        invalidMessage: parsed.message || "Hmm bro, I cannot detect product 😅",
      };
    }
    return {
      product: parsed.product?.name || "Unknown Product",
      hsCode: parsed.hsCode || "0000.00",
      confidence: parsed.confidence || "Medium",
      status: parsed.feasibility || "green",
      insights: parsed.insights || [],
      rawText: parsed.transition || "",
    };
  } catch {
    return {
      product: "Product", hsCode: "0000.00", confidence: "Medium", status: "yellow",
      insights: [{ tone: "warn", text: text.slice(0, 200) }], rawText: "",
    };
  }
};

const genId = () => Math.random().toString(36).slice(2);

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  type: "hint",
  content: "Hey! 👋 I'm your AI export scanner. Tell me what product you want to export — I'll check HS codes, trade rules, and feasibility for you.\n\nTry one of these examples:",
  hints: PRODUCT_HINTS,
};

export default function Scan() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, scanning]);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    // Add image preview message
    setMessages(prev => [...prev, {
      id: genId(), role: "user", type: "image",
      content: f.name, imagePreview: url,
    }, {
      id: genId(), role: "assistant", type: "hint",
      content: "Nice, got your product image! 📸 Now tell me where you want to export it — or just hit scan and I'll analyse it.",
      hints: PRODUCT_HINTS.slice(0, 2).map(h => ({ ...h, label: `Send to ${h.value.split(' to ')[1] || 'China'}`, value: h.value })),
    }]);
  };

  const toBase64 = (f: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(f);
    });

  const sendMessage = async (overrideQuery?: string) => {
    const activeQuery = overrideQuery ?? query.trim();
    if (!activeQuery && !file) return;

    const userMsg: Message = {
      id: genId(), role: "user", type: "text",
      content: activeQuery || "Please analyse this product image.",
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setScanning(true);

    try {
      const content: object[] = [];
      if (file) {
        const base64 = await toBase64(file);
        const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
      }
      content.push({ type: "text", text: activeQuery || "Can this product be exported? Please analyse." });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
        }),
      });

      const data = await response.json();
      const text = data.content?.map((b: { type: string; text?: string }) => b.text || "").join("") || "";
      const parsed = parseAIResponse(text);
      setLastResult(parsed);

      if (parsed.invalid) {
        setMessages(prev => [...prev, {
          id: genId(), role: "assistant", type: "hint",
          content: parsed.invalidMessage || "Hmm, I need a product name to scan! 😅",
          hints: PRODUCT_HINTS,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: genId(), role: "assistant", type: "result",
          content: "", result: parsed,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: genId(), role: "assistant", type: "text",
        content: "Alamak something went wrong 😅 Cuba lagi!",
      }]);
    } finally {
      setScanning(false);
      setFile(null);
      setPreview(null);
    }
  };

  const handleHint = (value: string) => {
    setQuery(value);
    sendMessage(value);
  };

  const handleFollowUp = (append: string) => {
    if (lastResult) {
      const q = lastResult.product + append;
      sendMessage(q);
    }
  };

  const reset = () => {
    setMessages([WELCOME_MESSAGE]);
    setFile(null);
    setPreview(null);
    setQuery("");
    setLastResult(null);
  };

  const continueToPlan = (result: ScanResult) => {
    navigate("/assistant", {
      state: { from: "scan", product: result.product, hsCode: result.hsCode, confidence: result.confidence },
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
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm"
                  }`}>
                    {msg.content}
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
                    <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${
                      msg.result.status === "green" ? "bg-success-soft/40" :
                      msg.result.status === "yellow" ? "bg-warning-soft/40" : "bg-[hsl(var(--error-soft))]"
                    }`}>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scan Result</div>
                        <div className="text-base font-semibold text-foreground mt-0.5">{msg.result.product}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                            HS {msg.result.hsCode}
                          </span>
                          <span className="rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                            {msg.result.confidence} confidence
                          </span>
                        </div>
                      </div>
                      {msg.result.status === "green" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
                          <CheckCircle2 className="h-3 w-3" /> Green Light
                        </span>
                      )}
                      {msg.result.status === "yellow" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                          <AlertTriangle className="h-3 w-3" /> Conditional
                        </span>
                      )}
                      {msg.result.status === "red" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--error-soft))] px-2.5 py-1 text-[11px] font-semibold text-destructive">
                          <X className="h-3 w-3" /> Restricted
                        </span>
                      )}
                    </div>

                    {/* Insights */}
                    <div className="px-4 py-3 space-y-2">
                      {msg.result.insights.map((ins, i) => (
                        <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] ${
                          ins.tone === "ok" ? "border-success/20 bg-success-soft/60 text-foreground" :
                          ins.tone === "warn" ? "border-warning/30 bg-warning-soft/60 text-foreground" :
                          "border-destructive/20 bg-[hsl(var(--error-soft))] text-foreground"
                        }`}>
                          {ins.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> :
                           ins.tone === "warn" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> :
                           <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                          <span className="leading-relaxed">{ins.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* Transition + follow-up chips */}
                    {msg.result.rawText && (
                      <div className="px-4 pb-3">
                        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary-soft/40 px-3 py-2.5 text-[13px] text-foreground">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{msg.result.rawText}</span>
                        </div>
                      </div>
                    )}

                    {/* Follow-up chips */}
                    <div className="px-4 pb-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ask more</div>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_HINTS.map((h) => {
                          const Icon = h.icon;
                          return (
                            <button key={h.label} onClick={() => handleFollowUp(h.value)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary transition-base">
                              <Icon className="h-3 w-3" />{h.label}
                            </button>
                          );
                        })}
                      </div>
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

          {/* Drag & drop zone (compact) */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={`mb-2 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-xs text-muted-foreground cursor-pointer transition-base ${
              dragOver ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40 hover:bg-card/60"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <UploadCloud className="h-4 w-4" />
            <span>Drop product photo here or <span className="font-medium text-primary">browse</span></span>
          </div>

          {/* Text input */}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-base">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="e.g. rattan bag to China, dried mango to Japan…"
              rows={1}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-32"
            />
            <div className="flex items-center gap-1">
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-base">
                <Mic className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={scanning || (!file && !query.trim())}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 disabled:opacity-50 transition-base"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_HINTS.slice(0, 3).map((h) => {
                const Icon = h.icon;
                return (
                  <button key={h.label} onClick={() => handleFollowUp(h.value)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary transition-base">
                    <Icon className="h-3 w-3" />{h.label}
                  </button>
                );
              })}
            </div>
            <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground transition-base flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Reset
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}