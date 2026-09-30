import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/staff/photos — the live half of the staff Photos list (read-only).
//
//   photos    the unified box-scan rows
//   geo       a thin coordinate overlay for the ContentDM rows, joined onto the static harvest
//             by ContentDM id — so a coordinate a librarian just looked up actually clears the
//             GEO column instead of the list still reporting the harvest's "missing".
//
// Returns empty arrays (not an error) when the DB is unreachable, so the static-harvest list
// still renders.
export async function GET() {
  try {
    const { listBoxScanStaffPhotos, listContentdmGeoOverlay } = await import("@/lib/staff-photos");
    const [photos, geo] = await Promise.all([listBoxScanStaffPhotos(), listContentdmGeoOverlay()]);
    return NextResponse.json({ photos, geo });
  } catch {
    return NextResponse.json({ photos: [], geo: [] });
  }
}
