"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

export function AddonButton({
  featureKey, name, active, scheduled, price, isSeat, currentQty, trialing,
}: {
  featureKey: string; name: string; active: boolean; scheduled?: boolean;
  price: number; isSeat?: boolean; currentQty?: number; trialing?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(currentQty && currentQty > 0 ? currentQty : 1);
  const [modal, setModal] = useState<null | "add" | "remove">(null);
  const [err, setErr] = useState("");

  const call = async (action: "activate" | "remove", body?: object) => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`/api/enterprise/addons/${featureKey}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json();
      if (!res.ok) { if (j.redirect) { window.location.href = j.redirect; return; } setErr(j.error ?? "Something went wrong."); return; }
      window.location.reload();
    } catch { setErr("Something went wrong."); } finally { setLoading(false); }
  };

  const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60";
  const ghost = "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60";
  const addAmount = isSeat ? price * qty : price;

  const Modal = ({ kind }: { kind: "add" | "remove" }) => (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && setModal(null)}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">{kind === "add" ? `Add ${name}?` : `Remove ${name}?`}</h3>
          <button onClick={() => setModal(null)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {kind === "add" ? (
          <>
            <p className="mt-2 text-2xl font-bold">${addAmount}<span className="text-sm font-normal text-muted-foreground">/month{isSeat ? ` · ${qty} seat${qty === 1 ? "" : "s"}` : ""}</span></p>
            <p className="mt-3 text-sm text-muted-foreground">{trialing
              ? "Added to your trial now — you won't be charged until your trial ends."
              : "Added to your subscription immediately. Your next invoice will be prorated for the rest of this cycle."}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">It stays active until your next renewal, then won&apos;t renew — so running work isn&apos;t interrupted. No further charges for it.</p>
        )}
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModal(null)} disabled={loading} className={ghost}>Cancel</button>
          <button onClick={() => call(kind === "add" ? "activate" : "remove", kind === "add" && isSeat ? { quantity: qty } : undefined)} disabled={loading} className={primary}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {kind === "add" ? "Confirm" : "Schedule removal"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      {isSeat && (
        <div className="flex items-center gap-2">
          <input type="number" min={1} value={qty} disabled={loading}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
          <button onClick={() => setModal("add")} disabled={loading} className={primary}><Plus className="h-4 w-4" />{active ? "Update" : "Add"} · ${price * qty}/mo</button>
          {active && <button onClick={() => setModal("remove")} disabled={loading} className={ghost}>Remove</button>}
        </div>
      )}

      {!isSeat && scheduled && (
        <button onClick={() => setModal("add")} disabled={loading} className={primary}><Plus className="h-4 w-4" /> Keep add-on</button>
      )}
      {!isSeat && active && !scheduled && (
        <button onClick={() => setModal("remove")} disabled={loading} className={ghost}><Trash2 className="h-4 w-4" /> Remove</button>
      )}
      {!isSeat && !active && (
        <button onClick={() => setModal("add")} disabled={loading} className={primary}><Plus className="h-4 w-4" /> Add · ${price}/mo</button>
      )}

      {err && !modal && <span className="text-xs text-destructive">{err}</span>}
      {modal && <Modal kind={modal} />}
    </div>
  );
}
