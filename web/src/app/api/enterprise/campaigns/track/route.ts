import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 1x1 transparent GIF for open tracking. Embedded in campaign emails as
// <img src=".../track?s=<sendId>">. Public by design (recipient's mail client
// loads it). Marks the send opened the first time it's fetched.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse() {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Content-Length": String(PIXEL.length),
    },
  });
}

export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get("s");
  if (sendId) {
    // Fire-and-forget; never block the pixel on the DB.
    supabaseAdmin
      .from("enterprise_campaign_sends")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", sendId)
      .is("opened_at", null)
      .then(() => {}, () => {});
  }
  return pixelResponse();
}
