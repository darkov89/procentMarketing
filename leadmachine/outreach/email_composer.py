"""Personalized B2B outreach email composer with mandatory RODO clause and opt-out."""

from typing import Any, List, Optional

from pydantic import BaseModel

from leadmachine.config import get_settings


class EmailDraft(BaseModel):
    subject: str
    body_text: str
    body_html: str
    recipient_email: str


def compose_email(
    lead: Any,
    offer: Any = None,
    offer_url: str = "",
    contact: Optional[Any] = None,
) -> EmailDraft:
    """
    Composes a personalized outreach email for a qualified lead.

    Args:
        lead: The Lead object.
        offer: The Offer object (optional).
        offer_url: The URL to the published offer page.
        contact: The Contact object (optional).

    Returns:
        EmailDraft containing subject, text, HTML, and recipient.
    """
    settings = get_settings()

    company_name = lead.company_name or "Państwa Firma"
    industry = lead.industry or "Państwa branży"
    city = lead.city or "Legnicy i okolicach"

    # Contact recipient determination
    recipient = (
        (contact.email if contact and contact.email else None)
        or getattr(lead, "email_primary", None)
        or (lead.contacts[0].email if lead.contacts and lead.contacts[0].email else "")
    )

    contact_name = ""
    if contact and contact.first_name:
        contact_name = f"Panie/Pani {contact.first_name}"
    elif lead.contacts and lead.contacts[0].first_name:
        contact_name = f"Panie/Pani {lead.contacts[0].first_name}"

    # Extract real audit findings / automation angles
    findings: List[str] = []
    if hasattr(lead, "score_breakdown") and lead.score_breakdown:
        breakdown = lead.score_breakdown
        if isinstance(breakdown, dict):
            # Prioritize concrete automation fit reasons if present
            if "automation_fit_reasons" in breakdown and breakdown["automation_fit_reasons"]:
                findings.extend(breakdown["automation_fit_reasons"][:3])
            elif "automation_need_reason" in breakdown:
                findings.append(breakdown["automation_need_reason"])
            elif "summary" in breakdown:
                findings.append(breakdown["summary"])

    if not findings and hasattr(lead, "audit") and lead.audit:
        a = lead.audit
        if not a.has_online_booking:
            findings.append("Brak systemu rezerwacji wizyt online 24/7 (straty zapytań poza godzinami pracy)")
        if not a.has_contact_form:
            findings.append("Brak szybkiego formularza kontaktowego dostosowanego do smartfonów")
        if a.copyright_year and a.copyright_year <= 2022:
            findings.append(f"Przestarzała strona internetowa (ostatnia aktualizacja w stopce: {a.copyright_year} r.)")
        if not a.has_ga4 and not a.has_meta_pixel:
            findings.append("Brak nowoczesnej analityki konwersji i pomiaru skuteczności obecności w Google")

    if not findings:
        findings = [
            "Niewykorzystany potencjał pozyskiwania bezpośrednich zapytań z internetu w regionie",
            "Brak nowoczesnych automatyzacji ułatwiających kontakt klientom ze smartfonów",
            "Możliwość wdrożenia bezpośredniego generatora leadów dla lokalnego rynku",
        ]

    bullet_points = "".join([f"• {f}\n" for f in findings[:3]])
    bullet_points_html = "".join(
        [
            f"<li style='margin-bottom: 8px; color: #1E293B;'>{f}</li>"
            for f in findings[:3]
        ]
    )

    greeting = f"Dzień dobry {contact_name}," if contact_name else "Dzień dobry,"
    url = offer_url or (offer.deploy_url if offer and getattr(offer, "deploy_url", None) else "") or (offer.booking_url if offer else "")
    from_email = getattr(settings, "smtp_from_email", None) or getattr(settings.sender, "sender_email", "kontakt@procentmarketing.pl")

    subject = f"Propozycja usprawnień cyfrowych dla {company_name} | Procent Marketing"

    text_body = f"""{greeting}

Zwracam się do Państwa w imieniu agencji Procent Marketing z Legnicy. Analizowaliśmy lokalny rynek w branży {industry} ({city}) i przygotowaliśmy bezpłatny mini-audyt techniczny dla firmy {company_name}.

Oto kluczowe obserwacje, które zidentyfikowaliśmy:
{bullet_points}
Zamiast tradycyjnego maila ofertowego, przygotowaliśmy dla Państwa dedykowaną, interaktywną stronę z omówieniem i propozycją konkretnych modułów automatyzacji:
👉 {url}

W razie chęci krótkiej, niezobowiązującej rozmowy, na przygotowanej stronie znajdą Państwo bezpośredni kalendarz do wyboru dogodnego terminu 15-minutowej konsultacji.

Z poważaniem,
Dariusz i Zespół Procent Marketing
AM PROCENT Sp. z o.o., ul. M. Rataja 15, 59-220 Legnica
NIP: 6912590158 | KRS: 0001200066

---
Klauzula informacyjna (art. 14 RODO):
Administratorem Państwa danych jest AM PROCENT Sp. z o.o. z siedzibą w Legnicy. Dane kontaktowe pozyskano z publicznie dostępnych rejestrów (CEIDG/KRS) lub publicznej strony WWW w prawnie uzasadnionym celu marketingu bezpośredniego usług B2B (art. 6 ust. 1 lit. f RODO). Przysługuje Państwu prawo do sprzeciwu, wglądu oraz usunięcia danych.

Aby zrezygnować z dalszego kontaktu, prosimy o odpowiedź ze słowem WYPISZ lub kliknięcie:
mailto:{from_email}?subject=WYPISZ
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; line-height: 1.6; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #F8FAFC;">
    <div style="background-color: #FFFFFF; border-radius: 12px; padding: 32px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
            <div style="background-color: #FFE600; color: #000000; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-size: 14px; margin-right: 10px;">%</div>
            <strong style="color: #0F172A; font-size: 15px;">PROCENT MARKETING | LEGNICA</strong>
        </div>

        <p style="font-size: 16px; margin-top: 0;">{greeting}</p>

        <p style="font-size: 15px; color: #334155;">
            Zwracam się do Państwa w imieniu agencji <strong>Procent Marketing</strong> z Legnicy. Analizowaliśmy lokalny rynek w branży <strong>{industry}</strong> ({city}) i przygotowaliśmy bezpłatny mini-audyt techniczny dla firmy <strong>{company_name}</strong>.
        </p>

        <div style="background-color: #F1F5F9; border-radius: 8px; padding: 18px 20px; margin: 24px 0; border-left: 4px solid #FFE600;">
            <p style="margin: 0 0 10px 0; font-weight: 600; font-size: 14px; color: #0F172A; text-transform: uppercase; letter-spacing: 0.05em;">Główne wnioski z audytu technicznego:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                {bullet_points_html}
            </ul>
        </div>

        <p style="font-size: 15px; color: #334155;">
            Zamiast obszernego załącznika, przygotowaliśmy dla Państwa dedykowaną, interaktywną stronę z omówieniem i propozycją konkretnych modułów automatyzacji:
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{url}" style="background-color: #0F172A; color: #FFE600; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.2);">👉 Zobacz dedykowaną stronę oferty</a>
        </div>

        <p style="font-size: 14px; color: #475569;">
            Na przygotowanej stronie znajdą Państwo również bezpośredni kalendarz, w którym można wybrać dogodny termin 15-minutowej, niezobowiązującej konsultacji.
        </p>

        <p style="font-size: 14px; color: #334155; margin-top: 28px; border-top: 1px solid #E2E8F0; padding-top: 18px;">
            Z poważaniem,<br>
            <strong>Dariusz i Zespół Procent Marketing</strong><br>
            <span style="font-size: 12px; color: #64748B;">AM PROCENT Sp. z o.o., ul. M. Rataja 15, 59-220 Legnica<br>NIP: 6912590158 | KRS: 0001200066</span>
        </p>
    </div>

    <div style="font-size: 11px; color: #94A3B8; line-height: 1.5; margin-top: 20px; padding: 0 10px;">
        <p><strong>Informacja prawna (art. 14 RODO):</strong> Administratorem danych jest AM PROCENT Sp. z o.o., Legnica. Dane kontaktowe pozyskano ze źródeł publicznych (rejestry KRS/CEIDG, witryna WWW) w celu marketingu bezpośredniego B2B. Przysługuje Państwu prawo do sprzeciwu, wglądu i usunięcia danych.</p>
        <p>Aby nie otrzymywać więcej wiadomości: <a href="mailto:{from_email}?subject=WYPISZ" style="color: #64748B; text-decoration: underline;">Wypisz się / Opt-out</a></p>
    </div>
</body>
</html>"""

    return EmailDraft(
        subject=subject,
        body_text=text_body,
        body_html=html_body,
        recipient_email=recipient,
    )


def compose_outreach_email(
    lead: Any,
    offer: Any = None,
    contact: Optional[Any] = None,
    offer_url: str = "",
) -> EmailDraft:
    """Alias for compose_email matching orchestrator call."""
    return compose_email(lead=lead, offer=offer, offer_url=offer_url, contact=contact)
