// Staff read of the unified Photos table — the box-scan side (tier1-normalize-unify slice).
// The staff Photos list historically renders the static ContentDM harvest snapshot; this read
// surfaces the box-scan rows now living in photo_enrichment (source = box_scan) so the unified
// table actually shows up as one collection in the staff UI. Read-only; local DB.
import type { Run2Facets } from "@/lib/types";

const year4 = (s: string | null): number | null => {
  const m = /\d{4}/.exec(s || "");
  return m ? Number(m[0]) : null;
};

export interface BoxScanStaffPhoto {
  chc_id: string;
  jpeg_url: string;
  address: string | null;
  caption: string | null;
  year: number | null;
  lat: number | null;
  lng: number | null;
  public_status: string | null;
  has_alt: boolean;
  building_type: string | null;
}

/** The unified box-scan photos for the staff Photos list. Empty if the DB is unreachable. */
export async function listBoxScanStaffPhotos(): Promise<BoxScanStaffPhoto[]> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await getDb()
    .select({
      id: photoEnrichment.id,
      addressRaw: photoEnrichment.addressRaw,
      patronCaption: photoEnrichment.patronCaption,
      dateStart: photoEnrichment.dateStart,
      yearRaw: photoEnrichment.yearRaw,
      lat: photoEnrichment.lat,
      lng: photoEnrichment.lng,
      publicStatus: photoEnrichment.publicStatus,
      alt: photoEnrichment.accessibilityAltText,
      facets: photoEnrichment.facets,
    })
    .from(photoEnrichment)
    .where(eq(photoEnrichment.source, "box_scan"));

  return rows
    .map((r) => ({
      chc_id: r.id,
      jpeg_url: `/derivatives/${r.id}.jpg`,
      address: r.addressRaw,
      caption: r.patronCaption,
      year: year4(r.dateStart) ?? year4(r.yearRaw),
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
      public_status: r.publicStatus,
      has_alt: !!r.alt,
      building_type: (r.facets as Run2Facets | null)?.building_type ?? null,
    }))
    .sort((a, b) => a.chc_id.localeCompare(b.chc_id));
}

/**
 * The live geo overlay for the ContentDM half of the list.
 *
 * The staff Photos list builds its ContentDM rows from the static harvest, which is right — the
 * catalog is a snapshot and stays one. But a coordinate a librarian looks up on Record Edit is
 * enrichment, written to photo_enrichment, and the harvest will never know about it. Without
 * this read the librarian does the work and the GEO column still says "missing", which reads as
 * "the button didn't do anything" — the failure the whole feature exists to avoid.
 *
 * Same shape as the patron side's `/api/patron/enrichment`: a thin overlay joined onto the
 * static catalog by ContentDM id, carrying only what enrichment owns. Nothing cataloged is
 * duplicated here.
 */
export interface ContentdmGeoOverlay {
  contentdm_id: string;
  lat: number;
  lng: number;
  geo_source: string | null;
  geo_confidence: string | null;
}

export async function listContentdmGeoOverlay(): Promise<ContentdmGeoOverlay[]> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { and, eq, isNotNull } = await import("drizzle-orm");
  const rows = await getDb()
    .select({
      id: photoEnrichment.id,
      contentdmId: photoEnrichment.contentdmId,
      lat: photoEnrichment.lat,
      lng: photoEnrichment.lng,
      geoSource: photoEnrichment.geoSource,
      geoConfidence: photoEnrichment.geoConfidence,
    })
    .from(photoEnrichment)
    .where(and(eq(photoEnrichment.source, "contentdm"), isNotNull(photoEnrichment.lat)));

  return rows
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      contentdm_id: String(r.contentdmId ?? r.id),
      lat: Number(r.lat),
      lng: Number(r.lng),
      geo_source: r.geoSource,
      geo_confidence: r.geoConfidence,
    }));
}
