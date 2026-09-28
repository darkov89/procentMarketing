"""Tests for geographic filtering and Haversine distance validation."""

from leadmachine.core.geo import haversine_km, validate_geo


def test_haversine_same_point():
    dist = haversine_km(51.2070, 16.1605, 51.2070, 16.1605)
    assert dist == 0.0


def test_legnica_is_allowed():
    res = validate_geo(city="Legnica", address="Rynek 1")
    assert res.is_allowed is True
    assert res.distance_km == 0.0
    assert res.rejection_reason is None


def test_nearby_towns_under_30km_are_allowed():
    # Chojnów (~17 km)
    chojnow = validate_geo(city="Chojnów")
    assert chojnow.is_allowed is True
    assert chojnow.distance_km is not None
    assert chojnow.distance_km < 30.0

    # Jawor (~17 km)
    jawor = validate_geo(city="Jawor")
    assert jawor.is_allowed is True
    assert jawor.distance_km < 30.0

    # Lubin (~21 km)
    lubin = validate_geo(city="Lubin")
    assert lubin.is_allowed is True
    assert lubin.distance_km < 30.0

    # Złotoryja (~19 km)
    zlotoryja = validate_geo(city="Złotoryja")
    assert zlotoryja.is_allowed is True
    assert zlotoryja.distance_km < 30.0


def test_wroclaw_is_strictly_rejected_even_with_fake_coords():
    # Hard rejection: city name Wrocław
    res = validate_geo(city="Wrocław", latitude=51.2070, longitude=16.1605)
    assert res.is_allowed is False
    assert "Wrocław is strictly excluded" in res.rejection_reason

    # Wroclaw without polish diacritics
    res_no_diacritics = validate_geo(city="Wroclaw")
    assert res_no_diacritics.is_allowed is False
    assert "Wrocław is strictly excluded" in res_no_diacritics.rejection_reason

    # Wrocław in address
    res_address = validate_geo(city="", address="ul. Krakowska 98, Wrocław")
    assert res_address.is_allowed is False
    assert "Wrocław is strictly excluded" in res_address.rejection_reason


def test_towns_beyond_30km_are_rejected():
    # Bolesławiec (~42 km from Legnica)
    boleslawiec = validate_geo(city="Bolesławiec")
    assert boleslawiec.is_allowed is False
    assert boleslawiec.distance_km > 30.0
    assert "exceeds maximum radius" in boleslawiec.rejection_reason

    # Głogów (~51 km from Legnica)
    glogow = validate_geo(city="Głogów")
    assert glogow.is_allowed is False
    assert glogow.distance_km > 30.0
