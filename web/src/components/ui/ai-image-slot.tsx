import Image from "next/image";
import { ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type AIImageSlotProps = {
  /** Intended public path for the generated image, e.g. "/marketing/hero.png".
   *  Shown on the placeholder so you know exactly where to drop the file. */
  path: string;
  /** Alt text + the placeholder label. */
  alt: string;
  /** Suggested generation prompt — shown on the placeholder so you know what to make. */
  prompt?: string;
  /** Flip to true once the file exists at `path` to render the real image.
   *  Tip: set IMAGES_READY in one place and pass it through. */
  ready?: boolean;
  /** Tailwind aspect ratio utility, e.g. "aspect-video", "aspect-square". */
  ratio?: string;
  /** Round the avatar/portrait slots. */
  rounded?: "xl" | "2xl" | "full";
  className?: string;
  /** Show the image cover-fit (default) vs contain. */
  fit?: "cover" | "contain";
  priority?: boolean;
};

// A drop-in image placeholder. Until `ready` is set it renders a branded
// gradient slot (label + suggested prompt + target path), so nothing 404s.
// To go live: generate the image, save it to /public<path>, then pass ready.
export function AIImageSlot({
  path,
  alt,
  prompt,
  ready = false,
  ratio = "aspect-video",
  rounded = "2xl",
  className,
  fit = "cover",
  priority = false,
}: AIImageSlotProps) {
  const radius = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";

  return (
    <div className={cn("relative overflow-hidden border border-border bg-card", radius, ratio, className)}>
      {ready ? (
        <Image
          src={path}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 600px"
          className={fit === "cover" ? "object-cover" : "object-contain"}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center"
          style={{
            background:
              "radial-gradient(120% 120% at 30% 20%, color-mix(in oklch, var(--desyn-purple) 28%, transparent), transparent 60%), radial-gradient(120% 120% at 80% 90%, color-mix(in oklch, #ec4899 24%, transparent), transparent 60%)",
          }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur">
            <Sparkles className="h-3 w-3" /> Image slot
          </span>
          <div className="flex items-center gap-1.5 text-sm font-medium text-white/90">
            <ImageIcon className="h-4 w-4" /> {alt}
          </div>
          {prompt && (
            <p className="mt-0.5 max-w-[34ch] text-[11px] leading-snug text-white/55">{prompt}</p>
          )}
          <code className="mt-1 rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-white/45">/public{path}</code>
        </div>
      )}
    </div>
  );
}
