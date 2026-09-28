// The then-and-now viewpoint write, for ANY photo in the unified table.
//
// The viewpoint used to be a box-scan-only fact: `finalize-store.setRephoto` UPDATEd a row the
// Finalize stage had already normalized, so a ContentDM photograph — the great majority of the
// collection — had nowhere to put one. That is the asymmetry this module removes. `photo_enrichment`
// was built as the unified Photos table (surrogate `id` + a `source` discriminator + a nullable
// `contentdmId`); a ContentDM record simply had no row yet because nothing on the staff side ever
// wrote one.
//
// So the two sources differ only in how the row comes to exist:
//   • box_scan  — UPDATE only. The row is the *output* of Finalize (caption/date/coords
//                 normalized); refusing to invent one keeps "was this photo finalized?" honest.
//   • contentdm — UPSERT. The catalog itself stays a static harvest (data/tier3-all/records.json);
//                 the row we create here is enrichment ONLY — identity plus the `rephoto_*`
//                 columns. We deliberately do NOT copy title/date/coords out of the harvest: two
//                 writable copies of a cataloged fact is how they drift apart.
import type { PhotoSource } from "@/lib/types";

export interface RephotoRow {
  id: string;
  source: PhotoSource;
  rephoto_embed_url: string | null;
  rephoto_bearing: number | null;
  rephoto_pitch: number | null;
  rephoto_modern_lat: number | null;
  rephoto_modern_lng: number | null;
}

/** The recorded viewpoint for one photo, or null when the photo has no enrichment row at all. */
export async function getRephoto(id: string): Promise<RephotoRow | null> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await getDb()
    .select({
      id: photoEnrichment.id,
      source: photoEnrichment.source,
      embedUrl: photoEnrichment.rephotoEmbedUrl,
      bearing: photoEnrichment.rephotoBearing,
      pitch: photoEnrichment.rephotoPitch,
      lat: photoEnrichment.rephotoModernLat,
      lng: photoEnrichment.rephotoModernLng,
    })
    .from(photoEnrichment)
    .where(eq(photoEnrichment.id, id))
    .limit(1);
  if (!row) return null;
  const num = (v: string | null) => (v != null ? Number(v) : null);
  return {
    id: row.id,
    source: (row.source as PhotoSource) ?? "contentdm",
    rephoto_embed_url: row.embedUrl,
    rephoto_bearing: num(row.bearing),
    rephoto_pitch: num(row.pitch),
    rephoto_modern_lat: num(row.lat),
    rephoto_modern_lng: num(row.lng),
  };
}

/**
 * Record (or clear, with "") the modern viewpoint a librarian framed by hand in Street View.
 *
 * The pasted URL is kept verbatim AND unpacked into the `rephoto_*` geometry columns
 * (lib/rephoto.ts), so the framing survives as numbers we own if Street View is ever dropped.
 */
export async function setRephoto(
  id: string,
  embedUrl: string,
  opts: { source: PhotoSource; contentdmUrl?: string | null },
): Promise<{ cleared: boolean; bearing: number | null }> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  const db = getDb();

  const clearing = !embedUrl.trim();
  const framing = clearing ? null : (await import("@/lib/rephoto")).parseRephotoEmbed(embedUrl);

  const fields = {
    rephotoEmbedUrl: framing?.embedUrl ?? null,
    rephotoModernLat: framing?.lat != null ? String(framing.lat) : null,
    rephotoModernLng: framing?.lng != null ? String(framing.lng) : null,
    rephotoBearing: framing?.bearing != null ? String(framing.bearing) : null,
    rephotoPitch: framing?.pitch != null ? String(framing.pitch) : null,
    // Eligibility is a *claim about the photo* (can this corner be re-shot?), so a cleared
    // viewpoint leaves it alone rather than retracting the judgement.
    ...(clearing ? {} : { rephotoEligible: true }),
    updatedAt: new Date(),
  };

  if (opts.source === "box_scan") {
    const res = await db
      .update(photoEnrichment)
      .set(fields)
      .where(and(eq(photoEnrichment.id, id), eq(photoEnrichment.source, "box_scan")))
      .returning({ id: photoEnrichment.id });
    if (!res.length) throw new Error(`${id} is not a normalized box-scan — run Finalize first`);
    return { cleared: clearing, bearing: framing?.bearing ?? null };
  }

  // ContentDM. Clearing a viewpoint that was never recorded shouldn't conjure an empty row.
  if (clearing) {
    await db
      .update(photoEnrichment)
      .set(fields)
      .where(and(eq(photoEnrichment.id, id), eq(photoEnrichment.source, "contentdm")));
    return { cleared: true, bearing: null };
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
        // A row that already exists may have been created by something else; don't stomp its
        // identity, but do fill a contentdm_url we didn't have before.
        ...(opts.contentdmUrl ? { contentdmUrl: opts.contentdmUrl } : {}),
      },
    });

  return { cleared: false, bearing: framing?.bearing ?? null };
}
