// Avatar provider abstraction. Today the Avatar Room runs in "simulated" mode
// (an animated persona that speaks via OpenAI TTS) so the full experience works
// with no paid key. Setting AVATAR_PROVIDER + the provider key (e.g. HEYGEN_API_KEY)
// flips `isAvatarConfigured()` true; wire the real streaming session in
// `createStreamingSession()` below — the client already branches on `configured`.

export type AvatarPersona = "recruiter" | "hiring_manager" | "tech_lead" | "executive";

export interface PersonaMeta {
  label: string;
  title: string;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"; // OpenAI TTS voice
  guidance: string;  // steers the GPT interviewer
  accent: string;    // tailwind gradient classes for the simulated avatar
}

export const PERSONAS: Record<AvatarPersona, PersonaMeta> = {
  recruiter: {
    label: "HR Recruiter",
    title: "Recruiter screen",
    voice: "nova",
    guidance: "You are a warm HR recruiter running a first-round screen. Focus on motivation, culture fit, communication, and logistics. Keep it friendly and conversational.",
    accent: "from-pink-500 to-rose-500",
  },
  hiring_manager: {
    label: "Hiring Manager",
    title: "Hiring manager 1:1",
    voice: "onyx",
    guidance: "You are the hiring manager. Probe role fit, priorities, how the candidate works, and how they'd handle the team's real challenges. Direct but fair.",
    accent: "from-blue-500 to-indigo-500",
  },
  tech_lead: {
    label: "Technical Lead",
    title: "Technical interview",
    voice: "echo",
    guidance: "You are the engineering/technical lead. Go deep on technical concepts, trade-offs, and real project experience. Ask probing follow-ups when answers stay shallow.",
    accent: "from-cyan-500 to-teal-500",
  },
  executive: {
    label: "Executive (VP/Director)",
    title: "Executive interview",
    voice: "onyx",
    guidance: "You are a VP/Director. Focus on strategic thinking, leadership, vision, judgment under ambiguity, and executive presence. Expect concise, high-signal answers.",
    accent: "from-violet-500 to-purple-600",
  },
};

export function isAvatarConfigured(): boolean {
  return Boolean(process.env.AVATAR_PROVIDER && process.env.HEYGEN_API_KEY);
}

export interface StreamingSession {
  configured: boolean;
  provider: "heygen" | "simulated";
  token?: string;
  // ...provider-specific fields (sessionId, serverUrl, avatarId) go here.
}

// Returns a real streaming session when a provider is configured, otherwise the
// simulated descriptor. The HeyGen path is left as a clearly-marked seam.
export async function createStreamingSession(): Promise<StreamingSession> {
  if (!isAvatarConfigured()) {
    return { configured: false, provider: "simulated" };
  }

  // ── HeyGen streaming seam ──────────────────────────────────────────────────
  // const res = await fetch("https://api.heygen.com/v1/streaming.create_token", {
  //   method: "POST",
  //   headers: { "x-api-key": process.env.HEYGEN_API_KEY! },
  // });
  // const { data } = await res.json();
  // return { configured: true, provider: "heygen", token: data.token };
  return { configured: false, provider: "simulated" };
}
