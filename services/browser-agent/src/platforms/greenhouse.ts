import { Page } from "playwright";
import type { ApplyProfile } from "../types";
import { fillIfExists, uploadFile, hasCaptcha } from "../utils";

// Greenhouse standard field selectors
const SEL = {
  firstName: 'input[id="first_name"], input[name="applicant[first_name]"]',
  lastName:  'input[id="last_name"],  input[name="applicant[last_name]"]',
  email:     'input[id="email"],      input[name="applicant[email]"]',
  phone:     'input[id="phone"],      input[name="applicant[phone]"]',
  resume:    'input[type="file"][name*="resume"], input[type="file"][id*="resume"]',
  linkedin:  'input[id*="linkedin"], input[name*="linkedin"]',
  website:   'input[id*="website"],  input[name*="website"]',
  coverLetter: 'textarea[id*="cover_letter"], textarea[name*="cover_letter"]',
  submit:    'input[type="submit"][value*="Submit"], button[type="submit"]',
};

export async function fillGreenhouse(
  page: Page,
  profile: ApplyProfile,
  resumePath: string,
  coverLetter: string
): Promise<{ ok: boolean; reason?: string }> {
  // Wait for the application form to appear
  try {
    await page.waitForSelector('form#application_form, form.application, #application_form', {
      timeout: 15_000,
    });
  } catch {
    return { ok: false, reason: "Greenhouse application form not found" };
  }

  // Bail early if there's a CAPTCHA — we can't solve it
  if (await hasCaptcha(page)) {
    return { ok: false, reason: "CAPTCHA detected — manual submission required" };
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  await fillIfExists(page, SEL.firstName, profile.first_name ?? "");
  await fillIfExists(page, SEL.lastName,  profile.last_name  ?? "");

  // Some boards use a single "name" field
  await fillIfExists(page, 'input[id="name"], input[name="applicant[name]"]', fullName);

  await fillIfExists(page, SEL.email,    profile.email   ?? "");
  await fillIfExists(page, SEL.phone,    profile.phone   ?? "");
  await fillIfExists(page, SEL.linkedin, profile.linkedin_url ?? "");
  await fillIfExists(page, SEL.website,  profile.portfolio_url ?? profile.website_url ?? "");
  await fillIfExists(page, SEL.coverLetter, coverLetter);

  // Resume file upload
  await uploadFile(page, SEL.resume, resumePath, "Resume");

  // Check for CAPTCHA again after filling (some load lazily)
  if (await hasCaptcha(page)) {
    return { ok: false, reason: "CAPTCHA appeared after form fill — manual submission required" };
  }

  // Submit
  const submitBtn = page.locator(SEL.submit).first();
  if (await submitBtn.count() === 0) {
    return { ok: false, reason: "Submit button not found" };
  }

  await submitBtn.click();

  // Wait for success indicator or error
  try {
    await page.waitForSelector(
      '.confirmation, .success, h1:has-text("Thank"), h2:has-text("Thank"), .application-confirmation',
      { timeout: 15_000 }
    );
    return { ok: true };
  } catch {
    // Check if still on the form (submit may have failed silently)
    const stillOnForm = await page.$('form#application_form, form.application');
    if (stillOnForm) return { ok: false, reason: "Form still present after submit — may have failed" };
    return { ok: true }; // page changed, assume success
  }
}
