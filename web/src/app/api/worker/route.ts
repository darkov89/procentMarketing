import { NextResponse } from "next/server";
import { runWorkerBatch, enqueueJob } from "@/lib/job-runner";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // 1. Authorize via CRON_SECRET or authenticated user session
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    let authorized = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorized = true;
    } else {
      const user = await getCurrentUser();
      if (user) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Brak autoryzacji do wywołania workera (wymagany CRON_SECRET lub sesja użytkownika)." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const workerId = body.workerId || `worker_${Date.now()}`;
    const maxJobs = typeof body.maxJobs === "number" ? body.maxJobs : 5;

    // Optional: if body.triggerFollowups is true or in cron, enqueue periodic checks
    if (body.triggerFollowups) {
      await enqueueJob("process_followups", {});
    }
    if (body.triggerInboxPoll) {
      await enqueueJob("poll_inbox", {});
    }

    const report = await runWorkerBatch(workerId, maxJobs);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    console.error("Worker execution error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
