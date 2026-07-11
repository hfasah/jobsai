"use strict";

const APP_URL = "https://jobsai-web.vercel.app";

// ─── Job board detection ───────────────────────────────────────────────────────

const JOB_BOARDS = [
  { pattern: /linkedin\.com\/jobs\/view\//i,         label: "LinkedIn Jobs" },
  { pattern: /indeed\.com\/(viewjob|jobs|rc\/clk)/i, label: "Indeed" },
  { pattern: /boards\.greenhouse\.io\//i,             label: "Greenhouse" },
  { pattern: /jobs\.lever\.co\//i,                    label: "Lever" },
  { pattern: /myworkdayjobs\.com\//i,                 label: "Workday" },
  { pattern: /jobs\.ashbyhq\.com\//i,                 label: "Ashby" },
  { pattern: /glassdoor\.com\/job-listing\//i,        label: "Glassdoor" },
  { pattern: /smartrecruiters\.com\/job\//i,          label: "SmartRecruiters" },
  { pattern: /ziprecruiter\.com\/jobs\//i,            label: "ZipRecruiter" },
  { pattern: /wellfound\.com\/jobs\//i,               label: "Wellfound" },
  { pattern: /jobs\.remote\.co\//i,                   label: "Remote.co" },
  { pattern: /remoteok\.com\//i,                      label: "RemoteOK" },
];

function detectBoard(url) {
  for (const b of JOB_BOARDS) {
    if (b.pattern.test(url)) return b.label;
  }
  return null;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function showScreen(id) {
  document.getElementById("screen-setup").style.display = "none";
  document.getElementById("screen-main").style.display = "none";
  if (id) document.getElementById(id).style.display = "block";
}

function setStatus(type, html) {
  const icons = { loading: "⏳", success: "✅", error: "❌", dupe: "⚠️" };
  const area = document.getElementById("status-area");
  if (!type) { area.innerHTML = ""; return; }
  area.innerHTML = `
    <div class="status ${type}">
      <span class="status-icon">${icons[type]}</span>
      <div>${html}</div>
    </div>`;
}

function setImportBtnState(loading) {
  const btn = document.getElementById("btn-import");
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Importing…`;
  } else {
    btn.disabled = false;
    btn.innerHTML = "Import this job";
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { apiKey } = await chrome.storage.local.get("apiKey");

  if (!apiKey) {
    showScreen("screen-setup");
    return;
  }

  showScreen("screen-main");
  document.getElementById("btn-disconnect").style.display = "inline-flex";

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  // Detect board
  const board = detectBoard(url);
  const badge = document.getElementById("page-badge");
  if (board) {
    badge.className = "job-badge recognized";
    badge.textContent = "✓ " + board;
  } else {
    badge.className = "job-badge generic";
    badge.textContent = "Job page";
  }

  // Show truncated URL
  const urlEl = document.getElementById("page-url");
  urlEl.textContent = url.length > 60 ? url.slice(0, 57) + "…" : url;
  urlEl.title = url;

  // Disable import for non-HTTP pages
  if (!url.startsWith("http")) {
    document.getElementById("btn-import").disabled = true;
    setStatus("error", "Navigate to a job posting page to import.");
  }

  // Wire up import button
  document.getElementById("btn-import").addEventListener("click", () => importJob(apiKey, url));
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function importJob(apiKey, url) {
  setImportBtnState(true);
  setStatus("loading", "Fetching and parsing the job description…");

  try {
    const res = await fetch(`${APP_URL}/api/extension/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url }),
    });

    const json = await res.json();

    if (res.status === 401) {
      setStatus("error", "Invalid API key. <a href='#' id='reset-link'>Re-enter key →</a>");
      document.getElementById("reset-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.storage.local.remove("apiKey");
        showScreen("screen-setup");
        document.getElementById("btn-disconnect").style.display = "none";
      });
      setImportBtnState(false);
      return;
    }

    if (res.status === 402) {
      setStatus("error", `Plan limit reached. <a href="${APP_URL}/dashboard/billing" target="_blank">Upgrade →</a>`);
      setImportBtnState(false);
      return;
    }

    if (!res.ok) {
      setStatus("error", json.error ?? "Import failed. Please try again.");
      setImportBtnState(false);
      return;
    }

    const jobUrl = `${APP_URL}/dashboard/jobs/${json.job_id}`;

    if (json.duplicate) {
      setStatus("dupe", `Already in your jobs list. <a class="view-link" href="${jobUrl}" target="_blank">View job →</a>`);
    } else {
      setStatus("success", `Job imported! AI is processing it now.<br><a class="view-link" href="${jobUrl}" target="_blank">View job →</a>`);
    }
  } catch {
    setStatus("error", "Network error. Check your connection and try again.");
  }

  setImportBtnState(false);
}

// ─── Save API key ──────────────────────────────────────────────────────────────

document.getElementById("btn-save-key").addEventListener("click", async () => {
  const key = document.getElementById("api-key-input").value.trim();
  if (!key) return;

  await chrome.storage.local.set({ apiKey: key });
  init();
});

document.getElementById("api-key-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-save-key").click();
});

// ─── Disconnect ───────────────────────────────────────────────────────────────

document.getElementById("btn-disconnect").addEventListener("click", async () => {
  await chrome.storage.local.remove("apiKey");
  document.getElementById("btn-disconnect").style.display = "none";
  showScreen("screen-setup");
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

init();
