# Auto-apply browser-profile reuse (Skyvern workflow path)

Cost lever #2: reuse a user's saved login (cookies) per job board so repeat
applies **skip the login steps** (~30–40% fewer Skyvern steps). Skyvern only
supports reusable **browser profiles** on **workflow** runs (not `run_task`), so
this path runs an apply *workflow* instead of a task, attaches the saved profile,
and snapshots a fresh profile after each successful run.

**It is OFF until `SKYVERN_APPLY_WORKFLOW_ID` is set.** With it unset, auto-apply
uses the existing `run_task` path unchanged.

## One-time setup

1. **Run migration** `web/supabase/129_agent_board_profiles.sql`.

2. **Create the apply workflow in Skyvern** (app.skyvern.com → Workflows). Make a
   single prompt/task block whose instructions mirror `buildPrompt` in
   `src/lib/skyvern.ts` (dismiss popups → find Apply → log in/sign up with the
   email + `account_password` if required → fill every field → upload the resume
   from `resume_url` → paste `cover_letter` → solve CAPTCHA → submit). Declare
   these **workflow parameters** (names must match exactly — they're what the
   route sends in `parameters`):

   | parameter | meaning |
   |---|---|
   | `url` | job posting / application URL (the workflow's start URL) |
   | `first_name`, `last_name`, `email`, `phone`, `city`, `country` | applicant |
   | `linkedin_url`, `github_url`, `portfolio_url` | optional links |
   | `authorized_to_work`, `requires_sponsorship` | "Yes"/"No" |
   | `account_password` | password to log into / create a board account |
   | `resume_url` | signed URL to the résumé PDF to upload |
   | `cover_letter` | cover-letter text (may be empty) |

3. **Set env** on the consumer (jobsai.work) Vercel project:
   ```
   SKYVERN_APPLY_WORKFLOW_ID=wpid_xxxxxxxx
   ```

## How it runs (per apply)

- `agent-apply` resolves the board from the URL. For account-based boards
  (LinkedIn/Indeed/ZipRecruiter/Dice/Workable) it looks up the saved
  `browser_profile_id` for `(user, board)` and attaches it; it also sets
  `persist_browser_session=true` so the run's state can be snapshotted.
- On the completion webhook (status `completed`), `createBrowserProfile(run_id)`
  snapshots a fresh `bp_…` profile, upserted into `agent_board_profiles` for that
  `(user, board)` — so the **next** apply to that board starts already logged in.
- "manual"/unknown ATS hosts are guest applies → no profile is keyed for them.

## Validate before trusting it

This path can't be exercised without the live `SKYVERN_API_KEY` + a created
workflow, so after setup do **one** real apply to e.g. LinkedIn and confirm:
1. the run uses the workflow (Skyvern dashboard shows a workflow run, not a task);
2. `agent_board_profiles` gets a `bp_…` row after it completes;
3. a **second** apply to the same board shows fewer steps (no login).

Endpoints used (verify against current Skyvern API if they change):
`POST /v1/run/workflows`, `POST /v1/browser_profiles` (snapshot from
`workflow_run_id`), `GET /v1/runs/{id}`.
