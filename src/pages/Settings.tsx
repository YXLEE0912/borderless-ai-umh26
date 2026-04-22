import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Globe2, Lock, Moon, Shield, Sun } from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";

const Settings = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [twoFA, setTwoFA] = useState(true);
  const [language, setLanguage] = useState("English");
  const [currency, setCurrency] = useState("MYR");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

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
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Personalize your workspace, notifications and security.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {/* Appearance */}
          <Section
            icon={theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            title="Appearance"
            description="Switch between light and dark themes."
          >
            <div className="grid grid-cols-2 gap-3">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`rounded-xl border p-4 text-left transition-base ${
                    theme === t
                      ? "border-primary/60 bg-primary/[0.04] shadow-glow"
                      : "border-border bg-background hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize text-foreground">{t} mode</span>
                    {theme === t && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div
                    className={`mt-3 h-16 rounded-md border border-border ${
                      t === "light" ? "bg-white" : "bg-zinc-900"
                    }`}
                  />
                </button>
              ))}
            </div>
          </Section>

          {/* Notifications */}
          <Section
            icon={<Bell className="h-4 w-4" />}
            title="Notifications"
            description="Choose what alerts you want to receive."
          >
            <Toggle
              label="Email alerts"
              description="Shipment status, permit expiries and tariff changes"
              checked={emailAlerts}
              onChange={setEmailAlerts}
            />
            <Toggle
              label="Push notifications"
              description="In-app alerts for real-time activity"
              checked={pushAlerts}
              onChange={setPushAlerts}
            />
            <Toggle
              label="Weekly digest"
              description="Summary of your trade activity every Monday"
              checked={weeklyDigest}
              onChange={setWeeklyDigest}
            />
          </Section>

          {/* Region */}
          <Section
            icon={<Globe2 className="h-4 w-4" />}
            title="Region & Language"
            description="Used for tariffs, currency conversions and document language."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Language"
                value={language}
                onChange={setLanguage}
                options={["English", "Bahasa Malaysia", "中文 (简体)", "العربية"]}
              />
              <Select
                label="Currency"
                value={currency}
                onChange={setCurrency}
                options={["MYR", "USD", "SGD", "CNY", "EUR"]}
              />
            </div>
          </Section>

          {/* Security */}
          <Section
            icon={<Shield className="h-4 w-4" />}
            title="Security"
            description="Protect your account and trade documents."
          >
            <Toggle
              label="Two-factor authentication"
              description="Required for new device logins"
              checked={twoFA}
              onChange={setTwoFA}
            />
            <button
              onClick={() => toast("Password reset email sent")}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-base"
            >
              <Lock className="h-4 w-4" /> Change password
            </button>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={() => toast.success("Settings saved")}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90 transition-base"
            >
              Save settings
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const Section = ({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="mt-5 space-y-3">{children}</div>
  </div>
);

const Toggle = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background px-4 py-3">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-base ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-all ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  </div>
);

const Select = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-base"
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  </div>
);

export default Settings;
