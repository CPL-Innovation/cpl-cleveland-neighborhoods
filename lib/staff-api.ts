// Client fetch wrapper for the staff-side photo routes — the sibling of lib/scan-api.ts
// (scanApi covers the scan pipeline; this covers the unified Photos table).
import type { PhotoSource } from "@/lib/types";
import type { RephotoRow } from "@/lib/rephoto-store";

export const staffApi = {
  /** The then-and-now viewpoint currently recorded for a photo (null = none, or no row yet). */
  async getRephoto(id: string): Promise<RephotoRow | null> {
    const r = await fetch(`/api/staff/photos/${encodeURIComponent(id)}/rephoto`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.rephoto ?? null;
  },

  /** Record (or clear, with "") the viewpoint a librarian framed in Street View. */
  async setRephoto(
    id: string,
    rephotoEmbedUrl: string,
    opts: { source: PhotoSource; contentdmUrl?: string | null },
  ): Promise<{ ok: boolean; cleared: boolean; bearing: number | null }> {
    const r = await fetch(`/api/staff/photos/${encodeURIComponent(id)}/rephoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rephotoEmbedUrl, ...opts }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `rephoto ${r.status}`);
    }
    return r.json();
  },
};
