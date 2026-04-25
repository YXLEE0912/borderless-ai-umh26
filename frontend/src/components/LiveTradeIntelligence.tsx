import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertCircle, Activity } from "lucide-react";

const feed = [
  {
    type: "alert",
    title: "Suez Canal congestion easing",
    summary: "Wait times reduced to 12 hours from 36 hours.",
    time: "2m ago",
    icon: AlertCircle,
  },
  {
    type: "up",
    title: "Container rates up 4.2%",
    summary: "Asia–Europe lanes seeing renewed pressure.",
    time: "14m ago",
    icon: TrendingUp,
  },
  {
    type: "down",
    title: "Crude oil dips 1.8%",
    summary: "Brent settles at $82.40 amid demand concerns.",
    time: "32m ago",
    icon: TrendingDown,
  },
  {
    type: "alert",
    title: "Port of LA strike vote scheduled",
    summary: "ILWU members to vote next Tuesday.",
    time: "1h ago",
    icon: AlertCircle,
  },
  {
    type: "up",
    title: "Lithium futures climb 3.1%",
    summary: "EV demand outlook revised upward for Q3.",
    time: "2h ago",
    icon: TrendingUp,
  },
  {
    type: "down",
    title: "Wheat exports slow",
    summary: "Black Sea shipments down 12% week-over-week.",
    time: "3h ago",
    icon: TrendingDown,
  },
  {
    type: "alert",
    title: "New EU tariff framework released",
    summary: "Steel imports face revised duty structure.",
    time: "4h ago",
    icon: AlertCircle,
  },
  {
    type: "up",
    title: "Air freight capacity expands",
    summary: "Trans-Pacific routes add 8% capacity.",
    time: "5h ago",
    icon: TrendingUp,
  },
];

export function LiveTradeIntelligence() {
  return (
    <aside className="flex h-full flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Live Trade Intelligence</h2>
            <p className="text-xs text-muted-foreground">AI-powered insights for real-time compliance, trade growth, and policy alignment</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live
        </Badge>
      </header>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ul className="flex flex-col gap-2">
          {feed.map((item, i) => {
            const Icon = item.icon;
            return (
              <li key={i}>
                <div className="rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        item.type === "up"
                          ? "bg-primary/10 text-primary"
                          : item.type === "down"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <p className="text-sm font-medium leading-tight text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.summary}</p>
                      <span className="mt-1 text-[11px] text-muted-foreground">{item.time}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}