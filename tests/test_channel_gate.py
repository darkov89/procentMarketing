"""Tests for ChannelGate and consent restrictions."""

import pytest

from leadmachine.core.channel_gate import (
    ChannelBlockedException,
    ChannelGate,
    ConsentRequiredException,
)
from leadmachine.db.models import Consent, Lead


def test_channel_gate_allows_email_by_default(db_session):
    lead = Lead(company_name="Test Firma", status="new")
    db_session.add(lead)
    db_session.commit()

    # Email is allowed by default
    assert ChannelGate.verify_permission(db_session, lead.id, "email") is True


def test_channel_gate_strictly_blocks_sms_without_consent(db_session):
    lead = Lead(company_name="Test Firma", status="new")
    db_session.add(lead)
    db_session.commit()

    with pytest.raises(ConsentRequiredException) as exc:
        ChannelGate.verify_permission(db_session, lead.id, "sms")
    assert "No active, evidenced consent record" in str(exc.value)


def test_channel_gate_strictly_blocks_whatsapp_without_consent(db_session):
    lead = Lead(company_name="Test Firma", status="new")
    db_session.add(lead)
    db_session.commit()

    with pytest.raises(ConsentRequiredException) as exc:
        ChannelGate.verify_permission(db_session, lead.id, "whatsapp")
    assert "No active, evidenced consent record" in str(exc.value)


def test_channel_gate_allows_sms_when_consent_exists(db_session):
    lead = Lead(company_name="Test Firma", status="new")
    db_session.add(lead)
    db_session.commit()

    consent = Consent(
        lead_id=lead.id,
        channel="sms",
        granted=True,
        source="booking_form",
        evidence_text="Formularz na stronie oferty zaznaczony zgoda na SMS",
    )
    db_session.add(consent)
    db_session.commit()

    assert ChannelGate.verify_permission(db_session, lead.id, "sms") is True


def test_channel_gate_rejects_unsupported_channel(db_session):
    lead = Lead(company_name="Test Firma", status="new")
    db_session.add(lead)
    db_session.commit()

    with pytest.raises(ChannelBlockedException):
        ChannelGate.verify_permission(db_session, lead.id, "telegram_direct")
