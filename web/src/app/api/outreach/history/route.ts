import { NextResponse } from "next/server";
import { db, leads, messages, contacts, offers } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId || 1;

    // Fetch all leads for this tenant that have outreach messages or are in outreach stages
    const tenantLeads = await db.query.leads.findMany({
      where: eq(leads.tenantId, tenantId),
      orderBy: [desc(leads.updatedAt), desc(leads.id)],
      with: {
        contacts: true,
        offer: true,
        messages: {
          orderBy: [desc(messages.sentAt), desc(messages.createdAt)],
        },
      },
    });

    // Filter leads that have at least one message or outreach status
    const outreachedLeads = tenantLeads.filter(
      (l) =>
        (l.messages && l.messages.length > 0) ||
        [
          "sent",
          "in_sequence",
          "followup_sent",
          "replied_interested",
          "replied_question",
          "replied_negative",
          "meeting_booked",
          "won",
          "lost",
        ].includes(l.status)
    );

    // Map into contact outreach history rows
    const history = outreachedLeads.map((lead) => {
      const primaryContact = lead.contacts?.find((c) => c.isPrimary) || lead.contacts?.[0] || null;
      const contactFullName = primaryContact
        ? `${primaryContact.firstName || ""} ${primaryContact.lastName || ""}`.trim()
        : null;

      const sentMessages = (lead.messages || []).filter((m) => m.status === "sent" || m.sentAt !== null);
      const totalSent = sentMessages.length;
      const initialMessage = sentMessages.find((m) => m.sequenceStep === 0) || sentMessages[sentMessages.length - 1] || null;
      const latestMessage = sentMessages[0] || null;

      const followups = sentMessages.filter((m) => (m.sequenceStep || 0) > 0);

      const offerViewCount = lead.offer?.viewCount || 0;
      const lastViewedAt = lead.offer?.lastViewedAt || null;

      return {
        leadId: lead.id,
        companyName: lead.companyName,
        city: lead.city || "—",
        industry: lead.industry || "B2B",
        recipientEmail: lead.emailPrimary || primaryContact?.email || "brak",
        contactName: contactFullName || primaryContact?.role || "Osoba Decyzyjna",
        status: lead.status,
        sequenceStep: lead.sequenceStep,
        totalSent,
        initialSentAt: initialMessage?.sentAt || initialMessage?.createdAt || null,
        latestSentAt: latestMessage?.sentAt || latestMessage?.createdAt || null,
        messages: (lead.messages || []).map((m) => ({
          id: m.id,
          sequenceStep: m.sequenceStep,
          direction: m.direction,
          subject: m.subject,
          bodyText: m.bodyText,
          status: m.status,
          sentAt: m.sentAt,
          createdAt: m.createdAt,
        })),
        offer: lead.offer
          ? {
              id: lead.offer.id,
              title: lead.offer.title,
              token: lead.offer.token,
              slug: lead.offer.slug,
              pricingRange: lead.offer.pricingRange,
              ctaText: lead.offer.ctaText,
              senderName: lead.offer.senderName,
              senderCompany: lead.offer.senderCompany,
              viewCount: offerViewCount,
              lastViewedAt,
            }
          : null,
      };
    });

    // Compute basic tenant outreach metrics
    const totalOutreached = history.length;
    const totalMessagesSent = history.reduce((sum, h) => sum + h.totalSent, 0);
    const leadsWithOfferViews = history.filter((h) => (h.offer?.viewCount || 0) > 0).length;
    const totalOfferViews = history.reduce((sum, h) => sum + (h.offer?.viewCount || 0), 0);

    const repliesCount = history.filter((h) =>
      [
        "replied_interested",
        "replied_question",
        "replied_negative",
        "meeting_booked",
        "won",
      ].includes(h.status)
    ).length;

    const meetingsBookedCount = history.filter((h) =>
      ["meeting_booked", "won"].includes(h.status)
    ).length;

    const offerViewRate = totalOutreached > 0 ? Math.round((leadsWithOfferViews / totalOutreached) * 100) : 0;
    const replyRate = totalOutreached > 0 ? Math.round((repliesCount / totalOutreached) * 100) : 0;
    const meetingRate = totalOutreached > 0 ? Math.round((meetingsBookedCount / totalOutreached) * 100) : 0;

    const metrics = {
      totalOutreached,
      totalMessagesSent,
      totalOfferViews,
      leadsWithOfferViews,
      offerViewRate,
      repliesCount,
      replyRate,
      meetingsBookedCount,
      meetingRate,
    };

    return NextResponse.json({
      success: true,
      tenantId,
      metrics,
      history,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Outreach history GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
