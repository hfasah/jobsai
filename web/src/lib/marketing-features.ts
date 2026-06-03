import type { LucideIcon } from "lucide-react";
import {
  Send, Search, CheckCircle2, Kanban, Puzzle, ShieldCheck, CalendarClock,
  FileText, Sparkles, Layers, Gauge, Mail, Languages, Import, MailCheck,
  Target, ListChecks, DollarSign, TrendingUp, Building2,
  Headphones, MessageSquareText, Mic, Video, ClipboardCheck, BarChart3, Bell,
} from "lucide-react";

export type FeatureItem = { slug: string; label: string; blurb: string; icon: LucideIcon };
export type FeatureGroup = { heading: string; tagline: string; items: FeatureItem[] };

// One source of truth for the marketing feature directory + footer links.
// Every feature links to /features/<slug>; the page stubs are filled in later.
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    heading: "Apply on autopilot",
    tagline: "The whole application pipeline, hands-off.",
    items: [
      { slug: "auto-apply", label: "Auto-Apply Agent", blurb: "Tailored applications submitted across Lever, Ashby, Greenhouse, Workday & more.", icon: Send },
      { slug: "job-discovery", label: "AI Job Discovery", blurb: "Thousands of boards scanned daily for roles that fit your profile.", icon: Search },
      { slug: "approval-queue", label: "Approval Queue", blurb: "Review and one-click approve before anything is sent on your behalf.", icon: CheckCircle2 },
      { slug: "application-tracker", label: "Application Tracker", blurb: "A Kanban CRM for every application, note, contact, and reminder.", icon: Kanban },
      { slug: "browser-extension", label: "Chrome Extension", blurb: "Import any job from any board with a single click.", icon: Puzzle },
      { slug: "anti-captcha", label: "Anti-CAPTCHA", blurb: "Our agent clears reCAPTCHA and hCaptcha automatically.", icon: ShieldCheck },
      { slug: "scheduled-discovery", label: "Auto-Discovery", blurb: "Fresh, matched roles pulled for you every few hours.", icon: CalendarClock },
    ],
  },
  {
    heading: "Resumes & documents",
    tagline: "Recruiter-ready materials for every role.",
    items: [
      { slug: "resume-parsing", label: "Resume Parsing", blurb: "Upload a PDF or DOCX and we structure your whole profile in seconds.", icon: FileText },
      { slug: "resume-tailoring", label: "AI Resume Tailoring", blurb: "Every application gets a resume rewritten to match the job description.", icon: Sparkles },
      { slug: "resume-templates", label: "ATS Templates", blurb: "Four recruiter-ready templates, exported straight to PDF.", icon: Layers },
      { slug: "ats-scanner", label: "ATS Scanner", blurb: "A 0–100 score with actionable fixes before you apply.", icon: Gauge },
      { slug: "cover-letters", label: "AI Cover Letters", blurb: "Personalised letters in your tone, aligned to each company.", icon: Mail },
      { slug: "resume-translator", label: "Resume Translator", blurb: "Translate your resume into 68+ languages, formatting intact.", icon: Languages },
      { slug: "linkedin-import", label: "LinkedIn Import", blurb: "Build your profile from a LinkedIn URL or pasted text.", icon: Import },
      { slug: "follow-up-emails", label: "Follow-up Emails", blurb: "Polished recruiter follow-ups generated and ready to send.", icon: MailCheck },
    ],
  },
  {
    heading: "Matching & intelligence",
    tagline: "Know where you stand on every job.",
    items: [
      { slug: "job-matching", label: "Job Match Scoring", blurb: "Every role scored against your skills, experience, and targets.", icon: Target },
      { slug: "keyword-gaps", label: "Keyword Gaps", blurb: "See exactly which keywords you're missing — and how to add them.", icon: ListChecks },
      { slug: "salary-intel", label: "Salary Intelligence", blurb: "Range estimates and negotiation tips for every posting.", icon: DollarSign },
      { slug: "skills-gap", label: "Skills Gap Analysis", blurb: "Spot the skills to learn next across all your saved jobs.", icon: TrendingUp },
      { slug: "company-research", label: "Company Research", blurb: "Culture, interview style, and the questions you'll likely face.", icon: Building2 },
    ],
  },
  {
    heading: "Interview suite",
    tagline: "From landed interview to signed offer.",
    items: [
      { slug: "interview-buddy", label: "Interview Buddy", blurb: "AI interview prep from your resume and the job — personalized questions, instant feedback, and mock sessions, plus optional live assist.", icon: Headphones },
      { slug: "written-coach", label: "AI Written Coach", blurb: "Typed Q&A with instant STAR structure and clarity scoring.", icon: MessageSquareText },
      { slug: "voice-interviewer", label: "AI Voice Interviewer", blurb: "A spoken mock interview that follows up and probes for specifics.", icon: Mic },
      { slug: "avatar-room", label: "AI Avatar Room", blurb: "Face a realistic video interviewer with body-language analysis.", icon: Video },
      { slug: "mock-interview", label: "Mock Interview", blurb: "Role-specific question sets with scored, actionable feedback.", icon: ClipboardCheck },
      { slug: "analytics", label: "Analytics & Insights", blurb: "Response and interview rates, plus your best-performing resumes.", icon: BarChart3 },
      { slug: "notifications", label: "Notifications", blurb: "In-app and email alerts for every match, approval, and reply.", icon: Bell },
    ],
  },
];

export const featureHref = (slug: string) => `/features/${slug}`;

// Flat lookup for the /features/[slug] stub page.
export const FEATURE_BY_SLUG: Record<string, FeatureItem> = Object.fromEntries(
  FEATURE_GROUPS.flatMap((g) => g.items).map((it) => [it.slug, it])
);
