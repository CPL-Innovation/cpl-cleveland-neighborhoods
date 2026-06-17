import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/finalize — the Finalize worklist (reviewed box-scans + their normalize/pin state).
// Local-only: geocoding reaches the network from a local job, and the surface is a staff tool.
export async function GET() {
  const { finalizeEnabled, listFinalize } = await import("@/lib/finalize-store");
  if (!finalizeEnabled()) {
    return NextResponse.json({ error: "finalize is local-only (it geocodes from a local job)" }, { status: 403 });
  }
  try {
    return NextResponse.json(await listFinalize());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// POST /api/scan/finalize — run the batch: normalize the pending reviewed set into the unified
// Photos table (caption copy · stamp-date parse · geocode). Resumable; already-normalized rows skip.
export async function POST() {
  const { finalizeEnabled, finalizeAll } = await import("@/lib/finalize-store");
  if (!finalizeEnabled()) {
    return NextResponse.json({ error: "finalize is local-only" }, { status: 403 });
  }
  try {
    return NextResponse.json(await finalizeAll());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
