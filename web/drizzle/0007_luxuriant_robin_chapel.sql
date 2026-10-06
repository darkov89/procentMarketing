CREATE TABLE "stats_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_id" integer,
	"date" date NOT NULL,
	"metric" varchar(64) NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stats_daily_tenant_campaign_date_metric_key" UNIQUE NULLS NOT DISTINCT("tenant_id","campaign_id","date","metric")
);
--> statement-breakpoint
ALTER TABLE "stats_daily" ADD CONSTRAINT "stats_daily_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_daily" ADD CONSTRAINT "stats_daily_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;