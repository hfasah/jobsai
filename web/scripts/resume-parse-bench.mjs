#!/usr/bin/env node
/**
 * Resume-parse model benchmark — latency + extraction quality.
 *
 * Compares candidate models for the consumer resume-parse path (currently
 * pinned to the slow gpt-4-turbo) using the REAL parser system prompt.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/resume-parse-bench.mjs
 *
 * Needs OPENAI_API_KEY for the gpt-* models and DEEPSEEK_API_KEY for deepseek.
 * Models whose provider key is missing are skipped (so you can run a partial
 * comparison). Per-model parsed JSON is written to /tmp/parse-bench/<label>.json
 * for eyeball diffing.
 */
import OpenAI from "openai";
import { writeFileSync, mkdirSync } from "node:fs";

const RUNS = Number(process.env.BENCH_RUNS || 3);

// Exact copy of src/lib/resume-parser.ts SYSTEM_PROMPT.
const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from the resume text provided.
Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "headline": "string or null",
  "summary": "string or null",
  "links": { "linkedin": "url", "github": "url", "portfolio": "url" },
  "years_experience": number or null,
  "experience": [
    {
      "title": "string",
      "company": "string",
      "employment_type": "full-time|part-time|contract|internship|freelance or null",
      "location": "string or null",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "is_current": boolean,
      "description": "string or null"
    }
  ],
  "education": [
    {
      "school": "string",
      "degree": "string or null",
      "field_of_study": "string or null",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "grade": "string or null",
      "description": "string or null"
    }
  ],
  "skills": [
    { "skill": "string", "category": "technical|soft|language|tool|framework|other", "confidence": 0-100 }
  ],
  "certifications": ["string"],
  "languages": ["string"],
  "confidence": {
    "contact": 0-1,
    "experience": 0-1,
    "education": 0-1,
    "skills": 0-1
  },
  "warnings": ["string"]
}

Rules:
- Normalize dates to YYYY-MM format; use null if unknown
- Set is_current=true if the role has no end date and appears to be ongoing
- Estimate years_experience from work history if not stated
- If a section is missing entirely, return an empty array [] or null
- Add warnings for: missing contact info, image-only content, unreadable sections`;

// Realistic, mildly messy resume: 3 roles, varied date formats (to test the
// YYYY-MM normalization rule), skills + education + certs + languages.
const RESUME = `MARIA SANTOS
maria.santos.dev@gmail.com · +1 (415) 555-7788 · San Francisco, CA
linkedin.com/in/mariasantosdev · github.com/msantos

Senior Full-Stack Engineer with 8+ years building consumer SaaS at scale.

EXPERIENCE

Lyra Health — Staff Software Engineer
San Francisco, CA | March 2021 - Present
- Lead a 6-engineer team owning the patient-matching platform serving 4M members.
- Cut p95 API latency from 800ms to 210ms by introducing read replicas and caching.
- Drove adoption of feature flags, reducing failed releases by 35%.

Plaid — Senior Software Engineer
Remote | Jun 2018 – Feb 2021
- Built the transactions enrichment service processing 2M events/day.
- Migrated legacy cron jobs to Temporal, cutting on-call pages in half.

Stripe — Software Engineer (Contract)
San Francisco | 08/2016 to 05/2018
- Shipped the first version of the Radar rules UI used by 10k+ merchants.

EDUCATION
University of California, Berkeley — B.S. Electrical Engineering & Computer Science, 2012 - 2016, GPA 3.8

SKILLS
TypeScript, React, Node.js, Go, PostgreSQL, Redis, Kafka, AWS, Terraform, Docker, GraphQL, leadership, mentoring

CERTIFICATIONS
AWS Certified Solutions Architect – Professional (2022)

LANGUAGES
English (native), Spanish (fluent), Portuguese (conversational)`;

const MODELS = [
  { label: "gpt-4-turbo (current)", provider: "openai", model: "gpt-4-turbo" },
  { label: "gpt-4o", provider: "openai", model: "gpt-4o" },
  { label: "gpt-4o-mini", provider: "openai", model: "gpt-4o-mini" },
  { label: "deepseek-chat", provider: "deepseek", model: "deepseek-chat" },
];

function client(provider) {
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_API_KEY
      ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" })
      : null;
  }
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}

async function oneCall(c, model) {
  const t = Date.now();
  const resp = await c.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: RESUME },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  }, { timeout: 90 * 1000 });
  return { ms: Date.now() - t, content: resp.choices?.[0]?.message?.content, usage: resp.usage };
}

const isYYYYMM = (s) => typeof s === "string" && /^\d{4}-\d{2}$/.test(s);

function quality(parsed) {
  const exp = Array.isArray(parsed.experience) ? parsed.experience : [];
  const dates = exp.flatMap((e) => [e.start_date, e.end_date]).filter((d) => d != null && d !== "");
  const normalized = dates.length ? dates.filter(isYYYYMM).length / dates.length : 0;
  const current = exp.find((e) => e.is_current === true);
  return {
    exp: exp.length,
    skills: Array.isArray(parsed.skills) ? parsed.skills.length : 0,
    edu: Array.isArray(parsed.education) ? parsed.education.length : 0,
    certs: Array.isArray(parsed.certifications) ? parsed.certifications.length : 0,
    langs: Array.isArray(parsed.languages) ? parsed.languages.length : 0,
    yrs: parsed.years_experience ?? "—",
    datesNorm: `${Math.round(normalized * 100)}%`,
    currentRole: current ? "✓" : "✗",
    email: parsed.email ? "✓" : "✗",
  };
}

async function main() {
  mkdirSync("/tmp/parse-bench", { recursive: true });
  const rows = [];
  for (const m of MODELS) {
    const c = client(m.provider);
    if (!c) { rows.push({ ...m, skip: `no ${m.provider} key` }); continue; }
    const times = [];
    let last = null, err = null;
    for (let i = 0; i < RUNS; i++) {
      try {
        const r = await oneCall(c, m.model);
        times.push(r.ms);
        last = r;
      } catch (e) { err = e?.message || String(e); break; }
    }
    if (err) { rows.push({ ...m, error: err }); continue; }
    let parsed = null, valid = true;
    try { parsed = JSON.parse(last.content ?? "{}"); } catch { valid = false; }
    if (parsed) writeFileSync(`/tmp/parse-bench/${m.label.split(" ")[0]}.json`, JSON.stringify(parsed, null, 2));
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    rows.push({ ...m, avg, min: Math.min(...times), max: Math.max(...times), valid, q: parsed ? quality(parsed) : null, usage: last.usage });
  }

  console.log(`\nResume-parse benchmark — ${RUNS} runs/model, real parser prompt\n${"═".repeat(78)}`);
  for (const r of rows) {
    console.log(`\n▸ ${r.label}  [${r.model}]`);
    if (r.skip) { console.log(`    skipped: ${r.skip}`); continue; }
    if (r.error) { console.log(`    ERROR: ${r.error}`); continue; }
    console.log(`    latency:  avg ${r.avg}ms  (min ${r.min} / max ${r.max})   valid JSON: ${r.valid ? "✓" : "✗"}`);
    if (r.q) {
      const q = r.q;
      console.log(`    extracted: exp=${q.exp} skills=${q.skills} edu=${q.edu} certs=${q.certs} langs=${q.langs}  yrs=${q.yrs}`);
      console.log(`    quality:   email=${q.email}  current-role=${q.currentRole}  dates→YYYY-MM=${q.datesNorm}`);
    }
    if (r.usage) console.log(`    tokens:    prompt=${r.usage.prompt_tokens} completion=${r.usage.completion_tokens}`);
  }
  console.log(`\nGround truth for this resume: exp=3, edu=1, certs=1, langs=3, current-role on Lyra, dates all normalizable.`);
  console.log(`Per-model JSON dumped to /tmp/parse-bench/*.json — diff them to compare extraction.\n`);
}

main();
