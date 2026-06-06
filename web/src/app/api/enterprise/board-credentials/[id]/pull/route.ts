import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

export const maxDuration = 45;

// Lightweight, dependency-free job-feed parser. Handles the common aggregator
// formats: <source><job>…</job></source> and RSS/Atom <item>…</item>.
function tag(block: string, ...names: string[]): string | null {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, "i"));
    if (m) {
      let v = m[1].trim();
      const cdata = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdata) v = cdata[1];
      return v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

function parseJobs(xml: string) {
  const blocks = xml.match(/<job[\s>][\s\S]*?<\/job>/gi) ?? xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return blocks.map((b) => ({
    title: tag(b, "title", "jobtitle"),
    location: tag(b, "city", "location") ?? "",
    state: tag(b, "state", "region"),
    department: tag(b, "category", "department", "function"),
    employment_type: tag(b, "jobtype", "employmenttype", "type"),
    description: tag(b, "description", "summary", "content", "content:encoded"),
    salary: tag(b, "salary"),
    external_id: tag(b, "referencenumber", "reference", "guid", "id"),
  })).filter((j) => j.title);
}

const TYPE_MAP: Record<string, string> = {
  fulltime: "full-time", "full-time": "full-time", parttime: "part-time", "part-time": "part-time",
  contract: "contract", contractor: "contract", intern: "internship", internship: "internship",
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: cred } = await supabaseAdmin
    .from("enterprise_board_credentials").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!cred) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  if (!cred.feed_url) return NextResponse.json({ error: "No feed URL configured for this board." }, { status: 400 });
  if (!["pull", "both"].includes(cred.direction)) return NextResponse.json({ error: "This connection is not set to pull." }, { status: 400 });

  let xml = "";
  try {
    const headers: Record<string, string> = {};
    if (cred.api_key) headers["Authorization"] = `Bearer ${cred.api_key}`;
    const res = await fetch(cred.feed_url, { headers });
    if (!res.ok) return NextResponse.json({ error: `Feed returned ${res.status}.` }, { status: 502 });
    xml = await res.text();
  } catch {
    return NextResponse.json({ error: "Could not reach the feed URL." }, { status: 502 });
  }

  const parsed = parseJobs(xml);
  if (!parsed.length) return NextResponse.json({ error: "No jobs found in the feed (unsupported format?)." }, { status: 422 });

  // Avoid re-importing the same external jobs (dedupe by title+location for this org+board)
  const { data: existing } = await supabaseAdmin
    .from("enterprise_jobs").select("title, location").eq("org_id", org.id);
  const seen = new Set((existing ?? []).map((j) => `${j.title}|${j.location ?? ""}`.toLowerCase()));

  let imported = 0;
  for (const j of parsed.slice(0, 100)) {
    const loc = [j.location, j.state].filter(Boolean).join(", ");
    const key = `${j.title}|${loc}`.toLowerCase();
    if (seen.has(key)) continue;
    const { error } = await supabaseAdmin.from("enterprise_jobs").insert({
      org_id: org.id,
      title: j.title!,
      location: loc || null,
      department: j.department || null,
      employment_type: TYPE_MAP[(j.employment_type ?? "").toLowerCase()] ?? "full-time",
      description: j.description || null,
      status: "active",
      created_by: userId,
      published_at: new Date().toISOString(),
    });
    if (!error) { imported++; seen.add(key); }
  }

  await supabaseAdmin.from("enterprise_board_credentials")
    .update({ last_sync: new Date().toISOString(), jobs_imported: (cred.jobs_imported ?? 0) + imported })
    .eq("id", id);
  await audit({ org_id: org.id, user_id: userId, action: "integration.synced", metadata: { board: cred.board, imported } });

  return NextResponse.json({ ok: true, found: parsed.length, imported });
}
