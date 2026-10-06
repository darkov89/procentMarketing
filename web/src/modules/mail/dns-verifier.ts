import dns from "dns";

export interface DnsRecordResult {
  found: boolean;
  rawRecords: string[];
  status: "pass" | "warn" | "fail" | "missing";
  message: string;
  recommendation?: string;
}

export interface DeliverabilityAuditReport {
  domain: string;
  spf: DnsRecordResult;
  dmarc: DnsRecordResult;
  dkim: DnsRecordResult;
  overallScore: "healthy" | "needs_attention" | "poor";
  recommendations: string[];
}

/**
 * Resolver function type allowing injection for testing/mocking
 */
export type TxtResolver = (hostname: string) => Promise<string[][]>;

const defaultTxtResolver: TxtResolver = async (hostname: string) => {
  try {
    return await dns.promises.resolveTxt(hostname);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return [];
    }
    throw err;
  }
};

/**
 * Normalizes TXT record fragments returned by dns.promises.resolveTxt
 */
function flattenTxtRecords(chunks: string[][]): string[] {
  return chunks.map((chunk) => chunk.join(""));
}

/**
 * Evaluates SPF record for the sender domain.
 */
export function evaluateSpf(records: string[], domain: string): DnsRecordResult {
  const spfRecords = records.filter((r) => r.toLowerCase().startsWith("v=spf1"));

  if (spfRecords.length === 0) {
    return {
      found: false,
      rawRecords: [],
      status: "missing",
      message: `Brak rekordu SPF dla domeny ${domain}.`,
      recommendation: `Dodaj rekord TXT w strefie DNS domeny: "${domain}" o wartości: "v=spf1 include:_spf.google.com ~all" (lub odpowiedni dla Twojego dostawcy poczty).`,
    };
  }

  if (spfRecords.length > 1) {
    return {
      found: true,
      rawRecords: spfRecords,
      status: "fail",
      message: `Wykryto ${spfRecords.length} rekordów SPF. Zgodnie z RFC 7208 domena może posiadać dokładnie jeden rekord SPF!`,
      recommendation: `Połącz istniejące rekordy SPF w jeden rekord TXT "v=spf1 ...". Wielokrotne rekordy SPF powodują błąd PermError u odbiorców.`,
    };
  }

  const record = spfRecords[0];
  const hasAll = record.includes("-all") || record.includes("~all");

  if (!hasAll) {
    return {
      found: true,
      rawRecords: spfRecords,
      status: "warn",
      message: `Rekord SPF istnieje, ale nie posiada dyrektywy końcowej (~all lub -all).`,
      recommendation: `Zakończ rekord SPF mechanizmem "~all" (SoftFail) lub "-all" (HardFail), np. "v=spf1 include:... ~all".`,
    };
  }

  return {
    found: true,
    rawRecords: spfRecords,
    status: "pass",
    message: `Rekord SPF skonfigurowany poprawnie: ${record}`,
  };
}

/**
 * Evaluates DMARC record for the sender domain (_dmarc.<domain>).
 */
export function evaluateDmarc(records: string[], domain: string): DnsRecordResult {
  const dmarcRecords = records.filter((r) => r.toLowerCase().startsWith("v=dmarc1"));

  if (dmarcRecords.length === 0) {
    return {
      found: false,
      rawRecords: [],
      status: "missing",
      message: `Brak rekordu DMARC dla domeny ${domain}.`,
      recommendation: `Dodaj rekord TXT dla poddomeny "_dmarc.${domain}" o wartości: "v=DMARC1; p=none; rua=mailto:dmarc@${domain}".`,
    };
  }

  if (dmarcRecords.length > 1) {
    return {
      found: true,
      rawRecords: dmarcRecords,
      status: "fail",
      message: `Wykryto ${dmarcRecords.length} rekordów DMARC. Domena może posiadać tylko jeden rekord DMARC.`,
      recommendation: `Usuń zduplikowane wpisy DMARC w strefie DNS dla "_dmarc.${domain}".`,
    };
  }

  const record = dmarcRecords[0];
  const hasPolicy = /p=(none|quarantine|reject)/i.test(record);

  if (!hasPolicy) {
    return {
      found: true,
      rawRecords: dmarcRecords,
      status: "warn",
      message: `Rekord DMARC istnieje, ale nie zawiera poprawnej dyrektywy polityki (p=none, p=quarantine lub p=reject).`,
      recommendation: `Ustaw politykę w rekordzie DMARC, np. "v=DMARC1; p=none; sp=none;".`,
    };
  }

  return {
    found: true,
    rawRecords: dmarcRecords,
    status: "pass",
    message: `Rekord DMARC skonfigurowany poprawnie: ${record}`,
  };
}

/**
 * Evaluates DKIM selector record for the sender domain (<selector>._domainkey.<domain>).
 */
export function evaluateDkim(records: string[], domain: string, selector: string): DnsRecordResult {
  const dkimHost = `${selector}._domainkey.${domain}`;
  const dkimRecords = records.filter((r) => r.toLowerCase().includes("v=dkim1") || r.toLowerCase().includes("p="));

  if (dkimRecords.length === 0) {
    return {
      found: false,
      rawRecords: [],
      status: "missing",
      message: `Brak rekordu DKIM dla selektora "${selector}" (${dkimHost}).`,
      recommendation: `Skopiuj klucz publiczny DKIM od swojego dostawcy poczty i utwórz rekord TXT dla "${dkimHost}".`,
    };
  }

  const record = dkimRecords[0];
  const hasPublicKey = /p=[a-zA-Z0-9+/]+/i.test(record);

  if (!hasPublicKey) {
    return {
      found: true,
      rawRecords: dkimRecords,
      status: "warn",
      message: `Rekord DKIM znaleziony, ale klucz publiczny 'p=' wydaje się pusty lub niepoprawny.`,
      recommendation: `Upewnij się, że rekord DK zawiera poprawny ciąg klucza publicznego p=...`,
    };
  }

  return {
    found: true,
    rawRecords: dkimRecords,
    status: "pass",
    message: `Rekord DKIM zweryfikowany pomyślnie dla selektora "${selector}".`,
  };
}

/**
 * Runs deliverability DNS checks for SPF, DMARC, and DKIM.
 * NEVER modifies DNS records directly (AGENTS.md rule R10); generates clear instructions for the domain owner.
 */
export async function auditDomainDeliverability(
  domain: string,
  options: {
    dkimSelector?: string;
    resolver?: TxtResolver;
  } = {}
): Promise<DeliverabilityAuditReport> {
  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "").replace(/^www\./, "");
  const dkimSelector = options.dkimSelector || "default";
  const resolve = options.resolver || defaultTxtResolver;

  // 1. Resolve domain root TXT records (SPF)
  let domainTxt: string[] = [];
  try {
    const rawDomain = await resolve(cleanDomain);
    domainTxt = flattenTxtRecords(rawDomain);
  } catch {
    domainTxt = [];
  }

  // 2. Resolve DMARC TXT records
  let dmarcTxt: string[] = [];
  try {
    const rawDmarc = await resolve(`_dmarc.${cleanDomain}`);
    dmarcTxt = flattenTxtRecords(rawDmarc);
  } catch {
    dmarcTxt = [];
  }

  // 3. Resolve DKIM TXT records
  let dkimTxt: string[] = [];
  try {
    const rawDkim = await resolve(`${dkimSelector}._domainkey.${cleanDomain}`);
    dkimTxt = flattenTxtRecords(rawDkim);
  } catch {
    dkimTxt = [];
  }

  const spf = evaluateSpf(domainTxt, cleanDomain);
  const dmarc = evaluateDmarc(dmarcTxt, cleanDomain);
  const dkim = evaluateDkim(dkimTxt, cleanDomain, dkimSelector);

  const recommendations: string[] = [];
  if (spf.recommendation) recommendations.push(spf.recommendation);
  if (dmarc.recommendation) recommendations.push(dmarc.recommendation);
  if (dkim.recommendation) recommendations.push(dkim.recommendation);

  let overallScore: "healthy" | "needs_attention" | "poor" = "healthy";
  if (spf.status === "fail" || dmarc.status === "fail") {
    overallScore = "poor";
  } else if (
    spf.status === "missing" ||
    dmarc.status === "missing" ||
    dkim.status === "missing" ||
    spf.status === "warn" ||
    dmarc.status === "warn"
  ) {
    overallScore = "needs_attention";
  }

  return {
    domain: cleanDomain,
    spf,
    dmarc,
    dkim,
    overallScore,
    recommendations,
  };
}
