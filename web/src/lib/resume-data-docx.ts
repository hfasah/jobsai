// Client-side .docx generation from the exact ResumeData shown in the preview.
// Building from ResumeData (not the stored parsed_json) means the Word file
// matches what's on screen — including AI-tailored bullets, the full skills
// list, certifications, and education — for BOTH the saved-resume preview and
// the per-job tailored preview. Word and Google Docs both open .docx natively.
import type { ResumeData } from "@/components/resume/resume-preview-client";

function fmtDate(d?: string | null): string {
  if (!d) return "";
  const [y, m] = String(d).split("-");
  if (!m) return y ?? "";
  const month = new Date(`${y}-${m}-01`).toLocaleDateString("en-US", { month: "short" });
  return `${month} ${y}`;
}

function expDates(e: { start_date?: string | null; end_date?: string | null; is_current?: boolean }): string {
  const start = fmtDate(e.start_date);
  const end = e.is_current ? "Present" : fmtDate(e.end_date);
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

export async function buildResumeDocxBlob(d: ResumeData): Promise<Blob> {
  // Dynamic import keeps the ~heavy docx lib out of the initial bundle.
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const body: import("docx").Paragraph[] = [];

  if (d.name) {
    body.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: d.name, bold: true })] }));
  }
  if (d.headline) {
    body.push(new Paragraph({ children: [new TextRun({ text: d.headline, italics: true })] }));
  }
  const contact = [...d.contactParts, ...d.linkParts.map((l) => l.url)].filter(Boolean).join("   |   ");
  if (contact) body.push(new Paragraph({ children: [new TextRun(contact)] }));

  if (d.summary) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Summary" }));
    body.push(new Paragraph({ children: [new TextRun(d.summary)] }));
  }

  if (d.experience.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Experience" }));
    for (const e of d.experience) {
      const heading = [e.title, e.company].filter(Boolean).join(" | ");
      const dates = expDates(e);
      body.push(new Paragraph({
        children: [
          new TextRun({ text: heading, bold: true }),
          ...(dates ? [new TextRun({ text: `    ${dates}`, italics: true, color: "666666" })] : []),
        ],
      }));
      for (const b of e.bullets) body.push(new Paragraph({ text: b, bullet: { level: 0 } }));
    }
  }

  if (d.certifications.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Certifications" }));
    for (const c of d.certifications) body.push(new Paragraph({ text: c, bullet: { level: 0 } }));
  }

  if (d.education.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Education" }));
    for (const ed of d.education) {
      const detail = [ed.degree, ed.field_of_study].filter(Boolean).join(", ");
      const line = [ed.school, detail].filter(Boolean).join(" — ") || "Education";
      const dates = [fmtDate(ed.start_date), fmtDate(ed.end_date)].filter(Boolean).join(" – ");
      body.push(new Paragraph({
        children: [
          new TextRun({ text: line }),
          ...(dates ? [new TextRun({ text: `    ${dates}`, italics: true, color: "666666" })] : []),
        ],
      }));
    }
  }

  if (d.skills.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Skills" }));
    body.push(new Paragraph({ children: [new TextRun(d.skills.join(", "))] }));
  }

  const doc = new Document({ sections: [{ children: body }] });
  return Packer.toBlob(doc);
}

export async function downloadResumeDocx(d: ResumeData): Promise<void> {
  const blob = await buildResumeDocxBlob(d);
  const base = (d.name || "resume").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_") || "resume";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}_Resume.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
