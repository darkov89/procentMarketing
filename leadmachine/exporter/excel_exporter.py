"""Excel exporter generating formatted leads.xlsx using openpyxl with atomic safe write."""

from datetime import datetime
from pathlib import Path
from typing import List, Optional

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from leadmachine.db.models import Lead

# Column definition tuple: (Header Name, attribute getter function / lambda, width hint)
EXCEL_COLUMNS = [
    # 1. Kolumny minimalne (zawsze z przodu)
    ("Firma", lambda lead: lead.company_name or "", 28),
    ("Główny kontakt (właściciel)", lambda lead: _get_primary_contact(lead), 25),
    ("Telefon", lambda lead: lead.phone_normalized or "", 18),
    ("Mail firmy", lambda lead: lead.email_primary or "", 26),
    # 2. Dane identyfikacyjne i lokalizacja
    ("NIP", lambda lead: lead.nip or "", 14),
    ("Adres", lambda lead: lead.address or "", 28),
    ("Miasto", lambda lead: lead.city or "", 16),
    (
        "Odległość Legnica (km)",
        lambda lead: f"{lead.distance_km:.1f}" if lead.distance_km is not None else "",
        14,
    ),
    ("Branża", lambda lead: lead.industry or "", 22),
    ("WWW", lambda lead: lead.website or "", 28),
    ("Pewność właściciela", lambda lead: lead.owner_confidence or "brak", 16),
    ("Score", lambda lead: lead.score if lead.score else 0, 10),
    ("Uzasadnienie score", lambda lead: _get_score_reason(lead), 30),
    # 3. Audyt marketingowy
    ("SSL", lambda lead: _bool_pl(lead.audit.ssl_valid) if lead.audit else "", 8),
    ("Mobilność", lambda lead: _bool_pl(lead.audit.is_responsive) if lead.audit else "", 10),
    (
        "PageSpeed Mobile",
        lambda lead: (
            lead.audit.pagespeed_mobile_score
            if lead.audit and lead.audit.pagespeed_mobile_score is not None
            else ""
        ),
        12,
    ),
    (
        "CMS",
        lambda lead: lead.audit.cms_detected if lead.audit and lead.audit.cms_detected else "",
        14,
    ),
    (
        "Rok aktualizacji",
        lambda lead: lead.audit.copyright_year if lead.audit and lead.audit.copyright_year else "",
        12,
    ),
    ("GA4", lambda lead: _bool_pl(lead.audit.has_ga4) if lead.audit else "", 8),
    ("GTM", lambda lead: _bool_pl(lead.audit.has_gtm) if lead.audit else "", 8),
    ("Meta Pixel", lambda lead: _bool_pl(lead.audit.has_meta_pixel) if lead.audit else "", 10),
    ("Formularz", lambda lead: _bool_pl(lead.audit.has_contact_form) if lead.audit else "", 10),
    (
        "Rezerwacja online",
        lambda lead: _bool_pl(lead.audit.has_online_booking) if lead.audit else "",
        14,
    ),
    ("Czat", lambda lead: _bool_pl(lead.audit.has_live_chat) if lead.audit else "", 8),
    (
        "Ocena Google",
        lambda lead: (
            f"{lead.audit.google_rating:.1f}" if lead.audit and lead.audit.google_rating else ""
        ),
        12,
    ),
    (
        "Liczba opinii",
        lambda lead: (
            lead.audit.google_reviews_count
            if lead.audit and lead.audit.google_reviews_count
            else ""
        ),
        12,
    ),
    ("Reklamy Meta", lambda lead: _bool_pl(lead.audit.meta_ads_active) if lead.audit else "", 10),
    # 4. Proces i komunikacja
    ("Link do oferty", lambda lead: lead.offer.booking_url if lead.offer else "", 30),
    ("Mail wysłany (data)", lambda lead: _get_message_date(lead, "email"), 18),
    ("SMS wysłany (data)", lambda lead: _get_message_date(lead, "sms"), 18),
    ("WhatsApp wysłany", lambda lead: _get_message_date(lead, "whatsapp"), 18),
    ("Follow-up (data)", lambda lead: _get_followup_date(lead), 18),
    ("Odpowiedź (kategoria)", lambda lead: _get_reply_info(lead), 20),
    ("Status leada", lambda lead: lead.status or "new", 18),
    (
        "Data utworzenia",
        lambda lead: lead.created_at.strftime("%Y-%m-%d %H:%M") if lead.created_at else "",
        18,
    ),
    ("Źródło danych", lambda lead: lead.source_name or "scraper", 14),
    ("Uwagi / Powód odrzucenia", lambda lead: lead.rejection_reason or "", 30),
]


def _bool_pl(val: Optional[bool]) -> str:
    if val is None:
        return ""
    return "TAK" if val else "NIE"


def _get_primary_contact(lead: Lead) -> str:
    if not lead.contacts:
        return ""
    c = lead.contacts[0]
    name = f"{c.first_name or ''} {c.last_name or ''}".strip()
    if c.role:
        return f"{name} ({c.role})" if name else c.role
    return name or ""


def _get_score_reason(lead: Lead) -> str:
    if not lead.score_breakdown:
        return lead.rejection_reason or ""
    if isinstance(lead.score_breakdown, dict):
        return lead.score_breakdown.get("summary", "")
    return str(lead.score_breakdown)


def _get_message_date(lead: Lead, channel: str) -> str:
    if not lead.messages:
        return ""
    for m in lead.messages:
        if m.channel == channel and m.status == "sent" and m.sent_at:
            return m.sent_at.strftime("%Y-%m-%d %H:%M")
    return ""


def _get_followup_date(lead: Lead) -> str:
    if not lead.messages:
        return ""
    for m in lead.messages:
        if m.status == "sent" and "followup" in (m.subject or "").lower():
            return m.sent_at.strftime("%Y-%m-%d %H:%M") if m.sent_at else ""
    return ""


def _get_reply_info(lead: Lead) -> str:
    if not lead.messages:
        return ""
    for m in lead.messages:
        if m.direction == "inbound" and m.classification:
            return m.classification
    return ""


STATUS_COLORS = {
    "new": "FFF2CC",  # light yellow
    "qualified": "D9EAD3",  # light green
    "disqualified": "F4CCCC",  # light red
    "audited": "CFE2F3",  # light blue
    "offer_draft": "EAD1DC",  # light purple
    "offer_approved": "B6D7A8",  # soft green
    "offer_published": "A2C4C9",  # soft teal
    "outreach_queued": "FFF2CC",
    "sent": "D9EAD3",
    "followup_sent": "D9EAD3",
    "replied_interested": "93C47D",  # bright green
    "replied_question": "A4C2F4",  # sky blue
    "replied_negative": "EA9999",  # coral red
    "unsubscribed": "E06666",  # strong red
    "bounced": "D5A6BD",  # magenta
    "meeting_booked": "6AA84F",  # strong emerald
}


def export_leads_to_excel(leads: List[Lead], output_path: Path) -> Path:
    """Exports list of Lead entities to a styled Excel file with atomic safe-write fallback."""
    # Strict rule: Wrocław is completely excluded from reports
    leads = [
        lead
        for lead in leads
        if not (lead.city and any(w in lead.city.lower() for w in ["wrocław", "wroclaw"]))
        and not (lead.address and any(w in lead.address.lower() for w in ["wrocław", "wroclaw"]))
        and not (lead.rejection_reason and "wrocław" in lead.rejection_reason.lower())
    ]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Leady B2B"

    # Styling definitions
    header_fill = PatternFill(start_color="161616", end_color="161616", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFE600")
    data_font = Font(name="Calibri", size=10, color="000000")
    thin_border = Border(
        left=Side(style="thin", color="E0E0E0"),
        right=Side(style="thin", color="E0E0E0"),
        top=Side(style="thin", color="E0E0E0"),
        bottom=Side(style="thin", color="E0E0E0"),
    )

    # 1. Write Header Row
    headers = [col[0] for col in EXCEL_COLUMNS]
    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # 2. Write Data Rows
    for row_idx, lead in enumerate(leads, start=2):
        row_values = []
        for _, getter, _ in EXCEL_COLUMNS:
            try:
                val = getter(lead)
                if val is None:
                    val = ""
            except Exception:
                val = ""
            row_values.append(val)
        ws.append(row_values)

        # Style data cells
        status_key = (lead.status or "new").lower()
        row_status_color = STATUS_COLORS.get(status_key, "FFFFFF")

        for col_idx in range(1, len(row_values) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = data_font
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

            # Status column coloring
            if EXCEL_COLUMNS[col_idx - 1][0] == "Status leada":
                cell.fill = PatternFill(
                    start_color=row_status_color, end_color=row_status_color, fill_type="solid"
                )
                cell.font = Font(name="Calibri", size=10, bold=True)

            # Hyperlinks for WWW and Offer
            val_str = str(cell.value or "")
            if val_str.startswith("http://") or val_str.startswith("https://"):
                cell.hyperlink = val_str
                cell.font = Font(name="Calibri", size=10, color="0000FF", underline="single")

    # 3. Format widths, auto-filters, and freeze panes
    for col_idx, (_, _, width) in enumerate(EXCEL_COLUMNS, start=1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(width, 10)

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{max(len(leads) + 1, 1)}"
    ws.row_dimensions[1].height = 28

    # 4. Safe Atomic Write
    target_path = Path(output_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        wb.save(target_path)
        return target_path
    except PermissionError:
        # File is locked / open in Excel - write timestamped fallback
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        fallback_path = target_path.parent / f"{target_path.stem}_{timestamp}{target_path.suffix}"
        wb.save(fallback_path)
        return fallback_path
