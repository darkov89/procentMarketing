-- Migration: Enable Row Level Security (RLS) and Tenant Isolation Policy across all tenant tables
-- Role: app_rw (enforced non-bypassrls role for application transactions)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw WITH LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'neondb_owner') THEN
    GRANT app_rw TO neondb_owner;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_rw;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_rw;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_rw;

-- Enable and FORCE RLS on all tables containing tenant_id

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'app_settings', 'audits', 'consents', 'contacts', 'events', 'evidence',
    'invitations', 'jobs', 'lead_deals', 'lead_events', 'lead_tasks', 'leads',
    'messages', 'offers', 'service_catalog', 'suppression', 'tenant_members',
    'campaigns', 'campaign_leads', 'batches', 'blocks', 'channel_permissions',
    'custom_field_defs', 'custom_field_values', 'email_accounts', 'stats_daily'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only alter table if it actually exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::integer) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::integer)',
        t
      );
    END IF;
  END LOOP;
END $$;
