"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, Loader2, Plug, AlertTriangle } from "lucide-react";

type Connection = {
  provider: string | null;
  integration_name: string | null;
  last_synced_at: string | null;
};

declare global {
  interface Window {
    MergeLink?: {
      initialize: (opts: {
        linkToken: string;
        onSuccess: (publicToken: string) => void;
        onExit?: () => void;
      }) => void;
      openLink: () => void;
    };
  }
}

function loadMergeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.MergeLink) return resolve();
    if (document.getElementById("merge-link-script")) {
      document.getElementById("merge-link-script")!.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.id = "merge-link-script";
    s.src = "https://cdn.merge.dev/initialize.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Merge Link"));
    document.body.appendChild(s);
  });
}

function fmt(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AtsPanel({
  configured,
  canManage,
  initialConnection,
}: {
  configured: boolean;
  canManage: boolean;
  initialConnection: Connection | null;
}) {
  const [conn, setConn] = useState<Connection | null>(initialConnection);
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect" | "loxo">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loxoSlug, setLoxoSlug] = useState("");
  const [loxoKey, setLoxoKey] = useState("");

  const connectLoxo = async () => {
    setError(null);
    setResult(null);
    if (!loxoSlug.trim() || !loxoKey.trim()) { setError("Enter your Loxo agency slug and API key."); return; }
    setBusy("loxo");
    try {
      const r = await fetch("/api/enterprise/ats/loxo/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency_slug: loxoSlug.trim(), api_key: loxoKey.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not connect Loxo.");
      setConn({ provider: "loxo", integration_name: "Loxo", last_synced_at: null });
      setLoxoKey("");
      setResult("Loxo connected. Run a sync to import your jobs and candidates.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect Loxo.");
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setError(null);
    setResult(null);
    setBusy("connect");
    try {
      const tokenRes = await fetch("/api/enterprise/ats/link-token", { method: "POST" });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenJson.error || "Could not start the connection.");
      await loadMergeScript();
      if (!window.MergeLink) throw new Error("Merge Link failed to load.");
      window.MergeLink.initialize({
        linkToken: tokenJson.link_token,
        onSuccess: async (publicToken: string) => {
          setBusy("connect");
          const r = await fetch("/api/enterprise/ats/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token: publicToken }),
          });
          const j = await r.json();
          setBusy(null);
          if (!r.ok) {
            setError(j.error || "Failed to finish connecting.");
            return;
          }
          setConn({ provider: null, integration_name: j.integration_name ?? "Your ATS", last_synced_at: null });
          setResult("Connected. Run a sync to import your jobs and candidates.");
        },
        onExit: () => setBusy(null),
      });
      window.MergeLink.openLink();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  const sync = async () => {
    setError(null);
    setResult(null);
    setBusy("sync");
    try {
      const r = await fetch("/api/enterprise/ats/sync", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Sync failed.");
      setConn((c) => (c ? { ...c, last_synced_at: new Date().toISOString() } : c));
      setResult(
        `Synced — ${j.jobsImported} new job${j.jobsImported === 1 ? "" : "s"}, ${j.candidatesImported} new candidate${j.candidatesImported === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect your ATS? Already-imported jobs and candidates stay; future syncs stop.")) return;
    setError(null);
    setResult(null);
    setBusy("disconnect");
    try {
      const r = await fetch("/api/enterprise/ats/disconnect", { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error || "Failed to disconnect.");
      setConn(null);
      setResult("ATS disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {conn ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold">{conn.integration_name || "ATS connected"}</div>
                <div className="text-xs text-muted-foreground">Last synced {fmt(conn.last_synced_at)}</div>
              </div>
            </div>
          </div>
          {canManage && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={sync}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync now
              </button>
              <button
                onClick={disconnect}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* One-click via Merge */}
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Plug className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="font-semibold">No ATS connected</div>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Connect in seconds — pick your ATS (Greenhouse, Lever, Ashby, Workday & 20+ more), authorize, and we&apos;ll pull your jobs and candidates in.
            </p>
            {!canManage ? (
              <p className="mt-4 text-xs text-muted-foreground">Ask an owner or admin to connect your ATS.</p>
            ) : configured ? (
              <button
                onClick={connect}
                disabled={busy !== null}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Connect your ATS
              </button>
            ) : (
              <p className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> One-click ATS needs <code className="rounded bg-muted px-1">MERGE_API_KEY</code> set.
              </p>
            )}
          </div>

          {/* Loxo — direct integration (BYO API key) */}
          {canManage && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="font-semibold">Connect Loxo</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Loxo isn&apos;t on the one-click list. Connect it with your Loxo API key (Loxo → Settings → API Keys) and agency slug.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  value={loxoSlug}
                  onChange={(e) => setLoxoSlug(e.target.value)}
                  placeholder="Agency slug (e.g. acme)"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  value={loxoKey}
                  onChange={(e) => setLoxoKey(e.target.value)}
                  type="password"
                  placeholder="Loxo API key"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button
                onClick={connectLoxo}
                disabled={busy !== null}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
              >
                {busy === "loxo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Connect Loxo
              </button>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {result}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}
