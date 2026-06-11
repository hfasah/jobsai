"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { useUser } from "@clerk/nextjs";

// Visitor + engagement analytics. Captures pageviews, clicks (autocapture),
// session duration (pageleave), and approximate location (PostHog derives
// country/region/city from IP server-side — we never store the IP). Anonymous
// visitors are tracked too; person profiles are only created for signed-in
// users (person_profiles: "identified_only") to keep costs and PII minimal.
//
// No-op until NEXT_PUBLIC_POSTHOG_KEY is set, so nothing runs before it's
// configured in the environment.

let initialized = false;

export function PostHogTracker() {
  const { isLoaded, isSignedIn, user } = useUser();

  // Initialize once on the client.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || initialized) return;
    initialized = true;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      defaults: "2025-05-24", // modern defaults: history-based $pageview + $pageleave (duration)
      person_profiles: "identified_only",
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug(false);
      },
    });
  }, []);

  // Link events to the signed-in user (so admins can tell logged-in vs anonymous
  // traffic apart); reset on sign-out so the next visitor is anonymous again.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !isLoaded) return;
    if (isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress ?? undefined,
        name: user.fullName ?? undefined,
      });
    } else {
      posthog.reset();
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
