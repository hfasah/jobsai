import express, { Request, Response, NextFunction } from "express";
import { handleApply } from "./apply";
import type { BrowserApplyRequest } from "./types";

const app = express();
app.use(express.json({ limit: "20mb" })); // resume base64 can be large

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const SECRET = process.env.BROWSER_AGENT_SECRET ?? "";

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!SECRET) { next(); return; } // no secret configured — open (dev only)
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "browser-agent" });
});

// ─── Apply endpoint ───────────────────────────────────────────────────────────

app.post("/apply", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<BrowserApplyRequest>;

  if (!body.sourceUrl || !body.profile || !body.resumeBase64) {
    res.status(400).json({ error: "Missing required fields: sourceUrl, profile, resumeBase64" });
    return;
  }

  console.log(`[apply] platform=${body.platform} url=${body.sourceUrl}`);

  try {
    const result = await handleApply(body as BrowserApplyRequest);
    console.log(`[apply] status=${result.status} msg=${result.message ?? ""}`);
    res.json(result);
  } catch (err) {
    console.error("[apply] Unhandled error:", err);
    res.status(500).json({ status: "failed", message: "Internal error" });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Browser agent listening on :${PORT}`);
  if (!SECRET) console.warn("⚠ BROWSER_AGENT_SECRET not set — service is open");
});
