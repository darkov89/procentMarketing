CREATE TABLE "lead_field_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"field" varchar(64) NOT NULL,
	"value" jsonb NOT NULL,
	"source" varchar(100) NOT NULL,
	"source_url" varchar(512),
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"verified_by" varchar(100),
	"verified_at" timestamp with time zone,
	"is_manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_run_cells" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"run_id" integer NOT NULL,
	"cell_key" varchar(64) NOT NULL,
	"bbox" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"pages_fetched" integer DEFAULT 0 NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"saturated" boolean DEFAULT false NOT NULL,
	"error" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_id" integer,
	"template_id" integer,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"estimated_requests" integer,
	"used_requests" integer DEFAULT 0 NOT NULL,
	"found_count" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"duplicates_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "kind" varchar(20) DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "role_label" varchar(100);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source_url" varchar(512);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "verification_status" varchar(30) DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_field_values" ADD CONSTRAINT "lead_field_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_field_values" ADD CONSTRAINT "lead_field_values_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run_cells" ADD CONSTRAINT "search_run_cells_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run_cells" ADD CONSTRAINT "search_run_cells_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_template_id_search_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."search_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_templates" ADD CONSTRAINT "search_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;