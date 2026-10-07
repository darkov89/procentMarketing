import { NextResponse } from "next/server";
import { POST as offerPostHandler } from "../[id]/route";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json().catch(() => ({}));
    const leadId = body.leadId;

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: "Wymagany parametr leadId w treści żądania." },
        { status: 400 }
      );
    }

    const forwardReq = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(body),
    });

    return await offerPostHandler(forwardReq, {
      params: Promise.resolve({ id: String(leadId) }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
