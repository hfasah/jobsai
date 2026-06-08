"use client";

import { useEffect, useState } from "react";
import { BuyTokensModal } from "@/components/buy-tokens-modal";
import { BUY_TOKENS_EVENT } from "@/lib/upgrade";

// Mounted once in the dashboard. Opens the Buy Tokens modal from anywhere via
// promptBuyTokens().
export function BuyTokensHost() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: Event) => {
      setReason((e as CustomEvent).detail ?? undefined);
      setOpen(true);
    };
    window.addEventListener(BUY_TOKENS_EVENT, handler);
    return () => window.removeEventListener(BUY_TOKENS_EVENT, handler);
  }, []);

  if (!open) return null;
  return <BuyTokensModal reason={reason} onClose={() => setOpen(false)} />;
}
