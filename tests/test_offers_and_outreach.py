"""Unit tests for offer generation, HTML rendering, Netlify deployer, and email outreach."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from leadmachine.db.models import Audit, Base, Lead, Offer, Suppression
from leadmachine.offers.generator import OfferGenerator
from leadmachine.offers.html_renderer import render_offer_page
from leadmachine.offers.netlify_deployer import NetlifyDeployer
from leadmachine.outreach.email_composer import compose_outreach_email
from leadmachine.outreach.smtp_sender import (
    KillSwitchActiveError,
    SmtpSender,
    SuppressionListBlockedError,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_offer_generator_tailored_fallback():
    generator = OfferGenerator()

    # Medical / Dental lead
    lead = Lead(
        company_name="Klinika Stomatologii Dr Nowak",
        industry="Stomatologia i implanty",
        city="Legnica",
        distance_km=2.0,
    )
    audit = Audit(
        ssl_valid=True,
        is_responsive=True,
        has_online_booking=False,  # Clear automation gap!
        has_contact_form=False,
        copyright_year=2021,
        google_reviews_count=45,
    )

    offer = generator.generate(lead, audit)
    assert "Nowak" in offer.hero_headline or "Stomatologii" in offer.hero_headline
    assert len(offer.observations) >= 2
    assert any("rezerwacji" in o.finding.lower() for o in offer.observations)
    assert len(offer.proposed_modules) >= 2
    assert any("rezerwacj" in m.name.lower() or "kalendarz" in m.name.lower() for m in offer.proposed_modules)
    assert offer.pricing_range != ""
    assert len(offer.process_steps) >= 3


def test_html_renderer_generates_valid_responsive_page():
    generator = OfferGenerator()
    lead = Lead(
        company_name="Kancelaria Prawna Jawor",
        industry="Kancelaria prawna",
        city="Jawor",
    )
    offer = generator.generate(lead, None)

    html = render_offer_page(offer, lead, slug="kancelaria-jawor")
    assert "<!DOCTYPE html>" in html
    assert "Kancelaria Prawna Jawor" in html
    assert "Plus Jakarta Sans" in html
    assert "#FFE600" in html  # Brand accent
    assert "RODO" in html
    assert "Procent Marketing" in html


def test_netlify_deployer_local_fallback(tmp_path):
    deployer = NetlifyDeployer()
    # Override output_dir to tmp_path for clean test
    deployer.output_dir = tmp_path

    html = "<html><body><h1>Test Offer</h1></body></html>"
    slug = "test-lead-slug"

    res = deployer.deploy(html, slug)
    assert res.is_local is True
    assert (tmp_path / slug / "index.html").exists()
    assert (tmp_path / slug / "index.html").read_text(encoding="utf-8") == html
    assert "file://" in res.url


def test_email_composer_rodo_and_grounded_findings():
    lead = Lead(
        company_name="Centrum Medyczne Lubin",
        industry="Gabinety lekarskie",
        city="Lubin",
        email_primary="recepcja@med-lubin.pl",
        score_breakdown={
            "automation_fit_reasons": ["Brak rezerwacji online wizyt 24/7"],
            "summary": "Wysoki potencjał cyfryzacji gabinetu",
        },
    )
    offer = Offer(
        slug="centrum-medyczne-lubin",
        title="Dedykowany system dla Centrum Medyczne Lubin",
        booking_url="https://oferta.procentmarketing.pl/centrum-medyczne-lubin",
        deploy_url="https://oferta.procentmarketing.pl/centrum-medyczne-lubin",
    )

    draft = compose_outreach_email(lead=lead, offer=offer)
    assert "Centrum Medyczne Lubin" in draft.subject
    assert "recepcja@med-lubin.pl" == draft.recipient_email
    assert "RODO" in draft.body_text
    assert "WYPISZ" in draft.body_text
    assert "https://oferta.procentmarketing.pl/centrum-medyczne-lubin" in draft.body_text
    assert "<a href=" in draft.body_html


def test_smtp_sender_safety_gates(db_session, tmp_path, monkeypatch):
    sender = SmtpSender()

    # 1. Kill Switch Check
    stop_file = tmp_path / "STOP"
    stop_file.touch()
    monkeypatch.setattr(sender.settings, "kill_switch_file", str(stop_file))

    with pytest.raises(KillSwitchActiveError):
        sender.check_kill_switch()

    stop_file.unlink()

    # 2. Suppression Check
    import hashlib

    email = "blocked@example.com"
    h_email = hashlib.sha256(email.encode("utf-8")).hexdigest()
    supp = Suppression(hashed_email=h_email, raw_identifier=email, reason="opt_out")
    db_session.add(supp)
    db_session.commit()

    lead_suppressed = Lead(company_name="Suppressed Sp. z o.o.", email_primary=email)
    with pytest.raises(SuppressionListBlockedError):
        sender.check_suppression(db_session, lead_suppressed)

    # 3. Idempotency Check & Sandbox Send
    lead_ok = Lead(
        id=101,
        company_name="Firma Testowa Legnica",
        email_primary="kontakt@test-legnica.pl",
    )
    db_session.add(lead_ok)
    db_session.commit()

    draft = compose_outreach_email(lead=lead_ok, offer_url="https://oferta.local/101")
    res1 = sender.send_email(draft, lead_ok, db_session, ignore_window=True)
    assert res1.success is True
    assert res1.was_test_mode is True  # In sandbox mode

    # Second send with same lead + template should be blocked by idempotency
    res2 = sender.send_email(draft, lead_ok, db_session, ignore_window=True)
    assert res2.success is False
    assert "already exists" in (res2.error_message or "").lower()
