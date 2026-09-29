import { NextResponse } from "next/server";
import { pollInboxAndProcess } from "@/lib/mail-service";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const report = await pollInboxAndProcess(body);
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || String(err),
        checkedCount: 0,
        matchedCount: 0,
        unsubscribedCount: 0,
        interestedCount: 0,
        processedItems: [],
      },
      { status: 500 }
    );
  }
}
