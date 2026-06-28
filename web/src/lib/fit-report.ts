// Self-contained, print-friendly HTML "Candidate Fit Report" — attached to the
// "send to hiring manager" notification email. No external assets or deps, so it
// renders standalone in any browser and prints cleanly to PDF.

export interface FitReportInput {
  candidate_name: string;
  candidate_email?: string | null;
  candidate_phone?: string | null;
  job_title?: string | null;
  org_name: string;
  match_score?: number | null;
  skills_score?: number | null;
  experience_score?: number | null;
  ats_score?: number | null;
  ai_recommendation?: string | null;
  ai_summary?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  risk_flags?: string[] | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function scoreColor(n: number): string {
  return n >= 75 ? "#16a34a" : n >= 50 ? "#d97706" : "#dc2626";
}

function scoreCard(label: string, n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  const c = scoreColor(n);
  return `<div class="score"><div class="score-num" style="color:${c}">${n}</div><div class="score-label">${esc(label)}</div></div>`;
}

export function fitReportFilename(name: string): string {
  const slug = (name || "candidate").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "candidate";
  return `Fit-Report-${slug}.html`;
}

export function buildFitReportHtml(r: FitReportInput): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const scores = [
    scoreCard("Overall match", r.match_score),
    scoreCard("Skills", r.skills_score),
    scoreCard("Experience", r.experience_score),
    scoreCard("ATS", r.ats_score),
  ].filter(Boolean).join("");

  const rec = r.ai_recommendation
    ? `<span class="rec">${esc(r.ai_recommendation.replace(/_/g, " "))}</span>` : "";

  const contact = [
    r.candidate_email ? `<a href="mailto:${esc(r.candidate_email)}">${esc(r.candidate_email)}</a>` : "",
    r.candidate_phone ? esc(r.candidate_phone) : "",
  ].filter(Boolean).join(" &middot; ");

  const skills = (r.tags ?? []).length
    ? `<section><h2>Skills</h2><div class="chips">${(r.tags ?? []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div></section>` : "";

  const risks = (r.risk_flags ?? []).length
    ? `<section><h2>Risk flags</h2><ul class="risks">${(r.risk_flags ?? []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : "";

  const summary = r.ai_summary
    ? `<section><h2>AI assessment</h2><p>${esc(r.ai_summary)}</p></section>` : "";

  const notes = r.notes
    ? `<section><h2>Recruiter notes</h2><p>${esc(r.notes)}</p></section>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fit Report — ${esc(r.candidate_name)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#f4f4f5;color:#18181b;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .page{max-width:760px;margin:24px auto;background:#fff;border-radius:14px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6366f1;margin:0 0 4px}
  h1{font-size:26px;margin:0 0 2px} .sub{color:#52525b;margin:0 0 6px;font-size:15px}
  .contact{color:#71717a;font-size:13px;margin:0 0 20px} .contact a{color:#6366f1;text-decoration:none}
  .scores{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 8px}
  .score{flex:1;min-width:120px;border:1px solid #e4e4e7;border-radius:10px;padding:14px;text-align:center}
  .score-num{font-size:30px;font-weight:800;line-height:1} .score-label{font-size:12px;color:#71717a;margin-top:4px}
  .rec{display:inline-block;margin:8px 0 0;padding:5px 12px;border-radius:999px;background:#eef2ff;color:#4338ca;font-weight:600;font-size:13px;text-transform:capitalize}
  section{margin-top:24px} h2{font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#52525b;margin:0 0 8px;border-top:1px solid #e4e4e7;padding-top:18px}
  section p{margin:0;color:#27272a} .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:3px 9px;font-size:13px}
  .risks{margin:0;padding-left:18px;color:#b45309} .risks li{margin:2px 0}
  .footer{margin-top:28px;border-top:1px solid #e4e4e7;padding-top:14px;color:#a1a1aa;font-size:12px;text-align:center}
  @media print{body{background:#fff}.page{box-shadow:none;margin:0;border-radius:0;max-width:none}}
</style></head><body>
<div class="page">
  <p class="eyebrow">${esc(r.org_name)} &middot; Candidate Fit Report</p>
  <h1>${esc(r.candidate_name)}</h1>
  ${r.job_title ? `<p class="sub">For ${esc(r.job_title)}</p>` : ""}
  ${contact ? `<p class="contact">${contact}</p>` : ""}
  ${scores ? `<div class="scores">${scores}</div>` : ""}
  ${rec}
  ${summary}
  ${skills}
  ${risks}
  ${notes}
  <div class="footer">Generated by JobsAI on ${esc(date)}</div>
</div>
</body></html>`;
}
