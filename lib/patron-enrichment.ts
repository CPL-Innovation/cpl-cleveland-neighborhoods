// Patron read of the enrichment overlay for HARVESTED ContentDM photographs.
//
// The unification promise ("box-scans and ContentDM records share one Photos table") reached the
// staff Photos list first; on the patron side it stopped at the box-scans, because the only live
// patron read was /api/patron/facets — the graduated 99. A cataloged photograph could therefore
// never show anything a librarian had enriched. This is the other half: the catalog stays a static
// harvest (data/tier3-all/records.json, fetched by the landing), and this read layers the live
// enrichment on top of it, joined client-side on the ContentDM id.
//
// READ-ONLY BY CONSTRUCTION, like lib/patron-facets.ts: this module only ever SELECTs, and it
// returns only fields meant for the public — today the then-and-now viewpoint. Public-read
// hardening (read-only role / RLS / rate-limit) is deferred to host-on-commit.
import type { PatronEnrichment } from "@/lib/types";

/**
 * The patron-visible enrichment for cataloged photos. Only rows that actually carry something
 * (a recorded viewpoint) come back — this is an overlay, not a second catalog. Empty array if the
 * DB is unreachable, so the map still renders off the static harvest alone.
 */
export async function listPatronEnrichment(): Promise<PatronEnrichment[]> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { and, eq, isNotNull } = await import("drizzle-orm");

  const rows = await getDb()
    .select({
      id: photoEnrichment.id,
      contentdmId: photoEnrichment.contentdmId,
      embedUrl: photoEnrichment.rephotoEmbedUrl,
      bearing: photoEnrichment.rephotoBearing,
    })
    .from(photoEnrichment)
    .where(and(eq(photoEnrichment.source, "contentdm"), isNotNull(photoEnrichment.rephotoEmbedUrl)));

  return rows.map((r) => ({
    // `id` IS the ContentDM doc id for this source (the surrogate PK convention), but prefer the
    // explicit column when it's populated — that's the one the identity model calls authoritative.
    contentdm_id: r.contentdmId ?? r.id,
    rephoto_embed_url: r.embedUrl,
    rephoto_bearing: r.bearing != null ? Number(r.bearing) : null,
  }));
}
