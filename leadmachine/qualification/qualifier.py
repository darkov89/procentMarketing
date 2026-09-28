"""Lead qualification and scoring engine (Hard rules Gate 1 + Subscores Gate 2)."""

import logging
from typing import Optional, Tuple

from pydantic import BaseModel, Field

from leadmachine.config import get_industries_config, get_settings
from leadmachine.db.models import Audit, Lead

logger = logging.getLogger(__name__)


class ScoreBreakdown(BaseModel):
    industry_match: int = Field(ge=0, le=30, description="Dopasowanie do branż priorytetowych Procent Marketing")
    industry_reason: str = Field(description="Uzasadnienie dopasowania branży")
    automation_need: int = Field(ge=0, le=25, description="Potrzeba nowej strony WWW lub automatyzacji procesów")
    automation_need_reason: str = Field(description="Uzasadnienie potrzeby technologicznej z audytu")
    payment_ability: int = Field(ge=0, le=20, description="Prawdopodobna zdolność płatnicza (opinie, wielkość, status)")
    payment_ability_reason: str = Field(description="Uzasadnienie potencjału budżetowego")
    reachability: int = Field(ge=0, le=15, description="Łatwość dotarcia do decydenta (znany właściciel, bezpośredni kontakt)")
    reachability_reason: str = Field(description="Uzasadnienie osiągalności decydenta")
    other_signals: int = Field(ge=0, le=10, description="Inne sygnały (reklamy, aktywność social media)")
    other_signals_reason: str = Field(description="Uzasadnienie dodatkowych sygnałów")
    summary: str = Field(description="Krótkie syntetyczne podsumowanie kwalifikacji")


class QualificationResult(BaseModel):
    is_qualified: bool
    total_score: int
    rejection_reason: Optional[str] = None
    breakdown: Optional[ScoreBreakdown] = None


class LeadQualifier:
    """Qualifies and scores leads based on business rules and verifiable audit signals."""

    def __init__(self):
        self.settings = get_settings()
        self.industries_cfg = get_industries_config()

    def qualify_lead(self, lead: Lead, audit: Optional[Audit] = None) -> QualificationResult:
        """Runs two-stage qualification: Gate 1 (hard rules) -> Gate 2 (scoring)."""
        # --- LEVEL 1: HARD RULES GATE ---
        passes_hard, hard_reason = self.check_hard_rules(lead)
        if not passes_hard:
            return QualificationResult(
                is_qualified=False,
                total_score=0,
                rejection_reason=hard_reason,
            )

        # --- LEVEL 2: SCORING GATE ---
        breakdown = self._evaluate_subscores(lead, audit)

        # Total score calculated strictly in code (never trusted from LLM math)
        total_score = (
            breakdown.industry_match
            + breakdown.automation_need
            + breakdown.payment_ability
            + breakdown.reachability
            + breakdown.other_signals
        )

        threshold = self.settings.scoring.min_qualification_score

        if total_score >= threshold:
            return QualificationResult(
                is_qualified=True,
                total_score=total_score,
                breakdown=breakdown,
            )
        else:
            reason = f"Score {total_score}/100 poniżej progu kwalifikacji ({threshold}). {breakdown.summary}"
            return QualificationResult(
                is_qualified=False,
                total_score=total_score,
                rejection_reason=reason,
                breakdown=breakdown,
            )

    def check_hard_rules(self, lead: Lead) -> Tuple[bool, Optional[str]]:
        """Checks Level 1 hard disqualification rules."""
        # 1. Blacklisted industry keywords
        blacklisted = self.industries_cfg.get("blacklisted_keywords", [])
        lead_text = f"{lead.company_name or ''} {lead.industry or ''}".lower()

        for kw in blacklisted:
            if kw.lower() in lead_text:
                return False, f"Branża na czarnej liście (wykryto słowo kluczowe: '{kw}')"

        # 2. Location restrictions (Must be within 30km, Wrocław rejected)
        if lead.city and any(w in lead.city.lower() for w in ["wrocław", "wroclaw"]):
            return False, "Wrocław jest bezwzględnie wykluczony ze strategii"

        if lead.distance_km is not None and lead.distance_km > self.settings.geo.radius_km:
            return False, f"Odległość {lead.distance_km:.1f} km przekracza promień 30 km od Legnicy"

        # 3. Contact channels presence
        has_phone = bool(lead.phone_normalized)
        has_email = bool(lead.email_primary)
        if not has_phone and not has_email:
            return False, "Brak jakiegokolwiek kanału kontaktu (brak telefonu i e-maila)"

        return True, None

    def _evaluate_subscores(self, lead: Lead, audit: Optional[Audit]) -> ScoreBreakdown:
        """Generates structured subscores. Uses Gemini API if configured, otherwise high-precision heuristic."""
        gemini_key = self.settings.gemini_api_key

        if gemini_key:
            try:
                return self._score_with_gemini(lead, audit, gemini_key)
            except Exception as e:
                logger.warning(f"Gemini API scoring failed ({e}), falling back to deterministic scoring.")

        return self._score_deterministic(lead, audit)

    def _score_deterministic(self, lead: Lead, audit: Optional[Audit]) -> ScoreBreakdown:
        """Deterministic, evidence-grounded scoring matching Procent Marketing priorities."""
        lead_text = f"{lead.company_name or ''} {lead.industry or ''}".lower()
        priorities = self.industries_cfg.get("priority_industries", {})

        # 1. Industry Match (0–30)
        industry_score = 10
        industry_reason = "Branża standardowa z potencjałem digitalizacji"

        for ind_key, ind_info in priorities.items():
            keywords = ind_info.get("keywords", [])
            if any(kw.lower() in lead_text for kw in keywords):
                industry_score = 30
                industry_reason = f"Branża priorytetowa: {ind_info.get('name')}"
                break

        # 2. Automation Need (0–25)
        need_score = 10
        need_factors = []

        if audit:
            if not audit.has_online_booking:
                need_score += 6
                need_factors.append("brak rezerwacji online")
            if not audit.has_contact_form:
                need_score += 4
                need_factors.append("brak formularza kontaktowego")
            if audit.copyright_year and audit.copyright_year <= 2022:
                need_score += 5
                need_factors.append(f"przestarzała strona (copyright {audit.copyright_year})")
            if not audit.has_ga4 and not audit.has_meta_pixel:
                need_score += 4
                need_factors.append("brak nowoczesnej analityki i pikseli")
            if not audit.is_responsive:
                need_score += 5
                need_factors.append("brak pełnej responsywności mobilnej")
        else:
            need_score = 15
            need_factors.append("brak własnej nowoczesnej strony WWW")

        need_score = min(25, need_score)
        need_reason = "Zidentyfikowane braki: " + (", ".join(need_factors) if need_factors else "podstawowa optymalizacja")

        # 3. Payment Ability (0–20)
        pay_score = 8
        pay_factors = []

        if "sp. z o.o." in (lead.company_name or "").lower() or lead.krs:
            pay_score += 6
            pay_factors.append("forma prawna: spółka z o.o.")
        if audit and audit.google_reviews_count and audit.google_reviews_count >= 20:
            pay_score += 4
            pay_factors.append(f"baza klientów ({audit.google_reviews_count} opinii Google)")
        if audit and audit.meta_ads_active:
            pay_score += 4
            pay_factors.append("inwestuje w płatne reklamy Meta")

        pay_score = min(20, pay_score)
        pay_reason = "Sygnały budżetowe: " + (", ".join(pay_factors) if pay_factors else "standardowa mikro/mała firma")

        # 4. Reachability (0–15)
        reach_score = 5
        reach_factors = []

        if lead.owner_confidence == "high":
            reach_score += 6
            reach_factors.append("znany właściciel / zarząd (rejestr)")
        elif lead.owner_confidence == "medium":
            reach_score += 3
            reach_factors.append("prawdopodobny właściciel")

        if lead.email_primary:
            reach_score += 4
            reach_factors.append("znany e-mail firmowy")
        if lead.phone_normalized:
            reach_score += 2
            reach_factors.append("telefon kontaktowy")

        reach_score = min(15, reach_score)
        reach_reason = ", ".join(reach_factors)

        # 5. Other Signals (0–10)
        other_score = 4
        other_factors = []

        if audit and audit.google_rating and audit.google_rating >= 4.5:
            other_score += 3
            other_factors.append(f"wysoka ocena klientów ({audit.google_rating:.1f}★)")
        if audit and audit.social_links:
            other_score += 3
            other_factors.append(f"obecność w mediach społecznościowych ({len(audit.social_links)} profili)")

        other_score = min(10, other_score)
        other_reason = ", ".join(other_factors) if other_factors else "brak dodatkowych sygnałów"

        summary = f"{industry_reason}. {need_reason}."

        return ScoreBreakdown(
            industry_match=industry_score,
            industry_reason=industry_reason,
            automation_need=need_score,
            automation_need_reason=need_reason,
            payment_ability=pay_score,
            payment_ability_reason=pay_reason,
            reachability=reach_score,
            reachability_reason=reach_reason,
            other_signals=other_score,
            other_signals_reason=other_reason,
            summary=summary,
        )

    def _score_with_gemini(self, lead: Lead, audit: Optional[Audit], api_key: str) -> ScoreBreakdown:
        """Invokes Gemini model with structured output schema enforcement."""
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        prompt = f"""
Jesteś obiektywnym audytorem kwalifikującym leady dla agencji Procent Marketing w Legnicy.
Oceń firmę na podstawie faktów technicznych i danych rejestrowych:

DANE FIRMY:
- Nazwa: {lead.company_name}
- Miasto: {lead.city} ({lead.distance_km:.1f} km od Legnicy)
- Branża: {lead.industry}
- Strona WWW: {lead.website}
- Pewność właściciela: {lead.owner_confidence}

DANE AUDYTU MARKETINGOWEGO:
- CMS: {audit.cms_detected if audit else 'Brak audytu'}
- Responsywność: {audit.is_responsive if audit else 'Nie'}
- Rok w stopce: {audit.copyright_year if audit else 'Nieznany'}
- Posiada GA4: {audit.has_ga4 if audit else False}
- Posiada Meta Pixel: {audit.has_meta_pixel if audit else False}
- Posiada rezerwację online: {audit.has_online_booking if audit else False}
- Posiada formularz: {audit.has_contact_form if audit else False}
- Ocena Google: {audit.google_rating if audit else 'Brak'} ({audit.google_reviews_count if audit else 0} opinii)

KRYTERIA SCORINGU (wypełnij wyłącznie podwyniki):
1. industry_match (0-30): czy pasuje do gabinetów, kancelarii, biur rachunkowych, OZE/budowlanki, szkół, B2B?
2. automation_need (0-25): czy ma przestarzałą stronę, brak rezerwacji online lub brak analityki?
3. payment_ability (0-20): status spółki, duża baza opinii, reklamy?
4. reachability (0-15): znany e-mail, telefon, właściciel?
5. other_signals (0-10): ocena Google, social media?

Pamiętaj: opieraj się WYŁĄCZNIE na podanych faktach. Zakaz zmyślania!
"""

        response = client.models.generate_content(
            model=self.settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScoreBreakdown,
                temperature=0.1,
            ),
        )
        return ScoreBreakdown.model_validate_json(response.text)
