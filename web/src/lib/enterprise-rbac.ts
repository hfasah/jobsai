import type { MemberRole } from "@/types/enterprise";

export type Permission =
  | "can_view_applications"
  | "can_move_stages"
  | "can_send_emails"
  | "can_send_offers"
  | "can_manage_jobs"
  | "can_invite_members"
  | "can_manage_settings"
  | "can_view_reports"
  | "can_add_notes"
  | "can_schedule_interviews";

type PermissionSet = Record<Permission, boolean>;

// Default permission matrix — can be overridden per-org via enterprise_role_permissions
export const ROLE_PERMISSIONS: Record<MemberRole, PermissionSet> = {
  owner: {
    can_view_applications:   true,
    can_move_stages:         true,
    can_send_emails:         true,
    can_send_offers:         true,
    can_manage_jobs:         true,
    can_invite_members:      true,
    can_manage_settings:     true,
    can_view_reports:        true,
    can_add_notes:           true,
    can_schedule_interviews: true,
  },
  admin: {
    can_view_applications:   true,
    can_move_stages:         true,
    can_send_emails:         true,
    can_send_offers:         true,
    can_manage_jobs:         true,
    can_invite_members:      true,
    can_manage_settings:     true,
    can_view_reports:        true,
    can_add_notes:           true,
    can_schedule_interviews: true,
  },
  recruiter: {
    can_view_applications:   true,
    can_move_stages:         true,
    can_send_emails:         true,
    can_send_offers:         true,
    can_manage_jobs:         true,
    can_invite_members:      false,
    can_manage_settings:     false,
    can_view_reports:        true,
    can_add_notes:           true,
    can_schedule_interviews: true,
  },
  hiring_manager: {
    can_view_applications:   true,
    can_move_stages:         true,
    can_send_emails:         false,
    can_send_offers:         false,
    can_manage_jobs:         false,
    can_invite_members:      false,
    can_manage_settings:     false,
    can_view_reports:        true,
    can_add_notes:           true,
    can_schedule_interviews: true,
  },
  interviewer: {
    can_view_applications:   true,
    can_move_stages:         false,
    can_send_emails:         false,
    can_send_offers:         false,
    can_manage_jobs:         false,
    can_invite_members:      false,
    can_manage_settings:     false,
    can_view_reports:        false,
    can_add_notes:           true,
    can_schedule_interviews: false,
  },
  department_head: {
    can_view_applications:   true,
    can_move_stages:         true,
    can_send_emails:         true,
    can_send_offers:         false,
    can_manage_jobs:         true,
    can_invite_members:      false,
    can_manage_settings:     false,
    can_view_reports:        true,
    can_add_notes:           true,
    can_schedule_interviews: true,
  },
  viewer: {
    can_view_applications:   true,
    can_move_stages:         false,
    can_send_emails:         false,
    can_send_offers:         false,
    can_manage_jobs:         false,
    can_invite_members:      false,
    can_manage_settings:     false,
    can_view_reports:        true,
    can_add_notes:           false,
    can_schedule_interviews: false,
  },
};

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner:          "Owner",
  admin:          "Admin",
  recruiter:      "Recruiter",
  hiring_manager: "Hiring Manager",
  interviewer:    "Interviewer",
  department_head: "Department Head",
  viewer:         "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner:          "Full access including billing and org deletion.",
  admin:          "Full access except billing and org deletion.",
  recruiter:      "Manage jobs, applications, and candidate communications.",
  hiring_manager: "View and move applications; add notes; no settings access.",
  interviewer:    "View applications and add interview notes only.",
  department_head: "Manage jobs and pipeline for their department; view reports.",
  viewer:         "Read-only access to applications and reports.",
};

// Roles that can be assigned by admins/owners when inviting
export const ASSIGNABLE_ROLES: MemberRole[] = [
  "admin", "recruiter", "hiring_manager", "interviewer", "department_head", "viewer",
];
