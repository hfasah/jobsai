// Single source of truth for the job boards JobsAI supports and how far the
// in-browser agent can take an application on each one.
//
//   direct   — the extension autofills AND submits the application in the user's
//              own browser (Apply-to-All runs unattended on these).
//   assisted — the extension autofills, then stops so the user reviews + submits
//              (form is too variable / multi-step to safely auto-submit yet).
//   manual   — just opens the listing; the user applies themselves.
//
// Upgrading a board from "assisted" to "direct" is a one-line change here once its
// extension adapter is hardened — the dashboard and extension both read this list.

export type ApplyMode = "direct" | "assisted" | "manual";

export interface JobBoard {
  id: string;
  label: string;
  applyMode: ApplyMode;
  /** Hostname fragments that identify a job URL as belonging to this board. */
  hosts: string[];
  /**
   * The extension ships an auto-submit adapter for this board. Whether it actually
   * auto-submits in bulk is a per-user toggle (off by default until the user
   * verifies it on a live listing) — see the extension's `directBoards` storage.
   */
  adapter?: boolean;
  /**
   * The board forces applicants to CREATE AN ACCOUNT before applying (no guest
   * path). A headless agent can't clear this without saved credentials, so we
   * route these to manual/assisted up front instead of burning a doomed run.
   */
  accountRequired?: boolean;
  note?: string;
}

// applyMode reflects what the extension can do RELIABLY today. LinkedIn auto-submits
// Easy Apply; the others autofill and let the user submit until each adapter is
// hardened against its live site — at which point flip its mode to "direct" here.
export const JOB_BOARDS: JobBoard[] = [
  { id: "linkedin",    label: "LinkedIn",              applyMode: "direct",   adapter: true,  hosts: ["linkedin.com"],                                  note: "Easy Apply — auto-submit" },
  { id: "indeed",      label: "Indeed",                applyMode: "assisted", adapter: true,  hosts: ["indeed.com"],                                    note: "Indeed Apply" },
  { id: "ziprecruiter",label: "ZipRecruiter",          applyMode: "assisted", adapter: true,  hosts: ["ziprecruiter.com"],                              note: "1-Click Apply" },
  { id: "dice",        label: "Dice",                  applyMode: "assisted", adapter: true,  hosts: ["dice.com"],                                      note: "Easy Apply" },
  { id: "workable",    label: "Workable (Direct-Apply)", applyMode: "assisted", adapter: true, hosts: ["workable.com", "apply.workable.com", "jobs.workable.com"], note: "Direct-Apply" },
  { id: "glassdoor",   label: "Glassdoor",             applyMode: "assisted", hosts: ["glassdoor.com"],                                 note: "Autofill, you submit" },
  { id: "monster",     label: "Monster",               applyMode: "assisted", hosts: ["monster.com"],                                   note: "Autofill, you submit" },
  // Account-walled ATS — must create an account to apply. Gated in agent-apply
  // unless the user has saved a login / has a persisted browser profile.
  { id: "workday",        label: "Workday",            applyMode: "assisted", accountRequired: true, hosts: ["myworkdayjobs.com", "workday.com"],                       note: "Account required" },
  { id: "successfactors", label: "SAP SuccessFactors", applyMode: "assisted", accountRequired: true, hosts: ["successfactors.com", "successfactors.eu", "sapsf.com"],   note: "Account required" },
  { id: "taleo",          label: "Oracle Taleo",       applyMode: "assisted", accountRequired: true, hosts: ["taleo.net"],                                              note: "Account required" },
  { id: "manual",      label: "JobsAI Jobs (Manual)",  applyMode: "manual",   hosts: [],                                                note: "Opens the listing" },
];

const MANUAL = JOB_BOARDS.find((b) => b.id === "manual")!;

export function boardById(id: string): JobBoard {
  return JOB_BOARDS.find((b) => b.id === id) ?? MANUAL;
}

/** Resolve which board a job URL belongs to (falls back to "manual"). */
export function boardForUrl(url: string | null | undefined): JobBoard {
  if (!url) return MANUAL;
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return MANUAL; }
  for (const b of JOB_BOARDS) {
    if (b.hosts.some((h) => host === h || host.endsWith("." + h))) return b;
  }
  return MANUAL;
}

export function canDirectApply(url: string | null | undefined): boolean {
  return boardForUrl(url).applyMode === "direct";
}

// Aggregator/listing hosts whose URLs are a redirect or a job-listing page, NOT
// the actual application form. When the import source is one of these, the
// parser's posting_url (the real apply link) is the better target for the agent.
const AGGREGATOR_HOST_FRAGMENTS = [
  "adzuna.", "indeed.", "ziprecruiter.", "glassdoor.", "google.",
  "jooble.", "talent.com", "bebee.", "jobrapido", "trabajo", "remoteok", "arbeitnow",
];

/**
 * Pick the best URL for the browser agent to apply on: prefer the direct
 * `postingUrl` over an aggregator/listing `sourceUrl`, so the agent lands on the
 * real application form instead of a redirect/listing it can't apply from.
 * Keeps `sourceUrl` when it's already a direct posting (or when there's no posting_url).
 */
export function directApplyUrl(sourceUrl?: string | null, postingUrl?: string | null): string | null {
  const src = sourceUrl || null;
  const post = postingUrl || null;
  if (!post) return src;
  if (!src) return post;
  let host = "";
  try { host = new URL(src).hostname.toLowerCase(); } catch { return post; }
  const srcIsAggregator = AGGREGATOR_HOST_FRAGMENTS.some((h) => host.includes(h));
  return srcIsAggregator ? post : src;
}
