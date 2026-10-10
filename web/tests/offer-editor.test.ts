import { describe, it } from "node:test";
import assert from "node:assert";
import { renderOfferPage, SenderInfo } from "../src/lib/html-renderer";
import { DEFAULT_SENDER_PROFILE } from "../src/app/api/settings/sender-profile/route";

describe("Offer Editor & Sender Profile Tests", () => {
  const dummyOffer = {
    heroHeadline: "Dedykowana Strategia Automatyzacji dla Testowa Sp. z o.o.",
    heroObservation: "Podczas audytu zauważyliśmy brak formularza rezerwacji online oraz brak analityki GA4.",
    observations: [
      { finding: "Brak GA4", impact: "Utrata danych o konwersji", evidenceKey: "audit_ga4" },
    ],
    proposedModules: [
      { name: "Moduł Lead Capture", description: "Automatyczne wychwytywanie kontaktów", iconEmoji: "⚡" },
    ],
    pricingRange: "od 3 500 zł / mies.",
    processSteps: [
      { stepNumber: 1, title: "Audyt techniczny", description: "Weryfikacja parametrów" },
    ],
    ctaText: "Umów bezpłatną konsultację",
  };

  const dummyLead = {
    companyName: "Testowa Sp. z o.o.",
    city: "Wrocław",
  };

  it("renders default sender information when sender info is omitted", () => {
    const html = renderOfferPage(dummyOffer, dummyLead, "testowa-sp-z-o-o");

    assert.ok(html.includes("Testowa Sp. z o.o."));
    assert.ok(html.includes("od 3 500 zł / mies."));
    assert.ok(html.includes("author-card"));
    assert.ok(html.includes("Dariusz"));
    assert.ok(html.includes("Założyciel & Strateg B2B"));
    assert.ok(html.includes("kontakt@procentmarketing.pl"));
    assert.ok(html.includes("PROCENT MARKETING"));
  });

  it("renders customized author signature card, company brand, and custom note", () => {
    const customSender: SenderInfo = {
      name: "Anna Nowak",
      role: "Dyrektor ds. Wdrożeń AI",
      company: "Kreatywna Agencja AI",
      email: "anna.nowak@kreatywna.pl",
      phone: "+48 600 123 456",
      website: "https://kreatywna.pl",
      bookingUrl: "https://cal.com/anna-nowak/30min",
      customNote: "W razie dodatkowych pytań wdrożeniowych, proszę o bezpośredni kontakt telefoniczny lub rezerwację terminu.",
    };

    const html = renderOfferPage(
      dummyOffer,
      dummyLead,
      "testowa-sp-z-o-o",
      "https://cal.com/default",
      customSender
    );

    // Verify dynamic header brand
    assert.ok(html.includes("KREATYWNA AGENCJA AI"));
    
    // Verify author card details
    assert.ok(html.includes("Anna Nowak"));
    assert.ok(html.includes("Dyrektor ds. Wdrożeń AI"));
    assert.ok(html.includes("mailto:anna.nowak@kreatywna.pl"));
    assert.ok(html.includes("tel:+48 600 123 456"));
    assert.ok(html.includes("https://kreatywna.pl"));
    assert.ok(html.includes("https://cal.com/anna-nowak/30min"));
    assert.ok(html.includes("W razie dodatkowych pytań wdrożeniowych"));

    // Verify footer brand
    assert.ok(html.includes("kreatywna.pl/rodo"));
  });

  it("validates DEFAULT_SENDER_PROFILE structure", () => {
    assert.ok(DEFAULT_SENDER_PROFILE.senderName);
    assert.ok(DEFAULT_SENDER_PROFILE.senderEmail.includes("@"));
    assert.ok(DEFAULT_SENDER_PROFILE.senderRole);
    assert.ok(DEFAULT_SENDER_PROFILE.senderCompany);
    assert.ok(DEFAULT_SENDER_PROFILE.bookingUrl.startsWith("http"));
    assert.ok(DEFAULT_SENDER_PROFILE.companyDescription);
    assert.equal(DEFAULT_SENDER_PROFILE.pricingModel, "rev_share");
    assert.ok(DEFAULT_SENDER_PROFILE.pricingCustomRate?.includes("50%"));
  });

  it("renders rev-share (50% podział zysku) pricing model properly", () => {
    const revShareOffer = {
      ...dummyOffer,
      pricingRange: "50% podział zysku (Success Fee)",
      ctaText: "Sprawdź warunki współpracy",
    };

    const html = renderOfferPage(revShareOffer, dummyLead, "testowa");
    assert.ok(html.includes("Model prowizyjny &amp; Podział zysku (Success Fee)") || html.includes("Model prowizyjny & Podział zysku (Success Fee)"));
    assert.ok(html.includes("50% podział zysku (Success Fee)"));
    assert.ok(html.includes("Dzielimy się wygenerowanym zyskiem"));
    assert.ok(html.includes("Sprawdź warunki współpracy"));
  });

  it("renders hourly and fixed project models properly", () => {
    // Hourly
    const hourlyOffer = {
      ...dummyOffer,
      pricingRange: "180 zł / godz.",
      ctaText: "Zapytaj o wycenę",
    };
    const htmlHourly = renderOfferPage(hourlyOffer, dummyLead, "testowa");
    assert.ok(htmlHourly.includes("Stawka godzinowa (Time &amp; Material)") || htmlHourly.includes("Stawka godzinowa (Time & Material)"));
    assert.ok(htmlHourly.includes("180 zł / godz."));

    // Project
    const projectOffer = {
      ...dummyOffer,
      pricingRange: "od 3 500 zł za wdrożenie",
      ctaText: "Sprawdź zakres prac",
    };
    const htmlProj = renderOfferPage(projectOffer, dummyLead, "testowa");
    assert.ok(htmlProj.includes("Inwestycja wdrożeniowa (Projekt)"));
    assert.ok(htmlProj.includes("od 3 500 zł za wdrożenie"));
  });

  it("renders empty pricing as 'Wycena indywidualna' and 'Sprawdź ceny' without fake numbers", () => {
    const noPriceOffer = {
      ...dummyOffer,
      pricingRange: "",
      ctaText: "Sprawdź ceny",
    };
    const html = renderOfferPage(noPriceOffer, dummyLead, "testowa");
    assert.ok(html.includes("Model współpracy"));
    assert.ok(html.includes("Wycena indywidualna"));
    assert.ok(html.includes("Sprawdź ceny"));
    assert.ok(!html.includes("2 800"));
  });
});
