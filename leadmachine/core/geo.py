"""Geographic filtering and validation for Legnica 30km radius."""

import math
import re
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from leadmachine.config import get_settings

# Approximate center coordinates for key Lower Silesian towns for local offline resolution
KNOWN_CITIES_COORDS: Dict[str, Tuple[float, float]] = {
    "legnica": (51.2070, 16.1605),
    "chojnów": (51.2725, 15.9360),
    "chojnow": (51.2725, 15.9360),
    "złotoryja": (51.1270, 15.9200),
    "zlotoryja": (51.1270, 15.9200),
    "jawor": (51.0503, 16.1936),
    "lubin": (51.3984, 16.2008),
    "prochowice": (51.2244, 16.3639),
    "środa śląska": (51.1645, 16.5936),
    "sroda slaska": (51.1645, 16.5936),
    "polkowice": (51.5034, 16.0694),
    "strzegom": (50.9592, 16.3494),
    "bolesławiec": (51.2639, 15.5667), # ~42 km - outside
    "boleslawiec": (51.2639, 15.5667),
    "głogów": (51.6635, 16.0845),     # ~51 km - outside
    "glogow": (51.6635, 16.0845),
    "wrocław": (51.1079, 17.0385),     # ~65 km - HARD REJECT
    "wroclaw": (51.1079, 17.0385),
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers using Haversine formula."""
    r = 6371.0 # Earth's radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 2)


@dataclass
class GeoValidationResult:
    is_allowed: bool
    distance_km: Optional[float]
    latitude: Optional[float]
    longitude: Optional[float]
    rejection_reason: Optional[str] = None


def normalize_city_name(city: Optional[str]) -> str:
    if not city:
        return ""
    clean = city.strip().lower()
    # Remove postal codes or district affixes if present
    clean = re.sub(r"^\d{2}-\d{3}\s*", "", clean)
    return clean


def is_wroclaw(city: Optional[str], address: Optional[str]) -> bool:
    text = f"{city or ''} {address or ''}".lower()
    wroclaw_patterns = [r"\bwroc[łl]aw\b", r"\bwroc[łl]awia\b", r"\bwroc[łl]awiu\b"]
    return any(re.search(pat, text) for pat in wroclaw_patterns)


def validate_geo(
    city: Optional[str] = None,
    address: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> GeoValidationResult:
    """Validates geographic boundaries: Legnica center, max 30km, hard reject Wrocław."""
    settings = get_settings()
    center_lat = settings.geo.center_lat
    center_lon = settings.geo.center_lon
    max_radius = settings.geo.radius_km

    # 1. HARD RULE: Check if Wrocław is mentioned
    if is_wroclaw(city, address):
        return GeoValidationResult(
            is_allowed=False,
            distance_km=None,
            latitude=latitude,
            longitude=longitude,
            rejection_reason="Wrocław is strictly excluded by policy",
        )

    # 2. Resolve coordinates if missing
    resolved_lat = latitude
    resolved_lon = longitude

    if resolved_lat is None or resolved_lon is None:
        clean_city = normalize_city_name(city)
        if clean_city in KNOWN_CITIES_COORDS:
            resolved_lat, resolved_lon = KNOWN_CITIES_COORDS[clean_city]
        else:
            # Check if city name is inside address
            for known_name, coords in KNOWN_CITIES_COORDS.items():
                if address and re.search(rf"\b{known_name}\b", address.lower()):
                    resolved_lat, resolved_lon = coords
                    break

    # If still no coordinates and no city match, check if town is unknown
    if resolved_lat is None or resolved_lon is None:
        return GeoValidationResult(
            is_allowed=False,
            distance_km=None,
            latitude=None,
            longitude=None,
            rejection_reason=f"Could not determine coordinates for city: '{city}' / address: '{address}'",
        )

    # 3. Calculate distance to Legnica Rynek
    distance = haversine_km(center_lat, center_lon, resolved_lat, resolved_lon)

    if distance > max_radius:
        return GeoValidationResult(
            is_allowed=False,
            distance_km=distance,
            latitude=resolved_lat,
            longitude=resolved_lon,
            rejection_reason=f"Distance {distance} km exceeds maximum radius of {max_radius} km from Legnica",
        )

    return GeoValidationResult(
        is_allowed=True,
        distance_km=distance,
        latitude=resolved_lat,
        longitude=resolved_lon,
        rejection_reason=None,
    )
