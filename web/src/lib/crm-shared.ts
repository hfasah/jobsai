// Client-safe CRM constants, labels, and row types. NO server imports here so
// this can be imported by both client components and server routes. The server
// gate (crmContext) lives in lib/enterprise-crm.ts.

// ─── Shared option sets (used by forms, filters, and badges) ─────────────────
export const COMPANY_STATUSES = ["prospect", "active_client", "past_client", "dormant"] as const;
export const CONTACT_TYPES = ["hiring_manager", "hr", "founder", "department_head", "finance", "other"] as const;
export const RELATIONSHIP_STATUSES = ["new", "warm", "active", "unresponsive", "do_not_contact"] as const;
export const ACTIVITY_TYPES = [
  "call", "email", "meeting", "linkedin", "note", "task",
  "proposal_sent", "client_intake", "candidate_submitted", "interview_scheduled", "offer_update",
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];
export type ContactType = (typeof CONTACT_TYPES)[number];
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// Human labels for enum values (snake_case → Title Case fallback handled below).
export const LABELS: Record<string, string> = {
  prospect: "Prospect",
  active_client: "Active Client",
  past_client: "Past Client",
  dormant: "Dormant",
  hiring_manager: "Hiring Manager",
  hr: "HR",
  founder: "Founder",
  department_head: "Department Head",
  finance: "Finance",
  other: "Other",
  warm: "Warm",
  active: "Active",
  unresponsive: "Unresponsive",
  do_not_contact: "Do Not Contact",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  linkedin: "LinkedIn",
  note: "Note",
  task: "Task",
  proposal_sent: "Proposal Sent",
  client_intake: "Client Intake",
  candidate_submitted: "Candidate Submitted",
  interview_scheduled: "Interview Scheduled",
  offer_update: "Offer Update",
};

export const labelFor = (v: string | null | undefined): string =>
  !v ? "" : LABELS[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Row types (mirror migration 117) ────────────────────────────────────────
export interface CrmCompany {
  id: string;
  org_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  size: string | null;
  status: string;
  source: string | null;
  tags: string[];
  notes: string | null;
  owner_id: string | null;
  last_activity_at: string | null;
  next_follow_up_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  org_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  contact_type: string;
  relationship_status: string;
  tags: string[];
  notes: string | null;
  owner_id: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmActivity {
  id: string;
  org_id: string;
  type: string;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  job_order_id: string | null;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  next_step: string | null;
  occurred_at: string;
  reminder_at: string | null;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmTask {
  id: string;
  org_id: string;
  title: string;
  status: string;
  due_at: string | null;
  reminder_at: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  job_order_id: string | null;
  notes: string | null;
  owner_id: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
