// DB-backed scan_prep store — the durable per-CHC prep state (auto_ok | flagged | fixed |
// approved), so a crop batch survives a closed laptop. Mirrors lib/scan-store.ts. Shared by
// the Prep API routes and lib/prep-engine.ts. Separate from scan_review by design: Prep's only
// handoff to the Run stage is the masters/<CHC>.tif file it writes, not a shared row.
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scanPrep, type ScanPrepRow } from "@/drizzle/schema";
import type { PrepRecord } from "@/lib/types";

const num = (v: string | null): number | null => (v == null ? null : Number(v));

function rowToPrep(row: ScanPrepRow): PrepRecord {
  return {
    chc_id: row.chcId,
    raw_path: row.rawPath,
    status: (row.status as PrepRecord["status"]) ?? "pending",
    box: row.box ?? null,
    flags: row.flags ?? [],
    raw_w: row.rawW,
    raw_h: row.rawH,
    raw_preview: row.rawPreview,
    crop_preview: row.cropPreview,
    threshold_mult: num(row.thresholdMult) ?? 1,
    area_frac: num(row.areaFrac),
    ms: row.ms,
    master_path: row.masterPath,
    error: row.error,
    created_at: row.createdAt?.toISOString(),
    updated_at: row.updatedAt?.toISOString(),
  };
}

export async function listPrep(): Promise<PrepRecord[]> {
  const rows = await getDb().select().from(scanPrep).orderBy(scanPrep.chcId);
  return rows.map(rowToPrep);
}

export async function getPrep(chcId: string): Promise<PrepRecord | null> {
  const rows = await getDb().select().from(scanPrep).where(eq(scanPrep.chcId, chcId)).limit(1);
  return rows[0] ? rowToPrep(rows[0]) : null;
}

export async function deletePrep(chcId: string): Promise<void> {
  await getDb().delete(scanPrep).where(eq(scanPrep.chcId, chcId));
}

export type PrepPatch = Partial<Omit<PrepRecord, "chc_id" | "created_at" | "updated_at">>;

export async function upsertPrep(chcId: string, patch: PrepPatch): Promise<PrepRecord> {
  const prev = await getPrep(chcId);
  const base: PrepRecord = prev ?? {
    chc_id: chcId,
    raw_path: null,
    status: "pending",
    box: null,
    flags: [],
    raw_w: null,
    raw_h: null,
    raw_preview: null,
    crop_preview: null,
    threshold_mult: 1,
    area_frac: null,
    ms: null,
    master_path: null,
    error: null,
  };
  const next: PrepRecord = { ...base, ...patch, chc_id: chcId };

  const values = {
    chcId: next.chc_id,
    rawPath: next.raw_path,
    status: next.status,
    box: next.box,
    flags: next.flags,
    rawW: next.raw_w,
    rawH: next.raw_h,
    rawPreview: next.raw_preview,
    cropPreview: next.crop_preview,
    // numeric columns take strings; null stays null
    thresholdMult: next.threshold_mult == null ? null : String(next.threshold_mult),
    areaFrac: next.area_frac == null ? null : String(next.area_frac),
    ms: next.ms,
    masterPath: next.master_path,
    error: next.error,
    updatedAt: new Date(),
  };

  await getDb()
    .insert(scanPrep)
    .values(values)
    .onConflictDoUpdate({ target: scanPrep.chcId, set: values });

  return next;
}
