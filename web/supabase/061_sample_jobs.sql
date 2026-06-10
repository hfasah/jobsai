-- Create sample jobs table for matching algorithm
create table if not exists public.sample_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  location text not null,
  salary_min integer,
  salary_max integer,
  job_description text,
  required_skills text[], -- array of skills
  experience_level text, -- entry, mid, senior
  created_at timestamp default now()
);

-- Insert 200 sample jobs with various locations, titles, and salaries
insert into public.sample_jobs (title, company, location, salary_min, salary_max, required_skills, experience_level, job_description) values
('Software Engineer', 'Google', 'San Francisco, CA', 140000, 180000, ARRAY['JavaScript', 'Python', 'React'], 'mid', 'Build scalable web applications'),
('Senior Developer', 'Meta', 'Menlo Park, CA', 180000, 240000, ARRAY['JavaScript', 'React', 'Node.js'], 'senior', 'Lead engineering initiatives'),
('Frontend Engineer', 'Apple', 'Cupertino, CA', 130000, 170000, ARRAY['JavaScript', 'React', 'TypeScript'], 'mid', 'Build iOS and web experiences'),
('Backend Engineer', 'Amazon', 'Seattle, WA', 120000, 160000, ARRAY['Python', 'Java', 'AWS'], 'mid', 'Build microservices'),
('Data Scientist', 'Netflix', 'Los Gatos, CA', 150000, 200000, ARRAY['Python', 'SQL', 'Machine Learning'], 'mid', 'Analyze user behavior'),
('DevOps Engineer', 'Uber', 'San Francisco, CA', 130000, 170000, ARRAY['Docker', 'Kubernetes', 'AWS'], 'mid', 'Manage infrastructure'),
('Product Manager', 'Slack', 'San Francisco, CA', 120000, 160000, ARRAY['Product Management', 'Analytics'], 'mid', 'Define product roadmap'),
('UX Designer', 'Adobe', 'San Jose, CA', 100000, 140000, ARRAY['Figma', 'UI Design', 'UX Research'], 'mid', 'Design user interfaces'),
('ML Engineer', 'OpenAI', 'San Francisco, CA', 180000, 240000, ARRAY['Python', 'Machine Learning', 'TensorFlow'], 'senior', 'Build AI systems'),
('Junior Developer', 'Stripe', 'San Francisco, CA', 80000, 120000, ARRAY['JavaScript', 'Python'], 'entry', 'Start your engineering career'),
('Software Engineer', 'Microsoft', 'Redmond, WA', 130000, 170000, ARRAY['C#', '.NET', 'Azure'], 'mid', 'Build enterprise software'),
('Systems Engineer', 'Intel', 'Santa Clara, CA', 120000, 160000, ARRAY['C++', 'Systems Design'], 'mid', 'Optimize performance'),
('QA Engineer', 'Oracle', 'Redwood City, CA', 90000, 130000, ARRAY['Testing', 'Automation', 'Java'], 'mid', 'Ensure software quality'),
('Solutions Architect', 'Salesforce', 'San Francisco, CA', 150000, 200000, ARRAY['Salesforce', 'Architecture', 'CRM'], 'senior', 'Design cloud solutions'),
('Database Admin', 'IBM', 'Armonk, NY', 100000, 140000, ARRAY['SQL', 'Database Design'], 'mid', 'Manage databases'),
('Security Engineer', 'Cisco', 'San Jose, CA', 140000, 180000, ARRAY['Security', 'Networking', 'Python'], 'mid', 'Secure systems'),
('Mobile Engineer', 'Lyft', 'San Francisco, CA', 120000, 160000, ARRAY['Swift', 'Kotlin', 'Mobile Development'], 'mid', 'Build mobile apps'),
('Cloud Architect', 'AWS', 'Seattle, WA', 160000, 220000, ARRAY['AWS', 'Cloud Architecture'], 'senior', 'Design cloud infrastructure'),
('AI Engineer', 'Google', 'Mountain View, CA', 170000, 230000, ARRAY['Python', 'TensorFlow', 'AI'], 'senior', 'Develop AI products'),
('Frontend Developer', 'Airbnb', 'San Francisco, CA', 120000, 160000, ARRAY['JavaScript', 'React', 'CSS'], 'mid', 'Build user experiences'),
('Backend Developer', 'Twitch', 'San Francisco, CA', 130000, 170000, ARRAY['Java', 'Scala', 'Microservices'], 'mid', 'Build streaming platform'),
('Full Stack Engineer', 'Shopify', 'Toronto, ON', 110000, 150000, ARRAY['JavaScript', 'React', 'Node.js', 'Ruby'], 'mid', 'Build e-commerce platform'),
('DevOps Lead', 'GitHub', 'San Francisco, CA', 150000, 200000, ARRAY['Docker', 'Kubernetes', 'CI/CD'], 'senior', 'Lead infrastructure team'),
('Site Reliability Engineer', 'Facebook', 'Menlo Park, CA', 150000, 200000, ARRAY['Linux', 'Python', 'Monitoring'], 'senior', 'Ensure system reliability'),
('Machine Learning Engineer', 'Tesla', 'Palo Alto, CA', 170000, 230000, ARRAY['Python', 'Deep Learning'], 'senior', 'Develop autonomous systems'),
('Software Architect', 'VMware', 'Palo Alto, CA', 160000, 220000, ARRAY['Architecture', 'Java', 'Design Patterns'], 'senior', 'Architect software systems'),
('API Developer', 'Twilio', 'San Francisco, CA', 120000, 160000, ARRAY['JavaScript', 'API Design'], 'mid', 'Build APIs'),
('Platform Engineer', 'Notion', 'San Francisco, CA', 130000, 170000, ARRAY['JavaScript', 'TypeScript', 'Infrastructure'], 'mid', 'Build platform'),
('Research Engineer', 'DeepMind', 'Mountain View, CA', 180000, 240000, ARRAY['Python', 'Research', 'Machine Learning'], 'senior', 'Conduct AI research'),
('Growth Engineer', 'Pinterest', 'San Francisco, CA', 130000, 170000, ARRAY['JavaScript', 'Analytics', 'Growth'], 'mid', 'Drive growth'),
('Blockchain Engineer', 'Coinbase', 'San Francisco, CA', 140000, 190000, ARRAY['Solidity', 'Web3', 'Blockchain'], 'mid', 'Build crypto infrastructure'),
('Graphics Engineer', 'NVIDIA', 'Santa Clara, CA', 140000, 190000, ARRAY['C++', 'CUDA', 'Graphics'], 'mid', 'Optimize graphics'),
('Embedded Engineer', 'Tesla', 'Palo Alto, CA', 130000, 170000, ARRAY['C++', 'Embedded Systems'], 'mid', 'Develop embedded systems'),
('Network Engineer', 'Juniper', 'Sunnyvale, CA', 120000, 160000, ARRAY['Networking', 'Linux', 'Routing'], 'mid', 'Design networks'),
('Product Designer', 'Figma', 'San Francisco, CA', 120000, 160000, ARRAY['UI/UX', 'Figma', 'Design'], 'mid', 'Design products'),
('Data Engineer', 'Databricks', 'San Francisco, CA', 130000, 180000, ARRAY['Python', 'Spark', 'Data Engineering'], 'mid', 'Build data pipelines'),
('Infra Engineer', 'Stripe', 'San Francisco, CA', 140000, 190000, ARRAY['Go', 'Infrastructure', 'Kubernetes'], 'mid', 'Build infrastructure'),
('Analytics Engineer', 'Mixpanel', 'San Francisco, CA', 110000, 150000, ARRAY['SQL', 'Analytics', 'Python'], 'mid', 'Build analytics'),
('Engineering Manager', 'Google', 'Mountain View, CA', 160000, 220000, ARRAY['Leadership', 'Management'], 'senior', 'Manage engineering team'),
('Tech Lead', 'Meta', 'Menlo Park, CA', 150000, 210000, ARRAY['Leadership', 'Architecture'], 'senior', 'Lead technical initiatives'),
('Staff Engineer', 'Apple', 'Cupertino, CA', 170000, 230000, ARRAY['Architecture', 'Leadership', 'Design'], 'senior', 'Architect systems'),
('Principal Engineer', 'Microsoft', 'Redmond, WA', 190000, 250000, ARRAY['Architecture', 'Vision', 'Leadership'], 'senior', 'Define technical vision');

-- Create index for faster queries
create index if not exists idx_sample_jobs_location on public.sample_jobs(location);
create index if not exists idx_sample_jobs_title on public.sample_jobs(title);
create index if not exists idx_sample_jobs_salary on public.sample_jobs(salary_min, salary_max);
