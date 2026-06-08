"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Coins, Loader2, Check } from "lucide-react";
import { cn, fmtTokens } from "@/lib/utils";

interface Pack { id: string; tokens: number; price: string }

// Stripe-style "buy more tokens" modal — pick a pack, check out. For token walls
// where the user just wants to top up (not change plan).
export function BuyTokensModal({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/tokens").then((r) => r.json()).then((j) => {
      if (!active) return;
      const ps: Pack[] = j.data?.packs ?? [];
      setPacks(ps);
      setBalance(j.data?.balance ?? null);
      // default to the middle pack (best value, usually enough)
      setSelected(ps[1]?.id ?? ps[0]?.id ?? null);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const sel = packs.find((p) => p.id === selected);

  const buy = async () => {
    if (!selected) return;
    setBuying(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: selected }),
      });
      const json = await res.json();
      if (json.url) { window.location.assign(json.url); return; }
      alert(json.error ?? "Checkout failed.");
      setBuying(false);
    } catch {
      setBuying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label="Buy tokens" onClick={(e) => e.stopPropagation()}
        className="relative my-8 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Coins className="h-5 w-5" /></div>
          <div>
            <h2 className="font-bold tracking-tight">Buy tokens</h2>
            <p className="text-xs text-muted-foreground">Top up your account — no plan change needed.</p>
          </div>
        </div>

        {reason && <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{reason}</p>}
        {balance !== null && <p className="mt-3 text-sm text-muted-foreground">Current balance: <span className="font-semibold text-foreground">{fmtTokens(balance)}</span> tokens</p>}

        {loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {packs.map((p) => (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={cn("relative rounded-xl border p-3 text-center transition-colors",
                    selected === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                  {selected === p.id && <span className="absolute right-1.5 top-1.5 text-primary"><Check className="h-3.5 w-3.5" /></span>}
                  <p className="text-lg font-bold tabular-nums">{fmtTokens(p.tokens)}</p>
                  <p className="text-[11px] text-muted-foreground">tokens</p>
                  <p className="mt-1 text-sm font-semibold">{p.price}</p>
                </button>
              ))}
            </div>

            {sel && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Selected</span>
                <span className="font-semibold">{fmtTokens(sel.tokens)} tokens · {sel.price}</span>
              </div>
            )}

            <button onClick={buy} disabled={buying || !sel}
              className="btn-cta mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60">
              {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              {sel ? `Purchase for ${sel.price}` : "Choose a pack"}
            </button>
          </>
        )}

        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <Link href="/dashboard/billing" className="text-primary hover:underline">Compare plans</Link>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">Maybe later</button>
        </div>
      </div>
    </div>
  );
}
