export interface LeadAudit {
  id?: number;
  leadId?: number;
  sslValid?: boolean | null;
  isResponsive?: boolean | null;
  hasGa4?: boolean | null;
  hasOnlineBooking?: boolean | null;
  bookingTool?: string | null;
  cmsPlatform?: string | null;
  estimatedTraffic?: number | null;
  pageLoadSpeedScore?: number | null;
  mobileLoadSpeedScore?: number | null;
  seoScore?: number | null;
  accessibilityScore?: number | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  issues?: Array<{
    type?: string;
    description: string;
    severity?: "critical" | "warning" | "info";
  }> | null;
  recommendations?: Array<{
    title: string;
    description?: string;
    impact?: string;
  }> | null;
  rawEvidence?: {
    businessActivity?: string;
    pageTitle?: string;
    headings?: string[];
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LeadOffer {
  id: number;
  leadId: number;
  title: string;
  slug: string;
  token?: string | null;
  headline?: string | null;
  heroObservation?: string | null;
  modules?: Array<{
    id: string;
    title: string;
    description: string;
    pricePLN?: number;
    benefits?: string[];
  }> | null;
  pricingPackages?: Array<{
    name: string;
    pricePLN: number;
    description?: string;
    features?: string[];
  }> | null;
  ctaText?: string | null;
  ctaButtonText?: string | null;
  customPitch?: string | null;
  viewCount?: number;
  lastViewedAt?: string | null;
  authorSignature?: {
    name?: string;
    role?: string;
    company?: string;
    phone?: string;
    email?: string;
    website?: string;
    note?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LeadContact {
  id: number;
  leadId: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  linkedinUrl?: string | null;
  isPrimary?: boolean;
  [key: string]: unknown;
}

export interface LeadMessage {
  id: number;
  leadId: number;
  direction: "inbound" | "outbound";
  status: "draft" | "queued" | "sending" | "sent" | "delivered" | "failed" | "opened" | "replied" | "bounced";
  channel: string;
  subject?: string | null;
  bodySnippet?: string | null;
  bodyHtml?: string | null;
  recipientEmail?: string | null;
  senderEmail?: string | null;
  sequenceStep?: number | null;
  sentAt?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export interface LeadEvent {
  id: number;
  leadId: number;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor?: string | null;
  reason?: string | null;
  payload?: any;
  createdAt: string;
  [key: string]: unknown;
}

export interface FullLeadDossier {
  id: number;
  companyName: string;
  nip?: string | null;
  krs?: string | null;
  website?: string | null;
  phoneNormalized?: string | null;
  emailPrimary?: string | null;
  address?: string | null;
  city?: string | null;
  distanceKm?: number | null;
  industry?: string | null;
  status: string;
  score: number;
  scoreBreakdown?: {
    companyScale?: "mikro" | "male" | "msp";
    businessActivity?: string;
    vatStatus?: string;
    legalForm?: string;
    regon?: string;
    registrySource?: string;
    registryVerified?: boolean;
    [key: string]: unknown;
  } | null;
  rejectionReason?: string | null;
  ownerConfidence?: string | null;
  notes?: string | null;
  createdAt?: string;
  audit?: LeadAudit | null;
  offer?: LeadOffer | null;
  contacts?: LeadContact[];
  messages?: LeadMessage[];
  leadEvents?: LeadEvent[];
}

export type DossierTab = "dane" | "dowody" | "kontakt" | "oferta" | "korespondencja" | "zadania" | "historia";
