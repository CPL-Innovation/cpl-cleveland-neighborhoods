// Client-side fetch wrapper for the Prep API (crop & deskew). Mirrors lib/scan-api.ts.
// Used by components/scan/prep.tsx and prep-editor.tsx.
import type { PrepRecord, PrepBox, RawEntry } from "@/lib/types";

async function postAction(
  id: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; record?: PrepRecord; error?: string }> {
  const r = await fetch(`/api/scan/prep/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export const prepApi = {
  // List raw/ + prep state (local-only; throws with the server's message on 403/500).
  async raws(): Promise<RawEntry[]> {
    const r = await fetch("/api/scan/prep");
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `prep ${r.status}`);
    }
    return (await r.json()).raws as RawEntry[];
  },
  // Auto-detect, or re-detect looser/tighter (thresholdMult < 1 looser, > 1 tighter).
  auto(id: string, thresholdMult = 1) {
    return postAction(id, { action: "auto", thresholdMult });
  },
  // Re-render from a hand-fixed crop box → status "fixed".
  recrop(id: string, box: PrepBox) {
    return postAction(id, { action: "recrop", box });
  },
  // Approve → write the lossless masters/<chc>.tif → status "approved".
  apply(id: string) {
    return postAction(id, { action: "apply" });
  },
};
