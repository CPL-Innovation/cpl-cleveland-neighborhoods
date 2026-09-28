ALTER TABLE "photo_enrichment" ADD COLUMN "geo_miss_reason" text;--> statement-breakpoint
ALTER TABLE "photo_enrichment" ADD COLUMN "geo_miss_at" timestamp with time zone;