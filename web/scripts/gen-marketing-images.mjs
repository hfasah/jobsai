// Generate marketing images for the AIImageSlot slots via OpenAI gpt-image-1.
// Usage:
//   node --env-file=.env.local scripts/gen-marketing-images.mjs [filter]
// filter = substring of the output path (e.g. "auto-apply" or "home"); omit to do all.
import OpenAI from "openai";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PUBLIC = join(process.cwd(), "public");

// Shared style so the whole set feels like one brand system.
const STYLE =
  "High-end SaaS marketing image. Deep dark background with a purple-to-magenta gradient glow, " +
  "cinematic soft studio lighting, subtle bokeh, premium and modern. Photorealistic where people appear. " +
  "Absolutely no text, no UI text, no logos, no watermarks, no brand names. Clean negative space.";

const person = (scene) =>
  `${scene} Photorealistic, diverse, genuine expression, sharp focus on the subject. ${STYLE}`;
const concept = (scene) =>
  `${scene} Sleek 3D conceptual product visual, glassy materials, glowing accents. ${STYLE}`;

// path is relative to /public. size: gpt-image-1 supports 1024x1024 | 1024x1536 | 1536x1024.
const SLOTS = [
  // ── Home ──
  { path: "/marketing/product-overview.webp", size: "1536x1024",
    prompt: concept("A floating modern laptop seen at a dynamic angle, screen emitting a bright purple glow, surrounded by abstract floating cards, charts and checkmarks representing an automated job-application pipeline.") },
  { path: "/marketing/community-lifestyle.webp", size: "1536x1024",
    prompt: person("A bright collage-feel scene of several diverse young professionals celebrating new jobs — smiling, on laptops and video calls, confident and happy, in modern home-office settings.") },

  // ── Apply on autopilot ──
  { path: "/marketing/features/auto-apply.webp", size: "1536x1024",
    prompt: person("A surprised, delighted woman in a smart-casual blazer holding a modern laptop toward the camera, the screen glowing purple, as if amazed her job applications are being sent automatically.") },
  { path: "/marketing/features/job-discovery.webp", size: "1536x1024",
    prompt: person("A focused young man at a sleek desk pointing at a glowing magnifying-glass hologram surfacing matched job opportunities around him.") },
  { path: "/marketing/features/approval-queue.webp", size: "1536x1024",
    prompt: person("A confident professional woman giving a thumbs up next to floating glowing approval checkmark cards.") },
  { path: "/marketing/features/application-tracker.webp", size: "1536x1024",
    prompt: concept("A glowing 3D kanban board floating in space with neat columns of cards moving from left to right, purple and magenta accents.") },
  { path: "/marketing/features/browser-extension.webp", size: "1536x1024",
    prompt: concept("A glossy 3D browser window with a glowing puzzle-piece extension icon snapping into place, purple glow.") },
  { path: "/marketing/features/anti-captcha.webp", size: "1536x1024",
    prompt: concept("A glowing 3D shield deflecting abstract captcha-grid puzzle blocks, secure and powerful, purple and magenta.") },
  { path: "/marketing/features/scheduled-discovery.webp", size: "1536x1024",
    prompt: concept("A floating 3D clock fused with a radar sweep discovering glowing job-opportunity dots on a dark purple field.") },

  // ── Resumes & documents ──
  { path: "/marketing/features/resume-parsing.webp", size: "1536x1024",
    prompt: concept("A paper resume document dissolving into glowing structured data fields and particles, purple glow.") },
  { path: "/marketing/features/resume-tailoring.webp", size: "1536x1024",
    prompt: person("A smiling professional reviewing a glowing resume hologram that is rewriting itself to match a job, purple ambient light.") },
  { path: "/marketing/features/resume-templates.webp", size: "1536x1024",
    prompt: concept("Several elegant 3D resume template cards fanned out and floating, clean and premium, purple-magenta lighting.") },
  { path: "/marketing/features/ats-scanner.webp", size: "1536x1024",
    prompt: concept("A glowing circular score gauge reading high, with a resume document being scanned by a sweeping light beam, purple accents.") },
  { path: "/marketing/features/cover-letters.webp", size: "1536x1024",
    prompt: concept("A glowing 3D envelope and letter with a sparkle of AI, elegant, purple and magenta gradient background.") },
  { path: "/marketing/features/resume-translator.webp", size: "1536x1024",
    prompt: concept("A glowing globe surrounded by floating speech bubbles in many languages around a resume document, purple glow.") },
  { path: "/marketing/features/linkedin-import.webp", size: "1536x1024",
    prompt: concept("A glowing professional profile card flowing as particles into an app, an import arrow motif, purple-magenta.") },
  { path: "/marketing/features/follow-up-emails.webp", size: "1536x1024",
    prompt: concept("A glowing 3D envelope with a checkmark taking flight, a sense of a perfectly-timed follow-up, purple glow.") },

  // ── Matching & intelligence ──
  { path: "/marketing/features/job-matching.webp", size: "1536x1024",
    prompt: concept("Two glowing puzzle halves — a candidate profile and a job — clicking together with a bright match spark, purple-magenta.") },
  { path: "/marketing/features/keyword-gaps.webp", size: "1536x1024",
    prompt: concept("A glowing checklist hologram highlighting missing keyword chips lighting up one by one, purple accents.") },
  { path: "/marketing/features/salary-intel.webp", size: "1536x1024",
    prompt: person("A confident professional studying a glowing upward salary range chart hologram, optimistic, purple ambient light.") },
  { path: "/marketing/features/skills-gap.webp", size: "1536x1024",
    prompt: concept("A glowing radar/spider skills chart with a clear gap segment highlighted, growth arrows, purple-magenta.") },
  { path: "/marketing/features/company-research.webp", size: "1536x1024",
    prompt: concept("A sleek 3D office building hologram surrounded by floating insight cards and a magnifier, purple glow.") },

  // ── Interview suite ──
  { path: "/marketing/features/interview-buddy.webp", size: "1536x1024",
    prompt: person("A calm, confident person in a video interview on a laptop, a subtle glowing assistant halo beside them suggesting real-time help, purple ambient light.") },
  { path: "/marketing/features/written-coach.webp", size: "1536x1024",
    prompt: person("A focused person typing answers on a laptop with glowing chat feedback bubbles and a score appearing, purple glow.") },
  { path: "/marketing/features/voice-interviewer.webp", size: "1536x1024",
    prompt: person("A person speaking confidently with a glowing voice-waveform orb in front of them, mock interview vibe, purple-magenta.") },
  { path: "/marketing/features/avatar-room.webp", size: "1536x1024",
    prompt: person("A person facing a realistic AI video-interviewer avatar on a large screen, eye contact, professional, purple ambient light.") },
  { path: "/marketing/features/mock-interview.webp", size: "1536x1024",
    prompt: person("A prepared professional rehearsing answers, glowing question cards and a feedback score floating nearby, purple glow.") },
  { path: "/marketing/features/analytics.webp", size: "1536x1024",
    prompt: concept("Floating glowing 3D charts — response rate, interview rate, trend lines — clean dashboard-of-light, purple-magenta.") },
  { path: "/marketing/features/notifications.webp", size: "1536x1024",
    prompt: concept("A glowing 3D bell with notification badges and small alert cards popping out, energetic, purple glow.") },
];

const filter = process.argv[2];
const todo = filter ? SLOTS.filter((s) => s.path.includes(filter)) : SLOTS;

console.log(`Generating ${todo.length} image(s)${filter ? ` matching "${filter}"` : ""}…`);

let ok = 0, fail = 0;
for (const slot of todo) {
  const outFile = join(PUBLIC, slot.path);
  try {
    const res = await openai.images.generate({
      model: "gpt-image-1",
      prompt: slot.prompt,
      size: slot.size,
      quality: "medium",
      n: 1,
    });
    const b64 = res.data[0].b64_json;
    await mkdir(dirname(outFile), { recursive: true });
    // gpt-image-1 returns PNG; encode to optimized WebP to keep the repo light.
    await sharp(Buffer.from(b64, "base64")).webp({ quality: 82 }).toFile(outFile);
    ok++;
    console.log(`✓ ${slot.path}`);
  } catch (err) {
    fail++;
    console.error(`✗ ${slot.path} — ${err?.message ?? err}`);
  }
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
