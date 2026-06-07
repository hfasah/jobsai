# JobsAI — For LinkedIn (Chrome Extension)

A Manifest V3 Chrome extension that lets JobsAI users **save LinkedIn jobs to their
dashboard in one click** and **autofill LinkedIn Easy Apply** from their saved
JobsAI profile.

## What it does

On any LinkedIn job page a floating **JobsAI** button appears (bottom-right):

- **Save to JobsAI** — imports the current job into the user's dashboard via the
  authenticated `POST /api/extension/import` endpoint (no scraping of private data;
  it sends the public job URL and the server parses it).
- **Easy Apply — autofill** — opens LinkedIn's native Easy Apply modal and fills the
  basic contact/screening fields (name, email, phone, location, work-authorization,
  links, years of experience) from `GET /api/extension/profile`. It **never
  auto-submits** — the user reviews and clicks the final button themselves.

The user's API key never touches the page: all authenticated calls happen in the
background service worker.

## Bulk "Apply to All"

From **JobsAI → My Jobs**, the user multi-selects jobs and clicks **Apply to All**.
The dashboard opens a port to this extension (`chrome.runtime.connect`) and streams
the batch. The background worker then, per job:

- **Direct boards (LinkedIn today):** opens the listing in a background tab, runs
  the Easy Apply step-loop (autofill → advance → submit), and reports `applied`. If
  a required question can't be answered from the profile, it stops at `needs_review`
  instead of submitting junk.
- **Assisted / manual boards:** flagged `needs_review` for the user to finish — never
  auto-submitted in bulk.

Live progress (applied / review / failed) streams back over the port; each outcome is
also logged to `POST /api/extension/apply-result`. Board capability lives in
`src/lib/job-boards.ts` (and is mirrored in `apply-runner.js` + `background.js`) — flip
a board to `direct` there once its adapter is hardened against the live site.

## Architecture

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest. Pinned `key` → stable extension ID `klngoglpcfbcjcomnefapbknpgkbffoe`. |
| `background.js` | Service worker. Holds the API key, makes authenticated API calls, handles `externally_connectable` messages + the bulk-apply port queue. |
| `content-linkedin.js` | Floating UI on `*.linkedin.com`: Save + single Easy Apply autofill. |
| `apply-runner.js` | Idle on every supported board; runs an application when the background worker sends `RUN_APPLY`. |
| `content.css` | Styles for the injected UI. |
| `popup.html/js/css` | Toolbar popup: connection status, manual key entry, disconnect. |
| `icons/` | Toolbar/store icons. |

## Connecting an account

Two ways:

1. **Automatic** — signed-in users open `https://jobsai.work/dashboard/extension`.
   The page calls `chrome.runtime.sendMessage(<extId>, { type: "JOBSAI_CONNECT", apiKey })`
   (allowed by `externally_connectable`), and the extension stores the key.
2. **Manual** — paste the `jsk_…` key from **JobsAI → Extension** into the popup.

## Install (development / load unpacked)

1. Download the extension zip and extract it to a folder.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extracted folder.
5. Open any LinkedIn job — the floating JobsAI button appears.

## Local development against localhost

`externally_connectable` already allows `http://localhost:3000/*`. To point the
extension at a local API, set `apiBase` in extension storage (e.g. from the
service-worker console: `chrome.storage.local.set({ apiBase: "http://localhost:3000" })`),
or connect from the local dashboard which passes `apiBase` along.

## Notes

- We intentionally do **not** auto-submit applications or loop through job lists —
  that keeps the extension within LinkedIn's terms and protects users' accounts.
- The pinned manifest `key` keeps the extension ID stable so the website can always
  reach it. The matching private key lives outside the repo (do not commit it).
