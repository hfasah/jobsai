// Convert generated marketing PNGs to optimized WebP and remove the PNGs.
// Usage: node scripts/optimize-marketing-images.mjs
import sharp from "sharp";
import { readdir, rm, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = join(process.cwd(), "public", "marketing");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (extname(entry.name).toLowerCase() === ".png") yield p;
  }
}

let before = 0, after = 0, n = 0;
for await (const png of walk(ROOT)) {
  const webp = png.replace(/\.png$/i, ".webp");
  before += (await stat(png)).size;
  await sharp(png).webp({ quality: 82 }).toFile(webp);
  after += (await stat(webp)).size;
  await rm(png);
  n++;
  console.log(`✓ ${webp.replace(ROOT, "marketing")}`);
}
const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(`\n${n} images: ${mb(before)}MB → ${mb(after)}MB WebP`);
