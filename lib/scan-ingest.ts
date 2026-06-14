// Shared ingest core — one master TIFF → derive (sharp) → store JPEG → VLM read → upsert the
// scan_review row. Drives BOTH the local CLI (scan/run.ts) and the UI-driven ingest API, so the
// pipeline logic lives in exactly one place.
//
// DERIVATION IS LOCAL-ONLY: `deriveOne` runs `sharp` against a local TIFF on disk. The API
// routes that call this gate on `ingestEnabled()` and refuse in serverless deploys — matching
// the project rule that serverless never derives (it only re-runs the VLM via /api/scan/retry).
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { discoverMasters, deriveOne, type Master } from "@/scan/derive";
import { getRecord, upsert, listRecords } from "@/lib/scan-store";
import { uploadDerivative } from "@/lib/storage";
import { vlmExtract } from "@/lib/vlm-extract";
import type { ScanRecord } from "@/lib/types";

// Folder of original box-scan TIFFs (overridable; default matches the CLI's --in default).
// Lives under scans/ alongside the Prep input (scans/raw/) — both are large, local-only inputs.
export const MASTERS_DIR = process.env.SCAN_MASTERS_DIR || "scans/masters";

// Absolute masters/ path from the process root. process.cwd() is the project root under both
// `next dev` and the `tsx` CLI — reliable where derive.ts's import.meta-based REPO_ROOT is not
// once bundled by Next, so the API path resolves the folder this way.
export function mastersDirAbs(): string {
  return resolve(process.cwd(), MASTERS_DIR);
}

// Ingest is a local job (sharp reads a local TIFF). Allow everywhere except serverless deploys.
export function ingestEnabled(): boolean {
  return !process.env.VERCEL;
}

export interface IngestResult {
  chc_id: string;
  ok: boolean;
  skipped?: boolean;
  stage?: string;
  reason?: string;
  stub?: boolean;
  status: ScanRecord["status"];
}

// The pipeline for a single master. Ported verbatim from scan/run.ts's processOne so the CLI
// and the API stay identical; `masterRel` lets the CLI record a custom --in path.
export async function ingestOne(
  m: Master,
  opts: { force?: boolean; masterRel?: string } = {}
): Promise<IngestResult> {
  const masterRel = opts.masterRel ?? `${MASTERS_DIR}/${m.file}`;
  const jpegRel = `derivatives/${m.chcId}.jpg`;

  const existing = await getRecord(m.chcId);
  if (!opts.force && existing?.status === "ready") {
    return { chc_id: m.chcId, ok: true, skipped: true, status: "ready" };
  }

  // 1. Derive (sharp) → JPEG bytes.
  let jpeg: Buffer;
  let derive;
  try {
    ({ jpeg, meta: derive } = await deriveOne(m.path));
  } catch (err) {
    await upsert(m.chcId, {
      master_path: masterRel,
      derive: { status: "failed", reason: (err as Error).message },
      status: "failed",
      error: `derive: ${(err as Error).message}`,
    });
    return { chc_id: m.chcId, ok: false, stage: "derive", reason: (err as Error).message, status: "failed" };
  }

  // 2. Upload to the derivative store.
  let jpegUrl: string;
  try {
    jpegUrl = await uploadDerivative(m.chcId, jpeg);
  } catch (err) {
    await upsert(m.chcId, {
      master_path: masterRel, jpeg_path: jpegRel, derive,
      status: "failed", error: `upload: ${(err as Error).message}`,
    });
    return { chc_id: m.chcId, ok: false, stage: "upload", reason: (err as Error).message, status: "failed" };
  }

  // 3. VLM read.
  try {
    const vlm = await vlmExtract(jpeg, m.chcId);
    await upsert(m.chcId, {
      master_path: masterRel, jpeg_path: jpegRel, jpeg_url: jpegUrl, derive, vlm,
      status: "ready", error: null,
    });
    return { chc_id: m.chcId, ok: true, stub: vlm._stub === true, status: "ready" };
  } catch (err) {
    await upsert(m.chcId, {
      master_path: masterRel, jpeg_path: jpegRel, jpeg_url: jpegUrl, derive,
      status: "failed", error: `vlm: ${(err as Error).message}`,
    });
    return { chc_id: m.chcId, ok: false, stage: "vlm", reason: (err as Error).message, status: "failed" };
  }
}

export interface MasterEntry {
  file: string;
  chc_id: string;
  size: number;
  status: ScanRecord["status"] | "new"; // pipeline status, or "new" when no DB row exists yet
}

// List masters/ and cross-reference the DB so the UI can flag new vs. already-ingested.
export async function listMasters(): Promise<MasterEntry[]> {
  const masters = discoverMasters(mastersDirAbs());
  const existing = await listRecords();
  const byId = new Map(existing.map((r) => [r.chc_id, r] as const));
  return masters.map((m) => {
    let size = 0;
    try { size = statSync(m.path).size; } catch { /* file vanished mid-list — report 0 */ }
    const rec = byId.get(m.chcId);
    return { file: m.file, chc_id: m.chcId, size, status: rec ? rec.status : "new" };
  });
}

// Ingest a single master by id (the UI ingests one at a time for live per-photo progress).
export async function ingestById(chcId: string, opts: { force?: boolean } = {}): Promise<IngestResult> {
  const m = discoverMasters(mastersDirAbs()).find((x) => x.chcId === chcId);
  if (!m) {
    return { chc_id: chcId, ok: false, stage: "discover", reason: "no master TIFF found in masters/", status: "failed" };
  }
  return ingestOne(m, opts);
}
