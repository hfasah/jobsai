import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 60;

const SEED_MARKER = "<!-- demo-seed -->";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const randHex = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");

// ── Demo data ─────────────────────────────────────────────────────────────────

const JOBS = [
  {
    title: "Senior Full-Stack Engineer",
    department: "Engineering",
    location: "Remote (US)",
    employment_type: "full-time",
    salary_min: 130000,
    salary_max: 160000,
    status: "active",
    description: `We're looking for a Senior Full-Stack Engineer to help shape the core product. You'll own features end-to-end, mentor junior engineers, and drive architecture decisions. ${SEED_MARKER}`,
    responsibilities: "Lead development of new product features\nCollaborate with design and product on UX\nConduct code reviews and mentor junior engineers\nDrive technical architecture decisions\nParticipate in on-call rotation",
    qualifications: "5+ years of software engineering experience\nStrong proficiency in TypeScript, React, and Node.js\nExperience with PostgreSQL or similar relational databases\nFamiliarity with cloud infrastructure (AWS, GCP, or Azure)\nStrong communication skills",
    nice_to_have: "Experience with Next.js\nContributions to open-source projects\nBackground in B2B SaaS",
    published_at: daysAgo(21),
  },
  {
    title: "Head of Growth",
    department: "Marketing",
    location: "New York, NY",
    employment_type: "full-time",
    salary_min: 120000,
    salary_max: 145000,
    status: "active",
    description: `We need an experienced growth leader to own our pipeline from top-of-funnel to activation. You'll build the growth playbook from scratch. ${SEED_MARKER}`,
    responsibilities: "Own user acquisition across paid and organic channels\nDesign and run growth experiments\nBuild and lead a small growth team\nDrive product-led growth initiatives\nReport growth KPIs to the executive team",
    qualifications: "6+ years in growth or performance marketing\nData-driven with strong analytical skills\nExperience running A/B tests at scale\nFamiliarity with CRM and marketing automation tools\nProven track record of hitting user acquisition targets",
    nice_to_have: "Background in B2B SaaS or HR tech\nSQL proficiency\nExperience with PLG motions",
    published_at: daysAgo(18),
  },
  {
    title: "DevOps / Platform Engineer",
    department: "Infrastructure",
    location: "Remote",
    employment_type: "full-time",
    salary_min: 125000,
    salary_max: 155000,
    status: "active",
    description: `Join our infrastructure team to build and maintain the platform that powers our product. You'll own CI/CD, cloud infrastructure, and developer experience. ${SEED_MARKER}`,
    responsibilities: "Design and maintain CI/CD pipelines\nManage cloud infrastructure (AWS)\nImplement monitoring, alerting, and SLOs\nImprove developer experience tooling\nEnsure platform security and compliance",
    qualifications: "4+ years in DevOps or platform engineering\nHands-on AWS experience (ECS, RDS, S3, CloudFront)\nStrong knowledge of Terraform or Pulumi\nExperience with Kubernetes\nSolid understanding of networking and security",
    nice_to_have: "Experience with Datadog or similar observability tools\nBackground in fintech or healthtech\nOpen-source contributions",
    published_at: daysAgo(14),
  },
];

// Candidates per job: [0]=SWE, [1]=Growth, [2]=DevOps
const CANDIDATES: {
  name: string; email: string; source: string; stage: string;
  match_score: number | null; skills_score: number | null; experience_score: number | null;
  culture_score: number | null; ats_score: number | null;
  ai_recommendation: string | null; ai_summary: string | null; ats_summary: string | null;
  risk_flags: string[]; ats_keywords_matched: string[]; ats_keywords_missing: string[];
  screened_at: string | null; stage_updated_at: string; applied_at: string;
  resume_text: string; job_index: number;
}[] = [
  // ── Senior Full-Stack Engineer ────────────────────────────────────────────
  {
    job_index: 0, name: "Sarah Chen", email: "sarah.chen@demo.jobsai.work",
    source: "linkedin", stage: "hired",
    match_score: 93, skills_score: 95, experience_score: 90, culture_score: 94, ats_score: 91,
    ai_recommendation: "strong_yes",
    ai_summary: "Sarah brings 7 years of full-stack experience, having led engineering teams at two Series B startups. Her TypeScript and React depth is exceptional, and she has shipped three production Next.js applications at scale.",
    ats_summary: "Excellent keyword match — covers TypeScript, React, Node.js, PostgreSQL, AWS, and Next.js.",
    risk_flags: [],
    ats_keywords_matched: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Next.js", "code review", "CI/CD"],
    ats_keywords_missing: [],
    screened_at: daysAgo(17), stage_updated_at: daysAgo(3), applied_at: daysAgo(20),
    resume_text: "Sarah Chen | sarah.chen@email.com\n\nSenior Software Engineer · 7 years\n\nExperience:\n- Staff Engineer, Lattice (2021–present): Led 6-person frontend team, migrated 200k+ LOC codebase to TypeScript, shipped real-time performance review product in Next.js\n- Senior Engineer, Brex (2019–2021): Built React component library adopted by 12 teams, owned PostgreSQL schema migrations for payments service\n- Engineer, Stripe (2017–2019): Full-stack features across dashboard in React/Node.js\n\nSkills: TypeScript, React, Next.js, Node.js, PostgreSQL, AWS (ECS, RDS, S3), GraphQL, Docker\n\nEducation: BS Computer Science, Stanford University",
  },
  {
    job_index: 0, name: "Marcus Johnson", email: "marcus.j@demo.jobsai.work",
    source: "indeed", stage: "offer",
    match_score: 85, skills_score: 87, experience_score: 84, culture_score: 84, ats_score: 82,
    ai_recommendation: "strong_yes",
    ai_summary: "Marcus has strong full-stack credentials with 5 years across fintech and SaaS. Excellent React and TypeScript fundamentals with production Next.js experience. Minor gap: limited PostgreSQL at scale but compensated by strong backend fundamentals.",
    ats_summary: "Strong match — covers all required skills; AWS depth is lighter than ideal.",
    risk_flags: ["AWS experience appears limited to personal projects"],
    ats_keywords_matched: ["TypeScript", "React", "Node.js", "PostgreSQL", "Next.js", "code review"],
    ats_keywords_missing: ["AWS", "cloud infrastructure"],
    screened_at: daysAgo(14), stage_updated_at: daysAgo(5), applied_at: daysAgo(18),
    resume_text: "Marcus Johnson | marcus.johnson@email.com\n\nFull-Stack Engineer · 5 years\n\nExperience:\n- Senior Engineer, Plaid (2021–present): Built TypeScript/React dashboard for 500k+ developers, owned Node.js API layer serving 2M req/day\n- Engineer, HubSpot (2019–2021): Next.js migration of legacy Angular CRM, PostgreSQL query optimization reducing p99 latency by 40%\n\nSkills: TypeScript, React, Next.js, Node.js, PostgreSQL, Redis, some AWS (personal projects)\n\nEducation: BS Computer Science, Georgia Tech",
  },
  {
    job_index: 0, name: "Priya Patel", email: "priya.patel@demo.jobsai.work",
    source: "jobsai", stage: "interview",
    match_score: 88, skills_score: 90, experience_score: 85, culture_score: 89, ats_score: 86,
    ai_recommendation: "strong_yes",
    ai_summary: "Priya is a strong full-stack candidate with deep React expertise and solid production AWS experience. Her open-source contributions and track record shipping user-facing features align well with the role. A standout communicator.",
    ats_summary: "High keyword coverage across all core requirements including AWS and Next.js.",
    risk_flags: [],
    ats_keywords_matched: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Next.js", "open-source"],
    ats_keywords_missing: ["code review", "mentoring"],
    screened_at: daysAgo(12), stage_updated_at: daysAgo(7), applied_at: daysAgo(16),
    resume_text: "Priya Patel | priya.patel@email.com\n\nSoftware Engineer · 6 years\n\nExperience:\n- Senior Engineer, Figma (2020–present): Core editor team, TypeScript/React, AWS Lambda for plugin runtime, Next.js marketing site\n- Engineer, Segment (2018–2020): Node.js data pipeline, PostgreSQL, contributed to open-source analytics SDK (3k+ GitHub stars)\n\nSkills: TypeScript, React, Next.js, Node.js, PostgreSQL, AWS (Lambda, S3, CloudFront), GraphQL\n\nEducation: MS Computer Science, Carnegie Mellon",
  },
  {
    job_index: 0, name: "James Wilson", email: "james.wilson@demo.jobsai.work",
    source: "linkedin", stage: "interview",
    match_score: 76, skills_score: 78, experience_score: 74, culture_score: 76, ats_score: 72,
    ai_recommendation: "yes",
    ai_summary: "James has solid React and Node.js experience but his background is primarily in e-commerce which differs from the B2B SaaS context here. His PostgreSQL knowledge is strong; AWS exposure is largely theoretical. Worth interviewing.",
    ats_summary: "Good coverage of core skills; missing cloud-native and CI/CD keywords.",
    risk_flags: ["E-commerce background — limited B2B SaaS exposure"],
    ats_keywords_matched: ["React", "Node.js", "PostgreSQL", "TypeScript"],
    ats_keywords_missing: ["AWS", "Next.js", "CI/CD"],
    screened_at: daysAgo(11), stage_updated_at: daysAgo(8), applied_at: daysAgo(15),
    resume_text: "James Wilson | james.wilson@email.com\n\nFull-Stack Developer · 5 years\n\nExperience:\n- Senior Developer, Shopify (2020–present): React storefront components, Node.js app extensions, PostgreSQL for merchant analytics\n- Developer, WooCommerce (2018–2020): TypeScript migration of legacy jQuery code, REST API development\n\nSkills: React, TypeScript, Node.js, PostgreSQL, GraphQL, some Docker\n\nEducation: BS Software Engineering, University of Michigan",
  },
  {
    job_index: 0, name: "Alex Thompson", email: "alex.t@demo.jobsai.work",
    source: "referral", stage: "screened",
    match_score: 68, skills_score: 65, experience_score: 70, culture_score: 69, ats_score: 63,
    ai_recommendation: "yes",
    ai_summary: "Alex shows promise with solid JavaScript fundamentals and recent TypeScript adoption, but is light on the distributed systems experience the role requires. 4 years total, mostly frontend-focused. Reasonable hire if the pipeline is thin.",
    ats_summary: "Moderate match — covers frontend requirements but limited backend and cloud keywords.",
    risk_flags: ["Mostly frontend — limited backend production experience"],
    ats_keywords_matched: ["React", "TypeScript", "Node.js"],
    ats_keywords_missing: ["PostgreSQL", "AWS", "Next.js", "CI/CD"],
    screened_at: daysAgo(10), stage_updated_at: daysAgo(10), applied_at: daysAgo(14),
    resume_text: "Alex Thompson | alex.t@email.com\n\nFrontend Engineer · 4 years\n\nExperience:\n- Frontend Engineer, Intercom (2021–present): React component library, TypeScript, some Node.js BFF\n- Junior Developer, Agency (2019–2021): React, JavaScript, REST APIs\n\nSkills: React, TypeScript, JavaScript, Node.js (basic), CSS-in-JS\n\nEducation: Coding Bootcamp, App Academy",
  },
  {
    job_index: 0, name: "David Kim", email: "david.kim@demo.jobsai.work",
    source: "indeed", stage: "screened",
    match_score: 61, skills_score: 55, experience_score: 63, culture_score: 65, ats_score: 54,
    ai_recommendation: "maybe",
    ai_summary: "David has 4 years of experience but primarily in PHP and older JavaScript stacks. His recent TypeScript work is limited to side projects. The gap between his skills and the role requirements is significant.",
    ats_summary: "Weak keyword match — missing most core required technologies.",
    risk_flags: ["Primary stack is PHP/jQuery — TypeScript/React is limited"],
    ats_keywords_matched: ["JavaScript", "Node.js"],
    ats_keywords_missing: ["TypeScript", "React", "PostgreSQL", "AWS", "Next.js"],
    screened_at: daysAgo(10), stage_updated_at: daysAgo(10), applied_at: daysAgo(13),
    resume_text: "David Kim | d.kim@email.com\n\nWeb Developer · 4 years\n\nExperience:\n- Developer, Digital Agency (2020–present): PHP/Laravel backend, jQuery frontend, some Node.js\n- Junior Developer, E-commerce startup (2019–2020): WooCommerce, PHP\n\nSkills: PHP, Laravel, JavaScript, jQuery, Node.js, MySQL, some React\n\nEducation: BS Information Technology, State University",
  },
  {
    job_index: 0, name: "Emma Wu", email: "emma.wu@demo.jobsai.work",
    source: "direct", stage: "applied",
    match_score: null, skills_score: null, experience_score: null, culture_score: null, ats_score: null,
    ai_recommendation: null, ai_summary: null, ats_summary: null,
    risk_flags: [], ats_keywords_matched: [], ats_keywords_missing: [],
    screened_at: null, stage_updated_at: daysAgo(14), applied_at: daysAgo(14),
    resume_text: "Emma Wu | emma.wu@email.com\n\nSoftware Engineer · 6 years\n\nExperience:\n- Tech Lead, Pinterest (2021–present): React, TypeScript, Node.js, AWS\n- Engineer, Twitter (2018–2021): Full-stack features in React and Scala\n\nSkills: TypeScript, React, Node.js, AWS, PostgreSQL, Scala\n\nEducation: BS Computer Science, UC Berkeley",
  },
  {
    job_index: 0, name: "Robert Garcia", email: "r.garcia@demo.jobsai.work",
    source: "indeed", stage: "rejected",
    match_score: 38, skills_score: 30, experience_score: 40, culture_score: 44, ats_score: 29,
    ai_recommendation: "no",
    ai_summary: "Robert's background is primarily in mobile development (iOS/Swift) with limited web experience. The skill set does not align with this full-stack web engineering role.",
    ats_summary: "Very low keyword coverage — primarily mobile skills, not web stack.",
    risk_flags: ["iOS/mobile background — not relevant to full-stack web role"],
    ats_keywords_matched: ["JavaScript"],
    ats_keywords_missing: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Next.js"],
    screened_at: daysAgo(13), stage_updated_at: daysAgo(12), applied_at: daysAgo(14),
    resume_text: "Robert Garcia | r.garcia@email.com\n\niOS Developer · 5 years\n\nExperience:\n- iOS Engineer, Lyft (2020–present): Swift, UIKit, some React Native\n- Mobile Developer, Agency (2018–2020): Objective-C, Swift\n\nSkills: Swift, Objective-C, React Native, some JavaScript\n\nEducation: BS Computer Science, UCLA",
  },

  // ── Head of Growth ────────────────────────────────────────────────────────
  {
    job_index: 1, name: "Olivia Chen", email: "olivia.chen@demo.jobsai.work",
    source: "linkedin", stage: "offer",
    match_score: 91, skills_score: 93, experience_score: 90, culture_score: 90, ats_score: 89,
    ai_recommendation: "strong_yes",
    ai_summary: "Olivia is an exceptional growth hire — 8 years leading user acquisition at Duolingo and Notion, with proven PLG experience and deep analytical skills. She's built and led growth teams of up to 8 people and consistently delivered 3x+ on acquisition targets.",
    ats_summary: "Near-perfect keyword match across growth, PLG, analytics, and B2B SaaS requirements.",
    risk_flags: [],
    ats_keywords_matched: ["growth", "acquisition", "A/B testing", "PLG", "B2B SaaS", "CRM", "marketing automation", "SQL", "analytics"],
    ats_keywords_missing: [],
    screened_at: daysAgo(14), stage_updated_at: daysAgo(5), applied_at: daysAgo(17),
    resume_text: "Olivia Chen | olivia.chen@email.com\n\nHead of Growth · 8 years\n\nExperience:\n- Head of Growth, Notion (2021–present): Grew B2B signups from 200k to 1.2M/month, built PLG motion, managed 6-person team, owned $4M paid budget\n- Growth Lead, Duolingo (2018–2021): Ran 200+ A/B tests, built referral program driving 18% of new users, SQL analytics for all growth experiments\n- Growth Manager, HubSpot (2015–2018): Inbound marketing, marketing automation, CRM optimization\n\nSkills: Growth strategy, PLG, A/B testing, SQL, Amplitude, Mixpanel, HubSpot, Salesforce, paid acquisition\n\nEducation: MBA, Wharton; BA Economics, Yale",
  },
  {
    job_index: 1, name: "Daniel Lee", email: "daniel.lee@demo.jobsai.work",
    source: "jobsai", stage: "interview",
    match_score: 79, skills_score: 80, experience_score: 77, culture_score: 80, ats_score: 75,
    ai_recommendation: "yes",
    ai_summary: "Daniel has strong performance marketing credentials and good analytical depth. His B2B SaaS experience is solid but he's never led a team larger than 3. A strong individual contributor who could grow into the leadership aspects of this role.",
    ats_summary: "Good match on growth and analytics keywords; lighter on PLG and team leadership indicators.",
    risk_flags: ["Limited team leadership experience (max team of 3)"],
    ats_keywords_matched: ["growth", "A/B testing", "analytics", "CRM", "B2B SaaS", "SQL"],
    ats_keywords_missing: ["PLG", "marketing automation", "team leadership"],
    screened_at: daysAgo(12), stage_updated_at: daysAgo(7), applied_at: daysAgo(16),
    resume_text: "Daniel Lee | d.lee@email.com\n\nGrowth Manager · 6 years\n\nExperience:\n- Growth Manager, Intercom (2021–present): Managed $2M paid budget, 40% improvement in CAC, SQL reporting, managed team of 3\n- Performance Marketing Manager, Zendesk (2018–2021): SEM/SEO, A/B testing landing pages, CRM integration\n\nSkills: Growth marketing, SEM/SEO, SQL, Amplitude, HubSpot, A/B testing, paid social\n\nEducation: BA Marketing, NYU Stern",
  },
  {
    job_index: 1, name: "Sophie Turner", email: "sophie.t@demo.jobsai.work",
    source: "referral", stage: "screened",
    match_score: 72, skills_score: 70, experience_score: 73, culture_score: 73, ats_score: 67,
    ai_recommendation: "yes",
    ai_summary: "Sophie has a strong content-led growth background and good analytical skills, but her experience skews toward consumer rather than B2B SaaS. Limited paid acquisition depth. Could be a good fit if the role has strong organic/content components.",
    ats_summary: "Moderate match — strong content and SEO coverage but limited paid and PLG keywords.",
    risk_flags: ["Consumer-focused background — limited enterprise/B2B SaaS exposure"],
    ats_keywords_matched: ["growth", "analytics", "A/B testing", "SEO", "CRM"],
    ats_keywords_missing: ["PLG", "B2B SaaS", "paid acquisition", "marketing automation"],
    screened_at: daysAgo(10), stage_updated_at: daysAgo(10), applied_at: daysAgo(14),
    resume_text: "Sophie Turner | s.turner@email.com\n\nGrowth Marketer · 5 years\n\nExperience:\n- Growth Lead, Calm (2021–present): Content-led growth, SEO, A/B testing, grew organic to 2M/month\n- Growth Manager, BuzzFeed (2019–2021): Viral content strategy, social growth, some CRM work\n\nSkills: SEO, content marketing, A/B testing, Google Analytics, HubSpot, Mailchimp\n\nEducation: BA Communications, Boston University",
  },
  {
    job_index: 1, name: "Ryan Martinez", email: "r.martinez@demo.jobsai.work",
    source: "direct", stage: "screened",
    match_score: 54, skills_score: 50, experience_score: 55, culture_score: 57, ats_score: 48,
    ai_recommendation: "maybe",
    ai_summary: "Ryan's background is primarily in traditional digital marketing and brand. While he has growth experience, it's thin and lacks the data-driven, PLG depth this role demands. The analytical skills gap is a concern for a Head of Growth position.",
    ats_summary: "Below average keyword match — brand and social marketing don't align well with growth engineering requirements.",
    risk_flags: ["Brand/social marketing background — limited growth engineering skills", "No SQL or data analysis mentioned"],
    ats_keywords_matched: ["marketing", "analytics"],
    ats_keywords_missing: ["growth", "A/B testing", "PLG", "SQL", "B2B SaaS", "CRM", "paid acquisition"],
    screened_at: daysAgo(9), stage_updated_at: daysAgo(9), applied_at: daysAgo(13),
    resume_text: "Ryan Martinez | r.martinez@email.com\n\nDigital Marketing Manager · 5 years\n\nExperience:\n- Marketing Manager, Consumer Brand (2020–present): Brand campaigns, social media, email marketing, some Google Ads\n- Marketing Coordinator, Agency (2018–2020): Social media management, content creation\n\nSkills: Social media, email marketing, Google Ads, Photoshop, brand management\n\nEducation: BA Marketing, Florida State",
  },
  {
    job_index: 1, name: "Tyler Brooks", email: "t.brooks@demo.jobsai.work",
    source: "indeed", stage: "rejected",
    match_score: 32, skills_score: 25, experience_score: 35, culture_score: 36, ats_score: 22,
    ai_recommendation: "no",
    ai_summary: "Tyler is a recent graduate with limited relevant experience. The role requires 6+ years leading growth teams; Tyler has 1 year in a junior marketing role. Not a fit at this time.",
    ats_summary: "Very low keyword match — entry-level profile for a senior leadership role.",
    risk_flags: ["Only 1 year of experience — role requires 6+", "No leadership or data skills demonstrated"],
    ats_keywords_matched: ["marketing"],
    ats_keywords_missing: ["growth", "PLG", "analytics", "SQL", "A/B testing", "CRM", "team leadership", "B2B SaaS"],
    screened_at: daysAgo(12), stage_updated_at: daysAgo(11), applied_at: daysAgo(14),
    resume_text: "Tyler Brooks | t.brooks@email.com\n\nMarketing Coordinator · 1 year\n\nExperience:\n- Marketing Coordinator, Local Retailer (2023–present): Managed Instagram, wrote blog posts, ran email newsletters\n\nSkills: Instagram, Canva, Mailchimp, Microsoft Office\n\nEducation: BA Communications, Community College",
  },

  // ── DevOps / Platform Engineer ─────────────────────────────────────────────
  {
    job_index: 2, name: "Noah Williams", email: "noah.w@demo.jobsai.work",
    source: "linkedin", stage: "interview",
    match_score: 84, skills_score: 88, experience_score: 82, culture_score: 82, ats_score: 83,
    ai_recommendation: "yes",
    ai_summary: "Noah has 6 years of strong DevOps experience with deep AWS and Terraform expertise. His Kubernetes background is solid and he's built CI/CD pipelines that serve millions of deployments per month. One flag: his observability tooling experience is DataDog only — not Prometheus/Grafana stack.",
    ats_summary: "Strong keyword coverage across AWS, Terraform, Kubernetes, and CI/CD.",
    risk_flags: ["Observability stack is Datadog only — no Prometheus/Grafana"],
    ats_keywords_matched: ["AWS", "Terraform", "Kubernetes", "CI/CD", "Docker", "security", "monitoring"],
    ats_keywords_missing: ["Prometheus", "Grafana", "networking"],
    screened_at: daysAgo(11), stage_updated_at: daysAgo(7), applied_at: daysAgo(14),
    resume_text: "Noah Williams | noah.w@email.com\n\nSenior DevOps Engineer · 6 years\n\nExperience:\n- Senior DevOps Engineer, Snowflake (2021–present): AWS ECS/EKS, Terraform, CI/CD pipelines (GitHub Actions), Datadog monitoring, 99.99% uptime SLO\n- DevOps Engineer, SendGrid (2018–2021): Kubernetes migration, Docker, AWS infrastructure-as-code\n\nSkills: AWS (ECS, EKS, RDS, S3, CloudFront), Terraform, Kubernetes, Docker, GitHub Actions, Datadog\n\nEducation: BS Computer Science, University of Washington",
  },
  {
    job_index: 2, name: "Isabella Davis", email: "i.davis@demo.jobsai.work",
    source: "jobsai", stage: "screened",
    match_score: 77, skills_score: 80, experience_score: 74, culture_score: 77, ats_score: 74,
    ai_recommendation: "yes",
    ai_summary: "Isabella has solid AWS and Terraform experience with 5 years in infrastructure roles. Her Kubernetes experience is mostly self-managed clusters on personal projects — not production-scale. Strong CI/CD and security fundamentals.",
    ats_summary: "Good keyword coverage; Kubernetes depth is lighter than ideal for this role.",
    risk_flags: ["Kubernetes experience is personal projects only — not production-scale"],
    ats_keywords_matched: ["AWS", "Terraform", "CI/CD", "Docker", "security", "monitoring"],
    ats_keywords_missing: ["Kubernetes (production)", "EKS", "service mesh"],
    screened_at: daysAgo(9), stage_updated_at: daysAgo(9), applied_at: daysAgo(12),
    resume_text: "Isabella Davis | i.davis@email.com\n\nInfrastructure Engineer · 5 years\n\nExperience:\n- Infrastructure Engineer, Twilio (2020–present): AWS (EC2, RDS, S3), Terraform, Jenkins/GitHub Actions CI, security hardening, IAM\n- SRE, PagerDuty (2018–2020): On-call, incident response, Prometheus/Grafana, Docker\n\nSkills: AWS, Terraform, Docker, GitHub Actions, Prometheus, Grafana, Python, Bash\n\nEducation: BS Information Systems, University of Texas",
  },
  {
    job_index: 2, name: "Liam Foster", email: "l.foster@demo.jobsai.work",
    source: "direct", stage: "screened",
    match_score: 65, skills_score: 60, experience_score: 67, culture_score: 68, ats_score: 58,
    ai_recommendation: "maybe",
    ai_summary: "Liam has the right fundamentals but is lighter on the cloud-native tooling the role demands. His AWS experience is solid for EC2/S3 but he hasn't worked with containers or Kubernetes at scale. A junior to mid-level DevOps candidate.",
    ats_summary: "Below average — covers basic AWS but missing Terraform, Kubernetes, and CI/CD keywords.",
    risk_flags: ["Limited IaC experience — mostly manual AWS console", "No Kubernetes experience mentioned"],
    ats_keywords_matched: ["AWS", "Docker", "monitoring"],
    ats_keywords_missing: ["Terraform", "Kubernetes", "CI/CD", "EKS", "security hardening"],
    screened_at: daysAgo(8), stage_updated_at: daysAgo(8), applied_at: daysAgo(11),
    resume_text: "Liam Foster | l.foster@email.com\n\nCloud Engineer · 3 years\n\nExperience:\n- Cloud Engineer, Mid-size SaaS (2021–present): AWS EC2, S3, RDS setup (mostly via console), basic bash scripts, some Docker\n- IT Admin, Startup (2019–2021): Server management, networking, Linux\n\nSkills: AWS (EC2, S3, RDS), Docker basics, Linux, Bash, Python basics\n\nEducation: BS Information Technology, Arizona State",
  },
  {
    job_index: 2, name: "Ava Johnson", email: "ava.j@demo.jobsai.work",
    source: "referral", stage: "applied",
    match_score: null, skills_score: null, experience_score: null, culture_score: null, ats_score: null,
    ai_recommendation: null, ai_summary: null, ats_summary: null,
    risk_flags: [], ats_keywords_matched: [], ats_keywords_missing: [],
    screened_at: null, stage_updated_at: daysAgo(12), applied_at: daysAgo(12),
    resume_text: "Ava Johnson | ava.j@email.com\n\nSenior Platform Engineer · 7 years\n\nExperience:\n- Staff Platform Engineer, Cloudflare (2020–present): AWS, GCP, Terraform, Kubernetes at massive scale, built developer platform used by 200 engineers\n- Senior SRE, Datadog (2017–2020): Infrastructure automation, Terraform, Kubernetes, Prometheus\n\nSkills: AWS, GCP, Terraform, Kubernetes, Docker, Prometheus, Grafana, Python, Go\n\nEducation: MS Computer Science, MIT",
  },
  {
    job_index: 2, name: "Ethan Brown", email: "e.brown@demo.jobsai.work",
    source: "indeed", stage: "rejected",
    match_score: 41, skills_score: 35, experience_score: 44, culture_score: 44, ats_score: 33,
    ai_recommendation: "no",
    ai_summary: "Ethan's background is Windows server administration. His AWS experience is minimal and he has no container or IaC experience. This role requires cloud-native DevOps expertise that Ethan does not currently possess.",
    ats_summary: "Low match — Windows sysadmin skills don't map to cloud-native DevOps requirements.",
    risk_flags: ["Windows/on-prem background — no cloud-native experience", "No Terraform, Kubernetes, or CI/CD"],
    ats_keywords_matched: ["monitoring"],
    ats_keywords_missing: ["AWS", "Terraform", "Kubernetes", "Docker", "CI/CD", "security hardening"],
    screened_at: daysAgo(10), stage_updated_at: daysAgo(9), applied_at: daysAgo(11),
    resume_text: "Ethan Brown | e.brown@email.com\n\nSystems Administrator · 4 years\n\nExperience:\n- Sysadmin, Law Firm (2020–present): Windows Server, Active Directory, Office 365, network monitoring\n- IT Support, University (2019–2020): Helpdesk, hardware, some Linux\n\nSkills: Windows Server, Active Directory, Office 365, Nagios (monitoring), PowerShell\n\nEducation: Associate Degree IT, Community College",
  },
];

// ── Seed handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const force = req.nextUrl.searchParams.get("force") === "true";

  // Check for existing seeded data
  const { data: seededJobs } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id")
    .eq("org_id", org.id)
    .like("description", `%${SEED_MARKER}%`);

  if (seededJobs?.length && !force) {
    return NextResponse.json({ error: "Demo data already seeded. Use ?force=true to reseed." }, { status: 409 });
  }

  // Wipe previous seed if force
  if (seededJobs?.length && force) {
    await supabaseAdmin
      .from("enterprise_jobs")
      .delete()
      .in("id", seededJobs.map((j) => j.id));
  }

  // ── 1. Insert jobs ─────────────────────────────────────────────────────────
  const { data: createdJobs, error: jobsErr } = await supabaseAdmin
    .from("enterprise_jobs")
    .insert(JOBS.map((j) => ({ ...j, org_id: org.id, created_by: userId })))
    .select("id, title");

  if (jobsErr || !createdJobs) {
    return NextResponse.json({ error: jobsErr?.message ?? "Failed to create jobs." }, { status: 500 });
  }

  // ── 2. Insert applications ─────────────────────────────────────────────────
  const appInserts = CANDIDATES.map((c) => ({
    org_id: org.id,
    job_id: createdJobs[c.job_index].id,
    candidate_name: c.name,
    candidate_email: c.email,
    source: c.source,
    stage: c.stage,
    match_score: c.match_score,
    skills_score: c.skills_score,
    experience_score: c.experience_score,
    culture_score: c.culture_score,
    ats_score: c.ats_score,
    ai_recommendation: c.ai_recommendation,
    ai_summary: c.ai_summary,
    ats_summary: c.ats_summary,
    risk_flags: c.risk_flags,
    ats_keywords_matched: c.ats_keywords_matched,
    ats_keywords_missing: c.ats_keywords_missing,
    resume_text: c.resume_text,
    screened_at: c.screened_at,
    stage_updated_at: c.stage_updated_at,
    created_at: c.applied_at,
    tags: c.match_score !== null && c.match_score >= 80 ? ["top-candidate"] : [],
  }));

  const { data: createdApps, error: appsErr } = await supabaseAdmin
    .from("enterprise_applications")
    .insert(appInserts)
    .select("id, candidate_name, stage, job_id");

  if (appsErr || !createdApps) {
    return NextResponse.json({ error: appsErr?.message ?? "Failed to create applications." }, { status: 500 });
  }

  // ── 3. Insert interviews for interview+ stage candidates ───────────────────
  const interviewCandidates = CANDIDATES.filter((c) =>
    ["interview", "offer", "hired"].includes(c.stage) && c.match_score !== null
  );

  const interviewInserts = interviewCandidates.map((c) => {
    const app = createdApps.find((a) => a.candidate_name === c.name);
    if (!app) return null;
    return {
      application_id: app.id,
      job_id: createdJobs[c.job_index].id,
      org_id: org.id,
      token: randHex(),
      status: "completed",
      invited_at: daysAgo(c.stage === "hired" ? 10 : c.stage === "offer" ? 8 : 6),
      started_at: daysAgo(c.stage === "hired" ? 9 : c.stage === "offer" ? 7 : 5),
      completed_at: daysAgo(c.stage === "hired" ? 9 : c.stage === "offer" ? 7 : 5),
      expires_at: daysAgo(-7),
      overall_score: c.match_score,
      communication: Math.min(100, (c.culture_score ?? 70) + Math.floor(Math.random() * 5)),
      technical: Math.min(100, (c.skills_score ?? 70) + Math.floor(Math.random() * 5)),
      behavioral: Math.min(100, (c.experience_score ?? 70) + Math.floor(Math.random() * 5)),
      ai_summary: c.ai_summary,
      ai_recommendation: c.ai_recommendation,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (interviewInserts.length) {
    await supabaseAdmin.from("enterprise_interviews").insert(interviewInserts);
  }

  // ── 4. Insert one offer letter ─────────────────────────────────────────────
  const offerCandidates = createdApps.filter((a) => a.stage === "offer");
  if (offerCandidates.length) {
    const offerApp = offerCandidates[0];
    const offerCandidate = CANDIDATES.find((c) => c.name === offerApp.candidate_name);
    const offerJob = createdJobs.find((j) => j.id === offerApp.job_id);
    await supabaseAdmin.from("enterprise_offer_letters").insert({
      org_id: org.id,
      job_id: offerApp.job_id,
      application_id: offerApp.id,
      created_by: userId,
      candidate_name: offerApp.candidate_name,
      candidate_email: offerCandidate?.email ?? "candidate@demo.jobsai.work",
      job_title: offerJob?.title ?? "Role",
      salary: "$140,000/year",
      start_date: "2025-08-01",
      status: "sent",
      content: `<p>Dear ${offerApp.candidate_name},</p><p>We are thrilled to offer you the position of <strong>${offerJob?.title}</strong> at ${org.name}. This is a full-time position with a starting salary of $140,000 per year.</p><p>We believe your skills and experience are an excellent fit for our team and we look forward to the contributions you'll make.</p><p>Please review and sign this offer by <strong>July 14, 2025</strong>.</p><p>Warm regards,<br/>The ${org.name} Team</p>`,
    });
  }

  // ── 5. Insert pipeline rules ───────────────────────────────────────────────
  const { data: createdRules } = await supabaseAdmin
    .from("enterprise_pipeline_rules")
    .insert([
      {
        org_id: org.id,
        name: "Fast-track top candidates",
        description: "Automatically advance candidates scoring 80%+ to interview and tag them.",
        trigger_event: "application_screened",
        trigger_config: {},
        conditions: [{ field: "match_score", operator: "gte", value: 80 }],
        action: "move_stage",
        action_config: { stage: "interview" },
        actions: [
          { action: "move_stage", action_config: { stage: "interview" } },
          { action: "add_tag", action_config: { tag: "top-candidate" } },
        ],
        active: true,
        run_count: 6,
      },
      {
        org_id: org.id,
        name: "Auto-reject weak applicants",
        description: "Reject candidates below 40% match and send a polite rejection email.",
        trigger_event: "application_screened",
        trigger_config: {},
        conditions: [{ field: "match_score", operator: "lt", value: 40 }],
        action: "auto_reject",
        action_config: { send_email: true },
        actions: [{ action: "auto_reject", action_config: { send_email: true } }],
        active: true,
        run_count: 3,
      },
    ])
    .select("id, name");

  // ── 6. Insert agent activity history ──────────────────────────────────────
  const topCandidates = createdApps.filter((a) =>
    ["interview", "offer", "hired"].includes(a.stage)
  ).slice(0, 6);
  const rejectCandidates = createdApps.filter((a) => a.stage === "rejected").slice(0, 3);

  const agentActivity = [
    ...topCandidates.map((app) => ({
      org_id: org.id,
      rule_id: createdRules?.[0]?.id ?? null,
      rule_name: "Fast-track top candidates",
      application_id: app.id,
      candidate_name: app.candidate_name,
      job_title: createdJobs.find((j) => j.id === app.job_id)?.title ?? "Role",
      action: "move_stage",
      result: "success",
      details: { steps: [{ action: "move_stage", stage: "interview", result: "success" }, { action: "add_tag", tag: "top-candidate", result: "success" }] },
      created_at: daysAgo(Math.floor(Math.random() * 5) + 8),
    })),
    ...rejectCandidates.map((app) => ({
      org_id: org.id,
      rule_id: createdRules?.[1]?.id ?? null,
      rule_name: "Auto-reject weak applicants",
      application_id: app.id,
      candidate_name: app.candidate_name,
      job_title: createdJobs.find((j) => j.id === app.job_id)?.title ?? "Role",
      action: "auto_reject",
      result: "success",
      details: { steps: [{ action: "auto_reject", send_email: true, result: "success" }] },
      created_at: daysAgo(Math.floor(Math.random() * 4) + 9),
    })),
  ];

  await supabaseAdmin.from("enterprise_agent_actions").insert(agentActivity);

  // ── 7. Audit log entries ───────────────────────────────────────────────────
  await supabaseAdmin.from("enterprise_audit_logs").insert([
    { org_id: org.id, user_id: userId, action: "demo.seeded", resource_type: "org", resource_id: org.id, metadata: { jobs: 3, candidates: CANDIDATES.length } },
  ]);

  return NextResponse.json({
    ok: true,
    seeded: {
      jobs: createdJobs.map((j) => ({ id: j.id, title: j.title })),
      candidates: CANDIDATES.length,
      interviews: interviewInserts.length,
      offer_letters: offerCandidates.length > 0 ? 1 : 0,
      pipeline_rules: 2,
      agent_actions: agentActivity.length,
    },
    demo_links: {
      dashboard:       "/enterprise/dashboard",
      first_job:       `/enterprise/jobs/${createdJobs[0].id}`,
      ai_picks:        `/enterprise/jobs/${createdJobs[0].id}?tab=picks`,
      hiring_manager:  "/enterprise/hiring-manager",
      agent:           "/enterprise/agent",
      analytics:       "/enterprise/analytics",
      compliance:      "/enterprise/compliance",
    },
  });
}

// ── Reset: wipe all seeded data ───────────────────────────────────────────────
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data: seededJobs } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id")
    .eq("org_id", org.id)
    .like("description", `%${SEED_MARKER}%`);

  if (!seededJobs?.length) {
    return NextResponse.json({ ok: true, message: "No demo data found." });
  }

  const jobIds = seededJobs.map((j) => j.id);
  await supabaseAdmin.from("enterprise_jobs").delete().in("id", jobIds);

  return NextResponse.json({ ok: true, deleted_jobs: jobIds.length });
}
