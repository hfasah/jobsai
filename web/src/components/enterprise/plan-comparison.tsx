import { Check } from "lucide-react";

// Grouped feature matrix — grouping makes the list feel shorter, and every
// cell says what it means: "Included", "Add-on", or "—".
const PLAN_HEADERS: { name: string; tag: string; popular?: boolean }[] = [
  { name: "Starter", tag: "Solo Recruiters" },
  { name: "Professional", tag: "Best for Startups" },
  { name: "Agency", tag: "Most Popular ⭐", popular: true },
  { name: "Business", tag: "Best Value" },
  { name: "Enterprise", tag: "Custom" },
];

type CellV = "in" | "addon" | "no";
type Row = { label: string; v: [CellV, CellV, CellV, CellV, CellV] };
type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "Core Recruiting",
    rows: [
      { label: "Applicant Tracking System (ATS)", v: ["in", "in", "in", "in", "in"] },
      { label: "Career Pages & Candidate Portal", v: ["in", "in", "in", "in", "in"] },
      { label: "Interview Scheduling (Google / Microsoft)", v: ["in", "in", "in", "in", "in"] },
      { label: "Offer Letters & E-Signature", v: ["in", "in", "in", "in", "in"] },
      { label: "Candidate Comparison", v: ["no", "in", "in", "in", "in"] },
    ],
  },
  {
    title: "AI",
    rows: [
      { label: "AI Candidate Scoring & Top Picks", v: ["in", "in", "in", "in", "in"] },
      { label: "AI Sourcing & Advanced Search", v: ["no", "no", "in", "in", "in"] },
      { label: "AI Outreach Campaigns & Email Sequences", v: ["no", "no", "in", "in", "in"] },
      { label: "AI Interview Suite (voice & avatar)", v: ["addon", "addon", "addon", "addon", "in"] },
      { label: "Autonomous Recruiting Agent", v: ["addon", "addon", "addon", "addon", "addon"] },
    ],
  },
  {
    title: "Collaboration",
    rows: [
      { label: "Recruiting CRM & Talent Pools", v: ["in", "in", "in", "in", "in"] },
      { label: "CRM Automation & Candidate Nurturing", v: ["no", "no", "in", "in", "in"] },
      { label: "Client Portal & Reporting", v: ["no", "no", "in", "in", "in"] },
      { label: "Hiring Manager Workspace", v: ["no", "no", "no", "in", "in"] },
      { label: "Workflow Automation", v: ["no", "no", "no", "in", "in"] },
      { label: "White Label & Custom Domain", v: ["no", "no", "in", "in", "in"] },
      { label: "SMS & WhatsApp Messaging", v: ["addon", "addon", "addon", "addon", "addon"] },
    ],
  },
  {
    title: "Enterprise",
    rows: [
      { label: "SAML / SSO & Advanced RBAC", v: ["no", "no", "no", "in", "in"] },
      { label: "Compliance Center (GDPR, Audit Logs, Legal Hold)", v: ["no", "no", "no", "in", "in"] },
      { label: "Executive Analytics & Funnel Reporting", v: ["no", "no", "no", "in", "in"] },
      { label: "ATS Integrations (Greenhouse, Lever & more)", v: ["no", "no", "in", "in", "in"] },
      { label: "Custom Integrations (Workday, ADP)", v: ["no", "no", "no", "no", "in"] },
      { label: "Dedicated Success Manager & Custom SLA", v: ["no", "no", "no", "no", "in"] },
    ],
  },
];

const LIMITS: { label: string; v: string[] }[] = [
  { label: "Recruiters", v: ["1", "3", "10", "25", "Unlimited"] },
  { label: "Active jobs", v: ["10", "10", "50", "Unlimited", "Unlimited"] },
  { label: "Candidates", v: ["2,000", "5,000", "50,000", "Unlimited", "Unlimited"] },
];

function Cell({ v }: { v: CellV }) {
  if (v === "in") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
        <Check className="h-3.5 w-3.5" /> Included
      </span>
    );
  }
  if (v === "addon") {
    return <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Add-on</span>;
  }
  return <span className="text-muted-foreground/40">—</span>;
}

export function PlanComparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-semibold">Features</th>
            {PLAN_HEADERS.map((p) => (
              <th key={p.name} className="px-4 py-3 text-center">
                <span className={`block font-semibold ${p.popular ? "text-primary" : ""}`}>{p.name}</span>
                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{p.tag}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => (
            <FragmentGroup key={g.title} group={g} />
          ))}
          <tr className="border-t border-border bg-muted/40">
            <td className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={6}>Capacity</td>
          </tr>
          {LIMITS.map((r) => (
            <tr key={r.label}>
              <td className="px-4 py-2.5 text-left text-muted-foreground">{r.label}</td>
              {r.v.map((val, j) => <td key={j} className="px-4 py-2.5 text-center font-medium">{val}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentGroup({ group }: { group: Group }) {
  return (
    <>
      <tr className="border-t border-border bg-muted/40">
        <td className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={6}>{group.title}</td>
      </tr>
      {group.rows.map((r, i) => (
        <tr key={r.label} className={i % 2 ? "bg-muted/20" : ""}>
          <td className="px-4 py-2.5 text-left text-muted-foreground">{r.label}</td>
          {r.v.map((v, j) => <td key={j} className="px-4 py-2.5 text-center"><Cell v={v} /></td>)}
        </tr>
      ))}
    </>
  );
}
