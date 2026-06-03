"use client";

import { useState } from "react";
import { Mail, Loader2, Copy, Check, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, RunningState } from "@/components/job/ats-report";
import { cn } from "@/lib/utils";
import type { CoverLetter, CoverTone, CoverLength } from "@/types/phase3";

const TONES: { value: CoverTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "confident", label: "Confident" },
  { value: "warm", label: "Warm" },
  { value: "concise", label: "Concise" },
];
const LENGTHS: { value: CoverLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export function CoverLetterView({
  letter,
  onGenerate,
  running,
}: {
  letter: CoverLetter | null;
  onGenerate: (tone: CoverTone, length: CoverLength) => void;
  running: boolean;
}) {
  const [tone, setTone] = useState<CoverTone>(letter?.tone ?? "professional");
  const [length, setLength] = useState<CoverLength>(letter?.length ?? "medium");
  const [copied, setCopied] = useState(false);

  const controls = (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tone</p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                tone === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Length</p>
        <div className="flex gap-2">
          {LENGTHS.map((l) => (
            <button
              key={l.value}
              onClick={() => setLength(l.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                length === l.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (!letter && !running) {
    return (
      <div className="space-y-6">
        <div className="report-surface flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-display text-2xl">Write a tailored cover letter</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Pick a tone and length. AI drafts a letter connecting your real experience to this exact role.
          </p>
          <div className="mt-6 w-full max-w-md text-left">{controls}</div>
          <Button className="mt-6" onClick={() => onGenerate(tone, length)}>
            <Mail className="mr-2 h-4 w-4" />
            Generate cover letter
          </Button>
        </div>
      </div>
    );
  }

  if (running && !letter) return <RunningState label="Drafting your cover letter…" />;
  if (!letter) return null;

  const copy = () => {
    navigator.clipboard.writeText(letter.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([letter.body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls + regenerate */}
      <div className="reveal reveal-1 rounded-2xl border border-border bg-card p-5">
        {controls}
        <Button className="mt-5" size="sm" onClick={() => onGenerate(tone, length)} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Regenerate
        </Button>
      </div>

      {/* Letter */}
      <div className="reveal reveal-2 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-lg">Cover letter</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-desyn-success" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={download}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              .txt
            </Button>
          </div>
        </div>
        <article className="whitespace-pre-wrap px-7 py-7 text-[15px] leading-relaxed text-foreground/90">
          {letter.body}
        </article>
      </div>
    </div>
  );
}
