import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { SEARCH_COUNTRIES } from "@/lib/job-search";

// Computes the "Profile Search" seed from the user's saved profile so the manual
// search casts the SAME wide net as auto-discovery: all their titles (OR'd),
// their country (from the Apply Profile, not a hardcoded US default), remote
// preference and job types. Keeps the derivation server-side so the client
// doesn't juggle two tables.

const EMP_MAP: Record<string, string> = { "full-time": "fulltime", contract: "contract", internship: "internship" };

function countryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const hit = SEARCH_COUNTRIES.find(
    (c) => c.code === n || c.label.toLowerCase() === n || c.label.toLowerCase().includes(n) || n.includes(c.label.toLowerCase()),
  );
  return hit?.code ?? null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: prefs }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("user_preferences").select("job_titles, primary_title, location_type, employment_types, locations").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("apply_profiles").select("country, city").eq("user_id", userId).maybeSingle(),
  ]);

  const titles: string[] = Array.isArray(prefs?.job_titles) ? prefs.job_titles.filter(Boolean) : [];
  const primary = typeof prefs?.primary_title === "string" && titles.includes(prefs.primary_title) ? prefs.primary_title : titles[0] ?? "";
  const remote = prefs?.location_type === "remote";
  const empTypes = [
    ...((Array.isArray(prefs?.employment_types) ? prefs.employment_types : []) as string[]).map((e) => EMP_MAP[e]).filter(Boolean),
    ...(prefs?.location_type === "hybrid" ? ["hybrid"] : []),
  ];

  // Country from the Apply Profile, then a country named in the preference
  // locations, else null (client keeps its current selection).
  const country =
    countryCode(profile?.country) ??
    (Array.isArray(prefs?.locations) ? prefs.locations.map(countryCode).find(Boolean) ?? null : null);

  return NextResponse.json({
    hasProfile: titles.length > 0,
    titles,          // the wide net (OR'd across all roles)
    primary,         // shown in the search box
    country,         // e.g. "ca" — null means keep current
    remote,
    employmentTypes: empTypes,
  });
}
