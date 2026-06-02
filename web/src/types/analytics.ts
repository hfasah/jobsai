export interface AnalyticsSummary {
  total_jobs: number;
  avg_match_score: number | null;
  total_applications: number;
  active_applications: number;  // not rejected
  offers: number;
}

export interface StageBucket {
  stage: string;
  label: string;
  count: number;
}

export interface ScoreBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface SkillFrequency {
  skill: string;
  count: number;
}

export interface WeekActivity {
  week: string;      // "Mon DD"
  jobs: number;
  applications: number;
}

export interface AiUsage {
  ats_scans: number;
  tailored_resumes: number;
  cover_letters: number;
  interview_preps: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  applications_by_stage: StageBucket[];
  match_distribution: ScoreBucket[];
  top_missing_skills: SkillFrequency[];
  top_matched_skills: SkillFrequency[];
  activity_by_week: WeekActivity[];
  ai_usage: AiUsage;
}
