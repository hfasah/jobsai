// Merge.dev unified ATS API. One integration → 24+ ATS (Greenhouse, Lever,
// Ashby, Workable, Bullhorn, Workday…). Merge handles each provider's auth via
// Merge Link; we exchange the public token for an account-scoped token, then
// read normalized jobs/candidates/applications through a single REST surface.
const INTEGRATIONS_BASE = "https://api.merge.dev/api/integrations";
const ATS_BASE = "https://api.merge.dev/api/ats/v1";

export function mergeConfigured(): boolean {
  return Boolean(process.env.MERGE_API_KEY);
}

function apiKey(): string {
  const k = process.env.MERGE_API_KEY;
  if (!k) throw new Error("MERGE_API_KEY is not set");
  return k;
}

/** Create a Link token to open Merge Link for one org (end user). */
export async function createLinkToken(input: {
  orgId: string;
  orgName: string;
  email: string;
}): Promise<string> {
  const res = await fetch(`${INTEGRATIONS_BASE}/create-link-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      end_user_origin_id: input.orgId,
      end_user_organization_name: input.orgName,
      end_user_email_address: input.email,
      categories: ["ats"],
    }),
  });
  if (!res.ok) {
    throw new Error(`Merge create-link-token failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { link_token: string };
  return json.link_token;
}

export type MergeAccount = {
  account_token: string;
  integration?: { name?: string; slug?: string };
};

/** Exchange the public token from Merge Link for a durable account token. */
export async function exchangeToken(publicToken: string): Promise<MergeAccount> {
  const res = await fetch(`${INTEGRATIONS_BASE}/account-token/${publicToken}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    throw new Error(`Merge account-token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as MergeAccount;
}

async function atsGet<T>(
  path: string,
  accountToken: string,
  params?: Record<string, string>,
): Promise<{ results: T[] }> {
  const url = new URL(`${ATS_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "X-Account-Token": accountToken,
    },
  });
  if (!res.ok) {
    throw new Error(`Merge GET ${path} failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { results?: T[] };
  return { results: json.results ?? [] };
}

export type MergeJob = {
  id: string;
  name?: string | null;
  status?: string | null; // OPEN | CLOSED | DRAFT | ARCHIVED | PENDING
  departments?: { name?: string | null }[];
  offices?: { name?: string | null; location?: string | null }[];
};

export type MergeCandidate = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: { value?: string | null }[];
};

export type MergeApplication = {
  id: string;
  candidate?: MergeCandidate | string | null; // object when expanded
  job?: string | null; // job id
  current_stage?: { name?: string | null } | string | null;
  credited_to?: unknown;
};

export function listJobs(accountToken: string) {
  return atsGet<MergeJob>("/jobs", accountToken, { page_size: "100", expand: "departments,offices" });
}

export function listApplications(accountToken: string) {
  return atsGet<MergeApplication>("/applications", accountToken, {
    page_size: "100",
    expand: "candidate,current_stage",
  });
}

/** Best-effort: delete the linked account in Merge so we stop being billed for it. */
export async function deleteAccount(accountToken: string): Promise<void> {
  try {
    await fetch(`${ATS_BASE}/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "X-Account-Token": accountToken,
      },
    });
  } catch {
    // non-fatal: local disconnect still proceeds
  }
}
