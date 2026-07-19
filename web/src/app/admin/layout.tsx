"use server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, CreditCard, Building2,
  MessageSquareWarning, ShieldCheck, Inbox, BarChart3, Globe, Handshake, Target, Newspaper, Rocket, Coins, UserCog,
} from "lucide-react";
import { AdminSignOut } from "@/components/admin-sign-out";
import { getAdminContext, type AdminPerm } from "@/lib/admin";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin Portal",
  support_agent: "Support Portal",
  support_lead: "Support Portal (Lead)",
  analyst: "Analytics Portal",
  sales: "Sales Portal",
};

// Nav gated per area — hiding is cosmetic; every API route enforces the same
// permission server-side.
const NAV: { href: string; label: string; icon: typeof Users; perm: AdminPerm }[] = [
  { href: "/admin",             label: "Overview",        icon: LayoutDashboard, perm: "overview" },
  { href: "/admin/users",       label: "All Users",       icon: Users,           perm: "users.view" },
  { href: "/admin/subscribers", label: "Subscribers",     icon: CreditCard,      perm: "analytics" },
  { href: "/admin/usage",       label: "Token Usage",     icon: BarChart3,       perm: "analytics" },
  { href: "/admin/apply-health", label: "Auto-Apply",     icon: Rocket,          perm: "analytics" },
  { href: "/admin/reclaim",     label: "Revenue Reclaim", icon: Coins,           perm: "ops" },
  { href: "/admin/traffic",     label: "Traffic",         icon: Globe,           perm: "analytics" },
  { href: "/admin/enterprise",  label: "Enterprise",      icon: Building2,       perm: "enterprise" },
  { href: "/admin/blog",        label: "Blog",            icon: Newspaper,       perm: "blog" },
  { href: "/admin/sales",       label: "Sales",           icon: Target,          perm: "sales" },
  { href: "/admin/partners",    label: "Partners",        icon: Handshake,       perm: "partners" },
  { href: "/admin/churn",       label: "Churn",           icon: MessageSquareWarning, perm: "analytics" },
  { href: "/admin/support",     label: "Support Inbox",   icon: Inbox,           perm: "support" },
  { href: "/admin/staff",       label: "Staff & Access",  icon: UserCog,         perm: "staff.manage" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const nav = NAV.filter((item) => ctx.can(item.perm));

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm">JobsAI Admin</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3 space-y-1">
          <AdminSignOut />
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <p className="text-xs text-muted-foreground">{ROLE_LABEL[ctx.role] ?? "Admin Portal"}</p>
          <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
            {ctx.role === "super_admin" ? "ADMIN" : ctx.role.replace("_", " ").toUpperCase()}
          </span>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
