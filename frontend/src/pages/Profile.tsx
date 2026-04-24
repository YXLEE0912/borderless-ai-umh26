import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Building2, Phone, Globe2, Camera, Save } from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";

const Profile = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "Aiman Rashid",
    email: "aiman@borderless.ai",
    company: "Rashid Trading Sdn Bhd",
    phone: "+60 12-345 6789",
    country: "Malaysia",
    city: "Kuala Lumpur",
    website: "rashidtrading.com",
    bio: "Cross-border trade specialist focused on ASEAN-China lanes.",
  });

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () => toast.success("Profile updated");

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
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal information and trade identity.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Avatar card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-2xl font-semibold text-primary-foreground shadow-glow">
                  AR
                </div>
                <button
                  onClick={() => toast("Photo upload coming soon")}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-soft-sm hover:bg-secondary transition-base"
                >
                  <Camera className="h-3.5 w-3.5 text-foreground" />
                </button>
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">{form.name}</p>
              <p className="text-xs text-muted-foreground">{form.email}</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Verified trader
              </span>
            </div>
            <div className="mt-6 space-y-2.5 text-xs">
              <Row icon={<Mail className="h-3.5 w-3.5" />} text={form.email} />
              <Row icon={<MapPin className="h-3.5 w-3.5" />} text={`${form.city}, ${form.country}`} />
              <Row icon={<Building2 className="h-3.5 w-3.5" />} text={form.company} />
              <Row icon={<Phone className="h-3.5 w-3.5" />} text={form.phone} />
              <Row icon={<Globe2 className="h-3.5 w-3.5" />} text={form.website} />
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
            <h2 className="text-base font-semibold text-foreground">Account details</h2>
            <p className="text-xs text-muted-foreground">Used across exports, invoices and AI guidance.</p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" value={form.name} onChange={(v) => update("name", v)} />
              <Field label="Email" value={form.email} onChange={(v) => update("email", v)} />
              <Field label="Company" value={form.company} onChange={(v) => update("company", v)} />
              <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
              <Field label="Country" value={form.country} onChange={(v) => update("country", v)} />
              <Field label="City" value={form.city} onChange={(v) => update("city", v)} />
              <Field label="Website" value={form.website} onChange={(v) => update("website", v)} />
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-base"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => navigate(-1)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-base"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90 transition-base"
              >
                <Save className="h-4 w-4" /> Save changes
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-base"
    />
  </div>
);

const Row = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-2 text-muted-foreground">
    <span className="text-foreground/70">{icon}</span>
    <span className="truncate text-foreground">{text}</span>
  </div>
);

export default Profile;
