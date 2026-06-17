import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/staff/photos — the unified box-scan rows for the staff Photos list (read-only).
// Returns [] (not an error) when the DB is unreachable so the static-harvest list still renders.
export async function GET() {
  try {
    const { listBoxScanStaffPhotos } = await import("@/lib/staff-photos");
    return NextResponse.json({ photos: await listBoxScanStaffPhotos() });
  } catch {
    return NextResponse.json({ photos: [] });
  }
}
