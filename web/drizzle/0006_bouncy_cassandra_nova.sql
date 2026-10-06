ALTER TABLE "jobs" ADD COLUMN "campaign_id" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "idempotency_key" varchar(128);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "priority" smallint DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_idempotency_key_unique" UNIQUE("tenant_id","idempotency_key");