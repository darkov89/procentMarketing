"""Offer content generator using Gemini API with grounded deterministic fallback."""

import json
import logging
import os
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel

from leadmachine.config import get_industries_config, get_settings
from leadmachine.db.models import Audit, Lead

logger = logging.getLogger(__name__)


class Observation(BaseModel):
    finding: str
    impact: str
    evidence_key: str


class ProposedModule(BaseModel):
    name: str
    description: str
    icon_emoji: str


class ProcessStep(BaseModel):
    step_number: int
    title: str
    description: str


class OfferContent(BaseModel):
    hero_headline: str
    hero_observation: str
    observations: List[Observation]
    proposed_modules: List[ProposedModule]
    pricing_range: str
    process_steps: List[ProcessStep]
    cta_text: str


class OfferGenerator:
    """Generates personalized, grounded offer content tailored to specific lead & audit facts."""

    def __init__(self):
        self.settings = get_settings()
        self.industries_config = get_industries_config()
        self.api_key = getattr(self.settings, "gemini_api_key", None) or os.getenv("GEMINI_API_KEY")

        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini Client: {e}")
                self.client = None
        else:
            self.client = None

    def generate(self, lead: Lead, audit: Optional[Audit] = None) -> OfferContent:
        """Generate offer content using Gemini API or tailored deterministic fallback."""
        if not self.client:
            return self._generate_fallback(lead, audit)

        industry_info = self._get_industry_info(lead.industry)
        audit_data = self._format_audit_data(audit)

        prompt = f"""
Jesteś dyrektorem strategii w agencji Procent Marketing (Legnica). Twoim zadaniem jest przygotowanie
spersonalizowanej oferty B2B dla lokalnej firmy na podstawie faktów technicznych z audytu jej witryny.

DANE FIRMY:
- Nazwa: {lead.company_name}
- Branża: {lead.industry or 'Lokalne usługi'}
- Miasto: {lead.city or 'Legnica'} ({f"{lead.distance_km:.1f} km od Legnicy" if lead.distance_km else ""})
- Strona WWW: {lead.website or 'Brak strony'}
- Sugerowane moduły z konfiguracji: {json.dumps(industry_info, ensure_ascii=False)}

DANE TECHNICZNE AUDYTU (PRAWDA OBIEKTYWNA):
{json.dumps(audit_data, ensure_ascii=False)}

ZASADA NADRZĘDNA: ZERO HALUCYNACJI.
Opieraj się WYŁĄCZNIE na podanych wyżej faktach. Zakaz zmyślania liczb, fałszywych referencji czy nieprawdziwych zarzutów.
Wszelkie twierdzenia muszą wskazywać pole dowodu (evidence_key).

WYMAGANA STRUKTURA:
1. hero_headline: chwytliwy nagłówek stailorowany pod branżę i firmę (np. "System automatyzacji rezerwacji pacjentów dla {lead.company_name}").
2. hero_observation: 2-3 zdania podsumowania obecnego stanu na podstawie faktów z audytu.
3. observations: 2-4 konkretne obserwacje techniczne z kluczem dowodowym i wpływem na zyski.
4. proposed_modules: 3 dedykowane moduły Procent Marketing rozwiązujące te konkretne braki.
5. pricing_range: szacunkowy budżet (np. "od 2 500 zł do 4 900 zł netto").
6. process_steps: 3-4 kroki wdrożenia (np. Analiza -> Wdrożenie narzędzi -> Testy -> Skalowanie).
7. cta_text: wezwanie do działania na bezpłatną konsultację (np. "Zarezerwuj bezpłatną 15-minutową konsultację").
"""
        try:
            model_name = getattr(self.settings, "gemini_model", "gemini-2.5-flash")
            response = self.client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=OfferContent,
                    temperature=0.2,
                ),
            )
            content_dict = json.loads(response.text)
            return OfferContent(**content_dict)
        except Exception as e:
            logger.warning(f"Gemini offer generation failed ({e}), using tailored fallback.")
            return self._generate_fallback(lead, audit)

    def generate_offer(self, lead: Lead, audit: Optional[Audit] = None) -> OfferContent:
        """Alias for generate."""
        return self.generate(lead, audit)

    def _get_industry_info(self, industry: Optional[str]) -> Dict[str, Any]:
        """Get industry specific configuration."""
        if not industry:
            return {}
        priorities = self.industries_config.get("priority_industries", {})
        ind_lower = industry.lower()
        for _, info in priorities.items():
            keywords = info.get("keywords", [])
            if any(kw.lower() in ind_lower for kw in keywords):
                return info
        return {}

    def _format_audit_data(self, audit: Optional[Audit]) -> Dict[str, Any]:
        """Extract clean factual data from audit model."""
        if not audit:
            return {"status": "Brak dedykowanej witryny WWW lub audytu"}
        return {
            "ssl_valid": audit.ssl_valid,
            "is_responsive": audit.is_responsive,
            "cms_detected": audit.cms_detected,
            "copyright_year": audit.copyright_year,
            "has_ga4": audit.has_ga4,
            "has_meta_pixel": audit.has_meta_pixel,
            "has_contact_form": audit.has_contact_form,
            "has_online_booking": audit.has_online_booking,
            "google_rating": audit.google_rating,
            "google_reviews_count": audit.google_reviews_count,
            "raw_evidence": audit.raw_evidence,
        }

    def _generate_fallback(self, lead: Lead, audit: Optional[Audit]) -> OfferContent:
        """Tailored deterministic offer generator grounded in audit facts and industry."""
        ind_lower = (lead.industry or "").lower()
        comp_name = lead.company_name or "Państwa Firma"

        observations: List[Observation] = []
        modules: List[ProposedModule] = []

        # 1. Observations based on real facts
        if audit:
            if not audit.has_online_booking:
                observations.append(
                    Observation(
                        finding="Brak automatycznego systemu rezerwacji online wizyt / spotkań",
                        impact="Strata klientów szukających terminów wieczorem i w weekendy poza pracą recepcji",
                        evidence_key="audit.has_online_booking=False",
                    )
                )
            if not audit.has_contact_form:
                observations.append(
                    Observation(
                        finding="Brak interaktywnego formularza natychmiastowej wyceny i kontaktu",
                        impact="Utrudniony kontakt z urządzeń mobilnych, spadek współczynnika konwersji",
                        evidence_key="audit.has_contact_form=False",
                    )
                )
            if audit.copyright_year and audit.copyright_year <= 2022:
                observations.append(
                    Observation(
                        finding=f"Serwis internetowy nie był odświeżany od {audit.copyright_year} roku",
                        impact="Niższa pozycja w wyszukiwarce Google oraz archaiczny odbiór przez nowych klientów",
                        evidence_key=f"audit.copyright_year={audit.copyright_year}",
                    )
                )
            if not audit.has_ga4 and not audit.has_meta_pixel:
                observations.append(
                    Observation(
                        finding="Brak wdrożonej analityki Google Analytics 4 oraz piksela konwersji",
                        impact="Brak wiedzy o źródłach pochodzenia klientów i niemożność prowadzenia precyzyjnego marketingu",
                        evidence_key="audit.has_ga4=False",
                    )
                )
            if audit.google_reviews_count and audit.google_reviews_count >= 15:
                observations.append(
                    Observation(
                        finding=f"Wysoka renoma lokalna ({audit.google_reviews_count} opinii w Google)",
                        impact="Ogromny kapitał zaufania, który po spięciu ze stroną natychmiast generuje stały napływ zapytań",
                        evidence_key=f"audit.google_reviews_count={audit.google_reviews_count}",
                    )
                )

        if not observations:
            observations.append(
                Observation(
                    finding="Niewykorzystany potencjał pozyskiwania klientów z lokalnego rynku online",
                    impact="Klienci w regionie trafiają do bezpośredniej konkurencji z lepszymi narzędziami",
                    evidence_key="market_local_presence",
                )
            )

        # 2. Industry-specific tailor-made modules
        if any(w in ind_lower for w in ["dentyst", "stomatolog", "medycyn", "lekar", "klinik", "fizjoterap"]):
            hero_headline = f"System Automatyzacji i Pozyskiwania Pacjentów dla {comp_name}"
            hero_observation = f"Przeprowadziliśmy audyt obecności cyfrowej {comp_name}. Zidentyfikowaliśmy kluczowe wąskie gardła w procesie umawiania pacjentów, których likwidacja pozwala zapełnić grafik gabinetu bez dodatkowej pracy recepcji."
            modules = [
                ProposedModule(
                    name="System Rezerwacji Wizyt 24/7",
                    description="Intuicyjny kalendarz online zintegrowany z przypomnieniami SMS, eliminujący problem nieodwołanych wizyt.",
                    icon_emoji="📅",
                ),
                ProposedModule(
                    name="Konwertująca Strona Wizytowa Gabinetu",
                    description="Nowoczesny, szybki serwis z prezentacją zespołu, cennika i automatycznymi opiniami zadowolonych pacjentów.",
                    icon_emoji="🦷",
                ),
                ProposedModule(
                    name="Lokalna Kampania Google & Retargeting",
                    description="Precyzyjne kierowanie pacjentów z Legnicy i okolic szukających zabiegów i pilnej pomocy stomatologicznej.",
                    icon_emoji="📍",
                ),
            ]
            pricing = "2 900 zł – 4 500 zł netto"
        elif any(w in ind_lower for w in ["prawn", "kancelar", "adwokat", "radca"]):
            hero_headline = f"Generator Wartościowych Spraw i Klientów dla {comp_name}"
            hero_observation = f"Audyt wykazał, że {comp_name} posiada znakomitą renomę merytoryczną, ale proces wstępnej kwalifikacji zapytań prawnych można zautomatyzować, oszczędzając czas radców i adwokatów."
            modules = [
                ProposedModule(
                    name="Inteligentny Formularz Kwalifikacji Spraw",
                    description="Filtruje zapytania przed konsultacją, zbiera dokumenty i wstępny brief klienta.",
                    icon_emoji="⚖️",
                ),
                ProposedModule(
                    name="Wizerunkowy Serwis Kancelarii",
                    description="Budujący zaufanie, bezpieczny serwis WWW zgodny z zasadami etyki zawodowej.",
                    icon_emoji="🏛️",
                ),
                ProposedModule(
                    name="Automatyczny Obieg i Kalendarz Konsultacji",
                    description="Rezerwacja płatnych porad prawnych online z natychmiastową integracją kalendarza.",
                    icon_emoji="📆",
                ),
            ]
            pricing = "3 200 zł – 4 800 zł netto"
        elif any(w in ind_lower for w in ["biuro rachunk", "księgow", "podatk"]):
            hero_headline = f"Zautomatyzowane Pozyskiwanie Stałych Klientów B2B dla {comp_name}"
            hero_observation = f"Dla {comp_name} kluczowe jest pozyskiwanie stabilnych spółek i przedsiębiorców o wyższym wolumenie faktur. Przygotowaliśmy architekturę lead-generation ukierunkowaną na firmy."
            modules = [
                ProposedModule(
                    name="Kalkulator Wyceny Księgowości Online",
                    description="Klient podaje liczbę dokumentów i formę prawną, otrzymując natychmiastową propozycję współpracy.",
                    icon_emoji="📊",
                ),
                ProposedModule(
                    name="Strona B2B z Portalem Klienta",
                    description="Elegancka prezentacja zakresu obsługi, kadr i płac oraz bezpieczeństwa danych finansowych.",
                    icon_emoji="💼",
                ),
                ProposedModule(
                    name="Automatyczny Nurturing Leadów",
                    description="Sekwencja informacyjna budująca autorytet biura w oczach lokalnych przedsiębiorców.",
                    icon_emoji="📧",
                ),
            ]
            pricing = "2 700 zł – 4 200 zł netto"
        elif any(w in ind_lower for w in ["pv", "fotowolt", "pompy", "klimat", "oze"]):
            hero_headline = f"System Generowania Zapytań Ofertowych HVAC/OZE dla {comp_name}"
            hero_observation = "W branży instalacyjnej liczy się szybkość odpowiedzi i precyzyjny dobór mocy. Zaprojektowaliśmy lejek pozyskujący właścicieli domów i firm z Dolnego Śląska."
            modules = [
                ProposedModule(
                    name="Kalkulator Doboru Mocy & Oszczędności",
                    description="Interaktywne narzędzie przeliczające rachunki za prąd/ogrzewanie na potencjalne oszczędności.",
                    icon_emoji="⚡",
                ),
                ProposedModule(
                    name="Szybki Brief Mobilny z Geotargetowaniem",
                    description="Zbieranie zapytań z dokładną lokalizacją dachu/działki w promieniu 30 km od Legnicy.",
                    icon_emoji="🏡",
                ),
                ProposedModule(
                    name="Baza Realizacji z Dowodem Społecznym",
                    description="Interaktywna mapa ukończonych montaży ze zdjęciami i opiniami inwestorów.",
                    icon_emoji="🛠️",
                ),
            ]
            pricing = "3 500 zł – 5 200 zł netto"
        else:
            hero_headline = f"Nowoczesna Strona WWW i Automatyzacja Sprzedaży dla {comp_name}"
            hero_observation = f"Audyt techniczny {comp_name} wskazuje konkretne obszary, które po wdrożeniu nowoczesnych standardów przełożą się na bezpośredni wzrost zapytań od klientów z regionu."
            modules = [
                ProposedModule(
                    name="Nowoczesna Strona WWW Smart-Lead",
                    description="Błyskawicznie ładujący się serwis zoptymalizowany pod smartfony i konwersję lokalną.",
                    icon_emoji="🚀",
                ),
                ProposedModule(
                    name="Automatyzacja Formularzy & CRM",
                    description="Natychmiastowe powiadomienia SMS/Email o nowych zapytaniach, aby żaden klient nie czekał.",
                    icon_emoji="📲",
                ),
                ProposedModule(
                    name="Zaawansowana Analityka Konwersji GA4",
                    description="Pełna kontrola nad tym, które źródła przynoszą realnych płacących klientów.",
                    icon_emoji="📈",
                ),
            ]
            pricing = "2 500 zł – 3 900 zł netto"

        process_steps = [
            ProcessStep(
                step_number=1,
                title="Strategia i Warsztat Celów",
                description="Ustalamy priorytety biznesowe, ofertę wysokomarżową i profil idealnego klienta.",
            ),
            ProcessStep(
                step_number=2,
                title="Wdrożenie Techniczne i Narzędzia",
                description="Budujemy serwis, konfigurujemy automatyzacje rezerwacji, formularzy i analitykę.",
            ),
            ProcessStep(
                step_number=3,
                title="Uruchomienie i Testy Konwersji",
                description="Sprawdzamy poprawność przepływu leadów, powiadomień i responsywności mobilnej.",
            ),
            ProcessStep(
                step_number=4,
                title="Skalowanie i Stałe Wsparcie",
                description="Mierzymy wyniki, optymalizujemy lejek i wspieramy rozwój firmy w regionie.",
            ),
        ]

        return OfferContent(
            hero_headline=hero_headline,
            hero_observation=hero_observation,
            observations=observations,
            proposed_modules=modules,
            pricing_range=pricing,
            process_steps=process_steps,
            cta_text="Zarezerwuj bezpłatną 15-minutową konsultację",
        )
