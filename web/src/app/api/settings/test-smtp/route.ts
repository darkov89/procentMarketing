import { NextResponse } from "next/server";
import { testSmtpConnection } from "@/lib/mail-service";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await testSmtpConnection(body);
    return NextResponse.json(result);
  } catch (err: any) {
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
