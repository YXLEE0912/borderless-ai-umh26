import { Bell, Globe2, Search, ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Scan", to: "/scan" },
  { label: "Assistant", to: "/assistant" },
  { label: "Logistics", to: "/logistics" },
];

const TopNav = () => {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Globe2 className="h-5 w-5 text-primary-foreground" strokeWidth={2.25} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight text-foreground">Borderless<span className="text-primary"> AI</span></span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Trade Platform</span>
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
          <div className="relative hidden lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products, HS codes, markets…"
              className="h-9 w-72 rounded-lg border border-border bg-secondary/50 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 transition-base"
            />
          </div>
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-base">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          </button>
          <div className="ml-2 flex items-center gap-2.5 rounded-xl border border-border bg-card px-2 py-1 pr-3 shadow-xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-xs font-semibold text-primary-foreground">
              AR
            </div>
            <div className="hidden flex-col leading-tight md:flex">
              <span className="text-[13px] font-medium text-foreground">Aiman R.</span>
              <span className="text-[11px] text-muted-foreground">Pro · KL</span>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
