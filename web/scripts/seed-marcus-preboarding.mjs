import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jq = (m) => JSON.parse(m.choices[0].message.content);

async function main() {
  const { data: app } = await sb.from("enterprise_applications")
    .select("id, job_id, org_id, stage").eq("candidate_email", "marcus.bell@example.com").maybeSingle();
  if (!app) { console.log("Marcus not found"); return; }

  // Ensure he's at Offer
  await sb.from("enterprise_applications").update({ stage: "offer" }).eq("id", app.id);

  // 1. Onboarding hub — start in 2 weeks, in progress
  const start = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  await sb.from("enterprise_onboarding").upsert({
    application_id: app.id, org_id: app.org_id, job_id: app.job_id,
    start_date: start, status: "in_progress",
    offer_accepted_at: new Date().toISOString(),
    notes: "Offer accepted. Laptop ordered. Awaiting signed contract + reference completion.",
    updated_at: new Date().toISOString(),
  }, { onConflict: "application_id" });
  console.log("✓ Onboarding — start", start);

  // 2. Reference #1 — completed with AI summary (manager)
  const q1 = [
    { id: "q1", question: "In what capacity did you work with Marcus, and for how long?" },
    { id: "q2", question: "What were Marcus's key strengths as a salesperson?" },
    { id: "q3", question: "What areas could Marcus develop further?" },
    { id: "q4", question: "How reliable and professional was Marcus?" },
    { id: "q5", question: "Would you rehire Marcus? Why?" },
    { id: "q6", question: "Anything else we should know?" },
  ];
  const r1 = [
    { question: q1[0].question, answer: "I was Marcus's direct sales manager at Brightflow for 3 years." },
    { question: q1[1].question, answer: "Exceptional at discovery and multi-stakeholder negotiation. Consistently top 2 on the team, 142% of quota last year." },
    { question: q1[2].question, answer: "Occasionally over-invested in large deals early on; he's since fixed this with stronger pipeline discipline." },
    { question: q1[3].question, answer: "Extremely reliable. Never missed a forecast commitment in his final two years. Great CRM hygiene." },
    { question: q1[4].question, answer: "Absolutely — I'd rehire him in a heartbeat. He raises the bar for the whole team." },
    { question: q1[5].question, answer: "He's coachable and genuinely well-liked. A culture-add, not just a culture-fit." },
  ];
  const sum1 = jq(await ai.chat.completions.create({
    model: "gpt-4o-mini", max_tokens: 400, response_format: { type: "json_object" },
    messages: [{ role: "user", content: `Summarize this reference from Marcus's former manager.\n${r1.map(r=>`Q: ${r.question}\nA: ${r.answer}`).join("\n\n")}\nReturn JSON: {summary, sentiment:"positive|mixed|negative", recommendation:"strong_yes|yes|maybe|no"}` }],
  }));
  await sb.from("enterprise_references").insert({
    application_id: app.id, job_id: app.job_id, org_id: app.org_id,
    referee_name: "Sandra Mitchell", referee_email: "sandra.mitchell@brightflow.example",
    relationship: "Manager", company: "Brightflow",
    status: "completed", questions: q1, responses: r1,
    ai_summary: sum1.summary, ai_sentiment: sum1.sentiment, ai_recommendation: sum1.recommendation,
    completed_at: new Date().toISOString(), sent_at: new Date(Date.now()-3*86400000).toISOString(),
  });
  console.log("✓ Reference 1 (Sandra, manager) —", sum1.recommendation);

  // 3. Reference #2 — sent, awaiting (colleague)
  await sb.from("enterprise_references").insert({
    application_id: app.id, job_id: app.job_id, org_id: app.org_id,
    referee_name: "David Okafor", referee_email: "david.okafor@brightflow.example",
    relationship: "Colleague", company: "Brightflow",
    status: "sent", questions: q1, sent_at: new Date().toISOString(),
  });
  console.log("✓ Reference 2 (David, colleague) — awaiting");

  // 4. Background checks — standard set, mixed status
  const checks = [
    { check_type: "identity",      label: "Identity verification",                status: "clear",       provider: "Checkr" },
    { check_type: "right_to_work", label: "Right to work / work authorization",   status: "clear",       provider: "Checkr" },
    { check_type: "employment",    label: "Employment history verification",      status: "in_progress", provider: "Checkr" },
    { check_type: "education",     label: "Education verification",                status: "clear",       provider: "Checkr" },
    { check_type: "criminal",      label: "Criminal record check",                status: "clear",       provider: "Checkr" },
  ];
  await sb.from("enterprise_background_checks").insert(checks.map((c) => ({
    application_id: app.id, org_id: app.org_id, ...c,
    completed_at: c.status === "clear" ? new Date().toISOString() : null,
    result_summary: c.status === "clear" ? "No adverse findings." : null,
  })));
  console.log("✓ Background checks — 4 clear, 1 in progress");

  console.log("\n🎉 Marcus pre-boarding seeded.");
}

main().catch((e) => { console.error(e); process.exit(1); });
