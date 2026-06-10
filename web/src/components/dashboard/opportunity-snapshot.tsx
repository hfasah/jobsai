"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Zap, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupGateModal } from "./setup-gate-modal";
import { cn } from "@/lib/utils";

interface JobMatches {
  total_matches: number;
  applications_submitted: number;
  pending_applications: number;
  opportunity_gap: number;
  match_breakdown: {
    excellent_fit: number;
    good_fit: number;
    potential: number;
  };
  last_updated: string;
}

interface OpportunitySnapshotProps {
  hasResume?: boolean;
  hasJobPreferences?: boolean;
  hasApplyProfile?: boolean;
}

export function OpportunitySnapshot({
  hasResume = false,
  hasJobPreferences = false,
  hasApplyProfile = false,
}: OpportunitySnapshotProps) {
  const [data, setData] = useState<JobMatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const allStepsComplete = hasResume && hasJobPreferences && hasApplyProfile;

  const handleBrowseMatches = () => {
    if (!allStepsComplete) {
      setShowSetupModal(true);
    } else {
      // Navigate to discover page
      window.location.href = "/dashboard/discover";
    }
  };

  const handleEnableAutoApply = () => {
    if (!allStepsComplete) {
      setShowSetupModal(true);
    } else {
      // Navigate to jobs page
      window.location.href = "/dashboard/jobs";
    }
  };

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await fetch("/api/dashboard/job-matches");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch job matches:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const gapPercentage = Math.round(
    (data.opportunity_gap / data.total_matches) * 100
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-bold">Opportunity Snapshot</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {data.total_matches.toLocaleString()} matching jobs found
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-4 gap-2">
        {/* Jobs Matched */}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Matched</p>
          <p className="text-2xl font-bold text-primary">{data.total_matches.toLocaleString()}</p>
        </div>

        {/* Applications Submitted */}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Applied</p>
          <p className="text-2xl font-bold text-emerald-600">{data.applications_submitted.toLocaleString()}</p>
        </div>

        {/* Opportunity Gap */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold uppercase text-amber-700 mb-2">Gap</p>
          <p className="text-2xl font-bold text-amber-600">{data.opportunity_gap.toLocaleString()}</p>
        </div>

        {/* Pending */}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{data.pending_applications}</p>
        </div>
      </div>

      {/* Marketing Message */}
      <div className="text-center px-2">
        <p className="text-sm text-muted-foreground">
          🤖 Our AI scans 1000+ job sources 24/7 for your perfect matches
        </p>
      </div>

      {/* Match Breakdown — Single Line */}
      <div className="rounded-lg border border-border bg-card p-3 overflow-x-auto">
        <div className="flex items-center gap-3 text-xs whitespace-nowrap">
          <span className="font-semibold uppercase text-muted-foreground">Quality:</span>
          {[
            {
              label: "Excellent",
              color: "bg-emerald-500",
              percent:
                Math.round(
                  (data.match_breakdown.excellent_fit / data.total_matches) * 100
                ) || 0,
            },
            {
              label: "Good",
              color: "bg-blue-500",
              percent:
                Math.round(
                  (data.match_breakdown.good_fit / data.total_matches) * 100
                ) || 0,
            },
            {
              label: "Potential",
              color: "bg-purple-500",
              percent:
                Math.round(
                  (data.match_breakdown.potential / data.total_matches) * 100
                ) || 0,
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div
                className={cn("h-1.5 rounded-full", item.color)}
                style={{ width: `${Math.max(20, item.percent)}px` }}
              />
              <span className="font-medium whitespace-nowrap text-foreground">
                {item.label}
              </span>
              <span className="text-muted-foreground">{item.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-xs font-semibold mb-2">
          {data.opportunity_gap.toLocaleString()} waiting
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs flex-1"
            onClick={handleBrowseMatches}
          >
            Browse <ArrowRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="gap-1 text-xs flex-1"
            onClick={handleEnableAutoApply}
          >
            <Zap className="h-3 w-3" /> Auto-Apply
          </Button>
        </div>
      </div>

      {/* Footer Catchphrase */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground leading-tight">
          🤖 AI scans 1000+ sources 24/7 for your matches
        </p>
      </div>

      {/* Setup Gate Modal */}
      <SetupGateModal
        open={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        hasResume={hasResume}
        hasJobPreferences={hasJobPreferences}
        hasApplyProfile={hasApplyProfile}
      />
    </div>
  );
}
