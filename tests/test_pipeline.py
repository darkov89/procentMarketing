"""Unit test for PipelineOrchestrator end-to-end execution."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from leadmachine.db.models import Base, Lead
from leadmachine.pipeline.orchestrator import PipelineOrchestrator


def test_pipeline_orchestrator_cycle():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    # Seed 3 leads:
    # 1. High value Dental clinic in Legnica (should auto-qualify, get offer generated, deployed, and email sent!)
    # 2. Corner grocery "Pani Krysia" (should auto-disqualify, NO offer, NO email)
    # 3. Wrocław company (should be skipped/ignored by pipeline)
    lead_dental = Lead(
        company_name="Klinika Stomatologiczna Legnica Dent",
        industry="Stomatologia",
        city="Legnica",
        distance_km=1.2,
        email_primary="recepcja@stomatologia-test.pl",
        phone_normalized="+48768001122",
        website="https://stomatologia-test.pl",
        status="new",
    )
    lead_krysia = Lead(
        company_name="Sklep Spożywczy U Pani Krysi",
        industry="Sklep spożywczy",
        city="Legnica",
        distance_km=1.0,
        email_primary="krysia@sklep.pl",
        phone_normalized="+48768001123",
        status="new",
    )
    lead_wroclaw = Lead(
        company_name="Kancelaria Wrocław",
        city="Wrocław",
        status="disqualified",
        rejection_reason="Wrocław jest wykluczony",
    )

    session.add_all([lead_dental, lead_krysia, lead_wroclaw])
    session.commit()

    orchestrator = PipelineOrchestrator()
    report = orchestrator.run_full_cycle(session, ignore_window=True)

    # Dental clinic should be auto-qualified, get offer generated & deployed, and email sent
    assert report.auto_qualified_count >= 1
    assert report.auto_disqualified_count >= 1
    assert report.offers_generated_count >= 1
    assert report.offers_deployed_count >= 1
    assert report.emails_sent_count >= 1

    # Verify state in DB
    session.refresh(lead_dental)
    assert lead_dental.status == "sent"
    assert lead_dental.offer is not None
    assert lead_dental.offer.status == "published"
    assert "stomatolog" in lead_dental.offer.slug or "dent" in lead_dental.offer.slug

    session.refresh(lead_krysia)
    assert lead_krysia.status == "disqualified"
    assert lead_krysia.offer is None

    session.close()
