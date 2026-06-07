// Avatar provider abstraction. Without keys the Avatar Room runs in "simulated"
// mode (an animated persona that speaks via OpenAI TTS) so the full experience
// works with no paid provider. Setting LIVEAVATAR_API_KEY + LIVEAVATAR_AVATAR_ID
// flips `isAvatarConfigured()` true and `createStreamingSession()` mints a real
// LiveAvatar LITE session — the client branches on `provider`.

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
  return Boolean(process.env.LIVEAVATAR_API_KEY && process.env.LIVEAVATAR_AVATAR_ID);
}

export interface StreamingSession {
  configured: boolean;
  provider: "liveavatar" | "simulated";
  sessionToken?: string; // short-lived token for the LiveAvatar Web SDK
  sessionId?: string;
}

// Mints a LiveAvatar LITE streaming session (bring-your-own-audio: JobsAI's GPT
// drives questions, OpenAI TTS supplies the audio, LiveAvatar lip-syncs). The API
// key stays server-side. Falls back to simulated mode on any error so the Avatar
// Room always works.
export async function createStreamingSession(): Promise<StreamingSession> {
  if (!isAvatarConfigured()) {
    return { configured: false, provider: "simulated" };
  }

  try {
    const res = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.LIVEAVATAR_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "LITE",
        avatar_id: process.env.LIVEAVATAR_AVATAR_ID,
        is_sandbox: process.env.LIVEAVATAR_SANDBOX === "true",
      }),
    });
    if (!res.ok) throw new Error(`LiveAvatar token failed: ${res.status}`);
    const json = await res.json();
    const sessionToken = json?.data?.session_token as string | undefined;
    if (!sessionToken) throw new Error("No session_token in LiveAvatar response");

    return {
      configured: true,
      provider: "liveavatar",
      sessionToken,
      sessionId: json?.data?.session_id,
    };
  } catch (err) {
    console.error("LiveAvatar session token error:", err);
    return { configured: false, provider: "simulated" };
  }
}
