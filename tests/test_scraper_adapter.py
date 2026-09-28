"""Tests for ScraperAdapter loading and normalizing data."""

import json

from leadmachine.adapters.scraper_adapter import ScraperAdapter


def test_parse_csv(tmp_path):
    csv_file = tmp_path / "sample.csv"
    csv_file.write_text(
        "business_name,city,phone,address,google_rating,reviews_count,categories,website\n"
        'Stomatologia Legnica,Legnica,+48 76 855 00 11,"ul. Wrocławska 20",4.9,150,Dentysta,https://stomatologia-legnica.pl\n'
        'Barber Wrocław,Wrocław,+48 71 333 44 55,"ul. Świdnicka 1",4.8,90,Fryzjer,https://barber-wroclaw.pl\n',
        encoding="utf-8",
    )

    leads = ScraperAdapter.load_from_file(csv_file)
    assert len(leads) == 2
    assert leads[0].company_name == "Stomatologia Legnica"
    assert leads[0].city == "Legnica"
    assert leads[0].google_rating == 4.9
    assert leads[0].reviews_count == 150
    assert leads[0].website == "https://stomatologia-legnica.pl"


def test_parse_json(tmp_path):
    json_file = tmp_path / "sample.json"
    data = [
        {
            "title": "Kancelaria Prawna Legnica",
            "city": "Legnica",
            "phone": "+48 76 123 45 67",
            "address": "Rynek 15, Legnica",
            "totalScore": 5.0,
            "reviewsCount": 42,
            "website": "https://kancelaria-legnica.pl",
            "location": {"lat": 51.2075, "lng": 16.1610},
        }
    ]
    json_file.write_text(json.dumps(data), encoding="utf-8")

    leads = ScraperAdapter.load_from_file(json_file)
    assert len(leads) == 1
    assert leads[0].company_name == "Kancelaria Prawna Legnica"
    assert leads[0].latitude == 51.2075
    assert leads[0].longitude == 16.1610
    assert leads[0].google_rating == 5.0
