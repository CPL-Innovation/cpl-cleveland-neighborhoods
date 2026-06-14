CREATE TABLE IF NOT EXISTS "scan_prep" (
	"chc_id" text PRIMARY KEY NOT NULL,
	"raw_path" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"box" jsonb,
	"flags" jsonb,
	"raw_w" integer,
	"raw_h" integer,
	"raw_preview" text,
	"crop_preview" text,
	"threshold_mult" numeric,
	"area_frac" numeric,
	"ms" integer,
	"master_path" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
