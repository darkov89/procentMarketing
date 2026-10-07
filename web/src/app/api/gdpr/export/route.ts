import { NextResponse } from "next/server";
import { db, leads, contacts, messages, channelPermissions, leadEvents, campaignLeads } from "@/lib/db";
import { eq, and, or } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

/**
 * Technical support for Article 15 GDPR: Right of access by the data subject.
 * Allows tenant operator to export all personal data collected about a lead/contact.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Brak wybranego tenanta." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const leadIdParam = searchParams.get("leadId");
    const emailParam = searchParams.get("email")?.toLowerCase().trim();

    if (!leadIdParam && !emailParam) {
      return NextResponse.json(
        { error: "Podaj parametr 'leadId' lub 'email', aby wyeksportować dane (art. 15 RODO)." },
        { status: 400 }
      );
    }

    const whereClause = leadIdParam
      ? and(eq(leads.tenantId, tenantId), eq(leads.id, parseInt(leadIdParam, 10)))
      : and(eq(leads.tenantId, tenantId), eq(leads.emailPrimary, emailParam!));

    const [lead] = await db.select().from(leads).where(whereClause).limit(1);

    if (!lead) {
      return NextResponse.json(
        { error: "Nie znaleziono podmiotu dla podanych kryteriów w ramach tenanta." },
        { status: 404 }
      );
    }

    // Related contacts
    const relatedContacts = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.leadId, lead.id)));

    // Related messages
    const relatedMessages = await db
      .select({
        id: messages.id,
        direction: messages.direction,
        channel: messages.channel,
        status: messages.status,
        sentAt: messages.sentAt,
        subject: messages.subject,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.leadId, lead.id)));

    // Related campaign leads and channel permissions
    const campLeads = await db
      .select()
      .from(campaignLeads)
      .where(and(eq(campaignLeads.tenantId, tenantId), eq(campaignLeads.leadId, lead.id)));

    const campaignLeadIds = campLeads.map((cl) => cl.id);
    let perms: Array<typeof channelPermissions.$inferSelect> = [];
    if (campaignLeadIds.length > 0) {
      const allPerms = await db
        .select()
        .from(channelPermissions)
        .where(eq(channelPermissions.tenantId, tenantId));
      perms = allPerms.filter((p) => campaignLeadIds.includes(p.campaignLeadId));
    }

    // Related audit events
    const events = await db
      .select({
        id: leadEvents.id,
        fromStatus: leadEvents.fromStatus,
        toStatus: leadEvents.toStatus,
        reason: leadEvents.reason,
        actor: leadEvents.actor,
        createdAt: leadEvents.createdAt,
      })
      .from(leadEvents)
      .where(and(eq(leadEvents.tenantId, tenantId), eq(leadEvents.leadId, lead.id)));

    // Audit log this export
    await db.insert(leadEvents).values({
      tenantId,
      leadId: lead.id,
      fromStatus: lead.status,
      toStatus: lead.status,
      reason: `RODO art. 15: Wygenerowano raport eksportu danych osobowych przez użytkownika ${user.email}`,
      actor: user.email,
      metadata: { requestedBy: user.email, leadId: lead.id, exportType: "gdpr_article_15" },
    });

    return NextResponse.json({
      legal_basis: "Article 15 GDPR (Right of access by the data subject)",
      exported_at: new Date().toISOString(),
      tenant_id: tenantId,
      lead: {
        id: lead.id,
        companyName: lead.companyName,
        nip: lead.nip,
        website: lead.website,
        emailPrimary: lead.emailPrimary,
        phone: lead.phoneNormalized,
        city: lead.city,
        address: lead.address,
        sourceName: lead.sourceName,
        contactBasis: lead.contactBasis,
        status: lead.status,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      contacts: relatedContacts.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
        email: c.email,
        phone: c.phone,
        source: c.source,
      })),
      messages: relatedMessages,
      channel_permissions: perms.map((p) => ({
        channel: p.channel,
        status: p.status,
        rationale: p.rationale,
        approvedById: p.approvedById,
      })),
      audit_events: events,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Zaloguj się") || message.includes("Brak uprawnień") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
