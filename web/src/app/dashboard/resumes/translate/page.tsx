"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Languages, Loader2, Printer, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { ResumePreviewClient } from "@/components/resume/resume-preview-client";
import type { ResumeData } from "@/components/resume/resume-preview-client";
import { cn } from "@/lib/utils";

// ─── Language list ────────────────────────────────────────────────────────────

const LANGUAGES = [
  "Afrikaans", "Albanian", "Arabic", "Armenian", "Azerbaijani",
  "Basque", "Bengali", "Bulgarian", "Catalan", "Chinese (Simplified)",
  "Chinese (Traditional)", "Croatian", "Czech", "Danish", "Dutch",
  "Estonian", "Finnish", "French", "Galician", "Georgian",
  "German", "Greek", "Gujarati", "Hebrew", "Hindi",
  "Hungarian", "Icelandic", "Indonesian", "Italian", "Japanese",
  "Kannada", "Kazakh", "Korean", "Latvian", "Lithuanian",
  "Macedonian", "Malay", "Malayalam", "Maltese", "Marathi",
  "Mongolian", "Nepali", "Norwegian", "Persian", "Filipino",
  "Polish", "Portuguese (Brazil)", "Portuguese (Portugal)", "Punjabi",
  "Romanian", "Russian", "Serbian", "Sinhalese", "Slovak",
  "Slovenian", "Spanish", "Swahili", "Swedish", "Tamil",
  "Telugu", "Thai", "Turkish", "Ukrainian", "Urdu",
  "Uzbek", "Vietnamese", "Welsh",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResumeOption {
  version_id: string;
  label: string;
  is_primary: boolean;
}

// ─── Language selector ────────────────────────────────────────────────────────

function LanguageSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = LANGUAGES.filter((l) =>
    l.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-sm transition-colors hover:border-primary/40",
          !value && "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          {value || "Select language…"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              placeholder="Search languages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-muted px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No languages found</li>
            ) : (
              filtered.map((lang) => (
                <li key={lang}>
                  <button
                    type="button"
                    onClick={() => { onChange(lang); setOpen(false); setSearch(""); }}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50",
                      value === lang && "bg-primary/10 font-medium text-primary"
                    )}
                  >
                    {lang}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TranslatePage() {
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<ResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load user's resumes
  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((json) => {
        const options: ResumeOption[] = [];
        for (const doc of json.data ?? []) {
          if (doc.active_version_id) {
            const label = doc.label ?? (doc.is_primary ? "Primary resume" : `Resume ${doc.id.slice(0, 6)}`);
            options.push({
              version_id: doc.active_version_id,
              label: doc.is_primary ? `${label} (primary)` : label,
              is_primary: doc.is_primary,
            });
          }
        }
        options.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        setResumes(options);
        if (options.length > 0) setSelectedVersionId(options[0].version_id);
      })
      .finally(() => setLoadingResumes(false));
  }, []);

  const translate = async () => {
    if (!selectedVersionId || !targetLanguage) return;
    setTranslating(true);
    setError(null);
    setTranslated(null);

    try {
      const res = await fetch("/api/resumes/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: selectedVersionId, target_language: targetLanguage }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Translation failed."); return; }
      setTranslated(json.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/resumes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Resumes
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight">Resume Translator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Translate your resume into {LANGUAGES.length}+ languages. Download as PDF when done.
          </p>
        </div>

        {/* Controls */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">

            {/* Resume selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resume
              </label>
              {loadingResumes ? (
                <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : resumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No resumes found. <Link href="/dashboard/resumes" className="text-primary hover:underline">Upload one first.</Link></p>
              ) : (
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {resumes.map((r) => (
                    <option key={r.version_id} value={r.version_id}>{r.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Language selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target language
              </label>
              <LanguageSelect value={targetLanguage} onChange={setTargetLanguage} />
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Technical skills and company/school names are preserved as-is.
            </p>
            <Button
              onClick={translate}
              disabled={!selectedVersionId || !targetLanguage || translating || loadingResumes}
            >
              {translating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Translating…</>
              ) : (
                <><Languages className="mr-2 h-4 w-4" />Translate</>
              )}
            </Button>
          </div>
        </div>

        {/* Translated preview */}
        {translated && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Translated to <span className="text-primary">{targetLanguage}</span>
              </p>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Download PDF
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border">
              <ResumePreviewClient jobId="" data={translated} hideToolbar />
            </div>
          </div>
        )}
      </main>

      <style>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          body { background: white !important; }
          main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          @page { margin: 14mm 12mm; size: letter; }
        }
      `}</style>
    </>
  );
}
