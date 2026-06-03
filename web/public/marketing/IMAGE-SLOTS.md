# Marketing image slots

Drop your own real / UGC images here. Each slot renders a branded placeholder
(showing its target path) until the file exists — then it appears automatically
(a server-side check flips the slot on; no code change needed).

To add an image:

1. Export it as **WebP** at the path below, under `web/public`.
   (Have a PNG/JPG? Run `node scripts/optimize-marketing-images.mjs` to convert
   any `.png` in this folder to optimized WebP.)
2. That's it — reload the page and the slot shows your image.

Suggested ratio is a guide; slots use `object-cover`, so off-ratio images crop.
The "What to show" notes are content suggestions, not requirements.

## Home page (`src/app/page.tsx`)

| Path | Ratio | What to show |
|------|-------|--------------|
| `/marketing/product-overview.webp` | 16:9 | A real screenshot of the JobsAI dashboard (auto-apply pipeline, match scores, activity feed). |
| `/marketing/community-lifestyle.webp` | 21:9 | Real customers / job seekers who landed offers — UGC photos, smiling, on laptops or video calls. |

## Feature pages (`src/app/features/[slug]/page.tsx`)

One image per feature, at `/marketing/features/<slug>.webp` (≈16:9). Use a real
product screenshot of that feature, or relevant UGC.

- `/marketing/features/auto-apply.webp`
- `/marketing/features/job-discovery.webp`
- `/marketing/features/approval-queue.webp`
- `/marketing/features/application-tracker.webp`
- `/marketing/features/browser-extension.webp`
- `/marketing/features/anti-captcha.webp`
- `/marketing/features/scheduled-discovery.webp`
- `/marketing/features/resume-parsing.webp`
- `/marketing/features/resume-tailoring.webp`
- `/marketing/features/resume-templates.webp`
- `/marketing/features/ats-scanner.webp`
- `/marketing/features/cover-letters.webp`
- `/marketing/features/resume-translator.webp`
- `/marketing/features/linkedin-import.webp`
- `/marketing/features/follow-up-emails.webp`
- `/marketing/features/job-matching.webp`
- `/marketing/features/keyword-gaps.webp`
- `/marketing/features/salary-intel.webp`
- `/marketing/features/skills-gap.webp`
- `/marketing/features/company-research.webp`
- `/marketing/features/interview-buddy.webp`
- `/marketing/features/written-coach.webp`
- `/marketing/features/voice-interviewer.webp`
- `/marketing/features/avatar-room.webp`
- `/marketing/features/mock-interview.webp`
- `/marketing/features/analytics.webp`
- `/marketing/features/notifications.webp`

## Optional: footer community avatars

`src/components/marketing/site-footer.tsx` uses CSS gradient initials today.
To use real customer portraits, drop square images in
`/marketing/community/01.webp … 12.webp` and swap the avatar band for `<Image>`.
