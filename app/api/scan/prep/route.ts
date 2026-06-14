import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/prep — list the local raw/ folder, cross-referenced with prep state.
// Local-only: the crop engine (python3 + OpenCV) runs against a local TIFF, so this 403s in
// serverless — matching the ingest doors. The heavy module is imported lazily.
export async function GET() {
  const { prepEnabled, listRaw, RAW_DIR } = await import("@/lib/prep-engine");
  if (!prepEnabled()) {
    return NextResponse.json(
      { error: "prep is local-only — crop/deskew does not run in serverless deploys" },
      { status: 403 }
    );
  }
  try {
    const raws = await listRaw();
    return NextResponse.json({ raws, dir: RAW_DIR });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
