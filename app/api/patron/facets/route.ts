import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patron/facets — the convergence slice's LIVE read of the enrichment store: the
// graduated 99 faceted photos for "browse by what's in the picture" (convergence-slice-spec).
// Read-only; the patron surface never writes. Public-read hardening (read-only role / RLS /
// rate-limiting) is deferred to host-on-commit — see lib/patron-facets.ts.
export async function GET() {
  const { listFacetPhotos } = await import("@/lib/patron-facets");
  try {
    return NextResponse.json({ photos: await listFacetPhotos() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
