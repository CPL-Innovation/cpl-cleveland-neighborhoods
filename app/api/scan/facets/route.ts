import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/facets — the Run 2 facet-review worklist (eval artifact + staged corrections +
// baseline captions). Local-only: the eval artifact lives on local disk, never served from a deploy.
export async function GET() {
  const { facetReviewEnabled, artifactExists, listFacetReview } = await import("@/lib/facet-review-store");
  if (!facetReviewEnabled()) {
    return NextResponse.json(
      { error: "facet review is local-only — the Run 2 eval artifact is not served in deploys" },
      { status: 403 }
    );
  }
  if (!artifactExists()) {
    return NextResponse.json(
      { error: "no Run 2 artifact yet — run `npm run scan:run2` to produce data/scan/facets-run2.json" },
      { status: 404 }
    );
  }
  try {
    return NextResponse.json({ rows: await listFacetReview() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
