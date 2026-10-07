import { LeadItem } from "@/components/leads/lead-types";

export interface PendingOutboxLead extends LeadItem {
  offer?: {
    id: number;
    title: string;
    slug: string;
    token?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface OutreachHistoryEntry {
  leadId: number;
  companyName: string;
  city?: string | null;
  industry?: string | null;
  nip?: string | null;
  leadStatus: string;
  emailPrimary?: string | null;
  phoneNormalized?: string | null;
  offerToken?: string | null;
  offerSlug?: string | null;
  offerViewCount: number;
  offerLastViewedAt?: string | null;
  initialSentAt?: string | null;
  lastMessageSentAt?: string | null;
  outboundCount: number;
  inboundCount: number;
  hasReplied: boolean;
  meetingBooked: boolean;
  totalMessages: number;
}

export interface OutreachHistoryMetrics {
  totalOutreached: number;
  totalMessagesSent: number;
  totalOfferViews: number;
  leadsWithOfferViews: number;
  offerViewRate: number;
  repliesCount: number;
  replyRate: number;
  meetingsBookedCount: number;
  meetingRate: number;
}
