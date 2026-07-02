# In-Product Consent Copy — DeHashed Integration

The short click-through shown before first use (and again when the AUP version
changes). Acceptance is recorded: `user_id`, `aup_version`, `accepted_at`.
Keep it plain, honest, and un-scary but clear on responsibility.

---

## Consent modal

**Title:** Before you use DeHashed search

**Intro:**
> DeHashed returns data exposed in third-party breaches. You're using **your own
> DeHashed account** — JobsAI simply passes your searches to it. You're
> responsible for using this lawfully. Please confirm:

**Checkboxes (all required to enable):**
- [ ] I will use DeHashed search only for **lawful purposes I'm authorized to run** — such as monitoring exposure of data, accounts, or domains **I own or am permitted to investigate**.
- [ ] I will **not** use it for employment screening or any **FCRA** purpose, or to make an **adverse decision** about a person. JobsAI and DeHashed are **not** consumer reporting agencies.
- [ ] I have any **consent or authorization** required by law (including the RI Identity Theft Protection Act, and GDPR/CCPA where they apply), and I'll keep my own records.
- [ ] I understand results are **third-party breach data**, may be **inaccurate or outdated**, are provided **"as is,"** and that **JobsAI logs each search** for security and compliance.

**Links:** `Read the full Acceptable Use Policy →` (opens AUP)

**Buttons:**
- Primary (enabled only when all boxes checked): **Agree & enable DeHashed**
- Secondary: **Cancel**

---

## Persistent in-search reminder (banner above the search box)

> ⚠️ For lawful, authorized searches only — **not** for employment screening / FCRA
> use. You're responsible for consent and lawful use. Every search is logged.

---

## Result-view microcopy

- Passwords / hashes hidden by default: **`•••••• Reveal`**
- Footer on results: *Third-party breach data via DeHashed. Provided "as is" — verify independently. Do not use for FCRA/employment decisions.*

---

## Settings → Integrations card (connect flow)

**Heading:** DeHashed (breach-data search)
**Body:** Connect **your own** DeHashed API key to search breach-exposure data from
inside JobsAI. Your key is encrypted and used only to run your searches — JobsAI
never stores your results. Requires a paid DeHashed account (searches use your
DeHashed credits).
**Field:** DeHashed API key (stored encrypted) · **Button:** Connect
