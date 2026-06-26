// JobsAI Enterprise Guide / Knowledge Base. Data-driven so the docs sidebar,
// index, and article pages stay in sync. Steps reference the real workspace
// navigation (left sidebar labels) so they're accurate for end users.

export type GuideSection = {
  heading?: string;
  body?: string[];
  steps?: string[];
  tip?: string;
};

export type GuideArticle = {
  slug: string;
  title: string;
  icon: string;       // emoji, matching the docs style
  summary: string;    // one line, shown on the index + article hero
  sections: GuideSection[];
};

export type GuideCategory = {
  id: string;
  title: string;
  description: string;
  articles: GuideArticle[];
};

export const GUIDE: GuideCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Set up your workspace and run your first hire.",
    articles: [
      {
        slug: "welcome",
        title: "Welcome to JobsAI Enterprise",
        icon: "🚀",
        summary: "What JobsAI Enterprise is and how the platform fits together.",
        sections: [
          {
            body: [
              "JobsAI Enterprise is an AI-powered talent acquisition operating system: applicant tracking, recruiting CRM, AI sourcing, AI interviews, outreach, workflow automation, analytics, and compliance — all in one workspace.",
              "Everything lives in the left navigation. This guide walks through each area in the order you'll use it: set up your workspace, post a job, source and screen candidates, reach out, interview, and make offers.",
            ],
          },
          {
            heading: "The workspace at a glance",
            steps: [
              "Dashboard — your hiring overview and what needs attention today.",
              "Jobs & Job Boards — create roles and distribute them to job sites.",
              "Candidates & Sourcing — your database, talent pools, and AI sourcing.",
              "Campaigns — multi-step outreach email sequences.",
              "Schedule, Offers, Analytics, Compliance — interviews, offers, reporting, and governance.",
              "Team & Access, Add-ons, Billing, Settings — administration.",
            ],
            tip: "Some areas only appear on plans that include them (for example, AI Sourcing on Agency and above). Visit Billing to see your plan.",
          },
        ],
      },
      {
        slug: "set-up-workspace",
        title: "Set up your workspace & branding",
        icon: "🧑‍💼",
        summary: "Add your logo, brand color, and company details so everything is white-labeled.",
        sections: [
          {
            steps: [
              "Go to Settings → Branding.",
              "Upload your logo and (optionally) a hero image, and set your brand color.",
              "Set your company name and the email \"from\" name used on candidate emails.",
              "Save. Career pages, candidate portals, and outreach now carry your brand.",
            ],
            tip: "On plans with White Label, you can remove \"Powered by JobsAI\" and use a custom domain — see White Label & Custom Domain.",
          },
        ],
      },
      {
        slug: "invite-your-team",
        title: "Invite your team & set roles",
        icon: "👥",
        summary: "Add recruiters and hiring managers, and control what each can do.",
        sections: [
          {
            steps: [
              "Go to Team & Access.",
              "Click Invite, enter the person's work email, and choose a role.",
              "Send the invite — they'll get an email to join your workspace.",
              "Adjust roles and permissions anytime from the same page.",
            ],
            tip: "Hiring managers can be given the focused My Workspace view instead of the full recruiter workspace.",
          },
        ],
      },
      {
        slug: "post-your-first-job",
        title: "Post your first job",
        icon: "💼",
        summary: "Create a role, generate a job description with AI, and publish it.",
        sections: [
          {
            steps: [
              "Go to Jobs → New job.",
              "Enter the title and key details. Use Generate with AI to draft the description and qualifications.",
              "Set the hiring team, pipeline stages, and screening questions.",
              "Publish the job and open its public application page.",
            ],
          },
          {
            heading: "Distribute it",
            body: ["Open Job Boards to syndicate the role to Indeed, ZipRecruiter, Google for Jobs, and other channels."],
          },
        ],
      },
      {
        slug: "appearance-and-preferences",
        title: "Appearance & preferences",
        icon: "🎨",
        summary: "Switch between light, dark, and system themes.",
        sections: [
          {
            steps: [
              "Open the Appearance menu in the bottom-left of the workspace sidebar (or top-right on the marketing site).",
              "Choose Light, Dark, or System.",
              "Your choice is remembered on this device.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sourcing-candidates",
    title: "Sourcing & candidates",
    description: "Find, score, and organize candidates with AI.",
    articles: [
      {
        slug: "ai-sourcing",
        title: "AI Sourcing",
        icon: "✨",
        summary: "Find the best-fit candidates from your database using plain-English search.",
        sections: [
          {
            steps: [
              "Open Sourcing from the left navigation.",
              "Describe who you're looking for in plain English (e.g. \"Senior React engineers open to remote\").",
              "Review the ranked matches with their fit reasons and AI recommendation.",
              "Select candidates and Add to pipeline, or send Outreach right from the results.",
            ],
            tip: "Sourcing also surfaces strong past applicants (\"talent rediscovery\") so you re-engage people who already know you.",
          },
        ],
      },
      {
        slug: "candidates-and-pools",
        title: "Candidate database & talent pools",
        icon: "🗂️",
        summary: "Browse every candidate and group them into reusable pools.",
        sections: [
          {
            steps: [
              "Go to Candidates to search and filter your full database.",
              "Open any candidate to see their profile, resume, scores, and history.",
              "Add candidates to a Talent Pool (e.g. \"Senior Designers\") to reuse for future roles.",
              "Pools can be searched, nurtured, and enrolled into campaigns later.",
            ],
          },
        ],
      },
      {
        slug: "ai-scoring",
        title: "AI Candidate Scoring & Top Picks",
        icon: "🎯",
        summary: "Let AI rank applicants against each role so the best rise to the top.",
        sections: [
          {
            body: ["As candidates apply, JobsAI scores them against the role's requirements and surfaces Top Picks."],
            steps: [
              "Open a Job and go to its candidate list.",
              "Sort by match score, or open Top Picks to see the strongest applicants first.",
              "Each score includes an explainable summary so you understand the why.",
            ],
            tip: "Scores are a starting point — always apply your own judgment before advancing or rejecting.",
          },
        ],
      },
      {
        slug: "compare-candidates",
        title: "Compare candidates",
        icon: "⚖️",
        summary: "Put shortlisted candidates side by side to decide faster.",
        sections: [
          {
            steps: [
              "From a job's pipeline, select two or more candidates.",
              "Choose Compare to see them side by side across skills, experience, and scores.",
              "Use the AI summary of strengths and gaps to make the call.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "pipeline-screening",
    title: "Pipeline & screening",
    description: "Move candidates from applied to hired.",
    articles: [
      {
        slug: "manage-your-pipeline",
        title: "Manage your pipeline",
        icon: "🧭",
        summary: "Track candidates through stages on a Kanban board.",
        sections: [
          {
            steps: [
              "Open a Job and view its pipeline board.",
              "Drag candidates between stages (Applied → Screen → Interview → Offer).",
              "Open a candidate to add notes, scorecards, and @mentions for your team.",
              "Use the Inbox to keep candidate email threads in one place.",
            ],
            tip: "Need a candidate on a different role? Use Move to job to transfer them without losing history.",
          },
        ],
      },
      {
        slug: "ai-screening",
        title: "AI screening",
        icon: "🤖",
        summary: "Auto-screen applicants and generate interview kits.",
        sections: [
          {
            steps: [
              "Open a candidate and choose Screen with AI.",
              "Review the AI screening summary, strengths, risks, and recommended next step.",
              "Generate an interview kit (structured questions) for the role with one click.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "outreach-campaigns",
    title: "Outreach Campaigns",
    description: "Nurture candidates with multi-step email sequences.",
    articles: [
      {
        slug: "create-a-campaign",
        title: "Create an outreach campaign",
        icon: "📣",
        summary: "Build a multi-step email sequence with custom delays.",
        sections: [
          {
            steps: [
              "Go to Campaigns → New campaign.",
              "Name it, then add steps. Each step is an email with its own delay (e.g. Day 0, then +3 days, then +5 days).",
              "Write each email. Insert variables like {{first_name}}, {{job_title}}, and {{org_name}} with the chips above the editor.",
              "Start from a template (Passive Candidate Nurture, Re-engage Past Applicants, Hiring Event) to move faster.",
              "Save & activate.",
            ],
            tip: "A campaign can have up to 12 steps. Pause or edit it anytime from the campaign list.",
          },
        ],
      },
      {
        slug: "ai-personalized-emails",
        title: "AI-personalized emails",
        icon: "🪄",
        summary: "Have the AI tailor each email to each candidate at send time.",
        sections: [
          {
            steps: [
              "While editing a step, turn on \"AI-personalize each email.\"",
              "Optionally add guidance (e.g. \"reference their open-source work, keep it under 80 words\").",
              "At send time, the AI rewrites that step's email for each candidate — warmer and more natural, still on message.",
            ],
            tip: "Leave AI personalization off for steps where you want the exact wording sent verbatim.",
          },
        ],
      },
      {
        slug: "enroll-and-track",
        title: "Enroll candidates & track results",
        icon: "📈",
        summary: "Add candidates to a campaign and watch opens, replies, and per-step performance.",
        sections: [
          {
            steps: [
              "Open a campaign and choose Enroll candidates.",
              "Paste candidates as \"Name <email>\" (one per line), or enroll from Sourcing results.",
              "The sequence sends on schedule automatically — the first step goes out per its delay.",
              "Open the campaign to see per-step sent/opened/replied rates and each candidate's status.",
              "Mark replies, or remove someone from the sequence, from the enrolled list.",
            ],
            tip: "Replies and unsubscribes automatically stop the sequence for that candidate.",
          },
        ],
      },
    ],
  },
  {
    id: "interviews-scheduling",
    title: "Interviews & scheduling",
    description: "Screen and schedule with AI.",
    articles: [
      {
        slug: "ai-interviews",
        title: "AI voice & avatar interviews",
        icon: "🎙️",
        summary: "Run automated interviews with scoring (AI Interview Suite add-on).",
        sections: [
          {
            steps: [
              "From a candidate or job, choose AI Interview.",
              "Pick voice or avatar, and the interview kit (questions) to use.",
              "Send the invite — the candidate completes it on their own time.",
              "Review the transcript, scores, and summary on the candidate's profile.",
            ],
            tip: "AI voice & avatar interviews are part of the AI Interview Suite add-on. Enable it in Add-ons.",
          },
        ],
      },
      {
        slug: "schedule-interviews",
        title: "Schedule interviews",
        icon: "📅",
        summary: "Connect your calendar and let candidates self-book.",
        sections: [
          {
            steps: [
              "Go to Settings → Integrations and connect Google or Microsoft 365.",
              "Open Schedule to set your availability and interview types.",
              "Share a self-service booking link with candidates, or book on their behalf.",
              "Confirmed interviews sync to your calendar with reminders.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "offers-hiring",
    title: "Offers & hiring",
    description: "Close candidates and automate the busywork.",
    articles: [
      {
        slug: "offers-esignature",
        title: "Offer letters & e-signature",
        icon: "📄",
        summary: "Generate, approve, and collect signatures on offers.",
        sections: [
          {
            steps: [
              "Go to Offers → New offer.",
              "Pick a template, fill in role, compensation, and start date.",
              "Route for internal approval if your workflow requires it.",
              "Send for e-signature — the candidate signs online and you're notified.",
            ],
          },
        ],
      },
      {
        slug: "hiring-manager-workspace",
        title: "Hiring Manager Workspace",
        icon: "✅",
        summary: "A focused space for hiring managers to review and decide.",
        sections: [
          {
            body: ["Hiring managers don't need the full recruiter workspace. My Workspace gives them just their roles, candidates to review, and decisions to make."],
            steps: [
              "Invite the manager from Team & Access.",
              "They sign in and land on My Workspace.",
              "They review shortlists, leave structured feedback, and approve offers.",
            ],
          },
        ],
      },
      {
        slug: "workflow-automation",
        title: "Workflow automation",
        icon: "⚡",
        summary: "Automate stage moves, emails, and follow-ups.",
        sections: [
          {
            steps: [
              "Go to Workflows → New rule.",
              "Choose a trigger (e.g. candidate moved to \"Interview\").",
              "Add actions (send an email, notify a teammate, move stage, start a task).",
              "Turn the rule on — it now runs automatically.",
            ],
            tip: "Start with one or two high-value automations (e.g. auto-acknowledge new applicants) before adding more.",
          },
        ],
      },
    ],
  },
  {
    id: "agencies-clients",
    title: "Agencies & clients",
    description: "Tools for staffing and recruiting agencies.",
    articles: [
      {
        slug: "recruiting-crm",
        title: "Recruiting CRM",
        icon: "🤝",
        summary: "Manage client companies, contacts, job orders, deals, and candidate submissions in one workspace.",
        sections: [
          {
            body: [
              "The Recruiting CRM is built for staffing and hiring agencies: track client companies, the people you work with, the roles they need filled (job orders), your business-development pipeline (deals), and the candidates you submit — all connected to your existing candidates and ATS.",
              "Open it from CRM in the left navigation. The CRM has its own sub-nav: Dashboard, Companies, Contacts, Job Orders, Deals, Activities, and Tasks.",
            ],
          },
          {
            heading: "Companies & contacts",
            steps: [
              "Companies → New company to add a client or prospect. Set a status (Prospect, Active Client, Past Client, Dormant), industry, owner, and tags.",
              "Open a company to see the whole relationship across tabs: Overview, Contacts, Job Orders, Deals, Submitted, Activity, and Tasks.",
              "Add the people you work with under Contacts — hiring managers, HR, founders — with a contact type and relationship status (New, Warm, Active, Unresponsive, Do Not Contact).",
            ],
            tip: "Set a Next follow-up date on a company or contact and it surfaces on the CRM Dashboard so nothing slips.",
          },
          {
            heading: "Job orders",
            body: ["A job order is a client requirement you're working to fill, with the commercials that matter to an agency."],
            steps: [
              "Job Orders → New job order: capture job type, priority, openings, pay/bill rate, fee %, markup, and estimated placement value.",
              "From a job order, use Create posting to spin up a real job in the ATS and reuse the full candidate pipeline, interviews, and offers.",
              "Track status from Intake → Open → Sourcing → Submitted → Interviewing → Offer → Filled.",
            ],
          },
          {
            heading: "Deals pipeline",
            steps: [
              "Deals shows your business-development pipeline as a board. Create a deal and set its value, probability, and stage.",
              "Drag a deal between stage columns (Lead → Discovery → Proposal Sent → Agreement Sent → Active Requirement → Won / Lost).",
              "The board totals open and won value so you can read your pipeline at a glance.",
            ],
          },
          {
            heading: "Submissions, activities & tasks",
            steps: [
              "Submit a candidate to a client from a company's Submitted tab or a job order's Candidates tab; track each submission (Submitted → Client Review → Interview → Offer → Placed).",
              "Log calls, emails, meetings, and notes from any record's Activity tab — they thread into one client timeline.",
              "Create follow-up Tasks with due dates; the Tasks page groups them Overdue / Today / Upcoming, and the Dashboard surfaces what's due.",
            ],
          },
          {
            heading: "AI assistant & search",
            steps: [
              "On any company or contact, use Ask AI to summarize the relationship, suggest the next best action, draft a follow-up or client-update email, write intake questions, or score the opportunity — grounded only in that client's CRM data.",
              "Use the CRM search box to find any company, contact, job order, or deal, and the Dashboard's Quick views for one-click filtered lists.",
            ],
            tip: "The CRM is available on plans that include it. If you don't see CRM in the navigation, check Billing or ask your admin.",
          },
        ],
      },
      {
        slug: "client-portals-white-label",
        title: "Client portals & white label",
        icon: "🏷️",
        summary: "Give each client a branded view of their pipeline.",
        sections: [
          {
            steps: [
              "Enable White Label in Settings (and a custom domain on supported plans).",
              "Create a client portal so the client sees a polished, branded shortlist.",
              "Share candidates for client review and capture their feedback.",
              "Send Client Reporting to keep stakeholders updated.",
            ],
            tip: "Want branding removal and custom email branding on a lower plan? Add White Label Plus from Add-ons.",
          },
        ],
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect your ATS, email, and calendar.",
    articles: [
      {
        slug: "ats-integration",
        title: "ATS integration (Greenhouse, Lever, Loxo, Workday & more)",
        icon: "🔌",
        summary: "Sync candidates and jobs with your existing ATS via Merge — or connect Loxo directly.",
        sections: [
          {
            steps: [
              "Go to ATS Integration in the left navigation.",
              "Choose your ATS (Greenhouse, Lever, Ashby, Workday, and 20+ more) and connect it securely through Merge.",
              "Using Loxo? Connect it directly with your Loxo agency slug and API key (Loxo → Settings → API Keys) — no Merge needed.",
              "Map jobs and candidates, and choose sync direction.",
              "Run an initial sync — records flow between systems so you can adopt JobsAI gradually.",
            ],
            tip: "ATS Integration is available on Agency, Business, and Enterprise plans.",
          },
        ],
      },
      {
        slug: "connect-email-calendar",
        title: "Connect email & calendar",
        icon: "📬",
        summary: "Link Gmail/Google or Microsoft 365 for sending and scheduling.",
        sections: [
          {
            steps: [
              "Go to Settings → Integrations.",
              "Connect Google or Microsoft 365 for calendar and scheduling.",
              "Connect your recruiter mailbox so outreach and replies appear in the Inbox under your address.",
            ],
            tip: "If a mailbox isn't connected, JobsAI still sends from your branded company address.",
          },
        ],
      },
      {
        slug: "candidate-intake",
        title: "Candidate intake & your email domain",
        icon: "📥",
        summary: "Receive resumes at your own address, and send & reply to candidates from your domain.",
        sections: [
          {
            heading: "Your candidate intake address",
            body: [
              "Every workspace gets a dedicated intake address at talent.jobsai.work — for example, acme@talent.jobsai.work. Any resume emailed there is parsed automatically and dropped into your Candidate Inbox, under the General Applications pool.",
            ],
            steps: [
              "Open Intake in the left navigation to see your address.",
              "Customise the handle (the part before @talent.jobsai.work) and Save — e.g. recrutamento@talent.jobsai.work.",
              "Use Copy to grab the address, then publish or share it.",
            ],
          },
          {
            heading: "Use your own domain to receive (forwarding)",
            body: [
              "Already publish careers@ or hr@yourcompany.com? Keep using it — just forward to your intake address so every resume lands in JobsAI automatically. Candidates never see the talent.jobsai.work address.",
            ],
            steps: [
              "In Google Workspace or Microsoft 365, open the settings for your hiring mailbox (e.g. careers@yourcompany.com).",
              "Add a forwarding rule (or alias) that forwards mail to your <handle>@talent.jobsai.work address.",
              "Recruiters can also just forward any candidate email there — the attached resume is parsed automatically.",
            ],
            tip: "Forwarding keeps your public-facing address while JobsAI does the parsing. A direct inbound custom domain (careers@yourcompany.com landing in JobsAI without forwarding) is available on white-label plans — ask your admin or contact us.",
          },
          {
            heading: "Send & reply from your own domain",
            steps: [
              "Connect your recruiter mailbox under Settings → Integrations (Gmail/Google or Microsoft 365). Candidate emails, outreach, and replies then send and thread under your own address — see Connect email & calendar.",
              "Prefer a branded company sender without connecting a mailbox? On White Label / custom-domain plans, set your From address under Settings → Branding (white-label email) so automated emails go out as your brand and drop the “powered by” footer.",
            ],
            tip: "White-label email branding and custom domains are part of the White Label feature (or the White Label Plus add-on). See Client portals & white label.",
          },
        ],
      },
    ],
  },
  {
    id: "analytics-compliance",
    title: "Analytics & compliance",
    description: "Measure performance and stay compliant.",
    articles: [
      {
        slug: "analytics-reporting",
        title: "Analytics & reporting",
        icon: "📊",
        summary: "See funnel health, hiring performance, and recruiter productivity.",
        sections: [
          {
            steps: [
              "Open Analytics for executive dashboards: pipeline funnel, time-to-hire, and source performance.",
              "Use Reports to build and export client- or stakeholder-ready summaries.",
              "Filter by job, team, or date range to find bottlenecks.",
            ],
          },
        ],
      },
      {
        slug: "compliance-center",
        title: "Compliance center",
        icon: "🛡️",
        summary: "GDPR tools, audit logs, retention policies, and legal hold.",
        sections: [
          {
            steps: [
              "Open Compliance to manage data-protection settings.",
              "Set retention policies so candidate data is purged on schedule.",
              "Review audit logs of who did what, and apply legal hold where required.",
            ],
            tip: "Compliance Center is available on Business and Enterprise plans.",
          },
        ],
      },
    ],
  },
  {
    id: "account-billing",
    title: "Account & billing",
    description: "Manage your plan, add-ons, and seats.",
    articles: [
      {
        slug: "plans-and-billing",
        title: "Plans & billing",
        icon: "💳",
        summary: "View your plan, upgrade, and manage your subscription.",
        sections: [
          {
            steps: [
              "Go to Billing to see your current plan and usage.",
              "Upgrade or change plans to unlock more features and higher limits.",
              "Open the billing portal to update payment details or download invoices.",
            ],
          },
        ],
      },
      {
        slug: "add-ons",
        title: "Add-ons",
        icon: "🧩",
        summary: "Turn premium capabilities on or off anytime.",
        sections: [
          {
            body: ["Add-ons extend any plan and can be added or removed from inside your workspace:"],
            steps: [
              "AI Interview Suite — AI voice & avatar interviews with scoring.",
              "Autonomous Recruiting Agent — 24/7 sourcing, outreach, and follow-ups.",
              "SMS & WhatsApp — instant candidate messaging and reminders.",
              "White Label Plus — custom domain, branding removal, custom email branding.",
              "Additional Recruiters — extra seats beyond your plan limit.",
            ],
            tip: "Manage all of these from Add-ons in the left navigation.",
          },
        ],
      },
    ],
  },
  {
    id: "partner-program",
    title: "Partner program",
    description: "Refer customers and earn recurring commission.",
    articles: [
      {
        slug: "partner-program",
        title: "Partner program — earn cash for referrals",
        icon: "🤝",
        summary: "Earn 20–30% recurring cash commission for 12 months, paid monthly via Stripe.",
        sections: [
          {
            body: [
              "Two different programs reward referrals, for two different audiences. The Partner Program pays real cash to consultants, agencies, fractional CHROs, podcast guests, and influencers. The separate Customer Referral Program gives existing customers account credits ($100–$500) on their invoice. This article covers the cash Partner Program.",
              "Founding Partners: the first 25 partners lock a 25% commission rate for 12 months — above the standard 20% entry rate.",
            ],
          },
          {
            heading: "How it works",
            body: [
              "Create your link in minutes at /enterprise/partners/apply — fill the short form and verify your email (no JobsAI login or purchase required). The 'Become a partner' button on the Partner Program page goes straight there.",
            ],
            steps: [
              "Apply with your name, email, and audience type; verify the emailed code.",
              "Get your unique referral link instantly (e.g. app.jobsai.work/partner/ABC123).",
              "Share your link. We attribute any signup within 90 days (last-touch) to you.",
              "When your referral converts from trial to a paying customer, commission starts accruing.",
              "You earn a percentage of what they actually pay (collected revenue) every month for 12 months.",
              "Set up payouts and track referrals & earnings in your partner dashboard.",
            ],
          },
          {
            heading: "Commission tiers (cash)",
            steps: [
              "Recruiting Partner — 1–4 active customers — 20% commission.",
              "Growth Partner — 5+ active customers — 25% commission.",
              "Strategic Partner — 20+ active customers — 30% commission, plus co-marketing and a dedicated partner manager.",
            ],
          },
          {
            heading: "Stacking with the Founding Offer",
            body: [
              "If your referred customer claims the Founding Offer (50% off their first year), you still earn — on what they pay. Example: an Agency plan ($799 list) at $399 with the Founding Offer earns a Founding Partner 25% of $399 = $99.75/mo, or $1,197 over 12 months. Commission is always on collected revenue, never list price, which is what makes stacking sustainable.",
            ],
            tip: "Commissions are released after a 2-month hold and pay out monthly once your cleared balance passes $500 (so we're not sending dozens of tiny payments). Refunds or chargebacks reverse the matching commission.",
          },
        ],
      },
      {
        slug: "partner-terms",
        title: "Partner Program terms",
        icon: "📜",
        summary: "The simple terms you agree to as a JobsAI Enterprise Partner.",
        sections: [
          {
            body: [
              "These are the plain-language terms of the JobsAI Enterprise Partner Program. By joining, accepting an invitation, or sharing your referral link, you agree to them.",
            ],
          },
          {
            heading: "The essentials",
            steps: [
              "Eligibility — partners are consultants, agencies, advisors, and other trusted voices; you don't need to be a JobsAI customer. We may approve, decline, or remove any partner at our discretion.",
              "Your referral link — we credit you when a company signs up within 90 days of clicking your link (last-touch). Each referred company is credited to one partner. Don't refer your own organization.",
              "Commission — you earn your tier rate (20–30%) of collected revenue for 12 months per referred customer. It's calculated on what the customer actually pays (after any discount), never list price.",
              "Getting paid — commissions clear after a 2-month hold and pay out monthly once your balance passes $500. Refunds or chargebacks reverse the matching commission. You're responsible for your own taxes.",
              "Fair play — no spam, no paid ads on JobsAI brand terms, no misleading claims, and no fake or incentivized signups. Breaches void affected commissions and may end your participation.",
              "Your role — represent JobsAI honestly. You're an independent partner, not an employee or agent, and can't enter agreements on our behalf.",
              "Changes & ending — we may update rates or terms, or end the program, with reasonable notice; we may suspend partners who breach these terms. You can leave at any time.",
            ],
            tip: "Questions about the program? Reach the JobsAI Enterprise Partner Team via the Contact link in the footer.",
          },
        ],
      },
    ],
  },
];

export const GUIDE_ARTICLES: GuideArticle[] = GUIDE.flatMap((c) => c.articles);

export function getGuideArticle(slug: string): { article: GuideArticle; category: GuideCategory } | undefined {
  for (const category of GUIDE) {
    const article = category.articles.find((a) => a.slug === slug);
    if (article) return { article, category };
  }
  return undefined;
}
