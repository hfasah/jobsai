"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

// Browser print-to-PDF. `auto` opens the print dialog on load (used when the
// admin opens the quote with ?print=1 from the builder).
export function PrintButton({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold hover:bg-muted"
    >
      <Printer className="h-4 w-4" /> Download PDF
    </button>
  );
}
