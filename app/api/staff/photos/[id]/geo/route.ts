import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The coordinate for a photo in the unified table, from the staff Record Edit screen.
//
//   GET                              → { geo: GeoRow | null }
//   POST { action: "suggest", … }    → { suggestion: GeoResult }   geocode only, NOTHING written
//   POST { action: "accept",  … }    → { ok: true }                write the coordinate
//   POST { action: "clear" }         → { ok: true, cleared: true }
//
// ⚠ Suggest and accept are deliberately two calls, not one. A geocoder that wrote on success
// would make the librarian's judgement a formality — they'd be reviewing a decision already
// taken. The suggestion is inert until a person sends it back, and what comes back carries the
// `geoSource` the lookup earned, so an `inferred` named-place hit can't be filed as a verified
// address by a client that forgot the difference.
//
// WRITE + staff auth still deferred → the same local-only gate as the other staff writes. That
// gate IS the auth seam: swap the env check for the session check when auth lands.
function writesEnabled(): boolean {
  return !process.env.VERCEL;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { getGeo } = await import("@/lib/geo-store");
    return NextResponse.json({ geo: await getGeo(params.id) });
  } catch {
    // DB down — the screen still renders, just without a recorded coordinate.
    return NextResponse.json({ geo: null });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!writesEnabled()) {
    return NextResponse.json({ error: "staff writes are local-only until auth lands" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "suggest") {
      if (typeof body.address !== "string" || !body.address.trim()) {
        return NextResponse.json({ error: "address (non-empty string) required" }, { status: 400 });
      }
      const { suggestGeocode } = await import("@/lib/geocode");
      const suggestion = await suggestGeocode(body.address, {
        allowWithoutNumber: body.allowWithoutNumber !== false,
      });
      return NextResponse.json({ suggestion });
    }

    const source = body.source === "box_scan" ? "box_scan" : "contentdm";
    const contentdmUrl = typeof body.contentdmUrl === "string" ? body.contentdmUrl : null;
    const { setGeo } = await import("@/lib/geo-store");

    if (action === "clear") {
      const { cleared } = await setGeo(params.id, null, { source, contentdmUrl });
      return NextResponse.json({ ok: true, id: params.id, cleared });
    }

    if (action === "accept") {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ error: "lat/lng (numbers) required" }, { status: 400 });
      }
      const allowed = ["verified_address", "staff_lookup", "inferred"] as const;
      const geoSource = allowed.includes(body.geoSource) ? body.geoSource : "staff_lookup";
      await setGeo(
        params.id,
        {
          lat,
          lng,
          addressRaw: typeof body.addressRaw === "string" ? body.addressRaw.trim() : "",
          geoSource,
          geoConfidence: typeof body.geoConfidence === "string" ? body.geoConfidence : "block",
        },
        { source, contentdmUrl },
      );
      return NextResponse.json({ ok: true, id: params.id, cleared: false });
    }

    return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
