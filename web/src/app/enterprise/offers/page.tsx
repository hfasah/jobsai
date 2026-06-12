"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Plus, Loader2, Send, CheckCircle2, X, Clock, PenLine, Trash2, Eye, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import OfferModal from "@/components/enterprise/offer-modal";

type Offer = {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  salary: string | null;
  start_date: string | null;
  content: string;
  notes: string | null;
  status: "draft" | "sent" | "signed" | "declined" | "withdrawn";
  sign_token: string;
  signed_at: string | null;
  declined_at: string | null;
  created_at: string;
  job_id: string | null;
  application_id: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
  sent: { label: "Sent", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Send },
  signed: { label: "Signed", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: X },
  withdrawn: { label: "Withdrawn", color: "text-muted-foreground bg-muted border-border", icon: X },
};

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/enterprise/offers")
      .then((r) => r.json())
      .then((j) => setOffers(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendOffer = async (id: string) => {
    setBusy(id);
    const res = await fetch(`/api/enterprise/offers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    if (res.ok) load();
    else {
      const j = await res.json();
      alert(j.error ?? "Failed to send.");
    }
    setBusy(null);
  };

  const withdrawOffer = async (id: string) => {
    if (!confirm("Withdraw this offer?")) return;
    setBusy(id);
    await fetch(`/api/enterprise/offers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw" }),
    });
    load();
    setBusy(null);
  };

  const deleteOffer = async (id: string) => {
    if (!confirm("Delete this offer permanently?")) return;
    setBusy(id);
    await fetch(`/api/enterprise/offers/${id}`, { method: "DELETE" });
    setOffers((o) => o.filter((x) => x.id !== id));
    setBusy(null);
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${APP_URL}/enterprise/offer/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = filter === "all" ? offers : offers.filter((o) => o.status === filter);

  const counts = {
    all: offers.length,
    draft: offers.filter((o) => o.status === "draft").length,
    sent: offers.filter((o) => o.status === "sent").length,
    signed: offers.filter((o) => o.status === "signed").length,
    declined: offers.filter((o) => o.status === "declined").length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Offer Letters</h1>
          <p className="text-sm text-muted-foreground">Create, send, and track offer letters with e-signatures</p>
        </div>
        <button
          onClick={() => { setEditOffer(null); setModalOpen(true); }}
          className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New Offer
        </button>
      </div>

      {/* Summary chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "draft", "sent", "signed", "declined"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === s
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {s === "all" ? "All" : STATUS_META[s].label} ({counts[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No offers yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Create your first offer letter to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((offer) => {
            const meta = STATUS_META[offer.status] ?? STATUS_META.draft;
            const Icon = meta.icon;
            const isBusy = busy === offer.id;
            return (
              <div key={offer.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold leading-tight">{offer.candidate_name}</p>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.color)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {offer.job_title}
                      {offer.salary && <span className="ml-2 text-xs">· {offer.salary}</span>}
                      {offer.start_date && <span className="ml-2 text-xs">· Starts {offer.start_date}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground/60">{offer.candidate_email}</p>
                    {offer.signed_at && (
                      <p className="mt-1 text-xs text-green-400">
                        Signed {new Date(offer.signed_at).toLocaleDateString()}
                      </p>
                    )}
                    {offer.declined_at && (
                      <p className="mt-1 text-xs text-red-400">
                        Declined {new Date(offer.declined_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* View signing link */}
                    <a
                      href={`/enterprise/offer/${offer.sign_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                      title="Preview offer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </a>

                    {/* Copy link */}
                    <button
                      onClick={() => copyLink(offer.sign_token, offer.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                      title="Copy signing link"
                    >
                      {copiedId === offer.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>

                    {/* Edit (draft only) */}
                    {offer.status === "draft" && (
                      <button
                        onClick={() => { setEditOffer(offer); setModalOpen(true); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                        title="Edit"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Send (draft only) */}
                    {offer.status === "draft" && (
                      <button
                        onClick={() => sendOffer(offer.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        title="Send to candidate"
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Send
                      </button>
                    )}

                    {/* Withdraw (sent only) */}
                    {offer.status === "sent" && (
                      <button
                        onClick={() => withdrawOffer(offer.id)}
                        disabled={isBusy}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-60"
                        title="Withdraw offer"
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    )}

                    {/* Delete (draft / withdrawn / declined) */}
                    {["draft", "withdrawn", "declined"].includes(offer.status) && (
                      <button
                        onClick={() => deleteOffer(offer.id)}
                        disabled={isBusy}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-red-500/10 hover:text-red-400 disabled:opacity-60"
                        title="Delete"
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <OfferModal
          offer={editOffer}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
