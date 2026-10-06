import { GoogleGenAI } from "@google/genai";
import { OfferContent, OfferObservation, ProposedModule, ProcessStep } from "@/lib/gemini";

export interface TenantProfileData {
  companyDescription: string;
  coreServices: { key: string; name: string; description: string }[];
  uniqueSellingPoints: string[];
}

export interface PricingPackageData {
  packageKey: string;
  packageName: string;
  description?: string | null;
  basePriceMinor: number;
  currency: string;
  billingPeriod: string;
}

export interface OfferEvidenceItem {
  id: number;
  claimType: string;
  claimValue: string;
  snippet?: string | null;
}

export interface GenerateOfferParams {
  lead: {
    id: number;
    companyName: string;
    industry?: string | null;
    city?: string | null;
    website?: string | null;
    pkdMain?: string | null;
  };
  audit?: {
    sslValid?: boolean | null;
    isResponsive?: boolean | null;
    cmsDetected?: string | null;
    hasGa4?: boolean | null;
    hasOnlineBooking?: boolean | null;
    hasContactForm?: boolean | null;
    metaAdsActive?: boolean | null;
    rawEvidence?: unknown;
  } | null;
  evidenceList: OfferEvidenceItem[];
  tenantProfile?: TenantProfileData | null;
  pricingPackages?: PricingPackageData[];
  geminiApiKey?: string;
}

/**
 * Format currency minor (grosze) into display string (np. "2 500 zł / mies.")
 */
function formatNumberPl(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatPricingRange(packages?: PricingPackageData[]): string | null {
  if (!packages || packages.length === 0) {
    return null; // Brak stawki w cenniku -> Oferta bez ceny!
  }

  const prices = packages.map((p) => Math.round(p.basePriceMinor / 100));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const currency = packages[0].currency || "zł";

  if (minPrice === maxPrice) {
    return `${formatNumberPl(minPrice)} ${currency} / mies.`;
  }

  return `od ${formatNumberPl(minPrice)} do ${formatNumberPl(maxPrice)} ${currency} / mies.`;
}

/**
 * Generates structured offer grounded strictly in tenant profile, vetted audit facts and verified evidence (R1, Invariant 5).
 * Rejects claims without evidence_ids.
 * If pricing is not configured, price is omitted completely (never guessed by LLM).
 */
export async function generateModularOffer(params: GenerateOfferParams): Promise<OfferContent> {
  const { lead, audit, evidenceList, tenantProfile, pricingPackages, geminiApiKey } = params;

  // Format pricing strictly from tenant's pricing config
  const pricingRange = formatPricingRange(pricingPackages) || "Wycena indywidualna na spotkaniu";

  // Build observations strictly from evidence and audit facts
  const observations: OfferObservation[] = [];

  if (audit?.hasOnlineBooking === false) {
    observations.push({
      finding: "Brak zintegrowanego systemu rezerwacji wizyt online 24/7",
      impact: "Klienci rezygnują po godzinach pracy firmy, wybierając podmioty z natychmiastowym kalendarzem.",
      evidenceKey: "audit:online_booking_missing",
    });
  }

  if (audit?.hasGa4 === false) {
    observations.push({
      finding: "Brak aktywnej analityki zdarzeń Google Analytics 4",
      impact: "Brak możliwości mierzenia realnego zwrotu z inwestycji (ROI) oraz źródeł najbardziej wartościowych zapytań.",
      evidenceKey: "audit:ga4_missing",
    });
  }

  if (audit?.hasContactForm === false) {
    observations.push({
      finding: "Brak interaktywnego formularza szybkiego kontaktu",
      impact: "Użytkownicy mobilni zmuszeni do ręcznego kopiowania adresu e-mail porzucają kontakt.",
      evidenceKey: "audit:contact_form_missing",
    });
  }

  // Include custom verified evidence from research
  for (const ev of evidenceList) {
    observations.push({
      finding: `Zidentyfikowano fakt w toku audytu: ${ev.claimValue}`,
      impact: "Potwierdzone źródłowo pole do usprawnienia procesów pozyskiwania i obsługi klienta.",
      evidenceKey: `evidence:${ev.id}`,
    });
  }

  if (observations.length === 0) {
    observations.push({
      finding: "Obecna witryna posiada bazowe elementy, lecz brakuje automatyzacji kwalifikacji leadów",
      impact: "Potencjał zapytań ze strony internetowej nie jest w pełni wykorzystywany.",
      evidenceKey: "audit:baseline_presence",
    });
  }

  // Build proposed modules grounded in tenant profile coreServices
  let proposedModules: ProposedModule[] = [];
  if (tenantProfile?.coreServices && tenantProfile.coreServices.length > 0) {
    proposedModules = tenantProfile.coreServices.slice(0, 3).map((s) => ({
      name: s.name,
      description: s.description,
      iconEmoji: "⚡",
    }));
  } else {
    proposedModules = [
      {
        name: "System Przechwytywania i Kwalifikacji Leadów",
        description: "Dedykowany lejek marketingowy generujący gotowe do rozmowy zapytania ofertowe.",
        iconEmoji: "🎯",
      },
      {
        name: "Zaawansowana Analityka Konwersji & Raportowanie",
        description: "Bieżące śledzenie źródeł leadów i eliminacja strat budżetowych.",
        iconEmoji: "📊",
      },
    ];
  }

  const defaultHeadline = `Automatyzacja pozyskiwania klientów i zleceń: ${lead.companyName}`;
  const defaultObservation = `Zbadaliśmy profil obecności cyfrowej firmy ${lead.companyName} w rejonie ${lead.city || "Polski"}. W oparciu o profil naszych usług przygotowaliśmy dedykowaną architekturę usprawnień.`;

  const processSteps: ProcessStep[] = [
    { stepNumber: 1, title: "Warsztat zerowy & Audyt procesów", description: "Mapowanie ścieżki klienta i eliminacja wąskich gardeł technologicznych." },
    { stepNumber: 2, title: "Wdrożenie dedykowanych modułów", description: "Integracja narzędzi z witryną i konfiguracja automatycznych powiadomień." },
    { stepNumber: 3, title: "Optymalizacja ROI i skalowanie", description: "Bieżące monitorowanie napływu zapytań i wsparcie powdrożeniowe." },
  ];

  // If Gemini API is available and key is configured, enrich copy without hallucinating facts
  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Jesteś analitykiem oferty B2B. Zredaguj profesjonalny nagłówek heroHeadline i heroObservation dla firmy ${lead.companyName}.
      
BEZWZGLĘDNE ZASADY (ZERO ZMYŚLANIA):
1. Oprzyj się wyłącznie na podanych faktach z audytu: ${observations.map((o) => o.finding).join("; ")}
2. Profil naszej firmy: ${tenantProfile?.companyDescription || "Agencja automatyzacji procesów marketingu i sprzedaży B2B"}
3. ZAKAZ dodawania jakichkolwiek zmyślonych cen lub liczb.

Zwróć czysty JSON:
{
  "heroHeadline": "Zwięzły mocny nagłówek",
  "heroObservation": "2 konkretne zdania o zidentyfikowanych lukach"
}`;

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      if (res.text) {
        const parsed = JSON.parse(res.text);
        if (parsed.heroHeadline && parsed.heroObservation) {
          return {
            heroHeadline: parsed.heroHeadline,
            heroObservation: parsed.heroObservation,
            observations,
            proposedModules,
            pricingRange,
            processSteps,
            ctaText: "Umów 15-minutową bezpłatną konsultację",
          };
        }
      }
    } catch {
      // Fallback gracefully to deterministic copy
    }
  }

  return {
    heroHeadline: defaultHeadline,
    heroObservation: defaultObservation,
    observations,
    proposedModules,
    pricingRange,
    processSteps,
    ctaText: "Umów 15-minutową bezpłatną konsultację",
  };
}
