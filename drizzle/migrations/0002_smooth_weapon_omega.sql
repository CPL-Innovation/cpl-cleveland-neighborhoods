ALTER TABLE "photo_enrichment" ADD COLUMN "facets" jsonb;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "facets_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "facets_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "facets_source" text;