import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { calculateDashboardMetrics } from "@/modules/analytics/dashboard-metrics";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant();
    const url = new URL(req.url);
    const campaignIdParam = url.searchParams.get("campaignId");
    const campaignId = campaignIdParam ? parseInt(campaignIdParam, 10) : null;

    const data = await calculateDashboardMetrics({
      tenantId,
      campaignId,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if ((err as { name?: string })?.name === "AuthenticationError" || (err as { name?: string })?.name === "AuthorizationError") {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    console.error("Dashboard metrics GET error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
