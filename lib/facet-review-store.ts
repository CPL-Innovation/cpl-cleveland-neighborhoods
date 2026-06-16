// Facet review store — Tier 1.5 Run 2, Piece B backend (the A/B review instrument).
// Canonical intent: build/enrichment-app/facet-review-ux.md §"Staff review surface" +
// vlm-facet-spec.md §"Then Piece B (scoring)".
//
// PRODUCTION-WRITE FIREBREAK (the load-bearing rule): this store reads the eval artifact
// (data/scan/facets-run2.json) and writes staff corrections to a SEPARATE staging file
// (data/scan/facets-run2-review.json) — it NEVER touches photo_enrichment or scan_review.
// Tier 1 is validated/shipped; Tier 1.5 is on trial until the A/B clears. The baseline Tier-1
// `description` is read (best-effort, read-only) from scan_review purely so the reviewer can
// judge "value over the caption" (scoring Q1) side by side.
//
// Local-only, like the ingest/prep doors — the eval artifact lives on local disk, so the routes
// gate on facetReviewEnabled() and 403 in serverless.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { Run2Facets } from "@/lib/types";
import { RUN2_MODEL } from "@/lib/vlm-run2";

// Provenance stamped on every graduated facet record (Stage 0 — vlm-facet-spec v0.5).
const FACETS_SOURCE = `tier1.5_run2_${RUN2_MODEL}_v0.5`;

const ARTIFACT = resolve(process.cwd(), "data/scan/facets-run2.json"); // VLM output (read-only here)
const STAGING = resolve(process.cwd(), "data/scan/facets-run2-review.json"); // staff corrections

// A staged review of one photo's facets. `corrected` is null until a human edits — the UI then
// seeds its form from `vlm` and persists the edited copy here as the emerging ground truth.
export interface FacetReviewEntry {
  reviewed: boolean;
  corrected: Run2Facets | null;
  notes: string;
  updated_at: string;
}
type Staging = Record<string, FacetReviewEntry>;

// What the review surface consumes per photo: the image, the raw VLM facets, the staged
// correction/verdict, and the baseline caption for the A/B comparison.
export interface FacetReviewRow {
  chc_id: string;
  jpeg_url: string;
  vlm: Run2Facets;
  reviewed: boolean;
  corrected: Run2Facets | null;
  notes: string;
  baseline_description: string | null;
  updated_at: string | null;
  graduated: boolean; // facets written to the production photo_enrichment store (Stage 0)
}

// Local-only: the eval artifact is on local disk, never web-served from a deploy.
export function facetReviewEnabled(): boolean {
  return !process.env.VERCEL;
}

export function artifactExists(): boolean {
  return existsSync(ARTIFACT);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function readArtifact(): Promise<Record<string, Run2Facets>> {
  return readJson<Record<string, Run2Facets>>(ARTIFACT, {});
}

async function readStaging(): Promise<Staging> {
  return readJson<Staging>(STAGING, {});
}

async function writeStaging(s: Staging): Promise<void> {
  await mkdir(dirname(STAGING), { recursive: true });
  await writeFile(STAGING, JSON.stringify(s, null, 2));
}

// Baseline Tier-1 captions, keyed by CHC ID. Best-effort: if the DB is down or empty (the
// artifact is independent of Postgres), the review surface still works with null captions.
async function baselineCaptions(): Promise<Map<string, string>> {
  try {
    const { listRecords } = await import("@/lib/scan-store");
    const records = await listRecords();
    const map = new Map<string, string>();
    for (const r of records) {
      const cap = r.review?.description?.value || r.vlm?.description || "";
      if (cap) map.set(r.chc_id, cap);
    }
    return map;
  } catch {
    return new Map();
  }
}

// Which CHC IDs already have facets in the production store (best-effort; empty if DB is down).
async function graduatedSet(): Promise<Set<string>> {
  try {
    const { getDb } = await import("@/lib/db");
    const { photoEnrichment } = await import("@/drizzle/schema");
    const { isNotNull } = await import("drizzle-orm");
    const rows = await getDb()
      .select({ id: photoEnrichment.contentdmId })
      .from(photoEnrichment)
      .where(isNotNull(photoEnrichment.facetsReviewedAt));
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

export async function listFacetReview(): Promise<FacetReviewRow[]> {
  const [artifact, staging, captions, graduated] = await Promise.all([
    readArtifact(),
    readStaging(),
    baselineCaptions(),
    graduatedSet(),
  ]);
  return Object.keys(artifact)
    .sort()
    .map((chc_id) => {
      const s = staging[chc_id];
      return {
        chc_id,
        jpeg_url: `/derivatives/${chc_id}.jpg`,
        vlm: artifact[chc_id],
        reviewed: s?.reviewed ?? false,
        corrected: s?.corrected ?? null,
        notes: s?.notes ?? "",
        baseline_description: captions.get(chc_id) ?? null,
        updated_at: s?.updated_at ?? null,
        graduated: graduated.has(chc_id),
      };
    });
}

// ── Stage 0 production write (vlm-facet-spec v0.5 §"Stage 0 — graduate the validated 99") ──
// Writes a staff-approved facet record to the production photo_enrichment store, keyed by CHC ID
// (= contentdm_id for box-scans). Scoped by construction to the validated 99 — the only records
// the artifact (and therefore this surface) knows about. Sets only the facet columns + provenance,
// leaving any other enrichment fields untouched. This is the firebreak lifting, Stage 0 only.
async function graduateFacets(chcId: string, facets: Run2Facets, reviewedBy: string): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const set = {
    facets,
    facetsReviewedAt: new Date(),
    facetsReviewedBy: reviewedBy,
    facetsSource: FACETS_SOURCE,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(photoEnrichment)
    .values({ contentdmId: chcId, ...set })
    .onConflictDoUpdate({ target: photoEnrichment.contentdmId, set });
}

// Un-graduate: clear only the facet columns (leave any other enrichment intact).
async function ungraduateFacets(chcId: string): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const { photoEnrichment } = await import("@/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await getDb()
    .update(photoEnrichment)
    .set({ facets: null, facetsReviewedAt: null, facetsReviewedBy: null, facetsSource: null, updatedAt: new Date() })
    .where(eq(photoEnrichment.contentdmId, chcId));
}

export interface FacetReviewPatch {
  corrected?: Run2Facets | null;
  reviewed?: boolean;
  notes?: string;
  reviewedBy?: string;
}

export async function saveFacetReview(chcId: string, patch: FacetReviewPatch): Promise<FacetReviewEntry> {
  const artifact = await readArtifact();
  if (!(chcId in artifact)) {
    throw new Error(`no facet record for ${chcId} in the Run 2 artifact`);
  }
  const staging = await readStaging();
  const prev: FacetReviewEntry = staging[chcId] ?? {
    reviewed: false,
    corrected: null,
    notes: "",
    updated_at: "",
  };
  const next: FacetReviewEntry = {
    reviewed: patch.reviewed ?? prev.reviewed,
    corrected: patch.corrected !== undefined ? patch.corrected : prev.corrected,
    notes: patch.notes !== undefined ? patch.notes : prev.notes,
    updated_at: new Date().toISOString(),
  };
  staging[chcId] = next;
  await writeStaging(staging);

  // Stage 0 production write: reviewed = approved = graduate the staff-approved facets to
  // photo_enrichment; un-reviewing removes them. The approved set is the corrected facets
  // (or the raw VLM record if the reviewer accepted it unchanged).
  if (next.reviewed) {
    await graduateFacets(chcId, next.corrected ?? artifact[chcId], patch.reviewedBy || "staff");
  } else if (prev.reviewed) {
    await ungraduateFacets(chcId);
  }
  return next;
}
