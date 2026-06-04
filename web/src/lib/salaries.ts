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

// Fallback FX → USD if the live feed is unavailable.
const FX_FALLBACK: Record<string, number> = { USD: 1, CAD: 0.73, GBP: 1.27, EUR: 1.08, PLN: 0.25 };

// Live FX → USD via Frankfurter (free, no key, ECB rates). Returns USD-per-unit
// for each currency; falls back to the static map on any failure.
async function getFxToUsd(): Promise<{ fx: Record<string, number>; live: boolean }> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=CAD,GBP,EUR,PLN", {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 3600 }, // refresh hourly
    });
    if (!res.ok) throw new Error(`FX ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    const r = data.rates ?? {};
    const inv = (x: number | undefined, fb: number) => (typeof x === "number" && x > 0 ? 1 / x : fb);
    return {
      live: true,
      fx: {
        USD: 1,
        CAD: inv(r.CAD, FX_FALLBACK.CAD),
        GBP: inv(r.GBP, FX_FALLBACK.GBP),
        EUR: inv(r.EUR, FX_FALLBACK.EUR),
        PLN: inv(r.PLN, FX_FALLBACK.PLN),
      },
    };
  } catch {
    return { fx: FX_FALLBACK, live: false };
  }
}

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
  fxLive: boolean;       // were live exchange rates used?
}

async function regionSalary(
  title: string, r: SalaryRegion, appId: string, appKey: string, fx: Record<string, number>
): Promise<RegionSalary> {
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
    const usd = mean != null ? Math.round(mean * (fx[r.currency] ?? 1)) : null;
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
    return { title: t, regions: SALARY_REGIONS.map((r) => ({ ...r, mean: null, usd: null, count: 0 })), configured: false, fxLive: false };
  }

  const { fx, live } = await getFxToUsd();
  const regions = await Promise.all(SALARY_REGIONS.map((r) => regionSalary(t, r, appId, appKey, fx)));
  return { title: t, regions, configured: true, fxLive: live };
}
