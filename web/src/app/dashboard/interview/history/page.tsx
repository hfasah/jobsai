"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Calendar, Award, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface InterviewSession {
  id: string;
  job_title: string;
  overall_score: number;
  created_at: string;
  mode: string;
}

export default function InterviewHistoryPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/interviews/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessions(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const getScoreTrend = (sessions: InterviewSession[]): string => {
    if (sessions.length < 2) return "no-trend";
    const latest = sessions[0].overall_score;
    const previous = sessions[1].overall_score;
    if (latest > previous) return "up";
    if (latest < previous) return "down";
    return "flat";
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-600 bg-emerald-500/15";
    if (score >= 70) return "text-amber-600 bg-amber-500/15";
    return "text-red-600 bg-red-500/15";
  };

  const avgScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.overall_score, 0) / sessions.length)
      : 0;

  const trend = getScoreTrend(sessions);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Interview Practice History
        </h1>
        <p className="text-muted-foreground">
          Track your progress across all practice sessions
        </p>
      </div>

      {/* Stats Cards */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Sessions */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total Sessions
              </span>
              <Award className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">practice interviews</p>
          </div>

          {/* Average Score */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Average Score
              </span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{avgScore}%</p>
            <p className="text-xs text-muted-foreground mt-1">across all sessions</p>
          </div>

          {/* Latest Score */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Latest Score
              </span>
              <span
                className={cn(
                  "text-xs font-bold px-2 py-1 rounded",
                  trend === "up"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : trend === "down"
                    ? "bg-red-500/15 text-red-600"
                    : "bg-gray-500/15 text-gray-600"
                )}
              >
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
              </span>
            </div>
            <p className={cn("text-2xl font-bold", getScoreColor(sessions[0].overall_score))}>
              {sessions[0].overall_score}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(sessions[0].created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed border-border">
          <Award className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">No practice sessions yet</p>
          <p className="text-sm text-muted-foreground">
            Start your first interview practice to see your progress here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, idx) => (
            <Link
              key={session.id}
              href={`/dashboard/interview/results/${session.id}`}
              className="block rounded-lg border border-border bg-card p-4 hover:shadow-md hover:border-primary/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-medium bg-muted px-2 py-1 rounded">
                      Session {sessions.length - idx}
                    </span>
                    <h3 className="font-semibold text-foreground">
                      {session.job_title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="capitalize">
                      {session.mode === "voice"
                        ? "🎤 Voice"
                        : session.mode === "avatar"
                        ? "🎥 Avatar"
                        : "💬 Text"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className={cn("text-2xl font-bold", getScoreColor(session.overall_score))}>
                      {session.overall_score}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {idx === 0
                        ? "Latest"
                        : `+${session.overall_score - sessions[0].overall_score >= 0 ? "+" : ""}${session.overall_score - sessions[0].overall_score}`}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Progress Chart (simplified) */}
      {sessions.length > 1 && (
        <div className="mt-12 rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-6">Score Progression</h3>
          <div className="flex items-end justify-between gap-2 h-48">
            {sessions
              .slice()
              .reverse()
              .map((session, idx) => (
                <div key={session.id} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all hover:opacity-80",
                      getScoreColor(session.overall_score)
                    )}
                    style={{
                      height: `${(session.overall_score / 100) * 100}%`,
                      minHeight: "8px",
                    }}
                    title={`${session.overall_score}%`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {idx + 1}
                  </span>
                </div>
              ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Practice session progression
          </p>
        </div>
      )}
    </main>
  );
}
