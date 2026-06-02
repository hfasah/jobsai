"use client";

import { useEffect, useState, useCallback } from "react";
import { X, CheckCircle, Download, Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResumeVersion } from "@/types/resume";

interface VersionsPanelProps {
  groupId: string;
  documentLabel: string;
  activeVersionId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function VersionsPanel({
  groupId,
  documentLabel,
  activeVersionId,
  onClose,
  onChanged,
}: VersionsPanelProps) {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [currentActive, setCurrentActive] = useState(activeVersionId);

  const fetchVersions = useCallback(async () => {
    const res = await fetch(`/api/resumes/${groupId}`);
    const json = await res.json();
    if (json.data) {
      setVersions(json.data.versions ?? []);
      setCurrentActive(json.data.active_version_id);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const setActive = async (versionId: string) => {
    setBusy(`active-${versionId}`);
    try {
      await fetch(`/api/resumes/${groupId}/set-active-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });
      await fetchVersions();
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const download = async (versionId: string) => {
    setBusy(`download-${versionId}`);
    try {
      const res = await fetch(`/api/resumes/versions/${versionId}/download-url`, {
        method: "POST",
      });
      const { url } = await res.json();
      if (url) window.open(url, "_blank");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (versionId: string) => {
    if (!confirm("Delete this version? This cannot be undone.")) return;
    setBusy(`delete-${versionId}`);
    try {
      const res = await fetch(`/api/resumes/versions/${versionId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Could not delete version.");
        return;
      }
      await fetchVersions();
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const statusColor: Record<string, string> = {
    pending: "text-muted-foreground",
    extracting_text: "text-blue-500",
    parsed: "text-green-600",
    partial: "text-yellow-600",
    failed: "text-destructive",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl"
        role="dialog"
        aria-label="Version history"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold">Version history</h2>
            <p className="text-sm text-muted-foreground">{documentLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading versions…
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions found.</p>
          ) : (
            <ol className="space-y-3">
              {versions.map((v) => {
                const isActive = v.id === currentActive;
                const onlyVersion = versions.length === 1;
                return (
                  <li
                    key={v.id}
                    className={cn(
                      "rounded-xl border p-4",
                      isActive ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{v.version_number}</span>
                          {isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {v.file_name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{v.file_ext.toUpperCase()}</span>
                          {v.pages_count != null && (
                            <>
                              <span>·</span>
                              <span>{v.pages_count} pages</span>
                            </>
                          )}
                          <span>·</span>
                          <span className={cn("font-medium", statusColor[v.parse_status])}>
                            {v.parse_status}
                          </span>
                          <span>·</span>
                          <span>{new Date(v.uploaded_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActive(v.id)}
                          disabled={busy === `active-${v.id}`}
                        >
                          {busy === `active-${v.id}` ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          )}
                          Set Active
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => download(v.id)}
                        disabled={busy === `download-${v.id}`}
                      >
                        {busy === `download-${v.id}` ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-1 h-3.5 w-3.5" />
                        )}
                        Download
                      </Button>
                      {!onlyVersion && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => remove(v.id)}
                          disabled={busy === `delete-${v.id}`}
                          className="text-destructive hover:bg-destructive/5"
                        >
                          {busy === `delete-${v.id}` ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                          )}
                          Delete
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
