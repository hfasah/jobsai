"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface CsvImportModalProps {
  jobId: string;
  onClose: () => void;
  onImported: (count: number) => void;
}

interface ParsedRow {
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  source?: string;
  stage?: string;
  notes?: string;
  [key: string]: string | undefined;
}

// Minimal CSV parser — handles quoted fields and comma-inside-quotes
function parseRow(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(field.trim()); field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

const COLUMN_ALIASES: Record<string, keyof ParsedRow> = {
  // name
  name: "candidate_name", full_name: "candidate_name", "full name": "candidate_name",
  candidate: "candidate_name", candidate_name: "candidate_name",
  // email
  email: "candidate_email", email_address: "candidate_email", "email address": "candidate_email",
  candidate_email: "candidate_email",
  // phone
  phone: "candidate_phone", mobile: "candidate_phone", phone_number: "candidate_phone",
  "phone number": "candidate_phone", cell: "candidate_phone",
  // linkedin
  linkedin: "linkedin_url", linkedin_url: "linkedin_url", "linkedin url": "linkedin_url",
  "linkedin profile": "linkedin_url",
  // portfolio
  portfolio: "portfolio_url", website: "portfolio_url", "portfolio url": "portfolio_url",
  github: "portfolio_url",
  // source
  source: "source", referral: "source",
  // stage
  stage: "stage", status: "stage",
  // notes
  notes: "notes", note: "notes", comments: "notes",
};

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[]; mappedHeaders: Record<string, keyof ParsedRow> } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], mappedHeaders: {} };

  const rawHeaders = parseRow(lines[0]);
  const mappedHeaders: Record<string, keyof ParsedRow> = {};
  for (const h of rawHeaders) {
    const key = h.toLowerCase().trim();
    if (COLUMN_ALIASES[key]) mappedHeaders[h] = COLUMN_ALIASES[key];
  }

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const values = parseRow(line);
    const row: ParsedRow = { candidate_name: "", candidate_email: "" };
    for (let i = 0; i < rawHeaders.length; i++) {
      const mapped = mappedHeaders[rawHeaders[i]];
      if (mapped) row[mapped] = values[i] ?? "";
    }
    if (row.candidate_name || row.candidate_email) rows.push(row);
  }
  return { headers: rawHeaders, rows, mappedHeaders };
}

export function CsvImportModal({ jobId, onClose, onImported }: CsvImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsed, setParsed] = useState<{ headers: string[]; rows: ParsedRow[]; mappedHeaders: Record<string, keyof ParsedRow> } | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const p = parseCsv(text);
      if (p.rows.length > 0) { setParsed(p); setStep("preview"); }
    };
    reader.readAsText(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const doImport = async () => {
    if (!parsed) return;
    setStep("importing");
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsed.rows.slice(0, 500) }),
    });
    const json = await res.json();
    setResult(json);
    setStep("done");
    if (json.imported > 0) onImported(json.imported);
  };

  const mappedCount = parsed ? Object.keys(parsed.mappedHeaders).length : 0;
  const hasEmail = parsed?.mappedHeaders && Object.values(parsed.mappedHeaders).includes("candidate_email");
  const hasName = parsed?.mappedHeaders && Object.values(parsed.mappedHeaders).includes("candidate_name");
  const canImport = hasEmail && hasName;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Upload className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold">Import candidates from CSV</h2>
              <p className="text-xs text-muted-foreground">
                {step === "upload" ? "Upload a .csv file to bulk-add candidates" : fileName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Upload step */}
          {step === "upload" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">Max 500 rows</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs space-y-1.5">
                <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-2">Supported columns (any order)</p>
                {[
                  ["Name / Full name", "required"],
                  ["Email / Email address", "required"],
                  ["Phone / Mobile", "optional"],
                  ["LinkedIn / LinkedIn URL", "optional"],
                  ["Portfolio / Website / GitHub", "optional"],
                  ["Stage", "optional — applied, screened, interview, offer, hired"],
                  ["Source", "optional"],
                  ["Notes", "optional"],
                ].map(([col, hint]) => (
                  <div key={col} className="flex justify-between gap-4">
                    <span className="font-medium text-foreground">{col}</span>
                    <span className="text-muted-foreground text-right">{hint}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Preview step */}
          {step === "preview" && parsed && (
            <>
              {!canImport && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Could not detect {!hasName ? "a Name column" : "an Email column"}. Check your headers match the expected names.</span>
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs">
                <p className="font-semibold">{parsed.rows.length} candidate{parsed.rows.length !== 1 ? "s" : ""} found</p>
                <p className="text-muted-foreground mt-0.5">{mappedCount} of {parsed.headers.length} column{parsed.headers.length !== 1 ? "s" : ""} mapped · {!hasName ? "⚠ Name missing" : "✓ Name"} · {!hasEmail ? "⚠ Email missing" : "✓ Email"}</p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      {["Name", "Email", "Phone", "Stage", "Source"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{row.candidate_name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{row.candidate_email || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.candidate_phone || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">{row.stage || "applied"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.source || "import"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 5 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                    + {parsed.rows.length - 5} more rows
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setStep("upload"); setParsed(null); }}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">
                  Change file
                </button>
                <button onClick={doImport} disabled={!canImport}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
                  <Upload className="h-4 w-4" />
                  Import {parsed.rows.length > 500 ? 500 : parsed.rows.length} candidates
                </button>
              </div>
            </>
          )}

          {/* Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Importing candidates…</p>
              <p className="text-xs text-muted-foreground">AI screening will run automatically</p>
            </div>
          )}

          {/* Done */}
          {step === "done" && result && (
            <div className="space-y-3">
              <div className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3",
                result.imported > 0 ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"
              )}>
                {result.imported > 0
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                  : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />}
                <div>
                  <p className="text-sm font-semibold">
                    {result.imported > 0 ? `${result.imported} candidate${result.imported !== 1 ? "s" : ""} imported` : "Nothing imported"}
                  </p>
                  {result.skipped > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{result.skipped} skipped (duplicate email for this job)</p>
                  )}
                  {result.errors.length > 0 && (
                    <p className="mt-0.5 text-xs text-destructive">{result.errors.slice(0, 3).join(" · ")}</p>
                  )}
                </div>
              </div>
              {result.imported > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-primary">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  AI screening is running in the background — scores will appear shortly.
                </div>
              )}
              <button onClick={onClose}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
