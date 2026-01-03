CREATE TABLE "item_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"vector" vector(768) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compatibility_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printer_model" text NOT NULL,
	"consumable_mpn" text NOT NULL,
	"is_verified" boolean DEFAULT false,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sku_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"canonical_mpn" text NOT NULL,
	"brand" text,
	"source" text DEFAULT 'inference',
	"confidence" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_catalog_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"last_scraped_at" timestamp,
	"crawl_frequency_hours" integer DEFAULT 24,
	"status" text DEFAULT 'active',
	"error_msg" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trusted_catalog_pages_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"alias_type" text NOT NULL,
	"locale" text DEFAULT 'global',
	"confidence" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"canonical_name" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edge_id" uuid,
	"alias_id" uuid,
	"source_url" text NOT NULL,
	"snippet" text,
	"fetched_at" timestamp DEFAULT now(),
	"confidence" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"agent" text NOT NULL,
	"operation" text,
	"model" text NOT NULL,
	"provider" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"latency_ms" integer,
	"cost_usd" numeric(10, 6),
	"status_code" integer,
	"is_error" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "evidence" CASCADE;--> statement-breakpoint
ALTER TABLE "item_embeddings" ADD CONSTRAINT "item_embeddings_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_from_entity_id_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_to_entity_id_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_evidence" ADD CONSTRAINT "graph_evidence_edge_id_edges_id_fk" FOREIGN KEY ("edge_id") REFERENCES "public"."edges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_evidence" ADD CONSTRAINT "graph_evidence_alias_id_aliases_id_fk" FOREIGN KEY ("alias_id") REFERENCES "public"."aliases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_usage" ADD CONSTRAINT "model_usage_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "item_embeddings" USING hnsw ("vector" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_edge" ON "compatibility_edges" USING btree ("printer_model","consumable_mpn");--> statement-breakpoint
CREATE INDEX "printer_idx" ON "compatibility_edges" USING btree ("printer_model");--> statement-breakpoint
CREATE INDEX "consumable_idx" ON "compatibility_edges" USING btree ("consumable_mpn");--> statement-breakpoint
CREATE UNIQUE INDEX "alias_idx" ON "sku_aliases" USING btree ("alias","brand");--> statement-breakpoint
CREATE INDEX "mpn_idx" ON "sku_aliases" USING btree ("canonical_mpn");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_alias_locale" ON "aliases" USING btree ("alias","locale");--> statement-breakpoint
CREATE INDEX "alias_lookup_idx" ON "aliases" USING btree ("alias");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_graph_edge" ON "edges" USING btree ("from_entity_id","to_entity_id","type");--> statement-breakpoint
CREATE INDEX "edge_from_idx" ON "edges" USING btree ("from_entity_id");--> statement-breakpoint
CREATE INDEX "edge_to_idx" ON "edges" USING btree ("to_entity_id");--> statement-breakpoint
CREATE INDEX "model_usage_job_idx" ON "model_usage" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "model_usage_agent_idx" ON "model_usage" USING btree ("agent");--> statement-breakpoint
CREATE INDEX "model_usage_ts_idx" ON "model_usage" USING btree ("timestamp");