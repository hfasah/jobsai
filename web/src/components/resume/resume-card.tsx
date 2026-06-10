"use client";

import { useState } from "react";
import {
  FileText,
  Star,
  MoreHorizontal,
  Download,
  Trash2,
  Upload,
  Pencil,
  Loader2,
  Layers,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResumeParsingStatus } from "@/components/resume/resume-parsing-status";
import type { ResumeDocument } from "@/types/resume";

interface ResumeCardProps {
  doc: ResumeDocument;
  onSetPrimary: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDownload: (versionId: string) => Promise<void>;
  onUploadNewVersion: (id: string) => void;
  onRename: (id: string, label: string) => Promise<void>;
  onViewVersions: (id: string) => void;
}

export function ResumeCard({
  doc,
  onSetPrimary,
  onDelete,
  onDownload,
  onUploadNewVersion,
  onRename,
  onViewVersions,
}: ResumeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newLabel, setNewLabel] = useState(doc.label);
  const [showPartialInfo, setShowPartialInfo] = useState(false);

  const version = doc.active_version;
  const parseStatus = version?.parse_status;
  const isParsed = parseStatus === "parsed" || parseStatus === "partial";
  const isPending = parseStatus === "pending" || parseStatus === "extracting_text";

  const handle = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    setMenuOpen(false);
    try { await fn(); } finally { setLoading(null); }
  };

  const statusLabel: Record<string, string> = {
    pending: "Queued",
    extracting_text: "Parsing…",
    parsed: "Parsed",
    partial: "Partial parse",
    failed: "Parse failed",
  };

  const statusColor: Record<string, string> = {
    pending: "text-muted-foreground",
    extracting_text: "text-blue-500",
    parsed: "text-green-600",
    partial: "text-yellow-600",
    failed: "text-destructive",
  };

  return (
    <div className="relative rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (newLabel.trim()) {
                  await handle("rename", () => onRename(doc.id, newLabel.trim()));
                }
                setRenaming(false);
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                onBlur={() => setRenaming(false)}
              />
              <Button type="submit" size="sm">Save</Button>
            </form>
          ) : (
            <h3 className="truncate font-medium text-foreground">{doc.label}</h3>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {doc.is_primary && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
                <Star className="h-3 w-3" />Primary
              </span>
            )}
            {version && isPending ? (
              <div className="w-full mt-2">
                <ResumeParsingStatus />
              </div>
            ) : (
              version && (
                <>
                  <span>v{version.version_number}</span>
                  <span>·</span>
                  <span>{version.file_ext.toUpperCase()}</span>
                  <span>·</span>
                  <div className="relative inline-block">
                    <span className={cn("font-medium cursor-help flex items-center gap-1", statusColor[parseStatus ?? "pending"])}
                      onMouseEnter={() => parseStatus === "partial" && setShowPartialInfo(true)}
                      onMouseLeave={() => setShowPartialInfo(false)}
                    >
                      {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {statusLabel[parseStatus ?? "pending"]}
                      {parseStatus === "partial" && <Info className="h-3 w-3" />}
                    </span>
                    {showPartialInfo && parseStatus === "partial" && (
                      <div className="absolute bottom-full right-0 mb-2 w-60 rounded-lg bg-slate-900 p-3 text-white shadow-lg text-xs leading-relaxed z-10">
                        <p className="font-semibold mb-2">Resume Ready to Use</p>
                        <ul className="space-y-1.5 mb-2">
                          <li>✅ Resume text extracted</li>
                          <li>✅ Ready for job matching & apply</li>
                          <li>⏳ Skills & experience processing</li>
                        </ul>
                        <p className="text-slate-300">Your resume gets more complete as background parsing finishes. You can edit details anytime.</p>
                      </div>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Resume options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-border bg-card shadow-lg py-1">
                {!doc.is_primary && (
                  <MenuItem
                    icon={<Star className="h-4 w-4" />}
                    label="Set as Primary"
                    loading={loading === "primary"}
                    onClick={() => handle("primary", () => onSetPrimary(doc.id))}
                  />
                )}
                <MenuItem
                  icon={<Layers className="h-4 w-4" />}
                  label="Versions"
                  onClick={() => { setMenuOpen(false); onViewVersions(doc.id); }}
                />
                <MenuItem
                  icon={<Upload className="h-4 w-4" />}
                  label="Upload new version"
                  onClick={() => { setMenuOpen(false); onUploadNewVersion(doc.id); }}
                />
                {isParsed && version && (
                  <MenuItem
                    icon={<Download className="h-4 w-4" />}
                    label="Download"
                    loading={loading === "download"}
                    onClick={() => handle("download", () => onDownload(version.id))}
                  />
                )}
                <MenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  label="Rename"
                  onClick={() => { setMenuOpen(false); setRenaming(true); }}
                />
                <hr className="my-1 border-border" />
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Delete"
                  danger
                  loading={loading === "delete"}
                  onClick={() => handle("delete", () => onDelete(doc.id))}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Updated at */}
      <p className="mt-3 text-xs text-muted-foreground">
        Updated {new Date(doc.updated_at).toLocaleDateString()}
      </p>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  loading,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted",
        danger && "text-destructive hover:bg-destructive/5"
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
