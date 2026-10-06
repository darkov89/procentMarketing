import {
  boolean,
  doublePrecision,
  integer,
  smallint,
  bigint,
  json,
  jsonb,
  date,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export interface TenantModulesConfig {
  sourcingPlaces?: boolean;
  sourcingCsv?: boolean;
  compliancePke?: boolean;
  outreachMode?: "plain" | "offer_page";
  callTasksQueue?: boolean;
  dealFinanceTracking?: boolean;
  excludedIndustries?: string[];
  maxDailySends?: number;
}

export const DEFAULT_TENANT_MODULES: TenantModulesConfig = {
  sourcingPlaces: true,
  sourcingCsv: true,
  compliancePke: false,
  outreachMode: "offer_page",
  callTasksQueue: false,
  dealFinanceTracking: false,
  excludedIndustries: [],
  maxDailySends: 15,
};

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 50 }).default("pro").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  enabledModules: json("enabled_modules").$type<TenantModulesConfig>().default(DEFAULT_TENANT_MODULES).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 50 }).default("owner").notNull(),
    capabilities: text("capabilities").array().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("tenant_members_tenant_id_user_id_key").on(table.tenantId, table.userId),
  ]
);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  nip: varchar("nip", { length: 20 }),
  regon: varchar("regon", { length: 20 }),
  krs: varchar("krs", { length: 20 }),
  website: varchar("website", { length: 512 }),
  phoneNormalized: varchar("phone_normalized", { length: 30 }),
  emailPrimary: varchar("email_primary", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 100 }).default("Legnica"),
  postalCode: varchar("postal_code", { length: 20 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  distanceKm: doublePrecision("distance_km"),
  industry: varchar("industry", { length: 100 }),
  pkdMain: varchar("pkd_main", { length: 20 }),
  status: varchar("status", { length: 50 }).default("new").notNull(),
  score: integer("score").default(0).notNull(),
  scoreBreakdown: json("score_breakdown"),
  rejectionReason: text("rejection_reason"),
  ownerConfidence: varchar("owner_confidence", { length: 50 }),
  sourceName: varchar("source_name", { length: 100 }),
  sequenceStep: integer("sequence_step").default(0).notNull(),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  lostReason: varchar("lost_reason", { length: 100 }),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
  contactBasis: varchar("contact_basis", { length: 50 }).default("inquiry"),
  pkeEmailStatus: varchar("pke_email_status", { length: 50 }).default("needs_review"),
  pkePhoneStatus: varchar("pke_phone_status", { length: 50 }).default("needs_review"),
  csrPriority: integer("csr_priority"),
  evidenceUrl: text("evidence_url"),
  evidenceDate: varchar("evidence_date", { length: 50 }),
  isFixture: boolean("is_fixture").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar("role", { length: 100 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 30 }),
  source: varchar("source", { length: 50 }),
  confidence: doublePrecision("confidence"),
  isPrimary: boolean("is_primary").default(false),
  kind: varchar("kind", { length: 20 }).default("email").notNull(), // email, phone, form
  roleLabel: varchar("role_label", { length: 100 }),
  sourceUrl: varchar("source_url", { length: 512 }),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  verificationStatus: varchar("verification_status", { length: 30 }).default("unverified").notNull(), // verified, unverified, invalid
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  sslValid: boolean("ssl_valid"),
  isResponsive: boolean("is_responsive"),
  pagespeedMobileScore: integer("pagespeed_mobile_score"),
  cmsDetected: varchar("cms_detected", { length: 100 }),
  copyrightYear: integer("copyright_year"),
  hasGa4: boolean("has_ga4"),
  hasGtm: boolean("has_gtm"),
  hasMetaPixel: boolean("has_meta_pixel"),
  hasContactForm: boolean("has_contact_form"),
  hasOnlineBooking: boolean("has_online_booking"),
  hasLiveChat: boolean("has_live_chat"),
  socialLinks: json("social_links"),
  emailsScraped: json("emails_scraped"),
  googleRating: doublePrecision("google_rating"),
  googleReviewsCount: integer("google_reviews_count"),
  metaAdsActive: boolean("meta_ads_active"),
  rawEvidence: json("raw_evidence"),
  auditedAt: timestamp("audited_at", { withTimezone: true }).defaultNow().notNull(),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  heroObservation: text("hero_observation").notNull(),
  observationsEvidence: json("observations_evidence"),
  proposedModules: json("proposed_modules").notNull(),
  pricingRange: varchar("pricing_range", { length: 100 }),
  processSteps: json("process_steps"),
  bookingUrl: varchar("booking_url", { length: 512 }).notNull(),
  deployUrl: varchar("deploy_url", { length: 512 }),
  netlifyDeployId: varchar("netlify_deploy_id", { length: 100 }),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  token: varchar("token", { length: 64 }).unique(),
  noindex: boolean("noindex").default(true).notNull(),
  evidenceIds: json("evidence_ids"),
  senderName: varchar("sender_name", { length: 255 }),
  senderRole: varchar("sender_role", { length: 255 }),
  senderEmail: varchar("sender_email", { length: 255 }),
  senderPhone: varchar("sender_phone", { length: 50 }),
  senderCompany: varchar("sender_company", { length: 255 }),
  senderWebsite: varchar("sender_website", { length: 255 }),
  customNote: text("custom_note"),
  ctaText: varchar("cta_text", { length: 100 }).default("Umów bezpłatną konsultację"),
  viewCount: integer("view_count").default(0).notNull(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  contactId: integer("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  direction: varchar("direction", { length: 20 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 64 }).unique().notNull(),
  messageId: varchar("message_id", { length: 255 }),
  inReplyTo: varchar("in_reply_to", { length: 255 }),
  subject: varchar("subject", { length: 255 }),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  classification: varchar("classification", { length: 50 }),
  classificationDetails: json("classification_details"),
  retryCount: integer("retry_count").default(0).notNull(),
  errorMessage: text("error_message"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  sequenceStep: integer("sequence_step").default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppression = pgTable(
  "suppression",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    kind: varchar("kind", { length: 20 }).default("email").notNull(),
    hash: varchar("hash", { length: 64 }).notNull(),
    hashedEmail: varchar("hashed_email", { length: 64 }),
    hashedPhone: varchar("hashed_phone", { length: 64 }),
    hashedNip: varchar("hashed_nip", { length: 64 }),
    hashedDomain: varchar("hashed_domain", { length: 64 }),
    rawIdentifier: varchar("raw_identifier", { length: 255 }),
    reason: varchar("reason", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("suppression_tenant_kind_hash_unique").on(table.tenantId, table.kind, table.hash),
  ]
);

export const consents = pgTable("consents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  channel: varchar("channel", { length: 20 }).notNull(),
  granted: boolean("granted").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  evidenceText: text("evidence_text"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: json("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: varchar("role", { length: 50 }).default("admin").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 64 }).unique().notNull(),
  email: varchar("email", { length: 255 }),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  maxUses: integer("max_uses").default(1).notNull(),
  usedCount: integer("used_count").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: varchar("token", { length: 128 }).unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable(
  "app_settings",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    key: varchar("key", { length: 100 }).notNull(),
    value: json("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("app_settings_tenant_id_key_unique").on(table.tenantId, table.key),
  ]
);

export const leadEvents = pgTable("lead_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  fromStatus: varchar("from_status", { length: 50 }).notNull(),
  toStatus: varchar("to_status", { length: 50 }).notNull(),
  reason: text("reason"),
  actor: varchar("actor", { length: 100 }).default("system").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leadTasks = pgTable("lead_tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  assignedUserId: integer("assigned_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  taskType: varchar("task_type", { length: 50 }).default("call").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  outcome: varchar("outcome", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const leadDeals = pgTable("lead_deals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  declaredAmount: bigint("declared_amount", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("PLN").notNull(),
  expectedPaymentAt: timestamp("expected_payment_at", { withTimezone: true }),
  paidAmount: bigint("paid_amount", { mode: "number" }).default(0),
  paidConfirmedAt: timestamp("paid_confirmed_at", { withTimezone: true }),
  confirmedByUserId: integer("confirmed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  status: varchar("status", { length: 50 }).default("declared").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    type: varchar("type", { length: 100 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    priority: smallint("priority").default(50).notNull(),
    payload: json("payload"),
    result: jsonb("result"),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    lastError: text("last_error"),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: varchar("locked_by", { length: 100 }),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("jobs_tenant_id_idempotency_key_unique").on(table.tenantId, table.idempotencyKey),
  ]
);

export const evidence = pgTable("evidence", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  claimType: varchar("claim_type", { length: 100 }).notNull(),
  claimValue: text("claim_value").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  sourceUrl: varchar("source_url", { length: 512 }),
  snippet: text("snippet"),
  confidence: doublePrecision("confidence").default(1.0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const serviceCatalog = pgTable("service_catalog", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  serviceName: varchar("service_name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  basePrice: integer("base_price").notNull(),
  priceUnit: varchar("price_unit", { length: 50 }).default("PLN").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tenantSecrets = pgTable(
  "tenant_secrets",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    keyVersion: integer("key_version").default(1).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("tenant_secrets_tenant_id_name_unique").on(table.tenantId, table.name),
  ]
);

export const tenantLimits = pgTable(
  "tenant_limits",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    metric: varchar("metric", { length: 64 }).notNull(),
    limitValue: integer("limit_value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("tenant_limits_tenant_id_metric_unique").on(table.tenantId, table.metric),
  ]
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    metric: varchar("metric", { length: 64 }).notNull(),
    period: varchar("period", { length: 32 }).notNull(), // e.g. "2026-10", "2026-10-06", "all_time"
    count: integer("count").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("usage_counters_tenant_id_metric_period_unique").on(
      table.tenantId,
      table.metric,
      table.period
    ),
  ]
);

// ==========================================
// FAZA 2: PLAYBOOKI I KAMPANIE (D1, D2)
// ==========================================

export const playbooks = pgTable("playbooks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  presetKey: varchar("preset_key", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const playbookVersions = pgTable("playbook_versions", {
  id: serial("id").primaryKey(),
  playbookId: integer("playbook_id")
    .references(() => playbooks.id, { onDelete: "cascade" })
    .notNull(),
  version: integer("version").notNull(),
  definition: jsonb("definition").notNull(), // PlaybookDefinition (Zod)
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailAccounts = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }).notNull(),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  replyTo: varchar("reply_to", { length: 255 }),
  signature: text("signature"),
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpSecure: boolean("smtp_secure").default(false),
  imapHost: varchar("imap_host", { length: 255 }),
  imapPort: integer("imap_port").default(993),
  imapUser: varchar("imap_user", { length: 255 }),
  imapTls: boolean("imap_tls").default(true),
  dailyLimit: integer("daily_limit").default(30).notNull(),
  hourlyLimit: integer("hourly_limit").default(10).notNull(),
  minGapSeconds: integer("min_gap_seconds").default(60).notNull(),
  warmupPlan: jsonb("warmup_plan"),
  status: varchar("status", { length: 50 }).default("ok").notNull(), // ok, degraded, error
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, active, paused, archived
  playbookVersionId: integer("playbook_version_id")
    .references(() => playbookVersions.id, { onDelete: "restrict" })
    .notNull(),
  ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  emailAccountId: integer("email_account_id").references(() => emailAccounts.id, { onDelete: "set null" }),
  testMode: boolean("test_mode").default(true).notNull(),
  killSwitch: boolean("kill_switch").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignId: integer("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" })
    .notNull(),
  size: integer("size").notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, approved, rejected
  approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignLeads = pgTable(
  "campaign_leads",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    campaignId: integer("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    leadId: integer("lead_id")
      .references(() => leads.id, { onDelete: "cascade" })
      .notNull(),
    state: varchar("state", { length: 50 }).default("new").notNull(),
    priority: smallint("priority"),
    ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
    chosenContactId: integer("chosen_contact_id").references(() => contacts.id, { onDelete: "set null" }),
    fitReason: text("fit_reason"),
    requiresManualReview: boolean("requires_manual_review").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("campaign_leads_campaign_id_lead_id_key").on(table.campaignId, table.leadId),
  ]
);

export const channelPermissions = pgTable("channel_permissions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignLeadId: integer("campaign_lead_id")
    .references(() => campaignLeads.id, { onDelete: "cascade" })
    .notNull(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  channel: varchar("channel", { length: 20 }).notNull(), // email, phone
  status: varchar("status", { length: 20 }).default("to_check").notNull(), // yes, no, to_check
  rationale: text("rationale"),
  evidenceUrl: varchar("evidence_url", { length: 512 }),
  evidenceNote: text("evidence_note"),
  approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    kind: varchar("kind", { length: 20 }).notNull(), // email, domain, phone, nip
    hash: varchar("hash", { length: 64 }).notNull(),
    reason: varchar("reason", { length: 50 }).notNull(), // refusal, unsubscribe, bounce, prior_contact, manual
    source: varchar("source", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("blocks_tenant_id_kind_hash_key").on(table.tenantId, table.kind, table.hash),
  ]
);

export const sequenceRuns = pgTable("sequence_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignLeadId: integer("campaign_lead_id")
    .references(() => campaignLeads.id, { onDelete: "cascade" })
    .notNull(),
  stepIndex: integer("step_index").default(0).notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, paused, stopped, done
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  stopReason: varchar("stop_reason", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignLeadId: integer("campaign_lead_id")
    .references(() => campaignLeads.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 50 }).notNull(), // phone_call, verify_channel, manual_review
  assigneeUserId: integer("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 50 }).default("open").notNull(), // open, done, snoozed, cancelled, blocked
  result: varchar("result", { length: 100 }),
  nextStep: varchar("next_step", { length: 100 }),
  blockedReason: text("blocked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const outcomes = pgTable("outcomes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignLeadId: integer("campaign_lead_id")
    .references(() => campaignLeads.id, { onDelete: "cascade" })
    .notNull(),
  pledgedMinor: bigint("pledged_minor", { mode: "number" }),
  currency: varchar("currency", { length: 3 }).default("PLN").notNull(),
  expectedPaymentDate: date("expected_payment_date"),
  paidMinor: bigint("paid_minor", { mode: "number" }),
  paymentConfirmedById: integer("payment_confirmed_by_id").references(() => users.id, { onDelete: "set null" }),
  paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customFieldDefs = pgTable(
  "custom_field_defs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    campaignId: integer("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // text, number, date, enum
    options: jsonb("options"),
    required: boolean("required").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("custom_field_defs_campaign_id_key_key").on(table.campaignId, table.key),
  ]
);

export const customFieldValues = pgTable("custom_field_values", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignLeadId: integer("campaign_lead_id")
    .references(() => campaignLeads.id, { onDelete: "cascade" })
    .notNull(),
  key: varchar("key", { length: 64 }).notNull(),
  value: jsonb("value"),
  source: varchar("source", { length: 100 }),
  updatedById: integer("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const searchTemplates = pgTable("search_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  criteria: jsonb("criteria").notNull(), // industry, keywords, location, radiusKm, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const searchRuns = pgTable("search_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignId: integer("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" }),
  templateId: integer("template_id")
    .references(() => searchTemplates.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, running, paused, completed, failed, budget_exceeded
  estimatedRequests: integer("estimated_requests"),
  usedRequests: integer("used_requests").default(0).notNull(),
  foundCount: integer("found_count").default(0).notNull(),
  newCount: integer("new_count").default(0).notNull(),
  duplicatesCount: integer("duplicates_count").default(0).notNull(),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const searchRunCells = pgTable("search_run_cells", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  runId: integer("run_id")
    .references(() => searchRuns.id, { onDelete: "cascade" })
    .notNull(),
  cellKey: varchar("cell_key", { length: 64 }).notNull(),
  bbox: jsonb("bbox").notNull(), // { minLat, maxLat, minLng, maxLng } or { center: { lat, lng }, radiusMeters }
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, processing, completed, saturated, failed
  pagesFetched: integer("pages_fetched").default(0).notNull(),
  resultsCount: integer("results_count").default(0).notNull(),
  saturated: boolean("saturated").default(false).notNull(),
  error: text("error"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leadFieldValues = pgTable("lead_field_values", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  field: varchar("field", { length: 64 }).notNull(),
  value: jsonb("value").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  sourceUrl: varchar("source_url", { length: 512 }),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).defaultNow().notNull(),
  confidence: doublePrecision("confidence").default(1.0).notNull(),
  verifiedBy: varchar("verified_by", { length: 100 }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  isManual: boolean("is_manual").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tenantProfiles = pgTable("tenant_profiles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  companyDescription: text("company_description").notNull(),
  coreServices: jsonb("core_services").notNull(), // array of services/packages
  uniqueSellingPoints: text("unique_selling_points").array().default([]).notNull(),
  targetAudience: text("target_audience"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pricingConfigs = pgTable(
  "pricing_configs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    packageKey: varchar("package_key", { length: 64 }).notNull(),
    packageName: varchar("package_name", { length: 255 }).notNull(),
    description: text("description"),
    basePriceMinor: bigint("base_price_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).default("PLN").notNull(),
    billingPeriod: varchar("billing_period", { length: 32 }).default("monthly").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("pricing_configs_tenant_id_package_key_key").on(table.tenantId, table.packageKey),
  ]
);

export const statsDaily = pgTable(
  "stats_daily",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    metric: varchar("metric", { length: 64 }).notNull(),
    value: bigint("value", { mode: "number" }).default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("stats_daily_tenant_campaign_date_metric_key").on(
      table.tenantId,
      table.campaignId,
      table.date,
      table.metric
    ).nullsNotDistinct(),
  ]
);


// Relations
export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  audit: one(audits, {
    fields: [leads.id],
    references: [audits.leadId],
  }),
  offer: one(offers, {
    fields: [leads.id],
    references: [offers.leadId],
  }),
  contacts: many(contacts),
  messages: many(messages),
  events: many(events),
  leadEvents: many(leadEvents),
  evidence: many(evidence),
  tasks: many(leadTasks),
  deals: many(leadDeals),
}));

export const leadTasksRelations = relations(leadTasks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leadTasks.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [leadTasks.leadId],
    references: [leads.id],
  }),
  assignedUser: one(users, {
    fields: [leadTasks.assignedUserId],
    references: [users.id],
  }),
}));

export const leadDealsRelations = relations(leadDeals, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leadDeals.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [leadDeals.leadId],
    references: [leads.id],
  }),
  confirmedByUser: one(users, {
    fields: [leadDeals.confirmedByUserId],
    references: [users.id],
  }),
}));

export const leadEventsRelations = relations(leadEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leadEvents.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [leadEvents.leadId],
    references: [leads.id],
  }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  tenant: one(tenants, {
    fields: [evidence.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [evidence.leadId],
    references: [leads.id],
  }),
}));

export const auditsRelations = relations(audits, ({ one }) => ({
  tenant: one(tenants, {
    fields: [audits.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [audits.leadId],
    references: [leads.id],
  }),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [offers.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [offers.leadId],
    references: [leads.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contacts.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [contacts.leadId],
    references: [leads.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [messages.leadId],
    references: [leads.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMembers),
  leads: many(leads),
  offers: many(offers),
  messages: many(messages),
  tasks: many(leadTasks),
  deals: many(leadDeals),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMembers.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  invitationsCreated: many(invitations),
  memberships: many(tenantMembers),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invitations.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(users, {
    fields: [invitations.createdById],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
