// Packages the LinkedIn Chrome extension into public/jobsai-linkedin-extension.zip
// so the dashboard can serve it as a one-click download. Runs as part of the
// Vercel build (see package.json "build"), so the zip is always regenerated from
// source on deploy — no binary is committed to git.
//
// Implemented as a dependency-free, pure-Node ZIP writer (stored / no compression)
// so it doesn't rely on a `zip` CLI being present in the build image.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "extension");
const outDir = join(root, "public");
const outFile = join(outDir, "jobsai-linkedin-extension.zip");

if (!existsSync(srcDir)) {
  console.error("✗ extension/ source folder not found at", srcDir);
  process.exit(1);
}

// ─── CRC-32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── Collect files ─────────────────────────────────────────────────────────────
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue; // skip dotfiles
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const files = walk(srcDir)
  .map((full) => ({ name: relative(srcDir, full).split(sep).join("/"), data: readFileSync(full) }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Build ZIP (stored, no compression) ──────────────────────────────────────
const locals = [];
const centrals = [];
let offset = 0;

for (const f of files) {
  const nameBuf = Buffer.from(f.name, "utf8");
  const crc = crc32(f.data);
  const size = f.data.length;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4);          // version needed
  local.writeUInt16LE(0, 6);           // flags
  local.writeUInt16LE(0, 8);           // method: stored
  local.writeUInt16LE(0, 10);          // mod time
  local.writeUInt16LE(0x21, 12);       // mod date (1980-01-01)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(size, 18);       // compressed size
  local.writeUInt32LE(size, 22);       // uncompressed size
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);          // extra length
  locals.push(local, nameBuf, f.data);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central dir signature
  central.writeUInt16LE(20, 4);          // version made by
  central.writeUInt16LE(20, 6);          // version needed
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(size, 20);
  central.writeUInt32LE(size, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);          // extra
  central.writeUInt16LE(0, 32);          // comment
  central.writeUInt16LE(0, 34);          // disk #
  central.writeUInt16LE(0, 36);          // internal attrs
  central.writeUInt32LE(0, 38);          // external attrs
  central.writeUInt32LE(offset, 42);     // local header offset
  centrals.push(central, nameBuf);

  offset += local.length + nameBuf.length + f.data.length;
}

const centralBuf = Buffer.concat(centrals);
const localBuf = Buffer.concat(locals);

const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);          // EOCD signature
eocd.writeUInt16LE(0, 4);                   // disk #
eocd.writeUInt16LE(0, 6);                   // central dir disk
eocd.writeUInt16LE(files.length, 8);        // entries this disk
eocd.writeUInt16LE(files.length, 10);       // total entries
eocd.writeUInt32LE(centralBuf.length, 12);  // central dir size
eocd.writeUInt32LE(localBuf.length, 16);    // central dir offset
eocd.writeUInt16LE(0, 20);                  // comment length

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, Buffer.concat([localBuf, centralBuf, eocd]));
console.log(`✓ Built ${outFile} (${files.length} files, ${(statSync(outFile).size / 1024).toFixed(1)} KB)`);
