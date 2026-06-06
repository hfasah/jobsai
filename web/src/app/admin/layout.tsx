"use server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, CreditCard, Building2,
  MessageSquareWarning, ShieldCheck, LogOut,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

async function checkAdmin() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminIds.includes(userId)) redirect("/dashboard");
}

const NAV = [
  { href: "/admin",             label: "Overview",     icon: LayoutDashboard },
  { href: "/admin/users",       label: "All Users",    icon: Users },
  { href: "/admin/subscribers", label: "Subscribers",  icon: CreditCard },
  { href: "/admin/enterprise",  label: "Enterprise",   icon: Building2 },
  { href: "/admin/churn",       label: "Churn",        icon: MessageSquareWarning },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await checkAdmin();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm">JobsAI Admin</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            ← Back to dashboard
          </Link>
          <SignOutButton redirectUrl="/sign-in">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <p className="text-xs text-muted-foreground">Super Admin Portal</p>
          <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">ADMIN</span>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
