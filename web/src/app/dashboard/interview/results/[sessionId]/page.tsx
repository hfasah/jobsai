"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, ArrowUp, TrendingUp, Award, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InterviewSession {
  id: string;
  job_title: string;
  overall_score: number;
  created_at: string;
}

interface InterviewFeedback {
  star_score: number;
  communication_score: number;
  technical_score: number;
  confidence_score: number;
  examples_score: number;
  strengths: string[];
  improvements: string[];
  ai_summary: string;
  recommendations: string[];
}

interface InterviewResponse {
  question_number: number;
  question: string;
  user_answer: string;
  star_score: number;
  clarity_score: number;
  technical_score: number;
  confidence_score: number;
  ai_feedback: string;
}

export default function InterviewResultsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/interviews/sessions/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
          setFeedback(data.feedback);
          setResponses(data.responses || []);
        }
      } catch (err) {
        console.error("Failed to fetch results:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-600";
    if (score >= 70) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return "bg-emerald-500/15";
    if (score >= 70) return "bg-amber-500/15";
    return "bg-red-500/15";
  };

  const handleDownloadPDF = () => {
    // PDF generation would be implemented here
    alert("PDF download coming soon!");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading results...</div>
      </div>
    );
  }

  if (!session || !feedback) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Results not found</div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Interview Performance Report
          </h1>
          <p className="text-muted-foreground">
            {session.job_title} • {new Date(session.created_at).toLocaleDateString()}
          </p>
        </div>
        <Button onClick={handleDownloadPDF} className="gap-2 flex-shrink-0">
          <Download className="h-4 w-4" />
          Download Report
        </Button>
      </div>

      {/* Overall Score Card */}
      <div className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground mb-2">Overall Score</p>
            <div className="flex items-baseline gap-4">
              <span className="text-6xl font-bold text-primary">
                {session.overall_score}
              </span>
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="text-right">
            <Award className="h-16 w-16 text-primary/20 mb-2" />
            <p className="text-sm text-muted-foreground">Performance Score</p>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="mb-8 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-6">Score Breakdown</h2>
        <div className="space-y-4">
          {[
            { label: "STAR Method Usage", score: feedback.star_score },
            { label: "Communication Clarity", score: feedback.communication_score },
            { label: "Technical Knowledge", score: feedback.technical_score },
            { label: "Confidence & Composure", score: feedback.confidence_score },
            { label: "Relevant Examples", score: feedback.examples_score },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span className={cn("font-semibold", getScoreColor(item.score))}>
                  {item.score}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    item.score >= 85
                      ? "bg-emerald-600"
                      : item.score >= 70
                      ? "bg-amber-600"
                      : "bg-red-600"
                  )}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Strengths */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
              <Award className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-emerald-600">Strengths</h3>
          </div>
          <ul className="space-y-2">
            {feedback.strengths.map((strength, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-amber-600">Areas for Improvement</h3>
          </div>
          <ul className="space-y-2">
            {feedback.improvements.map((improvement, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-0.5">→</span>
                <span>{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI Summary */}
      <div className="mb-8 rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Performance Summary</h3>
        <p className="text-muted-foreground leading-relaxed">
          {feedback.ai_summary}
        </p>
      </div>

      {/* Recommendations */}
      <div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Recommendations for Next Time</h3>
        </div>
        <ul className="space-y-2">
          {feedback.recommendations.map((rec, idx) => (
            <li key={idx} className="text-sm flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">{idx + 1}.</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Question Breakdown */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-6">Question-by-Question Feedback</h3>
        <div className="space-y-6">
          {responses.map((response) => (
            <div
              key={response.question_number}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    Question {response.question_number}
                  </p>
                  <h4 className="font-semibold text-foreground">
                    {response.question}
                  </h4>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn("text-sm font-semibold", getScoreColor(response.star_score))}>
                    {response.star_score}%
                  </span>
                </div>
              </div>

              <div className="mb-4 space-y-1">
                <div className="text-xs text-muted-foreground mb-2">Your Answer</div>
                <p className="text-sm text-foreground bg-muted/50 p-3 rounded line-clamp-3">
                  {response.user_answer}
                </p>
              </div>

              <div className="rounded bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2 font-semibold">AI Feedback</p>
                <p className="text-sm text-foreground">{response.ai_feedback}</p>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                {[
                  { label: "STAR", score: response.star_score },
                  { label: "Clarity", score: response.clarity_score },
                  { label: "Technical", score: response.technical_score },
                  { label: "Confidence", score: response.confidence_score },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className={cn(
                      "rounded p-2 text-center",
                      getScoreBg(metric.score)
                    )}
                  >
                    <div className="font-semibold">{metric.score}%</div>
                    <div className="text-muted-foreground">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-8">
        <Button size="lg" className="gap-2">
          <ArrowUp className="h-5 w-5" />
          Practice Another Interview
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Track your progress with each practice session
        </p>
      </div>
    </main>
  );
}
