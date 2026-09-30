// Client fetch wrapper for the staff-side photo routes — the sibling of lib/scan-api.ts
// (scanApi covers the scan pipeline; this covers the unified Photos table).
import type { PhotoSource } from "@/lib/types";
import type { RephotoRow } from "@/lib/rephoto-store";
import type { GeoRow, GeoWrite } from "@/lib/geo-store";
import type { GeoResult } from "@/lib/geocode";

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

  /** The coordinate currently on record (null = none, or no enrichment row yet). */
  async getGeo(id: string): Promise<GeoRow | null> {
    const r = await fetch(`/api/staff/photos/${encodeURIComponent(id)}/geo`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.geo ?? null;
  },

  /**
   * Ask the geocoder what a locator string resolves to. Writes NOTHING — the librarian decides.
   * A miss comes back as a GeoMiss with its kind, so the UI can say which of the three happened.
   */
  async suggestGeo(id: string, address: string): Promise<GeoResult> {
    const r = await fetch(`/api/staff/photos/${encodeURIComponent(id)}/geo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suggest", address }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `geo suggest ${r.status}`);
    return d.suggestion as GeoResult;
  },

  /** Commit a coordinate the librarian accepted. */
  async acceptGeo(
    id: string,
    geo: GeoWrite,
    opts: { source: PhotoSource; contentdmUrl?: string | null },
  ): Promise<{ ok: boolean }> {
    const r = await fetch(`/api/staff/photos/${encodeURIComponent(id)}/geo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", ...geo, ...opts }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `geo accept ${r.status}`);
    return d;
  },

  /** Retract a coordinate. */
  async clearGeo(id: string, opts: { source: PhotoSource }): Promise<{ ok: boolean }> {
    const r = await fetch(`/api/staff/photos/${encodeURIComponent(id)}/geo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", ...opts }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `geo clear ${r.status}`);
    return d;
  },
};
