import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  LifeBuoy,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";

const faqs = [
  {
    q: "How accurate is the AI HS code classification?",
    a: "Our AI matches your product against 17,000+ HS codes with confidence scoring. For Medium or Low confidence results, we recommend confirming with a customs broker before shipping.",
  },
  {
    q: "Which countries does Borderless AI support?",
    a: "We currently support 38 destination markets, with deep integrations for ASEAN, China, EU, US, UK and Australia.",
  },
  {
    q: "Can I cancel my Pro subscription anytime?",
    a: "Yes — cancel from Billing at any time. You'll keep Pro access until the end of the current billing cycle.",
  },
  {
    q: "Are my trade documents stored securely?",
    a: "All documents are encrypted at rest with AES-256 and in transit with TLS 1.3. We never share your data with third parties.",
  },
];

const Support = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(0);
  const [form, setForm] = useState({ subject: "", message: "" });

  const send = () => {
    if (!form.subject || !form.message) {
      toast.error("Please fill in both fields");
      return;
    }
    setForm({ subject: "", message: "" });
    toast.success("Message sent. We'll reply within 4 hours.");
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[1100px] px-6 py-10 lg:px-10">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-base"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground">
            Get help from our trade specialists or browse the knowledge base.
          </p>
        </div>

        {/* Quick channels */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Channel
            icon={<MessageSquare className="h-5 w-5" />}
            title="Live chat"
            sub="Avg reply 2 min"
            onClick={() => toast("Opening live chat…")}
          />
          <Channel
            icon={<Mail className="h-5 w-5" />}
            title="Email us"
            sub="support@borderless.ai"
            onClick={() => toast("Opening mail client…")}
          />
          <Channel
            icon={<BookOpen className="h-5 w-5" />}
            title="Knowledge base"
            sub="120+ articles"
            onClick={() => toast("Opening knowledge base…")}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* FAQ */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <h2 className="text-base font-semibold text-foreground">Frequently asked</h2>
            <div className="mt-4 divide-y divide-border/70">
              {faqs.map((f, i) => (
                <div key={f.q} className="py-3">
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <span className="text-sm font-medium text-foreground">{f.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        open === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {open === i && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Send us a message</h2>
            </div>
            <p className="text-xs text-muted-foreground">Pro plan — replies within 4 hours.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Issue with permit upload"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-base"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Message</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5}
                  placeholder="Describe your issue…"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-base"
                />
              </div>
              <button
                onClick={send}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90 transition-base"
              >
                <Send className="h-4 w-4" /> Send message
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Channel = ({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="group rounded-2xl border border-border bg-card p-5 text-left shadow-soft-sm hover:border-primary/50 hover:shadow-soft-md transition-base"
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
      {icon}
    </div>
    <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground">{sub}</p>
  </button>
);

export default Support;
