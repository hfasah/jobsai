// Zips the LinkedIn Chrome extension into public/ so the dashboard can serve it
// as a one-click download. Run: `node scripts/build-extension.mjs`.
//
// The private signing key is NOT bundled — the manifest only carries the public
// `key`, which is what pins the stable extension ID.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "extension");
const outDir = join(root, "public");
const outFile = join(outDir, "jobsai-linkedin-extension.zip");

if (!existsSync(srcDir)) {
  console.error("✗ extension/ source folder not found at", srcDir);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
if (existsSync(outFile)) rmSync(outFile);

try {
  // -r recurse, -X strip extra file attrs, exclude OS cruft.
  execSync(`zip -r -X "${outFile}" . -x ".*" -x "__MACOSX"`, { cwd: srcDir, stdio: "inherit" });
  console.log("\n✓ Built", outFile);
} catch (err) {
  console.error("✗ zip failed — is the `zip` CLI installed?", err.message);
  process.exit(1);
}
