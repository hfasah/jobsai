"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Save, Check, User, Link2, MapPin, ShieldCheck,
  Briefcase, GraduationCap, UsersRound, SlidersHorizontal,
  Plus, Trash2, Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplyProfileUpdate } from "@/types/apply";

const EMPTY: ApplyProfileUpdate = {
  first_name: null, last_name: null, email: null, phone: null,
  linkedin_url: null, github_url: null, portfolio_url: null, website_url: null,
  city: null, country: null, authorized_to_work: true, requires_sponsorship: false,
  employment_status: null, target_experience_level: null, industry: null,
  willing_to_relocate: false, available_from: null,
  address_line1: null, address_line2: null, postal_code: null, date_of_birth: null,
  work_auth_us: null, work_auth_canada: null,
  work_auth_countries: [], languages: [],
  security_clearance: null, has_drivers_license: false,
  highest_education: null, university: null, certifications: [],
  race_ethnicity: null, nationality: null, gender_identity: null, sexual_orientation: null,
  transgender: null, disability_status: null, veteran_status: null,
  cc_email: null, application_mode: "review", auto_reply: false,
  job_board_password: null,
};

// ─── Option lists ─────────────────────────────────────────────────────────────
const EMPLOYMENT_STATUS = ["Employed — open to offers", "Actively looking", "Open to opportunities", "Not currently looking", "Student / new grad"];
const EXPERIENCE_LEVELS = ["Entry", "Mid", "Senior", "Lead", "Principal / Staff", "Director", "Executive"];
const EDUCATION_LEVELS = ["High school", "Associate", "Bachelor's", "Master's", "MBA", "Doctorate / PhD", "Other"];
const WORK_AUTH = ["Citizen", "Permanent resident", "Authorized (work visa)", "Need sponsorship", "Not authorized", "Not applicable"];
const CLEARANCE = ["None", "Eligible", "Active — Confidential", "Active — Secret", "Active — Top Secret"];

const COUNTRIES = [
  // North America
  "United States", "Canada", "Mexico",
  // Europe
  "United Kingdom", "Ireland", "Germany", "France", "Spain", "Italy",
  "Netherlands", "Belgium", "Switzerland", "Austria", "Sweden", "Norway",
  "Denmark", "Finland", "Poland", "Portugal", "Czech Republic", "Romania",
  "Hungary", "Greece", "Croatia", "Slovakia", "Slovenia", "Estonia",
  "Latvia", "Lithuania", "Luxembourg", "Malta", "Cyprus",
];

const LANGUAGE_OPTIONS = [
  "English", "French", "Spanish", "German", "Portuguese", "Italian",
  "Dutch", "Polish", "Swedish", "Norwegian", "Danish", "Finnish",
  "Romanian", "Czech", "Greek", "Hungarian",
];

const PROFICIENCY_LEVELS = [
  "Native / Bilingual",
  "Fluent (C1-C2)",
  "Conversational (B1-B2)",
  "Basic (A1-A2)",
];
const RACE = ["Prefer not to say", "American Indian / Alaska Native", "Asian", "Black / African American", "Hispanic / Latino", "Native Hawaiian / Pacific Islander", "White", "Two or more races", "Other"];
const GENDER = ["Prefer not to say", "Male", "Female", "Non-binary", "Other"];
const ORIENTATION = ["Prefer not to say", "Heterosexual", "Gay / Lesbian", "Bisexual", "Other"];
const YESNO = ["Prefer not to say", "No", "Yes"];
const VETERAN = ["Prefer not to say", "Not a veteran", "Veteran", "Protected veteran"];
const APP_MODES: { v: string; label: string; hint: string }[] = [
  { v: "review", label: "Review", hint: "Nothing is sent without your approval." },
  { v: "hybrid", label: "Hybrid", hint: "Auto-apply strong matches; review the rest." },
  { v: "auto", label: "Auto", hint: "Apply to all matching jobs automatically." },
];

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
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

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function SectionCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
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
  // Raw string kept separate so commas aren't eaten while the user is still typing
  const [certsRaw, setCertsRaw] = useState("");

  useEffect(() => {
    fetch("/api/apply-profile")
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? j.prefill;
        if (data) {
          setForm({ ...EMPTY, ...data });
          setCertsRaw((data.certifications ?? []).join(", "));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ApplyProfileUpdate, value: string | boolean | null) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value === "" ? null : value }));
  };
  // Only parse comma-split on blur — while typing, keep raw string intact
  const commitCerts = () => {
    const parsed = certsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    setSaved(false);
    setForm((f) => ({ ...f, certifications: parsed }));
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent-text">Application passport</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Apply Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Filled once, used to complete every auto-apply form. Most fields are optional — add what you&apos;re comfortable sharing.
      </p>

      <div className="mt-8 space-y-6">
        {/* Personal */}
        <SectionCard icon={<User className="h-4 w-4" />} title="Personal details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={str(form.first_name)} onChange={(v) => set("first_name", v)} placeholder="Jane" />
            <Field label="Last name" value={str(form.last_name)} onChange={(v) => set("last_name", v)} placeholder="Smith" />
            <Field label="Email" type="email" value={str(form.email)} onChange={(v) => set("email", v)} placeholder="jane@example.com" />
            <Field label="Phone" type="tel" value={str(form.phone)} onChange={(v) => set("phone", v)} placeholder="+1 555 000 0000" />
          </div>
        </SectionCard>

        {/* Role & experience */}
        <SectionCard icon={<Briefcase className="h-4 w-4" />} title="Role & experience">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Employment status" value={str(form.employment_status)} onChange={(v) => set("employment_status", v)} options={EMPLOYMENT_STATUS} />
            <Select label="Target experience level" value={str(form.target_experience_level)} onChange={(v) => set("target_experience_level", v)} options={EXPERIENCE_LEVELS} />
            <Field label="Industry preference" value={str(form.industry)} onChange={(v) => set("industry", v)} placeholder="e.g. Cloud / Infrastructure" />
            <Field label="Available from" type="date" value={str(form.available_from)} onChange={(v) => set("available_from", v)} />
          </div>
          <div className="mt-4">
            <Toggle label="I'm willing to relocate for the right role" checked={!!form.willing_to_relocate} onChange={(v) => set("willing_to_relocate", v)} />
          </div>
        </SectionCard>

        {/* Address */}
        <SectionCard icon={<MapPin className="h-4 w-4" />} title="Address">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1" value={str(form.address_line1)} onChange={(v) => set("address_line1", v)} placeholder="123 Main St" />
            <Field label="Address line 2" value={str(form.address_line2)} onChange={(v) => set("address_line2", v)} placeholder="Apt 4B" />
            <Field label="City" value={str(form.city)} onChange={(v) => set("city", v)} placeholder="San Francisco" />
            <Field label="Country" value={str(form.country)} onChange={(v) => set("country", v)} placeholder="United States" />
            <Field label="Postal / ZIP code" value={str(form.postal_code)} onChange={(v) => set("postal_code", v)} placeholder="94105" />
          </div>
        </SectionCard>

        {/* Links */}
        <SectionCard icon={<Link2 className="h-4 w-4" />} title="Links">
          <div className="space-y-3">
            <Field label="LinkedIn URL" value={str(form.linkedin_url)} onChange={(v) => set("linkedin_url", v)} placeholder="https://linkedin.com/in/…" />
            <Field label="GitHub URL" value={str(form.github_url)} onChange={(v) => set("github_url", v)} placeholder="https://github.com/…" />
            <Field label="Portfolio URL" value={str(form.portfolio_url)} onChange={(v) => set("portfolio_url", v)} placeholder="https://…" />
            <Field label="Website URL" value={str(form.website_url)} onChange={(v) => set("website_url", v)} placeholder="https://…" />
          </div>
        </SectionCard>

        {/* Education & certifications */}
        <SectionCard icon={<GraduationCap className="h-4 w-4" />} title="Education & certifications" subtitle="Optional — used when forms ask for them.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Highest level of education" value={str(form.highest_education)} onChange={(v) => set("highest_education", v)} options={EDUCATION_LEVELS} />
            <Field label="University / school" value={str(form.university)} onChange={(v) => set("university", v)} placeholder="University of …" />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium">Certifications (comma-separated)</label>
            <input
              type="text"
              value={certsRaw}
              onChange={(e) => setCertsRaw(e.target.value)}
              onBlur={commitCerts}
              placeholder="AWS SA Pro, CKA, PMP"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {(form.certifications ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(form.certifications ?? []).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Eligibility */}
        <SectionCard icon={<ShieldCheck className="h-4 w-4" />} title="Eligibility">
          {/* Work authorization by country */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Work authorization</p>
            {(form.work_auth_countries ?? []).map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={entry.country}
                  onChange={(e) => {
                    const next = [...(form.work_auth_countries ?? [])];
                    next[i] = { ...next[i], country: e.target.value };
                    setSaved(false);
                    setForm((f) => ({ ...f, work_auth_countries: next }));
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={entry.status}
                  onChange={(e) => {
                    const next = [...(form.work_auth_countries ?? [])];
                    next[i] = { ...next[i], status: e.target.value };
                    setSaved(false);
                    setForm((f) => ({ ...f, work_auth_countries: next }));
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Status…</option>
                  {WORK_AUTH.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const next = (form.work_auth_countries ?? []).filter((_, j) => j !== i);
                    setSaved(false);
                    setForm((f) => ({ ...f, work_auth_countries: next }));
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setForm((f) => ({ ...f, work_auth_countries: [...(f.work_auth_countries ?? []), { country: "", status: "" }] }));
              }}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add country
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select label="Security clearance" value={str(form.security_clearance)} onChange={(v) => set("security_clearance", v)} options={CLEARANCE} />
          </div>
          <div className="mt-4 space-y-3">
            <Toggle label="I am authorized to work in my target country" checked={form.authorized_to_work !== false} onChange={(v) => set("authorized_to_work", v)} />
            <Toggle label="I require visa sponsorship" checked={!!form.requires_sponsorship} onChange={(v) => set("requires_sponsorship", v)} />
            <Toggle label="I have a current driver's license" checked={!!form.has_drivers_license} onChange={(v) => set("has_drivers_license", v)} />
          </div>
        </SectionCard>

        {/* Languages */}
        <SectionCard icon={<Languages className="h-4 w-4" />} title="Languages" subtitle="Optional — helps match bilingual roles and fill language fields on applications.">
          <div className="space-y-3">
            {(form.languages ?? []).map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={entry.language}
                  onChange={(e) => {
                    const next = [...(form.languages ?? [])];
                    next[i] = { ...next[i], language: e.target.value };
                    setSaved(false);
                    setForm((f) => ({ ...f, languages: next }));
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select language…</option>
                  {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select
                  value={entry.proficiency}
                  onChange={(e) => {
                    const next = [...(form.languages ?? [])];
                    next[i] = { ...next[i], proficiency: e.target.value };
                    setSaved(false);
                    setForm((f) => ({ ...f, languages: next }));
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Proficiency…</option>
                  {PROFICIENCY_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const next = (form.languages ?? []).filter((_, j) => j !== i);
                    setSaved(false);
                    setForm((f) => ({ ...f, languages: next }));
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setForm((f) => ({ ...f, languages: [...(f.languages ?? []), { language: "", proficiency: "" }] }));
              }}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add language
            </button>
          </div>
        </SectionCard>

        {/* Voluntary self-identification */}
        <SectionCard icon={<UsersRound className="h-4 w-4" />} title="Voluntary self-identification" subtitle="Optional EEO questions some employers ask. Never used to filter you.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Race / ethnicity" value={str(form.race_ethnicity)} onChange={(v) => set("race_ethnicity", v)} options={RACE} />
            <Field label="Nationality (optional)" value={str(form.nationality)} onChange={(v) => set("nationality", v)} placeholder="Leave blank if you prefer not to say" />
            <Select label="Gender identity" value={str(form.gender_identity)} onChange={(v) => set("gender_identity", v)} options={GENDER} />
            <Select label="Sexual orientation" value={str(form.sexual_orientation)} onChange={(v) => set("sexual_orientation", v)} options={ORIENTATION} />
            <Select label="Transgender" value={str(form.transgender)} onChange={(v) => set("transgender", v)} options={YESNO} />
            <Select label="Disability status" value={str(form.disability_status)} onChange={(v) => set("disability_status", v)} options={YESNO} />
            <Select label="Veteran status" value={str(form.veteran_status)} onChange={(v) => set("veteran_status", v)} options={VETERAN} />
          </div>
        </SectionCard>

        {/* Application behaviour */}
        <SectionCard icon={<SlidersHorizontal className="h-4 w-4" />} title="Application behaviour">
          <div className="space-y-2">
            {APP_MODES.map((m) => (
              <label key={m.v} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${form.application_mode === m.v ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                <input type="radio" name="app_mode" checked={form.application_mode === m.v} onChange={() => set("application_mode", m.v)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span>
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <Field label="CC a copy of applications to (optional)" type="email" value={str(form.cc_email)} onChange={(v) => set("cc_email", v)} placeholder="you@personal.com" />
          </div>

          {/* Job board password — used by the browser agent to create/log into job boards */}
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">Job Board Account Password</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              When applying automatically, the browser agent needs to create or log into accounts on job boards like Adzuna, Workable, and others. Set a password here and the agent will use it — keeping your personal accounts separate from your job search.
            </p>
            <div className="mt-3">
              <Field label="" type="password" value={str(form.job_board_password)} onChange={(v) => set("job_board_password", v)} placeholder="Set a password for job board accounts" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 Use a unique password you don&apos;t use elsewhere. The agent uses your email + this password to create accounts on job boards that require registration before applying.
            </p>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <Toggle label="Auto-confirm replies to interview & application-update emails" checked={!!form.auto_reply} onChange={(v) => set("auto_reply", v)} />
            <p className="ml-7 mt-1 text-xs text-muted-foreground">
              When on, JobsAI drafts and sends a reply on your behalf — from your own mailbox — to interview and application-update emails as they arrive. Off by default; verification codes and rejections are never auto-replied.
            </p>
          </div>
        </SectionCard>

        {/* Save */}
        <div className="flex items-center gap-4 pb-4">
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              : saved ? <><Check className="mr-2 h-4 w-4" />Saved</>
              : <><Save className="mr-2 h-4 w-4" />Save profile</>}
          </Button>
          {saved && <p className="text-sm text-desyn-success">Profile saved — ready for auto-apply.</p>}
        </div>
      </div>
    </main>
  );
}
