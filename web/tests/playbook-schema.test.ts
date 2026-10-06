import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playbookSchema,
  lintPlaybook,
  AGENCY_SALES_PRESET,
  SPONSORSHIP_FUNDRAISING_PRESET,
} from "@/modules/campaigns/playbook.schema";

describe("Playbook Schema & Lint Validator (Step 2.2)", () => {
  it("validates built-in preset agency_sales successfully", () => {
    const parsed = playbookSchema.safeParse(AGENCY_SALES_PRESET);
    assert.equal(parsed.success, true, "agency_sales preset must match playbook schema");
    if (!parsed.success) return;

    const lintIssues = lintPlaybook(parsed.data);
    const errors = lintIssues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0, "agency_sales preset must have 0 lint errors");
  });

  it("validates built-in preset sponsorship_fundraising successfully", () => {
    const parsed = playbookSchema.safeParse(SPONSORSHIP_FUNDRAISING_PRESET);
    assert.equal(parsed.success, true, "sponsorship_fundraising preset must match playbook schema");
    if (!parsed.success) return;

    const lintIssues = lintPlaybook(parsed.data);
    const errors = lintIssues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0, "sponsorship_fundraising preset must have 0 lint errors");
  });

  it("lint validator flags missing core unalterable states", () => {
    const invalidPlaybook = {
      ...AGENCY_SALES_PRESET,
      // Remove core state 'unsubscribed'
      states: AGENCY_SALES_PRESET.states.filter((s) => s !== "unsubscribed"),
    };

    const issues = lintPlaybook(invalidPlaybook as any);
    const missingCore = issues.find((i) => i.code === "MISSING_CORE_STATE");
    assert.ok(missingCore, "Lint must flag missing unsubscribed core state");
  });

  it("lint validator flags transitions referencing non-existent states", () => {
    const invalidPlaybook = {
      ...AGENCY_SALES_PRESET,
      transitions: [
        ...AGENCY_SALES_PRESET.transitions,
        { from: "non_existent_state", to: "won", actor: ["user"] as const },
      ],
    };

    const issues = lintPlaybook(invalidPlaybook as any);
    const invalidSource = issues.find((i) => i.code === "INVALID_TRANSITION_SOURCE");
    assert.ok(invalidSource, "Lint must flag transition with non-existent source state");
  });
});
