# Browser Agent

Playwright-based browser automation service that fills and submits job applications on platforms that don't have a public API (Greenhouse, Workday, SmartRecruiters, BambooHR, iCIMS).

## How it works

The Next.js app calls `POST /apply` with the job URL, profile data, and resume. The agent:
1. Opens a headless Chrome browser
2. Navigates to the job application page
3. Fills form fields (name, email, phone, resume, LinkedIn, cover letter)
4. Detects reCAPTCHA — if found, returns `manual_required` instead of failing
5. Submits and returns the result

## Platform support

| Platform | Status |
|---|---|
| Greenhouse | Automated (CAPTCHA → manual fallback) |
| Workday | Generic filler (partial — Workday is complex) |
| SmartRecruiters | Generic filler |
| BambooHR | Generic filler |
| iCIMS | Generic filler |

## Deploy (Railway recommended)

1. Create a new Railway project from this directory
2. Set env vars: `BROWSER_AGENT_SECRET`, `PORT=4000`
3. Railway auto-detects Node.js and runs `npm start`
4. Add `BROWSER_AGENT_URL=https://your-service.railway.app` and `BROWSER_AGENT_SECRET` to your Vercel env vars

## Local development

```bash
cd services/browser-agent
npm install
npx playwright install chromium   # download browser binary
cp .env.example .env
npm run dev
```

Test:
```bash
curl -X POST http://localhost:4000/health
```

## API

### POST /apply

```json
{
  "platform": "greenhouse",
  "sourceUrl": "https://boards.greenhouse.io/company/jobs/123",
  "profile": {
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "phone": "+1 555 000 0000",
    "linkedin_url": "https://linkedin.com/in/janesmith"
  },
  "resumeBase64": "...",
  "resumeMime": "application/pdf",
  "resumeFilename": "resume.pdf",
  "coverLetter": "Dear Hiring Manager, ..."
}
```

Response:
```json
{ "status": "submitted" }
{ "status": "manual_required", "message": "CAPTCHA detected" }
{ "status": "failed", "message": "Error detail" }
```
