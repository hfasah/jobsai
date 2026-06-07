"use client";

import { useState } from "react";
import { promptUpgrade } from "@/lib/upgrade";
import {
  Reply, Loader2, RefreshCw, Copy, Check, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/job/ats-report";
import { cn } from "@/lib/utils";
import type { FollowUpType } from "@/app/api/jobs/[jobId]/follow-up/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedEmail {
  subject: string;
  body: string;
}

// ─── Email type selector ──────────────────────────────────────────────────────

const EMAIL_TYPES: { value: FollowUpType; label: string; description: string }[] = [
  {
    value: "follow_up",
    label: "Follow-up",
    description: "Haven't heard back after applying",
  },
  {
    value: "thank_you",
    label: "Thank you",
    description: "After completing an interview",
  },
  {
    value: "check_in",
    label: "Check in",
    description: "Application has gone quiet",
  },
];

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-desyn-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : `Copy ${label}`}
    </button>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function FollowUpView({ jobId }: { jobId: string }) {
  const [type, setType] = useState<FollowUpType>("follow_up");
  const [email, setEmail] = useState<GeneratedEmail | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = async (t: FollowUpType = type) => {
    setGenerating(true);
    setEmail(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: t }),
      });
      const json = await res.json();
      if (res.status === 402 || json.upgrade_required) { promptUpgrade(json.error); return; }
      if (!res.ok) { alert(json.error ?? "Generation failed."); return; }
      setEmail(json.data);
    } finally {
      setGenerating(false);
    }
  };

  const handleTypeChange = (t: FollowUpType) => {
    setType(t);
    setEmail(null);
  };

  if (!email && !generating) {
    return (
      <div className="space-y-6">
        {/* Type selector */}
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">What kind of email do you need?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {EMAIL_TYPES.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => handleTypeChange(value)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  type === value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <p className={cn("text-sm font-semibold", type === value ? "text-primary" : "text-foreground")}>
                  {label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </button>
            ))}
          </div>
        </div>

        <EmptyState
          icon={<Reply className="h-7 w-7" />}
          title="Generate a follow-up email"
          body="AI writes a short, personalised email using your profile and this role's details. Pick the type above then generate."
          cta={`Generate ${EMAIL_TYPES.find((t) => t.value === type)?.label} email`}
          onClick={() => generate(type)}
        />
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Writing your email…
      </div>
    );
  }

  if (!email) return null;

  return (
    <div className="space-y-5">
      {/* Type selector — compact when email is shown */}
      <div className="flex flex-wrap gap-2">
        {EMAIL_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleTypeChange(value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              type === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Subject line */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Subject
          </span>
          <CopyButton text={email.subject} label="subject" />
        </div>
        <p className="px-4 py-3 text-sm font-medium text-foreground">{email.subject}</p>
      </div>

      {/* Body */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Body
          </span>
          <div className="flex items-center gap-2">
            <CopyButton text={email.body} label="body" />
            <CopyButton text={`Subject: ${email.subject}\n\n${email.body}`} label="full email" />
          </div>
        </div>
        <pre className="whitespace-pre-wrap px-4 py-4 font-sans text-sm leading-relaxed text-foreground">
          {email.body}
        </pre>
      </div>

      {/* Regenerate */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={() => generate(type)} disabled={generating}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Regenerate
        </Button>
      </div>
    </div>
  );
}
