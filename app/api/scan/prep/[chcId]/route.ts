import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // OpenCV on a full-res master can take a few seconds

// POST /api/scan/prep/:chcId — one crop-engine action on one raw scan. Body:
//   { action: "auto",   thresholdMult?: number }  detect (or re-detect looser/tighter)
//   { action: "recrop", box: PrepBox }            re-render from a hand-fixed box → "fixed"
//   { action: "apply" }                           write masters/<chc>.tif → "approved"
// Local-only (python3 + OpenCV never run in serverless), mirroring /api/scan/ingest.
export async function POST(req: Request, { params }: { params: { chcId: string } }) {
  const { prepEnabled, autoCropOne, recropOne, applyOne } = await import("@/lib/prep-engine");
  if (!prepEnabled()) {
    return NextResponse.json(
      { error: "prep is local-only — run it from a local checkout instead" },
      { status: 403 }
    );
  }
  let body: { action?: string; box?: unknown; thresholdMult?: number } = {};
  try { body = await req.json(); } catch { /* default below */ }

  const { chcId } = params;
  try {
    if (body.action === "apply") {
      const r = await applyOne(chcId);
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    if (body.action === "recrop") {
      const box = body.box as import("@/lib/types").PrepBox | undefined;
      if (!box) return NextResponse.json({ error: "recrop needs a box" }, { status: 400 });
      const record = await recropOne(chcId, box);
      return NextResponse.json({ ok: !record.error, record });
    }
    // default: auto
    const record = await autoCropOne(chcId, body.thresholdMult ?? 1);
    return NextResponse.json({ ok: !record.error, record });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
