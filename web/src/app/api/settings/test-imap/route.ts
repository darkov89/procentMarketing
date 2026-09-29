import { NextResponse } from "next/server";
import { testImapConnection } from "@/lib/mail-service";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await testImapConnection(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || String(err),
        host: "unknown",
        port: 993,
      },
      { status: 500 }
    );
  }
}
