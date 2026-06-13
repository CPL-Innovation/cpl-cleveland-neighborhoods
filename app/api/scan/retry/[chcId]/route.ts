import { NextResponse } from "next/server";
import { getRecord, upsert } from "@/lib/scan-store";
import { fetchDerivativeBytes } from "@/lib/storage";
import { vlmExtract } from "@/lib/vlm-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Gemini call can take a while; allow up to the Vercel limit

// POST /api/scan/retry/:chcId — re-run the VLM against the JPEG already in Storage.
// (Derivation is a local CLI step; serverless retry only re-runs extraction.)
export async function POST(_req: Request, { params }: { params: { chcId: string } }) {
  const rec = await getRecord(params.chcId);
  if (!rec) return NextResponse.json({ error: "unknown chc_id" }, { status: 404 });
  if (!rec.jpeg_url) {
    return NextResponse.json(
      { error: "no derivative in storage — run `node scan/run.mjs --only " + params.chcId + "` locally first" },
      { status: 400 }
    );
  }
  try {
    const bytes = await fetchDerivativeBytes(rec.jpeg_url);
    const vlm = await vlmExtract(bytes, params.chcId);
    const updated = await upsert(params.chcId, { vlm, status: "ready", error: null });
    return NextResponse.json({ code: 0, record: updated });
  } catch (err) {
    const message = (err as Error).message;
    const updated = await upsert(params.chcId, { status: "failed", error: `vlm: ${message}` });
    return NextResponse.json({ code: 1, record: updated, log: message }, { status: 500 });
  }
}
