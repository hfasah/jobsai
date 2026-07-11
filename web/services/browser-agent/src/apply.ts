import { chromium } from "playwright";
import type { BrowserApplyRequest, BrowserApplyResponse } from "./types";
import { fillGreenhouse } from "./platforms/greenhouse";
import { fillGeneric } from "./platforms/generic";
import { writeTempFile, deleteTempFile } from "./utils";

const BROWSER_PLATFORMS = ["greenhouse", "workday", "smartrecruiters", "bamboohr", "icims", "unknown"];

export async function handleApply(req: BrowserApplyRequest): Promise<BrowserApplyResponse> {
  if (!BROWSER_PLATFORMS.includes(req.platform)) {
    return { status: "manual_required", message: `Platform ${req.platform} not handled by browser agent` };
  }

  // Write resume to temp file
  const resumePath = writeTempFile(req.resumeBase64, req.resumeMime, req.resumeFilename);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // Navigate to the job application URL
    await page.goto(req.sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // If there's an "Apply" button on the listing page, click it first
    try {
      const applyBtn = page.locator(
        'a:has-text("Apply now"), a:has-text("Apply for this job"), button:has-text("Apply")'
      ).first();
      if (await applyBtn.count() > 0) {
        await Promise.all([page.waitForNavigation({ timeout: 10_000 }), applyBtn.click()]);
      }
    } catch {
      // Already on the application form
    }

    let result: { ok: boolean; reason?: string };

    if (req.platform === "greenhouse") {
      result = await fillGreenhouse(page, req.profile, resumePath, req.coverLetter);
    } else {
      result = await fillGeneric(page, req.profile, resumePath, req.coverLetter);
    }

    return result.ok
      ? { status: "submitted" }
      : { status: "manual_required", message: result.reason };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Browser error";
    return { status: "failed", message: msg };
  } finally {
    await browser.close().catch(() => null);
    deleteTempFile(resumePath);
  }
}
