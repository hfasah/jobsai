"use client";

import { useState, useSyncExternalStore } from "react";
import { Loader2, LogOut } from "lucide-react";

// True when the (non-httpOnly) demo_org_id cookie is set. useSyncExternalStore
// keeps it SSR-safe (server snapshot = false) without a setState-in-effect.
const hasDemoCookie = () =>
  typeof document !== "undefined" &&
  document.cookie.split("; ").some((c) => c.startsWith("demo_org_id=") && c.slice("demo_org_id=".length).length > 0);

function useImpersonating() {
  return useSyncExternalStore(() => () => {}, hasDemoCookie, () => false);
}

// When a super-admin opens a pending workspace via admin "Open workspace", the
// demo_org_id cookie pins every enterprise page to that (locked) org. The normal
// "Exit demo view" control lives in the workspace shell — which the locked page
// does NOT render — so without this an admin gets trapped here with no way out.
// Shown only when the demo cookie is present, so real pending-org members never
// see it; the DELETE endpoint is admin-gated regardless.
export function ExitDemoButton() {
  const impersonating = useImpersonating();
  const [busy, setBusy] = useState(false);

  if (!impersonating) return null;

  const exit = async () => {
    setBusy(true);
    await fetch("/api/admin/enterprise/impersonate", { method: "DELETE" }).catch(() => {});
    window.location.href = "/admin/enterprise";
  };

  return (
    <button
      onClick={exit}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      Exit workspace view (admin)
    </button>
  );
}
