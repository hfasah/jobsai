// JobsAI — bulk apply runner. Injected on every supported board. Stays idle until
// the background worker sends a RUN_APPLY message for a queued job, then drives the
// application using the user's profile and reports the outcome back.
//
// RUN_APPLY payload: { job, profile, resumeLabel, autoSubmit }
//   autoSubmit=true  → submit when the form is fully fillable (1-click boards)
//   autoSubmit=false → fill + reach the submit step, then stop for the user (verify)
//
// Status returned:
//   applied      — submitted successfully
//   needs_review — autofilled but left for the user to finish/submit
//   failed       — couldn't find an apply path / hit an error
(() => {
  "use strict";
  if (window.__jobsaiRunner) return;
  window.__jobsaiRunner = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel, root = document) => root.querySelector(sel);

  const HOSTS = {
    linkedin: ["linkedin.com"], indeed: ["indeed.com"], ziprecruiter: ["ziprecruiter.com"],
    dice: ["dice.com"], workable: ["workable.com"], glassdoor: ["glassdoor.com"], monster: ["monster.com"],
    workday: ["myworkdayjobs.com", "workday.com"], greenhouse: ["greenhouse.io"], lever: ["lever.co"],
    catho: ["catho.com.br"],
  };
  function boardFromHost(host) {
    host = (host || location.hostname).toLowerCase();
    for (const [id, hs] of Object.entries(HOSTS)) {
      if (hs.some((h) => host === h || host.endsWith("." + h))) return id;
    }
    return "manual";
  }

  // ─── Shared form filling ──────────────────────────────────────────────────────

  function valueForLabel(label, p) {
    const l = (label || "").toLowerCase();
    const has = (...w) => w.some((x) => l.includes(x));
    // Bilingual (EN + PT-BR) so Portuguese boards like Catho autofill too. Check
    // last/full name before first name ("sobrenome" contains "nome").
    if (has("last name", "surname", "family name", "sobrenome")) return p.last_name;
    if (has("full name", "nome completo")) return p.full_name;
    if (has("first name") || (has("nome") && !has("usuário", "usuario", "empresa", "arquivo"))) return p.first_name;
    if (has("email", "e-mail", "mail")) return p.email;
    if (has("mobile", "phone", "telefone", "celular", "fone", "whatsapp", "contato")) return p.phone;
    if (has("postal", "zip", "cep")) return p.postal_code;
    if (has("city", "location", "cidade", "localidade", "munic")) return p.city || p.location;
    if (has("country", "país", "pais")) return p.country;
    if (has("linkedin")) return p.linkedin_url;
    if (has("github")) return p.github_url;
    if (has("portfolio", "website", "portfólio")) return p.portfolio_url || p.website_url;
    if (has("years", "anos") && has("experience", "experiência", "experiencia")) return p.years_experience != null ? String(p.years_experience) : null;
    if (has("name") && !has("user", "company", "file", "first", "last")) return p.full_name;
    return null;
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function labelFor(el, root) {
    if (el.id) {
      const lab = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) return lab.textContent.trim();
    }
    const wrap = el.closest("[data-test-form-element], .fb-dash-form-element, .artdeco-text-input--container, .input, fieldset, label") || el.parentElement;
    const lab = wrap && wrap.querySelector("label, legend");
    return (lab ? lab.textContent : el.getAttribute("aria-label") || el.name || el.placeholder || "").trim();
  }

  function fillForm(root, p) {
    let filled = 0;
    root.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input[type='url'], input:not([type]), textarea").forEach((el) => {
      if (el.disabled || el.readOnly || el.value?.trim()) return;
      const v = valueForLabel(labelFor(el, root), p);
      if (v) { setNativeValue(el, v); filled++; }
    });
    root.querySelectorAll("select").forEach((el) => {
      if (el.value && el.options[el.selectedIndex]?.value) return;
      const l = labelFor(el, root).toLowerCase();
      let want = null;
      if (l.includes("country") || l.includes("país") || l.includes("pais")) want = p.country;
      else if (l.includes("authoriz") || l.includes("eligible") || l.includes("legally")) want = p.authorized_to_work ? "yes" : "no";
      else if (l.includes("sponsor")) want = p.requires_sponsorship ? "yes" : "no";
      if (!want) return;
      const opt = [...el.options].find((o) => o.textContent.trim().toLowerCase().includes(String(want).toLowerCase()));
      if (opt) { el.value = opt.value; el.dispatchEvent(new Event("change", { bubbles: true })); filled++; }
    });
    return filled;
  }

  // Workday uses custom widgets with stable data-automation-id attributes instead
  // of normal <label for>, so the generic label matcher misses them. Map the
  // common identity fields directly. Runs in addition to fillForm (verify-mode
  // only — Workday's multi-step wizard always leaves the user to review + submit).
  function fillWorkday(root, p) {
    const map = [
      [/legalname.*first|firstname/i, p.first_name],
      [/legalname.*last|lastname|familyname/i, p.last_name],
      [/email/i, p.email],
      [/phone(number)?/i, p.phone],
      [/address.*city|^city/i, p.city || p.location],
      [/postal|zip/i, p.postal_code],
    ];
    let filled = 0;
    root.querySelectorAll("input[data-automation-id], textarea[data-automation-id]").forEach((el) => {
      if (el.disabled || el.readOnly || el.value?.trim()) return;
      const id = el.getAttribute("data-automation-id") || "";
      const hit = map.find(([re, v]) => v && re.test(id));
      if (hit) { setNativeValue(el, hit[1]); filled++; }
    });
    return filled;
  }

  // Required, still-empty fields we couldn't answer? Guards against bad auto-submits.
  function hasUnfilledRequired(root) {
    const fields = [...root.querySelectorAll("[required], [aria-required='true']")];
    return fields.some((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "input" && (el.type === "radio" || el.type === "checkbox")) {
        const name = el.name;
        return name ? !root.querySelector(`input[name="${CSS.escape(name)}"]:checked`) : !el.checked;
      }
      if (el.disabled) return false;
      return !(el.value && String(el.value).trim());
    });
  }

  function buttonByText(root, ...phrases) {
    const btns = [...root.querySelectorAll("button, [role='button'], input[type='submit'], a.btn, a[role='button']")];
    return btns.find((b) => {
      const t = (b.getAttribute("aria-label") || b.value || b.textContent || "").toLowerCase().trim();
      return phrases.some((p) => t.includes(p)) && !b.disabled && b.offsetParent !== null;
    });
  }

  function looksSubmitted(root = document) {
    const t = (root.innerText || "").toLowerCase();
    return /application (was )?submitted|your application has been|successfully applied|applied\b|thank you for applying|candidatura (enviada|realizada)|sua candidatura foi/.test(t);
  }

  // DOM-diagnostic dump (opt-in via cfg.diagnose) — prints the real buttons and
  // labeled fields so an adapter still being hardened (e.g. Catho) can be tuned
  // from a live run instead of guesswork. Mirrors the LinkedIn adapter's
  // failure-time logging. Safe/no-op in production for boards without diagnose.
  function diagDump(root, stage) {
    try {
      const btns = [...(root || document).querySelectorAll("button, [role='button'], input[type='submit'], a")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => (b.getAttribute("aria-label") || b.value || b.textContent || "").trim())
        .filter(Boolean).slice(0, 25);
      const fields = [...(root || document).querySelectorAll("input, textarea, select")]
        .filter((el) => el.offsetParent !== null && el.type !== "hidden")
        .map((el) => ({ label: labelFor(el, root || document), name: el.name || el.id || "", type: el.type || el.tagName.toLowerCase(), required: el.required || el.getAttribute("aria-required") === "true" }))
        .slice(0, 30);
      console.log(`[JobsAI][diag:${stage}] buttons:`, btns);
      console.log(`[JobsAI][diag:${stage}] fields:`, fields);
    } catch { /* diagnostics are best-effort */ }
  }

  // ─── Generic step-through apply engine (used by all non-LinkedIn boards) ─────────
  // cfg: { applyPhrases, submitPhrases, nextPhrases, rootSelectors }

  function pickRoot(cfg) {
    for (const sel of cfg.rootSelectors || []) {
      const el = $(sel);
      if (el) return el;
    }
    return $("[role='dialog']") || $("form") || document.body;
  }

  async function stepApply(profile, autoSubmit, cfg) {
    // Some ATS (Workday) are too complex/variable to ever safely auto-submit —
    // force verify mode so the user always reviews before submitting.
    const allowSubmit = autoSubmit && !cfg.neverAutoSubmit;

    // 1. Trigger the apply flow if there's an entry button.
    const trigger = buttonByText(document, ...(cfg.applyPhrases || []));
    if (cfg.diagnose && !trigger) diagDump(document, "no-apply-button");
    if (trigger) { trigger.click(); await sleep(1500); }
    if (looksSubmitted()) return "applied"; // some 1-click boards apply instantly

    // 2. Walk the form steps.
    for (let step = 0; step < 8; step++) {
      const root = pickRoot(cfg);
      fillForm(root, profile);
      if (cfg.fillExtra) cfg.fillExtra(root, profile);
      await sleep(300);

      if (looksSubmitted()) return "applied";

      const submit = buttonByText(root, ...(cfg.submitPhrases || []));
      if (submit) {
        if (hasUnfilledRequired(root)) return "needs_review";
        if (!allowSubmit) return "needs_review"; // verify mode: stop at the submit step
        submit.click();
        await sleep(1200);
        return looksSubmitted() ? "applied" : "needs_review";
      }

      if (hasUnfilledRequired(root)) { if (cfg.diagnose) diagDump(root, `unfilled-required-step${step}`); return "needs_review"; }

      const next = buttonByText(root, ...(cfg.nextPhrases || []));
      if (!next) { if (cfg.diagnose) diagDump(root, `no-next-step${step}`); return "needs_review"; }
      next.click();
      await sleep(900);
    }
    return "needs_review";
  }

  const BOARD_CFG = {
    indeed: {
      applyPhrases: ["apply now", "apply on company", "easily apply", "apply"],
      submitPhrases: ["submit your application", "submit application", "submit"],
      nextPhrases: ["continue", "next", "review your application", "review"],
      rootSelectors: [".ia-Modal", "#ia-container", "[role='dialog']", "main form"],
    },
    ziprecruiter: {
      applyPhrases: ["1-click apply", "1 click apply", "apply now", "quick apply", "apply"],
      submitPhrases: ["submit application", "submit", "send application"],
      nextPhrases: ["continue", "next"],
      rootSelectors: ["[role='dialog']", ".modal", "main form"],
    },
    dice: {
      applyPhrases: ["easy apply", "apply now", "apply"],
      submitPhrases: ["submit", "submit application"],
      nextPhrases: ["next", "continue", "review"],
      rootSelectors: ["[data-cy='easyApplyModal']", "[role='dialog']", ".modal", "form"],
    },
    workable: {
      applyPhrases: ["apply for this job", "apply now", "i'm interested", "apply"],
      submitPhrases: ["submit application", "submit", "send application"],
      nextPhrases: ["continue", "next"],
      rootSelectors: ["form[data-ui='application-form']", "main form", "form"],
    },
    // Greenhouse renders the application form inline on the posting page — usually
    // a single page, standard <label for> fields, "Submit Application".
    greenhouse: {
      applyPhrases: ["apply for this job", "apply"],
      submitPhrases: ["submit application", "submit"],
      nextPhrases: [],
      rootSelectors: ["#application_form", "#application-form", "form#application_form", "main form", "form"],
    },
    // Lever: "Apply for this job" → /apply form ("Full name", "Email", resume…),
    // "Submit application".
    lever: {
      applyPhrases: ["apply for this job", "apply"],
      submitPhrases: ["submit application", "submit"],
      nextPhrases: [],
      rootSelectors: ["form[data-qa='application-form']", ".application-form", "main form", "form"],
    },
    // Workday: account-walled, multi-step wizard with custom widgets. Autofill the
    // identity fields (fillWorkday) in-session and walk the steps, but NEVER
    // auto-submit — the user reviews and submits the long form themselves.
    workday: {
      applyPhrases: ["apply manually", "autofill with resume", "apply for this job", "apply"],
      submitPhrases: ["submit"],
      nextPhrases: ["save and continue", "continue", "next", "review"],
      rootSelectors: ["[data-automation-id='applyFlowPage']", "[role='dialog']", "main", "form"],
      fillExtra: fillWorkday,
      neverAutoSubmit: true,
    },
    // Catho (Brazil): Portuguese listings. "Candidatar-se" opens the application;
    // forms vary, so autofill (bilingual field matcher) and stop for the user to
    // review + submit. neverAutoSubmit until the adapter is hardened on a live PT
    // listing. `diagnose` logs the real buttons/fields to the console on a live
    // run so the selectors/phrases below can be tuned from actual DOM.
    catho: {
      applyPhrases: [
        "candidatar-se com 1 clique", "candidatura rápida", "candidatura rapida",
        "candidatar-se a esta vaga", "candidatar-se", "candidatar", "quero me candidatar",
        "candidate-se", "enviar candidatura", "apply",
      ],
      submitPhrases: ["enviar candidatura", "finalizar candidatura", "enviar minha candidatura", "confirmar candidatura", "confirmar", "finalizar", "enviar"],
      nextPhrases: ["continuar", "próximo", "proximo", "avançar", "avancar", "prosseguir", "next"],
      rootSelectors: ["[role='dialog']", "[class*='candidatura']", "[class*='Candidatura']", "[class*='modal']", "[class*='Modal']", "main form", "form"],
      neverAutoSubmit: true,
      diagnose: true,
    },
  };

  // ─── LinkedIn Easy Apply (modal step-loop) ──────────────────────────────────────

  function selectResume(modal, resumeLabel) {
    if (!resumeLabel) return;
    const cards = [...modal.querySelectorAll("[data-test-resume-card-container], .jobs-resume-picker__resume")];
    const match = cards.find((c) => c.textContent.toLowerCase().includes(resumeLabel.toLowerCase()));
    if (match) {
      const radio = match.querySelector("input[type='radio'], button");
      if (radio && !radio.checked) radio.click();
    }
  }

  async function applyLinkedIn(profile, resumeLabel, autoSubmit) {
    const easy = buttonByText(document, "easy apply");
    if (!easy) return "needs_review"; // external application
    easy.click();

    let modal = null;
    for (let i = 0; i < 25 && !modal; i++) { modal = $(".jobs-easy-apply-modal") || $("[data-test-modal][role='dialog']") || $(".artdeco-modal"); await sleep(200); }
    if (!modal) return "failed";
    await sleep(400);

    for (let step = 0; step < 8; step++) {
      fillForm(modal, profile);
      selectResume(modal, resumeLabel);
      await sleep(250);

      const submit = buttonByText(modal, "submit application");
      if (submit) {
        if (hasUnfilledRequired(modal)) return "needs_review";
        if (!autoSubmit) return "needs_review";
        submit.click();
        await sleep(800);
        return "applied";
      }
      if (hasUnfilledRequired(modal)) return "needs_review";

      const next = buttonByText(modal, "continue to next step", "review your application", "next", "review");
      if (!next) return "needs_review";
      next.click();
      await sleep(700);
      modal = $(".jobs-easy-apply-modal") || $("[data-test-modal][role='dialog']") || $(".artdeco-modal") || modal;
    }
    return "needs_review";
  }

  // Fallback for boards with no specific config: autofill the visible form only.
  async function applyGeneric(profile) {
    const applyBtn = buttonByText(document, "apply now", "easy apply", "quick apply", "apply");
    if (applyBtn) { applyBtn.click(); await sleep(1200); }
    fillForm($("[role='dialog']") || $("form") || document.body, profile);
    return "needs_review";
  }

  // ─── Message entrypoint ─────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "RUN_APPLY") return;
    const profile = msg.profile || {};
    const autoSubmit = !!msg.autoSubmit;
    const board = boardFromHost();
    (async () => {
      try {
        let status;
        if (board === "linkedin") status = await applyLinkedIn(profile, msg.resumeLabel, autoSubmit);
        else if (BOARD_CFG[board]) status = await stepApply(profile, autoSubmit, BOARD_CFG[board]);
        else status = await applyGeneric(profile);
        sendResponse({ status });
      } catch (e) {
        sendResponse({ status: "failed", error: String(e && e.message || e) });
      }
    })();
    return true; // async response
  });

  // ─── In-page autofill button ────────────────────────────────────────────────────
  // LinkedIn has its own floating widget (content-linkedin.js). For every OTHER
  // supported board, inject a lightweight "Autofill with JobsAI" button so the user
  // can fill the form right in their logged-in tab — no dashboard round-trip. Always
  // verify mode (fills + stops at submit); the user reviews and submits.
  function injectAutofillButton() {
    const board = boardFromHost();
    if (board === "manual" || board === "linkedin") return;
    if (document.getElementById("jobsai-autofill-btn")) return;
    if (!document.body) return;

    const btn = document.createElement("button");
    btn.id = "jobsai-autofill-btn";
    const IDLE = "⚡ Autofill with JobsAI";
    btn.textContent = IDLE;
    Object.assign(btn.style, {
      position: "fixed", bottom: "20px", right: "20px", zIndex: "2147483647",
      background: "#4f46e5", color: "#fff", border: "none", borderRadius: "10px",
      padding: "12px 16px", fontSize: "14px", fontWeight: "700", cursor: "pointer",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      boxShadow: "0 4px 14px rgba(79,70,229,0.4)",
    });
    const flash = (text, ms = 4000) => { btn.textContent = text; setTimeout(() => { btn.textContent = IDLE; }, ms); };

    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.style.opacity = "0.7"; btn.textContent = "Loading profile…";
      let resp = null;
      try { resp = await chrome.runtime.sendMessage({ type: "GET_PROFILE" }); } catch { /* not connected */ }
      if (!resp || !resp.ok || !resp.profile) {
        const text = resp && resp.error === "not_connected" ? "Connect in JobsAI first" : "Couldn't load profile";
        btn.disabled = false; btn.style.opacity = "1"; flash(text);
        return;
      }
      btn.textContent = "Filling…";
      let status = "needs_review";
      try {
        status = BOARD_CFG[board]
          ? await stepApply(resp.profile, false, BOARD_CFG[board]) // verify mode
          : await applyGeneric(resp.profile);
      } catch { status = "failed"; }
      btn.disabled = false; btn.style.opacity = "1";
      flash(status === "applied" ? "✓ Submitted"
        : status === "needs_review" ? "✓ Filled — review & submit"
        : "Couldn't autofill — fill manually");
    });

    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectAutofillButton);
  else injectAutofillButton();
})();
