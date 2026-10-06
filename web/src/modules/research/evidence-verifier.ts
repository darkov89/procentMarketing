import { FitRubricDefinition } from "../campaigns/playbook.schema";

export interface ExtractedClaim {
  type: string; // e.g. "child_support", "community_support", "csr_contact", "application_form"
  value: string;
  quote: string;
  url?: string;
  publishedDate?: string;
}

export interface VerifiedEvidence {
  claimType: string;
  claimValue: string;
  quote: string;
  sourceUrl?: string;
  verifiedAt: Date;
  confidence: number;
}

export interface VerificationResult {
  verified: VerifiedEvidence[];
  rejected: { claim: ExtractedClaim; reason: string }[];
}

export interface FitAssessment {
  priority: number | null;
  fitReason: string;
  requiresManualReview: boolean;
  matchedEvidence: VerifiedEvidence[];
}

/**
 * Normalizes text for strict programmatic quote containment verification (R11).
 * Removes extra whitespaces, normalizes Unicode quotes/dashes, and converts to lower case.
 */
export function normalizeForVerification(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Programmatically verifies quotes from untrusted scraped web content (R1, R11).
 * Rejects any claim whose normalized quote is not a strict substring of the scraped text.
 */
export function verifyClaimsAgainstSource(
  scrapedSourceText: string,
  claims: ExtractedClaim[],
  sourceUrl?: string
): VerificationResult {
  const normalizedSource = normalizeForVerification(scrapedSourceText);
  const verified: VerifiedEvidence[] = [];
  const rejected: { claim: ExtractedClaim; reason: string }[] = [];

  for (const claim of claims) {
    if (!claim.quote || typeof claim.quote !== "string" || claim.quote.trim().length === 0) {
      rejected.push({ claim, reason: "Missing quote" });
      continue;
    }

    const normalizedQuote = normalizeForVerification(claim.quote);

    // Rule R11: quote MUST be a programmatic substring of the scraped source
    if (!normalizedSource.includes(normalizedQuote)) {
      rejected.push({
        claim,
        reason: "Quote hallucination: quote does not exist verbatim in source text",
      });
      continue;
    }

    // Minimum quote length to avoid trivial 1-letter matches
    if (normalizedQuote.length < 5) {
      rejected.push({ claim, reason: "Quote too short to serve as evidence (< 5 chars)" });
      continue;
    }

    verified.push({
      claimType: claim.type,
      claimValue: claim.value || claim.quote,
      quote: claim.quote.trim(),
      sourceUrl: claim.url || sourceUrl,
      verifiedAt: new Date(),
      confidence: 1.0,
    });
  }

  return { verified, rejected };
}

/**
 * Evaluates verified evidence against campaign playbook fit rubric.
 * Produces structured priority, templated fit_reason, and manual review flag.
 * Zero hallucination: fit_reason uses deterministic template based strictly on evidence.
 */
export function evaluateFitRubric(
  evidenceList: VerifiedEvidence[],
  rubric?: FitRubricDefinition
): FitAssessment {
  if (!rubric || !rubric.levels || rubric.levels.length === 0) {
    return {
      priority: null,
      fitReason: "Brak zdefiniowanej rubryki dopasowania w playbooku",
      requiresManualReview: true,
      matchedEvidence: [],
    };
  }

  const evidenceTypes = new Set(evidenceList.map((e) => e.claimType));

  if (evidenceList.length === 0) {
    // If no evidence at all, check if there is a level requiring [] and whether fallback behavior applies
    const catchAll = rubric.levels.find((l) => l.requires.length === 0);
    if (catchAll && rubric.noEvidenceBehavior === "pass") {
      return {
        priority: catchAll.priority,
        fitReason: `Dopasowanie Poziom ${catchAll.priority}: ${catchAll.label} (brak bezpośrednich dowodów)`,
        requiresManualReview: Boolean(catchAll.forceManualReview),
        matchedEvidence: [],
      };
    }

    return {
      priority: null,
      fitReason: "Brak dowodów w źródle — wymagana weryfikacja człowieka",
      requiresManualReview: true,
      matchedEvidence: [],
    };
  }

  for (const level of rubric.levels) {
    let matches = false;

    if (level.requires.length === 0) {
      // Catch-all level
      matches = true;
    } else {
      // Check requirement expressions e.g. "evidence:child_support", "evidence:community_support"
      matches = level.requires.every((req: string) => {
        if (req.includes(" OR ")) {
          const parts = req.split(" OR ").map((p: string) => p.trim());
          return parts.some((p: string) => {
            const type = p.replace("evidence:", "").replace("role:", "");
            return evidenceTypes.has(type);
          });
        }

        const type = req.replace("evidence:", "").replace("role:", "").trim();
        return evidenceTypes.has(type);
      });
    }

    if (matches) {
      const matched = evidenceList.filter((e) =>
        level.requires.some((r: string) => r.includes(e.claimType))
      );

      return {
        priority: level.priority,
        fitReason: `Dopasowanie Poziom ${level.priority}: ${level.label} (potwierdzone dowodami: ${
          matched.length > 0 ? matched.map((m) => m.claimType).join(", ") : "kryterium ogólne"
        })`,
        requiresManualReview: Boolean(level.forceManualReview),
        matchedEvidence: matched,
      };
    }
  }

  // Fallback behavior when no evidence matches
  const fallbackReview = rubric.noEvidenceBehavior === "manual_review";
  return {
    priority: null,
    fitReason: "Brak spełnionych kryteriów rubryki dopasowania — wymagana weryfikacja człowieka",
    requiresManualReview: fallbackReview,
    matchedEvidence: [],
  };
}
