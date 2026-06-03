// Optional rich marketing content per feature slug. When a slug has an entry,
// the feature page renders a split hero + FAQ; otherwise it uses the simple
// fallback layout. Add more features here over time.

export type HeadlineSeg = { t: string; tone?: "gradient" | "cta" };
export type FAQ = { q: string; a: string };

export type FeatureContent = {
  eyebrow: string;
  headline: HeadlineSeg[];
  subtext: string;
  ctaLabel: string;
  faqs: FAQ[];
};

export const FEATURE_CONTENT: Record<string, FeatureContent> = {
  "auto-apply": {
    eyebrow: "AI-Auto Apply",
    headline: [
      { t: "Apply to " },
      { t: "hundreds", tone: "gradient" },
      { t: " of " },
      { t: "jobs", tone: "cta" },
      { t: " while you " },
      { t: "sleep", tone: "cta" },
    ],
    subtext:
      "JobsAI Auto Apply does the work for you — automatically finding and applying to the best jobs based on your profile, skills, and preferences.",
    ctaLabel: "Start auto applying",
    faqs: [
      {
        q: "How does AI Auto Apply maintain application quality?",
        a: "Every submission is tailored, not blasted. JobsAI reads each job description, rewrites your resume to match it, and writes a role-specific cover letter — so each application reads like you wrote it for that company.",
      },
      {
        q: "Can I control which jobs get applied to automatically?",
        a: "Completely. You set target titles, locations, salary floor, seniority, remote preference, and must-have / exclude keywords. Turn on the approval queue and nothing is sent until you greenlight it.",
      },
      {
        q: "Does automation work across multiple job boards simultaneously?",
        a: "Yes. JobsAI applies across Lever, Ashby, Greenhouse, Workday and more in parallel, and de-duplicates roles that appear on several boards so you never apply twice.",
      },
      {
        q: "How quickly do automated applications get submitted after jobs post?",
        a: "New matches are discovered continuously and queued within hours of a role going live, so you're consistently among the first applicants — when response rates are highest.",
      },
      {
        q: "Will recruiters know my applications were automated?",
        a: "No. Each application is submitted like any candidate's — your tailored resume, screening answers, and a personalized cover letter. There's no automation footprint on the recruiter's end.",
      },
    ],
  },

  "interview-buddy": {
    eyebrow: "Interview Buddy",
    headline: [
      { t: "Walk in " },
      { t: "confident", tone: "gradient" },
      { t: ", clear & " },
      { t: "job-ready", tone: "cta" },
    ],
    subtext:
      "A smarter way to practice and ace interviews. Whether it's a mock session or the real thing, Interview Buddy gives you personalized questions, instant feedback, and role-specific guidance — all based on your resume and the job description.",
    ctaLabel: "Start preparing",
    faqs: [
      {
        q: "How does Interview Buddy help me prepare?",
        a: "It builds personalized practice from your resume and the job description — role-specific questions, instant feedback on every answer, and clear guidance on what to improve before the real thing.",
      },
      {
        q: "Can I run full mock interviews?",
        a: "Yes — practice in writing, by voice, or face-to-face with a realistic avatar, and get scored feedback on structure, clarity, pace, and confidence.",
      },
      {
        q: "Are the questions tailored to my role?",
        a: "Every question is generated from your resume and the specific job description, so you rehearse what you'll actually be asked — not generic prompts.",
      },
      {
        q: "What kind of feedback do I get?",
        a: "Instant, actionable feedback after each answer: STAR structure, clarity, filler words, and a stronger model answer to learn from.",
      },
      {
        q: "What's the live interview assist?",
        a: "An added advantage on top of prep: a desktop app that listens to your interviewer and surfaces tailored talking points in real time during the actual call — and it stays invisible to Zoom, Meet, and Teams screen sharing.",
      },
      {
        q: "How do I get access?",
        a: "Interview Buddy unlocks on any paid plan — practice right in the browser, and download the macOS or Windows app when you want live assist on real calls.",
      },
    ],
  },

  "job-discovery": {
    eyebrow: "AI Job Discovery",
    headline: [
      { t: "The right " },
      { t: "jobs", tone: "gradient" },
      { t: ", found " },
      { t: "while you sleep", tone: "cta" },
    ],
    subtext:
      "JobsAI scans thousands of boards every day and surfaces only the roles that fit your profile, skills, and preferences — no more endless searching.",
    ctaLabel: "Start discovering jobs",
    faqs: [
      { q: "Where does JobsAI find jobs?", a: "It continuously pulls from major boards and ATS career pages — Lever, Ashby, Greenhouse, Workday — plus niche sources, then normalizes and de-duplicates them into one clean feed." },
      { q: "How does it decide which jobs to show me?", a: "Every posting is scored against your profile — titles, skills, experience, location, salary, and keywords — so the best-fit roles rise to the top." },
      { q: "How fresh are the listings?", a: "New matches are pulled on a continuous schedule, often within hours of a role going live, so you see openings while they're still fresh." },
      { q: "Can I filter and control the results?", a: "Yes — filter by source, salary, keyword, and recency, set must-haves and exclusions, and import the ones you like with one click or in a batch." },
      { q: "Does it remove duplicate postings?", a: "It does. The same role across multiple boards is merged into a single entry, so your feed stays clean." },
    ],
  },

  "approval-queue": {
    eyebrow: "Approval Queue",
    headline: [
      { t: "Stay in " },
      { t: "control", tone: "gradient" },
      { t: " of every " },
      { t: "application", tone: "cta" },
    ],
    subtext:
      "Prefer to review before anything goes out? The approval queue holds each auto-prepared application until you approve or skip it — one tap each, or in bulk.",
    ctaLabel: "Set up approvals",
    faqs: [
      { q: "What is the approval queue?", a: "When you turn on 'require approval', JobsAI prepares each application — tailored resume, answers, and cover letter — and parks it in a queue for your sign-off instead of sending automatically." },
      { q: "Can I approve several at once?", a: "Yes — review cards individually, or bulk-approve a whole batch when you're confident." },
      { q: "What happens when I skip one?", a: "It's discarded and never submitted, and your preferences quietly learn from what you skip." },
      { q: "Will I be notified about pending approvals?", a: "Yes — you get in-app and optional email notifications when applications are waiting for review." },
      { q: "Can I switch between auto and approval modes?", a: "Anytime, from Preferences — go fully automatic, or keep a human in the loop for some or all roles." },
    ],
  },

  "application-tracker": {
    eyebrow: "Application Tracker",
    headline: [
      { t: "Every application, " },
      { t: "one", tone: "gradient" },
      { t: " clear " },
      { t: "pipeline", tone: "cta" },
    ],
    subtext:
      "A Kanban CRM for your whole job search — track every role from applied to offer, with notes, contacts, reminders, and attachments in one place.",
    ctaLabel: "Open the tracker",
    faqs: [
      { q: "What does the tracker do?", a: "It organizes every application into pipeline stages — applied, screening, interview, offer — so you always know where each one stands." },
      { q: "Can I add notes and contacts?", a: "Yes — attach recruiter contacts, notes, follow-up reminders, and files to each role." },
      { q: "Does it update automatically?", a: "Applications JobsAI submits land in the tracker automatically; you can also add roles you applied to manually." },
      { q: "Can I set reminders?", a: "Yes — schedule follow-up reminders so a promising lead never slips through the cracks." },
      { q: "Is there analytics?", a: "The tracker rolls up the basics like stage counts and conversion, so you can see what's working." },
    ],
  },

  "browser-extension": {
    eyebrow: "Chrome Extension",
    headline: [
      { t: "Import any job in " },
      { t: "one click", tone: "gradient" },
    ],
    subtext:
      "See a role you like on any board? The JobsAI Chrome extension detects it and imports it into your dashboard instantly — ready to tailor, score, and apply.",
    ctaLabel: "Get the extension",
    faqs: [
      { q: "Which sites does the extension work on?", a: "It detects job postings across major boards and company career pages, so you can capture roles wherever you find them." },
      { q: "How does importing work?", a: "One click pulls the job into JobsAI, where it's parsed, scored against your profile, and ready for tailoring and applying." },
      { q: "Do I need to log in again?", a: "No — it connects with your account using your personal key, so imports go straight to your dashboard." },
      { q: "Is it available now?", a: "It's a Manifest V3 Chrome extension — install it and pin it to your toolbar." },
      { q: "Does it work alongside auto-apply?", a: "Yes — imported jobs flow into the same pipeline, so you can auto-apply or review them like any other role." },
    ],
  },

  "anti-captcha": {
    eyebrow: "Anti-CAPTCHA",
    headline: [
      { t: "A " },
      { t: "CAPTCHA", tone: "gradient" },
      { t: " won't " },
      { t: "stop you", tone: "cta" },
    ],
    subtext:
      "Application forms guarded by reCAPTCHA or hCaptcha? JobsAI's browser agent clears them automatically, so automated applications don't stall on a checkbox.",
    ctaLabel: "Start auto applying",
    faqs: [
      { q: "Which CAPTCHAs can it solve?", a: "It handles reCAPTCHA v2/v3 and hCaptcha during the apply flow, via an integrated solving service." },
      { q: "What happens if one can't be solved?", a: "The application is flagged as 'manual required' so you can finish it yourself — nothing is silently dropped." },
      { q: "Is solving reliable?", a: "For the common challenge types it's highly reliable; unusual or brand-new challenges fall back to manual." },
      { q: "Do I need to configure anything?", a: "No setup on your end — it runs as part of the auto-apply agent." },
      { q: "Why does this matter?", a: "It keeps legitimate applications from stalling on routine bot-checks, while you stay in control of which roles you apply to." },
    ],
  },

  "scheduled-discovery": {
    eyebrow: "Auto-Discovery",
    headline: [
      { t: "Fresh matches, " },
      { t: "around the clock", tone: "gradient" },
    ],
    subtext:
      "JobsAI runs job discovery on a schedule — pulling new, matched roles for you every few hours, so your pipeline is always full without you lifting a finger.",
    ctaLabel: "Turn on auto-discovery",
    faqs: [
      { q: "How often does it run?", a: "On a recurring schedule throughout the day, so new postings are surfaced shortly after they go live." },
      { q: "What does it pull?", a: "Only roles that match your preferences and score well against your profile — quality over noise." },
      { q: "Do I get notified about new matches?", a: "Yes — new matches can trigger in-app and email notifications so you can act fast." },
      { q: "Can it feed auto-apply?", a: "Absolutely — discovered roles can flow straight into auto-apply or your approval queue." },
      { q: "Can I pause it?", a: "Anytime from Preferences — pause, resume, or adjust how aggressive discovery is." },
    ],
  },

  "resume-parsing": {
    eyebrow: "Resume Parsing",
    headline: [
      { t: "Your resume, " },
      { t: "structured", tone: "gradient" },
      { t: " in " },
      { t: "seconds", tone: "cta" },
    ],
    subtext:
      "Upload a PDF or DOCX and JobsAI extracts your contact details, work history, education, skills, and projects into a clean, editable profile.",
    ctaLabel: "Upload your resume",
    faqs: [
      { q: "What file types can I upload?", a: "PDF, DOC, and DOCX — JobsAI reads them and pulls out your structured profile." },
      { q: "What does it extract?", a: "Contact info, work experience, education, skills, and projects — ready to review and edit." },
      { q: "Can I fix anything it gets wrong?", a: "Yes — every field is editable, with validation, so you can correct or enrich the parsed data." },
      { q: "Does it keep multiple resumes?", a: "It stores your original plus any versions, so you can manage several profiles." },
      { q: "Is my resume data private?", a: "Yes — it's encrypted at rest and in transit, and never sold." },
    ],
  },

  "resume-tailoring": {
    eyebrow: "AI Resume Tailoring",
    headline: [
      { t: "A resume rewritten for " },
      { t: "every job", tone: "gradient" },
    ],
    subtext:
      "For each role, JobsAI rewrites your resume to match the job description — aligning keywords and bullets truthfully, so you pass ATS screens and read as a strong fit.",
    ctaLabel: "Tailor my resume",
    faqs: [
      { q: "How is the resume tailored?", a: "It aligns your summary, bullets, and keywords to the specific job description while keeping everything truthful to your real experience." },
      { q: "Will it invent experience?", a: "No — it rephrases and emphasizes what's already true; it doesn't fabricate roles or skills." },
      { q: "Does it help with ATS?", a: "Yes — keyword alignment and clean formatting are designed to pass applicant tracking systems." },
      { q: "Can I see what changed?", a: "A before/after view shows exactly what was adjusted, and you can edit further." },
      { q: "Can I export it?", a: "Yes — download the tailored resume as a polished PDF." },
    ],
  },

  "resume-templates": {
    eyebrow: "ATS Templates",
    headline: [
      { t: "Beautiful resumes that " },
      { t: "pass ATS", tone: "gradient" },
    ],
    subtext:
      "Pick from clean, recruiter-ready templates — Modern, Minimal, Classic, and Executive — and export a polished, ATS-friendly PDF in a click.",
    ctaLabel: "Build my resume",
    faqs: [
      { q: "How many templates are there?", a: "Four professionally designed templates — Modern, Minimal, Classic, and Executive." },
      { q: "Are they ATS-safe?", a: "Yes — they're built with clean, parseable structure so applicant tracking systems read them correctly." },
      { q: "Can I switch templates anytime?", a: "Instantly — preview your content in any template and export the one you like." },
      { q: "How do I export?", a: "Print-to-PDF straight from the browser for a crisp, shareable file." },
      { q: "Do they work with tailored resumes?", a: "Yes — your tailored content flows into any template." },
    ],
  },

  "ats-scanner": {
    eyebrow: "ATS Scanner",
    headline: [
      { t: "Know your " },
      { t: "ATS score", tone: "gradient" },
      { t: " before you " },
      { t: "apply", tone: "cta" },
    ],
    subtext:
      "Scan any resume against a role and get a 0–100 ATS score with the exact weak sections, formatting issues, and fixes to pass automated screening.",
    ctaLabel: "Scan my resume",
    faqs: [
      { q: "What does the score mean?", a: "It estimates how well your resume will pass applicant tracking systems for a given role, from 0 to 100." },
      { q: "What does it check?", a: "Keyword coverage, weak or missing sections, formatting issues, and buzzword overuse." },
      { q: "Does it tell me how to improve?", a: "Yes — it returns specific, actionable fixes you can apply right away." },
      { q: "Can I rescan after edits?", a: "As many times as you like — watch your score climb as you make changes." },
      { q: "Is it role-specific?", a: "It scores against the actual job description, not a generic checklist." },
    ],
  },

  "cover-letters": {
    eyebrow: "AI Cover Letters",
    headline: [
      { t: "A cover letter for " },
      { t: "every role", tone: "gradient" },
      { t: ", in " },
      { t: "your voice", tone: "cta" },
    ],
    subtext:
      "Generate personalized, company-specific cover letters in your tone — pick a length and style, edit freely, and save one per job.",
    ctaLabel: "Write my cover letter",
    faqs: [
      { q: "How personalized are they?", a: "Each letter is written for the specific role and company, drawing on your resume — not a generic template." },
      { q: "Can I control tone and length?", a: "Yes — choose the tone and length, then edit the result however you like." },
      { q: "Are they saved per job?", a: "Yes — every cover letter is stored alongside its job, so it's there when you apply." },
      { q: "Do auto-applications include one?", a: "When a role benefits from a cover letter, JobsAI generates and attaches one automatically." },
      { q: "Can I reuse or tweak them?", a: "Edit any letter and reuse your favorite phrasings across applications." },
    ],
  },

  "resume-translator": {
    eyebrow: "Resume Translator",
    headline: [
      { t: "Apply " },
      { t: "anywhere", tone: "gradient" },
      { t: ", in " },
      { t: "68+ languages", tone: "cta" },
    ],
    subtext:
      "Translate your resume into 68+ languages while keeping its structure and formatting intact — then preview it in any template and download a PDF.",
    ctaLabel: "Translate my resume",
    faqs: [
      { q: "How many languages are supported?", a: "Over 68 — translate your resume for roles and markets around the world." },
      { q: "Does formatting survive translation?", a: "Yes — structure and layout stay intact; only the content is translated." },
      { q: "Can I preview before downloading?", a: "You can preview the translated resume in all templates, then export a PDF." },
      { q: "Is the translation accurate for resumes?", a: "It uses a strong language model tuned for natural, professional phrasing — not literal word-for-word." },
      { q: "Can I keep multiple language versions?", a: "Yes — save translated versions alongside your originals." },
    ],
  },

  "linkedin-import": {
    eyebrow: "LinkedIn Import",
    headline: [
      { t: "Build your profile from " },
      { t: "LinkedIn", tone: "gradient" },
      { t: " in " },
      { t: "seconds", tone: "cta" },
    ],
    subtext:
      "No resume handy? Import your experience straight from a LinkedIn URL or pasted text, and JobsAI turns it into a structured profile you can use everywhere.",
    ctaLabel: "Import from LinkedIn",
    faqs: [
      { q: "How do I import?", a: "Paste your LinkedIn profile URL or the text of your profile, and JobsAI parses it into structured fields." },
      { q: "What if the URL doesn't work?", a: "There's a text-paste fallback, so you can always bring your profile in." },
      { q: "Is it stored as a resume?", a: "Yes — the imported profile becomes a resume version you can tailor and export." },
      { q: "Can I edit after importing?", a: "Of course — every field is editable and validated." },
      { q: "Do I need a resume too?", a: "No — LinkedIn import is enough to get started and use every tool." },
    ],
  },

  "follow-up-emails": {
    eyebrow: "Follow-up Emails",
    headline: [
      { t: "The perfect " },
      { t: "follow-up", tone: "gradient" },
      { t: ", written for you" },
    ],
    subtext:
      "JobsAI drafts polished, well-timed follow-up emails to recruiters and hiring managers — so you stay top of mind without staring at a blank screen.",
    ctaLabel: "Draft a follow-up",
    faqs: [
      { q: "When should I follow up?", a: "JobsAI suggests timely follow-ups after applying or interviewing, and drafts the message for you." },
      { q: "Are the emails personalized?", a: "Yes — each draft references the specific role, company, and stage you're at." },
      { q: "Can I edit before sending?", a: "Always — the draft is a starting point you can tweak to sound like you." },
      { q: "What tone do they use?", a: "Professional and warm by default, and you can adjust it." },
      { q: "Does it track who I've followed up with?", a: "Pair it with the Application Tracker to keep follow-ups organized per role." },
    ],
  },

  "job-matching": {
    eyebrow: "Job Match Scoring",
    headline: [
      { t: "See your " },
      { t: "fit", tone: "gradient" },
      { t: " for every " },
      { t: "role", tone: "cta" },
    ],
    subtext:
      "Every job is scored against your profile across skills, experience, title, location, salary, and keywords — so you spend time only on roles worth applying to.",
    ctaLabel: "Score my matches",
    faqs: [
      { q: "How is the match score calculated?", a: "It weighs skills, experience, job title, location, salary, keywords, and certifications against your profile." },
      { q: "What's a good score?", a: "Higher means stronger alignment, and the feed surfaces your best-fit roles first." },
      { q: "Can I see why I matched?", a: "Yes — the match explanation breaks down what helped and what's missing." },
      { q: "Does it factor in my preferences?", a: "It does — your titles, locations, salary floor, and must-haves all shape the score." },
      { q: "Can I act on high matches automatically?", a: "Yes — route strong matches into auto-apply or your approval queue." },
    ],
  },

  "keyword-gaps": {
    eyebrow: "Keyword Gaps",
    headline: [
      { t: "Close the " },
      { t: "keyword gap", tone: "gradient" },
      { t: " on every application" },
    ],
    subtext:
      "JobsAI explains your match score and highlights the exact keywords a role wants that your resume is missing — with suggestions to add them truthfully.",
    ctaLabel: "Find my gaps",
    faqs: [
      { q: "What are keyword gaps?", a: "The skills and terms a job description emphasizes that don't yet appear in your resume." },
      { q: "How does it help?", a: "It lists the missing keywords and suggests where to add them honestly, lifting both your ATS score and your fit." },
      { q: "Is this just keyword stuffing?", a: "No — it points to genuinely relevant terms tied to your real experience, not filler." },
      { q: "Does it explain my match?", a: "Yes — alongside the gaps, it explains what's driving your match score." },
      { q: "Can I apply the suggestions automatically?", a: "Resume tailoring uses these insights to align your resume per role." },
    ],
  },

  "salary-intel": {
    eyebrow: "Salary Intelligence",
    headline: [
      { t: "Never leave " },
      { t: "money", tone: "gradient" },
      { t: " on the " },
      { t: "table", tone: "cta" },
    ],
    subtext:
      "Get per-job salary estimates with a P25–P75 range, the factors driving pay, total-comp context, and negotiation tips — so you ask with confidence.",
    ctaLabel: "See salary insights",
    faqs: [
      { q: "How accurate are the estimates?", a: "Each role gets a P25/P50/P75 range based on the title, location, and market signals — a realistic band, not a single guess." },
      { q: "What drives the numbers?", a: "It breaks down the pay factors — seniority, location, skills — so you understand the range." },
      { q: "Does it help me negotiate?", a: "Yes — it includes negotiation tips and total-comp context for the specific role." },
      { q: "Is it per job?", a: "Yes — estimates are tailored to each posting, not a generic average." },
      { q: "Can I use it before applying?", a: "Absolutely — check the range up front to focus on roles that pay what you need." },
    ],
  },

  "skills-gap": {
    eyebrow: "Skills Gap Analysis",
    headline: [
      { t: "Learn the " },
      { t: "skills", tone: "gradient" },
      { t: " that get you " },
      { t: "hired", tone: "cta" },
    ],
    subtext:
      "JobsAI aggregates the gaps across all your saved jobs into a ranked list of the skills to learn next — with resources and quick wins to close them.",
    ctaLabel: "Analyze my skills",
    faqs: [
      { q: "How does it find my gaps?", a: "It compares your resume against all your saved and matched jobs, then ranks the skills that come up most often but are missing." },
      { q: "Does it tell me what to learn first?", a: "Yes — gaps are ranked by impact, so you focus on the skills that unlock the most roles." },
      { q: "Are there learning resources?", a: "It suggests resources and quick wins for each gap." },
      { q: "Is it based on real roles?", a: "Yes — it's grounded in the actual jobs you're targeting, not generic advice." },
      { q: "How often should I check?", a: "Revisit as you save new roles; the analysis updates with your pipeline." },
    ],
  },

  "company-research": {
    eyebrow: "Company Research",
    headline: [
      { t: "Walk in " },
      { t: "knowing", tone: "gradient" },
      { t: " the " },
      { t: "company", tone: "cta" },
    ],
    subtext:
      "For any role, JobsAI researches the company's culture, interview style, and the questions you're likely to face — so you're prepared before you apply or interview.",
    ctaLabel: "Research a company",
    faqs: [
      { q: "What does the research cover?", a: "Company culture, interview style, likely questions, and context that helps you stand out." },
      { q: "Where does it come from?", a: "It's generated for the specific company and role, summarized into a quick, useful brief." },
      { q: "How do I use it?", a: "Read it before applying to sharpen your materials, and again before interviews to prep." },
      { q: "Does it tie into interview prep?", a: "Yes — pair it with the interview suite to rehearse the questions you're likely to get." },
      { q: "Is it per role?", a: "Yes — research is tailored to the job and company you're looking at." },
    ],
  },

  "written-coach": {
    eyebrow: "AI Written Coach",
    headline: [
      { t: "Master your " },
      { t: "answers", tone: "gradient" },
      { t: ", one question at a time" },
    ],
    subtext:
      "Practice behavioral, technical, and leadership questions in writing and get instant feedback on STAR structure, clarity, and confidence — plus a stronger model answer.",
    ctaLabel: "Start practicing",
    faqs: [
      { q: "What kinds of questions can I practice?", a: "Behavioral, technical, and leadership questions, drawn from your resume and the target role." },
      { q: "What feedback do I get?", a: "Instant scoring on STAR structure, clarity, and confidence, plus an improved model answer to learn from." },
      { q: "Is it tailored to my role?", a: "Yes — questions and feedback are built from your resume and the specific job." },
      { q: "How is this different from voice or avatar?", a: "It's typed practice — ideal for crafting and polishing your STAR stories before you say them out loud." },
      { q: "Does it cost tokens?", a: "Written evaluations run within your plan's token allowance; heavier voice and avatar rounds cost more." },
    ],
  },

  "voice-interviewer": {
    eyebrow: "AI Voice Interviewer",
    headline: [
      { t: "Rehearse " },
      { t: "out loud", tone: "gradient" },
      { t: " with a real " },
      { t: "interviewer", tone: "cta" },
    ],
    subtext:
      "Have a spoken mock interview. The AI asks, follows up, and probes for specifics — then scores your pace, filler words, and confidence.",
    ctaLabel: "Start a voice interview",
    faqs: [
      { q: "How does the voice interview work?", a: "You speak your answers and the AI responds like a real interviewer — asking follow-ups and probing for detail." },
      { q: "What does it score?", a: "Your speaking pace, filler words, and confidence, with feedback to improve." },
      { q: "What's it best for?", a: "Phone screens and recruiter calls — anywhere you need to sound sharp out loud." },
      { q: "Is it tailored to the job?", a: "Yes — questions come from your resume and the exact role." },
      { q: "Does it use tokens?", a: "Voice rounds are metered per minute from your token balance." },
    ],
  },

  "avatar-room": {
    eyebrow: "AI Avatar Room",
    headline: [
      { t: "Face a " },
      { t: "realistic", tone: "gradient" },
      { t: " interviewer before the " },
      { t: "real one", tone: "cta" },
    ],
    subtext:
      "Step into a video interview with a lifelike AI avatar — eye contact, expressions, and webcam analysis of your body language and presence.",
    ctaLabel: "Enter the avatar room",
    faqs: [
      { q: "What is the avatar room?", a: "A face-to-face video round with a realistic AI interviewer that makes eye contact and reacts like a person." },
      { q: "What does it analyze?", a: "Webcam analysis scores your body language, presence, and delivery — not just your words." },
      { q: "What's it best for?", a: "High-stakes and executive interviews, where presence matters most." },
      { q: "Do I need a webcam?", a: "Yes — the avatar room uses your camera for the most realistic practice and feedback." },
      { q: "Does it cost tokens?", a: "Avatar rounds are the most advanced, so they're metered per minute from your token balance." },
    ],
  },

  "mock-interview": {
    eyebrow: "Mock Interview",
    headline: [
      { t: "Rehearse the " },
      { t: "real interview", tone: "gradient" },
      { t: " first" },
    ],
    subtext:
      "Run a role-specific mock interview — answer real questions and get instant, scored feedback with STAR analysis, so you walk in ready.",
    ctaLabel: "Start a mock interview",
    faqs: [
      { q: "How are the questions chosen?", a: "They're generated for the specific role and your background, so you practice what you'll actually be asked." },
      { q: "What feedback do I get?", a: "Instant scoring with STAR analysis and concrete suggestions to tighten each answer." },
      { q: "Can I do it by text, voice, or video?", a: "Yes — practice in writing, out loud, or face-to-face with an avatar." },
      { q: "Does it prep me for a specific company?", a: "Pair it with company research to rehearse the questions that company tends to ask." },
      { q: "How many can I do?", a: "Practice as much as you like within your plan; heavier voice and avatar rounds use tokens." },
    ],
  },

  "analytics": {
    eyebrow: "Analytics & Insights",
    headline: [
      { t: "See what's " },
      { t: "working", tone: "gradient" },
      { t: " in your search" },
    ],
    subtext:
      "Track response and interview rates, your best-performing resume versions, titles, and sources — so you can double down on what's landing interviews.",
    ctaLabel: "View my analytics",
    faqs: [
      { q: "What metrics does it show?", a: "Response rates, interview rates, and which resume versions, titles, and sources perform best." },
      { q: "How does it help?", a: "It reveals what's actually working so you can focus your energy and improve your hit rate." },
      { q: "Where does the data come from?", a: "From your real applications and outcomes tracked across JobsAI." },
      { q: "Is it updated automatically?", a: "Yes — metrics refresh as your applications progress." },
      { q: "Can it improve my strategy?", a: "Use the insights to pick better titles, resumes, and sources over time." },
    ],
  },

  "notifications": {
    eyebrow: "Notifications",
    headline: [
      { t: "Never miss a " },
      { t: "match", tone: "gradient" },
      { t: " or a " },
      { t: "reply", tone: "cta" },
    ],
    subtext:
      "Stay in the loop with in-app and email alerts for new matches, pending approvals, submitted applications, and recruiter replies.",
    ctaLabel: "Get started",
    faqs: [
      { q: "What will I be notified about?", a: "New matched roles, applications waiting for approval, successful submissions, and recruiter replies." },
      { q: "Which channels are supported?", a: "In-app notifications and email, so you're covered whether or not the app is open." },
      { q: "Can I control what I receive?", a: "Yes — tune which notifications you get so it's signal, not noise." },
      { q: "Are approvals included?", a: "Yes — you'll know the moment an application is waiting for your sign-off." },
      { q: "Do replies show up too?", a: "Recruiter replies and interview requests trigger alerts so you can respond fast." },
    ],
  },
};
