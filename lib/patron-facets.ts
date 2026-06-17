// Patron convergence slice — the LIVE read of the enrichment store (convergence-slice-spec
// §"Data contract"). Returns the graduated 99 faceted photos for "browse by what's in the
// picture." This is the real Tier-2→Tier-3 enrichment→patron data path, not a static export.
//
// READ-ONLY BY CONSTRUCTION: this module only ever SELECTs. There is no write path from the
// patron surface (the enrichment write stays staff-tool-only). The public-read hardening
// (dedicated read-only role / RLS / rate-limiting) is deferred to host-on-commit — built right
// locally (pure reads), hardened when the patron surface is committed to deployment.
//
// After the tier1-normalize-unify slice, caption/year/address/coords are normalized ONTO the
// unified photo_enrichment row (the two-table join collapses to a single read). This module reads
// those normalized fields directly; for graduated-but-not-yet-finalized photos it falls back to the
// box-scan's Tier-1 record (scan_review), keyed by the surrogate id = CHC ID.
import type { FacetPhoto, Run2Facets, ScanRecord } from "@/lib/types";

const year4 = (s: string | undefined | null): number | null => {
  const m = /\d{4}/.exec(s || "");
  return m ? Number(m[0]) : null;
};

// Fallback caption/year/address from the Tier-1 review (used only before Finalize normalizes them).
function tier1Fields(rec: ScanRecord | undefined) {
  const r = rec?.review;
  const caption =
    r?.description?.verdict === "edited" ? r.description.value
    : r?.description?.value || rec?.vlm?.description || "";
  const address =
    r?.address?.verdict === "edited" ? r.address.value
    : r?.address?.value || rec?.vlm?.address || "";
  const year = year4(r?.year?.value) ?? year4(rec?.vlm?.year);
  return { caption: caption || null, address: address || null, year };
}

/** The graduated faceted photos (read-only). Empty array if the DB is unreachable or none graduated. */
export async function listFacetPhotos(): Promise<FacetPhoto[]> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { isNotNull } = await import("drizzle-orm");
  const { listRecords } = await import("@/lib/scan-store");

  const enriched = await getDb()
    .select({
      id: photoEnrichment.id,
      facets: photoEnrichment.facets,
      patronCaption: photoEnrichment.patronCaption,
      addressRaw: photoEnrichment.addressRaw,
      dateStart: photoEnrichment.dateStart,
      yearRaw: photoEnrichment.yearRaw,
      captionSource: photoEnrichment.captionSource,
      lat: photoEnrichment.lat,
      lng: photoEnrichment.lng,
    })
    .from(photoEnrichment)
    .where(isNotNull(photoEnrichment.facetsReviewedAt));

  // Box-scan Tier-1 records — only needed as a fallback for not-yet-finalized photos.
  const needFallback = enriched.some((e) => !e.captionSource);
  const recs = new Map<string, ScanRecord>();
  if (needFallback) {
    try {
      for (const r of await listRecords()) recs.set(r.chc_id, r);
    } catch {
      /* DB read of scan_review failed — captions/addresses just come back null */
    }
  }

  return enriched
    .filter((e) => e.facets)
    .map((e) => {
      // Prefer the normalized (Finalize) fields; fall back to the raw Tier-1 review otherwise.
      let caption = e.patronCaption;
      let address = e.addressRaw;
      let year = year4(e.dateStart) ?? year4(e.yearRaw);
      if (!e.captionSource) {
        const t1 = tier1Fields(recs.get(e.id));
        caption = caption ?? t1.caption;
        address = address ?? t1.address;
        year = year ?? t1.year;
      }
      return {
        chc_id: e.id,
        jpeg_url: recs.get(e.id)?.jpeg_url || `/derivatives/${e.id}.jpg`,
        year,
        address,
        caption,
        lat: e.lat != null ? Number(e.lat) : null,
        lng: e.lng != null ? Number(e.lng) : null,
        facets: e.facets as Run2Facets,
      };
    })
    .sort((a, b) => a.chc_id.localeCompare(b.chc_id));
}
