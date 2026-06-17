-- Tier-1 normalize + unify (tier1-normalize-unify-spec): photo_enrichment gains a surrogate PK
-- (`id`) + a `source` discriminator so box-scans and ContentDM records share one table, plus the
-- normalized Tier-1 fields (raw strings kept beside, provenance per field).
--
-- Hand-ordered (drizzle's auto-diff can't sequence the PK swap + data backfill): add columns
-- nullable, backfill id/source from the existing Stage-0 box-scan rows, drop the old PK (so
-- contentdm_id can be made nullable + nulled for box-scans), then install the new PK on id.
ALTER TABLE "photo_enrichment" ADD COLUMN "id" text;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "source" text DEFAULT 'contentdm' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "address_raw" text;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "year_raw" text;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "caption_source" text;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "date_source" text;--> statement-breakpoint
-- Existing rows are all Stage-0 box-scan facet graduations (keyed by CHC ID in contentdm_id).
-- Carry that CHC ID into the surrogate PK + source_id and mark them box_scan.
UPDATE "photo_enrichment" SET "id" = "contentdm_id", "source" = 'box_scan', "source_id" = "contentdm_id";--> statement-breakpoint
-- Drop the old PK first (a PK column can't have NOT NULL dropped), then null contentdm_id for box-scans.
ALTER TABLE "photo_enrichment" DROP CONSTRAINT "photo_enrichment_pkey";--> statement-breakpoint
ALTER TABLE "photo_enrichment" ALTER COLUMN "contentdm_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "photo_enrichment" SET "contentdm_id" = NULL WHERE "source" = 'box_scan';--> statement-breakpoint
ALTER TABLE "photo_enrichment" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD CONSTRAINT "photo_enrichment_pkey" PRIMARY KEY ("id");
