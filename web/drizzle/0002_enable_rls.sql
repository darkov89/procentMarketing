-- Migration: Enable Row Level Security (RLS) and Tenant Isolation Policy
-- Role: app_rw (enforced non-bypassrls role for application transactions)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw WITH LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT app_rw TO neondb_owner;
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_rw;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_rw;

-- Enable and FORCE RLS on all tables containing tenant_id
-- Tables list:
-- app_settings, audits, consents, contacts, events, evidence, invitations,
-- jobs, lead_deals, lead_events, lead_tasks, leads, messages, offers,
-- service_catalog, suppression, tenant_members

-- app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON app_settings;
CREATE POLICY tenant_isolation_policy ON app_settings
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- audits
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON audits;
CREATE POLICY tenant_isolation_policy ON audits
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- consents
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON consents;
CREATE POLICY tenant_isolation_policy ON consents
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON contacts;
CREATE POLICY tenant_isolation_policy ON contacts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON events;
CREATE POLICY tenant_isolation_policy ON events
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- evidence
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON evidence;
CREATE POLICY tenant_isolation_policy ON evidence
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON invitations;
CREATE POLICY tenant_isolation_policy ON invitations
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON jobs;
CREATE POLICY tenant_isolation_policy ON jobs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- lead_deals
ALTER TABLE lead_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_deals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON lead_deals;
CREATE POLICY tenant_isolation_policy ON lead_deals
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- lead_events
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON lead_events;
CREATE POLICY tenant_isolation_policy ON lead_events
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- lead_tasks
ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON lead_tasks;
CREATE POLICY tenant_isolation_policy ON lead_tasks
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON leads;
CREATE POLICY tenant_isolation_policy ON leads
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON messages;
CREATE POLICY tenant_isolation_policy ON messages
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- offers
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON offers;
CREATE POLICY tenant_isolation_policy ON offers
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- service_catalog
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON service_catalog;
CREATE POLICY tenant_isolation_policy ON service_catalog
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- suppression
ALTER TABLE suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON suppression;
CREATE POLICY tenant_isolation_policy ON suppression
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- tenant_members
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON tenant_members;
CREATE POLICY tenant_isolation_policy ON tenant_members
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);
