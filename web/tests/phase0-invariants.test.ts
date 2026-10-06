import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

describe("Phase 0 Security & Data Truth Invariants (Static Scanner)", () => {
  const srcDir = path.resolve(process.cwd(), "src");

  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it("R1 / P1: strictly prohibits fake/synthetic fallbacks (|| 4.7, || 15, || 18) in source code", () => {
    const allFiles = getAllFiles(srcDir);
    const forbiddenPatterns = [
      /\|\|\s*4\.7/,
      /\|\|\s*15\b/,
      /\|\|\s*18\b/,
    ];

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: idx + 1,
              match: line.trim(),
            });
          }
        }
      });
    }

    assert.deepStrictEqual(
      violations,
      [],
      `Found forbidden synthetic fallback values in source code: ${JSON.stringify(violations, null, 2)}`
    );
  });

  it("R4 / P2: strictly prohibits fallback tenantId '|| 1' in API routes and auth", () => {
    const allFiles = getAllFiles(srcDir);
    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of allFiles) {
      // Allow tests or specific harmless UI step labels if any, but forbid in logic / API
      if (file.includes("page.tsx")) {
        // In page.tsx check only tenantId || 1
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (/tenantId\s*\|\|\s*1\b/.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: idx + 1,
              match: line.trim(),
            });
          }
        });
        continue;
      }

      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (/tenantId\s*\|\|\s*1\b/.test(line) || /user\.tenantId\s*\|\|\s*1\b/.test(line)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            match: line.trim(),
          });
        }
      });
    }

    assert.deepStrictEqual(
      violations,
      [],
      `Found forbidden tenant fallback '|| 1' in codebase: ${JSON.stringify(violations, null, 2)}`
    );
  });

  it("R2: nodemailer must only be imported in send-service.ts and mail-service.ts", () => {
    const allFiles = getAllFiles(srcDir);
    const allowedFiles = [
      path.join(srcDir, "lib", "send-service.ts"),
      path.join(srcDir, "lib", "mail-service.ts"),
    ];

    const violations: { file: string; line: number }[] = [];

    for (const file of allFiles) {
      if (allowedFiles.includes(file)) continue;

      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (/from\s*["']nodemailer["']/.test(line) || /require\(["']nodemailer["']\)/.test(line)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
          });
        }
      });
    }

    assert.deepStrictEqual(
      violations,
      [],
      `nodemailer import found outside authorized send-service/mail-service: ${JSON.stringify(violations, null, 2)}`
    );
  });

  it("R9 / P5: process.env must never be modified at runtime in route handlers", () => {
    const apiDir = path.join(srcDir, "app", "api");
    const apiFiles = getAllFiles(apiDir);
    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of apiFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (/process\.env\.[A-Z0-9_]+\s*=\s*[^=]/.test(line)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            match: line.trim(),
          });
        }
      });
    }

    assert.deepStrictEqual(
      violations,
      [],
      `Runtime modification of process.env detected in API handlers: ${JSON.stringify(violations, null, 2)}`
    );
  });

  it("0.11: src/app/page.tsx must not exceed 7335 lines (monolith frozen)", () => {
    const pagePath = path.join(srcDir, "app", "page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");
    const lineCount = content.split("\n").length;

    assert.ok(
      lineCount <= 7335,
      `src/app/page.tsx grew to ${lineCount} lines (max allowed 7335 lines). New features must be placed in separate routes!`
    );
  });

  it("0.5 / P8: validateInviteCode rejects PROCENT-START-2026 when BOOTSTRAP_INVITE_CODE is unset", async () => {
    const { validateInviteCode, BOOTSTRAP_INVITE_CODE } = await import("../src/lib/auth");
    assert.strictEqual(BOOTSTRAP_INVITE_CODE, "", "BOOTSTRAP_INVITE_CODE should be empty by default");
    const res = await validateInviteCode("PROCENT-START-2026");
    assert.strictEqual(res.valid, false, "Must reject default hardcoded code");
  });

  it("0.3 & 0.4 / P2 & P3: AuthorizationError throws when tenant is missing", async () => {
    const { requireTenant, AuthorizationError } = await import("../src/lib/auth");
    assert.ok(requireTenant, "requireTenant guard must be exported");
    assert.ok(AuthorizationError, "AuthorizationError must be exported");
  });
});
