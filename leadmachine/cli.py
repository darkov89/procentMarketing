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
    console.print(
        f"[bold yellow]▶ Uruchamianie Lead Machine Scan[/bold yellow] (Plik: {input_file}, Dry-run: {dry_run})"
    )

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
                rejection = geo_res.rejection_reason
                if "Wrocław" in (rejection or ""):
                    stats["rejected_wroclaw"] += 1
                    # HARD POLICY: Wrocław leads are completely dropped, never saved in DB or Excel
                    continue
                elif "exceeds maximum radius" in (rejection or ""):
                    stats["rejected_distance"] += 1
                else:
                    stats["rejected_coords"] += 1
                status = "disqualified"
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
        table.add_row(
            "Odrzucone: Poza promieniem 30km", f"[magenta]{stats['rejected_distance']}[/magenta]"
        )
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
        console.print(
            f"[bold green]✓ Wyeksportowano {len(leads)} leadów do: {saved_path}[/bold green]"
        )


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
        console.print(
            f"[bold green]✓ Dodano do Suppression List: {email or phone or nip} (Powód: {reason})[/bold green]"
        )


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
        h_email = (
            hashlib.sha256(lead.email_primary.lower().encode()).hexdigest()
            if lead.email_primary
            else None
        )
        h_phone = (
            hashlib.sha256(lead.phone_normalized.encode()).hexdigest()
            if lead.phone_normalized
            else None
        )
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
        console.print(
            f"[bold green]✓ Pomyślnie zrealizowano prawo do bycia zapomnianym dla: '{company}' (Lead #{lead_id}). Dane osobowe usunięte.[/bold green]"
        )


# Placeholders for future phases
@app.command()
def enrich():
    """Wzbogacanie danych leadów przez CEIDG/KRS/REGON z określaniem pewności właściciela."""
    console.print(
        "[bold yellow]▶ Uruchamianie modułu wzbogacania rejestrowego (CEIDG / KRS)...[/bold yellow]"
    )
    from leadmachine.enrichment.registry_client import RegistryClient

    reg_client = RegistryClient()
    updated_count = 0

    with get_db() as session:
        leads = session.query(Lead).filter(Lead.status.in_(["new", "qualified"])).all()
        if not leads:
            console.print("[yellow]Brak aktywnych leadów do wzbogacenia.[/yellow]")
            return

        table = Table(title="Wyniki Wzbogacania Rejestrowego", border_style="cyan")
        table.add_column("ID", style="bold white", width=6)
        table.add_column("Firma", style="bold white", width=25)
        table.add_column("Pewność właściciela", style="bold cyan", width=18)
        table.add_column("Wykryty właściciel / zarząd", style="green", width=30)
        table.add_column("Źródło", style="dim", width=15)

        for lead in leads:
            res = reg_client.lookup(nip=lead.nip, krs=lead.krs, company_name=lead.company_name)
            if res:
                if res.owner_name:
                    lead.owner_confidence = res.owner_confidence
                    if not lead.contacts:
                        c = Contact(
                            lead=lead,
                            first_name=res.owner_name,
                            role=res.owner_role,
                            is_primary=True,
                            source=res.source,
                        )
                        session.add(c)
                    else:
                        lead.contacts[0].first_name = res.owner_name
                        lead.contacts[0].role = res.owner_role
                    updated_count += 1
                else:
                    lead.owner_confidence = lead.owner_confidence or res.owner_confidence

                table.add_row(
                    str(lead.id),
                    lead.company_name[:24],
                    lead.owner_confidence or "brak",
                    f"{res.owner_name or 'Nie wykryto'} ({res.owner_role or '-'})",
                    res.source,
                )

        session.commit()
        console.print(table)
        console.print(
            f"[bold green]✓ Zaktualizowano dane właścicieli dla {updated_count} leadów.[/bold green]"
        )


@app.command()
def audit():
    """Rzetelny mini-audyt marketingowy witryn WWW leadów z gromadzeniem dowodów (evidence)."""
    console.print(
        "[bold yellow]▶ Uruchamianie mini-audytu marketingowego stron WWW...[/bold yellow]"
    )
    from leadmachine.audit.web_auditor import WebAuditor

    auditor = WebAuditor()
    audited_count = 0

    with get_db() as session:
        leads = session.query(Lead).filter(Lead.website.isnot(None)).all()
        if not leads:
            console.print("[yellow]Brak leadów z adresem WWW w bazie.[/yellow]")
            return

        table = Table(title="Wyniki Audytu Marketingowego WWW", border_style="yellow")
        table.add_column("ID", style="bold white", width=6)
        table.add_column("Firma", style="bold white", width=24)
        table.add_column("SSL", style="cyan", width=8)
        table.add_column("Mobilność", style="cyan", width=10)
        table.add_column("CMS", style="magenta", width=12)
        table.add_column("GA4 / Pixel", style="green", width=14)
        table.add_column("Rezerwacja", style="green", width=12)
        table.add_column("Dowody (evidence)", style="dim", width=18)

        for lead in leads:
            audit_res = auditor.audit_url(lead.website)

            # Save or update Audit record
            if not lead.audit:
                a = Audit(
                    lead=lead,
                    ssl_valid=audit_res.ssl_valid,
                    is_responsive=audit_res.is_responsive,
                    cms_detected=audit_res.cms_detected,
                    copyright_year=audit_res.copyright_year,
                    has_ga4=audit_res.has_ga4,
                    has_gtm=audit_res.has_gtm,
                    has_meta_pixel=audit_res.has_meta_pixel,
                    has_contact_form=audit_res.has_contact_form,
                    has_online_booking=audit_res.has_online_booking,
                    has_live_chat=audit_res.has_live_chat,
                    social_links=audit_res.social_links,
                    emails_scraped=audit_res.emails_scraped,
                    meta_ads_active=audit_res.meta_ads_active,
                    raw_evidence=audit_res.evidence,
                )
                session.add(a)
                lead.audit = a
            else:
                lead.audit.ssl_valid = audit_res.ssl_valid
                lead.audit.is_responsive = audit_res.is_responsive
                lead.audit.cms_detected = audit_res.cms_detected
                lead.audit.copyright_year = audit_res.copyright_year
                lead.audit.has_ga4 = audit_res.has_ga4
                lead.audit.has_gtm = audit_res.has_gtm
                lead.audit.has_meta_pixel = audit_res.has_meta_pixel
                lead.audit.has_contact_form = audit_res.has_contact_form
                lead.audit.has_online_booking = audit_res.has_online_booking
                lead.audit.has_live_chat = audit_res.has_live_chat
                lead.audit.social_links = audit_res.social_links
                lead.audit.emails_scraped = audit_res.emails_scraped
                lead.audit.raw_evidence = audit_res.evidence

            audited_count += 1
            ga_str = f"GA4:{'T' if audit_res.has_ga4 else 'N'} | Pix:{'T' if audit_res.has_meta_pixel else 'N'}"
            table.add_row(
                str(lead.id),
                lead.company_name[:23],
                "TAK" if audit_res.ssl_valid else "NIE",
                "TAK" if audit_res.is_responsive else "NIE",
                audit_res.cms_detected or "Nieznany",
                ga_str,
                "TAK" if audit_res.has_online_booking else "NIE",
                f"{len(audit_res.evidence)} faktów z kluczem",
            )

        session.commit()
        console.print(table)
        console.print(
            f"[bold green]✓ Zakończono audyt marketingowy dla {audited_count} witryn.[/bold green]"
        )


@app.command()
def qualify(
    output_excel: Path = typer.Option(
        Path("leads.xlsx"),
        "--output",
        "-o",
        help="Path for Excel export",
    ),
):
    """Dwupoziomowa kwalifikacja (reguły twarde Gate 1 + scoring marketingowy Gate 2)."""
    console.print("[bold yellow]▶ Uruchamianie kwalifikacji i scoringu leadów...[/bold yellow]")
    from leadmachine.qualification.qualifier import LeadQualifier

    qualifier = LeadQualifier()
    q_stats = {"auto_qualified": 0, "needs_review": 0, "auto_disqualified": 0}

    with get_db() as session:
        leads = session.query(Lead).all()
        if not leads:
            console.print("[yellow]Brak leadów w bazie danych do kwalifikacji.[/yellow]")
            return

        table = Table(title="Raport Kwalifikacji i Scoringu Leadów", border_style="yellow")
        table.add_column("ID", style="bold white", width=6)
        table.add_column("Firma", style="bold white", width=25)
        table.add_column("Branża", style="dim", width=18)
        table.add_column("Decyzja Autonomiczna", style="bold", width=20)
        table.add_column("Score", style="bold cyan", width=10)
        table.add_column("Uzasadnienie / Kąt Automatyzacji", style="white", width=45)

        for lead in leads:
            # Run qualification
            q_res = qualifier.qualify_lead(lead, lead.audit)
            lead.score = q_res.total_score
            lead.status = q_res.suggested_status

            if q_res.breakdown:
                lead.score_breakdown = {
                    **q_res.breakdown.model_dump(),
                    "decision": q_res.decision.value,
                    "confidence": q_res.confidence,
                    "automation_fit_reasons": q_res.automation_fit_reasons,
                }

            if q_res.decision.value == "auto_qualified":
                lead.rejection_reason = None
                q_stats["auto_qualified"] += 1
                status_styled = "[bold green]🟢 auto_qualified[/bold green]"
                reason_styled = f"[green]{q_res.breakdown.summary if q_res.breakdown else 'Kwalifikacja OK'}[/green]"
            elif q_res.decision.value == "needs_review":
                lead.rejection_reason = q_res.review_reason
                q_stats["needs_review"] += 1
                status_styled = "[bold yellow]🟡 needs_review[/bold yellow]"
                reason_styled = f"[yellow]{q_res.review_reason}[/yellow]"
            else:
                lead.rejection_reason = q_res.rejection_reason
                q_stats["auto_disqualified"] += 1
                status_styled = "[bold red]🔴 auto_disqualified[/bold red]"
                reason_styled = f"[red]{q_res.rejection_reason}[/red]"

            table.add_row(
                str(lead.id),
                lead.company_name[:24],
                (lead.industry or "-")[:17],
                status_styled,
                f"{lead.score}/100",
                reason_styled[:44],
            )

        session.commit()
        # Export updated Excel
        saved_excel = export_leads_to_excel(leads, output_excel)

        console.print(table)
        console.print(
            f"[bold green]✓ Zakończono kwalifikację autonomiczną:[/bold green] "
            f"Auto-Zaakceptowane: [green]{q_stats['auto_qualified']}[/green], "
            f"Do Weryfikacji: [yellow]{q_stats['needs_review']}[/yellow], "
            f"Auto-Odrzucone: [red]{q_stats['auto_disqualified']}[/red]"
        )
        console.print(f"[bold green]✓ Zaktualizowano arkusz Excel: {saved_excel}[/bold green]")



@app.command()
def ui(
    port: int = typer.Option(8501, "--port", "-p", help="Port for Streamlit dashboard"),
):
    """Uruchamia lokalny interfejs Streamlit do zarządzania leadami i stanami."""
    console.print(
        f"[bold yellow]▶ Uruchamianie panelu Lead Machine na porcie {port}...[/bold yellow]"
    )
    import subprocess
    import sys

    app_path = Path(__file__).parent / "ui" / "app.py"
    cmd = [sys.executable, "-m", "streamlit", "run", str(app_path), "--server.port", str(port)]
    subprocess.run(cmd)


@app.command()
def pipeline(
    auto_send: bool = typer.Option(
        False, "--auto-send", help="Automatyczna wysyłka bez wstrzymania na akceptację człowieka"
    ),
):
    """Uruchom pełny cykl Lead Machine (enrich → audit → qualify → offer). Wstrzymuje wysyłkę do akceptacji człowieka (AI Act)."""
    console.print("[bold yellow]▶ Uruchamianie pipeline'u Lead Machine (Human Oversight)...[/bold yellow]")
    from leadmachine.pipeline.orchestrator import PipelineOrchestrator

    init_db()
    orchestrator = PipelineOrchestrator()

    with get_db() as session:
        report = orchestrator.run_full_cycle(session, auto_send=auto_send)

    # Print rich report table
    table = Table(title="Raport Pipeline'u (AI Act Human-in-the-Loop)", border_style="yellow")
    table.add_column("Etap", style="bold white")
    table.add_column("Wynik", style="bold cyan")

    table.add_row("Wzbogacone dane (CEIDG/KRS)", str(report.enriched_count))
    table.add_row("Zaudytowane strony WWW", str(report.audited_count))
    table.add_row("Auto-zakwalifikowane", f"[green]{report.auto_qualified_count}[/green]")
    table.add_row("Do weryfikacji człowieka", f"[yellow]{report.needs_review_count}[/yellow]")
    table.add_row("Auto-odrzucone", f"[red]{report.auto_disqualified_count}[/red]")
    table.add_row("Oferty wygenerowane", str(report.offers_generated_count))
    table.add_row("Oferty opublikowane (Netlify)", str(report.offers_deployed_count))
    if not auto_send:
        table.add_row("E-maile (AI Act Nadzór)", "[bold yellow]Wstrzymane do weryfikacji człowieka[/bold yellow]")
    else:
        table.add_row("E-maile wysłane", f"[green]{report.emails_sent_count}[/green]")
        table.add_row("E-maile nieudane", f"[red]{report.emails_failed_count}[/red]")

    console.print(table)

    if report.errors:
        console.print("[bold red]Błędy w pipeline:[/bold red]")
        for err in report.errors:
            console.print(f"  ❌ {err}")

if __name__ == "__main__":
    app()
