"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Download, Copy, Check, RefreshCw, Loader2,
  CheckCircle2, Puzzle, MousePointerClick, Save,
} from "lucide-react";
import { LinkedInExtensionModal } from "@/components/linkedin-extension-modal";
import { LINKEDIN_EXTENSION_ID } from "@/lib/constants";
import { JOB_BOARDS } from "@/lib/job-boards";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

type ExtStatus = "checking" | "connected" | "not_installed";
type DirectBoards = Record<string, boolean>;

// Generic one-shot message to the installed extension (externally_connectable).
function extSend(msg: unknown, timeout = 1500): Promise<unknown> {
  return new Promise((resolve) => {
    const chrome = (window as unknown as { chrome?: { runtime?: { sendMessage?: (id: string, msg: unknown, cb: (r?: unknown) => void) => void; lastError?: unknown } } }).chrome;
    if (!chrome?.runtime?.sendMessage) { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), timeout);
    try {
      chrome.runtime.sendMessage(LINKEDIN_EXTENSION_ID, msg, (resp?: unknown) => {
        clearTimeout(timer);
        resolve(chrome.runtime?.lastError ? null : resp ?? null);
      });
    } catch { clearTimeout(timer); resolve(null); }
  });
}

// Ping the installed extension; if present, hand it the API key.
async function connectExtension(apiKey: string): Promise<ExtStatus> {
  const ping = (await extSend({ type: "JOBSAI_PING" })) as { installed?: boolean } | null;
  if (!ping?.installed) return "not_installed";
  await extSend({ type: "JOBSAI_CONNECT", apiKey, apiBase: window.location.origin });
  return "connected";
}

export default function ExtensionPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<ExtStatus>("checking");
  const [showModal, setShowModal] = useState(false);
  const [directBoards, setDirectBoards] = useState<DirectBoards>({ linkedin: true });

  async function loadDirectBoards() {
    const r = (await extSend({ type: "JOBSAI_GET_DIRECT_BOARDS" })) as { directBoards?: DirectBoards } | null;
    if (r?.directBoards) setDirectBoards(r.directBoards);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/user/api-key")
      .then((r) => r.json())
      .then(async (j) => {
        if (!active) return;
        const key = j.api_key ?? null;
        setApiKey(key);
        if (key) {
          const s = await connectExtension(key);
          if (!active) return;
          setStatus(s);
          if (s === "connected") loadDirectBoards();
        } else {
          setStatus("not_installed");
        }
      })
      .catch(() => active && setStatus("not_installed"));
    return () => { active = false; };
  }, []);

  async function recheck() {
    if (!apiKey) return;
    setStatus("checking");
    const s = await connectExtension(apiKey);
    setStatus(s);
    if (s === "connected") loadDirectBoards();
  }

  async function toggleBoard(id: string) {
    const next = { ...directBoards, [id]: !directBoards[id] };
    setDirectBoards(next); // optimistic
    await extSend({ type: "JOBSAI_SET_DIRECT_BOARDS", directBoards: next });
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard/linkedin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> LinkedIn
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A66C2]/10 text-[#0A66C2]">
          <LinkedInIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LinkedIn Extension</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Save LinkedIn jobs to JobsAI in one click and autofill Easy Apply with your saved profile.
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        {status === "checking" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking for the extension…
          </div>
        ) : status === "connected" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-desyn-success" />
              <div>
                <p className="text-sm font-semibold">Extension connected</p>
                <p className="text-xs text-muted-foreground">Open any LinkedIn job and use the floating JobsAI button.</p>
              </div>
            </div>
            <button onClick={recheck} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
              <RefreshCw className="h-4 w-4" /> Recheck
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Puzzle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Extension not detected</p>
                <p className="text-xs text-muted-foreground">Install it, then come back — your account links automatically.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={recheck} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
                <RefreshCw className="h-4 w-4" /> Recheck
              </button>
              <button onClick={() => setShowModal(true)} className="btn-cta inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm">
                <Download className="h-4 w-4" /> Download
              </button>
            </div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Download, title: "1. Install", body: "Download and load the extension in Chrome (Developer mode)." },
          { icon: MousePointerClick, title: "2. Browse LinkedIn", body: "A floating JobsAI button appears on every job page." },
          { icon: Save, title: "3. Save & apply", body: "Import jobs and autofill Easy Apply from your profile." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-4">
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>

      {/* Supported boards + per-board 1-click */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Job boards & 1-click apply</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          Connecting board accounts is optional — you stay logged in as yourself, in your own browser.
          Turn on <strong className="text-foreground">1-click</strong> per board to auto-submit in bulk.
          Leave it off to autofill and submit yourself (recommended until you&apos;ve seen it work on a live listing).
        </p>
        <div className="divide-y divide-border">
          {JOB_BOARDS.filter((b) => b.id !== "manual").map((b) => {
            const on = directBoards[b.id] === true;
            return (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{b.label}</p>
                  <p className="text-xs text-muted-foreground">{b.note}</p>
                </div>
                {b.adapter ? (
                  <button
                    onClick={() => toggleBoard(b.id)}
                    disabled={status !== "connected"}
                    role="switch"
                    aria-checked={on}
                    title={status !== "connected" ? "Connect the extension to change this" : undefined}
                    className={
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 " +
                      (on ? "bg-desyn-success" : "bg-muted")
                    }
                  >
                    <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " + (on ? "translate-x-5" : "translate-x-0.5")} />
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Autofill only</span>
                )}
              </div>
            );
          })}
        </div>
        {status !== "connected" && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">Connect the extension above to manage 1-click per board.</p>
        )}
      </div>

      {/* Manual key */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Your extension key</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          Auto-connect not working? Paste this into the extension popup.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-hidden text-ellipsis rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs">
            {apiKey ?? "Loading…"}
          </code>
          <button onClick={copyKey} disabled={!apiKey} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60">
            {copied ? <Check className="h-4 w-4 text-desyn-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-4 text-center">
        <button onClick={() => setShowModal(true)} className="text-sm font-medium text-primary hover:underline">
          View install instructions
        </button>
      </div>

      {showModal && <LinkedInExtensionModal onClose={() => setShowModal(false)} />}
    </main>
  );
}
