"""Tests for deduplication and identifier normalization."""

from leadmachine.core.dedup import (
    is_duplicate,
    normalize_domain,
    normalize_nip,
    normalize_phone_e164,
)
from leadmachine.db.models import Lead


def test_normalize_nip():
    assert normalize_nip("691-259-01-58") == "6912590158"
    assert normalize_nip("PL 6912590158") == "6912590158"
    assert normalize_nip("123") is None
    assert normalize_nip(None) is None


def test_normalize_phone_e164():
    assert normalize_phone_e164("733 728 899") == "+48733728899"
    assert normalize_phone_e164("+48 733 728 899") == "+48733728899"
    assert normalize_phone_e164("48733728899") == "+48733728899"
    assert normalize_phone_e164(None) is None


def test_normalize_domain():
    assert normalize_domain("https://procentmarketing.pl/o-nas") == "procentmarketing.pl"
    assert normalize_domain("http://www.firma-testowa.com.pl/kontakt?a=1") == "firma-testowa.com.pl"
    # Generic platforms should be ignored to avoid false-positive duplicate matches
    assert normalize_domain("https://www.facebook.com/profil") is None
    assert normalize_domain("https://booksy.com/pl-pl/123_salon") is None


def test_is_duplicate_db(db_session):
    lead = Lead(
        company_name="Klinika Uśmiechu Sp. z o.o.",
        nip="1234567890",
        phone_normalized="+48768000000",
        website="https://usmiech-legnica.pl",
        address="ul. Złotoryjska 10",
        city="Legnica",
    )
    db_session.add(lead)
    db_session.commit()

    # Match by NIP
    is_dup, reason = is_duplicate(db_session, nip="123-456-78-90")
    assert is_dup is True
    assert "Duplicate NIP" in reason

    # Match by Phone
    is_dup, reason = is_duplicate(db_session, phone_normalized="768 000 000")
    assert is_dup is True
    assert "Duplicate Phone" in reason

    # Match by Domain
    is_dup, reason = is_duplicate(db_session, website="http://www.usmiech-legnica.pl/cennik")
    assert is_dup is True
    assert "Duplicate Domain" in reason

    # Different company
    is_dup, reason = is_duplicate(
        db_session,
        nip="9999999999",
        phone_normalized="+48600111222",
        website="https://inna-firma.pl",
        company_name="Inna Firma",
    )
    assert is_dup is False
    assert reason is None
