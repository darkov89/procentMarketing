CREATE TABLE "pricing_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"package_key" varchar(64) NOT NULL,
	"package_name" varchar(255) NOT NULL,
	"description" text,
	"base_price_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'PLN' NOT NULL,
	"billing_period" varchar(32) DEFAULT 'monthly' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_configs_tenant_id_package_key_key" UNIQUE("tenant_id","package_key")
);
--> statement-breakpoint
CREATE TABLE "tenant_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"company_description" text NOT NULL,
	"core_services" jsonb NOT NULL,
	"unique_selling_points" text[] DEFAULT '{}' NOT NULL,
	"target_audience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_profiles_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;