// Finalize stage backend — Tier-1 normalize + unify (tier1-normalize-unify-spec §"Finalize stage").
// The terminal box-scan stage: takes the human-confirmed Tier-1 fields (caption / address / year)
// from the reviewed scan_review records and graduates each into a first-class row in the unified
// photo_enrichment Photos table (source = box_scan), normalizing as it goes:
//   • description → patron_caption           (caption_source = vlm_tier1)
//   • address     → address_raw + lat/lng    (geocode; misses → the staff pin tray)
//   • year (stamp)→ year_raw + date_start     (date_source = archival_stamp — the honesty valve)
//
// DISCIPLINES (from the spec):
//   • Confirmed fields only — runs AFTER review, never on raw VLM output (the Tier-1→Tier-2 firebreak).
//   • A separate pass, not auto-on-accept — keeps the Review surface's <20s click free of geocode latency.
//   • Additive — the raw strings are preserved beside the normalized fields; provenance per field.
//
// Local-only, like the other ingest doors: geocoding reaches the network from a local job, so the
// routes gate on finalizeEnabled() and 403 in serverless.
import type { ScanRecord } from "@/lib/types";
import { ambiguityReason, geocodeAddress, geocodeThrottle, type GeoSource } from "@/lib/geocode";

const CAPTION_SOURCE = "vlm_tier1";
const DATE_SOURCE = "archival_stamp"; // pilot simplification: the stamp = cataloging date, flagged

export function finalizeEnabled(): boolean {
  return !process.env.VERCEL;
}

// ── Tier-1 confirmation (the human-verdict'd values, not raw VLM) ──
function confirmedTier1(rec: ScanRecord): { caption: string; address: string; year: string } {
  const r = rec.review;
  const address =
    r.address?.verdict === "correct" ? rec.vlm?.address ?? ""
    : r.address?.verdict === "edited" ? r.address.value
    : "";
  const year =
    r.year?.verdict === "correct" ? rec.vlm?.year ?? ""
    : r.year?.verdict === "edited" ? r.year.value
    : "";
  const caption =
    r.description?.verdict === "edited" ? r.description.value
    : r.description?.verdict === "accepted" ? rec.vlm?.description ?? ""
    : "";
  return { caption: caption.trim(), address: address.trim(), year: year.trim() };
}

// ── Stamp-date parse (tier1-normalize-unify-spec §"The year decision") ──
// "5-22-62" → 1962-05-22 (full date). Two-digit years are 20th-century (the box spans 1931–75).
// Falls back to a bare 4-digit year → YYYY-01-01. Returns null when no date is legible.
export function parseStampDate(yearRaw: string): { dateStart: string; precision: string } | null {
  const md = /(\d{1,2})-(\d{1,2})-(\d{2,4})/.exec(yearRaw);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    let yr = Number(md[3]);
    if (md[3].length <= 2) yr += 1900; // archival box is pre-2000 — two-digit → 19xx
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && yr >= 1800 && yr <= 2100) {
      const iso = `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { dateStart: iso, precision: "exact" };
    }
  }
  const y4 = /\b(1[89]\d{2}|20\d{2})\b/.exec(yearRaw);
  if (y4) return { dateStart: `${y4[1]}-01-01`, precision: "year" };
  return null;
}

// ── List shape for the Finalize surface ──
export type FinalizeState = "pending" | "finalized" | "needs_pin";
export interface FinalizeRow {
  chc_id: string;
  jpeg_url: string;
  caption: string | null;
  address: string | null; // confirmed Tier-1 address (raw)
  year: string | null; // confirmed Tier-1 year/stamp (raw)
  reviewed: boolean; // Tier-1 reviewed in Ingest
  state: FinalizeState;
  lat: number | null;
  lng: number | null;
  date_start: string | null;
  geo_source: string | null;
  miss_reason: string | null; // why it needs a pin (when state = needs_pin)
}

interface UnifiedRow {
  id: string;
  captionSource: string | null;
  lat: string | null;
  lng: string | null;
  dateStart: string | null;
  geoSource: string | null;
  addressRaw: string | null;
}

async function unifiedBoxScans(): Promise<Map<string, UnifiedRow>> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await getDb()
    .select({
      id: photoEnrichment.id,
      captionSource: photoEnrichment.captionSource,
      lat: photoEnrichment.lat,
      lng: photoEnrichment.lng,
      dateStart: photoEnrichment.dateStart,
      geoSource: photoEnrichment.geoSource,
      addressRaw: photoEnrichment.addressRaw,
    })
    .from(photoEnrichment)
    .where(eq(photoEnrichment.source, "box_scan"));
  return new Map(rows.map((r) => [r.id, r as UnifiedRow]));
}

function deriveState(u: UnifiedRow | undefined): FinalizeState {
  if (!u || !u.captionSource) return "pending"; // normalization hasn't run
  if (u.lat == null || u.lng == null) return "needs_pin"; // normalized but no coordinate
  return "finalized";
}

/** The Finalize worklist: every reviewed box-scan, with its normalize/pin state. */
export async function listFinalize(): Promise<{ rows: FinalizeRow[]; counts: Record<FinalizeState | "reviewed" | "total", number> }> {
  const { listRecords } = await import("@/lib/scan-store");
  const [records, unified] = await Promise.all([listRecords(), unifiedBoxScans()]);
  const reviewed = records.filter((r) => r.review?.status === "reviewed");

  const rows: FinalizeRow[] = reviewed.map((rec) => {
    const { caption, address, year } = confirmedTier1(rec);
    const u = unified.get(rec.chc_id);
    const state = deriveState(u);
    const lat = u?.lat != null ? Number(u.lat) : null;
    const lng = u?.lng != null ? Number(u.lng) : null;
    return {
      chc_id: rec.chc_id,
      jpeg_url: rec.jpeg_url || `/derivatives/${rec.chc_id}.jpg`,
      caption: caption || null,
      address: address || null,
      year: year || null,
      reviewed: true,
      state,
      lat,
      lng,
      date_start: u?.dateStart ?? null,
      geo_source: u?.geoSource ?? null,
      miss_reason: state === "needs_pin" ? (ambiguityReason(address) ?? "geocoder couldn't resolve") : null,
    };
  });

  const counts = {
    total: reviewed.length,
    reviewed: reviewed.length,
    pending: rows.filter((r) => r.state === "pending").length,
    finalized: rows.filter((r) => r.state === "finalized").length,
    needs_pin: rows.filter((r) => r.state === "needs_pin").length,
  } as Record<FinalizeState | "reviewed" | "total", number>;

  return { rows, counts };
}

// ── The Finalize button: batch-normalize the pending reviewed set into the unified table ──
async function writeNormalized(
  rec: ScanRecord,
  geo: { lat: number; lng: number; geoSource: GeoSource; geoConfidence: string } | null
): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { caption, address, year } = confirmedTier1(rec);
  const stamp = year ? parseStampDate(year) : null;
  const set = {
    patronCaption: caption || null,
    captionSource: CAPTION_SOURCE,
    accessibilityAltText: caption || null,
    addressRaw: address || null,
    yearRaw: year || null,
    dateStart: stamp?.dateStart ?? null,
    dateEnd: stamp?.dateStart ?? null,
    datePrecision: stamp?.precision ?? null,
    dateSource: stamp ? DATE_SOURCE : null,
    lat: geo ? String(geo.lat) : null,
    lng: geo ? String(geo.lng) : null,
    geoSource: geo?.geoSource ?? null,
    geoConfidence: geo?.geoConfidence ?? null,
    publicStatus: "draft",
    updatedAt: new Date(),
  };
  await getDb()
    .insert(photoEnrichment)
    .values({ id: rec.chc_id, source: "box_scan", sourceId: rec.chc_id, contentdmId: null, ...set })
    .onConflictDoUpdate({ target: photoEnrichment.id, set });
}

export interface FinalizeRunResult {
  processed: number;
  finalized: number; // got coordinates
  needPins: number; // normalized but geocode missed → staff tray
  skipped: number; // already normalized
}

/** Run the batch over the reviewed set. Resumable: rows already normalized are skipped (no re-geocode). */
export async function finalizeAll(): Promise<FinalizeRunResult> {
  const { listRecords } = await import("@/lib/scan-store");
  const [records, unified] = await Promise.all([listRecords(), unifiedBoxScans()]);
  const reviewed = records.filter((r) => r.review?.status === "reviewed");

  let processed = 0;
  let finalized = 0;
  let needPins = 0;
  let skipped = 0;

  for (const rec of reviewed) {
    if (unified.get(rec.chc_id)?.captionSource) {
      skipped++;
      continue; // already normalized — leave it (pins resolve via setPin, not a re-run)
    }
    const { address } = confirmedTier1(rec);
    const geo = await geocodeAddress(address);
    if (geo.ok) {
      await writeNormalized(rec, { lat: geo.lat, lng: geo.lng, geoSource: geo.geoSource, geoConfidence: geo.geoConfidence });
      finalized++;
    } else {
      await writeNormalized(rec, null);
      needPins++;
    }
    processed++;
    // Only the network provider needs throttling; ambiguous addresses skip the call entirely.
    if (geo.ok || (geo.reason !== "no address" && !ambiguityReason(address))) await geocodeThrottle();
  }
  return { processed, finalized, needPins, skipped };
}

// ── The pin tray: staff drops a coordinate on a geocode miss (geo_source = staff_lookup) ──
export async function setPin(chcId: string, lat: number, lng: number): Promise<void> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("lat/lng must be finite numbers");
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  const res = await getDb()
    .update(photoEnrichment)
    .set({
      lat: String(lat),
      lng: String(lng),
      geoSource: "staff_lookup",
      geoConfidence: "exact",
      updatedAt: new Date(),
    })
    .where(and(eq(photoEnrichment.id, chcId), eq(photoEnrichment.source, "box_scan")))
    .returning({ id: photoEnrichment.id });
  if (!res.length) throw new Error(`${chcId} is not a normalized box-scan — run Finalize first`);
}
