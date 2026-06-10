// AI model configuration — switch models by use case
// Use faster models for high-volume tasks, accurate models for complex reasoning

export const AI_MODELS = {
  // Resume parsing: prioritize RELIABILITY over speed
  // gpt-4-turbo: ~30-60 seconds, reliable & accurate (chosen for business continuity)
  // gpt-3.5-turbo: ~10-30 seconds, but less reliable (was timing out)
  // gpt-4o: ~60+ seconds, most accurate (too slow)
  resumeParse: (process.env.RESUME_PARSE_MODEL || "gpt-4-turbo") as string,

  // Job parsing, matching, skills gap: balance accuracy & speed
  jobParse: (process.env.JOB_PARSE_MODEL || "gpt-4-turbo") as string,
  jobMatch: (process.env.JOB_MATCH_MODEL || "gpt-4-turbo") as string,
  skillsGap: (process.env.SKILLS_GAP_MODEL || "gpt-4-turbo") as string,

  // Resume translation: needs accuracy
  resumeTranslate: (process.env.RESUME_TRANSLATE_MODEL || "gpt-4-turbo") as string,
} as const;

export function getModel(task: keyof typeof AI_MODELS): string {
  return AI_MODELS[task];
}

export function logModelUsage(task: keyof typeof AI_MODELS) {
  console.log(`[AI] Using ${AI_MODELS[task]} for ${task}`);
}
