// JobsAI — For LinkedIn · content script
//
// Adds a floating JobsAI launcher to LinkedIn job pages with two actions:
//   1. Save to JobsAI       — imports the current job into the user's dashboard.
//   2. Easy Apply (autofill) — opens LinkedIn's native Easy Apply modal and fills
//      the basic contact/screening fields from the user's saved JobsAI profile.
//      We never auto-submit — the user reviews and clicks the final button.

(() => {
  "use strict";
  if (window.__jobsaiInjected) return;
  window.__jobsaiInjected = true;

  const LOGO = chrome.runtime.getURL("icons/icon48.png");
  const $ = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  // Some React buttons ignore a bare .click() — fire a full pointer/mouse
  // sequence so LinkedIn's Easy Apply handler actually triggers.
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    const o = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new PointerEvent("pointerdown", o)); } catch {}
    el.dispatchEvent(new MouseEvent("mousedown", o));
    try { el.dispatchEvent(new PointerEvent("pointerup", o)); } catch {}
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.click();
  };

  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (resp) => resolve(resp || { ok: false }));
      } catch {
        resolve({ ok: false, error: "extension_reloaded" });
      }
    });
  }

  // ─── Job detection ─────────────────────────────────────────────────────────

  function currentJobUrl() {
    const m = location.pathname.match(/\/jobs\/view\/(\d+)/);
    if (m) return `https://www.linkedin.com/jobs/view/${m[1]}/`;
    const id = new URLSearchParams(location.search).get("currentJobId");
    if (id) return `https://www.linkedin.com/jobs/view/${id}/`;
    return null;
  }

  function jobTitle() {
    const el =
      $(".job-details-jobs-unified-top-card__job-title") ||
      $(".jobs-unified-top-card__job-title") ||
      $("h1");
    return el ? el.textContent.trim() : "this job";
  }

  // ─── Floating UI ─────────────────────────────────────────────────────────────

  let panelOpen = false;

  function buildUI() {
    if ($("#jobsai-fab")) return;

    const fab = document.createElement("button");
    fab.id = "jobsai-fab";
    fab.title = "JobsAI";
    fab.innerHTML = `<img src="${LOGO}" alt="JobsAI" width="26" height="26" />`;
    fab.addEventListener("click", togglePanel);

    const panel = document.createElement("div");
    panel.id = "jobsai-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="jobsai-head">
        <img src="${LOGO}" width="20" height="20" alt="" />
        <span>JobsAI</span>
        <span id="jobsai-status" class="jobsai-status">…</span>
      </div>
      <p id="jobsai-jobname" class="jobsai-jobname"></p>
      <button id="jobsai-save" class="jobsai-btn jobsai-btn-primary">Save to JobsAI</button>
      <button id="jobsai-apply" class="jobsai-btn jobsai-btn-ghost">Easy Apply — autofill</button>
      <p id="jobsai-msg" class="jobsai-msg"></p>
      <a id="jobsai-link" class="jobsai-link" href="#" target="_blank" rel="noopener" hidden>Open in JobsAI →</a>
      <p id="jobsai-connect" class="jobsai-connect" hidden>
        Not connected. Open your <a href="https://jobsai.work/dashboard/extension" target="_blank" rel="noopener">JobsAI dashboard</a> to link the extension.
      </p>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    $("#jobsai-save", panel).addEventListener("click", onSave);
    $("#jobsai-apply", panel).addEventListener("click", onEasyApply);

    refreshStatus();
  }

  function togglePanel() {
    const panel = $("#jobsai-panel");
    panelOpen = !panelOpen;
    panel.hidden = !panelOpen;
    if (panelOpen) {
      $("#jobsai-jobname").textContent = jobTitle();
      refreshStatus();
    }
  }

  async function refreshStatus() {
    const status = $("#jobsai-status");
    const connectNote = $("#jobsai-connect");
    const r = await send({ type: "GET_STATUS" });
    const connected = !!r.connected;
    if (status) {
      status.textContent = connected ? "Connected" : "Not connected";
      status.classList.toggle("ok", connected);
    }
    if (connectNote) connectNote.hidden = connected;
    ["jobsai-save", "jobsai-apply"].forEach((id) => {
      const b = $("#" + id);
      if (b) b.disabled = !connected;
    });
  }

  function setMsg(text, kind = "") {
    const m = $("#jobsai-msg");
    if (!m) return;
    m.textContent = text;
    m.className = "jobsai-msg" + (kind ? " " + kind : "");
  }

  // ─── Save to JobsAI ──────────────────────────────────────────────────────────

  async function onSave() {
    const url = currentJobUrl();
    if (!url) { setMsg("Open a specific job first.", "warn"); return; }

    const btn = $("#jobsai-save");
    btn.disabled = true;
    setMsg("Saving…");
    const r = await send({ type: "IMPORT_JOB", url });
    btn.disabled = false;

    if (r.ok) {
      setMsg(r.duplicate ? "Already saved ✓" : "Saved to JobsAI ✓", "ok");
      const link = $("#jobsai-link");
      if (link) {
        link.href = `${r.apiBase || "https://jobsai.work"}/dashboard/jobs/${r.jobId}`;
        link.hidden = false;
      }
    } else if (r.error === "not_connected") {
      setMsg("Connect the extension first.", "warn");
      refreshStatus();
    } else if (r.upgrade) {
      setMsg("Job limit reached — upgrade your plan.", "warn");
    } else {
      setMsg(r.error || "Could not save this job.", "warn");
    }
  }

  // ─── Easy Apply autofill ─────────────────────────────────────────────────────

  const btnText = (b) => (b.getAttribute("aria-label") || b.textContent || "").toLowerCase();

  // The real Easy Apply trigger: a VISIBLE, ENABLED button whose label says
  // "easy apply". (Requiring visible+enabled avoids the pre-hydration placeholder
  // / hidden duplicate that LinkedIn renders, which clicks to nothing.)
  function findEasyApplyButton() {
    const btns = [...document.querySelectorAll("button")].filter(visible);
    return btns.find((b) => btnText(b).includes("easy apply") && !b.disabled) || null;
  }

  // An "Apply" that redirects to the company site (NOT Easy Apply) — so we can
  // tell the user it's an external application instead of failing cryptically.
  function findExternalApplyButton() {
    const els = [...document.querySelectorAll("button, a")].filter(visible);
    return els.find((b) => {
      const t = btnText(b);
      return t.includes("apply") && !t.includes("easy apply") &&
        (b.className.includes("jobs-apply-button") || t.includes("company website") || b.tagName === "A");
    }) || null;
  }

  // LinkedIn has shuffled the Easy Apply modal container several times — match
  // any of the known shapes, and require it to be visible.
  function findModal() {
    // Generic so it survives LinkedIn's frequent class renames: any visible
    // dialog/modal, preferring an Easy-Apply-flavored one over other dialogs.
    const cands = [...document.querySelectorAll(
      "[role='dialog'], .artdeco-modal, [data-test-modal], [data-test-modal-container], [class*='easy-apply'], [class*='jobs-apply']"
    )].filter(visible);
    const tag = (d) => `${d.className || ""} ${d.getAttribute("data-test-modal-id") || ""} ${d.id || ""}`.toLowerCase();
    return cands.find((d) => /easy.?apply|jobs-apply/.test(tag(d))) || cands[0] || null;
  }

  async function waitForModal(timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const modal = findModal();
      if (modal) return modal;
      await sleep(200);
    }
    return null;
  }

  // Map a field's visible label to a profile value.
  function valueForLabel(label, p) {
    const l = label.toLowerCase();
    const has = (...words) => words.some((w) => l.includes(w));

    if (has("first name")) return p.first_name;
    if (has("last name", "surname", "family name")) return p.last_name;
    if (has("full name", "name") && !has("user", "company", "file")) return p.full_name;
    if (has("email")) return p.email;
    if (has("mobile", "phone")) return p.phone;
    if (has("city", "location")) return p.city || p.location;
    if (has("postal", "zip")) return p.postal_code;
    if (has("country")) return p.country;
    if (has("linkedin")) return p.linkedin_url;
    if (has("github")) return p.github_url;
    if (has("portfolio", "website")) return p.portfolio_url || p.website_url;
    if (has("years") && has("experience")) return p.years_experience != null ? String(p.years_experience) : null;
    return null;
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function labelTextFor(el, modal) {
    if (el.id) {
      const lab = modal.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) return lab.textContent.trim();
    }
    const wrap = el.closest(".artdeco-text-input--container, .fb-dash-form-element, [data-test-form-element]") || el.parentElement;
    const lab = wrap && wrap.querySelector("label");
    return (lab ? lab.textContent : el.getAttribute("aria-label") || el.name || "").trim();
  }

  function fillModal(modal, p) {
    let filled = 0;

    // Text / email / tel inputs + textareas
    modal.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea").forEach((el) => {
      if (el.value && el.value.trim()) return; // don't overwrite what's there
      const val = valueForLabel(labelTextFor(el, modal), p);
      if (val) { setNativeValue(el, val); filled++; }
    });

    // Selects (e.g. country, yes/no work authorization)
    modal.querySelectorAll("select").forEach((el) => {
      const label = labelTextFor(el, modal).toLowerCase();
      let want = null;
      if (label.includes("country")) want = p.country;
      else if (label.includes("authoriz") || label.includes("eligible") || label.includes("legally")) want = p.authorized_to_work ? "yes" : "no";
      else if (label.includes("sponsor")) want = p.requires_sponsorship ? "yes" : "no";
      if (!want) return;
      const opt = [...el.options].find((o) => o.textContent.trim().toLowerCase().includes(String(want).toLowerCase()));
      if (opt && !el.value) { el.value = opt.value; el.dispatchEvent(new Event("change", { bubbles: true })); filled++; }
    });

    return filled;
  }

  async function onEasyApply() {
    setMsg("Opening Easy Apply…");
    const pr = await send({ type: "GET_PROFILE" });
    if (!pr.ok) {
      setMsg(pr.error === "not_connected" ? "Connect the extension first." : (pr.error || "Could not load your profile."), "warn");
      return;
    }

    const applyBtn = findEasyApplyButton();
    if (!applyBtn) {
      // Not an Easy Apply job (external/company-site application) vs. page not ready.
      if (findExternalApplyButton()) {
        setMsg("This job applies on the company's site, not LinkedIn Easy Apply. Use “Open in JobsAI” to apply with your tailored résumé.", "warn");
      } else {
        setMsg("Easy Apply button not found yet — scroll to the top of the job and try again once it loads.", "warn");
      }
      return;
    }

    // Full pointer-event click; the button can be behind a sticky header, not
    // yet interactive on first paint, or ignore a bare .click().
    await sleep(150);
    realClick(applyBtn);

    let modal = await waitForModal();
    if (!modal) {
      // The first click sometimes lands before LinkedIn wires the handler — re-find and retry once.
      const retry = findEasyApplyButton();
      if (retry) { await sleep(200); realClick(retry); modal = await waitForModal(8000); }
    }
    if (!modal) {
      // Diagnostic: dump what dialog/modal-ish nodes exist so we can target the
      // real selector if LinkedIn drifted again. Open DevTools console on the
      // LinkedIn tab to read this.
      const dump = [...document.querySelectorAll("[role='dialog'], .artdeco-modal, [data-test-modal], [class*='modal']")]
        .map((d) => `${d.tagName.toLowerCase()}#${d.id || "-"}.${(d.className || "").toString().split(" ").filter(Boolean).join(".")}[role=${d.getAttribute("role") || "-"}] visible=${visible(d)}`);
      console.log("[JobsAI] Easy Apply modal not found. Candidate dialog/modal nodes:", dump);
      setMsg("Couldn't open the Easy Apply form. Click Easy Apply once yourself, then re-run — or use “Open in JobsAI”.", "warn");
      return;
    }
    await sleep(400);

    const n = fillModal(modal, pr.profile || {});
    setMsg(n > 0 ? `Filled ${n} field${n === 1 ? "" : "s"}. Review, then submit.` : "Form opened — review and complete it.", n > 0 ? "ok" : "");

    // Re-fill on each step of the multi-step flow as the user clicks "Next".
    const obs = new MutationObserver(() => {
      const live = findModal();
      if (live) fillModal(live, pr.profile || {});
    });
    obs.observe(modal, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 120000);
  }

  // ─── Boot + SPA navigation ────────────────────────────────────────────────────

  function maybeShow() {
    if (location.pathname.startsWith("/jobs/")) buildUI();
  }

  maybeShow();

  // LinkedIn is a SPA — re-evaluate on URL changes.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      maybeShow();
      if (panelOpen) { $("#jobsai-jobname") && ($("#jobsai-jobname").textContent = jobTitle()); setMsg(""); $("#jobsai-link") && ($("#jobsai-link").hidden = true); }
    }
  }, 1000);
})();
