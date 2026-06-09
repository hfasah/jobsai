"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, Languages, Sparkles, Wand2, Gauge, ArrowRight, CheckCircle2, X, Wifi } from "lucide-react";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/resume/upload-zone";
import { ParsedPreview } from "@/components/resume/parsed-preview";
import { ResumeCard } from "@/components/resume/resume-card";
import { VersionsPanel } from "@/components/resume/versions-panel";
import { UpgradePlansModal } from "@/components/upgrade-plans-modal";
import type { ResumeDocument, ResumeVersion } from "@/types/resume";

type UploadState =
  | { type: "idle" }
  | { type: "uploading"; progress: number; abort?: AbortController }
  | { type: "analysing"; versionId: string; documentId: string; dismissed: boolean }
  | { type: "preview"; version: ResumeVersion; documentId: string; documentLabel: string }
  | { type: "error"; message: string };

export default function ResumesPage() {
  const [docs, setDocs] = useState<ResumeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState<UploadState>({ type: "idle" });
  const [uploadingForGroupId, setUploadingForGroupId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState<string | null>(null);
  const [versionsPanelDoc, setVersionsPanelDoc] = useState<ResumeDocument | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/resumes");
      const json = await res.json();
      if (json.data) setDocs(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Poll for parse completion when analysing
  useEffect(() => {
    if (uploadState.type !== "analysing") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const { versionId, documentId } = uploadState;

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/resumes/versions/${versionId}`);
      if (!res.ok) return;
      const json = await res.json();
      const version: ResumeVersion = json.data;

      if (version.parse_status === "parsed" || version.parse_status === "partial") {
        clearInterval(pollRef.current!);
        const docRes = await fetch(`/api/resumes/${documentId}`);
        const docJson = await docRes.json();
        setUploadState({
          type: "preview",
          version,
          documentId,
          documentLabel: docJson.data?.label ?? "My Resume",
        });
        fetchDocs();
      } else if (version.parse_status === "failed") {
        clearInterval(pollRef.current!);
        setUploadState({
          type: "error",
          message: version.parse_error_msg ?? "Parsing failed. Try a different file or format.",
        });
        fetchDocs();
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [uploadState, fetchDocs]);

  const handleFileSelected = async (file: File) => {
    const abort = new AbortController();
    setUploadState({ type: "uploading", progress: 0, abort });

    const formData = new FormData();
    formData.append("file", file);
    if (uploadingForGroupId) formData.append("resume_group_id", uploadingForGroupId);

    try {
      // Simulate progress since fetch doesn't give upload progress natively
      let prog = 0;
      const ticker = setInterval(() => {
        prog = Math.min(prog + 10, 85);
        setUploadState({ type: "uploading", progress: prog, abort });
      }, 200);

      const res = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
        signal: abort.signal,
      });

      clearInterval(ticker);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 402 || json.upgrade_required) {
          setUploadState({ type: "idle" });
          setShowUpgrade(json.error ?? "The Free plan includes 1 résumé. Upgrade for unlimited résumés and the full toolkit.");
          return;
        }
        setUploadState({ type: "error", message: json.error ?? "Upload failed." });
        return;
      }

      setUploadState({ type: "uploading", progress: 100, abort });

      const { resume_version_id, resume_document_id } = await res.json();
      setUploadingForGroupId(null);
      setShowUpload(false);

      // Fire parse as a separate background request — server runs it to completion
      // even if the user navigates away (keepalive keeps it alive past page unload).
      fetch(`/api/resumes/versions/${resume_version_id}/parse`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});

      // Immediately show the resume list; banner shows analysing progress
      await fetchDocs();
      setUploadState({
        type: "analysing",
        versionId: resume_version_id,
        documentId: resume_document_id,
        dismissed: false,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setUploadState({ type: "idle" });
        return;
      }
      setUploadState({ type: "error", message: "Upload failed. Please try again." });
    }
  };

  const handleSavePreview = async (label: string) => {
    if (uploadState.type !== "preview") return;
    await fetch(`/api/resumes/${uploadState.documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setUploadState({ type: "idle" });
    fetchDocs();
  };

  const handleSetPrimary = async (id: string) => {
    await fetch(`/api/resumes/${id}/set-primary`, { method: "POST" });
    fetchDocs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resume? This cannot be undone.")) return;
    await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    fetchDocs();
  };

  const handleDownload = async (versionId: string) => {
    const res = await fetch(`/api/resumes/versions/${versionId}/download-url`, {
      method: "POST",
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  };

  const handleRename = async (id: string, label: string) => {
    await fetch(`/api/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    fetchDocs();
  };

  return (
    <>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
              Resume manager
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Resumes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload PDF, DOC, or DOCX — AI extracts your profile automatically.
            </p>
          </div>
          {!showUpload && uploadState.type === "idle" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                render={<Link href="/dashboard/resumes/translate" />}
              >
                <Languages className="mr-1.5 h-4 w-4" />
                Translate
              </Button>
              <Button
                variant="outline"
                render={<Link href="/dashboard/resumes/linkedin" />}
              >
                <LinkedInIcon className="mr-1.5 h-4 w-4" />
                Import from LinkedIn
              </Button>
              <Button onClick={() => setShowUpload(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Upload resume
              </Button>
            </div>
          )}
        </div>

        {/* Resume tools */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { href: "/dashboard/resumes/builder", icon: Sparkles, title: "Resume Builder", body: "Optimize your resume around target skills." },
            { href: "/dashboard/resumes/optimizer", icon: Wand2, title: "Resume Optimizer", body: "Tailor your resume to a specific job." },
            { href: "/dashboard/resumes/score", icon: Gauge, title: "Resume Score", body: "ATS score, missing keywords, and fixes." },
          ].map(({ href, icon: Icon, title, body }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-gradient-brand group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-foreground">
                {title}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">{body}</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 space-y-6">
          {/* Upload zone */}
          {(showUpload || uploadingForGroupId) && uploadState.type === "idle" && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">
                  {uploadingForGroupId ? "Upload new version" : "Upload resume"}
                </h2>
                <button
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => { setShowUpload(false); setUploadingForGroupId(null); }}
                >
                  Cancel
                </button>
              </div>
              <UploadZone onFileSelected={handleFileSelected} />
            </div>
          )}

          {/* Upload progress — inline bar, not a blocking overlay */}
          {uploadState.type === "uploading" && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Uploading resume…</span>
                <span className="tabular-nums text-muted-foreground">{uploadState.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%`, background: "linear-gradient(90deg, oklch(0.53 0.25 296), oklch(0.68 0.2 296))" }}
                />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wifi className="h-3.5 w-3.5 shrink-0" />
                Upload speed depends on your internet connection — large files may take a moment.
              </p>
              <button
                onClick={() => { uploadState.abort?.abort(); setUploadState({ type: "idle" }); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Analysing banner — dismissable, user can keep using the app */}
          {uploadState.type === "analysing" && !uploadState.dismissed && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Analysing your resume in the background</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  We&apos;re extracting your profile with AI — this takes 15–30 seconds. You can freely navigate the app and we&apos;ll update your resume when it&apos;s ready.
                </p>
              </div>
              <button
                onClick={() => setUploadState({ ...uploadState, dismissed: true })}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Done banner after analysis */}
          {uploadState.type === "preview" && (
            <div className="flex items-center gap-2 rounded-xl border border-desyn-success/30 bg-desyn-success/5 p-3 text-sm text-desyn-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Resume analysed successfully — review your profile below.
            </div>
          )}

          {/* Error */}
          {uploadState.type === "error" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">Upload failed</p>
              <p className="mt-1">{uploadState.message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setUploadState({ type: "idle" })}
              >
                Try again
              </Button>
            </div>
          )}

          {/* Parsed preview */}
          {uploadState.type === "preview" && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 font-medium">Review parsed resume</h2>
              <ParsedPreview
                version={uploadState.version}
                documentLabel={uploadState.documentLabel}
                onSave={handleSavePreview}
                onDiscard={() => setUploadState({ type: "idle" })}
              />
            </div>
          )}

          {/* Resume list */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading resumes…
            </div>
          ) : docs.length === 0 && uploadState.type === "idle" && !showUpload ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">No resumes yet.</p>
              <Button className="mt-4" onClick={() => setShowUpload(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Upload your first resume
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {docs.map((doc) => (
                <ResumeCard
                  key={doc.id}
                  doc={doc}
                  onSetPrimary={handleSetPrimary}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  onUploadNewVersion={(id) => {
                    setUploadingForGroupId(id);
                    setShowUpload(false);
                  }}
                  onRename={handleRename}
                  onViewVersions={(id) => {
                    const d = docs.find((x) => x.id === id) ?? null;
                    setVersionsPanelDoc(d);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {versionsPanelDoc && (
        <VersionsPanel
          groupId={versionsPanelDoc.id}
          documentLabel={versionsPanelDoc.label}
          activeVersionId={versionsPanelDoc.active_version_id}
          onClose={() => setVersionsPanelDoc(null)}
          onChanged={fetchDocs}
        />
      )}

      {showUpgrade && (
        <UpgradePlansModal reason={showUpgrade} onClose={() => setShowUpgrade(null)} />
      )}
    </>
  );
}
