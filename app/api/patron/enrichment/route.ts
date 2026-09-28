import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patron/enrichment — the live, read-only enrichment overlay for HARVESTED ContentDM
// photographs (lib/patron-enrichment.ts). The catalog stays a static harvest; this is what staff
// have added on top of it — today the then-and-now viewpoint — joined on the ContentDM id.
//
// Returns [] (not an error) when the DB is unreachable: the map must still render from the
// static harvest alone, exactly like /api/staff/photos.
export async function GET() {
  try {
    const { listPatronEnrichment } = await import("@/lib/patron-enrichment");
    return NextResponse.json({ photos: await listPatronEnrichment() });
  } catch {
    return NextResponse.json({ photos: [] });
  }
}
