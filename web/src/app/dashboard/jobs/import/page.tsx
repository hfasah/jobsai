"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Upload, Loader2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";

type Tab = "paste" | "upload";
const MIN_CHARS = 300;
const MAX_MB = 5;
const ALLOWED_EXTS = [".pdf", ".docx", ".doc", ".txt", ".html"];

export default function ImportJobPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting &&
    ((tab === "paste" && text.trim().length >= MIN_CHARS) ||
      (tab === "upload" && file !== null));

  const handleFile = (f: File) => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError("Unsupported file type. Use PDF, DOCX, TXT, or HTML.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let res: Response;
      if (tab === "upload" && file) {
        const fd = new FormData();
        fd.append("file", file);
        if (sourceUrl) fd.append("source_url", sourceUrl);
        res = await fetch("/api/jobs/import", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/jobs/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, source_url: sourceUrl || undefined }),
        });
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Import failed.");
        setSubmitting(false);
        return;
      }

      const { job_id } = await res.json();
      router.push(`/dashboard/jobs/${job_id}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
          New job
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Import a Job</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a job description or upload a file. We&apos;ll parse it and score
          your match instantly.
        </p>

        {/* Tabs */}
        <div className="mt-6 inline-flex rounded-lg border border-border p-1">
          <button
            onClick={() => setTab("paste")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste
          </button>
          <button
            onClick={() => setTab("upload")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Upload className="h-4 w-4" />
            Upload file
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {tab === "paste" ? (
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the full job description here…"
                rows={14}
                maxLength={50000}
                className="w-full resize-y rounded-xl border border-border bg-background p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className={cn(
                "mt-1 text-xs",
                text.trim().length < MIN_CHARS ? "text-muted-foreground" : "text-green-600"
              )}>
                {text.trim().length} characters
                {text.trim().length < MIN_CHARS && ` (min ${MIN_CHARS})`}
              </p>
            </div>
          ) : (
            <FileDrop file={file} onFile={handleFile} onClear={() => setFile(null)} />
          )}

          {/* Source URL */}
          <div>
            <label className="mb-1 block text-sm font-medium">Source URL (optional)</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                "Import & Match"
              )}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="/dashboard/jobs" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}

function FileDrop({
  file,
  onFile,
  onClear,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border",
        file && "border-green-500/50 bg-green-500/5"
      )}
    >
      <input
        type="file"
        accept=".pdf,.docx,.doc,.txt,.html"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file ? (
        <>
          <FileText className="mb-2 h-9 w-9 text-green-500" />
          <p className="font-medium">{file.name}</p>
          <p className="text-sm text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <button
            onClick={(e) => { e.preventDefault(); onClear(); }}
            className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <Upload className="mb-2 h-9 w-9 text-muted-foreground" />
          <p className="font-medium">Drop a file or click to browse</p>
          <p className="text-sm text-muted-foreground">PDF, DOCX, TXT, HTML · max {MAX_MB} MB</p>
        </>
      )}
    </div>
  );
}
