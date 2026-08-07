import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/scan/finalize/[chcId] — two staff writes onto the normalized box-scan row:
//   { lat, lng }          → drop a pin on a geocode miss (geo_source = staff_lookup)
//   { rephotoEmbedUrl }   → record the then-and-now viewpoint (empty string clears it)
// Local-only, same as the rest of the Finalize stage.
export async function POST(req: Request, { params }: { params: { chcId: string } }) {
  const { finalizeEnabled, setPin, setRephoto } = await import("@/lib/finalize-store");
  if (!finalizeEnabled()) {
    return NextResponse.json({ error: "finalize is local-only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (typeof body.rephotoEmbedUrl === "string") {
      const { cleared, bearing } = await setRephoto(params.chcId, body.rephotoEmbedUrl);
      return NextResponse.json({ ok: true, chc_id: params.chcId, cleared, bearing });
    }
    const { lat, lng } = body;
    await setPin(params.chcId, Number(lat), Number(lng));
    return NextResponse.json({ ok: true, chc_id: params.chcId, lat: Number(lat), lng: Number(lng) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
