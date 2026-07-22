import fs from "fs";
import os from "os";
import path from "path";
import { Page } from "playwright";
import { detectCaptcha } from "./captcha";

export async function fillIfExists(page: Page, selector: string, value: string): Promise<void> {
  if (!value) return;
  try {
    const el = page.locator(selector).first();
    if (await el.count() === 0) return;
    await el.fill(value, { timeout: 3_000 });
  } catch {
    // Field may be hidden, read-only, or selector missed — skip silently
  }
}

export async function uploadFile(
  page: Page,
  selector: string,
  filePath: string,
  _label: string
): Promise<void> {
  try {
    const el = page.locator(selector).first();
    if (await el.count() === 0) return;
    await el.setInputFiles(filePath, { timeout: 5_000 });
  } catch {
    // File input may be hidden behind a custom button — skip
  }
}

export async function hasCaptcha(page: Page): Promise<boolean> {
  return (await detectCaptcha(page)) !== null;
}

// Write a base64-encoded file to a temp path and return the path
export function writeTempFile(base64: string, mime: string, filename: string): string {
  const ext = path.extname(filename) || (mime.includes("pdf") ? ".pdf" : ".docx");
  const tmpPath = path.join(os.tmpdir(), `resume_${Date.now()}${ext}`);
  fs.writeFileSync(tmpPath, Buffer.from(base64, "base64"));
  return tmpPath;
}

export function deleteTempFile(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}
