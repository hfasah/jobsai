import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pages: number | null; ocrUsed: boolean }> {
  if (mimeType === "application/pdf") {
    try {
      const data = await pdfParse(buffer);
      const text = data.text?.trim() ?? "";
      const pages = data.numpages ?? null;

      if (text.length < 50) {
        return { text: "", pages, ocrUsed: false };
      }

      return { text, pages, ocrUsed: false };
    } catch {
      throw new Error("PDF_PARSE_FAILED");
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
