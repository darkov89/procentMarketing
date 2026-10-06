import { z } from "zod";

// Core unalterable terminal & block states (R3, R5)
export const CORE_UNALTERABLE_STATES = ["blocked", "unsubscribed", "bounced"] as const;

export const playbookSourceSchema = z.object({
  type: z.enum(["places", "registry", "csv", "manual"]),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const fitRubricLevelSchema = z.object({
  priority: z.number().int().min(1),
  label: z.string().min(1),
  requires: z.array(z.string()).default([]),
  maxEvidenceAgeMonths: z.number().int().positive().optional(),
  forceManualReview: z.boolean().default(false),
});

export const fitRubricSchema = z.object({
  levels: z.array(fitRubricLevelSchema).min(1),
  noEvidenceBehavior: z.enum(["manual_review", "reject", "pass"]).default("manual_review"),
});

export const contactPathSchema = z.object({
  order: z.array(z.string()).default([
    "csr_department",
    "corporate_foundation",
    "designated_contact",
    "owner_or_board",
    "marketing",
  ]),
  onePathPerCompany: z.boolean().default(true),
  flagApplicationForm: z.boolean().default(true),
});

export const channelsConfigSchema = z.object({
  email: z.object({
    requireApprovalBeforeSend: z.boolean().default(true),
  }),
  phone: z.object({
    requireApprovalBeforeCall: z.boolean().default(true),
  }),
});

export const approvalConfigSchema = z.object({
  firstBatchSize: z.number().int().positive().default(20),
  requiredCapability: z.string().default("approve_batch"),
});

export const limitsConfigSchema = z.object({
  newCompaniesPerBusinessDay: z.number().int().positive().default(5),
  sendWindow: z.object({
    tz: z.string().default("Europe/Warsaw"),
    days: z.string().default("mon-fri"),
    from: z.string().default("08:30"),
    to: z.string().default("16:00"),
    skipHolidays: z.string().default("PL"),
  }),
});

export const sequenceStepSendEmailSchema = z.object({
  id: z.string().min(1),
  type: z.literal("send_email"),
  template: z.string().min(1),
});

export const sequenceStepWaitSchema = z.object({
  id: z.string().min(1),
  type: z.literal("wait"),
  businessDays: z.number().int().positive(),
});

export const sequenceStepCreateTaskSchema = z.object({
  id: z.string().min(1),
  type: z.literal("create_task"),
  taskType: z.enum(["phone_call", "verify_channel", "manual_review"]),
  assigneeRole: z.enum(["campaign_owner", "admin", "member"]).default("campaign_owner"),
  requires: z
    .object({
      channel: z.enum(["email", "phone"]).optional(),
      permission: z.enum(["yes", "no", "to_check"]).optional(),
      afterStepSucceeded: z.string().optional(),
    })
    .optional(),
});

export const sequenceStepSchema = z.discriminatedUnion("type", [
  sequenceStepSendEmailSchema,
  sequenceStepWaitSchema,
  sequenceStepCreateTaskSchema,
]);

export const transitionRuleSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  actor: z.array(z.enum(["system", "user"])).default(["system", "user"]),
});

export const playbookModulesSchema = z.object({
  audit: z.boolean().default(false),
  offers: z.boolean().default(false),
  pricing: z.boolean().default(false),
});

export const outcomeSchemaConfig = z.object({
  enabled: z.boolean().default(false),
  confirmPaymentCapability: z.string().default("confirm_payment"),
});

export const templateConfigSchema = z.object({
  format: z.enum(["plain_text", "html", "markdown"]).default("plain_text"),
  attachments: z.boolean().default(false),
  autoPraise: z.boolean().default(false),
});

export const customFieldDefSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "enum"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
});

export const playbookSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  sources: z.array(playbookSourceSchema).min(1),
  fitRubric: fitRubricSchema,
  exclusions: z.object({
    industries: z.array(z.string()).default([]),
    inactiveCompanies: z.boolean().default(true),
  }),
  contactPath: contactPathSchema,
  channels: channelsConfigSchema,
  approval: approvalConfigSchema,
  limits: limitsConfigSchema,
  sequence: z.array(sequenceStepSchema).min(1),
  stopConditions: z
    .array(z.enum(["reply", "refusal", "unsubscribe", "bounce"]))
    .default(["reply", "refusal", "unsubscribe", "bounce"]),
  onEvents: z
    .record(
      z.string(),
      z.object({
        pauseSequence: z.boolean().optional(),
        blockTasks: z.boolean().optional(),
        moveTask: z.boolean().optional(),
        notify: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .default({
      reply: { pauseSequence: true, notify: "campaign_owner" },
      bounce: { blockTasks: true, reason: "mail_error_to_clarify" },
      reschedule_request: { moveTask: true },
    }),
  states: z.array(z.string()).min(1),
  transitions: z.array(transitionRuleSchema).min(1),
  modules: playbookModulesSchema,
  outcomeSchema: outcomeSchemaConfig.default({ enabled: false, confirmPaymentCapability: "confirm_payment" }),
  templates: z.record(z.string(), templateConfigSchema).default({}),
  customFields: z.array(customFieldDefSchema).default([]),
});

export type PlaybookDefinition = z.infer<typeof playbookSchema>;

export interface PlaybookLintIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

/**
 * Validates and lints a playbook definition for structural and logic consistency.
 */
export function lintPlaybook(playbook: PlaybookDefinition): PlaybookLintIssue[] {
  const issues: PlaybookLintIssue[] = [];

  // Check state consistency
  const stateSet = new Set(playbook.states);
  for (const core of CORE_UNALTERABLE_STATES) {
    if (!stateSet.has(core)) {
      issues.push({
        severity: "error",
        code: "MISSING_CORE_STATE",
        message: `Wymagany stan rdzeniowy "${core}" musi być zdefiniowany w playbooku.`,
      });
    }
  }

  // Check transitions consistency
  for (const t of playbook.transitions) {
    if (!stateSet.has(t.from)) {
      issues.push({
        severity: "error",
        code: "INVALID_TRANSITION_SOURCE",
        message: `Przejście ze stanu "${t.from}", który nie istnieje w tablicy stanów.`,
      });
    }
    if (!stateSet.has(t.to)) {
      issues.push({
        severity: "error",
        code: "INVALID_TRANSITION_TARGET",
        message: `Przejście do stanu "${t.to}", który nie istnieje w tablicy stanów.`,
      });
    }
  }

  // Check sequence templates
  for (const step of playbook.sequence) {
    if (step.type === "send_email") {
      if (!playbook.templates[step.template]) {
        issues.push({
          severity: "warning",
          code: "UNDEFINED_TEMPLATE",
          message: `Krok sekwencji "${step.id}" odwołuje się do niezdefiniowanego szablonu "${step.template}".`,
        });
      }
    }
    if (step.type === "create_task" && step.requires?.afterStepSucceeded) {
      const targetStep = playbook.sequence.find((s) => s.id === step.requires?.afterStepSucceeded);
      if (!targetStep) {
        issues.push({
          severity: "error",
          code: "INVALID_PREREQUISITE_STEP",
          message: `Krok "${step.id}" wymaga kroku "${step.requires.afterStepSucceeded}", który nie istnieje w sekwencji.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Built-in Preset: Agency Sales (Mirrors existing Procent Marketing outbound workflow)
 */
export const AGENCY_SALES_PRESET: PlaybookDefinition = {
  schemaVersion: 1,
  sources: [{ type: "places", config: {} }],
  fitRubric: {
    levels: [
      { priority: 1, label: "Lokalna firma B2B z audytem WWW", requires: [], forceManualReview: false },
    ],
    noEvidenceBehavior: "pass",
  },
  exclusions: {
    industries: ["tobacco", "gambling", "adult", "alcohol"],
    inactiveCompanies: true,
  },
  contactPath: {
    order: ["owner_or_board", "marketing", "designated_contact"],
    onePathPerCompany: true,
    flagApplicationForm: false,
  },
  channels: {
    email: { requireApprovalBeforeSend: true },
    phone: { requireApprovalBeforeCall: true },
  },
  approval: {
    firstBatchSize: 10,
    requiredCapability: "approve_batch",
  },
  limits: {
    newCompaniesPerBusinessDay: 15,
    sendWindow: {
      tz: "Europe/Warsaw",
      days: "mon-fri",
      from: "08:30",
      to: "16:00",
      skipHolidays: "PL",
    },
  },
  sequence: [
    { id: "mail1", type: "send_email", template: "first_contact" },
    { id: "wait1", type: "wait", businessDays: 2 },
    { id: "mail2", type: "send_email", template: "followup_1" },
    { id: "wait2", type: "wait", businessDays: 3 },
    { id: "mail3", type: "send_email", template: "followup_2" },
    { id: "wait3", type: "wait", businessDays: 4 },
    { id: "mail4", type: "send_email", template: "followup_3" },
  ],
  stopConditions: ["reply", "refusal", "unsubscribe", "bounce"],
  onEvents: {
    reply: { pauseSequence: true, notify: "campaign_owner" },
    bounce: { blockTasks: true, reason: "mail_error_to_clarify" },
  },
  states: [
    "discovered",
    "researched",
    "qualified",
    "approved",
    "in_sequence",
    "replied",
    "meeting_set",
    "offer_sent",
    "won",
    "lost",
    "blocked",
    "unsubscribed",
    "bounced",
  ],
  transitions: [
    { from: "discovered", to: "researched", actor: ["system", "user"] },
    { from: "researched", to: "qualified", actor: ["system", "user"] },
    { from: "qualified", to: "approved", actor: ["user"] },
    { from: "approved", to: "in_sequence", actor: ["system", "user"] },
    { from: "in_sequence", to: "replied", actor: ["system", "user"] },
    { from: "replied", to: "meeting_set", actor: ["user"] },
    { from: "meeting_set", to: "offer_sent", actor: ["user"] },
    { from: "offer_sent", to: "won", actor: ["user"] },
    { from: "in_sequence", to: "lost", actor: ["system", "user"] },
    { from: "in_sequence", to: "unsubscribed", actor: ["system", "user"] },
    { from: "in_sequence", to: "bounced", actor: ["system", "user"] },
    { from: "in_sequence", to: "blocked", actor: ["system", "user"] },
  ],
  modules: {
    audit: true,
    offers: true,
    pricing: true,
  },
  outcomeSchema: {
    enabled: true,
    confirmPaymentCapability: "confirm_payment",
  },
  templates: {
    first_contact: { format: "plain_text", attachments: false, autoPraise: false },
    followup_1: { format: "plain_text", attachments: false, autoPraise: false },
    followup_2: { format: "plain_text", attachments: false, autoPraise: false },
    followup_3: { format: "plain_text", attachments: false, autoPraise: false },
  },
  customFields: [],
};

/**
 * Built-in Preset: Sponsorship Fundraising (Szumi Las Foundation brief)
 */
export const SPONSORSHIP_FUNDRAISING_PRESET: PlaybookDefinition = {
  schemaVersion: 1,
  sources: [{ type: "places", config: {} }, { type: "registry", config: {} }],
  fitRubric: {
    levels: [
      {
        priority: 1,
        label: "Wspiera dzieci/edukację",
        requires: ["evidence:child_support"],
        maxEvidenceAgeMonths: 36,
        forceManualReview: false,
      },
      {
        priority: 2,
        label: "Wspiera lokalną społeczność",
        requires: ["evidence:community_support"],
        forceManualReview: false,
      },
      {
        priority: 3,
        label: "Dopasowanie tematyczne ogólne",
        requires: [],
        forceManualReview: true,
      },
    ],
    noEvidenceBehavior: "manual_review",
  },
  exclusions: {
    industries: ["tobacco", "gambling", "adult", "alcohol"],
    inactiveCompanies: true,
  },
  contactPath: {
    order: ["csr_department", "corporate_foundation", "designated_contact", "owner_or_board"],
    onePathPerCompany: true,
    flagApplicationForm: true,
  },
  channels: {
    email: { requireApprovalBeforeSend: true },
    phone: { requireApprovalBeforeCall: true },
  },
  approval: {
    firstBatchSize: 20,
    requiredCapability: "approve_batch",
  },
  limits: {
    newCompaniesPerBusinessDay: 5,
    sendWindow: {
      tz: "Europe/Warsaw",
      days: "mon-fri",
      from: "08:30",
      to: "16:00",
      skipHolidays: "PL",
    },
  },
  sequence: [
    { id: "mail1", type: "send_email", template: "first_contact" },
    { id: "wait1", type: "wait", businessDays: 2 },
    {
      id: "call1",
      type: "create_task",
      taskType: "phone_call",
      assigneeRole: "campaign_owner",
      requires: { channel: "phone", permission: "yes", afterStepSucceeded: "mail1" },
    },
  ],
  stopConditions: ["reply", "refusal", "unsubscribe", "bounce"],
  onEvents: {
    reply: { pauseSequence: true, notify: "campaign_owner" },
    bounce: { blockTasks: true, reason: "mail_error_to_clarify" },
    reschedule_request: { moveTask: true },
  },
  states: [
    "new",
    "researched",
    "qualified",
    "approved",
    "in_sequence",
    "replied",
    "call_pending",
    "in_talks",
    "pledged",
    "paid",
    "closed",
    "blocked",
    "unsubscribed",
    "bounced",
  ],
  transitions: [
    { from: "new", to: "researched", actor: ["system", "user"] },
    { from: "researched", to: "qualified", actor: ["system", "user"] },
    { from: "qualified", to: "approved", actor: ["user"] },
    { from: "approved", to: "in_sequence", actor: ["system", "user"] },
    { from: "in_sequence", to: "replied", actor: ["system", "user"] },
    { from: "in_sequence", to: "call_pending", actor: ["system"] },
    { from: "call_pending", to: "in_talks", actor: ["user"] },
    { from: "replied", to: "in_talks", actor: ["user"] },
    { from: "in_talks", to: "pledged", actor: ["user"] },
    { from: "pledged", to: "paid", actor: ["user"] },
    { from: "in_talks", to: "closed", actor: ["user"] },
    { from: "in_sequence", to: "blocked", actor: ["system", "user"] },
    { from: "in_sequence", to: "unsubscribed", actor: ["system", "user"] },
    { from: "in_sequence", to: "bounced", actor: ["system", "user"] },
  ],
  modules: {
    audit: false,
    offers: false,
    pricing: false,
  },
  outcomeSchema: {
    enabled: true,
    confirmPaymentCapability: "confirm_payment",
  },
  templates: {
    first_contact: { format: "plain_text", attachments: false, autoPraise: false },
  },
  customFields: [],
};
