// Single-page salary comparison. For a given job title we read Adzuna's average
// advertised salary (`mean`) in each region and compare them, converting to a
// common USD figure so the bars are comparable.

export interface SalaryRegion {
  code: string;
  label: string;
  short: string;
  currency: string;
  flag: string;
}

export const SALARY_REGIONS: SalaryRegion[] = [
  { code: "us", label: "United States", short: "US", currency: "USD", flag: "🇺🇸" },
  { code: "ca", label: "Canada", short: "Canada", currency: "CAD", flag: "🇨🇦" },
  { code: "gb", label: "United Kingdom", short: "UK", currency: "GBP", flag: "🇬🇧" },
  { code: "de", label: "Germany (EU)", short: "EU", currency: "EUR", flag: "🇪🇺" },
];

// Approximate FX → USD (for comparison only; not live rates).
const FX_TO_USD: Record<string, number> = { USD: 1, CAD: 0.73, GBP: 1.27, EUR: 1.08, PLN: 0.25 };

export const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", CAD: "C$", GBP: "£", EUR: "€", PLN: "zł" };

// Popular roles surfaced as quick links (like a salary directory).
export const POPULAR_ROLES = [
  "Software Engineer", "Data Scientist", "Product Manager", "DevOps Engineer",
  "UX Designer", "Account Executive", "Marketing Manager", "Financial Analyst",
  "Registered Nurse", "Accountant", "Project Manager", "Sales Manager",
  "Business Analyst", "Cloud Architect", "Cybersecurity Analyst", "Mechanical Engineer",
];

export interface RegionSalary extends SalaryRegion {
  mean: number | null;   // native currency
  usd: number | null;    // converted to USD
  count: number;
}

export interface SalaryComparison {
  title: string;
  regions: RegionSalary[];
  configured: boolean;   // Adzuna key present
}

async function regionSalary(title: string, r: SalaryRegion, appId: string, appKey: string): Promise<RegionSalary> {
  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "1",
      what: title,
      "content-type": "application/json",
    });
    const url = `https://api.adzuna.com/v1/api/jobs/${r.code}/search/1?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000), next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Adzuna ${res.status}`);
    const data = (await res.json()) as { mean?: number; count?: number };
    const mean = typeof data.mean === "number" && data.mean > 0 ? Math.round(data.mean) : null;
    const usd = mean != null ? Math.round(mean * (FX_TO_USD[r.currency] ?? 1)) : null;
    return { ...r, mean, usd, count: data.count ?? 0 };
  } catch {
    return { ...r, mean: null, usd: null, count: 0 };
  }
}

export async function getSalaryComparison(title: string): Promise<SalaryComparison> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const t = title.trim() || "Software Engineer";

  if (!appId || !appKey) {
    return { title: t, regions: SALARY_REGIONS.map((r) => ({ ...r, mean: null, usd: null, count: 0 })), configured: false };
  }

  const regions = await Promise.all(SALARY_REGIONS.map((r) => regionSalary(t, r, appId, appKey)));
  return { title: t, regions, configured: true };
}
