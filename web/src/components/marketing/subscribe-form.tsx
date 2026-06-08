"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// Footer "Subscribe" form. Auth-aware: a signed-in user goes to their dashboard;
// a signed-out user goes to sign-up (email prefilled). Client-side nav avoids the
// full-page GET-submit flash the plain <form action> caused.
export function SubscribeForm() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [email, setEmail] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignedIn) {
      router.push("/dashboard");
    } else {
      router.push(`/sign-up${email ? `?email=${encodeURIComponent(email)}` : ""}`);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <input
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@email.com"
        className="h-11 flex-1 rounded-xl border border-border bg-background/60 px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
      />
      <button type="submit" className="btn-cta inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm">
        Subscribe
      </button>
    </form>
  );
}
