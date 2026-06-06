/**
 * Seeds a full Interview Intelligence demo into the Everybrain HR org:
 * job → AI scorecard → candidate w/ resume → AI screening (match + ATS) →
 * pre-interview HR briefing → post-interview scored report from a transcript.
 *
 * Run: node scripts/seed-enterprise-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ORG_ID = "137e64db-b9ae-4883-86f2-3731d6e1efa5"; // Everybrain HR
const USER_ID = "user_3EkYmj2miC5N0xJJAkZDqSD9tfV";
const ORG_NAME = "Everybrain HR";

const jq = (m) => JSON.parse(m.choices[0].message.content);

async function main() {
  // 1. Job ────────────────────────────────────────────────────────────────────
  const { data: job } = await sb.from("enterprise_jobs").insert({
    org_id: ORG_ID,
    title: "Account Executive (SaaS Sales)",
    department: "Sales",
    location: "Remote (US)",
    employment_type: "full-time",
    description: "We're hiring an Account Executive to own the full sales cycle for our B2B SaaS platform — from qualified pipeline to closed-won. You'll run discovery calls, demos, and negotiations with mid-market accounts.",
    responsibilities: "• Own the full sales cycle from discovery to close\n• Run product demos and tailored proposals\n• Manage a pipeline of 40+ mid-market opportunities\n• Hit and exceed quarterly quota\n• Partner with SDRs and Solutions Engineers",
    qualifications: "• 3+ years closing B2B SaaS deals\n• Track record of hitting quota\n• Strong discovery and negotiation skills\n• Experience with consultative selling\n• CRM discipline (Salesforce/HubSpot)",
    nice_to_have: "• MEDDIC or Challenger training\n• Experience selling to HR or RevOps buyers",
    salary_min: 70000, salary_max: 120000, salary_currency: "USD",
    status: "active", created_by: USER_ID, published_at: new Date().toISOString(),
  }).select("*").single();
  console.log("✓ Job:", job.title, job.id);

  // 2. AI Competency Framework ──────────────────────────────────────────────────
  const fwRes = await ai.chat.completions.create({
    model: "gpt-4o-mini", response_format: { type: "json_object" }, max_tokens: 1200,
    messages: [{ role: "system", content: `You are an HR competency architect. Classify the role (technical|sales|customer_service|management|healthcare|administrative|general) and build a custom weighted interview scorecard (5-7 competencies, integer weights summing to 100, ordered by weight desc). Return JSON: {role_type, role_type_label, competencies:[{name,weight,description,what_to_look_for}]}` },
      { role: "user", content: `Company: ${ORG_NAME}. Role: ${job.title}. ${job.description} Requirements: ${job.qualifications}` }],
  });
  const fw = jq(fwRes);
  const total = fw.competencies.reduce((s, c) => s + c.weight, 0) || 1;
  fw.competencies.forEach((c) => (c.weight = Math.round((c.weight / total) * 100)));
  await sb.from("enterprise_competency_frameworks").upsert({
    job_id: job.id, org_id: ORG_ID, role_type: fw.role_type, role_type_label: fw.role_type_label,
    competencies: fw.competencies, updated_at: new Date().toISOString(),
  }, { onConflict: "job_id" });
  console.log("✓ Scorecard:", fw.role_type_label, "—", fw.competencies.map((c) => `${c.name} ${c.weight}%`).join(", "));

  // 3. Candidate with resume ────────────────────────────────────────────────────
  const resume = `Marcus Bell — Account Executive
Email: marcus.bell@example.com | Phone: +1 415 555 0142 | LinkedIn: linkedin.com/in/marcusbell

SUMMARY
Quota-crushing B2B SaaS Account Executive with 5 years closing mid-market deals. 142% of quota in 2023 ($1.8M closed). MEDDIC-trained, consultative seller who thrives on discovery and complex negotiations.

EXPERIENCE
Account Executive — Brightflow (SaaS, 2021–present)
• Owned full cycle for mid-market accounts ($30k–$150k ACV); 142% of quota in 2023
• Built and managed a 45-opportunity pipeline in Salesforce with rigorous MEDDIC qualification
• Led discovery, demos, and multi-stakeholder negotiations; avg sales cycle cut from 95 to 68 days
• Partnered with SDRs and Solutions Engineers to win competitive displacements

Sales Development Rep — Brightflow (2019–2021)
• Booked 30+ qualified meetings/month; promoted to AE in 18 months

SKILLS: Consultative selling, MEDDIC, discovery, negotiation, Salesforce, HubSpot, objection handling`;

  const { data: app } = await sb.from("enterprise_applications").insert({
    job_id: job.id, org_id: ORG_ID,
    candidate_name: "Marcus Bell", candidate_email: "marcus.bell@example.com",
    candidate_phone: "+1 415 555 0142", linkedin_url: "https://linkedin.com/in/marcusbell",
    resume_text: resume, source: "linkedin", stage: "applied",
  }).select("*").single();
  console.log("✓ Candidate:", app.candidate_name);

  // 4. AI screening (match + ATS) ───────────────────────────────────────────────
  const scRes = await ai.chat.completions.create({
    model: "gpt-4o-mini", response_format: { type: "json_object" }, max_tokens: 800,
    messages: [{ role: "user", content: `Evaluate candidate for ${job.title}. Job: ${job.qualifications}\nCandidate: ${resume}\nReturn JSON: {match_score,skills_score,experience_score,culture_score,risk_flags:[],ai_summary,ai_recommendation:"strong_yes|yes|maybe|no",ats_score,ats_keywords_matched:[],ats_keywords_missing:[],ats_summary}` }],
  });
  const sc = jq(scRes);
  await sb.from("enterprise_applications").update({
    match_score: sc.match_score, skills_score: sc.skills_score, experience_score: sc.experience_score,
    culture_score: sc.culture_score, risk_flags: sc.risk_flags ?? [], ai_summary: sc.ai_summary,
    ai_recommendation: sc.ai_recommendation, ats_score: sc.ats_score,
    ats_keywords_matched: sc.ats_keywords_matched ?? [], ats_keywords_missing: sc.ats_keywords_missing ?? [],
    ats_summary: sc.ats_summary, screened_at: new Date().toISOString(), stage: "screened",
  }).eq("id", app.id);
  console.log(`✓ Screened — match ${sc.match_score}, ATS ${sc.ats_score}, rec ${sc.ai_recommendation}`);

  // 5. Pre-interview HR briefing ────────────────────────────────────────────────
  const compList = fw.competencies.map((c) => `- ${c.name} (${c.weight}%): ${c.what_to_look_for}`).join("\n");
  const preRes = await ai.chat.completions.create({
    model: "gpt-4o-mini", response_format: { type: "json_object" }, max_tokens: 1200,
    messages: [{ role: "user", content: `HR briefing TO HIRING MANAGER on why to interview this candidate.\nRole: ${job.title}\nScorecard:\n${compList}\nCandidate: ${resume}\nMatch ${sc.match_score}%. Return JSON: {overall_score,competency_scores:[{name,weight,score,evidence}],strengths:[],concerns:[],recommendation,summary}` }],
  });
  const pre = jq(preRes);
  await sb.from("enterprise_interview_reports").insert({
    application_id: app.id, job_id: job.id, org_id: ORG_ID, report_type: "pre_interview",
    round_name: "Pre-interview briefing", overall_score: pre.overall_score,
    competency_scores: pre.competency_scores ?? [], strengths: pre.strengths ?? [],
    concerns: pre.concerns ?? [], recommendation: pre.recommendation, summary: pre.summary, generated_by: USER_ID,
  });
  console.log(`✓ Pre-interview briefing — ${pre.overall_score}/100, ${pre.recommendation}`);

  // 6. Post-interview scored report from transcript ─────────────────────────────
  const transcript = `Interviewer: Walk me through a complex deal you closed.
Marcus: At Brightflow I was working a $140k displacement against an incumbent. Discovery showed their renewal was in 60 days but the economic buyer hadn't been engaged. I used MEDDIC to map the buying committee, got our SE to run a tailored ROI session, and reframed the conversation around risk of staying. I negotiated a 2-year deal at 8% uplift. Closed it 12 days before their renewal.
Interviewer: How do you handle a prospect who says you're too expensive?
Marcus: I never lead with discount. I go back to the metrics from discovery — the cost of the problem they told me about. If a prospect says we're too expensive, usually we haven't quantified value enough. I'll ask what they're comparing against and whether that alternative actually solves the same problem. Most of the time price drops out once value is clear.
Interviewer: Tell me about a time you missed quota.
Marcus: Q1 2022 I hit 78%. I'd over-relied on two big deals that slipped. The lesson was pipeline coverage — I now run 3.5x coverage minimum and never let two deals carry a quarter. The next two quarters I was back over 120%.
Interviewer: Why this role?
Marcus: I want to sell into HR and RevOps buyers, and I'm motivated by owning the full cycle in a fast-moving company. Your platform solves a real pain I've seen firsthand.`;

  const postRes = await ai.chat.completions.create({
    model: "gpt-4o-mini", response_format: { type: "json_object" }, max_tokens: 1800,
    messages: [{ role: "user", content: `Score this interview transcript against the scorecard.\nRole: ${job.title}\nScorecard:\n${compList}\nTranscript:\n${transcript}\nReturn JSON: {overall_score,competency_scores:[{name,weight,score,evidence}],strengths:[],concerns:[],recommendation,summary}` }],
  });
  const post = jq(postRes);
  await sb.from("enterprise_interview_reports").insert({
    application_id: app.id, job_id: job.id, org_id: ORG_ID, report_type: "post_interview",
    round_name: "First-round interview", transcript, overall_score: post.overall_score,
    competency_scores: post.competency_scores ?? [], strengths: post.strengths ?? [],
    concerns: post.concerns ?? [], recommendation: post.recommendation, summary: post.summary, generated_by: USER_ID,
  });
  await sb.from("enterprise_applications").update({ stage: "interview", match_score: Math.max(sc.match_score, post.overall_score) }).eq("id", app.id);
  console.log(`✓ Post-interview report — ${post.overall_score}/100, ${post.recommendation}`);

  console.log("\n🎉 Demo seeded. Open: /enterprise/jobs/" + job.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
