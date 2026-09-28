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
        copyright_year=2021, # outdated website!
        has_online_booking=False, # needs automation!
        has_contact_form=True,
        has_ga4=False,
        has_meta_pixel=False,
        google_rating=4.9,
        google_reviews_count=85,
    )

    res = qualifier.qualify_lead(lead, audit)

    assert res.is_qualified is True
    assert res.total_score >= 60
    assert res.breakdown is not None
    assert res.breakdown.industry_match == 30 # Medical is priority!
    assert res.breakdown.automation_need >= 15 # Missing booking and GA4!
    assert res.breakdown.payment_ability >= 12 # Sp. z o.o. + 85 reviews!
