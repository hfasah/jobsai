// JobsAI — For LinkedIn · background service worker (MV3)
//
// Responsibilities:
//   • Hold the user's JobsAI extension API key (handed over by jobsai.work via
//     externally_connectable, or pasted into the popup).
//   • Make the authenticated API calls (import a job, fetch the apply profile)
//     from the extension origin so the Bearer key never touches the page.

const DEFAULT_API_BASE = "https://jobsai.work";

async function getConfig() {
  const { apiKey, apiBase } = await chrome.storage.local.get(["apiKey", "apiBase"]);
  return { apiKey: apiKey || null, apiBase: apiBase || DEFAULT_API_BASE };
}

async function setApiKey(apiKey, apiBase) {
  const patch = { apiKey };
  if (apiBase) patch.apiBase = apiBase;
  await chrome.storage.local.set(patch);
}

// ─── API calls ─────────────────────────────────────────────────────────────────

async function importJob(url) {
  const { apiKey, apiBase } = await getConfig();
  if (!apiKey) return { ok: false, error: "not_connected" };

  const res = await fetch(`${apiBase}/api/extension/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: json.error || "Import failed", upgrade: json.upgrade_required };
  return { ok: true, jobId: json.job_id, duplicate: json.duplicate, apiBase };
}

async function fetchProfile() {
  const { apiKey, apiBase } = await getConfig();
  if (!apiKey) return { ok: false, error: "not_connected" };

  const res = await fetch(`${apiBase}/api/extension/profile`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: json.error || "Could not load profile" };
  return { ok: true, profile: json.profile, apiBase };
}

// How many auto-submit applications the user has left today (per-plan daily cap).
async function fetchApplyGate() {
  const { apiKey, apiBase } = await getConfig();
  if (!apiKey) return { allowed: false, remaining: 0 };
  try {
    const res = await fetch(`${apiBase}/api/extension/apply-gate`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await res.json().catch(() => ({}));
    return { allowed: !!json.allowed, remaining: json.remaining ?? 0, reason: json.reason };
  } catch {
    return { allowed: false, remaining: 0 };
  }
}

async function postApplyResult(jobId, board, status, error) {
  const { apiKey, apiBase } = await getConfig();
  if (!apiKey) return;
  try {
    await fetch(`${apiBase}/api/extension/apply-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ job_id: jobId, board, status, error: error || null }),
    });
  } catch { /* best-effort logging */ }
}

// ─── Board capability (mirror of src/lib/job-boards.ts) ─────────────────────────

const BOARD_HOSTS = {
  linkedin: ["linkedin.com"], indeed: ["indeed.com"], ziprecruiter: ["ziprecruiter.com"],
  dice: ["dice.com"], workable: ["workable.com"], glassdoor: ["glassdoor.com"], monster: ["monster.com"],
};
// Boards that ship an auto-submit adapter. Whether each actually auto-submits is a
// per-user toggle (directBoards) — off by default until verified on a live listing.
const ADAPTER_BOARDS = new Set(["linkedin", "indeed", "ziprecruiter", "dice", "workable"]);

async function getDirectBoards() {
  const { directBoards } = await chrome.storage.local.get(["directBoards"]);
  return directBoards || { linkedin: true }; // LinkedIn auto-submit on by default
}
async function setDirectBoards(map) {
  await chrome.storage.local.set({ directBoards: map && typeof map === "object" ? map : {} });
}

function boardForUrl(url) {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return "manual"; }
  for (const [id, hs] of Object.entries(BOARD_HOSTS)) {
    if (hs.some((h) => host === h || host.endsWith("." + h))) return id;
  }
  return "manual";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitTabComplete(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return resolve(false);
        if (tab.status === "complete") return resolve(true);
        if (Date.now() - start > timeout) return resolve(true); // proceed anyway
        setTimeout(tick, 400);
      });
    };
    tick();
  });
}

function sendToTab(tabId, message, timeout = 25000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve({ status: "failed", error: "timeout" }); } }, timeout);
    try {
      chrome.tabs.sendMessage(tabId, message, (resp) => {
        if (done) return;
        done = true; clearTimeout(timer);
        resolve(chrome.runtime.lastError ? { status: "failed", error: "no_runner" } : (resp || { status: "failed" }));
      });
    } catch {
      if (!done) { done = true; clearTimeout(timer); resolve({ status: "failed", error: "send_failed" }); }
    }
  });
}

// Run one job through its board adapter.
//   autoSubmit=true  → background tab, submit, close.
//   autoSubmit=false → visible tab, autofill + stop at submit, leave open to verify.
async function runAdapter(job, profile, resumeLabel, autoSubmit) {
  const tab = await chrome.tabs.create({ url: job.url, active: !autoSubmit });
  let close = true;
  try {
    await waitTabComplete(tab.id);
    await sleep(1800); // let the page + content script settle
    const resp = await sendToTab(tab.id, { type: "RUN_APPLY", job, profile, resumeLabel, autoSubmit });
    const status = resp?.status || "failed";
    // Verify mode: keep the autofilled tab open so the user can review + submit.
    if (!autoSubmit && status === "needs_review") close = false;
    return status;
  } finally {
    if (close) { try { await chrome.tabs.remove(tab.id); } catch { /* tab already gone */ } }
  }
}

// ─── Bulk apply queue (port from the dashboard) ─────────────────────────────────

chrome.runtime.onConnectExternal.addListener((port) => {
  if (port.name !== "jobsai-bulk-apply") return;

  port.onMessage.addListener(async (msg) => {
    if (!msg || msg.type !== "BULK_APPLY") return;
    port.postMessage({ type: "ACK" });

    const jobs = Array.isArray(msg.jobs) ? msg.jobs : [];
    const pr = await fetchProfile();
    const profile = pr.ok ? pr.profile : {};
    const directBoards = await getDirectBoards();

    // Daily auto-submit allowance (per-plan cap, server source of truth).
    const gate = await fetchApplyGate();
    let remaining = gate.remaining;
    if (!gate.allowed && gate.reason) port.postMessage({ type: "NOTICE", reason: gate.reason });

    let applied = 0;
    for (const job of jobs) {
      port.postMessage({ type: "PROGRESS", jobId: job.id, status: "applying" });
      const board = boardForUrl(job.url);

      let status;
      if (!job.url || !ADAPTER_BOARDS.has(board)) {
        // No adapter for this board — flag for the user to apply manually.
        status = "needs_review";
      } else {
        const autoSubmit = directBoards[board] === true;
        // Enforce the daily cap on auto-submits; verify-mode autofill is uncapped.
        if (autoSubmit && remaining <= 0) {
          status = "needs_review"; // daily application limit reached
        } else {
          try {
            const raw = await runAdapter(job, profile, msg.resumeLabel, autoSubmit);
            status = raw === "applied" ? "applied" : raw === "needs_review" ? "needs_review" : "failed";
            if (status === "applied") remaining = Math.max(0, remaining - 1);
          } catch (e) {
            status = "failed";
            await postApplyResult(job.id, board, "failed", String(e && e.message || e));
            port.postMessage({ type: "PROGRESS", jobId: job.id, status: "failed" });
            continue;
          }
        }
      }

      if (status === "applied") applied++;
      await postApplyResult(job.id, board, status);
      // Map runner status → dashboard status vocabulary.
      port.postMessage({ type: "PROGRESS", jobId: job.id, status: status === "applied" ? "applied" : status === "needs_review" ? "review" : "failed" });
      await sleep(500);
    }

    if (applied > 0) notify("JobsAI", `Applied to ${applied} job${applied === 1 ? "" : "s"}.`);
    port.postMessage({ type: "DONE", applied });
  });
});

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
    });
  } catch { /* notifications optional */ }
}

// ─── Messages from the JobsAI website (externally_connectable) ──────────────────

chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "JOBSAI_PING") {
    sendResponse({ ok: true, installed: true, version: chrome.runtime.getManifest().version });
    return; // sync
  }

  if (msg.type === "JOBSAI_CONNECT" && msg.apiKey) {
    setApiKey(msg.apiKey, msg.apiBase).then(() => {
      sendResponse({ ok: true });
    });
    return true; // async
  }

  if (msg.type === "JOBSAI_GET_DIRECT_BOARDS") {
    getDirectBoards().then((directBoards) => sendResponse({ ok: true, directBoards }));
    return true; // async
  }

  if (msg.type === "JOBSAI_SET_DIRECT_BOARDS") {
    setDirectBoards(msg.directBoards).then(() => sendResponse({ ok: true }));
    return true; // async
  }

  sendResponse({ ok: false, error: "unknown_message" });
});

// ─── Messages from the content script / popup ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "GET_STATUS":
      getConfig().then((c) => sendResponse({ connected: !!c.apiKey, apiBase: c.apiBase }));
      return true;

    case "SET_API_KEY":
      setApiKey(msg.apiKey, msg.apiBase).then(() => sendResponse({ ok: true }));
      return true;

    case "DISCONNECT":
      chrome.storage.local.remove(["apiKey"]).then(() => sendResponse({ ok: true }));
      return true;

    case "IMPORT_JOB":
      importJob(msg.url).then((r) => {
        if (r.ok) notify("Saved to JobsAI", r.duplicate ? "Already in your dashboard." : "Job imported. Open JobsAI to tailor & apply.");
        sendResponse(r);
      });
      return true;

    case "GET_PROFILE":
      fetchProfile().then(sendResponse);
      return true;

    default:
      return; // not ours
  }
});
