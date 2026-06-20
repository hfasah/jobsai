// Renders a parsed resume profile to a real .docx buffer (used so generated /
// optimized resumes are downloadable — they have no uploaded source file).
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { ParsedJson, ParsedExperience } from "@/types/resume";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Optimized resumes carry a `bullets` array (added in save-version); fall back
// to splitting the joined `description` for resumes that only have that.
function expBullets(e: ParsedExperience): string[] {
  const raw = (e as ParsedExperience & { bullets?: unknown }).bullets;
  if (Array.isArray(raw)) return raw.map((b) => String(b).trim()).filter(Boolean);
  if (e.description) {
    return e.description
      .split("\n")
      .map((s) => s.replace(/^[•\-•]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

export async function renderResumeDocx(parsed: ParsedJson): Promise<Buffer> {
  const body: Paragraph[] = [];

  if (parsed.name) {
    body.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: parsed.name, bold: true })] }));
  }
  const contact = [parsed.email, parsed.phone, parsed.location].filter(Boolean).join("  •  ");
  if (contact) body.push(new Paragraph({ children: [new TextRun(contact)] }));
  if (parsed.headline) body.push(new Paragraph({ children: [new TextRun({ text: parsed.headline, italics: true })] }));

  if (parsed.summary) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Summary" }));
    body.push(new Paragraph({ children: [new TextRun(parsed.summary)] }));
  }

  const experience = parsed.experience ?? [];
  if (experience.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Experience" }));
    for (const e of experience) {
      const head = [e.title, e.company].filter(Boolean).join(" — ") || "Role";
      const dates = [e.start_date, e.is_current ? "Present" : e.end_date].filter(Boolean).join(" – ");
      body.push(
        new Paragraph({
          spacing: { before: 160 },
          children: [
            new TextRun({ text: head, bold: true }),
            ...(dates ? [new TextRun({ text: `   ${dates}`, italics: true })] : []),
          ],
        }),
      );
      for (const b of expBullets(e)) body.push(new Paragraph({ text: b, bullet: { level: 0 } }));
    }
  }

  const education = parsed.education ?? [];
  if (education.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Education" }));
    for (const ed of education) {
      const detail = [ed.degree, ed.field_of_study].filter(Boolean).join(", ");
      const line = [ed.school, detail].filter(Boolean).join(" — ") || "Education";
      body.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }

  const skills = (parsed.skills ?? []).map((s) => s.skill).filter(Boolean);
  if (skills.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Skills" }));
    body.push(new Paragraph({ children: [new TextRun(skills.join(", "))] }));
  }

  const doc = new Document({ sections: [{ children: body }] });
  return Packer.toBuffer(doc);
}
