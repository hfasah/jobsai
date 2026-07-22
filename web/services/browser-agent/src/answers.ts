import { Page } from "playwright";
import type { ApplyProfile } from "./types";

// Best-effort answering of eligibility + EEO questions that ATS forms ask via
// <select> dropdowns and radio groups. Matches the question's label text to a
// rule, then picks the option/radio that matches the candidate's profile value.
export async function answerLabeledQuestions(page: Page, profile: ApplyProfile): Promise<void> {
  const a = {
    auth_yes: profile.authorized_to_work !== false,
    sponsorship: !!profile.requires_sponsorship,
    clearance: profile.security_clearance ?? "",
    drivers: !!profile.has_drivers_license,
    gender: profile.gender_identity ?? "",
    race: profile.race_ethnicity ?? "",
    veteran: profile.veteran_status ?? "",
    disability: profile.disability_status ?? "",
    orientation: profile.sexual_orientation ?? "",
    transgender: profile.transgender ?? "",
    education: profile.highest_education ?? "",
  };

  try {
    await page.evaluate((a: any) => {
      const d: any = (window as any).document;
      const norm = (s: any) => String(s || "").toLowerCase();
      const DECLINE = ["decline", "don't wish", "do not wish", "prefer not", "not to answer", "not specified", "i don't want", "rather not"];

      const ctx = (el: any): string => {
        const parts: string[] = [el.getAttribute("aria-label") || "", el.getAttribute("name") || "", el.id || ""];
        if (el.id) {
          const l = d.querySelector('label[for="' + (window as any).CSS.escape(el.id) + '"]');
          if (l) parts.push(l.textContent || "");
        }
        const wrap = el.closest("label, fieldset, [class*='field'], [class*='question'], [class*='form-group'], li, div");
        if (wrap) {
          const lab = wrap.querySelector("legend, label, [class*='label']");
          parts.push(lab ? (lab.textContent || "") : (wrap.textContent || "").slice(0, 180));
        }
        return norm(parts.join(" "));
      };

      const RULES: { keys: string[]; val: string }[] = [
        { keys: ["authorized to work", "work authorization", "legally authorized", "right to work"], val: a.auth_yes ? "yes" : "no" },
        { keys: ["sponsorship", "require sponsor", "visa sponsor", "need sponsor"], val: a.sponsorship ? "yes" : "no" },
        { keys: ["security clearance", "clearance"], val: a.clearance },
        { keys: ["driver's license", "drivers license", "driver license"], val: a.drivers ? "yes" : "no" },
        { keys: ["gender"], val: a.gender },
        { keys: ["race", "ethnicit"], val: a.race },
        { keys: ["veteran", "protected vet"], val: a.veteran },
        { keys: ["disabilit"], val: a.disability },
        { keys: ["sexual orientation"], val: a.orientation },
        { keys: ["transgender"], val: a.transgender },
        { keys: ["level of education", "highest education", "education level"], val: a.education },
      ];

      const pickOption = (sel: any, want: string): boolean => {
        const w = norm(want);
        const opts: any[] = Array.prototype.slice.call(sel.options);
        let best: any = null;
        if (w.includes("prefer not")) best = opts.find((o) => DECLINE.some((dd) => norm(o.text).includes(dd)));
        if (!best) best = opts.find((o) => norm(o.text).trim() && (norm(o.text).includes(w) || w.includes(norm(o.text).trim())));
        if (!best && (w === "yes" || w === "no")) best = opts.find((o) => norm(o.text).trim() === w);
        if (best && !best.disabled) { sel.value = best.value; sel.dispatchEvent(new Event("change", { bubbles: true })); return true; }
        return false;
      };

      // Dropdowns
      d.querySelectorAll("select").forEach((sel: any) => {
        if (sel.selectedIndex > 0 && sel.value) return; // already answered
        const c = ctx(sel);
        for (const r of RULES) {
          if (r.val && r.keys.some((k) => c.includes(k))) { if (pickOption(sel, r.val)) break; }
        }
      });

      // Radio groups
      const labelFor = (radio: any): string => {
        if (radio.id) {
          const l = d.querySelector('label[for="' + (window as any).CSS.escape(radio.id) + '"]');
          if (l) return norm(l.textContent);
        }
        const wrap = radio.closest("label");
        return wrap ? norm(wrap.textContent) : "";
      };
      const groups: Record<string, any[]> = {};
      d.querySelectorAll('input[type="radio"]').forEach((r: any) => {
        const key = r.name || r.id;
        (groups[key] = groups[key] || []).push(r);
      });
      Object.keys(groups).forEach((key) => {
        const group = groups[key];
        if (group.some((r) => r.checked)) return;
        const c = ctx(group[0]);
        for (const r of RULES) {
          if (!r.val || !r.keys.some((k) => c.includes(k))) continue;
          const w = norm(r.val);
          let target: any = null;
          if (w.includes("prefer not")) target = group.find((g) => DECLINE.some((dd) => labelFor(g).includes(dd)));
          if (!target) target = group.find((g) => labelFor(g).trim() && (labelFor(g).includes(w) || w.includes(labelFor(g).trim())));
          if (!target && (w === "yes" || w === "no")) target = group.find((g) => labelFor(g).trim() === w);
          if (target) { target.click(); break; }
        }
      });
    }, a);
  } catch {
    // Best-effort — never block submission on the heuristic answerer.
  }
}
