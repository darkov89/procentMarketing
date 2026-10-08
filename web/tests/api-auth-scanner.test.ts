import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

describe("API Security Scanner (Invariant 4)", () => {
  const apiDir = path.resolve(__dirname, "../src/app/api");

  // Recursively find all route.ts files
  function findRouteFiles(dir: string): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(findRouteFiles(fullPath));
      } else if (entry.name === "route.ts") {
        results.push(fullPath);
      }
    }
    return results;
  }

  // Strict public endpoint whitelist
  const PUBLIC_OR_SECRET_EXEMPTIONS = new Set([
    "api/auth/login",
    "api/auth/register",
    "api/auth/logout",
    "api/auth/invite/verify",
    "api/worker", // Protected by CRON_SECRET or auth session
    "api/unsubscribe", // Protected by cryptographic opt-out token (RFC 8058 / RODO)
  ]);

  it("ensures every API route handler is guarded by requireUser() or documented security token", () => {
    const routeFiles = findRouteFiles(apiDir);
    assert.ok(routeFiles.length > 0, "Discovered API route files");

    const unprotectedRoutes: Array<{ route: string; file: string; reason: string }> = [];

    for (const filePath of routeFiles) {
      const relative = path.relative(path.resolve(__dirname, "../src/app"), filePath);
      const routePath = relative.replace(/\/route\.ts$/, "");

      // Check if exempted
      if (PUBLIC_OR_SECRET_EXEMPTIONS.has(routePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, "utf-8");

      // Check for presence of requireUser(), requireTenant() or session authorization
      const hasRequireUser = content.includes("requireUser()") || content.includes("requireTenant()");
      const hasSessionAuth = content.includes("pm_session_token") || content.includes("getCurrentUser()");
      const hasCronSecret = content.includes("CRON_SECRET");

      if (!hasRequireUser && !hasSessionAuth && !hasCronSecret) {
        unprotectedRoutes.push({
          route: routePath,
          file: relative,
          reason: "Missing requireUser() or authentication guard",
        });
      }
    }

    if (unprotectedRoutes.length > 0) {
      console.error("UNPROTECTED API ROUTES DETECTED:", unprotectedRoutes);
    }

    assert.equal(
      unprotectedRoutes.length,
      0,
      `Detected ${unprotectedRoutes.length} unprotected API routes without requireUser()!`
    );
  });
});
