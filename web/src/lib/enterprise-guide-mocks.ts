// Illustration specs for guide articles. Each describes a stylized "app screen"
// rendered by <GuideMockup> using the product's design tokens — an honest mockup
// (not a real screenshot), with a highlight + annotation pointing to what the
// surrounding steps describe. Sample data uses Jane Doe / John Doe.

export type GuideMockItem = { label: string; sub?: string; badge?: string; action?: string; highlight?: boolean };
export type GuideMockField = { label: string; value: string; highlight?: boolean };
export type GuideMockStat = { label: string; value: string; highlight?: boolean };
export type GuideMockColumn = { title: string; cards: string[]; highlight?: boolean };
export type GuideMockStep = { day: string; subject: string; ai?: boolean; highlight?: boolean };

export type GuideMock = {
  title: string;
  subtitle?: string;
  icon?: string;
  kind: "list" | "feed" | "form" | "stats" | "board" | "steps";
  feedUrl?: string;
  items?: GuideMockItem[];
  fields?: GuideMockField[];
  stats?: GuideMockStat[];
  columns?: GuideMockColumn[];
  steps?: GuideMockStep[];
  annotation?: string;
};

export const GUIDE_MOCKS: Record<string, GuideMock | GuideMock[]> = {
  welcome: {
    title: "Dashboard", icon: "📊", kind: "stats",
    stats: [
      { label: "Open roles", value: "8" },
      { label: "Candidates", value: "1,240" },
      { label: "Interviews this week", value: "12", highlight: true },
      { label: "Offers out", value: "3" },
    ],
    annotation: "Your Dashboard summarizes what needs attention today — here, 12 interviews are scheduled this week.",
  },
  "set-up-workspace": {
    title: "Settings → Branding", icon: "🧑‍💼", kind: "form",
    fields: [
      { label: "Company name", value: "Acme Talent" },
      { label: "Brand color", value: "#7C3AED", highlight: true },
      { label: "Logo", value: "acme-logo.png" },
      { label: "Email “from” name", value: "Acme Talent" },
    ],
    annotation: "Your brand color (and logo) flow through to career pages, candidate portals, and outreach emails.",
  },
  "invite-your-team": {
    title: "Team & Access", icon: "👥", kind: "list",
    items: [
      { label: "Jane Doe", sub: "jane.doe@acme.com", badge: "Admin" },
      { label: "John Doe", sub: "john.doe@acme.com", badge: "Pending invite", action: "Resend", highlight: true },
    ],
    annotation: "Invite by work email and pick a role. Pending invites show here until the person accepts.",
  },
  "post-your-first-job": [
    {
      title: "Jobs → New job", icon: "💼", kind: "form",
      fields: [
        { label: "Title", value: "Senior Product Designer" },
        { label: "Location", value: "Remote (US)" },
        { label: "Employment type", value: "Full-time" },
        { label: "Description", value: "✨ Generated with AI", highlight: true },
      ],
      annotation: "Use “Generate with AI” to draft the description and qualifications from the title and a few details.",
    },
    {
      title: "Job Boards", icon: "🌐", kind: "feed",
      subtitle: "Post once — your single feed distributes to every connected board automatically.",
      feedUrl: "https://app.jobsai.work/api/feeds/acme/jobs.xml",
      fields: [{ label: "Public careers page", value: "https://app.jobsai.work/careers/acme", highlight: true }],
      items: [
        { label: "Google for Jobs", sub: "Largest — Google Search", badge: "Live", action: "Setup" },
        { label: "Indeed", sub: "250M+ visitors/mo", action: "Setup" },
        { label: "ZipRecruiter", sub: "110M+ job seekers", action: "Setup" },
      ],
      annotation: "Share your public careers page link with candidates; connected boards pull from your feed automatically.",
    },
  ],
  "appearance-and-preferences": {
    title: "Appearance", icon: "🎨", kind: "list",
    items: [
      { label: "Light" },
      { label: "Dark" },
      { label: "System", badge: "Active", highlight: true },
    ],
    annotation: "Choose Light, Dark, or System — your selection is remembered on this device.",
  },
  "ai-sourcing": {
    title: "Sourcing", icon: "✨", kind: "list",
    subtitle: "“Senior React engineers open to remote”",
    items: [
      { label: "Jane Doe", sub: "Strong system-design background, 6 yrs", badge: "92% match", action: "Outreach", highlight: true },
      { label: "John Doe", sub: "Full-stack, React + Node, 4 yrs", badge: "87% match", action: "Add" },
    ],
    annotation: "Results are ranked with a fit reason. Use Outreach to email them, or Add to pipeline.",
  },
  "candidates-and-pools": {
    title: "Candidates", icon: "🗂️", kind: "list",
    items: [
      { label: "Jane Doe", sub: "Product Designer", badge: "Design pool" },
      { label: "John Doe", sub: "Frontend Engineer", badge: "Engineering pool", highlight: true },
    ],
    annotation: "Group candidates into Talent Pools (e.g. “Engineering”) to reuse them for future roles.",
  },
  "ai-scoring": {
    title: "Top Picks", icon: "🎯", kind: "list",
    items: [
      { label: "Jane Doe", sub: "Meets all must-haves; strong portfolio", badge: "94 · Top pick", highlight: true },
      { label: "John Doe", sub: "Strong frontend; lighter on leadership", badge: "88" },
    ],
    annotation: "AI scores each applicant against the role; Top Picks rise to the top with an explainable summary.",
  },
  "compare-candidates": {
    title: "Compare", icon: "⚖️", kind: "board",
    columns: [
      { title: "Jane Doe", cards: ["Match 91%", "6 yrs experience", "Strong: system design"], highlight: true },
      { title: "John Doe", cards: ["Match 86%", "4 yrs experience", "Strong: frontend"] },
    ],
    annotation: "Select two or more candidates and Compare to weigh strengths and gaps side by side.",
  },
  "manage-your-pipeline": {
    title: "Pipeline — Senior Product Designer", icon: "🧭", kind: "board",
    columns: [
      { title: "Applied", cards: ["Jane Doe", "+3 more"] },
      { title: "Screen", cards: ["John Doe"] },
      { title: "Interview", cards: ["Jane Doe"], highlight: true },
      { title: "Offer", cards: [] },
    ],
    annotation: "Drag candidates between stages. Open a card to add notes, scorecards, and @mentions.",
  },
  "ai-screening": {
    title: "AI Screening — Jane Doe", icon: "🤖", kind: "stats",
    stats: [
      { label: "Recommendation", value: "Advance", highlight: true },
      { label: "Match", value: "92%" },
      { label: "Risk", value: "Low" },
      { label: "Interview kit", value: "Ready" },
    ],
    annotation: "AI screening returns a recommendation, strengths, and risks — and can generate an interview kit.",
  },
  "create-a-campaign": {
    title: "Campaigns → New campaign", icon: "📣", kind: "steps",
    steps: [
      { day: "Day 0", subject: "Worth a quick chat about Senior PD?", ai: true },
      { day: "+3 days", subject: "Following up — Senior Product Designer", highlight: true },
      { day: "+5 days", subject: "Last note on the role" },
    ],
    annotation: "Each step is an email with its own delay. Add up to 12; reorder or edit anytime.",
  },
  "ai-personalized-emails": {
    title: "Campaign step", icon: "🪄", kind: "steps",
    steps: [
      { day: "Day 0 · AI-personalized", subject: "Hi Jane — loved your work on design systems", ai: true, highlight: true },
    ],
    annotation: "With AI on, the step is rewritten for each candidate at send time — warmer, still on message.",
  },
  "enroll-and-track": {
    title: "Campaign analytics", icon: "📈", kind: "stats",
    stats: [
      { label: "Enrolled", value: "48" },
      { label: "Emails sent", value: "120" },
      { label: "Replied", value: "14", highlight: true },
      { label: "Reply rate", value: "12%" },
    ],
    annotation: "Per-step sent / opened / replied is tracked automatically; replies stop the sequence.",
  },
  "ai-interviews": {
    title: "AI Interviews", icon: "🎙️", kind: "list",
    items: [
      { label: "Jane Doe", sub: "Completed · Score 8.6 / 10", badge: "Voice", highlight: true },
      { label: "John Doe", sub: "Invited · awaiting completion", badge: "Avatar" },
    ],
    annotation: "Send a voice or avatar interview; review the transcript and score on the candidate’s profile.",
  },
  "schedule-interviews": {
    title: "Schedule", icon: "📅", kind: "list",
    items: [
      { label: "Tue, 10:00 — Phone screen", sub: "Jane Doe · 30 min", badge: "Confirmed", highlight: true },
      { label: "Wed, 14:00 — Onsite panel", sub: "John Doe · 90 min", badge: "Pending" },
    ],
    annotation: "Candidates self-book from your availability; confirmed interviews sync to your calendar.",
  },
  "offers-esignature": {
    title: "Offers → New offer", icon: "📄", kind: "form",
    fields: [
      { label: "Candidate", value: "Jane Doe" },
      { label: "Role", value: "Senior Product Designer" },
      { label: "Base salary", value: "$145,000" },
      { label: "Status", value: "Awaiting signature", highlight: true },
    ],
    annotation: "Generate the offer, route for approval if needed, then send for e-signature.",
  },
  "hiring-manager-workspace": {
    title: "My Workspace", icon: "✅", kind: "list",
    items: [
      { label: "Review shortlist — Senior Product Designer", sub: "3 candidates awaiting your feedback", action: "Review", highlight: true },
      { label: "Approve offer — John Doe", sub: "Sales Engineer", action: "Approve" },
    ],
    annotation: "Hiring managers see only their roles, reviews, and approvals — nothing else.",
  },
  "workflow-automation": {
    title: "Workflows → New rule", icon: "⚡", kind: "list",
    items: [
      { label: "When: candidate moved to “Interview”", badge: "Trigger", highlight: true },
      { label: "Then: send interview-prep email", badge: "Action" },
      { label: "Then: notify the hiring manager", badge: "Action" },
    ],
    annotation: "A rule is a trigger plus one or more actions that run automatically.",
  },
  "recruiting-crm": {
    title: "Recruiting CRM", icon: "🤝", kind: "list",
    items: [
      { label: "Acme Corp", sub: "3 open roles · last contact 2 days ago", badge: "Client" },
      { label: "Jane Doe", sub: "Hiring Manager · jane.doe@acme.com", action: "Log activity", highlight: true },
    ],
    annotation: "Keep clients, contacts, and candidate relationships together between active searches.",
  },
  "client-portals-white-label": {
    title: "Client portal — Acme Corp", icon: "🏷️", kind: "list",
    items: [
      { label: "Jane Doe", sub: "Shared for client review", badge: "Awaiting feedback" },
      { label: "John Doe", sub: "Client feedback: 👍 Move forward", badge: "Approved", highlight: true },
    ],
    annotation: "Share a branded shortlist; clients review and leave feedback in their own portal.",
  },
  "ats-integration": {
    title: "ATS Integration", icon: "🔌", kind: "list",
    items: [
      { label: "Greenhouse", sub: "Structured hiring ATS", action: "Connect" },
      { label: "Lever", sub: "ATS + CRM", badge: "Synced", highlight: true },
      { label: "Loxo", sub: "Recruiting CRM — direct (BYO API key)", action: "Connect" },
      { label: "Workday", sub: "HCM suite", action: "Connect" },
      { label: "Ashby", sub: "All-in-one ATS", action: "Connect" },
    ],
    annotation: "Connect via Merge, or link Loxo directly with your API key — then choose sync direction and run an initial sync.",
  },
  "connect-email-calendar": {
    title: "Settings → Integrations", icon: "📬", kind: "list",
    items: [
      { label: "Google Workspace", sub: "Calendar & scheduling", badge: "Connected", highlight: true },
      { label: "Microsoft 365", sub: "Calendar & scheduling", action: "Connect" },
      { label: "Recruiter mailbox", sub: "jane.doe@acme.com", badge: "Connected" },
    ],
    annotation: "Connect a calendar for scheduling, and your mailbox so replies appear in the Inbox under your address.",
  },
  "analytics-reporting": {
    title: "Analytics", icon: "📊", kind: "stats",
    stats: [
      { label: "Time to hire", value: "21d" },
      { label: "Offer accept rate", value: "78%" },
      { label: "In pipeline", value: "164" },
      { label: "Top source", value: "Sourcing", highlight: true },
    ],
    annotation: "Executive dashboards show your funnel, time-to-hire, and which sources actually convert.",
  },
  "compliance-center": {
    title: "Compliance", icon: "🛡️", kind: "list",
    items: [
      { label: "Retention policy", sub: "Auto-purge candidate data", badge: "90 days" },
      { label: "Audit logs", sub: "Who did what, when", action: "View" },
      { label: "Legal hold — Jane Doe", sub: "Excluded from retention", badge: "On", highlight: true },
    ],
    annotation: "Set retention, review audit logs, and apply legal hold to specific records where required.",
  },
  "plans-and-billing": {
    title: "Billing", icon: "💳", kind: "list",
    items: [
      { label: "Agency plan", sub: "$799 / month · renews monthly", badge: "Current", highlight: true },
      { label: "Recruiters", sub: "8 of 10 seats used", action: "Upgrade" },
    ],
    annotation: "See your plan and usage; upgrade for more, or open the billing portal for invoices.",
  },
  "add-ons": {
    title: "Add-ons", icon: "🧩", kind: "list",
    items: [
      { label: "AI Interview Suite", sub: "AI voice & avatar interviews", badge: "+$199/mo", action: "Add" },
      { label: "Autonomous Recruiting Agent", sub: "24/7 sourcing & outreach", badge: "+$499/mo", action: "Add" },
      { label: "SMS & WhatsApp", sub: "Candidate messaging", badge: "Active", highlight: true },
      { label: "White Label Plus", sub: "Custom domain & branding", badge: "+$199/mo", action: "Add" },
    ],
    annotation: "Turn premium add-ons on or off anytime — changes apply to your subscription immediately.",
  },
};
