"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

// URL field + file upload (to the public branding bucket) + live preview.
export function ImageUpload({
  value, onChange, kind, placeholder,
}: { value: string; onChange: (url: string) => void; kind: "logo" | "cover"; placeholder?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const onFile = async (file?: File) => {
    if (!file) return;
    setUploading(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/api/enterprise/branding/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.url) { setErr(j.error ?? "Upload failed."); return; }
      onChange(j.url);
    } catch { setErr("Upload failed."); } finally { setUploading(false); }
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
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={kind === "cover" ? "mt-2 h-24 w-full rounded-lg border border-border object-cover" : "mt-2 h-12 rounded border border-border bg-white object-contain p-1"} />
      )}
    </div>
  );
}
