# JobsAI Marketing Studio

Sanity Studio for the JobsAI Enterprise marketing surface. Marketing edits
content here; `app.jobsai.work` renders it. Engineering owns the schemas in
`schemas/` (the block whitelist); marketing owns the documents.

## One-time setup

1. Create the project at sanity.io (free plan): new project "JobsAI Marketing",
   dataset `production`. Note the **project ID**.
2. `cp .env.example .env` and fill in `SANITY_STUDIO_PROJECT_ID`.
3. `npm install`
4. `npx sanity dev` → local studio at http://localhost:3333 (log in with the
   Sanity account).
5. `npx sanity deploy` → hosted studio at `https://<name>.sanity.studio` —
   this is the URL marketing uses. Invite editors from sanity.io → project →
   Members (role: Editor).

## Wire the app (Vercel → jobsai-enterprise env)

- `NEXT_PUBLIC_SANITY_PROJECT_ID` = the project ID
- `NEXT_PUBLIC_SANITY_DATASET` = `production`
- `SANITY_REVALIDATE_SECRET` = a random hex string

The dataset stays **public** (default) — marketing content is public by
definition and the app reads it tokenlessly.

## Publish webhook (instant refresh, no deploys)

sanity.io → project → API → Webhooks → Create:

- URL: `https://app.jobsai.work/api/revalidate?secret=<SANITY_REVALIDATE_SECRET>`
- Trigger on: create, update, delete
- Filter: `_type in ["siteBanner", "landingPage"]`
- Projection: `{_type, "slug": slug.current}`

## What marketing can create

- **Landing page** → live at `app.jobsai.work/enterprise/lp/<slug>` seconds
  after Publish. Composed from the block whitelist (hero, text, feature grid,
  FAQ, CTA, booking widget).
- **Site banner** → scheduled promo bar on the public enterprise pages
  (message, promo code, color, start/end window). Appears and disappears on
  schedule with no deploy.

## Adding a new block type (engineering)

1. Schema in `schemas/blocks.ts` + register in `schemas/index.ts` and the
   landingPage `blocks` array.
2. Renderer in `web/src/components/enterprise/marketing-blocks.tsx`.
3. `npx sanity deploy` + merge the app PR.
