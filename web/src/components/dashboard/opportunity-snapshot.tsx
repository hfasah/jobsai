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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Your Opportunity Snapshot</h2>
        </div>
        <p className="text-muted-foreground">
          {data.total_matches.toLocaleString()} matching jobs found based on your profile
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Jobs Matched */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Jobs Matched
          </p>
          <p className="text-4xl font-bold text-primary mb-1">
            {data.total_matches.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">to your profile</p>
        </div>

        {/* Applications Submitted */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Applied
          </p>
          <p className="text-4xl font-bold text-emerald-600 mb-1">
            {data.applications_submitted.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">submitted</p>
        </div>

        {/* Opportunity Gap */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold uppercase text-amber-700 mb-3">
            Opportunity Gap
          </p>
          <p className="text-4xl font-bold text-amber-600 mb-1">
            {data.opportunity_gap.toLocaleString()}
          </p>
          <p className="text-xs text-amber-700">{gapPercentage}% waiting</p>
        </div>

        {/* Pending */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            In Progress
          </p>
          <p className="text-4xl font-bold text-blue-600 mb-1">
            {data.pending_applications}
          </p>
          <p className="text-xs text-muted-foreground">interviews/reviews</p>
        </div>
      </div>

      {/* Match Breakdown */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Match Quality Breakdown</h3>
        <div className="space-y-3">
          {[
            {
              label: "Excellent Fit",
              count: data.match_breakdown.excellent_fit,
              color: "bg-emerald-500",
              percent:
                Math.round(
                  (data.match_breakdown.excellent_fit / data.total_matches) * 100
                ) || 0,
            },
            {
              label: "Good Fit",
              count: data.match_breakdown.good_fit,
              color: "bg-blue-500",
              percent:
                Math.round(
                  (data.match_breakdown.good_fit / data.total_matches) * 100
                ) || 0,
            },
            {
              label: "Potential",
              count: data.match_breakdown.potential,
              color: "bg-purple-500",
              percent:
                Math.round(
                  (data.match_breakdown.potential / data.total_matches) * 100
                ) || 0,
            },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm font-semibold">
                  {item.count.toLocaleString()} ({item.percent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", item.color)}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
        <div className="max-w-md mx-auto">
          <p className="text-lg font-semibold mb-2">
            {data.opportunity_gap.toLocaleString()} opportunities waiting for you
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Enable Auto-Apply to automatically apply to matching jobs 24/7. Never miss an opportunity again.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleBrowseMatches}
            >
              <span>Browse All Matches</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              className="gap-2"
              onClick={handleEnableAutoApply}
            >
              <Zap className="h-4 w-4" />
              <span>Enable Auto-Apply</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Catchphrase */}
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-foreground">
          🤖 Your AI Job Hunter Never Stops
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          While you sleep, our AI scans 1000+ job sources across the web 24/7, continuously finding roles that match your profile. New matches are added hourly. Check back often — fresh opportunities are always arriving.
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
