"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ALLOWED_EXTS = [".pdf", ".doc", ".docx"];
const MAX_MB = 20;

export function UploadZone({ onFileSelected, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validate = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) return "Only PDF, DOC, and DOCX files are supported.";
    if (file.size > MAX_MB * 1024 * 1024) return `File must be under ${MAX_MB} MB.`;
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) { setError(err); return; }
      setError(null);
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const clear = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload resume file"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer select-none",
          dragOver && "border-primary bg-primary/5",
          !dragOver && "border-border hover:border-primary/50 hover:bg-muted/40",
          disabled && "pointer-events-none opacity-50",
          selectedFile && "border-green-500/50 bg-green-500/5"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx"
          onChange={onInputChange}
          disabled={disabled}
        />

        {selectedFile ? (
          <>
            <FileText className="mb-3 h-10 w-10 text-green-500" />
            <p className="font-medium text-foreground">{selectedFile.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Remove selected file"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">
              Drop your resume here or{" "}
              <span className="text-primary underline-offset-2 hover:underline">browse</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF, DOC, DOCX · max {MAX_MB} MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface UploadProgressProps {
  state: "uploading" | "processing";
  progress?: number;
  onCancel?: () => void;
}

function uploadStatusMessage(progress: number): string {
  if (progress < 20) return "Reading your file…";
  if (progress < 50) return "Uploading your resume…";
  if (progress < 80) return "Almost there…";
  if (progress < 100) return "Almost done — calculating your score!";
  return "Finalising upload…";
}

export function UploadProgress({ state, progress, onCancel }: UploadProgressProps) {
  const pct = progress ?? 0;
  const isUploading = state === "uploading";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm px-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {isUploading ? "Uploading Resume" : "Analysing Resume"}
      </h1>

      <p className="mt-3 text-sm text-muted-foreground">
        {isUploading
          ? uploadStatusMessage(pct)
          : "Extracting your profile — usually 10–20 seconds"}
      </p>

      <div className="relative mt-8 w-full max-w-sm">
        {/* track */}
        <div className="h-10 w-full overflow-hidden rounded-full bg-muted">
          {/* fill */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: isUploading ? `${pct}%` : "100%",
              background: "linear-gradient(90deg, oklch(0.53 0.25 296), oklch(0.68 0.2 296))",
              animation: isUploading ? "none" : "pulse 1.5s ease-in-out infinite",
            }}
            role="progressbar"
            aria-valuenow={isUploading ? pct : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {/* percentage label */}
        {isUploading && (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white mix-blend-difference">
            {pct}%
          </span>
        )}
        {!isUploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-bold text-white">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing…
          </span>
        )}
      </div>

      {isUploading && onCancel && (
        <Button variant="outline" size="sm" className="mt-6" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
