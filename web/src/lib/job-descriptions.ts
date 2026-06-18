// Evergreen job-description templates — data behind the /enterprise/resources/
// job-descriptions SEO hub. Hand-authored, editable templates by role. Extend by
// adding entries to JD_ROLES. Role slugs mirror interview-questions where possible
// so the two hubs cross-link.

export type JDRole = {
  slug: string;
  title: string;
  category: string;
  blurb: string;       // card + meta description
  summary: string;     // "About the role" paragraph (template)
  responsibilities: string[];
  requirements: string[];
  preferred: string[];
};

export const JD_ROLES: JDRole[] = [
  {
    slug: "frontend-engineer",
    title: "Frontend Engineer",
    category: "Engineering",
    blurb: "A ready-to-edit frontend engineer job description template.",
    summary: "We're looking for a Frontend Engineer to build fast, accessible, and polished user interfaces. You'll work closely with design and backend teams to turn product ideas into reliable features used by [customers/users] every day.",
    responsibilities: [
      "Build and maintain responsive, accessible UI in [framework, e.g. React].",
      "Collaborate with designers to translate specs into high-quality interfaces.",
      "Optimize application performance and front-end load times.",
      "Write tests and participate in code reviews to keep quality high.",
      "Partner with backend engineers on API contracts and data needs.",
    ],
    requirements: [
      "[3]+ years building production web applications.",
      "Strong JavaScript/TypeScript and modern framework experience.",
      "Solid understanding of HTML, CSS, and browser fundamentals.",
      "Experience with accessibility and cross-browser compatibility.",
    ],
    preferred: [
      "Experience with design systems and component libraries.",
      "Familiarity with testing tools and CI pipelines.",
      "An eye for design and interaction detail.",
    ],
  },
  {
    slug: "backend-engineer",
    title: "Backend Engineer",
    category: "Engineering",
    blurb: "A ready-to-edit backend engineer job description template.",
    summary: "We're hiring a Backend Engineer to design and build the services and APIs that power our product. You'll own systems end to end — from data modeling to reliability — and help us scale as we grow.",
    responsibilities: [
      "Design, build, and maintain APIs and backend services.",
      "Model data and choose appropriate datastores for each use case.",
      "Ensure reliability, observability, and performance under load.",
      "Write tests and participate in design and code reviews.",
      "Collaborate with frontend and product teams on requirements.",
    ],
    requirements: [
      "[3]+ years building backend services in [language].",
      "Strong understanding of databases, APIs, and system design.",
      "Experience with cloud infrastructure and deployment.",
      "Comfort with monitoring, debugging, and on-call practices.",
    ],
    preferred: [
      "Experience scaling systems or handling high traffic.",
      "Familiarity with message queues and async processing.",
      "Exposure to security and compliance best practices.",
    ],
  },
  {
    slug: "full-stack-engineer",
    title: "Full-Stack Engineer",
    category: "Engineering",
    blurb: "A ready-to-edit full-stack engineer job description template.",
    summary: "We're looking for a Full-Stack Engineer who can ship features end to end — from database to UI. You'll work across the stack, make pragmatic trade-offs, and help us move quickly without sacrificing quality.",
    responsibilities: [
      "Build features across frontend and backend.",
      "Design data models, APIs, and the interfaces that consume them.",
      "Own features from scoping through deployment and iteration.",
      "Keep the codebase healthy with tests and reviews.",
      "Collaborate with product and design on scope and trade-offs.",
    ],
    requirements: [
      "[3]+ years building web applications across the stack.",
      "Proficiency in [framework] and a backend language.",
      "Understanding of databases, APIs, and deployment.",
      "Ability to work independently and prioritize effectively.",
    ],
    preferred: [
      "Startup or fast-paced environment experience.",
      "Product sense and comfort with ambiguity.",
      "Experience with cloud platforms and CI/CD.",
    ],
  },
  {
    slug: "devops-engineer",
    title: "DevOps / SRE",
    category: "Engineering",
    blurb: "A ready-to-edit DevOps / SRE job description template.",
    summary: "We're hiring a DevOps / Site Reliability Engineer to make our infrastructure fast, secure, and reliable. You'll automate our deployment pipeline, improve observability, and keep production healthy.",
    responsibilities: [
      "Build and maintain CI/CD pipelines and infrastructure as code.",
      "Improve reliability, monitoring, and alerting across services.",
      "Manage cloud infrastructure, cost, and security.",
      "Lead incident response and post-incident reviews.",
      "Partner with engineering to make deploys safe and frequent.",
    ],
    requirements: [
      "[3]+ years in DevOps, SRE, or platform engineering.",
      "Experience with [cloud provider] and containers/orchestration.",
      "Infrastructure-as-code and automation experience.",
      "Strong troubleshooting and incident-management skills.",
    ],
    preferred: [
      "Experience with observability tooling (metrics, logs, traces).",
      "Security and compliance experience.",
      "On-call leadership experience.",
    ],
  },
  {
    slug: "data-scientist",
    title: "Data Scientist",
    category: "Data & AI",
    blurb: "A ready-to-edit data scientist job description template.",
    summary: "We're looking for a Data Scientist to turn data into decisions. You'll analyze problems, build models where they add value, and communicate insights that move the business.",
    responsibilities: [
      "Analyze data to answer business questions and inform decisions.",
      "Design experiments (e.g. A/B tests) and interpret results.",
      "Build and validate models where they create measurable value.",
      "Communicate findings clearly to technical and non-technical teams.",
      "Partner with engineering to productionize analyses and models.",
    ],
    requirements: [
      "[3]+ years in data science or quantitative analysis.",
      "Strong statistics and experimentation fundamentals.",
      "Proficiency in Python or R and SQL.",
      "Ability to communicate uncertainty and impact.",
    ],
    preferred: [
      "Experience deploying models to production.",
      "Familiarity with ML frameworks and pipelines.",
      "Domain experience in [industry].",
    ],
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    category: "Product & Design",
    blurb: "A ready-to-edit product manager job description template.",
    summary: "We're hiring a Product Manager to own the strategy and execution for [product area]. You'll talk to customers, prioritize ruthlessly, and ship outcomes — not just features.",
    responsibilities: [
      "Own the roadmap and priorities for [product area].",
      "Run discovery with customers to validate problems and solutions.",
      "Write clear specs and partner with engineering and design.",
      "Define success metrics and measure outcomes after launch.",
      "Communicate strategy and trade-offs to stakeholders.",
    ],
    requirements: [
      "[3]+ years in product management.",
      "Track record of shipping products that drove measurable outcomes.",
      "Strong prioritization, communication, and discovery skills.",
      "Comfort working with data and engineering teams.",
    ],
    preferred: [
      "Experience in [domain/industry].",
      "Technical background or fluency.",
      "Experience with B2B/SaaS products.",
    ],
  },
  {
    slug: "product-designer",
    title: "Product Designer (UX)",
    category: "Product & Design",
    blurb: "A ready-to-edit product designer job description template.",
    summary: "We're looking for a Product Designer to craft intuitive, beautiful experiences. You'll own design end to end — from research to high-fidelity UI — and partner closely with product and engineering.",
    responsibilities: [
      "Design end-to-end flows from research through high-fidelity UI.",
      "Incorporate user research and testing into your process.",
      "Contribute to and maintain the design system.",
      "Partner with engineers to ship designs faithfully.",
      "Balance user needs, business goals, and technical constraints.",
    ],
    requirements: [
      "[3]+ years in product/UX design with a strong portfolio.",
      "Proficiency in [design tool, e.g. Figma].",
      "Experience with user research and validation.",
      "Strong visual and interaction design craft.",
    ],
    preferred: [
      "Experience with design systems at scale.",
      "Front-end familiarity (HTML/CSS).",
      "B2B/SaaS product experience.",
    ],
  },
  {
    slug: "account-executive",
    title: "Account Executive",
    category: "Sales & Marketing",
    blurb: "A ready-to-edit account executive job description template.",
    summary: "We're hiring an Account Executive to own the full sales cycle — from discovery to close. You'll build pipeline, run a consultative process, and hit quota while setting customers up for success.",
    responsibilities: [
      "Own the full sales cycle from discovery to close.",
      "Run consultative discovery and build compelling business cases.",
      "Manage and forecast your pipeline accurately.",
      "Collaborate with SDRs, marketing, and customer success.",
      "Consistently meet or exceed quota.",
    ],
    requirements: [
      "[2]+ years of closing experience in [B2B/SaaS] sales.",
      "Track record of hitting or exceeding quota.",
      "Strong discovery, negotiation, and forecasting skills.",
      "Excellent written and verbal communication.",
    ],
    preferred: [
      "Experience selling to [buyer persona].",
      "Familiarity with [CRM] and sales tooling.",
      "Experience in [industry].",
    ],
  },
  {
    slug: "sales-development-rep",
    title: "Sales Development Rep (SDR)",
    category: "Sales & Marketing",
    blurb: "A ready-to-edit SDR job description template.",
    summary: "We're looking for a Sales Development Rep to generate and qualify pipeline through outbound and inbound outreach. You'll be the first touchpoint for prospects and a key driver of growth.",
    responsibilities: [
      "Prospect and qualify leads through calls, email, and social.",
      "Research accounts and personalize outreach.",
      "Book qualified meetings for account executives.",
      "Maintain accurate records in the CRM.",
      "Hit activity and meeting targets.",
    ],
    requirements: [
      "[1]+ years in an SDR/BDR or comparable role (or strong potential).",
      "Excellent communication and resilience.",
      "Organized and goal-oriented.",
      "Comfort with high-volume outreach.",
    ],
    preferred: [
      "Experience with [CRM] and sales-engagement tools.",
      "[B2B/SaaS] experience.",
      "Familiarity with the [industry] buyer.",
    ],
  },
  {
    slug: "marketing-manager",
    title: "Marketing Manager",
    category: "Sales & Marketing",
    blurb: "A ready-to-edit marketing manager job description template.",
    summary: "We're hiring a Marketing Manager to own campaigns that drive pipeline and growth. You'll plan across channels, measure rigorously, and tie marketing to revenue.",
    responsibilities: [
      "Plan and execute campaigns across [channels].",
      "Own measurement and report on marketing's impact on pipeline.",
      "Partner with sales on lead quality and follow-up.",
      "Refine positioning, messaging, and content.",
      "Manage budget and prioritize spend for ROI.",
    ],
    requirements: [
      "[3]+ years in marketing, ideally [B2B/SaaS].",
      "Experience running multi-channel campaigns.",
      "Strong analytical and measurement skills.",
      "Excellent writing and project management.",
    ],
    preferred: [
      "Experience with [marketing automation/analytics tools].",
      "Demand-gen or content-marketing depth.",
      "Industry experience in [domain].",
    ],
  },
  {
    slug: "customer-success-manager",
    title: "Customer Success Manager",
    category: "Customer & Operations",
    blurb: "A ready-to-edit customer success manager job description template.",
    summary: "We're looking for a Customer Success Manager to drive adoption, retention, and growth across a book of accounts. You'll be your customers' trusted advisor and their advocate internally.",
    responsibilities: [
      "Own onboarding, adoption, and renewals for your accounts.",
      "Monitor account health and proactively address churn risk.",
      "Run business reviews and drive expansion opportunities.",
      "Advocate for customers with product and support teams.",
      "Hit retention and net-revenue-retention targets.",
    ],
    requirements: [
      "[2]+ years in customer success or account management.",
      "Experience managing a book of business and renewals.",
      "Strong relationship and communication skills.",
      "Comfort with data and account-health metrics.",
    ],
    preferred: [
      "[B2B/SaaS] experience.",
      "Familiarity with CS tooling and CRMs.",
      "Experience with [customer segment].",
    ],
  },
  {
    slug: "recruiter",
    title: "Recruiter",
    category: "People & Talent",
    blurb: "A ready-to-edit recruiter job description template.",
    summary: "We're hiring a Recruiter to own hiring end to end — from sourcing to offer. You'll partner with hiring managers, run a great candidate experience, and help us build a strong team.",
    responsibilities: [
      "Manage full-cycle recruiting for [teams/roles].",
      "Source candidates across channels and build pipelines.",
      "Screen for fit and partner with hiring managers.",
      "Create an excellent candidate experience.",
      "Track metrics and improve the hiring process.",
    ],
    requirements: [
      "[2]+ years of full-cycle or agency recruiting.",
      "Strong sourcing and screening skills.",
      "Excellent communication and organization.",
      "Experience with an ATS.",
    ],
    preferred: [
      "Experience hiring for [function, e.g. engineering].",
      "Familiarity with sourcing tools.",
      "A data-driven approach to hiring.",
    ],
  },
  {
    slug: "hr-manager",
    title: "HR Manager",
    category: "People & Talent",
    blurb: "A ready-to-edit HR manager job description template.",
    summary: "We're looking for an HR Manager to own people operations, employee relations, and policy. You'll balance employee advocacy with business needs and help shape a healthy culture.",
    responsibilities: [
      "Own people operations, policies, and compliance.",
      "Handle employee relations and sensitive issues.",
      "Drive engagement, retention, and culture initiatives.",
      "Advise managers and leadership on people decisions.",
      "Maintain accurate HR records and reporting.",
    ],
    requirements: [
      "[3]+ years in HR, ideally with management scope.",
      "Knowledge of employment law and compliance.",
      "Strong judgment and discretion.",
      "Excellent interpersonal skills.",
    ],
    preferred: [
      "HR certification (e.g. SHRM/PHR).",
      "Experience in a high-growth company.",
      "Familiarity with HRIS tools.",
    ],
  },
  {
    slug: "financial-analyst",
    title: "Financial Analyst",
    category: "Finance & Operations",
    blurb: "A ready-to-edit financial analyst job description template.",
    summary: "We're hiring a Financial Analyst to build models, analyze performance, and support decision-making. You'll turn numbers into insight that leadership can act on.",
    responsibilities: [
      "Build and maintain financial models and forecasts.",
      "Analyze performance against budget and surface insights.",
      "Support budgeting, planning, and reporting cycles.",
      "Present analyses clearly to non-finance stakeholders.",
      "Partner cross-functionally on business cases.",
    ],
    requirements: [
      "[2]+ years in FP&A or financial analysis.",
      "Strong Excel/modeling and analytical skills.",
      "Attention to detail and accuracy.",
      "Clear communication of financial concepts.",
    ],
    preferred: [
      "SQL or BI-tool experience.",
      "[Industry] or SaaS finance experience.",
      "Progress toward CFA/CPA.",
    ],
  },
  {
    slug: "operations-manager",
    title: "Operations Manager",
    category: "Finance & Operations",
    blurb: "A ready-to-edit operations manager job description template.",
    summary: "We're looking for an Operations Manager to build process and drive execution across teams. You'll remove bottlenecks, improve how we work, and use data to make decisions.",
    responsibilities: [
      "Design and improve processes across [functions].",
      "Identify and remove operational bottlenecks.",
      "Define and track operational metrics.",
      "Lead cross-functional initiatives and align stakeholders.",
      "Use data to drive operational decisions.",
    ],
    requirements: [
      "[3]+ years in operations or a related role.",
      "Process design and project-management experience.",
      "Strong analytical and communication skills.",
      "Ability to lead change across teams.",
    ],
    preferred: [
      "Experience in a high-growth or startup environment.",
      "Familiarity with [tools/systems].",
      "Process-improvement methodology experience.",
    ],
  },
];

export const JD_BY_SLUG: Record<string, JDRole> = Object.fromEntries(JD_ROLES.map((r) => [r.slug, r]));

export function getJD(slug: string): JDRole | undefined {
  return JD_BY_SLUG[slug];
}

export function jdByCategory(): { category: string; roles: JDRole[] }[] {
  const order: string[] = [];
  const map = new Map<string, JDRole[]>();
  for (const r of JD_ROLES) {
    if (!map.has(r.category)) { map.set(r.category, []); order.push(r.category); }
    map.get(r.category)!.push(r);
  }
  return order.map((category) => ({ category, roles: map.get(category)! }));
}
