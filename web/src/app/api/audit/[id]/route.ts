import { NextResponse } from "next/server";
import { db, leads, audits } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auditWebsite } from "@/lib/auditor";
import { requireUser } from "@/lib/auth";
import { transitionLead } from "@/lib/state-machine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const leadId = parseInt(id, 10);

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { audit: true },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie znaleziony" }, { status: 404 });
    }

    if (!lead.website) {
      await transitionLead({
        leadId,
        toStatus: "audit_failed",
        reason: "Lead nie posiada adresu strony WWW",
        actor: `user:${user.id}`,
      });
      return NextResponse.json(
        { success: false, error: "Lead nie posiada adresu strony WWW (oznaczono jako audit_failed)" },
        { status: 400 }
      );
    }

    try {
      const auditData = await auditWebsite(lead.website);

      if (lead.audit) {
        await db
          .update(audits)
          .set({
            ...auditData,
            auditedAt: new Date(),
          })
          .where(eq(audits.id, lead.audit.id));
      } else {
        await db.insert(audits).values({
          leadId,
          ...auditData,
          auditedAt: new Date(),
        });
      }

      // Auto-update email only if verified scraped from real site
      if (!lead.emailPrimary && auditData.emailsScraped.length > 0) {
        await db
          .update(leads)
          .set({ emailPrimary: auditData.emailsScraped[0] })
          .where(eq(leads.id, leadId));
      }

      return NextResponse.json({ success: true, audit: auditData });
    } catch (auditErr: any) {
      // INVARIANT 6: If audit fails, transition lead to audit_failed!
      await transitionLead({
        leadId,
        toStatus: "audit_failed",
        reason: auditErr.message,
        actor: `user:${user.id}`,
      });

      return NextResponse.json({
        success: false,
        error: `Audyt zakończony niepowodzeniem: ${auditErr.message}. Zaktualizowano status leada na 'audit_failed'.`,
      }, { status: 422 });
    }
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Audit error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
