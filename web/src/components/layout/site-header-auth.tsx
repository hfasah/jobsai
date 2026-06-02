"use client";

import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

export function SiteHeaderAuth() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <div className="ml-auto flex items-center">
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
