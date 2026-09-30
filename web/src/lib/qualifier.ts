/**
 * 3-Tier Autonomous Qualification Matrix & Scoring Engine.
 * Implements strict rules: Auto-Qualified, Needs-Review (human in the loop), and Auto-Disqualified.
 */

export enum LeadDecision {
  AUTO_QUALIFIED = "auto_qualified",
  NEEDS_REVIEW = "needs_review",
  AUTO_DISQUALIFIED = "auto_disqualified",
}

export interface ScoreBreakdown {
  industryMatchScore: number;
  automationNeedScore: number;
  paymentAbilityScore: number;
  reachabilityScore: number;
  otherSignalsScore: number;
  totalScore: number;
  decision: LeadDecision;
  confidence: "high" | "medium" | "low";
  automationFitReasons: string[];
}

export interface QualificationResult {
  decision: LeadDecision;
  totalScore: number;
  suggestedStatus: "qualified" | "needs_review" | "disqualified";
  rejectionReason: string | null;
  reviewReason: string | null;
  breakdown: ScoreBreakdown;
}

// Banned micro-retail & fitness keywords ("Sklep Pani Krysi", trenerzy, etc.)
const BLACKLISTED_KEYWORDS = [
  "sklep spożywczy",
  "warzywniak",
  "odzież używana",
  "lumpeks",
  "second hand",
  "kiosk",
  "lombard",
  "pasmanteria",
  "szewc",
  "trener personalny",
  "trener fitness",
  "instruktor fitness",
  "siłownia",
  "fitness club",
  "sztuki walki",
  "crossfit",
  "yoga",
];

// Priority high-ticket automation industries
const PRIORITY_INDUSTRIES: Record<string, number> = {
  stomatolog: 30,
  dentyst: 30,
  medycyn: 30,
  lekar: 30,
  klinic: 30,
  kancelari: 28,
  adwokat: 28,
  radca: 28,
  prawn: 28,
  księgow: 28,
  rachunkow: 28,
  fotowoltaik: 26,
  oze: 26,
  "pompy ciepła": 26,
  automatyk: 26,
  b2b: 25,
};

export function qualifyLead(
  lead: {
    companyName: string;
    industry?: string | null;
    city?: string | null;
    website?: string | null;
    emailPrimary?: string | null;
    phoneNormalized?: string | null;
    krs?: string | null;
    nip?: string | null;
    distanceKm?: number | null;
  },
  audit?: {
    sslValid?: boolean | null;
    isResponsive?: boolean | null;
    hasGa4?: boolean | null;
    hasOnlineBooking?: boolean | null;
    hasContactForm?: boolean | null;
    metaAdsActive?: boolean | null;
  } | null
): QualificationResult {
  const compLower = lead.companyName.toLowerCase();
  const indLower = (lead.industry || "").toLowerCase();
  const combined = `${compLower} ${indLower}`;

  // 1. HARD RULE: Blacklisted industries (Pani Krysia, trainer, pawn shop)
  for (const kw of BLACKLISTED_KEYWORDS) {
    if (combined.includes(kw)) {
      return {
        decision: LeadDecision.AUTO_DISQUALIFIED,
        totalScore: 15,
        suggestedStatus: "disqualified",
        rejectionReason: `Branża wykluczona polityką agencji: '${kw}' (mikro-handel / fitness)`,
        reviewReason: null,
        breakdown: {
          industryMatchScore: 0,
          automationNeedScore: 10,
          paymentAbilityScore: 5,
          reachabilityScore: 0,
          otherSignalsScore: 0,
          totalScore: 15,
          decision: LeadDecision.AUTO_DISQUALIFIED,
          confidence: "high",
          automationFitReasons: [],
        },
      };
    }
  }

  // 2. Compute Category Scores
  let industryScore = 15; // default general industry
  let isPriority = false;
  const automationReasons: string[] = [];

  for (const [key, pts] of Object.entries(PRIORITY_INDUSTRIES)) {
    if (combined.includes(key)) {
      industryScore = pts;
      isPriority = true;
      break;
    }
  }

  // Automation Need (max 25 pts)
  let automationScore = 0;
  if (audit) {
    if (audit.hasOnlineBooking === false) {
      automationScore += 10;
      automationReasons.push("Brak systemu rezerwacji wizyt online (Booksy/Calendly)");
    }
    if (audit.hasContactForm === false) {
      automationScore += 8;
      automationReasons.push("Brak formularza kontaktowego na stronie");
    }
    if (audit.hasGa4 === false) {
      automationScore += 7;
      automationReasons.push("Brak Google Analytics 4 do pomiaru konwersji");
    }
  } else {
    // No audit yet - standard baseline
    automationScore = 12;
  }

  // Payment Ability & Legal Structure (max 20 pts)
  let paymentScore = 12;
  if (lead.krs) {
    paymentScore = 20; // Sp. z o.o. or Sp.k.
  } else if (lead.nip) {
    paymentScore = 15; // Verified JDG
  }

  // Reachability (max 15 pts)
  let reachScore = 0;
  if (lead.emailPrimary) reachScore += 10;
  if (lead.phoneNormalized) reachScore += 5;

  // Other signals (max 10 pts)
  let otherScore = 5;
  if (audit?.metaAdsActive) {
    otherScore += 5;
    automationReasons.push("Firma inwestuje w reklamy Meta Ads");
  }

  const totalScore = Math.min(
    100,
    industryScore + automationScore + paymentScore + reachScore + otherScore
  );

  // 4. Decision Matrix Thresholds
  let decision: LeadDecision;
  let status: "qualified" | "needs_review" | "disqualified";
  let rejectionReason: string | null = null;
  let reviewReason: string | null = null;

  if (isPriority && totalScore >= 58) {
    decision = LeadDecision.AUTO_QUALIFIED;
    status = "qualified";
  } else if (!isPriority && totalScore >= 68) {
    decision = LeadDecision.AUTO_QUALIFIED;
    status = "qualified";
  } else if (totalScore < 46) {
    decision = LeadDecision.AUTO_DISQUALIFIED;
    status = "disqualified";
    rejectionReason = `Niski scoring automatyzacji (${totalScore}/100 pkt)`;
  } else {
    // 46 - 67 pts non-priority or uncertain
    decision = LeadDecision.NEEDS_REVIEW;
    status = "needs_review";
    reviewReason = `Przypadek graniczny (${totalScore} pkt): wymaga 1-kliknięcia człowieka`;
  }

  return {
    decision,
    totalScore,
    suggestedStatus: status,
    rejectionReason,
    reviewReason,
    breakdown: {
      industryMatchScore: industryScore,
      automationNeedScore: automationScore,
      paymentAbilityScore: paymentScore,
      reachabilityScore: reachScore,
      otherSignalsScore: otherScore,
      totalScore,
      decision,
      confidence: isPriority ? "high" : "medium",
      automationFitReasons: automationReasons,
    },
  };
}
