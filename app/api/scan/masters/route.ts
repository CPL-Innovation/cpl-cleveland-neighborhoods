import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/masters — list the local masters/ folder, flagging new vs. already-ingested.
// Local-only: derivation (and therefore ingest) never runs in serverless. The heavy module is
// dynamically imported so `sharp` stays out of the hot path until the route actually runs.
export async function GET() {
  const { ingestEnabled, listMasters, MASTERS_DIR } = await import("@/lib/scan-ingest");
  if (!ingestEnabled()) {
    return NextResponse.json(
      { error: "ingest is local-only — derivation does not run in serverless deploys" },
      { status: 403 }
    );
  }
  try {
    const masters = await listMasters();
    return NextResponse.json({ masters, dir: MASTERS_DIR });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
