export interface LeadItem {
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
    [key: string]: unknown;
  } | null;
  rejectionReason?: string | null;
  ownerConfidence?: string | null;
  notes?: string | null;
  createdAt?: string;
  audit?: {
    rawEvidence?: {
      businessActivity?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  } | null;
  offer?: {
    token?: string | null;
    slug?: string | null;
    title?: string | null;
    heroObservation?: string | null;
    pricingRange?: string | null;
    ctaText?: string | null;
    bookingUrl?: string | null;
    proposedModules?: unknown[];
    senderName?: string | null;
    senderRole?: string | null;
    senderEmail?: string | null;
    senderPhone?: string | null;
    senderCompany?: string | null;
    senderWebsite?: string | null;
    customNote?: string | null;
    [key: string]: unknown;
  } | null;
  contacts?: Array<{
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    [key: string]: unknown;
  }>;
  messages?: unknown[];
}
