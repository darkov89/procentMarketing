"""Tests for LeadQualifier (Hard rules + Subscores)."""

from leadmachine.db.models import Audit, Lead
from leadmachine.qualification.qualifier import LeadQualifier


def test_hard_rules_disqualify_blacklisted_industry():
    qualifier = LeadQualifier()

    # Barber
    lead_barber = Lead(
        company_name="Barber Shop Legnica",
        industry="Fryzjer",
        phone_normalized="+48768001122",
        city="Legnica",
        distance_km=1.0,
    )
    passes, reason = qualifier.check_hard_rules(lead_barber)
    assert passes is False
    assert "czarnej liście" in reason

    # Hydraulik
    lead_plumber = Lead(
        company_name="Usługi Hydrauliczne Legnica Jan Ziomek",
        industry="Hydraulik",
        phone_normalized="+48768001122",
        city="Legnica",
        distance_km=2.0,
    )
    passes, reason = qualifier.check_hard_rules(lead_plumber)
    assert passes is False
    assert "czarnej liście" in reason


def test_hard_rules_disqualify_wroclaw_and_out_of_radius():
    qualifier = LeadQualifier()

    lead_wroclaw = Lead(
        company_name="Kancelaria Wrocław",
        city="Wrocław",
        phone_normalized="+48713000000",
        distance_km=65.0,
    )
    passes, reason = qualifier.check_hard_rules(lead_wroclaw)
    assert passes is False
    assert "Wrocław" in reason

    lead_far = Lead(
        company_name="Kancelaria Jelenia Góra",
        city="Jelenia Góra",
        phone_normalized="+48757000000",
        distance_km=48.0,
    )
    passes, reason = qualifier.check_hard_rules(lead_far)
    assert passes is False
    assert "przekracza promień 30 km" in reason


def test_priority_lead_qualification_and_scoring():
    qualifier = LeadQualifier()

    # Medical clinic in Legnica (Priority industry, good prospect)
    lead = Lead(
        company_name="Centrum Stomatologii i Implantologii Sp. z o.o.",
        industry="Stomatologia",
        city="Legnica",
        distance_km=1.5,
        phone_normalized="+48768550011",
        email_primary="kontakt@stomatologia-legnica.pl",
        website="https://stomatologia-legnica.pl",
        owner_confidence="high",
    )
    audit = Audit(
        ssl_valid=True,
        is_responsive=True,
        copyright_year=2021,  # outdated website!
        has_online_booking=False,  # needs automation!
        has_contact_form=True,
        has_ga4=False,
        has_meta_pixel=False,
        google_rating=4.9,
        google_reviews_count=85,
    )

    res = qualifier.qualify_lead(lead, audit)

    assert res.is_qualified is True
    assert res.decision.value == "auto_qualified"
    assert res.suggested_status == "qualified"
    assert res.total_score >= 60
    assert len(res.automation_fit_reasons) > 0
    assert any("rezerwacji" in reason.lower() for reason in res.automation_fit_reasons)
    assert res.breakdown is not None
    assert res.breakdown.industry_match == 30  # Medical is priority!
    assert res.breakdown.automation_need >= 15  # Missing booking and GA4!
    assert res.breakdown.payment_ability >= 12  # Sp. z o.o. + 85 reviews!


def test_auto_disqualification_pani_krysia_and_trainers():
    qualifier = LeadQualifier()

    # Trainer - hard rule
    lead_trainer = Lead(
        company_name="Trener Personalny Legnica Tomasz Kloc",
        industry="Trening personalny i fitness",
        phone_normalized="+48768000000",
        city="Legnica",
        distance_km=2.0,
    )
    res_trainer = qualifier.qualify_lead(lead_trainer)
    assert res_trainer.is_qualified is False
    assert res_trainer.decision.value == "auto_disqualified"
    assert res_trainer.suggested_status == "disqualified"

    # Sklep Pani Krysi - micro retail
    lead_krysia = Lead(
        company_name="Sklep Spożywczy U Pani Krysi",
        industry="Handel detaliczny",
        phone_normalized="+48768000001",
        city="Legnica",
        distance_km=1.0,
    )
    res_krysia = qualifier.qualify_lead(lead_krysia)
    assert res_krysia.is_qualified is False
    assert res_krysia.decision.value == "auto_disqualified"
    assert res_krysia.suggested_status == "disqualified"

    # Kiosk / Warzywniak
    lead_warzywa = Lead(
        company_name="Warzywa i Owoce Świeży Kącik",
        industry="Warzywniak",
        phone_normalized="+48768000002",
        city="Legnica",
        distance_km=3.0,
    )
    res_warzywa = qualifier.qualify_lead(lead_warzywa)
    assert res_warzywa.is_qualified is False
    assert res_warzywa.decision.value == "auto_disqualified"


def test_needs_review_uncertain_lead():
    qualifier = LeadQualifier()

    # General non-priority business with mediocre score (uncertain)
    lead_uncertain = Lead(
        company_name="Centrum Usług Poligraficznych i Reklamy Jan Nowak",
        industry="Poligrafia i druk",
        city="Legnica",
        distance_km=4.0,
        phone_normalized="+48768112233",
        email_primary="biuro@druk-legnica.pl",
        website="https://druk-legnica.pl",
        owner_confidence="low",
    )
    audit = Audit(
        ssl_valid=True,
        is_responsive=True,
        copyright_year=2023,
        has_contact_form=True,
        has_online_booking=False,
        has_ga4=True,
        google_rating=4.2,
        google_reviews_count=8,  # small reviews count
    )

    res = qualifier.qualify_lead(lead_uncertain, audit)
    # Total score should be around 50-65, non-priority industry -> NEEDS_REVIEW
    assert res.decision.value == "needs_review"
    assert res.suggested_status == "needs_review"
    assert res.review_reason is not None
    assert "Niejednoznaczny" in res.review_reason

