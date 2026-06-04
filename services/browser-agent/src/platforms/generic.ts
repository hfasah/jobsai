import { Page } from "playwright";
import type { ApplyProfile } from "../types";
import { fillIfExists, uploadFile } from "../utils";
import { handleCaptcha } from "../captcha";
import { answerLabeledQuestions } from "../answers";

// Heuristic selectors that cover many ATSes
const NAME_SEL   = 'input[name*="name"]:not([name*="company"]):not([name*="school"]):not([name*="user"]), input[id*="name"]:not([id*="company"])';
const EMAIL_SEL  = 'input[type="email"], input[name*="email"], input[id*="email"]';
const PHONE_SEL  = 'input[type="tel"], input[name*="phone"], input[id*="phone"]';
const RESUME_SEL = 'input[type="file"]';
const SUBMIT_SEL = 'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")';

export async function fillGeneric(
  page: Page,
  profile: ApplyProfile,
  resumePath: string,
  coverLetter: string
): Promise<{ ok: boolean; reason?: string }> {
  const captchaResult = await handleCaptcha(page, page.url());
  if (captchaResult && !captchaResult.ok) {
    return { ok: false, reason: captchaResult.reason };
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  await fillIfExists(page, 'input[id*="first"], input[name*="first"]', profile.first_name ?? "");
  await fillIfExists(page, 'input[id*="last"],  input[name*="last"]',  profile.last_name  ?? "");
  await fillIfExists(page, NAME_SEL,  fullName);
  await fillIfExists(page, EMAIL_SEL, profile.email   ?? "");
  await fillIfExists(page, PHONE_SEL, profile.phone   ?? "");

  await fillIfExists(page, 'input[name*="linkedin"], input[id*="linkedin"]', profile.linkedin_url ?? "");
  await fillIfExists(page, 'input[name*="website"],  input[id*="website"]',  profile.portfolio_url ?? profile.website_url ?? "");
  await fillIfExists(page, 'input[name*="github"], input[id*="github"]', profile.github_url ?? "");

  // Address
  await fillIfExists(page, 'input[name*="address"]:not([name*="email"]), input[id*="address"]:not([id*="email"])', profile.address_line1 ?? "");
  await fillIfExists(page, 'input[name*="city"], input[id*="city"]', profile.city ?? "");
  await fillIfExists(page, 'input[name*="zip"], input[name*="postal"], input[id*="zip"], input[id*="postal"]', profile.postal_code ?? "");
  await fillIfExists(page, 'input[name*="school"], input[name*="university"], input[id*="school"]', profile.university ?? "");

  // Eligibility + EEO dropdowns/radios (best-effort, label-matched).
  await answerLabeledQuestions(page, profile);

  // Cover letter in any textarea
  const textareas = page.locator('textarea');
  const count = await textareas.count();
  if (count > 0 && coverLetter) {
    await textareas.first().fill(coverLetter);
  }

  // Resume — first file input
  await uploadFile(page, RESUME_SEL, resumePath, "Resume");

  const submitBtn = page.locator(SUBMIT_SEL).first();
  if (await submitBtn.count() === 0) {
    return { ok: false, reason: "No submit button found" };
  }

  await submitBtn.click();

  try {
    await page.waitForNavigation({ timeout: 10_000, waitUntil: "domcontentloaded" });
    return { ok: true };
  } catch {
    return { ok: true }; // SPA may not navigate — assume success if no error
  }
}
