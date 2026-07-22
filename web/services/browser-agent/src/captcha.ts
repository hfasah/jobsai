import https from "https";
import { Page } from "playwright";

// ─── Types ────────────────────────────────────────────────────────────────────

type CaptchaType = "recaptcha_v2" | "recaptcha_v3" | "hcaptcha";

export interface CaptchaInfo {
  type: CaptchaType;
  siteKey: string;
}

interface CapsolverTask {
  type: string;
  websiteURL: string;
  websiteKey: string;
  pageAction?: string;
}

interface CapsolverCreateResponse {
  errorId: number;
  errorCode?: string;
  errorDescription?: string;
  taskId?: string;
}

interface CapsolverResultResponse {
  errorId: number;
  status: "idle" | "processing" | "ready" | "failed";
  solution?: { gRecaptchaResponse?: string };
  errorCode?: string;
}

// ─── HTTP helper (no extra deps — uses built-in https) ────────────────────────

function postJson<T>(url: string, body: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    };
    const req = https.request(url, opts, (res) => {
      let data = "";
      res.on("data", (chunk: string) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data) as T); }
        catch { reject(new Error(`Non-JSON response: ${data.slice(0, 200)}`)); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── Detection ────────────────────────────────────────────────────────────────

export async function detectCaptcha(page: Page): Promise<CaptchaInfo | null> {
  // hCaptcha
  const hcaptchaFrame = await page.$('iframe[src*="hcaptcha"]');
  if (hcaptchaFrame) {
    const siteKey = await page.$eval(
      '.h-captcha, [data-hcaptcha-widget-id], iframe[src*="hcaptcha"]',
      (el: Element) => {
        const src = (el as HTMLIFrameElement).src ?? "";
        const m = src.match(/sitekey=([^&]+)/);
        if (m) return m[1];
        return (el as HTMLElement).dataset?.sitekey ?? null;
      }
    ).catch(() => null);
    if (siteKey) return { type: "hcaptcha", siteKey };
  }

  const hWidget = await page.$('.h-captcha[data-sitekey]');
  if (hWidget) {
    const siteKey = await hWidget.getAttribute("data-sitekey");
    if (siteKey) return { type: "hcaptcha", siteKey };
  }

  // reCAPTCHA
  const rcFrame = await page.$('iframe[src*="recaptcha"]');
  if (rcFrame) {
    const siteKey = await page.$eval(
      '.g-recaptcha[data-sitekey], [data-sitekey]',
      (el: Element) => (el as HTMLElement).dataset?.sitekey ?? null
    ).catch(async () => {
      // Try extracting from iframe src
      const src = await rcFrame.getAttribute("src") ?? "";
      const m = src.match(/[?&]k=([^&]+)/);
      return m ? m[1] : null;
    });
    if (siteKey) return { type: "recaptcha_v2", siteKey };
  }

  const rcWidget = await page.$('.g-recaptcha[data-sitekey]');
  if (rcWidget) {
    const siteKey = await rcWidget.getAttribute("data-sitekey");
    if (siteKey) return { type: "recaptcha_v2", siteKey };
  }

  return null;
}

// ─── CapSolver API ────────────────────────────────────────────────────────────

async function createTask(apiKey: string, task: CapsolverTask): Promise<string> {
  const res = await postJson<CapsolverCreateResponse>(
    "https://api.capsolver.com/createTask",
    { clientKey: apiKey, task }
  );
  if (res.errorId !== 0 || !res.taskId) {
    throw new Error(`CapSolver createTask error: ${res.errorCode ?? res.errorDescription ?? "unknown"}`);
  }
  return res.taskId;
}

async function pollTaskResult(
  apiKey: string,
  taskId: string,
  timeoutMs = 120_000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3_000));
    const res = await postJson<CapsolverResultResponse>(
      "https://api.capsolver.com/getTaskResult",
      { clientKey: apiKey, taskId }
    );
    if (res.errorId !== 0 || res.status === "failed") {
      throw new Error(`CapSolver task failed: ${res.errorCode ?? "unknown"}`);
    }
    if (res.status === "ready") {
      const token = res.solution?.gRecaptchaResponse;
      if (!token) throw new Error("CapSolver returned ready but no token");
      return token;
    }
  }
  throw new Error("CapSolver timed out after 120s");
}

// ─── Token injection ──────────────────────────────────────────────────────────

async function injectToken(page: Page, type: CaptchaType, token: string): Promise<void> {
  if (type === "hcaptcha") {
    await page.evaluate((t: string) => {
      document.querySelectorAll<HTMLTextAreaElement>('[name="h-captcha-response"]')
        .forEach((el) => { el.value = t; });
      document.querySelectorAll<HTMLTextAreaElement>('[name="g-recaptcha-response"]')
        .forEach((el) => { el.value = t; });
      // Trigger hCaptcha callback if registered
      try {
        const widget = document.querySelector<HTMLElement>('[data-callback]');
        const cbName = widget?.getAttribute("data-callback");
        if (cbName && typeof (window as unknown as Record<string, unknown>)[cbName] === "function") {
          ((window as unknown as Record<string, unknown>)[cbName] as (t: string) => void)(t);
        }
      } catch { /* ignore */ }
    }, token);
    return;
  }

  // reCAPTCHA v2 / v3
  await page.evaluate((t: string) => {
    // Set the hidden textarea
    const textarea = document.querySelector<HTMLTextAreaElement>("#g-recaptcha-response");
    if (textarea) {
      textarea.style.display = "";
      textarea.value = t;
      textarea.innerHTML = t;
    }
    // Fire the widget callback if data-callback is set
    try {
      const widget = document.querySelector<HTMLElement>(".g-recaptcha");
      const cbName = widget?.getAttribute("data-callback");
      if (cbName && typeof (window as unknown as Record<string, unknown>)[cbName] === "function") {
        ((window as unknown as Record<string, unknown>)[cbName] as (t: string) => void)(t);
        return;
      }
    } catch { /* ignore */ }
    // Fallback: walk grecaptcha internal clients map
    try {
      const w = window as { ___grecaptcha_cfg?: { clients?: Record<string, unknown> } };
      const cfg = w.___grecaptcha_cfg;
      if (cfg?.clients) {
        const clientId = Object.keys(cfg.clients)[0];
        const client = cfg.clients[clientId] as Record<string, unknown>;
        const cbKey = Object.keys(client).find((k) => {
          const v = client[k] as Record<string, unknown> | null;
          return typeof v?.callback === "function";
        });
        if (cbKey) {
          const slot = client[cbKey] as { callback?: (t: string) => void };
          slot.callback?.(t);
        }
      }
    } catch { /* ignore */ }
  }, token);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Detect and solve any CAPTCHA on the page using CapSolver.
 * Returns null if no CAPTCHA found.
 * Returns { ok: false, reason } if CAPSOLVER_API_KEY not set or solving fails.
 * Returns { ok: true } if solved and token injected.
 */
export async function handleCaptcha(
  page: Page,
  pageUrl: string
): Promise<{ ok: boolean; reason?: string } | null> {
  const info = await detectCaptcha(page);
  if (!info) return null; // no captcha — caller proceeds normally

  const apiKey = process.env.CAPSOLVER_API_KEY ?? "";
  if (!apiKey) {
    return { ok: false, reason: "CAPTCHA detected — set CAPSOLVER_API_KEY to enable auto-solving" };
  }

  console.log(`[captcha] Detected ${info.type} sitekey=${info.siteKey.slice(0, 12)}… solving via CapSolver`);

  try {
    const taskTypeMap: Record<CaptchaType, string> = {
      recaptcha_v2: "ReCaptchaV2TaskProxyless",
      recaptcha_v3: "ReCaptchaV3TaskProxyless",
      hcaptcha:     "HCaptchaTaskProxyless",
    };

    const task: CapsolverTask = {
      type: taskTypeMap[info.type],
      websiteURL: pageUrl,
      websiteKey: info.siteKey,
      ...(info.type === "recaptcha_v3" ? { pageAction: "submit" } : {}),
    };

    const taskId = await createTask(apiKey, task);
    console.log(`[captcha] Task created: ${taskId}`);

    const token = await pollTaskResult(apiKey, taskId);
    console.log(`[captcha] Solved — injecting token`);

    await injectToken(page, info.type, token);

    // Small pause to let the form react to the injected token
    await page.waitForTimeout(1_000);

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "CAPTCHA solving failed";
    console.error(`[captcha] Error: ${reason}`);
    return { ok: false, reason: `CAPTCHA solving failed: ${reason}` };
  }
}
