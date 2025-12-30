CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"field_path" text NOT NULL,
	"raw_snippet" text,
	"source_url" text NOT NULL,
	"confidence" integer,
	"is_selected" boolean DEFAULT false,
	"extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"mpn" text,
	"brand" text,
	"model" text,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"review_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"input_raw" text NOT NULL,
	"progress" integer DEFAULT 0,
	"start_time" timestamp DEFAULT now(),
	"end_time" timestamp,
	"meta" jsonb
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;