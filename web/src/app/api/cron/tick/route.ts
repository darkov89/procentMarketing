import { NextResponse } from "next/server";
import { runQueueTick } from "@/modules/jobs/worker";
import { getCurrentUser } from "@/lib/auth";

export const maxDuration = 60; // Vercel maximum function execution duration

/**
 * Endpoint wywoływany przez Vercel Cron lub zewnętrzny scheduler.
 * Autoryzacja przez Authorization: Bearer CRON_SECRET lub aktywną sesję użytkownika.
 */
export async function GET(req: Request) {
  return handleCronTick(req);
}

export async function POST(req: Request) {
  return handleCronTick(req);
}

async function handleCronTick(req: Request) {
  try {
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
        { success: false, error: "Brak autoryzacji do uruchomienia cron tick (wymagany CRON_SECRET lub sesja)." },
        { status: 401 }
      );
    }

    const summary = await runQueueTick({
      timeLimitMs: 50000, // 50 seconds threshold for 60s maxDuration
      maxJobs: 25,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Cron tick execution error:", errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
