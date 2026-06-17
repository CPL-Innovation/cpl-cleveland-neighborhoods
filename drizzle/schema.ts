import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import type {
  DeriveMeta, EnrichmentDraft, Review, VlmResult, PrepBox, PrepFlag, Run2Facets,
} from "@/lib/types";

// Prep stage working record (crop & deskew). Keyed by CHC ID, upstream of scan_review:
// Prep reads raw/<CHC>.tif and, on approve, writes the cropped+deskewed masters/<CHC>.tif
// that the Run/ingest pipeline then consumes. Durable so a batch survives a closed laptop.
export const scanPrep = pgTable("scan_prep", {
  chcId: text("chc_id").primaryKey(),
  rawPath: text("raw_path"), // raw/<CHC>.tif (input flatbed scan)
  status: text("status").notNull().default("pending"), // PrepStatus
  box: jsonb("box").$type<PrepBox>(), // crop box in raw full-res pixels
  flags: jsonb("flags").$type<PrepFlag[]>(), // engine flags (clip_top, large_angle, …)
  rawW: integer("raw_w"),
  rawH: integer("raw_h"),
  rawPreview: text("raw_preview"), // /prep/<CHC>.raw.jpg
  cropPreview: text("crop_preview"), // /prep/<CHC>.crop.jpg
  thresholdMult: numeric("threshold_mult"), // variance-threshold knob used (looser/tighter)
  areaFrac: numeric("area_frac"), // largest-component area fraction (detection confidence)
  ms: integer("ms"), // last engine wall-clock — the throughput stat
  masterPath: text("master_path"), // masters/<CHC>.tif once approved
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// The per-photo working record. Separate from photo_enrichment until accept.
// Verdicts ARE the eval (see technical/scan-pipeline-ux.md).
export const scanReview = pgTable("scan_review", {
  chcId: text("chc_id").primaryKey(),
  masterPath: text("master_path"),
  jpegUrl: text("jpeg_url"), // Supabase Storage public URL (what the review UI loads)
  jpegPath: text("jpeg_path"), // local derivative path (CLI bookkeeping)
  derive: jsonb("derive").$type<DeriveMeta>(),
  vlm: jsonb("vlm").$type<VlmResult>(),
  status: text("status").notNull().default("discovered"),
  error: text("error"),
  review: jsonb("review").$type<Review>(),
  enrichment: jsonb("enrichment").$type<EnrichmentDraft>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 1:1 with a PHOTO — a ContentDM record OR a box-scan (thin identity model, tier1-normalize-unify
// slice). Full field list from build/data-backend/enrichment-schema.md. Controlled-vocab FKs are
// plain text for now (vocab tables deferred).
//
// Identity (tier1-normalize-unify-spec §"Part B"): a SURROGATE PK (`id`) so box-scans and ContentDM
// records share one table; a `source` discriminator (`contentdm | box_scan`); `sourceId` = the
// natural key within that source (CHC ID for box-scans, the doc id for ContentDM); and a nullable
// `contentdmId` (null for box-scans — the slot exists so one could be linked if ever cataloged).
// No reconciliation machinery — box ingestion is pilot-only.
export const photoEnrichment = pgTable("photo_enrichment", {
  id: text("id").primaryKey(), // surrogate PK: CHC ID for box-scans, contentdm doc id for ContentDM
  source: text("source").notNull().default("contentdm"), // contentdm | box_scan
  sourceId: text("source_id"), // natural key within source (CHC ID for box-scans)
  contentdmId: text("contentdm_id"), // nullable — null for box-scans
  contentdmUrl: text("contentdm_url"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  sourceRecordHash: text("source_record_hash"),
  enrichmentVersion: integer("enrichment_version").default(1),
  // Normalized Tier-1 strings (tier1-normalize-unify-spec §"Part A" — additive, never lossy: the
  // raw transcription is kept beside the normalized field, and *_source records provenance).
  addressRaw: text("address_raw"), // the confirmed Tier-1 address string (archival evidence)
  yearRaw: text("year_raw"), // the confirmed Tier-1 year/stamp string
  captionSource: text("caption_source"), // e.g. "vlm_tier1"
  dateSource: text("date_source"), // e.g. "archival_stamp" (the honesty valve for the pilot)
  // Geo
  lat: numeric("lat"),
  lng: numeric("lng"),
  geoConfidence: text("geo_confidence"),
  geoSource: text("geo_source"),
  neighborhoodTag: text("neighborhood_tag"),
  secondaryNeighborhoodTag: text("secondary_neighborhood_tag"),
  branchServiceArea: text("branch_service_area"),
  // Time
  dateStart: date("date_start"),
  dateEnd: date("date_end"),
  datePrecision: text("date_precision"),
  dateDisplay: text("date_display"),
  // Interpretive
  patronCaption: text("patron_caption"),
  librarianNote: text("librarian_note"),
  librarianNoteAuthor: text("librarian_note_author"),
  librarianNoteUpdatedAt: timestamp("librarian_note_updated_at", { withTimezone: true }),
  storyHook: text("story_hook"),
  // Curation
  publicStatus: text("public_status").default("draft"),
  featuredWeight: integer("featured_weight"),
  themes: text("themes").array(),
  // Then-and-now
  rephotoEligible: boolean("rephoto_eligible"),
  rephotoBearing: numeric("rephoto_bearing"),
  rephotoModernLat: numeric("rephoto_modern_lat"),
  rephotoModernLng: numeric("rephoto_modern_lng"),
  rephotoNotes: text("rephoto_notes"),
  // Quality
  captionQuality: text("caption_quality"),
  metadataGapFlags: text("metadata_gap_flags").array(),
  accessibilityAltText: text("accessibility_alt_text"),
  // Rights
  rightsDisplay: text("rights_display"),
  rightsNotes: text("rights_notes"),
  reuseCleared: boolean("reuse_cleared"),
  // Physical
  physicalLocation: text("physical_location"),
  requestScanEligible: boolean("request_scan_eligible"),
  // Tier 1.5 visible facets — Stage 0 production write (staff-approved, A/B-cleared via the
  // facet-review surface). The enforced Run 2 schema (Run2Facets) stored whole as JSONB; the
  // provenance columns record who graduated it and under which schema/model version.
  facets: jsonb("facets").$type<Run2Facets>(),
  facetsReviewedAt: timestamp("facets_reviewed_at", { withTimezone: true }),
  facetsReviewedBy: text("facets_reviewed_by"),
  facetsSource: text("facets_source"), // e.g. "tier1.5_run2_gemini-3.1-pro_v0.5"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type ScanReviewRow = typeof scanReview.$inferSelect;
export type ScanReviewInsert = typeof scanReview.$inferInsert;
export type ScanPrepRow = typeof scanPrep.$inferSelect;
export type ScanPrepInsert = typeof scanPrep.$inferInsert;
