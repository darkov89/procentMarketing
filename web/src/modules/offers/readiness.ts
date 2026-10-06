import { PlaybookDefinition } from "../campaigns/playbook.schema";

export interface ReadinessCheckItem {
  code: string;
  label: string;
  satisfied: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

export interface ReadinessReport {
  isReady: boolean;
  modulesEnabled: {
    offers: boolean;
    audit: boolean;
    pricing: boolean;
  };
  checks: ReadinessCheckItem[];
  missingItems: ReadinessCheckItem[];
}

export interface LeadReadinessInput {
  companyName: string;
  website?: string | null;
  emailPrimary?: string | null;
  phoneNormalized?: string | null;
}

export interface TenantProfileInput {
  companyDescription?: string | null;
  coreServices?: unknown;
  uniqueSellingPoints?: string[];
}

export interface PricingConfigInput {
  packagesCount: number;
}

export interface EvidenceInput {
  evidenceCount: number;
}

/**
 * Readiness gate checking all conditions before an offer or sequence action can proceed.
 * Guarantees NO DEAD ENDS: Every missing requirement provides a concrete remediation action.
 */
export function checkOfferReadiness(params: {
  lead: LeadReadinessInput;
  playbook: PlaybookDefinition;
  tenantProfile?: TenantProfileInput | null;
  pricingConfig?: PricingConfigInput | null;
  evidence?: EvidenceInput | null;
}): ReadinessReport {
  const { lead, playbook, tenantProfile, pricingConfig, evidence } = params;
  const modulesEnabled = {
    offers: playbook.modules.offers,
    audit: playbook.modules.audit,
    pricing: playbook.modules.pricing,
  };

  const checks: ReadinessCheckItem[] = [];

  // 1. If offers module is disabled (e.g. Foundation / Brief mode), offer generation is not required
  if (!modulesEnabled.offers) {
    return {
      isReady: true,
      modulesEnabled,
      checks: [
        {
          code: "OFFERS_MODULE_DISABLED",
          label: "Moduł ofert jest wyłączony w playbooku kampanii (tryb bezpośredni)",
          satisfied: true,
        },
      ],
      missingItems: [],
    };
  }

  // 2. Tenant Profile Check
  const hasProfile = Boolean(
    tenantProfile?.companyDescription &&
      tenantProfile.companyDescription.trim().length > 10 &&
      Array.isArray(tenantProfile?.uniqueSellingPoints) &&
      tenantProfile.uniqueSellingPoints.length > 0
  );
  checks.push({
    code: "TENANT_PROFILE",
    label: "Profil tenanta uzupełniony (opis firmy i unikalne atuty USP)",
    satisfied: hasProfile,
    actionLabel: "Uzupełnij profil firmy",
    actionUrl: "/settings/profile",
  });

  // 3. Evidence / Audit Check (if audit module enabled)
  if (modulesEnabled.audit) {
    const hasEvidence = Boolean(evidence && evidence.evidenceCount > 0);
    checks.push({
      code: "AUDIT_EVIDENCE",
      label: "Udokumentowane dowody z audytu technicznego lub researchu",
      satisfied: hasEvidence,
      actionLabel: "Uruchom audyt strony",
      actionUrl: `/leads/audit`,
    });
  }

  // 4. Contact check (email is preferred for outreach)
  const hasContact = Boolean(lead.emailPrimary || lead.phoneNormalized);
  checks.push({
    code: "CONTACT_AVAILABLE",
    label: "Dane kontaktowe leada (e-mail lub telefon)",
    satisfied: hasContact,
    actionLabel: "Dodaj kontakt ręcznie",
    actionUrl: `/leads/edit`,
  });

  // 5. Pricing configuration check (if pricing module enabled)
  if (modulesEnabled.pricing) {
    const hasPricing = Boolean(pricingConfig && pricingConfig.packagesCount > 0);
    checks.push({
      code: "PRICING_CONFIGURED",
      label: "Skonfigurowany cennik pakietów usług",
      satisfied: hasPricing,
      actionLabel: "Skonfiguruj stawki w cenniku",
      actionUrl: "/settings/pricing",
    });
  }

  const missingItems = checks.filter((c) => !c.satisfied);
  const isReady = missingItems.length === 0;

  return {
    isReady,
    modulesEnabled,
    checks,
    missingItems,
  };
}
