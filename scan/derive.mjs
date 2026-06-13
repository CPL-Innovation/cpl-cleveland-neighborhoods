#!/usr/bin/env node
// Derive — Stage 1 (discover) + Stage 2 (derive JPEG) of the scan pipeline.
//
// Spec: scan-pipeline-ux.md §"Pipeline stages".
//   1. Discover all *.tif / *.tiff in the input folder.
//   2. Derive one JPEG per master into a separate derivatives/ folder
//      (never write back into masters/). Resample 600→300 dpi *by DPI*
//      (not long-edge), q85, sRGB, 8-bit, RGB, single-page, bake rotation,
//      strip EXIF.
//
// The filename stem IS the CHC ID (e.g. CHC016776.tiff → CHC016776).
// Resumable: skips a master whose JPEG already exists (use --force to redo).

import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { parseArgs } from "node:util";
import { loadStore, saveStore, upsert, REPO_ROOT } from "./store.mjs";

const TARGET_DPI = 300;
const JPEG_QUALITY = 85;
const ASSUMED_SOURCE_DPI = 600; // fallback when the TIFF stores no density

const { values: ARGV } = parseArgs({
  options: {
    in: { type: "string", default: "masters" },
    out: { type: "string", default: "derivatives" },
    force: { type: "boolean", default: false },
  },
});

const IN_DIR = resolve(REPO_ROOT, ARGV.in);
const OUT_DIR = resolve(REPO_ROOT, ARGV.out);

function discoverMasters(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.tiff?$/i.test(f))
    .sort()
    .map((f) => ({ file: f, chcId: basename(f, extname(f)), path: resolve(dir, f) }));
}

/**
 * Derive a single master → JPEG. Returns derive metadata.
 * Throws on a genuine encode failure (caller records it, never crashes the batch).
 */
export async function deriveOne(masterPath, jpegPath) {
  // page:0 → take the first page of a multi-page TIFF (flatten).
  const img = sharp(masterPath, { page: 0, unlimited: true });
  const meta = await img.metadata();
  const srcDpi = meta.density && meta.density > 0 ? meta.density : ASSUMED_SOURCE_DPI;
  const scale = Math.min(1, TARGET_DPI / srcDpi); // never upscale
  const targetWidth = Math.max(1, Math.round((meta.width || 1) * scale));

  await img
    .rotate() // bake in EXIF orientation, then drop the tag
    .resize({ width: targetWidth, withoutEnlargement: true })
    .toColourspace("srgb") // ICC / grayscale → sRGB RGB
    .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: "4:4:4" })
    // no .withMetadata() → EXIF/ICC stripped, rotation already baked, output is 8-bit
    .toFile(jpegPath);

  return {
    status: "ok",
    srcDpi,
    srcWidth: meta.width,
    srcHeight: meta.height,
    srcSpace: meta.space,
    srcDepth: meta.depth,
    srcPages: meta.pages || 1,
    outWidth: targetWidth,
    outDpi: TARGET_DPI,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const masters = discoverMasters(IN_DIR);
  console.log(`Discover: ${masters.length} master(s) in ${IN_DIR}`);
  if (!masters.length) {
    console.log("Nothing to derive. Drop <CHC_ID>.tif files into the input folder.");
    return;
  }

  const store = await loadStore();
  let derived = 0;
  let skipped = 0;
  const failures = [];

  for (const m of masters) {
    const jpegPath = resolve(OUT_DIR, `${m.chcId}.jpg`);
    const jpegRel = `${ARGV.out}/${m.chcId}.jpg`;
    const masterRel = `${ARGV.in}/${m.file}`;

    if (!ARGV.force && existsSync(jpegPath)) {
      skipped++;
      upsert(store, m.chcId, {
        master_path: masterRel,
        jpeg_path: jpegRel,
        status: store[m.chcId]?.status === "ready" ? "ready" : "derived",
      });
      continue;
    }

    try {
      const derive = await deriveOne(m.path, jpegPath);
      derived++;
      upsert(store, m.chcId, {
        master_path: masterRel,
        jpeg_path: jpegRel,
        derive,
        status: "derived",
        error: null,
      });
      console.log(
        `  ✓ ${m.chcId}  ${derive.srcWidth}px@${derive.srcDpi}dpi (${derive.srcSpace}/${derive.srcDepth}` +
          `${derive.srcPages > 1 ? `, ${derive.srcPages}pg` : ""}) → ${derive.outWidth}px@${TARGET_DPI}dpi`
      );
    } catch (err) {
      failures.push({ chcId: m.chcId, reason: err.message });
      upsert(store, m.chcId, {
        master_path: masterRel,
        jpeg_path: null,
        derive: { status: "failed", reason: err.message },
        status: "failed",
        error: `derive: ${err.message}`,
      });
      console.error(`  ✗ ${m.chcId} failed to derive: ${err.message}`);
    }
  }

  await saveStore(store);

  console.log(
    `\nDerived ${derived}, skipped ${skipped} (already present), ${failures.length} failed.`
  );
  if (failures.length) {
    console.log("Failed derives:");
    for (const f of failures) console.log(`  - ${f.chcId}: ${f.reason}`);
  }
}

// Run only when invoked directly (not when imported by run.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { discoverMasters, IN_DIR, OUT_DIR };
