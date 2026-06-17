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
