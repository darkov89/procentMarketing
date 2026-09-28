"""Typer CLI interface for Lead Machine."""

import hashlib
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from leadmachine.adapters.scraper_adapter import ScraperAdapter
from leadmachine.core.dedup import is_duplicate, normalize_nip, normalize_phone_e164
from leadmachine.core.geo import validate_geo
from leadmachine.db.models import Audit, Contact, Lead, Suppression
from leadmachine.db.session import get_db, init_db
from leadmachine.exporter.excel_exporter import export_leads_to_excel

app = typer.Typer(help="Lead Machine - Procent Marketing B2B Automation Engine")
offers_app = typer.Typer(help="Manage and generate custom personalized offers")
app.add_typer(offers_app, name="offers")
console = Console()


@app.command()
def scan(
    input_file: Path = typer.Option(
        ...,
        "--input",
        "-i",
        help="Path to input scraper file (.csv or .json)",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Simulate scan without committing to SQLite database, export results to leads.xlsx",
    ),
    output_excel: Path = typer.Option(
        Path("leads.xlsx"),
        "--output",
        "-o",
        help="Path for Excel export",
    ),
):
    """Scan and ingest leads from scraper output, applying geo filter and deduplication."""
    console.print(f"[bold yellow]▶ Uruchamianie Lead Machine Scan[/bold yellow] (Plik: {input_file}, Dry-run: {dry_run})")

    if not dry_run:
        init_db()

    raw_leads = ScraperAdapter.load_from_file(input_file)
    console.print(f"Wczytano [bold cyan]{len(raw_leads)}[/bold cyan] rekordów ze scrapera.")

    processed_leads = []
    stats = {
        "total": len(raw_leads),
        "accepted": 0,
        "rejected_wroclaw": 0,
        "rejected_distance": 0,
        "rejected_coords": 0,
        "duplicates": 0,
    }

    if dry_run:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        from leadmachine.db.models import Base
        mem_engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(mem_engine)
        SessionLocal = sessionmaker(bind=mem_engine)
        session = SessionLocal()
    else:
        from leadmachine.db.session import get_engine, get_session_factory
        engine = get_engine()
        init_db(engine)
        session = get_session_factory(engine)()

    try:
        seen_phones = set()
        seen_nips = set()

        for idx, raw in enumerate(raw_leads, start=1):
            # 1. Geographic validation
            geo_res = validate_geo(
                city=raw.city,
                address=raw.address,
                latitude=raw.latitude,
                longitude=raw.longitude,
            )

            # 2. Duplicate check
            norm_nip = normalize_nip(raw.nip)
            norm_phone = normalize_phone_e164(raw.phone)

            is_dup = False
            dup_reason = None

            if norm_nip and norm_nip in seen_nips:
                is_dup = True
                dup_reason = f"Duplicate NIP in batch: {norm_nip}"
            elif norm_phone and norm_phone in seen_phones:
                is_dup = True
                dup_reason = f"Duplicate Phone in batch: {norm_phone}"
            else:
                db_dup, db_reason = is_duplicate(
                    session=session,
                    nip=norm_nip,
                    phone_normalized=norm_phone,
                    website=raw.website,
                    company_name=raw.company_name,
                    address=raw.address,
                )
                if db_dup:
                    is_dup = True
                    dup_reason = db_reason

            if is_dup:
                stats["duplicates"] += 1
                status = "disqualified"
                rejection = dup_reason
            elif not geo_res.is_allowed:
                status = "disqualified"
                rejection = geo_res.rejection_reason
                if "Wrocław" in (rejection or ""):
                    stats["rejected_wroclaw"] += 1
                elif "exceeds maximum radius" in (rejection or ""):
                    stats["rejected_distance"] += 1
                else:
                    stats["rejected_coords"] += 1
            else:
                status = "new"
                rejection = None
                stats["accepted"] += 1
                if norm_nip:
                    seen_nips.add(norm_nip)
                if norm_phone:
                    seen_phones.add(norm_phone)

            # Create Lead entity
            lead = Lead(
                company_name=raw.company_name,
                nip=norm_nip,
                website=raw.website,
                phone_normalized=norm_phone,
                email_primary=raw.email,
                address=raw.address,
                city=raw.city,
                latitude=geo_res.latitude,
                longitude=geo_res.longitude,
                distance_km=geo_res.distance_km,
                industry=raw.industry_category,
                status=status,
                rejection_reason=rejection,
                source_name="scraper",
            )

            # Add primary contact
            contact = Contact(
                lead=lead,
                phone=norm_phone,
                email=raw.email,
                is_primary=True,
                source="scraper",
            )
            lead.contacts.append(contact)

            # Add initial audit info if present from scraper
            if raw.google_rating or raw.reviews_count:
                audit = Audit(
                    lead=lead,
                    google_rating=raw.google_rating,
                    google_reviews_count=raw.reviews_count,
                    raw_evidence={"scraper": raw.raw_data},
                )
                lead.audit = audit

            if not is_dup:
                session.add(lead)
            processed_leads.append(lead)

        session.commit()

        # 3. Export to Excel
        saved_path = export_leads_to_excel(processed_leads, output_excel)

        # 4. Print Summary Table
        table = Table(title="Podsumowanie Skanowania Leadów", border_style="yellow")
        table.add_column("Metryka", style="bold white")
        table.add_column("Wartość", style="bold cyan")

        table.add_row("Wszystkie wczytane rekordy", str(stats["total"]))
        table.add_row("Zaakceptowane (Legnica ≤ 30km)", f"[green]{stats['accepted']}[/green]")
        table.add_row("Odrzucone: Wrocław (Hard Block)", f"[red]{stats['rejected_wroclaw']}[/red]")
        table.add_row("Odrzucone: Poza promieniem 30km", f"[magenta]{stats['rejected_distance']}[/magenta]")
        table.add_row("Odrzucone: Brak współrzędnych/miasta", str(stats["rejected_coords"]))
        table.add_row("Odrzucone: Duplikaty", str(stats["duplicates"]))
        table.add_row("Wygenerowany arkusz Excel", f"[bold green]{saved_path}[/bold green]")

        console.print(table)

    finally:
        session.close()


@app.command()
def export(
    output_excel: Path = typer.Option(
        Path("leads.xlsx"),
        "--output",
        "-o",
        help="Path for Excel export",
    ),
):
    """Export current leads from database to Excel."""
    with get_db() as session:
        leads = session.query(Lead).all()
        saved_path = export_leads_to_excel(leads, output_excel)
        console.print(f"[bold green]✓ Wyeksportowano {len(leads)} leadów do: {saved_path}[/bold green]")


@app.command()
def suppress(
    email: Optional[str] = typer.Option(None, "--email", help="Email to suppress"),
    phone: Optional[str] = typer.Option(None, "--phone", help="Phone to suppress"),
    nip: Optional[str] = typer.Option(None, "--nip", help="NIP to suppress"),
    reason: str = typer.Option("opt_out", "--reason", help="Reason for suppression"),
):
    """Add an identifier to the suppression list."""
    with get_db() as session:
        h_email = hashlib.sha256(email.lower().strip().encode()).hexdigest() if email else None
        h_phone = hashlib.sha256(phone.strip().encode()).hexdigest() if phone else None
        h_nip = hashlib.sha256(nip.strip().encode()).hexdigest() if nip else None

        entry = Suppression(
            hashed_email=h_email,
            hashed_phone=h_phone,
            hashed_nip=h_nip,
            raw_identifier=email or phone or nip,
            reason=reason,
        )
        session.add(entry)
        console.print(f"[bold green]✓ Dodano do Suppression List: {email or phone or nip} (Powód: {reason})[/bold green]")


@app.command()
def forget(
    email: Optional[str] = typer.Option(None, "--email", help="Email of lead to forget (GDPR)"),
    nip: Optional[str] = typer.Option(None, "--nip", help="NIP of lead to forget (GDPR)"),
):
    """Permanently delete lead data while preserving hashed suppression entry (GDPR)."""
    if not email and not nip:
        console.print("[bold red]Wymagane podanie --email lub --nip leada do usunięcia.[/bold red]")
        raise typer.Exit(1)

    with get_db() as session:
        query = session.query(Lead)
        if nip:
            query = query.filter(Lead.nip == normalize_nip(nip))
        elif email:
            query = query.filter(Lead.email_primary == email.strip().lower())

        lead = query.first()
        if not lead:
            console.print("[yellow]Nie znaleziono leada o podanych danych.[/yellow]")
            return

        lead_id = lead.id
        company = lead.company_name

        # Ensure hashed entry in suppression
        h_email = hashlib.sha256(lead.email_primary.lower().encode()).hexdigest() if lead.email_primary else None
        h_phone = hashlib.sha256(lead.phone_normalized.encode()).hexdigest() if lead.phone_normalized else None
        h_nip = hashlib.sha256(lead.nip.encode()).hexdigest() if lead.nip else None

        suppress_entry = Suppression(
            hashed_email=h_email,
            hashed_phone=h_phone,
            hashed_nip=h_nip,
            raw_identifier=f"Forgotten Lead #{lead_id}",
            reason="gdpr_right_to_be_forgotten",
        )
        session.add(suppress_entry)

        # Delete lead and cascades
        session.delete(lead)
        console.print(f"[bold green]✓ Pomyślnie zrealizowano prawo do bycia zapomnianym dla: '{company}' (Lead #{lead_id}). Dane osobowe usunięte.[/bold green]")


# Placeholders for future phases
@app.command()
def enrich():
    """Wzbogacanie danych leadów przez CEIDG/KRS/REGON (Faza 2)."""
    console.print("[cyan]Moduł 'enrich' zostanie zaimplementowany w Fazie 2.[/cyan]")


@app.command()
def qualify():
    """Kwalifikacja i scoring marketingowy leadów przez Gemini LLM (Faza 2)."""
    console.print("[cyan]Moduł 'qualify' zostanie zaimplementowany w Fazie 2.[/cyan]")


@app.command()
def audit():
    """Audyt marketingowy witryn WWW leadów (Faza 2)."""
    console.print("[cyan]Moduł 'audit' zostanie zaimplementowany w Fazie 2.[/cyan]")


@offers_app.command("build")
def offers_build():
    """Generowanie spersonalizowanych stron ofert (Faza 3)."""
    console.print("[cyan]Moduł 'offers build' zostanie zaimplementowany w Fazie 3.[/cyan]")


@offers_app.command("publish")
def offers_publish():
    """Publikacja zatwierdzonych ofert na Netlify (Faza 3)."""
    console.print("[cyan]Moduł 'offers publish' zostanie zaimplementowany w Fazie 3.[/cyan]")


@app.command()
def outreach():
    """Wysyłka zaproszeń e-mail z kontrolą ChannelGate i limitami (Faza 4)."""
    console.print("[cyan]Moduł 'outreach' zostanie zaimplementowany w Fazie 4.[/cyan]")


@app.command()
def inbox():
    """Monitorowanie skrzynki i klasyfikacja odpowiedzi przez Gemini (Faza 5)."""
    console.print("[cyan]Moduł 'inbox' zostanie zaimplementowany w Fazie 5.[/cyan]")


@app.command()
def followups():
    """Wysyłka follow-upów w wątku po N dniach (Faza 5)."""
    console.print("[cyan]Moduł 'followups' zostanie zaimplementowany w Fazie 5.[/cyan]")


if __name__ == "__main__":
    app()
