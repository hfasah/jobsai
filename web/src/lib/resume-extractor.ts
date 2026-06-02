import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pages: number | null; ocrUsed: boolean }> {
  if (mimeType === "application/pdf") {
    let parser: PDFParse | null = null;
    try {
      // pdf-parse v2: class-based API — getText() returns { pages, text, total }
      parser = new PDFParse({ data: new Uint8Array(buffer) });
      const data = await parser.getText();
      const text = data.text?.trim() ?? "";
      const pages = data.total ?? null;

      if (text.length < 50) {
        // Likely a scanned/image-only PDF — no OCR fallback yet, return warning
        return { text: "", pages, ocrUsed: false };
      }

      return { text, pages, ocrUsed: false };
    } catch {
      throw new Error("PDF_PARSE_FAILED");
    } finally {
      await parser?.destroy().catch(() => {});
    }
  }

  if (
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value?.trim() ?? "", pages: null, ocrUsed: false };
    } catch {
      throw new Error("DOCX_PARSE_FAILED");
    }
  }

  throw new Error("UNSUPPORTED_TYPE");
}
