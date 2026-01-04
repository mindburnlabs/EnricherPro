CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text,
	"evidence_ids" uuid[],
	"before_value" jsonb,
	"after_value" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"claim_ids" uuid[] NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_strategy" text,
	"resolved_claim_id" uuid,
	"resolved_at" timestamp,
	"resolved_by" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"field_value" text NOT NULL,
	"status" text NOT NULL,
	"evidence_id" uuid,
	"confidence_score" numeric,
	"locked_at" timestamp,
	"locked_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"source_type" text NOT NULL,
	"content_snippet" text NOT NULL,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"priority_score" integer DEFAULT 50 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "printer_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"model_name" text NOT NULL,
	"model_aliases" text[],
	"ru_confirmed" boolean DEFAULT false,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "similar_products" (
	"sku_id" uuid NOT NULL,
	"related_sku_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"strength_score" numeric DEFAULT '0.5',
	CONSTRAINT "similar_products_sku_id_related_sku_id_pk" PRIMARY KEY("sku_id","related_sku_id")
);
--> statement-breakpoint
CREATE TABLE "sku_printer_compatibility" (
	"sku_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"evidence_id" uuid,
	"verified" boolean DEFAULT false,
	CONSTRAINT "sku_printer_compatibility_sku_id_printer_id_pk" PRIMARY KEY("sku_id","printer_id")
);
--> statement-breakpoint
CREATE TABLE "sku" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_string" text NOT NULL,
	"mpn" text,
	"brand" text,
	"consumable_type" text,
	"short_alias" text,
	"yield_pages" integer,
	"color" text,
	"chip_presence" boolean,
	"oem_or_compatible" text,
	"package_length_mm" integer,
	"package_width_mm" integer,
	"package_height_mm" integer,
	"package_weight_g" integer,
	"hero_image_url" text,
	"image_qc_status" text,
	"image_qc_failures" jsonb,
	"published_channels" jsonb DEFAULT '[]'::jsonb,
	"blocked_reasons" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_resolved_claim_id_claim_id_fk" FOREIGN KEY ("resolved_claim_id") REFERENCES "public"."claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_products" ADD CONSTRAINT "similar_products_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_products" ADD CONSTRAINT "similar_products_related_sku_id_sku_id_fk" FOREIGN KEY ("related_sku_id") REFERENCES "public"."sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_printer_compatibility" ADD CONSTRAINT "sku_printer_compatibility_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_printer_compatibility" ADD CONSTRAINT "sku_printer_compatibility_printer_id_printer_model_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printer_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_printer_compatibility" ADD CONSTRAINT "sku_printer_compatibility_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_user_ts" ON "audit_log" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_conflict_sku_status" ON "conflict" USING btree ("sku_id","status");--> statement-breakpoint
CREATE INDEX "idx_claim_sku" ON "claim" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "idx_claim_status" ON "claim" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_field_unique" ON "claim" USING btree ("sku_id","field_name","field_value");--> statement-breakpoint
CREATE INDEX "idx_evidence_url" ON "evidence" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "idx_evidence_type_priority" ON "evidence" USING btree ("source_type","priority_score");--> statement-breakpoint
CREATE UNIQUE INDEX "printer_model_unique" ON "printer_model" USING btree ("brand","model_name");--> statement-breakpoint
CREATE INDEX "idx_printer_brand_model" ON "printer_model" USING btree ("brand","model_name");--> statement-breakpoint
CREATE INDEX "idx_similar_from" ON "similar_products" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "idx_compat_printer" ON "sku_printer_compatibility" USING btree ("printer_id");--> statement-breakpoint
CREATE INDEX "idx_sku_mpn" ON "sku" USING btree ("mpn");--> statement-breakpoint
CREATE INDEX "idx_sku_brand" ON "sku" USING btree ("brand");