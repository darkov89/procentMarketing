/**
 * Data normalization & deduplication helpers.
 */

export function normalizeNip(nip?: string | null): string | null {
  if (!nip) return null;
  const cleaned = nip.replace(/[^\d]/g, "");
  return cleaned.length === 10 ? cleaned : null;
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+")) {
    return digits;
  }
  if (digits.startsWith("48") && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+48${digits}`;
  }
  return digits;
}

export function normalizeDomain(url?: string | null): string | null {
  if (!url) return null;
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/^www\./, "");
  clean = clean.split("/")[0];
  clean = clean.split("?")[0];
  return clean || null;
}
