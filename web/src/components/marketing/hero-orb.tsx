import Link from "next/link";
import { Mic } from "lucide-react";

// Glowing voice-assistant orb — the hero centerpiece. Pure CSS (server-safe):
// a blurred gradient halo, a slowly rotating conic ring, concentric guide rings,
// and a pulsing gradient core. "Tap to Talk" routes to sign-up.
export function HeroOrb() {
  return (
    <div className="relative mx-auto flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
      {/* Soft halo */}
      <span className="absolute inset-2 rounded-full bg-gradient-to-tr from-primary/30 via-desyn-purple/25 to-desyn-cyan/20 blur-3xl" />

      {/* Concentric guide rings */}
      <span className="absolute inset-0 rounded-full border border-white/10" />
      <span className="absolute inset-6 rounded-full border border-white/10" />

      {/* Rotating conic arc ring */}
      <span
        className="absolute inset-0 animate-[spin_7s_linear_infinite] rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, var(--desyn-brand) 40deg, var(--desyn-purple) 110deg, var(--cta) 150deg, transparent 200deg)",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
        }}
      />

      {/* Pulsing core */}
      <span className="animate-float-slow relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary via-desyn-purple to-purple-700 shadow-glow-purple sm:h-36 sm:w-36">
        <span className="absolute inset-0 rounded-full bg-white/20 blur-xl" />
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
