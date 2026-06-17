import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/scan/finalize/[chcId] — staff drops a pin on a geocode miss ({ lat, lng }).
// Sets geo_source = staff_lookup on the already-normalized unified box-scan row. Local-only.
export async function POST(req: Request, { params }: { params: { chcId: string } }) {
  const { finalizeEnabled, setPin } = await import("@/lib/finalize-store");
  if (!finalizeEnabled()) {
    return NextResponse.json({ error: "finalize is local-only" }, { status: 403 });
  }
  try {
    const { lat, lng } = await req.json();
    await setPin(params.chcId, Number(lat), Number(lng));
    return NextResponse.json({ ok: true, chc_id: params.chcId, lat: Number(lat), lng: Number(lng) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
