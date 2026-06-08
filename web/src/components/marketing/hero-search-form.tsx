"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Search, MapPin } from "lucide-react";

// Hero job-search bar. Auth-aware + client-side nav (no full-page flash):
// signed-in users go to Job Search with their query; signed-out users go to sign-up.
export function HeroSearchForm() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignedIn) {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (loc.trim()) params.set("loc", loc.trim());
      const qs = params.toString();
      router.push(`/dashboard/job-search${qs ? `?${qs}` : ""}`);
    } else {
      router.push("/sign-up");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="reveal reveal-4 mt-12 flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-white/10 bg-card/60 p-2 backdrop-blur sm:flex-row"
    >
      <div className="flex flex-1 items-center gap-2 rounded-xl bg-background/60 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by job title, keyword, etc."
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex flex-1 items-center gap-2 rounded-xl bg-background/60 px-3 sm:max-w-[40%]">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <input
          name="loc"
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          placeholder="Location"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <button type="submit" className="btn-cta flex h-11 items-center justify-center rounded-xl px-5 text-sm">
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}
