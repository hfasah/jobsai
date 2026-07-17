// Resend Domains adapter — per-org sending domains so cold outreach reputation
// is isolated per customer (never shared jobsai.work). SERVER-ONLY.
import { resend } from "@/lib/resend";

export interface DnsRecord {
  record: string;   // SPF | DKIM | Tracking | Receiving MX
  name: string;
  type: string;     // TXT | CNAME | MX
  value: string;
  ttl?: string;
  status?: string;  // not_started | pending | verified | failed
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;   // not_started | pending | verified | partially_verified | partially_failed | failed
  region?: string;
  records: DnsRecord[];
}

function normalizeDomain(input: {
  id: string;
  name: string;
  status: string;
  region?: string;
  records?: DnsRecord[] | null;
}): ResendDomain {
  return {
    id: input.id,
    name: input.name,
    status: input.status,
    region: input.region,
    records: input.records ?? [],
  };
}

export async function createResendDomain(name: string): Promise<ResendDomain> {
  // receiving=enabled: candidate replies to ANY address on the tenant domain
  // flow back through Resend inbound → our webhook — this closes the
  // reply-capture blind spot that connected-Gmail sending has. The Receiving
  // MX record is returned in `records` and shows up in the DNS checklist.
  // (capabilities isn't in the SDK's typed params yet — pass it through.)
  const { data, error } = await resend.domains.create({
    name,
    capabilities: { sending: "enabled", receiving: "enabled" },
  } as unknown as Parameters<typeof resend.domains.create>[0]);
  if (error || !data) throw new Error(error?.message ?? "Resend domain create failed");
  return normalizeDomain(data as unknown as Parameters<typeof normalizeDomain>[0]);
}

export async function getResendDomain(id: string): Promise<ResendDomain> {
  const { data, error } = await resend.domains.get(id);
  if (error || !data) throw new Error(error?.message ?? "Resend domain fetch failed");
  return normalizeDomain(data as unknown as Parameters<typeof normalizeDomain>[0]);
}

// Kicks off async verification; poll getResendDomain (or rely on the
// domain.updated webhook) for the outcome.
export async function verifyResendDomain(id: string): Promise<void> {
  const { error } = await resend.domains.verify(id);
  if (error) throw new Error(error.message ?? "Resend domain verify failed");
}

export async function removeResendDomain(id: string): Promise<void> {
  const { error } = await resend.domains.remove(id);
  if (error) throw new Error(error.message ?? "Resend domain remove failed");
}

export function isUsableStatus(status: string): boolean {
  return status === "verified" || status === "partially_verified";
}
