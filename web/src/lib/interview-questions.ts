// Evergreen interview-question library — the data behind the /enterprise/resources/
// interview-questions SEO hub. Hand-authored, genuinely useful question sets by
// role. Extend by adding entries to ROLES.

export type QuestionSection = { heading: string; questions: string[] };

export type RoleGuide = {
  slug: string;
  title: string;        // role name, e.g. "Frontend Engineer"
  category: string;     // grouping for the index
  blurb: string;        // one-line summary for cards + meta description
  intro: string;        // short intro paragraph on the page
  sections: QuestionSection[];
};

export const ROLES: RoleGuide[] = [
  {
    slug: "frontend-engineer",
    title: "Frontend Engineer",
    category: "Engineering",
    blurb: "Screening, technical, and behavioral questions to hire frontend engineers.",
    intro: "Use these questions to assess a frontend engineer's depth in JavaScript, the browser, UI architecture, performance, and collaboration with design and backend teams.",
    sections: [
      { heading: "Phone screen", questions: [
        "Walk me through a recent UI you built end to end — what was the hardest part?",
        "What frameworks and tooling are you most productive in, and why?",
        "How do you decide when a component should hold state vs. lift it up?",
        "What does a good developer experience look like on a frontend team?",
      ] },
      { heading: "Technical", questions: [
        "Explain the browser rendering path and where reflows/repaints come from.",
        "How would you diagnose and fix a slow, janky page?",
        "How do you handle accessibility (keyboard, ARIA, focus) in a complex component?",
        "Describe your approach to state management on a large app.",
        "How do you prevent and catch regressions — testing, types, CI?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a time you disagreed with a designer. How did it resolve?",
        "Describe a performance problem you owned from report to fix.",
        "How do you keep up with a fast-moving frontend ecosystem without chasing hype?",
      ] },
      { heading: "Situational", questions: [
        "A page works locally but breaks for 5% of users in production. How do you investigate?",
        "Design specs and engineering constraints conflict before a deadline. What do you do?",
      ] },
    ],
  },
  {
    slug: "backend-engineer",
    title: "Backend Engineer",
    category: "Engineering",
    blurb: "Questions to evaluate backend engineers on APIs, data, and reliability.",
    intro: "These questions probe a backend engineer's understanding of API design, databases, concurrency, and building systems that stay reliable under load.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe a service you own — its responsibilities and who depends on it.",
        "What languages and datastores are you strongest in?",
        "How do you think about API versioning and backward compatibility?",
      ] },
      { heading: "Technical", questions: [
        "When would you choose a relational database over a document or key-value store?",
        "How do you design an idempotent endpoint, and why does it matter?",
        "Walk through how you'd add caching to a read-heavy endpoint.",
        "How do you handle a long-running job triggered by an API request?",
        "What does your approach to observability (logs, metrics, traces) look like?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about an outage you helped resolve — what was the root cause and the fix?",
        "Describe a time you had to pay down technical debt. How did you justify it?",
      ] },
      { heading: "Situational", questions: [
        "A query that was fast is now timing out as data grew. How do you approach it?",
        "You need to change a schema used by three other teams. How do you roll it out safely?",
      ] },
    ],
  },
  {
    slug: "full-stack-engineer",
    title: "Full-Stack Engineer",
    category: "Engineering",
    blurb: "Balanced questions across frontend, backend, and product sense.",
    intro: "Assess a full-stack engineer's ability to ship features end to end and make sensible trade-offs across the stack.",
    sections: [
      { heading: "Phone screen", questions: [
        "Tell me about a feature you built from database to UI.",
        "Where do you naturally gravitate — frontend or backend — and where do you stretch?",
        "How do you scope an ambiguous feature request into shippable work?",
      ] },
      { heading: "Technical", questions: [
        "How do you decide what logic belongs on the client vs. the server?",
        "Walk through how you'd model data and APIs for a commenting feature.",
        "How do you keep a full-stack codebase maintainable as it grows?",
        "What's your testing strategy across the stack?",
      ] },
      { heading: "Behavioral", questions: [
        "Describe a time you shipped something fast and had to clean it up later.",
        "How do you collaborate with PMs and designers on scope?",
      ] },
      { heading: "Situational", questions: [
        "A feature is half-built and priorities shift. How do you decide what to do with it?",
        "You're the only engineer on a feature with a tight deadline. How do you de-risk it?",
      ] },
    ],
  },
  {
    slug: "devops-engineer",
    title: "DevOps / SRE",
    category: "Engineering",
    blurb: "Reliability, infrastructure, and incident-response questions.",
    intro: "Use these to evaluate a DevOps or SRE candidate on automation, reliability, and how they think about systems under failure.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe your current infrastructure and your role in it.",
        "What's your philosophy on infrastructure as code?",
        "How do you measure the reliability of a service?",
      ] },
      { heading: "Technical", questions: [
        "Walk me through what happens when you deploy a change to production.",
        "How do you design alerting that's actionable and not noisy?",
        "What's your approach to secrets management and least privilege?",
        "How would you set up CI/CD for a team shipping multiple times a day?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about the worst incident you've handled. What did you change afterward?",
        "How do you balance reliability work against feature pressure?",
      ] },
      { heading: "Situational", questions: [
        "Error rates spike right after a deploy. Walk me through your first 10 minutes.",
        "Cloud costs doubled this month. How do you find and fix the cause?",
      ] },
    ],
  },
  {
    slug: "data-scientist",
    title: "Data Scientist",
    category: "Data & AI",
    blurb: "Statistics, modeling, and business-impact questions for data scientists.",
    intro: "These questions assess statistical rigor, modeling judgment, and whether a data scientist can tie analysis to real business outcomes.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe a project where your analysis changed a decision.",
        "What tools and languages do you use day to day?",
        "How do you decide whether a problem needs a model at all?",
      ] },
      { heading: "Technical", questions: [
        "How do you check whether a result is statistically significant and practically meaningful?",
        "Explain overfitting and how you guard against it.",
        "How would you design an A/B test for a new feature?",
        "Walk me through how you'd handle missing or messy data.",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a time your analysis was wrong or misleading. What happened?",
        "How do you communicate uncertainty to non-technical stakeholders?",
      ] },
      { heading: "Situational", questions: [
        "A stakeholder wants a metric to look better. How do you handle it?",
        "Your model performs well offline but poorly in production. What do you check?",
      ] },
    ],
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    category: "Product & Design",
    blurb: "Prioritization, discovery, and execution questions for PMs.",
    intro: "Evaluate a product manager's judgment on prioritization, customer discovery, and shipping outcomes — not just features.",
    sections: [
      { heading: "Phone screen", questions: [
        "Walk me through a product you shipped and the outcome it drove.",
        "How do you decide what to build next?",
        "How do you know a feature succeeded?",
      ] },
      { heading: "Role-specific", questions: [
        "How do you run discovery before committing to a roadmap?",
        "Describe how you'd prioritize a backlog with limited engineering capacity.",
        "How do you write a spec engineers actually want to build from?",
        "How do you handle a feature request from your biggest customer that doesn't fit the strategy?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a product bet that failed. What did you learn?",
        "Describe a time you said no to a stakeholder. How did you do it?",
      ] },
      { heading: "Situational", questions: [
        "Engineering says a committed feature will slip two weeks. What do you do?",
        "Usage is flat after a launch you championed. How do you respond?",
      ] },
    ],
  },
  {
    slug: "product-designer",
    title: "Product Designer (UX)",
    category: "Product & Design",
    blurb: "Process, craft, and collaboration questions for product designers.",
    intro: "These questions assess a designer's process, craft, and ability to partner with product and engineering to ship usable work.",
    sections: [
      { heading: "Phone screen", questions: [
        "Walk me through a project in your portfolio from problem to outcome.",
        "How do you incorporate user research into your process?",
        "What does good collaboration with engineers look like to you?",
      ] },
      { heading: "Role-specific", questions: [
        "How do you balance user needs, business goals, and technical constraints?",
        "How do you validate a design before it ships?",
        "Describe how you'd improve onboarding for a product with low activation.",
        "How do you maintain consistency across a growing product?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about feedback that changed your design. How did you handle it?",
        "Describe a time a design didn't test well. What did you do?",
      ] },
      { heading: "Situational", questions: [
        "You have one week and no research budget for a key flow. How do you proceed?",
        "A stakeholder pushes a design you think hurts usability. What do you do?",
      ] },
    ],
  },
  {
    slug: "account-executive",
    title: "Account Executive",
    category: "Sales & Marketing",
    blurb: "Pipeline, discovery, and closing questions for sales AEs.",
    intro: "Use these to assess an account executive's discovery skills, deal management, and ability to close without over-promising.",
    sections: [
      { heading: "Phone screen", questions: [
        "Walk me through your most recent quota and how you performed against it.",
        "Describe your sales process from first call to close.",
        "What size deals and sales cycles are you used to?",
      ] },
      { heading: "Role-specific", questions: [
        "How do you run a discovery call? What are you trying to learn?",
        "How do you handle a prospect who goes dark mid-deal?",
        "Tell me how you build a business case for a skeptical economic buyer.",
        "How do you forecast a deal honestly?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about the biggest deal you lost. Why did you lose it?",
        "Describe a time you turned around an unhappy prospect.",
      ] },
      { heading: "Situational", questions: [
        "A prospect demands a discount you can't give. How do you respond?",
        "It's the last week of the quarter and you're short. What do you do?",
      ] },
    ],
  },
  {
    slug: "sales-development-rep",
    title: "Sales Development Rep (SDR)",
    category: "Sales & Marketing",
    blurb: "Outbound, resilience, and qualification questions for SDRs.",
    intro: "These questions evaluate an SDR's outbound rigor, resilience, and ability to qualify the right opportunities.",
    sections: [
      { heading: "Phone screen", questions: [
        "Walk me through a typical day of outbound for you.",
        "How many touches and channels do you use to reach a prospect?",
        "How do you research an account before reaching out?",
      ] },
      { heading: "Role-specific", questions: [
        "Give me your opener on a cold call.",
        "How do you qualify whether a lead is worth passing to an AE?",
        "How do you handle the objection 'we're not interested'?",
        "What do you do when your messaging stops getting replies?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a month you missed target. What changed afterward?",
        "How do you stay motivated through constant rejection?",
      ] },
      { heading: "Situational", questions: [
        "You booked a meeting but the prospect no-shows twice. What now?",
        "Your reply rate dropped 50% this week. How do you diagnose it?",
      ] },
    ],
  },
  {
    slug: "marketing-manager",
    title: "Marketing Manager",
    category: "Sales & Marketing",
    blurb: "Strategy, channels, and measurement questions for marketers.",
    intro: "Assess a marketing manager's strategic thinking, channel judgment, and ability to tie spend to measurable results.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe a campaign you ran end to end and its results.",
        "Which channels do you know best, and how do you measure them?",
        "How do you set marketing goals that ladder up to revenue?",
      ] },
      { heading: "Role-specific", questions: [
        "How would you launch a new product with a limited budget?",
        "How do you decide where to spend the next marketing dollar?",
        "How do you work with sales on lead quality and follow-up?",
        "What's your approach to positioning and messaging?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a campaign that flopped. What did you learn?",
        "Describe a time data changed your marketing strategy.",
      ] },
      { heading: "Situational", questions: [
        "Pipeline is down and leadership wants more leads this quarter. What do you do?",
        "A channel that worked is suddenly underperforming. How do you respond?",
      ] },
    ],
  },
  {
    slug: "customer-success-manager",
    title: "Customer Success Manager",
    category: "Customer & Operations",
    blurb: "Retention, onboarding, and account-health questions for CSMs.",
    intro: "These questions assess a CSM's ability to drive adoption, prevent churn, and grow accounts.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe the book of business you manage today.",
        "How do you measure the health of an account?",
        "What does a great onboarding look like?",
      ] },
      { heading: "Role-specific", questions: [
        "How do you spot churn risk early?",
        "Walk me through how you'd run a quarterly business review.",
        "How do you identify and drive expansion opportunities?",
        "How do you handle a customer who isn't adopting the product?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a churned account you couldn't save. What would you do differently?",
        "Describe a time you turned a detractor into an advocate.",
      ] },
      { heading: "Situational", questions: [
        "Your largest account threatens to cancel at renewal. What's your plan?",
        "A customer wants a feature you don't have. How do you handle it?",
      ] },
    ],
  },
  {
    slug: "recruiter",
    title: "Recruiter",
    category: "People & Talent",
    blurb: "Sourcing, screening, and candidate-experience questions for recruiters.",
    intro: "Use these to evaluate a recruiter on sourcing creativity, screening rigor, and the candidate experience they create.",
    sections: [
      { heading: "Phone screen", questions: [
        "Walk me through a hard role you filled recently.",
        "Where do you source candidates beyond the obvious job boards?",
        "How do you partner with hiring managers on a new req?",
      ] },
      { heading: "Role-specific", questions: [
        "How do you write an outreach message that actually gets replies?",
        "How do you screen for fit in a 20-minute call?",
        "How do you keep candidates warm through a slow process?",
        "How do you reduce bias in your screening?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a candidate you fought to hire. What happened?",
        "Describe a time a hire didn't work out. What did you learn?",
      ] },
      { heading: "Situational", questions: [
        "A hiring manager rejects every candidate you send. How do you handle it?",
        "You have 50 applicants for one role and two days to screen. What's your approach?",
      ] },
    ],
  },
  {
    slug: "hr-manager",
    title: "HR Manager",
    category: "People & Talent",
    blurb: "People-ops, policy, and conflict-resolution questions for HR managers.",
    intro: "These questions assess an HR manager's judgment on policy, employee relations, and balancing people and business needs.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe the scope of HR you've owned.",
        "How do you stay current on employment compliance?",
        "What does a healthy company culture look like to you?",
      ] },
      { heading: "Role-specific", questions: [
        "How do you handle a sensitive employee-relations issue?",
        "How would you improve employee retention?",
        "How do you approach building or revising a policy?",
        "How do you balance being an employee advocate and a company representative?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a difficult termination you managed.",
        "Describe a time you influenced leadership on a people decision.",
      ] },
      { heading: "Situational", questions: [
        "Two senior employees are in open conflict. How do you intervene?",
        "Leadership wants a policy you think is a mistake. What do you do?",
      ] },
    ],
  },
  {
    slug: "financial-analyst",
    title: "Financial Analyst",
    category: "Finance & Operations",
    blurb: "Modeling, analysis, and communication questions for finance analysts.",
    intro: "Evaluate a financial analyst's modeling skills, analytical rigor, and ability to turn numbers into decisions.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe a model or analysis you built that informed a decision.",
        "What's your experience with forecasting and budgeting?",
        "Which tools do you use, and how advanced is your Excel/SQL?",
      ] },
      { heading: "Role-specific", questions: [
        "Walk me through how you'd build a three-statement model.",
        "How do you sanity-check your own numbers?",
        "How do you decide which assumptions matter most in a forecast?",
        "How do you present a complex analysis to non-finance leaders?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a time your analysis surfaced a problem no one expected.",
        "Describe a deadline crunch and how you protected accuracy.",
      ] },
      { heading: "Situational", questions: [
        "Actuals come in far off your forecast. How do you investigate?",
        "A leader pushes for assumptions you think are too optimistic. What do you do?",
      ] },
    ],
  },
  {
    slug: "operations-manager",
    title: "Operations Manager",
    category: "Finance & Operations",
    blurb: "Process, execution, and cross-team questions for ops managers.",
    intro: "These questions assess an operations manager's ability to build process, drive execution, and improve how teams work.",
    sections: [
      { heading: "Phone screen", questions: [
        "Describe a process you built or fixed and the impact.",
        "How do you measure operational performance?",
        "How do you prioritize when everything feels urgent?",
      ] },
      { heading: "Role-specific", questions: [
        "How do you find and remove bottlenecks in a workflow?",
        "How do you roll out a new process people will actually follow?",
        "How do you balance standardization with flexibility?",
        "How do you use data to drive operational decisions?",
      ] },
      { heading: "Behavioral", questions: [
        "Tell me about a cross-team initiative you led. How did you align people?",
        "Describe a process change that failed. Why?",
      ] },
      { heading: "Situational", questions: [
        "A key process breaks during your busiest week. What do you do?",
        "Two teams blame each other for a recurring problem. How do you resolve it?",
      ] },
    ],
  },
];

export const ROLE_BY_SLUG: Record<string, RoleGuide> = Object.fromEntries(ROLES.map((r) => [r.slug, r]));

export function getRole(slug: string): RoleGuide | undefined {
  return ROLE_BY_SLUG[slug];
}

// Roles grouped by category, preserving first-seen order.
export function rolesByCategory(): { category: string; roles: RoleGuide[] }[] {
  const order: string[] = [];
  const map = new Map<string, RoleGuide[]>();
  for (const r of ROLES) {
    if (!map.has(r.category)) { map.set(r.category, []); order.push(r.category); }
    map.get(r.category)!.push(r);
  }
  return order.map((category) => ({ category, roles: map.get(category)! }));
}
