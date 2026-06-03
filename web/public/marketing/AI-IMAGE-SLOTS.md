# AI image slots

Every slot below renders a branded placeholder until the file exists. To go live:

1. Generate the image with the suggested prompt.
2. Save it to the exact path under `web/public` (so `/public/marketing/...`).
3. In the component call, set `ready` (e.g. `<AIImageSlot ready ... />`). The
   feature pages and home slots already point at these paths.

Keep images dark-themed, purple/magenta accents, no real brand logos.

## Home page (`src/app/page.tsx`)

| Path | Ratio | Prompt |
|------|-------|--------|
| `/marketing/product-overview.png` | 16:9 | Dark JobsAI dashboard: auto-apply pipeline, match scores, and an activity feed. Purple/magenta accents, glassy cards. |
| `/marketing/community-lifestyle.png` | 21:9 | Wide, bright editorial photo collage of diverse happy young professionals celebrating new jobs — laptops, video calls, confident smiles. |

## Feature pages (`src/app/features/[slug]/page.tsx`)

One product shot per feature, at `/marketing/features/<slug>.png` (16:9).
Prompt template: *Dark, modern SaaS dashboard UI showing "<Feature>" — <blurb>. Purple/magenta accents, clean cards, no real logos.*

- `/marketing/features/auto-apply.png`
- `/marketing/features/job-discovery.png`
- `/marketing/features/approval-queue.png`
- `/marketing/features/application-tracker.png`
- `/marketing/features/browser-extension.png`
- `/marketing/features/anti-captcha.png`
- `/marketing/features/scheduled-discovery.png`
- `/marketing/features/resume-parsing.png`
- `/marketing/features/resume-tailoring.png`
- `/marketing/features/resume-templates.png`
- `/marketing/features/ats-scanner.png`
- `/marketing/features/cover-letters.png`
- `/marketing/features/resume-translator.png`
- `/marketing/features/linkedin-import.png`
- `/marketing/features/follow-up-emails.png`
- `/marketing/features/job-matching.png`
- `/marketing/features/keyword-gaps.png`
- `/marketing/features/salary-intel.png`
- `/marketing/features/skills-gap.png`
- `/marketing/features/company-research.png`
- `/marketing/features/interview-buddy.png`
- `/marketing/features/written-coach.png`
- `/marketing/features/voice-interviewer.png`
- `/marketing/features/avatar-room.png`
- `/marketing/features/mock-interview.png`
- `/marketing/features/analytics.png`
- `/marketing/features/notifications.png`

## Optional: footer community avatars

`src/components/marketing/site-footer.tsx` currently uses CSS gradient initials.
To swap for real AI portraits, drop square images in
`/marketing/community/01.png … 12.png` and replace the avatar band with `<Image>`.
Prompt: *square studio portrait of a friendly young professional, soft purple
rim light, neutral dark background.*
