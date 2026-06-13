// DB-backed scan_review store — replaces scan/store.mjs file I/O. Shared by the Next API
// routes and the local scan CLI. Maps Drizzle rows ↔ ScanRecord and preserves the
// deep-merge-on-review semantics of the old upsert().
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scanReview, type ScanReviewRow } from "@/drizzle/schema";
import { emptyReview, type ScanRecord, type Review, type EnrichmentDraft } from "@/lib/types";

function rowToRecord(row: ScanReviewRow): ScanRecord {
  return {
    chc_id: row.chcId,
    master_path: row.masterPath,
    jpeg_url: row.jpegUrl,
    jpeg_path: row.jpegPath,
    derive: row.derive ?? null,
    vlm: row.vlm ?? null,
    status: (row.status as ScanRecord["status"]) ?? "discovered",
    error: row.error,
    review: row.review ?? emptyReview(),
    enrichment: row.enrichment ?? null,
    created_at: row.createdAt?.toISOString(),
    updated_at: row.updatedAt?.toISOString(),
  };
}

export async function listRecords(): Promise<ScanRecord[]> {
  const rows = await getDb().select().from(scanReview).orderBy(scanReview.chcId);
  return rows.map(rowToRecord);
}

export async function getRecord(chcId: string): Promise<ScanRecord | null> {
  const rows = await getDb().select().from(scanReview).where(eq(scanReview.chcId, chcId)).limit(1);
  return rows[0] ? rowToRecord(rows[0]) : null;
}

// Patch shape: any top-level ScanRecord fields. `review` is deep-merged one level so a
// partial review patch (e.g. just the address verdict) preserves the rest of the review.
export type ScanPatch = Partial<Omit<ScanRecord, "chc_id" | "created_at" | "updated_at">>;

export async function upsert(chcId: string, patch: ScanPatch): Promise<ScanRecord> {
  const prev = await getRecord(chcId);
  const base: ScanRecord = prev ?? {
    chc_id: chcId,
    master_path: null,
    jpeg_url: null,
    jpeg_path: null,
    derive: null,
    vlm: null,
    status: "discovered",
    error: null,
    review: emptyReview(),
    enrichment: null,
  };

  const next: ScanRecord = { ...base, ...patch, chc_id: chcId };
  if (patch.review) {
    const prevReview = base.review;
    next.review = { ...prevReview, ...patch.review } as Review;
    for (const k of ["address", "year", "description"] as const) {
      if (patch.review[k]) {
        next.review[k] = { ...(prevReview[k] as object), ...(patch.review[k] as object) } as never;
      }
    }
  }

  const values = {
    chcId: next.chc_id,
    masterPath: next.master_path,
    jpegUrl: next.jpeg_url,
    jpegPath: next.jpeg_path,
    derive: next.derive,
    vlm: next.vlm,
    status: next.status,
    error: next.error,
    review: next.review,
    enrichment: next.enrichment,
    updatedAt: new Date(),
  };

  await getDb()
    .insert(scanReview)
    .values(values)
    .onConflictDoUpdate({ target: scanReview.chcId, set: values });

  return next;
}

// photo_enrichment-shaped fields built from confirmed review values (ported from
// scan/server.mjs). NO geocoding in this pilot — store the clean address string only.
export function buildEnrichment(rec: ScanRecord): EnrichmentDraft {
  const r = rec.review;
  const confirmedAddress =
    r.address?.verdict === "correct" ? rec.vlm?.address ?? ""
    : r.address?.verdict === "edited" ? r.address.value
    : "";
  const confirmedYear =
    r.year?.verdict === "correct" ? rec.vlm?.year ?? ""
    : r.year?.verdict === "edited" ? r.year.value
    : "";
  const desc =
    r.description?.verdict === "edited" ? r.description.value
    : r.description?.verdict === "accepted" ? rec.vlm?.description ?? ""
    : "";
  const yr = /\d{4}/.exec(confirmedYear || "")?.[0] || null;
  return {
    patron_caption: desc || null,
    accessibility_alt_text: desc || null,
    date_start: yr,
    date_end: yr,
    date_precision: yr ? "year" : null,
    address: confirmedAddress || null,
    lat: null,
    lng: null,
    neighborhood_tag: null,
    caption_quality: "auto_only",
    public_status: "draft",
    record_key: rec.chc_id,
  };
}
