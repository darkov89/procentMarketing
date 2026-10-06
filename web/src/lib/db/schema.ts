import {
  boolean,
  doublePrecision,
  integer,
  bigint,
  json,
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

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  payload: json("payload"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  lastError: text("last_error"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: varchar("locked_by", { length: 100 }),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
