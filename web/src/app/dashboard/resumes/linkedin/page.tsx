"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { ParsedPreview } from "@/components/resume/parsed-preview";
import { cn } from "@/lib/utils";
import type { ResumeVersion } from "@/types/resume";

type Mode = "url" | "paste";
type Stage = "input" | "importing" | "preview" | "error";

export default function LinkedInImportPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("url");
  const [stage, setStage] = useState<Stage>("input");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  // Set after successful import for the preview
  const [documentId, setDocumentId] = useState("");
  const [version, setVersion] = useState<ResumeVersion | null>(null);
  const [docLabel, setDocLabel] = useState("LinkedIn Profile");

  const handleImport = async () => {
    const body = mode === "url" ? { url } : { text };
    if (mode === "url" && !url.trim()) return;
    if (mode === "paste" && text.trim().length < 100) return;

    setStage("importing");
    setError("");

    try {
      const res = await fetch("/api/resumes/linkedin-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Import failed.");
        setStage("error");
        return;
      }

      // Fetch the full version data (includes parsed profile for preview)
      const versionRes = await fetch(`/api/resumes/versions/${json.resume_version_id}`);
      const versionJson = await versionRes.json();

      setDocumentId(json.resume_document_id);
      setVersion(versionJson.data);

      const name = versionJson.data?.parsed_profile?.full_name;
      setDocLabel(name ? `${name} — LinkedIn` : "LinkedIn Profile");

      setStage("preview");
    } catch {
      setError("Unexpected error. Please try again.");
      setStage("error");
    }
  };

  const handleSave = async (label: string) => {
    await fetch(`/api/resumes/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    router.push("/dashboard/resumes");
  };

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/resumes"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to resumes
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <LinkedInIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import from LinkedIn</h1>
            <p className="text-sm text-muted-foreground">
              Import your LinkedIn profile as a resume — parsed automatically by AI.
            </p>
          </div>
        </div>

        <div className="mt-8">
          {/* ── Input stage ── */}
          {(stage === "input" || stage === "error") && (
            <div className="space-y-6">
              {/* Mode tabs */}
              <div className="flex rounded-lg border border-border bg-muted/40 p-1 text-sm">
                {(["url", "paste"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(""); }}
                    className={cn(
                      "flex-1 rounded-md py-1.5 font-medium transition-colors",
                      mode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "url" ? "LinkedIn URL" : "Paste profile text"}
                  </button>
                ))}
              </div>

              {/* URL mode */}
              {mode === "url" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium">LinkedIn profile URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/your-username"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    onKeyDown={(e) => e.key === "Enter" && handleImport()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your profile must be set to public for this to work. If it fails, switch to the &ldquo;Paste profile text&rdquo; tab.
                  </p>
                  <Button
                    onClick={handleImport}
                    disabled={!url.trim()}
                    className="w-full"
                  >
                    Import profile
                  </Button>
                </div>
              )}

              {/* Paste mode */}
              {mode === "paste" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="mb-2 text-sm font-medium">How to copy your LinkedIn profile:</p>
                    <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                      <li>Open your LinkedIn profile in a browser</li>
                      <li>Press <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-xs font-mono">Ctrl+A</kbd> (or <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-xs font-mono">⌘A</kbd> on Mac) to select all</li>
                      <li>Copy with <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-xs font-mono">Ctrl+C</kbd></li>
                      <li>Paste in the box below</li>
                    </ol>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your LinkedIn profile text here…"
                    rows={10}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <Button
                    onClick={handleImport}
                    disabled={text.trim().length < 100}
                    className="w-full"
                  >
                    <FileText className="mr-1.5 h-4 w-4" />
                    Parse profile
                  </Button>
                </div>
              )}

              {/* Error message */}
              {stage === "error" && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Import failed</p>
                    <p className="mt-0.5 text-muted-foreground">{error}</p>
                    {mode === "url" && (
                      <button
                        onClick={() => { setMode("paste"); setStage("input"); }}
                        className="mt-2 text-primary underline-offset-2 hover:underline"
                      >
                        Try the paste option instead →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Importing stage ── */}
          {stage === "importing" && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-medium">Parsing your LinkedIn profile…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI is extracting your experience, education, and skills.
                </p>
              </div>
            </div>
          )}

          {/* ── Preview stage ── */}
          {stage === "preview" && version && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-desyn-success">
                <CheckCircle2 className="h-4 w-4" />
                Profile imported successfully — review and save below.
              </div>
              <ParsedPreview
                version={version}
                documentLabel={docLabel}
                onSave={handleSave}
                onDiscard={() => router.push("/dashboard/resumes")}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
