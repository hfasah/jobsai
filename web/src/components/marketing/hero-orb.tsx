import Link from "next/link";
import { Mic } from "lucide-react";

// Liquid voice orb — the hero centerpiece. Pure CSS (server-safe).
// A filled glossy blob whose silhouette morphs organically (Fireflies-style),
// with color drifting inside and a glossy highlight up top.
// Layers, back to front:
//   1. orb-glow   — soft halo that morphs + breathes behind the blob
//   2. orb-blob   — the filled, morphing gradient sphere (clips its children)
//   3. orb-inner  — a magenta light that drifts inside, like liquid swirling
//   4. orb-sheen  — drifting specular highlight (the glossy reflection)
//   5. orb-dots   — three dots pulsing in sequence (listening / thinking)
// Honors prefers-reduced-motion via globals.css.
export function HeroOrb() {
  return (
    <div className="relative mx-auto flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
      {/* Outer halo */}
      <span className="orb-glow absolute inset-0" aria-hidden />

      {/* The morphing blob */}
      <span className="orb-blob relative h-60 w-60 overflow-hidden sm:h-64 sm:w-64" aria-hidden>
        {/* Liquid color drifting inside */}
        <span className="orb-inner absolute inset-0" />
        {/* Specular highlight */}
        <span className="orb-sheen absolute" />
      </span>

      {/* Listening dots (kept crisp, above the blob) */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2" aria-hidden>
        <span className="orb-dot h-2.5 w-2.5 rounded-full bg-white" />
        <span className="orb-dot h-2.5 w-2.5 rounded-full bg-white [animation-delay:200ms]" />
        <span className="orb-dot h-2.5 w-2.5 rounded-full bg-white [animation-delay:400ms]" />
      </span>

      {/* Tap to Talk */}
      <Link
        href="/sign-up"
        className="absolute -bottom-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/60"
      >
        <Mic className="h-4 w-4" />
        Tap to Talk
      </Link>
    </div>
  );
}
