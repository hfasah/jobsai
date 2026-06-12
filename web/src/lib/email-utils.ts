/** Returns the standard email footer HTML. Pass false to suppress it (white-label). */
export function poweredByFooter(show = true): string {
  if (!show) return "";
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
<p style="color:#94a3b8;font-size:12px;margin:0">Powered by <a href="https://jobsai.work" style="color:#2563eb;text-decoration:none">JobsAI.Work</a></p>`;
}

/** Wraps HTML content in the standard email shell. */
export function wrapEmail(body: string, showPoweredBy = true): string {
  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#0f172a">
${body}
${poweredByFooter(showPoweredBy)}
</div>`;
}

/** Returns the email "from" display name for an org. */
export function emailFromName(orgName: string, customFromName?: string | null): string {
  return customFromName?.trim() || `${orgName} Recruiting`;
}
