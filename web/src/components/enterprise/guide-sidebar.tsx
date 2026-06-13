"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUIDE } from "@/lib/enterprise-guide";

// Docs-style left navigation: search + collapsible categories with article
// links. Client component so search filters live as you type.
export function GuideSidebar({ activeSlug }: { activeSlug?: string }) {
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return GUIDE;
    return GUIDE.map((c) => ({
      ...c,
      articles: c.articles.filter(
        (a) => a.title.toLowerCase().includes(query) || a.summary.toLowerCase().includes(query),
      ),
    })).filter((c) => c.articles.length > 0);
  }, [query]);

  return (
    <nav className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the guide…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {filtered.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">No articles match &ldquo;{q}&rdquo;.</p>
      )}

      {filtered.map((category) => {
        const isCollapsed = !query && collapsed[category.id];
        return (
          <div key={category.id}>
            <button
              type="button"
              onClick={() => setCollapsed((s) => ({ ...s, [category.id]: !s[category.id] }))}
              className="flex w-full items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {category.title}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isCollapsed && "-rotate-90")} />
            </button>
            {!isCollapsed && (
              <ul className="mt-2 space-y-0.5">
                {category.articles.map((a) => {
                  const active = a.slug === activeSlug;
                  return (
                    <li key={a.slug}>
                      <Link
                        href={`/enterprise/guide/${a.slug}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <span className="shrink-0">{a.icon}</span>
                        <span className="min-w-0 truncate">{a.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
