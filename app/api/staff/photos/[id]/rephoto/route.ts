import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The then-and-now viewpoint for a photo in the unified table, from the staff Record Edit screen.
// Box-scans record theirs in the Finalize stage (/api/scan/finalize/[chcId]); this is the same
// write for the other side of the table — a cataloged ContentDM photograph — which had no door.
//
//   GET  → { rephoto: RephotoRow | null }     the viewpoint currently recorded, if any
//   POST { rephotoEmbedUrl }                  record it; empty string clears it
//
// ⚠ WRITE, and staff auth is still deferred — so it carries the same local-only gate as the other
// staff writes rather than shipping an open door. That gate IS the auth seam: when auth lands,
// swap the env check for the session check.
function writesEnabled(): boolean {
  return !process.env.VERCEL;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { getRephoto } = await import("@/lib/rephoto-store");
    return NextResponse.json({ rephoto: await getRephoto(params.id) });
  } catch {
    // DB down — the screen should still render, just without a recorded viewpoint.
    return NextResponse.json({ rephoto: null });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!writesEnabled()) {
    return NextResponse.json({ error: "staff writes are local-only until auth lands" }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (typeof body.rephotoEmbedUrl !== "string") {
      return NextResponse.json({ error: "rephotoEmbedUrl (string) required" }, { status: 400 });
    }
    const { setRephoto } = await import("@/lib/rephoto-store");
    const { cleared, bearing } = await setRephoto(params.id, body.rephotoEmbedUrl, {
      source: body.source === "box_scan" ? "box_scan" : "contentdm",
      contentdmUrl: typeof body.contentdmUrl === "string" ? body.contentdmUrl : null,
    });
    return NextResponse.json({ ok: true, id: params.id, cleared, bearing });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
