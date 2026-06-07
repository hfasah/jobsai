"use client";

import { useEffect, useState } from "react";
import { UpgradePlansModal } from "@/components/upgrade-plans-modal";
import { UPGRADE_EVENT } from "@/lib/upgrade";

// Mounted once in the dashboard. Listens for promptUpgrade() events and shows the
// upgrade modal anywhere in the app — one consistent, one-click path to buy.
export function UpgradeHost() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: Event) => {
      setReason((e as CustomEvent).detail ?? undefined);
      setOpen(true);
    };
    window.addEventListener(UPGRADE_EVENT, handler);
    return () => window.removeEventListener(UPGRADE_EVENT, handler);
  }, []);

  if (!open) return null;
  return <UpgradePlansModal reason={reason} onClose={() => setOpen(false)} />;
}
