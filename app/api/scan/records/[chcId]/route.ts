import { NextResponse } from "next/server";
import { getRecord, upsert, buildEnrichment, type ScanPatch } from "@/lib/scan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/records/:chcId → one record
export async function GET(_req: Request, { params }: { params: { chcId: string } }) {
  const rec = await getRecord(params.chcId);
  return rec ? NextResponse.json(rec) : NextResponse.json({ error: "not found" }, { status: 404 });
}

// POST /api/scan/records/:chcId → merge a review patch (or {accept:true}) → save
export async function POST(req: Request, { params }: { params: { chcId: string } }) {
  let body: { accept?: boolean } & ScanPatch;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const existing = await getRecord(params.chcId);
  if (!existing) return NextResponse.json({ error: "unknown chc_id" }, { status: 404 });

  const { accept, ...patch } = body;
  let updated = await upsert(params.chcId, patch);
  if (accept) {
    updated = await upsert(params.chcId, { enrichment: buildEnrichment(updated) });
  }
  return NextResponse.json(updated);
}
