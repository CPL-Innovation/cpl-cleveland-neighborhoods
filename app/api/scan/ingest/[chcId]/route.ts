import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // derive + Gemini read can take a while

// POST /api/scan/ingest/:chcId — derive → store → VLM → upsert one master from masters/.
// The UI calls this once per selected photo for live per-photo progress. Body: { force?: bool }.
// Local-only (sharp derivation never runs in serverless) — mirrors the local CLI's per-master step.
export async function POST(req: Request, { params }: { params: { chcId: string } }) {
  const { ingestEnabled, ingestById } = await import("@/lib/scan-ingest");
  if (!ingestEnabled()) {
    return NextResponse.json(
      { error: "ingest is local-only — run `npm run scan:run` from a local checkout instead" },
      { status: 403 }
    );
  }
  let force = false;
  try {
    const body = await req.json();
    force = Boolean(body?.force);
  } catch {
    // no/invalid body → default force=false
  }
  const result = await ingestById(params.chcId, { force });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
