import { existsSync } from "node:fs";
import { join } from "node:path";

// Server-only: true if a file exists under /public for the given web path
// (e.g. "/marketing/hero.png"). Used to flip AIImageSlot `ready` automatically,
// so a slot shows its image once the asset is dropped in — and never 404s.
export function publicImageExists(webPath: string): boolean {
  return existsSync(join(process.cwd(), "public", webPath.replace(/^\//, "")));
}
