// Client-side fetch wrapper for the scan API (ported from the scanApi object in
// scan-pipeline.jsx). Used by the staff/scan client components.
import type { ScanRecord, AccuracyRollup } from "@/lib/types";

export const scanApi = {
  async list(): Promise<ScanRecord[]> {
    const r = await fetch("/api/scan/records");
    if (!r.ok) throw new Error(`records ${r.status}`);
    return r.json();
  },
  async get(id: string): Promise<ScanRecord> {
    const r = await fetch(`/api/scan/records/${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(`record ${r.status}`);
    return r.json();
  },
  async patch(id: string, patch: unknown): Promise<ScanRecord> {
    const r = await fetch(`/api/scan/records/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`save ${r.status}`);
    return r.json();
  },
  async accuracy(): Promise<AccuracyRollup> {
    const r = await fetch("/api/scan/accuracy");
    if (!r.ok) throw new Error(`accuracy ${r.status}`);
    return r.json();
  },
  async retry(id: string): Promise<{ code: number; record: ScanRecord | null; log?: string }> {
    const r = await fetch(`/api/scan/retry/${encodeURIComponent(id)}`, { method: "POST" });
    return r.json();
  },
  csvUrl: "/api/scan/accuracy?format=csv",
};
