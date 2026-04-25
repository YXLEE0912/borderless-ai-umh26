import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";

const invoices = [
  { id: "INV-2451", date: "Apr 1, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2387", date: "Mar 1, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2301", date: "Feb 1, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2244", date: "Jan 1, 2026", amount: "$49.00", status: "Paid" },
];

const plans = [
  {
    name: "Starter",
    price: "$0",
    desc: "For occasional shippers exploring global trade.",
    features: ["5 product scans / mo", "Basic HS code lookup", "Email support"],
    cta: "Downgrade",
  },
  {
    name: "Pro",
    price: "$49",
    desc: "For active SMEs shipping cross-border every week.",
    features: [
      "Unlimited scans",
      "AI compliance assistant",
      "Tariff & duty optimizer",
      "Priority support",
    ],
    cta: "Current plan",
    current: true,
  },
  {
    name: "Business",
    price: "$199",
    desc: "For trading houses and high-volume exporters.",
    features: ["Everything in Pro", "Team seats (10)", "API access", "Dedicated manager"],
    cta: "Upgrade",
  },
];

const Billing = () => {
  const navigate = useNavigate();
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
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage your subscription, payment method and invoices.
          </p>
        </div>

        {/* Current plan summary */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> Pro Plan
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">$49 / month</h2>
                <p className="text-sm text-muted-foreground">Renews on May 1, 2026</p>
              </div>
              <button
                onClick={() => toast("Plan change coming soon")}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-base"
              >
                Change plan
              </button>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <Stat label="Scans used" value="124" sub="of unlimited" />
              <Stat label="Active shipments" value="8" sub="this month" />
              <Stat label="Saved in duties" value="$1,248" sub="YTD" tone="success" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
              <button
                onClick={() => toast("Update payment method")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Update
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex h-10 w-14 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
                VISA
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">•••• 4242</p>
                <p className="text-xs text-muted-foreground">Expires 09/28</p>
              </div>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Next charge $49.00 on May 1, 2026
            </p>
          </div>
        </div>

        {/* Plans */}
        <h3 className="mt-10 text-base font-semibold text-foreground">Plans</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-6 transition-base ${
                p.current
                  ? "border-primary/60 bg-primary/[0.03] shadow-glow"
                  : "border-border bg-card shadow-soft-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{p.name}</p>
                {p.current && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {p.price}
                <span className="text-sm font-normal text-muted-foreground"> / mo</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                    <Check className="h-3.5 w-3.5 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={p.current}
                onClick={() => toast(`${p.cta} ${p.name}`)}
                className={`mt-5 w-full rounded-lg px-4 py-2 text-sm font-medium transition-base ${
                  p.current
                    ? "bg-secondary text-muted-foreground cursor-default"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Invoices */}
        <h3 className="mt-10 text-base font-semibold text-foreground">Invoices</h3>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-soft-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border/60">
                  <td className="px-5 py-3 font-medium text-foreground">{inv.id}</td>
                  <td className="px-5 py-3 text-muted-foreground">{inv.date}</td>
                  <td className="px-5 py-3 text-foreground">{inv.amount}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      <Check className="h-3 w-3" /> {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => toast(`Downloading ${inv.id}.pdf`)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

const Stat = ({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "success";
}) => (
  <div className="rounded-xl border border-border bg-secondary/30 px-3 py-4">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`mt-1 text-xl font-semibold ${tone === "success" ? "text-success" : "text-foreground"}`}>
      {value}
    </p>
    <p className="text-[11px] text-muted-foreground">{sub}</p>
  </div>
);

export default Billing;
