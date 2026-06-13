import { NextResponse } from "next/server";
import { listRecords } from "@/lib/scan-store";
import { computeAccuracy, toCSV } from "@/lib/accuracy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/accuracy[?format=csv]
export async function GET(req: Request) {
  const records = await listRecords();
  const format = new URL(req.url).searchParams.get("format");
  if (format === "csv") {
    return new NextResponse(toCSV(records), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="accuracy.csv"',
      },
    });
  }
  return NextResponse.json(computeAccuracy(records));
}
