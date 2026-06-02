# JobsAI

AI-powered job application assistant — match jobs to your profile, tailor resumes and cover letters, scan for ATS alignment, and track applications.

## Project docs

Planning and build phases live in [`.codespring/`](.codespring/):

- [`project-overview.md`](.codespring/project-overview.md) — features and tech stack
- [`CURSOR_RUNBOOK.md`](.codespring/CURSOR_RUNBOOK.md) — step-by-step build phases

# Phase 1 — Clerk setup

1. Create a free app at [Clerk Dashboard](https://dashboard.clerk.com).
2. Copy **Publishable key** and **Secret key** into `web/.env.local` (see `.env.example`).
3. In Clerk → **Paths**, set sign-in URL to `/sign-in` and sign-up to `/sign-up`.
4. Restart the dev server: `npm run dev`

## Auth routes

| Route | Purpose |
|-------|---------|
| `/sign-in` | Log in |
| `/sign-up` | Create account |
| `/dashboard` | Protected page (requires login) |


1. **Install dependencies** (only needed the first time):

   ```bash
   cd web && npm install
   ```

2. **Start the dev server**:

   ```bash
   npm run dev
   ```

   Run that from the project root, or from `web/` with `npm run dev` there.

3. **Open the app**: [http://localhost:3000](http://localhost:3000)

You should see a simple JobsAI welcome page. No features are implemented yet.

## Folder structure

```
jobai/
├── .codespring/     # CodeSpring planning (overview, runbook, PRDs when added)
├── web/             # Next.js frontend (TypeScript, Tailwind, ShadCN)
│   └── src/
│       ├── app/           # Pages and routes
│       ├── components/    # UI and layout components
│       ├── lib/           # Shared utilities
│       └── types/         # TypeScript types
└── package.json     # Root scripts (dev, build, lint)
```

## Tech stack (from overview)

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, ShadCN UI
- **Backend** (later): Node.js API, PostgreSQL, pgvector, queues, etc.

Build features one phase at a time using the runbook — do not skip ahead.
