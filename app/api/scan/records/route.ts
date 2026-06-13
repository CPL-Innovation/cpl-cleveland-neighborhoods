import { NextResponse } from "next/server";
import { listRecords } from "@/lib/scan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/records → all records (array)
export async function GET() {
  const records = await listRecords();
  return NextResponse.json(records);
}
