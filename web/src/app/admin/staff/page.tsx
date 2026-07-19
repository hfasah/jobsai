import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { StaffManager } from "@/components/admin/staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const ctx = await getAdminContext();
  if (!ctx?.can("staff.manage")) redirect("/admin");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff &amp; Access</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grant portal access by role, fine-tune per person, and deactivate instantly.
          Every privileged action is recorded in the audit log.
        </p>
      </div>
      <StaffManager />
    </div>
  );
}
