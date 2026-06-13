"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

const MAX_BYTES = 4 * 1024 * 1024; // stay under Vercel's request body limit
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

const HINTS: Record<"logo" | "cover", string> = {
  logo: "PNG, JPG, SVG, or WebP · up to 4MB · transparent PNG recommended (~512px).",
  cover: "PNG, JPG, or WebP · up to 4MB · recommended 1440×400px.",
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Downscale large raster images in the browser so uploads stay small and fast.
async function processImage(file: File, kind: "logo" | "cover"): Promise<Blob> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const img = await loadImage(file);
    const maxW = kind === "cover" ? 1600 : 600;
    if (img.naturalWidth <= maxW && file.size <= 1_500_000) return file;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    const type = kind === "logo" ? "image/png" : "image/jpeg"; // logo keeps transparency
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, type, 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function ImageUpload({
  value, onChange, kind, placeholder,
}: { value: string; onChange: (url: string) => void; kind: "logo" | "cover"; placeholder?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const onFile = async (file?: File) => {
    if (!file) return;
    setErr("");
    if (!ACCEPT.includes(file.type)) { setErr("Use a PNG, JPG, SVG, or WebP image."); return; }
    setUploading(true);
    try {
      const blob = await processImage(file, kind);
      if (blob.size > MAX_BYTES) { setErr("Image is too large — keep it under 4MB."); return; }
      const ext = kind === "logo" ? (file.type === "image/svg+xml" ? "svg" : "png") : "jpg";
      const fd = new FormData();
      fd.append("file", blob, `${kind}.${ext}`);
      fd.append("kind", kind);
      const res = await fetch("/api/enterprise/branding/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) { setErr(j.error ?? "Upload failed — try a smaller image."); return; }
      onChange(j.url);
    } catch {
      setErr("Upload failed — try a smaller image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{HINTS[kind]}</p>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={kind === "cover" ? "mt-2 h-24 w-full rounded-lg border border-border object-cover" : "mt-2 h-12 rounded border border-border bg-white object-contain p-1"} />
      )}
    </div>
  );
}
