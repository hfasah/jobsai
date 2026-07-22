#!/usr/bin/env node
/**
 * DeepSeek JSON-mode eval for the resume-parse path.
 *
 * Purpose: before flipping any tier to DeepSeek in prod (see ai-client.ts /
 * AI_TIERS), confirm DeepSeek honors `response_format: { type: "json_object" }`
 * on the *actual* resume-parser prompt and returns parseable, schema-shaped
 * JSON. DeepSeek supports JSON mode but (a) requires the word "json" in the
 * prompt and (b) historically can emit empty/truncated bodies more often than
 * OpenAI — this script catches that.
 *
 * Usage (from web/):
 *   DEEPSEEK_API_KEY=sk-... node scripts/deepseek-json-eval.mjs
 *   # optional baseline side-by-side:
 *   DEEPSEEK_API_KEY=sk-... OPENAI_API_KEY=sk-... node scripts/deepseek-json-eval.mjs
 *
 * Exit code 0 = DeepSeek passed; 1 = failed (don't switch yet).
 */
import OpenAI from "openai";

// Faithful copy of src/lib/resume-parser.ts SYSTEM_PROMPT (trimmed schema is
// fine — the point is JSON-mode behavior, not full field coverage).
const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from the resume text provided.
Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "name": "string",
  "email": "string",
  "phone": "string",
  "title": "string",
  "summary": "string",
  "skills": ["string"],
  "experience": [
    { "company": "string", "title": "string", "start_date": "string", "end_date": "string", "bullets": ["string"] }
  ],
  "education": [
    { "school": "string", "degree": "string", "year": "string" }
  ]
}`;

const SAMPLE_RESUME = `Jordan Rivera
jordan.rivera@example.com | (555) 012-3456 | Austin, TX

Senior Data Engineer

Experienced data engineer who owned a high-throughput event pipeline.

EXPERIENCE
Acme Analytics — Senior Data Engineer (Jan 2021 - Present)
- Owned the ingestion pipeline processing 2M events/day; cut failed batches 40%.
- Migrated ETL from cron to Airflow, reducing on-call pages by half.

Globex — Data Engineer (Jun 2018 - Dec 2020)
- Built reporting models in dbt used by 30+ analysts.

EDUCATION
University of Texas — B.S. Computer Science, 2018

SKILLS
Python, SQL, Airflow, dbt, Snowflake, Kafka`;

const REQUIRED_KEYS = ["name", "email", "experience", "skills"];

async function run(label, client, model) {
  const started = Date.now();
  let resp;
  try {
    resp = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: SAMPLE_RESUME },
      ],
    });
  } catch (err) {
    return { label, model, ok: false, reason: `API error: ${err?.message || err}` };
  }
  const ms = Date.now() - started;
  const content = resp.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    return { label, model, ok: false, ms, reason: "empty response body" };
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return { label, model, ok: false, ms, reason: `not valid JSON: ${e.message}`, raw: content.slice(0, 200) };
  }
  const missing = REQUIRED_KEYS.filter((k) => !(k in parsed));
  const expOk = Array.isArray(parsed.experience) && parsed.experience.length >= 1;
  const ok = missing.length === 0 && expOk;
  return {
    label, model, ok, ms,
    reason: ok ? "valid JSON, schema-shaped"
      : `missing keys: [${missing.join(", ")}]${expOk ? "" : "; experience[] empty"}`,
    keys: Object.keys(parsed),
    experienceCount: Array.isArray(parsed.experience) ? parsed.experience.length : 0,
    usage: resp.usage,
  };
}

function report(r) {
  console.log(`\n── ${r.label} (${r.model}) ${"─".repeat(40)}`);
  console.log(`  result:     ${r.ok ? "PASS ✅" : "FAIL ❌"}  — ${r.reason}`);
  if (r.ms != null) console.log(`  latency:    ${r.ms} ms`);
  if (r.keys) console.log(`  top keys:   ${r.keys.join(", ")}`);
  if (r.experienceCount != null) console.log(`  experience: ${r.experienceCount} entries`);
  if (r.usage) console.log(`  tokens:     prompt=${r.usage.prompt_tokens} completion=${r.usage.completion_tokens}`);
  if (r.raw) console.log(`  raw[0:200]: ${r.raw}`);
}

async function main() {
  const dsKey = process.env.DEEPSEEK_API_KEY;
  if (!dsKey) {
    console.error("ERROR: set DEEPSEEK_API_KEY to run the eval.");
    process.exit(2);
  }

  const deepseek = new OpenAI({ apiKey: dsKey, baseURL: "https://api.deepseek.com" });
  const dsResult = await run("DeepSeek", deepseek, process.env.DEEPSEEK_MODEL || "deepseek-chat");
  report(dsResult);

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    report(await run("OpenAI baseline", openai, process.env.OPENAI_MODEL || "gpt-4o"));
  } else {
    console.log("\n(no OPENAI_API_KEY set — skipping side-by-side baseline)");
  }

  console.log(`\n${dsResult.ok ? "DeepSeek JSON mode looks good on this path." : "DeepSeek FAILED — do not switch this tier yet."}`);
  process.exit(dsResult.ok ? 0 : 1);
}

main();
