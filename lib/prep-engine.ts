// Prep engine (Node side) — drives scan/crop_engine.py as a subprocess: derive a crop box
// from raw/<CHC>.tif, render previews, and on approve write the lossless masters/<CHC>.tif.
//
// LOCAL-ONLY, exactly like the ingest doors (lib/scan-ingest.ts): the CV work runs `python3`
// against a local TIFF on disk, so the API routes that call this gate on `prepEnabled()` and
// 403 in serverless. masters/ is the boundary to the Run stage — Prep only ever *writes* it.
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { resolve, join } from "node:path";
import { promisify } from "node:util";
import { discoverMasters } from "@/scan/derive";
import { MASTERS_DIR } from "@/lib/scan-ingest";
import { listPrep, getPrep, upsertPrep } from "@/lib/prep-store";
import type { PrepRecord, PrepBox, PrepStatus, RawEntry } from "@/lib/types";

const execFileP = promisify(execFile);

// Raw flatbed scans live here (overridable), upstream of scans/masters/. Gitignored.
export const RAW_DIR = process.env.SCAN_RAW_DIR || "scans/raw";
const PYTHON_BIN = process.env.PREP_PYTHON || "python3";
const ENGINE = "scan/crop_engine.py";
const PREVIEW_WEB_DIR = "prep"; // public/prep → served at /prep/<chc>.{raw,crop}.jpg

export function prepEnabled(): boolean {
  return !process.env.VERCEL;
}

export function rawDirAbs(): string {
  return resolve(process.cwd(), RAW_DIR);
}
function mastersDirAbs(): string {
  return resolve(process.cwd(), MASTERS_DIR);
}
function previewDirAbs(): string {
  return resolve(process.cwd(), "public", PREVIEW_WEB_DIR);
}

interface EngineResult {
  ok: boolean;
  error?: string;
  box?: PrepBox;
  flags?: string[];
  raw_w?: number;
  raw_h?: number;
  area_frac?: number | null;
  ms?: number;
  threshold_mult?: number;
  out_w?: number;
  out_h?: number;
}

// One subprocess round-trip: JSON request on argv[1] → JSON response on stdout.
async function runEngine(req: Record<string, unknown>): Promise<EngineResult> {
  try {
    const { stdout } = await execFileP(PYTHON_BIN, [resolve(process.cwd(), ENGINE), JSON.stringify(req)], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return JSON.parse(stdout.trim().split("\n").pop() || "{}") as EngineResult;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// auto_ok when the engine is confident; flagged when any heuristic fired (clip_top, etc.).
function statusFromFlags(flags: string[]): PrepStatus {
  return flags.length ? "flagged" : "auto_ok";
}

function findRaw(chcId: string) {
  return discoverMasters(rawDirAbs()).find((m) => m.chcId === chcId) || null;
}

function previewPaths(chcId: string) {
  return {
    rawAbs: join(previewDirAbs(), `${chcId}.raw.jpg`),
    cropAbs: join(previewDirAbs(), `${chcId}.crop.jpg`),
    rawWeb: `/${PREVIEW_WEB_DIR}/${chcId}.raw.jpg`,
    cropWeb: `/${PREVIEW_WEB_DIR}/${chcId}.crop.jpg`,
  };
}

// List raw/ and cross-reference prep state so the grid can flag new vs. processed.
export async function listRaw(): Promise<RawEntry[]> {
  const raws = discoverMasters(rawDirAbs());
  const prep = await listPrep();
  const byId = new Map(prep.map((p) => [p.chc_id, p] as const));
  return raws.map((m) => {
    let size = 0;
    try { size = statSync(m.path).size; } catch { /* vanished mid-list */ }
    const p = byId.get(m.chcId);
    return {
      file: m.file,
      chc_id: m.chcId,
      size,
      status: p ? p.status : "new",
      flags: p?.flags ?? [],
      raw_preview: p?.raw_preview ?? null,
      crop_preview: p?.crop_preview ?? null,
      box: p?.box ?? null,
      raw_w: p?.raw_w ?? null,
      raw_h: p?.raw_h ?? null,
    };
  });
}

// Auto-detect (or re-detect looser/tighter): texture crop + both previews. Never advances a
// row that a human already fixed/approved unless re-run explicitly (the caller decides).
export async function autoCropOne(chcId: string, thresholdMult = 1): Promise<PrepRecord> {
  const m = findRaw(chcId);
  if (!m) {
    return upsertPrep(chcId, { status: "pending", error: "no raw TIFF found in raw/" });
  }
  await mkdir(previewDirAbs(), { recursive: true });
  const pv = previewPaths(chcId);
  const r = await runEngine({
    mode: "auto",
    raw_path: m.path,
    chc_id: chcId,
    raw_preview_path: pv.rawAbs,
    crop_preview_path: pv.cropAbs,
    threshold_mult: thresholdMult,
  });
  if (!r.ok) {
    return upsertPrep(chcId, { raw_path: `${RAW_DIR}/${m.file}`, status: "pending", error: r.error || "engine failed" });
  }
  return upsertPrep(chcId, {
    raw_path: `${RAW_DIR}/${m.file}`,
    status: statusFromFlags(r.flags || []),
    box: r.box ?? null,
    flags: r.flags ?? [],
    raw_w: r.raw_w ?? null,
    raw_h: r.raw_h ?? null,
    raw_preview: pv.rawWeb,
    crop_preview: pv.cropWeb,
    threshold_mult: r.threshold_mult ?? thresholdMult,
    area_frac: r.area_frac ?? null,
    ms: r.ms ?? null,
    master_path: null, // a re-crop invalidates any previously written master
    error: null,
  });
}

// Re-render from a human-supplied box (a hand fix) → status "fixed". Just re-renders the crop
// preview; no re-detection. The box arrives in raw full-res pixels from the editor.
export async function recropOne(chcId: string, box: PrepBox): Promise<PrepRecord> {
  const m = findRaw(chcId);
  if (!m) return upsertPrep(chcId, { status: "pending", error: "no raw TIFF found in raw/" });
  await mkdir(previewDirAbs(), { recursive: true });
  const pv = previewPaths(chcId);
  const r = await runEngine({
    mode: "recrop",
    raw_path: m.path,
    chc_id: chcId,
    box,
    raw_preview_path: pv.rawAbs,
    crop_preview_path: pv.cropAbs,
  });
  if (!r.ok) return upsertPrep(chcId, { error: r.error || "engine failed" });
  return upsertPrep(chcId, {
    raw_path: `${RAW_DIR}/${m.file}`,
    status: "fixed",
    box,
    raw_w: r.raw_w ?? null,
    raw_h: r.raw_h ?? null,
    raw_preview: pv.rawWeb,
    crop_preview: pv.cropWeb,
    ms: r.ms ?? null,
    master_path: null,
    error: null,
  });
}

// Approve → write the lossless cropped+deskewed masters/<CHC>.tif from the stored box.
export async function applyOne(chcId: string): Promise<{ ok: boolean; record: PrepRecord; error?: string }> {
  const prep = await getPrep(chcId);
  const m = findRaw(chcId);
  if (!prep?.box || !m) {
    const record = await upsertPrep(chcId, { error: "nothing to apply — run auto-crop first" });
    return { ok: false, record, error: record.error || "no box" };
  }
  await mkdir(mastersDirAbs(), { recursive: true });
  const masterRel = `${MASTERS_DIR}/${chcId}.tif`;
  const r = await runEngine({
    mode: "apply",
    raw_path: m.path,
    chc_id: chcId,
    box: prep.box,
    master_path: join(mastersDirAbs(), `${chcId}.tif`),
  });
  if (!r.ok) {
    const record = await upsertPrep(chcId, { error: r.error || "apply failed" });
    return { ok: false, record, error: record.error || "apply failed" };
  }
  const record = await upsertPrep(chcId, { status: "approved", master_path: masterRel, ms: r.ms ?? prep.ms, error: null });
  return { ok: true, record };
}
