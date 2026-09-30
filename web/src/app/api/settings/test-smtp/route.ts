import { NextResponse } from "next/server";
import { testSmtpConnection } from "@/lib/mail-service";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json().catch(() => ({}));
    const result = await testSmtpConnection(body);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      {
        success: false,
        message: err?.message || String(err),
        host: "unknown",
        port: 587,
      },
      { status: 500 }
    );
  }
}
