"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Check, User, Link2, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplyProfileUpdate } from "@/types/apply";

const EMPTY: ApplyProfileUpdate = {
  first_name: null, last_name: null, email: null, phone: null,
  linkedin_url: null, github_url: null, portfolio_url: null, website_url: null,
  city: null, country: null, authorized_to_work: true, requires_sponsorship: false,
};

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

function SectionCard({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function ApplyProfilePage() {
  const [form, setForm] = useState<ApplyProfileUpdate>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/apply-profile")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setForm({ ...EMPTY, ...j.data });
        else if (j.prefill) setForm({ ...EMPTY, ...j.prefill });
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ApplyProfileUpdate, value: string | boolean | null) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value || null }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/apply-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const str = (v: string | null | undefined) => v ?? "";

  if (loading) {
    return (
      <>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
          Application passport
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Apply Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filled once. Used for every auto-apply submission. Fields were pre-filled from your resume where possible.
        </p>

        <div className="mt-8 space-y-6">

          {/* Personal */}
          <SectionCard icon={<User className="h-4 w-4" />} title="Personal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" value={str(form.first_name)} onChange={(v) => set("first_name", v)} placeholder="Jane" />
              <Field label="Last name"  value={str(form.last_name)}  onChange={(v) => set("last_name", v)}  placeholder="Smith" />
              <Field label="Email" type="email" value={str(form.email)} onChange={(v) => set("email", v)} placeholder="jane@example.com" />
              <Field label="Phone" type="tel"   value={str(form.phone)} onChange={(v) => set("phone", v)} placeholder="+1 555 000 0000" />
            </div>
          </SectionCard>

          {/* Links */}
          <SectionCard icon={<Link2 className="h-4 w-4" />} title="Links">
            <div className="space-y-3">
              <Field label="LinkedIn URL"  value={str(form.linkedin_url)}  onChange={(v) => set("linkedin_url", v)}  placeholder="https://linkedin.com/in/…" />
              <Field label="GitHub URL"    value={str(form.github_url)}    onChange={(v) => set("github_url", v)}    placeholder="https://github.com/…" />
              <Field label="Portfolio URL" value={str(form.portfolio_url)} onChange={(v) => set("portfolio_url", v)} placeholder="https://…" />
              <Field label="Website URL"   value={str(form.website_url)}   onChange={(v) => set("website_url", v)}   placeholder="https://…" />
            </div>
          </SectionCard>

          {/* Location */}
          <SectionCard icon={<MapPin className="h-4 w-4" />} title="Location">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City"    value={str(form.city)}    onChange={(v) => set("city", v)}    placeholder="San Francisco" />
              <Field label="Country" value={str(form.country)} onChange={(v) => set("country", v)} placeholder="United States" />
            </div>
          </SectionCard>

          {/* Work authorization */}
          <SectionCard icon={<ShieldCheck className="h-4 w-4" />} title="Work authorization">
            <div className="space-y-3">
              {[
                { key: "authorized_to_work",  label: "I am authorized to work in my target country" },
                { key: "requires_sponsorship", label: "I require visa sponsorship" },
              ].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form[key as keyof ApplyProfileUpdate] as boolean}
                    onChange={(e) => set(key as keyof ApplyProfileUpdate, e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </SectionCard>

          {/* Save */}
          <div className="flex items-center gap-4 pb-4">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              ) : saved ? (
                <><Check className="mr-2 h-4 w-4" />Saved</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Save profile</>
              )}
            </Button>
            {saved && (
              <p className="text-sm text-desyn-success">
                Profile saved — ready for auto-apply.
              </p>
            )}
          </div>

        </div>
      </main>
    </>
  );
}
