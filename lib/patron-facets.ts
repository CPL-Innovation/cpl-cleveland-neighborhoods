// Patron convergence slice — the LIVE read of the enrichment store (convergence-slice-spec
// §"Data contract"). Returns the graduated 99 faceted photos for "browse by what's in the
// picture." This is the real Tier-2→Tier-3 enrichment→patron data path, not a static export.
//
// READ-ONLY BY CONSTRUCTION: this module only ever SELECTs. There is no write path from the
// patron surface (the enrichment write stays staff-tool-only). The public-read hardening
// (dedicated read-only role / RLS / rate-limiting) is deferred to host-on-commit — built right
// locally (pure reads), hardened when the patron surface is committed to deployment.
//
// Join: facets come from photo_enrichment (graduated Stage 0); caption/year/address/jpeg come
// from the box-scan's Tier-1 record (scan_review), both keyed by CHC ID. Joined in JS to avoid
// JSONB-extraction SQL.
import type { FacetPhoto, Run2Facets, ScanRecord } from "@/lib/types";

const year4 = (s: string | undefined | null): number | null => {
  const m = /\d{4}/.exec(s || "");
  return m ? Number(m[0]) : null;
};

// Caption/year/address as confirmed by the Tier-1 review (or the raw VLM read as fallback).
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
    .select({ id: photoEnrichment.contentdmId, facets: photoEnrichment.facets })
    .from(photoEnrichment)
    .where(isNotNull(photoEnrichment.facetsReviewedAt));

  // Box-scan Tier-1 records, indexed for the join.
  const recs = new Map<string, ScanRecord>();
  try {
    for (const r of await listRecords()) recs.set(r.chc_id, r);
  } catch {
    /* DB read of scan_review failed — captions/addresses just come back null */
  }

  return enriched
    .filter((e) => e.facets)
    .map((e) => {
      const rec = recs.get(e.id);
      const { caption, address, year } = tier1Fields(rec);
      return {
        chc_id: e.id,
        jpeg_url: rec?.jpeg_url || `/derivatives/${e.id}.jpg`,
        year,
        address,
        caption,
        facets: e.facets as Run2Facets,
      };
    })
    .sort((a, b) => a.chc_id.localeCompare(b.chc_id));
}
