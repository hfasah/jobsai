// Client-safe suggestion lists for the filter typeahead. No server imports —
// this is bundled into the browser. Curated, not exhaustive; users can still
// type anything free-form. Kept broad enough to feel like the competitor's
// "+ add from a list" affordance.

export const TITLE_SUGGESTIONS = [
  "DevOps Engineer", "Senior DevOps Engineer", "Lead DevOps Engineer", "Site Reliability Engineer",
  "Platform Engineer", "Cloud Engineer", "Cloud Architect", "Infrastructure Engineer",
  "Software Engineer", "Senior Software Engineer", "Staff Software Engineer", "Backend Engineer",
  "Frontend Engineer", "Full Stack Engineer", "Mobile Engineer", "iOS Engineer", "Android Engineer",
  "Data Engineer", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "MLOps Engineer",
  "Security Engineer", "QA Engineer", "Engineering Manager", "Director of Engineering", "VP of Engineering",
  "CTO", "Chief Technology Officer", "Product Manager", "Senior Product Manager", "Product Designer",
  "UX Designer", "Designer", "Project Manager", "Scrum Master", "Business Analyst",
  "CEO", "Chief Executive Officer", "Founder", "Co-Founder", "COO", "CFO", "CMO",
  "Managing Director", "Head of Talent", "Recruiter", "Technical Recruiter", "Talent Acquisition",
  "Sales Director", "Account Executive", "Account Manager", "Sales Development Representative",
  "Marketing Manager", "Growth Marketer", "Customer Success Manager",
  "Registered Nurse", "Nurse Practitioner", "Physician", "Pharmacist",
];

export const SKILL_SUGGESTIONS = [
  "Kubernetes", "Terraform", "AWS", "GCP", "Azure", "Docker", "Helm", "ArgoCD", "Ansible",
  "Jenkins", "CI/CD", "GitHub Actions", "Linux", "Networking", "Prometheus", "Grafana",
  "React", "Next.js", "Vue", "Angular", "Node.js", "TypeScript", "JavaScript",
  "Python", "Django", "Flask", "FastAPI", "Go", "Rust", "Java", "Spring", "Kotlin", "Swift",
  "C++", "C#", ".NET", "PHP", "Laravel", "Ruby", "Rails",
  "GraphQL", "gRPC", "REST", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Kafka", "RabbitMQ",
  "Spark", "Airflow", "Snowflake", "dbt", "Tableau", "Power BI",
  "PyTorch", "TensorFlow", "MLOps", "SageMaker", "LLM", "NLP",
  "Salesforce", "HubSpot", "Figma", "Product Management", "Agile", "Scrum",
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
