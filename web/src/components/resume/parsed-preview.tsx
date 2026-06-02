"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeVersion } from "@/types/resume";
import { cn } from "@/lib/utils";

interface ParsedPreviewProps {
  version: ResumeVersion;
  documentLabel: string;
  onSave: (label: string) => Promise<void>;
  onDiscard: () => void;
}

export function ParsedPreview({
  version,
  documentLabel,
  onSave,
  onDiscard,
}: ParsedPreviewProps) {
  const [label, setLabel] = useState(documentLabel);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["contact", "experience", "education", "skills"])
  );

  const profile = version.parsed_profile;
  const parsed = profile?.parsed_json;
  const isPartial = version.parse_status === "partial";
  const warnings = parsed?.warnings ?? [];

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(label);
    } finally {
      setSaving(false);
    }
  };

  const confidence = parsed?.confidence ?? {};
  const badge = (score?: number) => {
    if (score === undefined) return null;
    const level = score >= 0.8 ? "High" : score >= 0.5 ? "Med" : "Low";
    return (
      <span
        className={cn(
          "ml-2 rounded px-1.5 py-0.5 text-xs font-medium",
          level === "High" && "bg-green-100 text-green-700",
          level === "Med" && "bg-yellow-100 text-yellow-700",
          level === "Low" && "bg-red-100 text-red-700"
        )}
      >
        {level}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">Resume name</p>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="text-right text-xs text-muted-foreground mt-6">
          <p>{version.file_name}</p>
          <p>{version.pages_count ? `${version.pages_count} pages` : ""}</p>
          <p>v{version.version_number}</p>
        </div>
      </div>

      {/* Parse status banner */}
      {isPartial && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Partial parse — some sections may be missing.</p>
            {warnings.length > 0 && (
              <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Sections accordion */}
      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">

        {/* Contact */}
        <Section
          title="Contact"
          sectionKey="contact"
          open={openSections.has("contact")}
          onToggle={toggleSection}
          badge={badge(confidence.contact)}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{profile?.full_name ?? <span className="text-muted-foreground/50">—</span>}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{profile?.email ?? <span className="text-muted-foreground/50">—</span>}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{profile?.phone ?? <span className="text-muted-foreground/50">—</span>}</dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd>{profile?.location ?? <span className="text-muted-foreground/50">—</span>}</dd>
          </dl>
          {profile?.summary && (
            <p className="mt-3 text-sm text-muted-foreground italic border-t border-border pt-3">
              {profile.summary}
            </p>
          )}
        </Section>

        {/* Experience */}
        {(version.experiences ?? []).length > 0 && (
          <Section
            title={`Experience (${(version.experiences ?? []).length})`}
            sectionKey="experience"
            open={openSections.has("experience")}
            onToggle={toggleSection}
            badge={badge(confidence.experience)}
          >
            <ol className="space-y-4">
              {(version.experiences ?? []).map((exp) => (
                <li key={exp.id} className="text-sm">
                  <p className="font-medium">{exp.title}</p>
                  <p className="text-muted-foreground">
                    {exp.company}
                    {exp.location ? ` · ${exp.location}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {exp.start_date ?? "?"} – {exp.is_current ? "Present" : (exp.end_date ?? "?")}
                  </p>
                  {exp.description && (
                    <p className="mt-1 text-muted-foreground line-clamp-3">{exp.description}</p>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Education */}
        {(version.educations ?? []).length > 0 && (
          <Section
            title={`Education (${(version.educations ?? []).length})`}
            sectionKey="education"
            open={openSections.has("education")}
            onToggle={toggleSection}
            badge={badge(confidence.education)}
          >
            <ol className="space-y-3">
              {(version.educations ?? []).map((edu) => (
                <li key={edu.id} className="text-sm">
                  <p className="font-medium">{edu.school}</p>
                  <p className="text-muted-foreground">
                    {[edu.degree, edu.field_of_study].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {edu.start_date ?? "?"} – {edu.end_date ?? "?"}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Skills */}
        {(version.skills ?? []).length > 0 && (
          <Section
            title={`Skills (${(version.skills ?? []).length})`}
            sectionKey="skills"
            open={openSections.has("skills")}
            onToggle={toggleSection}
            badge={badge(confidence.skills)}
          >
            <div className="flex flex-wrap gap-2">
              {(version.skills ?? []).map((s) => (
                <span
                  key={s.id}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs"
                >
                  {s.skill}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <Button variant="outline" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Save resume
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  sectionKey,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  sectionKey: string;
  open: boolean;
  onToggle: (k: string) => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40"
        aria-expanded={open}
      >
        <span className="flex items-center">
          {title}
          {badge}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
