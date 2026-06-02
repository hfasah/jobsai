"use client";

import { useState, useEffect, useCallback } from "react";
import { LayoutGrid, ShieldCheck, Wand2, Mail, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { AtsReport } from "@/components/job/ats-report";
import { TailoredResumeView } from "@/components/job/tailored-resume";
import { CoverLetterView } from "@/components/job/cover-letter";
import { InterviewPrepView } from "@/components/job/interview-prep";
import type { AtsScan, TailoredResume, CoverLetter, CoverTone, CoverLength, InterviewPrep } from "@/types/phase3";

type TabKey = "overview" | "ats" | "tailor" | "cover" | "interview";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview",   label: "Overview",      icon: <LayoutGrid className="h-4 w-4" /> },
  { key: "ats",        label: "ATS Scan",       icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "tailor",     label: "Tailor Resume",  icon: <Wand2 className="h-4 w-4" /> },
  { key: "cover",      label: "Cover Letter",   icon: <Mail className="h-4 w-4" /> },
  { key: "interview",  label: "Interview Prep", icon: <BrainCircuit className="h-4 w-4" /> },
];

export function JobTabs({
  jobId,
  overview,
}: {
  jobId: string;
  overview: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("overview");

  // ATS
  const [scan, setScan] = useState<AtsScan | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanLoaded, setScanLoaded] = useState(false);

  // Tailor
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [tailorRunning, setTailorRunning] = useState(false);
  const [tailorLoaded, setTailorLoaded] = useState(false);

  // Cover
  const [letter, setLetter] = useState<CoverLetter | null>(null);
  const [coverRunning, setCoverRunning] = useState(false);
  const [coverLoaded, setCoverLoaded] = useState(false);

  // Interview
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [prepRunning, setPrepRunning] = useState(false);
  const [prepLoaded, setPrepLoaded] = useState(false);

  // Lazy-load saved data when a tab is first opened
  useEffect(() => {
    if (tab === "ats" && !scanLoaded) {
      setScanLoaded(true);
      fetch(`/api/jobs/${jobId}/ats-scan`).then((r) => r.json()).then((j) => setScan(j.data));
    }
    if (tab === "tailor" && !tailorLoaded) {
      setTailorLoaded(true);
      fetch(`/api/jobs/${jobId}/tailor`).then((r) => r.json()).then((j) => setTailored(j.data));
    }
    if (tab === "cover" && !coverLoaded) {
      setCoverLoaded(true);
      fetch(`/api/jobs/${jobId}/cover-letter`).then((r) => r.json()).then((j) => setLetter(j.data));
    }
    if (tab === "interview" && !prepLoaded) {
      setPrepLoaded(true);
      fetch(`/api/jobs/${jobId}/interview-prep`).then((r) => r.json()).then((j) => setPrep(j.data));
    }
  }, [tab, jobId, scanLoaded, tailorLoaded, coverLoaded, prepLoaded]);

  const runScan = useCallback(async () => {
    setScanRunning(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/ats-scan`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Scan failed."); return; }
      setScan(json.data);
    } finally {
      setScanRunning(false);
    }
  }, [jobId]);

  const runTailor = useCallback(async () => {
    setTailorRunning(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Tailoring failed."); return; }
      setTailored(json.data);
    } finally {
      setTailorRunning(false);
    }
  }, [jobId]);

  const runPrep = useCallback(async () => {
    setPrepRunning(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/interview-prep`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Generation failed."); return; }
      setPrep(json.data);
    } finally {
      setPrepRunning(false);
    }
  }, [jobId]);

  const runCover = useCallback(async (tone: CoverTone, length: CoverLength) => {
    setCoverRunning(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, length }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Generation failed."); return; }
      setLetter(json.data);
    } finally {
      setCoverRunning(false);
    }
  }, [jobId]);

  return (
    <div className="mt-8">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="pt-6">
        {tab === "overview" && overview}
        {tab === "ats" && <AtsReport scan={scan} onRun={runScan} running={scanRunning} />}
        {tab === "tailor" && <TailoredResumeView tailored={tailored} onRun={runTailor} running={tailorRunning} />}
        {tab === "cover" && <CoverLetterView letter={letter} onGenerate={runCover} running={coverRunning} />}
        {tab === "interview" && <InterviewPrepView prep={prep} onGenerate={runPrep} running={prepRunning} />}
      </div>
    </div>
  );
}
