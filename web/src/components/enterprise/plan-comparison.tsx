import { Check, Minus } from "lucide-react";

const PLANS = ["Professional", "Agency", "Business", "Enterprise"];

const ROWS: { label: string; v: boolean[] }[] = [
  { label: "Applicant Tracking System (ATS)", v: [true, true, true, true] },
  { label: "AI Candidate Scoring & Top Picks", v: [true, true, true, true] },
  { label: "Candidate Comparison", v: [true, true, true, true] },
  { label: "Interview Scheduling (Google / Microsoft)", v: [true, true, true, true] },
  { label: "Offer Letters & E-Signature", v: [true, true, true, true] },
  { label: "Recruiting CRM & Talent Pools", v: [false, true, true, true] },
  { label: "AI Sourcing", v: [false, true, true, true] },
  { label: "Outreach Campaigns", v: [false, true, true, true] },
  { label: "Client Portal & Reporting", v: [false, true, true, true] },
  { label: "White Label & Custom Domain", v: [false, true, true, true] },
  { label: "Hiring Manager Workspace", v: [false, false, true, true] },
  { label: "Workflow Automation", v: [false, false, true, true] },
  { label: "Executive Analytics & Funnel Reporting", v: [false, false, true, true] },
  { label: "SAML / SSO & Advanced RBAC", v: [false, false, true, true] },
  { label: "Compliance Center (GDPR, Audit Logs, Legal Hold)", v: [false, false, true, true] },
  { label: "Dedicated Support & SLA", v: [false, false, false, true] },
  { label: "Custom Integrations (Workday, ADP)", v: [false, false, false, true] },
];

const LIMITS: { label: string; v: string[] }[] = [
  { label: "Recruiters", v: ["3", "10", "25", "Unlimited"] },
  { label: "Active jobs", v: ["10", "50", "Unlimited", "Unlimited"] },
  { label: "Candidates", v: ["5,000", "50,000", "Unlimited", "Unlimited"] },
];

function Cell({ on }: { on: boolean }) {
  return on
    ? <Check className="mx-auto h-4 w-4 text-emerald-500" />
    : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
}

export function PlanComparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-semibold">Features</th>
            {PLANS.map((p) => (
              <th key={p} className={`px-4 py-3 text-center font-semibold ${p === "Agency" ? "text-primary" : ""}`}>
                {p}{p === "Agency" ? " ⭐" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => (
            <tr key={r.label} className={i % 2 ? "bg-muted/20" : ""}>
              <td className="px-4 py-2.5 text-left text-muted-foreground">{r.label}</td>
              {r.v.map((on, j) => <td key={j} className="px-4 py-2.5"><Cell on={on} /></td>)}
            </tr>
          ))}
          <tr className="border-t border-border bg-muted/40">
            <td className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={5}>Limits</td>
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
