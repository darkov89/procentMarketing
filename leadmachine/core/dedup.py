"""Deduplication logic for leads (NIP, normalized phone, domain, fuzzy match)."""

import re
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from leadmachine.db.models import Lead


def normalize_nip(nip: Optional[str]) -> Optional[str]:
    """Clean NIP to digits only. Must be 10 digits."""
    if not nip:
        return None
    digits = re.sub(r"\D", "", nip)
    return digits if len(digits) == 10 else None


def normalize_phone_e164(phone: Optional[str]) -> Optional[str]:
    """Normalize phone number to Polish E.164 (+48XXXXXXXXX) or generic international format."""
    if not phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", phone)
    # If starts with +48
    if cleaned.startswith("+48") and len(cleaned) == 12:
        return cleaned
    # If starts with 48 without plus
    if cleaned.startswith("48") and len(cleaned) == 11:
        return f"+{cleaned}"
    # If standard 9 digits in Poland
    digits_only = re.sub(r"\D", "", phone)
    if len(digits_only) == 9:
        return f"+48{digits_only}"
    # If international with plus
    if cleaned.startswith("+") and len(cleaned) >= 10:
        return cleaned
    return digits_only if digits_only else None


def normalize_domain(website: Optional[str]) -> Optional[str]:
    """Extract and normalize domain from URL (lowercase, no www, no path)."""
    if not website:
        return None
    raw = website.strip().lower()
    if not raw.startswith(("http://", "https://")):
        raw = "http://" + raw
    try:
        parsed = urlparse(raw)
        domain = parsed.netloc or parsed.path
        domain = domain.split(":")[0] # remove port
        if domain.startswith("www."):
            domain = domain[4:]
        # Exclude generic platforms from matching (facebook, booksy, instagram, etc.)
        generic_platforms = {
            "facebook.com",
            "instagram.com",
            "booksy.com",
            "tiktok.com",
            "google.com",
            "maps.google.com",
            "youtube.com",
            "linkedin.com",
        }
        if domain in generic_platforms or not domain:
            return None
        return domain
    except Exception:
        return None


def normalize_company_name(name: Optional[str]) -> str:
    """Normalize company name for fuzzy matching (remove legal forms, punctuation, lowercase)."""
    if not name:
        return ""
    clean = name.lower()
    # Remove common Polish corporate forms
    legal_forms = [
        r"\bsp\.?\s*z\s*o\.?\s*o\.?",
        r"\bspółka\s+z\s+ograniczoną\s+odpowiedzialnością\b",
        r"\bs\.?a\.?\b",
        r"\bspółka\s+akcyjna\b",
        r"\bs\.?c\.?\b",
        r"\bspółka\s+cywilna\b",
        r"\bsp\.?\s*j\.?\b",
        r"\bspółka\s+jawna\b",
    ]
    for form in legal_forms:
        clean = re.sub(form, "", clean)
    # Remove non-alphanumeric characters (keep polish letters)
    clean = re.sub(r"[^\w\s]", " ", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def is_duplicate(
    session: Session,
    nip: Optional[str] = None,
    phone_normalized: Optional[str] = None,
    website: Optional[str] = None,
    company_name: Optional[str] = None,
    address: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """Checks if lead already exists in DB by NIP, phone, domain, or name+address."""
    clean_nip = normalize_nip(nip)
    if clean_nip:
        existing = session.query(Lead).filter(Lead.nip == clean_nip).first()
        if existing:
            return True, f"Duplicate NIP: {clean_nip} (Lead #{existing.id})"

    clean_phone = normalize_phone_e164(phone_normalized)
    if clean_phone:
        existing = session.query(Lead).filter(Lead.phone_normalized == clean_phone).first()
        if existing:
            return True, f"Duplicate Phone: {clean_phone} (Lead #{existing.id})"

    clean_domain = normalize_domain(website)
    if clean_domain:
        # Match by domain in website field
        existing = session.query(Lead).filter(Lead.website.ilike(f"%{clean_domain}%")).first()
        if existing:
            return True, f"Duplicate Domain: {clean_domain} (Lead #{existing.id})"

    if company_name and address:
        norm_name = normalize_company_name(company_name)
        if norm_name and len(norm_name) > 4:
            # Query candidates with similar name
            candidates = session.query(Lead).filter(Lead.city.isnot(None)).all()
            for cand in candidates:
                cand_norm = normalize_company_name(cand.company_name)
                if cand_norm == norm_name:
                    # check address snippet
                    if cand.address and (cand.address[:10].lower() in address.lower() or address[:10].lower() in cand.address.lower()):
                        return True, f"Duplicate Name+Address match: '{company_name}' (Lead #{cand.id})"

    return False, None
