// Client-side fetch wrapper for the scan API (ported from the scanApi object in
// scan-pipeline.jsx). Used by the staff/scan client components.
import type { ScanRecord, AccuracyRollup } from "@/lib/types";
import type { MasterEntry, IngestResult } from "@/lib/scan-ingest";

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
  // Un-ingest: delete the row + derivative (the master TIFF stays).
  async remove(id: string): Promise<{ ok: boolean; chc_id: string }> {
    const r = await fetch(`/api/scan/records/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `delete ${r.status}`);
    }
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
  // ── UI-driven ingest (local-only) ──
  async masters(): Promise<MasterEntry[]> {
    const r = await fetch("/api/scan/masters");
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `masters ${r.status}`);
    }
    const data = await r.json();
    return data.masters as MasterEntry[];
  },
  async ingest(id: string, force = false): Promise<IngestResult> {
    const r = await fetch(`/api/scan/ingest/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    return r.json();
  },
  csvUrl: "/api/scan/accuracy?format=csv",
};
