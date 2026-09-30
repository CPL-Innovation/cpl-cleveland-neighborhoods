// The coordinate write for ANY photo in the unified table — the sibling of lib/rephoto-store.ts.
//
// Until now a coordinate could only be *derived*, by the Finalize batch, and only for box-scans
// (lib/finalize-store.ts). A cataloged ContentDM photograph with no geo had nowhere to put one:
// the harvest is read-only and the staff Record Edit screen's "Location & geo" panel was
// scaffolding — a drawn map and an input that saved nothing.
//
// ⚠ This does NOT make the catalog writable. A coordinate a librarian looked up is enrichment,
// not a cataloged fact: nobody at ContentDM recorded it, we did. So it lands in `photo_enrichment`
// beside the then-and-now viewpoint, carrying `geo_source` to say who decided it, and the harvest
// (data/tier3-all/records.json) stays exactly as harvested. The patron side already prefers the
// enrichment row where one exists, so a looked-up pin reaches the map without the catalog moving.
//
// The two sources differ only in how the row comes to exist, for the same reasons as rephoto:
//   • box_scan  — UPDATE only. The row is Finalize's output; inventing one would make
//                 "has this been finalized?" a lie.
//   • contentdm — UPSERT. Identity plus the geo columns, nothing copied out of the harvest.
import type { PhotoSource } from "@/lib/types";
import type { GeoSource } from "@/lib/geocode";

export interface GeoRow {
  id: string;
  source: PhotoSource;
  lat: number | null;
  lng: number | null;
  address_raw: string | null;
  geo_source: string | null;
  geo_confidence: string | null;
  geo_miss_reason: string | null;
}

/** The coordinate currently on record, or null when the photo has no enrichment row at all. */
export async function getGeo(id: string): Promise<GeoRow | null> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await getDb()
    .select({
      id: photoEnrichment.id,
      source: photoEnrichment.source,
      lat: photoEnrichment.lat,
      lng: photoEnrichment.lng,
      addressRaw: photoEnrichment.addressRaw,
      geoSource: photoEnrichment.geoSource,
      geoConfidence: photoEnrichment.geoConfidence,
      geoMissReason: photoEnrichment.geoMissReason,
    })
    .from(photoEnrichment)
    .where(eq(photoEnrichment.id, id))
    .limit(1);
  if (!row) return null;
  const num = (v: string | null) => (v != null ? Number(v) : null);
  return {
    id: row.id,
    source: (row.source as PhotoSource) ?? "contentdm",
    lat: num(row.lat),
    lng: num(row.lng),
    address_raw: row.addressRaw,
    geo_source: row.geoSource,
    geo_confidence: row.geoConfidence,
    geo_miss_reason: row.geoMissReason,
  };
}

export interface GeoWrite {
  lat: number;
  lng: number;
  /** The locator string the librarian actually accepted — kept verbatim as the evidence. */
  addressRaw: string;
  geoSource: GeoSource;
  geoConfidence: string;
}

/**
 * Record (or clear, with null) the coordinate for one photo.
 *
 * `geoSource` is the whole point of the column and is never inferred here — the caller passes
 * what actually happened. A gazetteer hit on a full street address is `verified_address`; a hit
 * on a named place with no house number is `inferred`; a coordinate a librarian typed or dropped
 * is `staff_lookup`. Writing a coordinate also clears any `geo_miss_reason`, because the miss is
 * now answered — leaving it would park a resolved photo in the Finalize pin tray forever.
 */
export async function setGeo(
  id: string,
  geo: GeoWrite | null,
  opts: { source: PhotoSource; contentdmUrl?: string | null },
): Promise<{ cleared: boolean }> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  const db = getDb();

  const clearing = geo == null;
  if (geo && (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lng))) {
    throw new Error("lat/lng must be finite numbers");
  }
  if (geo && (geo.lat < -90 || geo.lat > 90 || geo.lng < -180 || geo.lng > 180)) {
    throw new Error("lat/lng out of range");
  }

  const fields = {
    lat: geo ? String(geo.lat) : null,
    lng: geo ? String(geo.lng) : null,
    geoSource: geo?.geoSource ?? null,
    geoConfidence: geo?.geoConfidence ?? null,
    // The miss is answered either way: a written pin resolves it, and a cleared pin means the
    // librarian retracted a coordinate rather than that the geocoder failed.
    geoMissReason: null,
    geoMissAt: null,
    // Only ever fill the address when we have one; clearing a coordinate must not erase the
    // cataloger's string, which is archival evidence and not ours to delete.
    ...(geo?.addressRaw ? { addressRaw: geo.addressRaw } : {}),
    updatedAt: new Date(),
  };

  if (opts.source === "box_scan") {
    const res = await db
      .update(photoEnrichment)
      .set(fields)
      .where(and(eq(photoEnrichment.id, id), eq(photoEnrichment.source, "box_scan")))
      .returning({ id: photoEnrichment.id });
    if (!res.length) throw new Error(`${id} is not a normalized box-scan — run Finalize first`);
    return { cleared: clearing };
  }

  // ContentDM. Clearing a coordinate on a photo that never had an enrichment row shouldn't
  // conjure an empty one.
  if (clearing) {
    await db
      .update(photoEnrichment)
      .set(fields)
      .where(and(eq(photoEnrichment.id, id), eq(photoEnrichment.source, "contentdm")));
    return { cleared: true };
  }

  await db
    .insert(photoEnrichment)
    .values({
      id,
      source: "contentdm",
      sourceId: id,
      contentdmId: id,
      contentdmUrl: opts.contentdmUrl ?? null,
      ...fields,
    })
    .onConflictDoUpdate({
      target: photoEnrichment.id,
      set: {
        ...fields,
        ...(opts.contentdmUrl ? { contentdmUrl: opts.contentdmUrl } : {}),
      },
    });

  return { cleared: false };
}
