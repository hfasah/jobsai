import { supabaseAdmin } from "@/lib/supabase";
import InterviewClient from "./interview-client";

export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: interview } = await supabaseAdmin
    .from("enterprise_interviews")
    .select("*, application:enterprise_applications(candidate_name), job:enterprise_jobs(title,org_id)")
    .eq("token", token).maybeSingle();

  if (!interview) return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-muted-foreground">Interview not found.</p>
    </div>
  );

  if (new Date(interview.expires_at) < new Date() || interview.status === "expired") return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <p className="text-lg font-semibold">This interview link has expired.</p>
        <p className="mt-2 text-sm text-muted-foreground">Please contact the hiring team for a new link.</p>
      </div>
    </div>
  );

  if (interview.status === "completed") return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <p className="text-lg font-semibold">Interview already submitted!</p>
        <p className="mt-2 text-sm text-muted-foreground">Thank you — the hiring team will be in touch soon.</p>
      </div>
    </div>
  );

  const { data: kit } = await supabaseAdmin
    .from("enterprise_interview_kits")
    .select("questions")
    .eq("job_id", interview.job_id).maybeSingle();

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs").select("name")
    .eq("id", (interview.job as { org_id: string } | null)?.org_id ?? "").maybeSingle();

  type Q = { id: string; type: string; question: string; max_score: number };
  const questions: Q[] = ((kit?.questions ?? []) as Q[]).map(({ id, type, question, max_score }) => ({ id, type, question, max_score }));

  return (
    <InterviewClient
      token={token}
      candidateName={(interview.application as { candidate_name: string } | null)?.candidate_name ?? "Candidate"}
      jobTitle={(interview.job as { title: string } | null)?.title ?? "the role"}
      orgName={org?.name ?? "the company"}
      questions={questions}
    />
  );
}
