import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Info,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";

type N = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "success" | "warning" | "info";
  read: boolean;
  link?: string;
};

const seed: N[] = [
  {
    id: "n1",
    title: "Shipment SH-2451 cleared customs",
    description: "Rattan handbags · Port Klang → Shanghai",
    time: "2 min ago",
    type: "success",
    read: false,
    link: "/logistics",
  },
  {
    id: "n2",
    title: "Permit expiring soon",
    description: "MITI export permit expires in 7 days. Renew to avoid delays.",
    time: "1 hour ago",
    type: "warning",
    read: false,
    link: "/assistant",
  },
  {
    id: "n3",
    title: "New tariff update for China",
    description: "HS 4602.19 duty reduced to 0% under ACFTA",
    time: "Yesterday",
    type: "info",
    read: true,
    link: "/scan",
  },
  {
    id: "n4",
    title: "Invoice INV-2451 paid",
    description: "Your Pro subscription renewed for $49.00",
    time: "3 days ago",
    type: "success",
    read: true,
    link: "/billing",
  },
  {
    id: "n5",
    title: "Document required: Certificate of Origin",
    description: "Required for shipment SH-2455 to Singapore",
    time: "4 days ago",
    type: "warning",
    read: true,
    link: "/logistics",
  },
];

const filters = ["All", "Unread", "Success", "Warning", "Info"] as const;
type Filter = (typeof filters)[number];

const Notifications = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<N[]>(seed);
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    switch (filter) {
      case "Unread":
        return items.filter((i) => !i.read);
      case "Success":
        return items.filter((i) => i.type === "success");
      case "Warning":
        return items.filter((i) => i.type === "warning");
      case "Info":
        return items.filter((i) => i.type === "info");
      default:
        return items;
    }
  }, [items, filter]);

  const unread = items.filter((i) => !i.read).length;

  const markAll = () => {
    setItems((p) => p.map((i) => ({ ...i, read: true })));
    toast.success("All notifications marked as read");
  };

  const clearAll = () => {
    setItems([]);
    toast("Inbox cleared");
  };

  const open = (n: N) => {
    setItems((p) => p.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    if (n.link) navigate(n.link);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[1000px] px-6 py-10 lg:px-10">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-base"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              {unread > 0 ? `${unread} unread updates` : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAll}
              disabled={unread === 0}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-base"
            >
              Mark all read
            </button>
            <button
              onClick={clearAll}
              disabled={items.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50 transition-base"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-base ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-soft-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground">
                Try a different filter or come back later.
              </p>
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`w-full text-left flex gap-4 border-b border-border/60 px-5 py-4 hover:bg-secondary/50 transition-base ${
                  !n.read ? "bg-primary/[0.03]" : ""
                }`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    n.type === "success"
                      ? "bg-success/10 text-success"
                      : n.type === "warning"
                      ? "bg-warning/10 text-warning"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {n.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : n.type === "warning" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
                </div>
                {!n.read && (
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Notifications;
