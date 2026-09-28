"""Adapter for ingesting and normalizing scraper outputs (CSV, JSON, Apify)."""

import csv
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class RawLead:
    company_name: str
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    nip: Optional[str] = None
    industry_category: Optional[str] = None
    google_rating: Optional[float] = None
    reviews_count: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


def clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def clean_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def clean_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return None


class ScraperAdapter:
    """Parses various scraper outputs into unified RawLead records."""

    @classmethod
    def load_from_file(cls, file_path: Path) -> List[RawLead]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Input scraper file not found: {file_path}")

        suffix = path.suffix.lower()
        if suffix == ".csv":
            return cls.parse_csv(path)
        elif suffix == ".json":
            return cls.parse_json(path)
        else:
            raise ValueError(f"Unsupported file format: {suffix}. Supported: .csv, .json")

    @classmethod
    def parse_csv(cls, path: Path) -> List[RawLead]:
        leads = []
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                lead = cls._normalize_dict(row)
                if lead and lead.company_name:
                    leads.append(lead)
        return leads

    @classmethod
    def parse_json(cls, path: Path) -> List[RawLead]:
        leads = []
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data if isinstance(data, list) else data.get("items", [data])
        for item in items:
            if isinstance(item, dict):
                lead = cls._normalize_dict(item)
                if lead and lead.company_name:
                    leads.append(lead)
        return leads

    @classmethod
    def _normalize_dict(cls, d: Dict[str, Any]) -> Optional[RawLead]:
        # Lowercase keys mapping for robust matching
        lower_map = {k.lower().strip(): v for k, v in d.items()}

        company_name = (
            lower_map.get("business_name")
            or lower_map.get("company_name")
            or lower_map.get("name")
            or lower_map.get("title")
            or lower_map.get("hero_title_clean")
        )
        if not company_name:
            return None

        city = lower_map.get("city")
        address = (
            lower_map.get("address")
            or lower_map.get("street")
            or lower_map.get("formatted_address")
        )

        phone = (
            lower_map.get("phone")
            or lower_map.get("telephone")
            or lower_map.get("phone_number")
            or lower_map.get("contact_phone")
        )

        email = lower_map.get("email") or lower_map.get("mail") or lower_map.get("email_address")
        website = (
            lower_map.get("website")
            or lower_map.get("url")
            or lower_map.get("website_url")
            or lower_map.get("site")
        )
        nip = lower_map.get("nip") or lower_map.get("tax_id") or lower_map.get("vat_id")

        category = (
            lower_map.get("categories")
            or lower_map.get("category")
            or lower_map.get("categoryname")
            or lower_map.get("theme")
        )

        google_rating = clean_float(
            lower_map.get("google_rating") or lower_map.get("totalscore") or lower_map.get("rating")
        )

        reviews_count = clean_int(
            lower_map.get("reviews_count")
            or lower_map.get("reviewscount")
            or lower_map.get("user_ratings_total")
        )

        # Coordinates
        lat = clean_float(lower_map.get("lat") or lower_map.get("latitude"))
        lon = clean_float(
            lower_map.get("lng") or lower_map.get("lon") or lower_map.get("longitude")
        )

        # Apify nested location object check
        location_obj = d.get("location")
        if isinstance(location_obj, dict):
            if lat is None:
                lat = clean_float(location_obj.get("lat"))
            if lon is None:
                lon = clean_float(location_obj.get("lng") or location_obj.get("lon"))

        return RawLead(
            company_name=clean_str(company_name),
            city=clean_str(city),
            address=clean_str(address),
            phone=clean_str(phone),
            email=clean_str(email),
            website=clean_str(website),
            nip=clean_str(nip),
            industry_category=clean_str(category),
            google_rating=google_rating,
            reviews_count=reviews_count,
            latitude=lat,
            longitude=lon,
            raw_data=d,
        )
