import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/scan/facets/[chcId] — save a staff facet correction / verdict to the STAGING file.
// Production-write firebreak: this never writes photo_enrichment or scan_review. Local-only.
export async function POST(req: Request, { params }: { params: { chcId: string } }) {
  const { facetReviewEnabled, saveFacetReview } = await import("@/lib/facet-review-store");
  if (!facetReviewEnabled()) {
    return NextResponse.json({ error: "facet review is local-only" }, { status: 403 });
  }
  try {
    const patch = await req.json();
    const entry = await saveFacetReview(params.chcId, patch);
    return NextResponse.json(entry);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
