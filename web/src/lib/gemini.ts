import { GoogleGenAI } from "@google/genai";

export interface OfferObservation {
  finding: string;
  impact: string;
  evidenceKey: string;
}

export interface ProposedModule {
  name: string;
  description: string;
  iconEmoji: string;
}

export interface ProcessStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface OfferContent {
  heroHeadline: string;
  heroObservation: string;
  observations: OfferObservation[];
  proposedModules: ProposedModule[];
  pricingRange: string;
  processSteps: ProcessStep[];
  ctaText: string;
}

export async function generateOfferContent(
  lead: {
    companyName: string;
    industry?: string | null;
    city?: string | null;
    website?: string | null;
  },
  audit?: {
    sslValid?: boolean | null;
    isResponsive?: boolean | null;
    cmsDetected?: string | null;
    hasGa4?: boolean | null;
    hasOnlineBooking?: boolean | null;
    hasContactForm?: boolean | null;
    metaAdsActive?: boolean | null;
  } | null
): Promise<OfferContent> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Jesteś głównym strategiem agencji marketingowej Procent Marketing (AM PROCENT Sp. z o.o., Legnica).
Przygotuj spersonalizowaną, elitarną ofertę B2B dla firmy:
- Nazwa: ${lead.companyName}
- Branża: ${lead.industry || "Usługi profesjonalne"}
- Miasto: ${lead.city || "Legnica"}
- Strona WWW: ${lead.website || "brak"}

TWARDE FAKTY Z AUDYTU (OPRZYJ SIĘ WYŁĄCZNIE NA NICH - ZAKAZ ZMYŚLANIA!):
- Certyfikat SSL: ${audit?.sslValid ? "Aktywny" : "Brak"}
- Responsywność mobile: ${audit?.isResponsive ? "Tak" : "Brak/Problematyczna"}
- System CMS: ${audit?.cmsDetected || "Niezidentyfikowany/Autorski"}
- Google Analytics 4: ${audit?.hasGa4 ? "Zainstalowane" : "BRAK"}
- Rezerwacja wizyt online: ${audit?.hasOnlineBooking ? "Obecna" : "BRAK (ogromny punkt straty klientów!)"}
- Formularz kontaktowy: ${audit?.hasContactForm ? "Obecny" : "BRAK"}
- Reklamy Meta Ads: ${audit?.metaAdsActive ? "Aktywny piksel" : "Brak piksela"}

Zwróć odpowiedź w czystym JSON zgodnym ze schematem:
{
  "heroHeadline": "Mocny, spersonalizowany nagłówek dla tej firmy",
  "heroObservation": "2-3 konkretne zdania o stanie ich obecności w sieci na bazie powyższych faktów",
  "observations": [
    {"finding": "Co zauważyliśmy", "impact": "Wpływ na biznes i utratę klientów", "evidenceKey": "klucz_faktu"}
  ],
  "proposedModules": [
    {"name": "Nazwa modułu", "description": "Krótki opis wdrożenia", "iconEmoji": "⚡"}
  ],
  "pricingRange": "od 2 500 do 4 500 zł / miesięcznie",
  "processSteps": [
    {"stepNumber": 1, "title": "Warsztat zerowy", "description": "Analiza procesów"},
    {"stepNumber": 2, "title": "Wdrożenie", "description": "Konfiguracja narzędzi"},
    {"stepNumber": 3, "title": "Optymalizacja", "description": "Maksymalizacja leadów"}
  ],
  "ctaText": "Umów 15-minutową konsultację z Dariuszem"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        return JSON.parse(response.text) as OfferContent;
      }
    } catch (err) {
      console.warn("Gemini API call failed, falling back to deterministic offer generator:", err);
    }
  }

  // Deterministic fallback grounded strictly in audit facts
  const observations: OfferObservation[] = [];
  const modules: ProposedModule[] = [];

  if (audit?.hasOnlineBooking === false) {
    observations.push({
      finding: "Brak zintegrowanego systemu rezerwacji wizyt online 24/7",
      impact: "Pacjenci i klienci rezygnują po godzinach pracy gabinetu, przechodząc do konkurencji z szybką rezerwacją.",
      evidenceKey: "online_booking_missing",
    });
    modules.push({
      name: "Autonomiczny System Rezerwacji Wizyt 24/7",
      description: "Integracja natychmiastowego kalendarza (Booksy/Calendly) z powiadomieniami SMS, eliminująca puste przebiegi.",
      iconEmoji: "📅",
    });
  }

  if (audit?.hasGa4 === false) {
    observations.push({
      finding: "Brak analityki zdarzeń Google Analytics 4",
      impact: "Brak możliwości mierzenia realnego ROI z działań promocyjnych i źródeł najbardziej zyskownych zapytań.",
      evidenceKey: "ga4_missing",
    });
    modules.push({
      name: "Zaawansowana Analityka Konwersji & Dashboard",
      description: "Konfiguracja GA4, GTM i raportu na żywo prezentującego realny koszt pozyskania leada.",
      iconEmoji: "📊",
    });
  }

  if (audit?.hasContactForm === false) {
    observations.push({
      finding: "Brak interaktywnego formularza pozyskiwania zapytań",
      impact: "Użytkownicy mobilni zmuszeni do kopiowania adresu email rezygnują z kontaktu.",
      evidenceKey: "contact_form_missing",
    });
    modules.push({
      name: "Wysoko-konwertujący Formularz Leadowy",
      description: "Dedykowany moduł szybkiego kontaktu z automatyczną notyfikacją handlowca w 60 sekund.",
      iconEmoji: "⚡",
    });
  }

  if (observations.length === 0) {
    observations.push({
      finding: "Obecna witryna posiada bazowe elementy, lecz brakuje automatyzacji leadów",
      impact: "Potencjał wzrostu zapytań z lokalnego rynku w rejonie Legnicy pozostaje niewykorzystany.",
      evidenceKey: "baseline_presence",
    });
    modules.push({
      name: "System Przechwytywania i Kwalifikacji Leadów B2B",
      description: "Dedykowany lejek marketingowy generujący gotowe do rozmowy zapytania z regionu Legnicy.",
      iconEmoji: "🎯",
    });
  }

  return {
    heroHeadline: `Skalowanie zapytań i automatyzacja obsługi klienta dla ${lead.companyName}`,
    heroObservation: `Przeprowadziliśmy wstępny audyt obecności cyfrowej firmy ${lead.companyName} w rejonie ${lead.city || "Legnicy"}. Zidentyfikowaliśmy kluczowe wąskie gardła ograniczające napływ nowych klientów z internetu.`,
    observations,
    proposedModules: modules,
    pricingRange: "od 2 800 zł do 4 900 zł / mies.",
    processSteps: [
      { stepNumber: 1, title: "Strategia & Audyt Zerowy", description: "Mapowanie ścieżki pacjenta/klienta i konfiguracja techniczna." },
      { stepNumber: 2, title: "Wdrożenie Automatyzacji", description: "Uruchomienie systemu rezerwacji, analityki oraz kampanii." },
      { stepNumber: 3, title: "Optymalizacja ROI", description: "Bieżące skalowanie zapytań z gwarancją jakości w Legnicy i regionie." },
    ],
    ctaText: "Umów 15-minutową bezpłatną konsultację",
  };
}
