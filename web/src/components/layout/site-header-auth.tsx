"use client";

import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SiteHeaderAuth() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/dashboard/preferences"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Preferences"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Preferences</span>
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <SignInButton mode="redirect">
        <Button variant="ghost" size="sm">
          Sign in
        </Button>
      </SignInButton>
      <SignUpButton mode="redirect">
        <Button size="sm">Get started</Button>
      </SignUpButton>
    </div>
  );
}
