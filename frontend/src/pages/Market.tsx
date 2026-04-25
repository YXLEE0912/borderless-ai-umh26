import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Globe2,
  Scale,
  Ship,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";

type MarketInfo = {
  name: string;
  flag: string;
  agreement: string;
  capital: string;
  currency: string;
  avgDuty: string;
  vat: string;
  topImports: string[];
  requiredDocs: string[];
  highlights: { label: string; value: string; tone?: "success" }[];
};

const markets: Record<string, MarketInfo> = {
  china: {
    name: "China",
    flag: "🇨🇳",
    agreement: "ACFTA",
    capital: "Beijing",
    currency: "CNY",
    avgDuty: "0–10%",
    vat: "13%",
    topImports: ["Electronics", "Palm oil", "Rubber", "Handicrafts"],
    requiredDocs: [
      "Commercial Invoice",
      "Packing List",
      "Form E (ACFTA Certificate of Origin)",
      "Bill of Lading",
    ],
    highlights: [
      { label: "Duty under ACFTA", value: "0% (most goods)", tone: "success" },
      { label: "Avg transit Port Klang → Shanghai", value: "10 days" },
      { label: "Customs clearance", value: "1–2 days" },
    ],
  },
  singapore: {
    name: "Singapore",
    flag: "🇸🇬",
    agreement: "ATIGA",
    capital: "Singapore",
    currency: "SGD",
    avgDuty: "0%",
    vat: "9% GST",
    topImports: ["Machinery", "Food products", "Pharmaceuticals", "Textiles"],
    requiredDocs: [
      "Commercial Invoice",
      "Packing List",
      "Form D (ATIGA Certificate of Origin)",
    ],
    highlights: [
      { label: "Duty under ATIGA", value: "0%", tone: "success" },
      { label: "Avg transit Port Klang → PSA", value: "1–2 days" },
      { label: "Customs clearance", value: "Same day" },
    ],
  },
  eu: {
    name: "European Union",
    flag: "🇪🇺",
    agreement: "GSP",
    capital: "Brussels",
    currency: "EUR",
    avgDuty: "2–12%",
    vat: "19–25%",
    topImports: ["Palm oil", "Electronics", "Rubber goods", "Apparel"],
    requiredDocs: [
      "Commercial Invoice",
      "Packing List",
      "Form A (GSP)",
      "EUR.1 Movement Certificate",
      "REX registration",
    ],
    highlights: [
      { label: "GSP preference", value: "Available for SMEs", tone: "success" },
      { label: "Avg transit Port Klang → Rotterdam", value: "28 days" },
      { label: "Customs clearance", value: "2–4 days" },
    ],
  },
};

const Market = () => {
  const { slug = "china" } = useParams();
  const navigate = useNavigate();
  const m = markets[slug] ?? markets.china;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-6 py-10 lg:px-10">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-base"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-3xl">
              {m.flag}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">{m.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  <Globe2 className="h-3 w-3" /> {m.agreement}
                </span>
                <span>· {m.capital}</span>
                <span>· {m.currency}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/scan")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90 transition-base"
          >
            Scan a product for {m.name}
          </button>
        </div>

        {/* Highlights */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {m.highlights.map((h) => (
            <div key={h.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{h.label}</p>
              <p
                className={`mt-2 text-lg font-semibold ${
                  h.tone === "success" ? "text-success" : "text-foreground"
                }`}
              >
                {h.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Tariffs & Tax</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Average duty" value={m.avgDuty} />
              <Stat label="VAT / GST" value={m.vat} />
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
              <TrendingDown className="mt-0.5 h-4 w-4 text-success" />
              <p className="text-xs text-foreground">
                Most Malaysian exports qualify for {m.agreement} preferential rates — typically saving 5–12% in duties.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Required documents</h2>
            </div>
            <ul className="mt-4 space-y-2">
              {m.requiredDocs.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {d}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm lg:col-span-2">
            <div className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Top imported categories</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {m.topImports.map((t) => (
                <button
                  key={t}
                  onClick={() => toast(`Filter shipments by ${t}`)}
                  className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-background transition-base"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
  </div>
);

export default Market;
