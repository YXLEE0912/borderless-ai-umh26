import { useEffect, useState } from "react";
import {
  Bell,
  Globe2,
  Search,
  ChevronDown,
  ScanLine,
  Sparkles,
  Truck,
  LayoutDashboard,
  Package,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info,
  User,
  Settings,
  CreditCard,
  LifeBuoy,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Scan", to: "/scan" },
  { label: "Assistant", to: "/assistant" },
  { label: "Logistics", to: "/logistics" },
];

type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "success" | "warning" | "info";
  read: boolean;
};

const initialNotifications: Notification[] = [
  {
    id: "n1",
    title: "Shipment SH-2451 cleared customs",
    description: "Rattan handbags · Port Klang → Shanghai",
    time: "2m ago",
    type: "success",
    read: false,
  },
  {
    id: "n2",
    title: "Permit expiring soon",
    description: "MITI export permit expires in 7 days",
    time: "1h ago",
    type: "warning",
    read: false,
  },
  {
    id: "n3",
    title: "New tariff update for China",
    description: "HS 4602.19 duty reduced to 0% under ACFTA",
    time: "Yesterday",
    type: "info",
    read: true,
  },
];

const TopNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const { theme, toggleTheme: toggleThemeCtx } = useTheme();

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };


  const toggleTheme = () => {
    toggleThemeCtx();
    const next = theme === "light" ? "dark" : "light";
    toast(`Switched to ${next} mode`);
  };

  const handleSignOut = () => {
    toast.success("Signed out successfully");
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                <Globe2 className="h-5 w-5 text-primary-foreground" strokeWidth={2.25} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold tracking-tight text-foreground">
                  Borderless<span className="text-primary"> AI</span>
                </span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Trade Platform
                </span>
              </div>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-base ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-[17px] h-[2px] rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="relative hidden lg:flex h-9 w-72 items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 text-sm text-muted-foreground hover:bg-background hover:border-primary/50 hover:text-foreground transition-base"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search products, HS codes, markets…</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>

            <button
              onClick={() => setOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-base lg:hidden"
              aria-label="Search"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-base"
                  aria-label="Notifications"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-2 ring-background">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[360px] p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                      <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-medium text-foreground">No notifications</p>
                      <p className="text-xs text-muted-foreground">
                        We'll let you know when something arrives.
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
                          );
                          navigate("/notifications");
                        }}
                        className={`w-full text-left flex gap-3 px-4 py-3 border-b border-border/60 hover:bg-secondary/60 transition-base ${
                          !n.read ? "bg-primary/[0.03]" : ""
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
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
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground line-clamp-1">
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {n.description}
                          </p>
                          <p className="text-[11px] text-muted-foreground/80 mt-1">{n.time}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-border p-2">
                  <button
                    onClick={() => navigate("/notifications")}
                    className="w-full rounded-md py-2 text-xs font-medium text-primary hover:bg-secondary transition-base"
                  >
                    View all notifications
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-2 flex items-center gap-2.5 rounded-xl border border-border bg-card px-2 py-1 pr-3 shadow-xs hover:bg-secondary/50 transition-base">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-xs font-semibold text-primary-foreground">
                    AR
                  </div>
                  <div className="hidden flex-col leading-tight md:flex items-start">
                    <span className="text-[13px] font-medium text-foreground">Aiman R.</span>
                    <span className="text-[11px] text-muted-foreground">Pro · KL</span>
                  </div>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-sm font-semibold text-primary-foreground">
                    AR
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">Aiman Rashid</p>
                    <p className="text-xs text-muted-foreground truncate">aiman@borderless.ai</p>
                  </div>
                </div>
                <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-gradient-primary/10 border border-primary/20 px-2.5 py-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-medium text-foreground">Pro Plan</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">Kuala Lumpur</span>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/billing")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                    <span className="ml-auto text-[10px] font-medium text-success">Active</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                    <DropdownMenuShortcutInline>⌘,</DropdownMenuShortcutInline>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "light" ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/support")}>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  <span>Support</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Command Palette */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, products, HS codes, markets…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/scan"))}>
              <ScanLine className="mr-2 h-4 w-4" />
              <span>Scan Product</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/assistant"))}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>AI Assistant</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/logistics"))}>
              <Truck className="mr-2 h-4 w-4" />
              <span>Logistics & Tax</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Products">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate("/assistant", {
                    state: { from: "scan", product: "Rattan Handbag", hsCode: "4602.19" },
                  });
                })
              }
            >
              <Package className="mr-2 h-4 w-4" />
              <span>Rattan Handbag</span>
              <CommandShortcut>HS 4602.19</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate("/assistant", {
                    state: { from: "scan", product: "Palm Oil (Refined)", hsCode: "1511.90" },
                  });
                })
              }
            >
              <Package className="mr-2 h-4 w-4" />
              <span>Palm Oil (Refined)</span>
              <CommandShortcut>HS 1511.90</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate("/assistant", {
                    state: { from: "scan", product: "Coffee Beans", hsCode: "0901.21" },
                  });
                })
              }
            >
              <Package className="mr-2 h-4 w-4" />
              <span>Coffee Beans</span>
              <CommandShortcut>HS 0901.21</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Markets">
            <CommandItem onSelect={() => runCommand(() => navigate("/markets/china"))}>
              <Globe2 className="mr-2 h-4 w-4" />
              <span>China · ACFTA</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/markets/singapore"))}>
              <Globe2 className="mr-2 h-4 w-4" />
              <span>Singapore · ATIGA</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/markets/eu"))}>
              <Globe2 className="mr-2 h-4 w-4" />
              <span>European Union</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Documents">
            <CommandItem onSelect={() => runCommand(() => navigate("/logistics"))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Commercial Invoice</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/logistics"))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Certificate of Origin</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem onSelect={() => runCommand(toggleTheme)}>
              {theme === "light" ? (
                <Moon className="mr-2 h-4 w-4" />
              ) : (
                <Sun className="mr-2 h-4 w-4" />
              )}
              <span>Toggle {theme === "light" ? "dark" : "light"} mode</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/profile"))}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/billing"))}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Billing</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/notifications"))}>
              <Bell className="mr-2 h-4 w-4" />
              <span>Notifications</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/support"))}>
              <LifeBuoy className="mr-2 h-4 w-4" />
              <span>Support</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(handleSignOut)}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

const DropdownMenuShortcutInline = ({ children }: { children: React.ReactNode }) => (
  <span className="ml-auto text-[10px] tracking-widest text-muted-foreground">{children}</span>
);

export default TopNav;
