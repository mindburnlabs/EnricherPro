ALTER TABLE "jobs" ADD COLUMN "sku_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "verified_requires_evidence" CHECK (status != 'verified' OR evidence_id IS NOT NULL);