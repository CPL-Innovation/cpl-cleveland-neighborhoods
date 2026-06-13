// Derive (local CLI) — discover masters + derive a JPEG per master with sharp.
// Returns the JPEG bytes so the caller can both upload to Storage and feed the VLM.
// Ported from scan/derive.mjs. Runs locally only (sharp reads local TIFFs); never on serverless.
import sharp from "sharp";
import { existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeriveMeta } from "@/lib/types";

const TARGET_DPI = 300;
const JPEG_QUALITY = 85;
const ASSUMED_SOURCE_DPI = 600;

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface Master {
  file: string;
  chcId: string;
  path: string;
}

export function discoverMasters(dir: string): Master[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.tiff?$/i.test(f))
    .sort()
    .map((f) => ({ file: f, chcId: basename(f, extname(f)), path: resolve(dir, f) }));
}

/** Derive a master → JPEG bytes (+ metadata). Optionally also writes a local copy. */
export async function deriveOne(
  masterPath: string,
  localOut?: string
): Promise<{ meta: DeriveMeta; jpeg: Buffer }> {
  const img = sharp(masterPath, { page: 0, unlimited: true });
  const meta = await img.metadata();
  const srcDpi = meta.density && meta.density > 0 ? meta.density : ASSUMED_SOURCE_DPI;
  const scale = Math.min(1, TARGET_DPI / srcDpi);
  const targetWidth = Math.max(1, Math.round((meta.width || 1) * scale));

  const jpeg = await img
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .toColourspace("srgb")
    .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: "4:4:4" })
    .toBuffer();

  if (localOut) {
    mkdirSync(dirname(localOut), { recursive: true });
    writeFileSync(localOut, jpeg);
  }

  return {
    meta: {
      status: "ok",
      srcDpi,
      srcWidth: meta.width,
      srcHeight: meta.height,
      srcSpace: meta.space,
      srcDepth: meta.depth,
      srcPages: meta.pages || 1,
      outWidth: targetWidth,
      outDpi: TARGET_DPI,
    },
    jpeg,
  };
}
