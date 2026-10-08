import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "@/app/api/cron/tick/route";

describe("Cron Tick Endpoint (/api/cron/tick)", () => {
  it("rejects unauthorized cron tick request without secret or session", async () => {
    const req = new Request("http://localhost:3000/api/cron/tick", { method: "GET" });
    const res = await GET(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Brak autoryzacji/);
  });

  it("accepts authorized cron tick request with Bearer CRON_SECRET", async () => {
    const testSecret = "test_cron_secret_123";
    const originalSecret = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = testSecret;

      const req = new Request("http://localhost:3000/api/cron/tick", {
        method: "GET",
        headers: {
          authorization: `Bearer ${testSecret}`,
        },
      });

      const res = await GET(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.summary !== undefined, "Should return queue tick execution summary");
    } finally {
      process.env.CRON_SECRET = originalSecret;
    }
  });
});
