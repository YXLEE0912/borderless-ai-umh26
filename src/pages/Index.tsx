import TopNav from "@/components/TopNav";
import { Link } from "react-router-dom";
import {
  ScanLine, Map, Calculator, ArrowRight, Sparkles, TrendingUp,
  CheckCircle2, Clock, Globe, Truck, ShieldCheck
} from "lucide-react";

type ModuleCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  cta: string;
  to: string;
  accent: "primary" | "accent" | "violet";
  meta: string;
  step: string;
};

const modules: ModuleCard[] = [
  {
    id: "scan",
    title: "Product Scanner",
    description: "Check if your product can be exported.",
    icon: ScanLine,
    cta: "Start Scan",
    to: "/scan",
    accent: "primary",
    meta: "AI Vision · HS Code",
    step: "Step 01",
  },
  {
    id: "plan",
    title: "Compliance Architect",
    description: "Get step-by-step compliance guidance.",
    icon: Map,
    cta: "Start Planning",
    to: "/assistant",
    accent: "violet",
    meta: "Guided Workflow",
    step: "Step 02",
  },
  {
    id: "ship",
    title: "Logistics & Tax Executor",
    description: "Upload documents and get final cost.",
    icon: Calculator,
    cta: "Start Execution",
    to: "/logistics",
    accent: "accent",
    meta: "Landed Cost · Booking",
    step: "Step 03",
  },
];

const accentClasses = {
  primary: {
    iconBg: "bg-[hsl(221,83%,96%)] text-[hsl(221,83%,53%)]",
    glow: "from-primary/20 via-primary/5 to-transparent",
    button: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow",
    chip: "bg-[hsl(221,83%,96%)] text-[hsl(221,83%,53%)]",
    ring: "group-hover:ring-primary/20",
  },
  accent: {
    iconBg: "bg-[hsl(152,76%,95%)] text-[hsl(160,84%,39%)]",
    glow: "from-accent/20 via-accent/5 to-transparent",
    button: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-accent-glow",
    chip: "bg-[hsl(152,76%,95%)] text-[hsl(160,84%,39%)]",
    ring: "group-hover:ring-accent/20",
  },
  violet: {
    iconBg: "bg-[hsl(258,90%,96%)] text-[hsl(258,90%,55%)]",
    glow: "from-[hsl(258,90%,55%)]/20 via-[hsl(258,90%,55%)]/5 to-transparent",
    button: "bg-[hsl(258,90%,55%)] text-white hover:bg-[hsl(258,90%,50%)] shadow-[0_8px_32px_-8px_hsl(258_90%_55%_/_0.4)]",
    chip: "bg-[hsl(258,90%,96%)] text-[hsl(258,90%,55%)]",
    ring: "group-hover:ring-[hsl(258,90%,55%)]/20",
  },
} as const;

const Index = () => {
  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10 lg:py-14">
        {/* Hero */}
        <section className="mb-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl animate-fade-in-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">AI co-pilot for cross-border trade</span>
              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">LIVE</span>
            </div>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground lg:text-[44px]">
              Welcome back, Aiman.
            </h1>
            <p className="mt-3 text-base text-muted-foreground lg:text-[17px]">
              Turn global trade into a simple, guided process.
            </p>
          </div>
        </section>

        {/* Module cards */}
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Start a new workflow</h2>
              <p className="mt-1 text-sm text-muted-foreground">Three guided modules, one continuous export journey.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {modules.map((m, i) => {
              const a = accentClasses[m.accent];
              const Icon = m.icon;
              return (
                <Link
                  to={m.to}
                  key={m.id}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-7 shadow-soft-sm ring-1 ring-transparent transition-smooth hover:-translate-y-1 hover:shadow-soft-xl animate-fade-in-up"
                  style={{ animationDelay: `${200 + i * 100}ms` }}
                >
                  {/* glow */}
                  <div className={`pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br ${a.glow} blur-2xl transition-smooth group-hover:scale-110`} />

                  <div className="relative flex items-start justify-between">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${a.iconBg} ring-8 ring-transparent transition-base ${a.ring}`}>
                      <Icon className="h-7 w-7" strokeWidth={2} />
                    </div>
                  </div>

                  <div className="relative mt-7">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {m.meta}
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      {m.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                      {m.description}
                    </p>
                  </div>

                  <div className="relative mt-8 flex items-center justify-between">
                    <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-smooth ${a.button}`}>
                      {m.cta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Ready
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Recent activity */}
        <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Recent shipments</h3>
              <button className="text-xs font-medium text-primary hover:underline">View all</button>
            </div>
            <div className="mt-5 divide-y divide-border">
              {[
                { product: "Sambal Nyonya 200g", dest: "🇸🇬 Singapore", status: "Cleared", color: "success" },
                { product: "Rattan Side Table", dest: "🇦🇺 Australia", status: "In transit", color: "warning" },
                { product: "Batik Silk Scarves", dest: "🇯🇵 Japan", status: "Pre-clearance", color: "primary" },
              ].map((row) => (
                <div key={row.product} className="flex items-center justify-between py-3.5">
                  <div>
                    <div className="text-sm font-medium text-foreground">{row.product}</div>
                    <div className="text-xs text-muted-foreground">{row.dest} · ETA 4 days</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.color === "success" ? "bg-success-soft text-success" :
                      row.color === "warning" ? "bg-warning-soft text-warning" :
                        "bg-primary-soft text-primary"
                    }`}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </section>
      </main>
    </div>
  );
};

export default Index;
