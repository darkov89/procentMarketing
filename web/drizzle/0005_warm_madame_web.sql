CREATE TABLE "email_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"label" varchar(255) NOT NULL,
	"from_name" varchar(255) NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"reply_to" varchar(255),
	"signature" text,
	"smtp_host" varchar(255),
	"smtp_port" integer DEFAULT 587,
	"smtp_user" varchar(255),
	"smtp_secure" boolean DEFAULT false,
	"imap_host" varchar(255),
	"imap_port" integer DEFAULT 993,
	"imap_user" varchar(255),
	"imap_tls" boolean DEFAULT true,
	"daily_limit" integer DEFAULT 30 NOT NULL,
	"hourly_limit" integer DEFAULT 10 NOT NULL,
	"min_gap_seconds" integer DEFAULT 60 NOT NULL,
	"warmup_plan" jsonb,
	"status" varchar(50) DEFAULT 'ok' NOT NULL,
	"last_check_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "email_account_id" integer;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE set null ON UPDATE no action;