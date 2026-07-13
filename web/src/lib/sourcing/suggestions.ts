// Client-safe suggestion lists for the filter typeahead. No server imports —
// this is bundled into the browser. Curated, not exhaustive; users can still
// type anything free-form. Kept broad enough to feel like the competitor's
// "+ add from a list" affordance.

// Cross-industry title list — recruiters source for every field, not just tech.
// Ordered to LEAD with common, industry-neutral roles so an empty-focus "browse"
// never reads as tech-only. Users can still type anything free-form.
export const TITLE_SUGGESTIONS = [
  // General / cross-industry
  "Manager", "Director", "Vice President", "Operations Manager", "General Manager",
  "Administrative Assistant", "Executive Assistant", "Office Manager", "Project Manager", "Program Manager",
  "Business Analyst", "Consultant", "Coordinator", "Team Lead", "Specialist",
  // Legal
  "Paralegal", "Legal Assistant", "Litigation Paralegal", "Corporate Paralegal", "Legal Secretary",
  "Attorney", "Lawyer", "Associate Attorney", "Counsel", "General Counsel", "Compliance Officer", "Contract Manager",
  // Healthcare
  "Registered Nurse", "Nurse Practitioner", "Licensed Practical Nurse", "Physician", "Physician Assistant",
  "Medical Assistant", "Pharmacist", "Pharmacy Technician", "Physical Therapist", "Dental Hygienist",
  "Healthcare Administrator", "Clinical Research Coordinator", "Caregiver", "Home Health Aide",
  // Finance & accounting
  "Accountant", "Senior Accountant", "Staff Accountant", "Bookkeeper", "Financial Analyst",
  "Controller", "CFO", "Auditor", "Tax Manager", "Payroll Specialist", "Financial Advisor", "Loan Officer",
  // Sales & marketing
  "Account Executive", "Account Manager", "Sales Representative", "Sales Manager", "Sales Director",
  "Business Development Manager", "Sales Development Representative", "Customer Success Manager",
  "Marketing Manager", "Marketing Coordinator", "Digital Marketing Specialist", "Content Marketer", "Brand Manager",
  // HR & recruiting
  "HR Manager", "HR Generalist", "HR Business Partner", "Recruiter", "Technical Recruiter",
  "Talent Acquisition Specialist", "Head of Talent", "Benefits Administrator",
  // Operations, supply chain, skilled trades
  "Supply Chain Manager", "Logistics Coordinator", "Warehouse Manager", "Procurement Manager",
  "Electrician", "Plumber", "HVAC Technician", "Welder", "Machinist", "Maintenance Technician",
  "Construction Manager", "Project Superintendent", "Estimator", "Quality Manager",
  // Education
  "Teacher", "Professor", "Instructional Designer", "School Administrator", "Academic Advisor",
  // Design & product
  "Product Manager", "Product Designer", "UX Designer", "Graphic Designer", "Designer",
  // Technology
  "Software Engineer", "Senior Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
  "Data Engineer", "Data Scientist", "Data Analyst", "Machine Learning Engineer", "DevOps Engineer",
  "Cloud Engineer", "Security Engineer", "QA Engineer", "IT Manager", "Systems Administrator",
  "Engineering Manager", "CTO", "IT Support Specialist",
  // Executive
  "CEO", "COO", "CFO", "CMO", "President", "Founder", "Co-Founder", "Managing Director",
];

// Cross-industry skills/competencies — not just engineering stacks.
export const SKILL_SUGGESTIONS = [
  // General / business
  "Project Management", "Account Management", "Customer Service", "Data Analysis", "Microsoft Excel",
  "Microsoft Office", "Team Leadership", "Negotiation", "Public Speaking", "Budgeting", "Forecasting",
  "Process Improvement", "Vendor Management", "Strategic Planning", "Operations Management",
  // Legal
  "Legal Research", "Litigation", "Contract Drafting", "Contract Review", "E-Discovery", "Compliance",
  "Corporate Law", "Immigration Law", "Family Law", "Intellectual Property", "Westlaw", "LexisNexis",
  // Healthcare
  "Patient Care", "Triage", "Phlebotomy", "EMR", "Epic", "Cerner", "ACLS", "BLS", "Medication Administration",
  "Care Coordination", "HIPAA", "Clinical Documentation",
  // Finance & accounting
  "Accounting", "Bookkeeping", "QuickBooks", "Financial Reporting", "Financial Modeling", "GAAP",
  "Accounts Payable", "Accounts Receivable", "Payroll", "Tax Preparation", "Auditing", "SAP", "NetSuite",
  // Sales & marketing
  "Salesforce", "HubSpot", "CRM", "Lead Generation", "Cold Calling", "Pipeline Management", "SEO", "SEM",
  "Google Analytics", "Content Marketing", "Email Marketing", "Social Media Marketing", "Copywriting",
  // HR
  "Recruiting", "Talent Acquisition", "Onboarding", "Employee Relations", "Benefits Administration", "Workday", "ATS",
  // Trades & operations
  "Welding", "HVAC", "Electrical", "Plumbing", "Blueprint Reading", "OSHA", "Forklift", "CNC", "Inventory Management",
  "Supply Chain Management", "Logistics", "Lean Manufacturing", "Six Sigma",
  // Design
  "Figma", "Adobe Photoshop", "Adobe Illustrator", "UX Design", "UI Design", "Wireframing",
  // Technology
  "Python", "JavaScript", "TypeScript", "React", "Node.js", "Java", "SQL", "AWS", "Azure", "Docker",
  "Kubernetes", "Machine Learning", "Data Engineering", "DevOps", "Cybersecurity",
];

export const INDUSTRY_SUGGESTIONS = [
  "Software", "Computer Software", "Information Technology and Services", "Internet",
  "Financial Services", "Banking", "Insurance", "Fintech",
  "Healthcare", "Hospital & Health Care", "Pharmaceuticals", "Biotechnology", "Medical Devices",
  "Staffing and Recruiting", "Human Resources", "Management Consulting",
  "Marketing and Advertising", "Media Production", "E-Learning", "Education Management",
  "Telecommunications", "Retail", "E-commerce", "Consumer Goods", "Manufacturing",
  "Automotive", "Energy", "Renewables & Environment", "Real Estate", "Construction",
  "Logistics and Supply Chain", "Transportation", "Hospitality", "Non-profit",
];

export const COUNTRY_SUGGESTIONS = [
  "United States", "United Kingdom", "Canada", "Germany", "France", "Spain", "Italy",
  "Netherlands", "Ireland", "Portugal", "Poland", "Sweden", "Norway", "Denmark",
  "Switzerland", "Belgium", "Austria", "Cameroon", "Nigeria", "Kenya", "Ghana",
  "South Africa", "Egypt", "Morocco", "India", "Pakistan", "Singapore", "Philippines",
  "Indonesia", "Australia", "New Zealand", "Japan", "China", "Brazil", "Mexico",
  "Argentina", "Colombia", "Chile", "United Arab Emirates", "Saudi Arabia", "Israel", "Turkey",
];

// Case-insensitive prefix/substring match, excluding already-picked values.
export function suggestFor(list: string[], query: string, exclude: string[], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const taken = new Set(exclude.map((e) => e.toLowerCase()));
  const starts: string[] = [];
  const contains: string[] = [];
  for (const item of list) {
    const low = item.toLowerCase();
    if (taken.has(low)) continue;
    if (low.startsWith(q)) starts.push(item);
    else if (low.includes(q)) contains.push(item);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
