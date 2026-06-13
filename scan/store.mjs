// scan_review store — the per-photo working record, keyed by CHC ID.
//
// In this no-DB project the "scan_review table" the spec asks for is a single JSON
// file written durably (read-modify-write). One record per photo; the review UI and
// the pipeline both go through here so the shape stays consistent.
//
// Record shape (scan-pipeline-ux.md §"Per-photo working record"):
//   {
//     chc_id, master_path, jpeg_path,
//     derive:  { status: "ok"|"failed", reason?, width?, height?, dpi? },
//     vlm:     { address, year, description, objects } | null,
//     status:  "discovered" | "derived" | "ready" | "failed",
//     error:   string | null,           // pipeline-level failure reason
//     review:  {
//       address:     { verdict: "correct"|"edited"|"flag", value, flag_reason? },
//       year:        { verdict: "correct"|"edited"|"flag", value, flag_reason? },
//       description: { verdict: "accepted"|"edited"|"rejected", value },
//       notes:       string,
//       status:      "unreviewed" | "reviewed"
//     },
//     enrichment: {...} | null           // populated on accept (photo_enrichment-shaped)
//   }

import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..");
export const STORE_DIR = resolve(REPO_ROOT, "data/scan");
export const STORE_PATH = resolve(STORE_DIR, "scan_review.json");

export function emptyReview() {
  return {
    address: { verdict: null, value: "", flag_reason: null },
    year: { verdict: null, value: "", flag_reason: null },
    description: { verdict: null, value: "" },
    notes: "",
    status: "unreviewed",
  };
}

/** Load the store as a { chc_id -> record } map. Returns {} if the file is absent. */
export async function loadStore() {
  if (!existsSync(STORE_PATH)) return {};
  try {
    const raw = JSON.parse(await readFile(STORE_PATH, "utf8"));
    // Accept either a map or a legacy array; normalize to a map.
    if (Array.isArray(raw)) {
      const map = {};
      for (const r of raw) map[r.chc_id] = r;
      return map;
    }
    return raw || {};
  } catch (err) {
    console.warn(`[store] could not parse ${STORE_PATH}: ${err.message} — starting fresh`);
    return {};
  }
}

/** Persist the map durably (atomic write via temp file + rename). */
export async function saveStore(map) {
  mkdirSync(STORE_DIR, { recursive: true });
  const tmp = STORE_PATH + ".tmp";
  await writeFile(tmp, JSON.stringify(map, null, 2));
  await rename(tmp, STORE_PATH);
}

/**
 * Merge `patch` into the record for `chcId`, creating it if absent.
 * Shallow-merges top-level keys; `review` is deep-merged one level so a partial
 * review patch (e.g. just the address verdict) preserves the rest of the review.
 */
export function upsert(map, chcId, patch) {
  const prev = map[chcId] || {
    chc_id: chcId,
    master_path: null,
    jpeg_path: null,
    derive: null,
    vlm: null,
    status: "discovered",
    error: null,
    review: emptyReview(),
    enrichment: null,
  };
  const next = { ...prev, ...patch };
  if (patch.review) {
    next.review = { ...prev.review, ...patch.review };
    for (const k of ["address", "year", "description"]) {
      if (patch.review[k]) {
        next.review[k] = { ...(prev.review?.[k] || {}), ...patch.review[k] };
      }
    }
  }
  map[chcId] = next;
  return next;
}
