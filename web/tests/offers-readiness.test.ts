import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkOfferReadiness,
  LeadReadinessInput,
  TenantProfileInput,
} from "../src/modules/offers/readiness";
import {
  generateModularOffer,
  formatPricingRange,
  PricingPackageData,
} from "../src/modules/offers/generator";
import { renderModularOfferPage } from "../src/modules/offers/html-renderer";
import { AGENCY_SALES_PRESET, SPONSORSHIP_FUNDRAISING_PRESET } from "../src/modules/campaigns/playbook.schema";

describe("Phase 4 Optional Modules: Offers, Pricing & Readiness Invariants", () => {
  const sampleLead: LeadReadinessInput = {
    companyName: "Kowalski Dachy Sp. z o.o.",
    website: "https://kowalski-dachy.pl",
    emailPrimary: "biuro@kowalski-dachy.pl",
  };

  const sampleProfile: TenantProfileInput = {
    companyDescription: "Agencja automatyzacji procesów sprzedaży i marketingu B2B",
    coreServices: [{ key: "growth", name: "Lejek B2B", description: "Automatyzacja pozyskiwania leadów" }],
    uniqueSellingPoints: ["100% audytowalny proces", "Dedykowane strony ofertowe"],
  };

  const samplePricing: PricingPackageData[] = [
    {
      packageKey: "standard",
      packageName: "Pakiet Wzrost",
      basePriceMinor: 250000, // 2 500 zł
      currency: "zł",
      billingPeriod: "monthly",
    },
    {
      packageKey: "pro",
      packageName: "Pakiet Skalowanie",
      basePriceMinor: 450000, // 4 500 zł
      currency: "zł",
      billingPeriod: "monthly",
    },
  ];

  it("readiness gate passes when all playbook conditions are met", () => {
    const report = checkOfferReadiness({
      lead: sampleLead,
      playbook: AGENCY_SALES_PRESET,
      tenantProfile: sampleProfile,
      pricingConfig: { packagesCount: 2 },
      evidence: { evidenceCount: 3 },
    });

    assert.equal(report.isReady, true, "Readiness gate should pass");
    assert.equal(report.missingItems.length, 0);
  });

  it("readiness gate identifies missing items with concrete remediation actions (no dead ends)", () => {
    // Missing tenant profile and pricing config
    const report = checkOfferReadiness({
      lead: sampleLead,
      playbook: AGENCY_SALES_PRESET,
      tenantProfile: null,
      pricingConfig: { packagesCount: 0 },
      evidence: { evidenceCount: 2 },
    });

    assert.equal(report.isReady, false, "Readiness gate must fail");
    assert.equal(report.missingItems.length, 2);

    const profileMissing = report.missingItems.find((i) => i.code === "TENANT_PROFILE");
    assert.ok(profileMissing, "Must flag missing tenant profile");
    assert.equal(profileMissing.actionLabel, "Uzupełnij profil firmy");
    assert.equal(profileMissing.actionUrl, "/settings/profile");

    const pricingMissing = report.missingItems.find((i) => i.code === "PRICING_CONFIGURED");
    assert.ok(pricingMissing, "Must flag missing pricing");
    assert.equal(pricingMissing.actionLabel, "Skonfiguruj stawki w cenniku");
  });

  it("bypasses offer readiness automatically when campaign has modules.offers = false (Foundation mode)", () => {
    const report = checkOfferReadiness({
      lead: sampleLead,
      playbook: SPONSORSHIP_FUNDRAISING_PRESET, // modules.offers = false
      tenantProfile: null, // missing, but irrelevant because offers module is disabled!
      pricingConfig: null,
    });

    assert.equal(report.isReady, true, "Foundation mode without offers module must be immediately ready");
    assert.equal(report.modulesEnabled.offers, false);
  });

  it("formats pricing range strictly from database packages in PLN (Invariant 5)", () => {
    const formatted = formatPricingRange(samplePricing);
    assert.equal(formatted, "od 2 500 do 4 500 zł / mies.");

    // Single package
    const single = formatPricingRange([samplePricing[0]]);
    assert.equal(single, "2 500 zł / mies.");
  });

  it("strictly omits price and sets transparent label when pricing is not configured (R1 Zero Price Guessing)", () => {
    const emptyPrice = formatPricingRange([]);
    assert.equal(emptyPrice, null, "Unconfigured pricing must return null without hallucinating prices");

    const offer = generateModularOffer({
      lead: { id: 1, companyName: "Kowalski Dachy" },
      evidenceList: [],
      pricingPackages: [], // No pricing packages configured!
      tenantProfile: {
        companyDescription: sampleProfile.companyDescription!,
        coreServices: [{ key: "growth", name: "Lejek B2B", description: "Opis" }],
        uniqueSellingPoints: ["USP 1"],
      },
    });

    return offer.then((res) => {
      assert.equal(res.pricingRange, "Wycena indywidualna na spotkaniu");
    });
  });

  it("renders public offer page gracefully with and without prices", async () => {
    const offerWithPrice = await generateModularOffer({
      lead: { id: 1, companyName: "Kowalski Dachy" },
      evidenceList: [
        {
          id: 101,
          claimType: "csr_contact",
          claimValue: "Kontakt do fundacji",
          snippet: "kontakt@csr.pl",
        },
      ],
      pricingPackages: samplePricing,
      tenantProfile: {
        companyDescription: sampleProfile.companyDescription!,
        coreServices: [{ key: "growth", name: "Lejek B2B", description: "Opis" }],
        uniqueSellingPoints: ["USP 1"],
      },
    });

    const html = renderModularOfferPage(offerWithPrice, { companyName: "Kowalski Dachy" }, "kowalski-dachy");
    assert.ok(html.includes("od 2 500 do 4 500 zł / mies."));
    assert.ok(html.includes("Inwestycja miesięczna"));

    // Render without price
    const offerWithoutPrice = await generateModularOffer({
      lead: { id: 1, companyName: "Kowalski Dachy" },
      evidenceList: [],
      pricingPackages: [], // empty
    });

    const htmlNoPrice = renderModularOfferPage(offerWithoutPrice, { companyName: "Kowalski Dachy" }, "kowalski-dachy");
    assert.ok(htmlNoPrice.includes("Wycena indywidualna"));
    assert.ok(htmlNoPrice.includes("Model współpracy"));
  });
});
