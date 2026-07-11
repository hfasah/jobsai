"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

// Sign out via the Clerk hook directly (more reliable than wrapping a <button>
// in <SignOutButton>). `/sign-in` has no server-side auth forward and <SignIn>
// reads the just-cleared client session, so this lands on the login form
// without bouncing back into the portal. Mirrors the enterprise-shell fix (#275).
export function AdminSignOut() {
  const { signOut } = useClerk();
  return (
    <button
      onClick={() => signOut({ redirectUrl: "/sign-in" })}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </button>
  );
}
