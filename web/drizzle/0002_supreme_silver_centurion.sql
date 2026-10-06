CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"size" integer NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"approved_by_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"kind" varchar(20) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"reason" varchar(50) NOT NULL,
	"source" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_tenant_id_kind_hash_key" UNIQUE("tenant_id","kind","hash")
);
--> statement-breakpoint
CREATE TABLE "campaign_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"state" varchar(50) DEFAULT 'new' NOT NULL,
	"priority" smallint,
	"owner_user_id" integer,
	"batch_id" integer,
	"chosen_contact_id" integer,
	"fit_reason" text,
	"requires_manual_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_leads_campaign_id_lead_id_key" UNIQUE("campaign_id","lead_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"playbook_version_id" integer NOT NULL,
	"owner_user_id" integer,
	"test_mode" boolean DEFAULT true NOT NULL,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_lead_id" integer NOT NULL,
	"contact_id" integer,
	"channel" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'to_check' NOT NULL,
	"rationale" text,
	"evidence_url" varchar(512),
	"evidence_note" text,
	"approved_by_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_defs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"key" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_defs_campaign_id_key_key" UNIQUE("campaign_id","key")
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_lead_id" integer NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" jsonb,
	"source" varchar(100),
	"updated_by_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_lead_id" integer NOT NULL,
	"pledged_minor" bigint,
	"currency" varchar(3) DEFAULT 'PLN' NOT NULL,
	"expected_payment_date" date,
	"paid_minor" bigint,
	"payment_confirmed_by_id" integer,
	"payment_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"playbook_id" integer NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"preset_key" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_lead_id" integer NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"next_run_at" timestamp with time zone,
	"stop_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"campaign_lead_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"assignee_user_id" integer,
	"due_at" timestamp with time zone NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"result" varchar(100),
	"next_step" varchar(100),
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_chosen_contact_id_contacts_id_fk" FOREIGN KEY ("chosen_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_playbook_version_id_playbook_versions_id_fk" FOREIGN KEY ("playbook_version_id") REFERENCES "public"."playbook_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_permissions" ADD CONSTRAINT "channel_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_permissions" ADD CONSTRAINT "channel_permissions_campaign_lead_id_campaign_leads_id_fk" FOREIGN KEY ("campaign_lead_id") REFERENCES "public"."campaign_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_permissions" ADD CONSTRAINT "channel_permissions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_permissions" ADD CONSTRAINT "channel_permissions_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_defs" ADD CONSTRAINT "custom_field_defs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_defs" ADD CONSTRAINT "custom_field_defs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_campaign_lead_id_campaign_leads_id_fk" FOREIGN KEY ("campaign_lead_id") REFERENCES "public"."campaign_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_campaign_lead_id_campaign_leads_id_fk" FOREIGN KEY ("campaign_lead_id") REFERENCES "public"."campaign_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_payment_confirmed_by_id_users_id_fk" FOREIGN KEY ("payment_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_versions" ADD CONSTRAINT "playbook_versions_playbook_id_playbooks_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_versions" ADD CONSTRAINT "playbook_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_runs" ADD CONSTRAINT "sequence_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_runs" ADD CONSTRAINT "sequence_runs_campaign_lead_id_campaign_leads_id_fk" FOREIGN KEY ("campaign_lead_id") REFERENCES "public"."campaign_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campaign_lead_id_campaign_leads_id_fk" FOREIGN KEY ("campaign_lead_id") REFERENCES "public"."campaign_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;