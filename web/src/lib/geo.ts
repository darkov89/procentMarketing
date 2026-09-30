/**
 * Geographic validation & Haversine distance calculator.
 * Supports configurable target regions, cities, and custom search radius across Poland.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export const LEGNICA_RYNEK: GeoPoint = {
  lat: 51.2070,
  lon: 16.1605,
};

export const WROCLAW_RYNEK: GeoPoint = {
  lat: 51.1079,
  lon: 17.0385,
};

export const KNOWN_CITIES_COORDS: Record<string, GeoPoint> = {
  legnica: { lat: 51.2070, lon: 16.1605 },
  wrocław: { lat: 51.1079, lon: 17.0385 },
  wroclaw: { lat: 51.1079, lon: 17.0385 },
  lubin: { lat: 51.3980, lon: 16.2030 },
  jawor: { lat: 51.0505, lon: 16.1932 },
  złotoryja: { lat: 51.1278, lon: 15.9189 },
  zlotoryja: { lat: 51.1278, lon: 15.9189 },
  chojnów: { lat: 51.2720, lon: 15.9360 },
  chojnow: { lat: 51.2720, lon: 15.9360 },
  polkowice: { lat: 51.5030, lon: 16.0680 },
  wałbrzych: { lat: 50.7670, lon: 16.2840 },
  walbrzych: { lat: 50.7670, lon: 16.2840 },
  "jelenia góra": { lat: 50.9044, lon: 15.7384 },
  "jelenia gora": { lat: 50.9044, lon: 15.7384 },
  prochowice: { lat: 51.2250, lon: 16.3650 },
  strzegom: { lat: 50.9600, lon: 16.3480 },
  warszawa: { lat: 52.2297, lon: 21.0122 },
  poznań: { lat: 52.4064, lon: 16.9252 },
  poznan: { lat: 52.4064, lon: 16.9252 },
  kraków: { lat: 50.0647, lon: 19.9450 },
  krakow: { lat: 50.0647, lon: 19.9450 },
  katowice: { lat: 50.2649, lon: 19.0238 },
  gdańsk: { lat: 54.3520, lon: 18.6466 },
  gdansk: { lat: 54.3520, lon: 18.6466 },
};

export const DEFAULT_RADIUS_KM = 30.0;

export interface GeoValidationResult {
  isAllowed: boolean;
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
  rejectionReason: string | null;
}

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Checks if a string contains any variant of Wrocław (kept for backwards-compatibility).
 */
export function isWroclaw(text?: string | null): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return (
    normalized.includes("wroc") ||
    normalized.includes("wrocław") ||
    normalized.includes("wroclaw") ||
    normalized.includes("breslau")
  );
}

/**
 * Validates a lead's geographic location against user-selected center city and radius.
 * No hardcoded exclusions — user has full freedom of target region and cities.
 */
export function validateGeo(params: {
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maxRadiusKm?: number | null;
  centerCity?: string | null;
  centerCoordinates?: GeoPoint | null;
  excludedCities?: string[];
}): GeoValidationResult {
  const maxRadius = params.maxRadiusKm;

  // 1. Optional user-configured excluded cities (if user explicitly blacklists any)
  if (params.excludedCities && params.excludedCities.length > 0) {
    const leadCityNorm = (params.city || "").toLowerCase().trim();
    const leadAddrNorm = (params.address || "").toLowerCase().trim();
    for (const exc of params.excludedCities) {
      const excNorm = exc.toLowerCase().trim();
      if (excNorm && (leadCityNorm.includes(excNorm) || leadAddrNorm.includes(excNorm))) {
        return {
          isAllowed: false,
          distanceKm: null,
          latitude: params.latitude ?? null,
          longitude: params.longitude ?? null,
          rejectionReason: `Miasto wykluczone w konfiguracji użytkownika: ${exc}`,
        };
      }
    }
  }

  // 2. If no radius limit is set (null, 0, >= 999, or "all" / "cała polska"), allow everywhere
  const centerCityKey = (params.centerCity || "").trim().toLowerCase();
  if (
    maxRadius === null ||
    maxRadius === undefined ||
    maxRadius <= 0 ||
    maxRadius >= 999 ||
    centerCityKey === "all" ||
    centerCityKey === "wszystkie" ||
    centerCityKey === "cała polska"
  ) {
    return {
      isAllowed: true,
      distanceKm: 0.0,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      rejectionReason: null,
    };
  }

  // 3. Resolve Center Point
  let center: GeoPoint = params.centerCoordinates || LEGNICA_RYNEK;
  if (centerCityKey && KNOWN_CITIES_COORDS[centerCityKey]) {
    center = KNOWN_CITIES_COORDS[centerCityKey];
  }

  // 4. If coordinates are provided, compute exact distance to selected center
  if (params.latitude != null && params.longitude != null) {
    const dist = haversineDistance(
      center.lat,
      center.lon,
      params.latitude,
      params.longitude
    );

    if (dist > maxRadius) {
      return {
        isAllowed: false,
        distanceKm: dist,
        latitude: params.latitude,
        longitude: params.longitude,
        rejectionReason: `Lokalizacja poza wybranym promieniem (${dist.toFixed(1)} km > ${maxRadius} km od centrum ${params.centerCity || "wybranego miasta"})`,
      };
    }

    return {
      isAllowed: true,
      distanceKm: dist,
      latitude: params.latitude,
      longitude: params.longitude,
      rejectionReason: null,
    };
  }

  // 5. Fallback: match by city name against known cities
  const leadCityKey = (params.city || "").trim().toLowerCase();
  if (leadCityKey in KNOWN_CITIES_COORDS) {
    const cityCoords = KNOWN_CITIES_COORDS[leadCityKey];
    const dist = haversineDistance(center.lat, center.lon, cityCoords.lat, cityCoords.lon);
    if (dist <= maxRadius) {
      return {
        isAllowed: true,
        distanceKm: dist,
        latitude: cityCoords.lat,
        longitude: cityCoords.lon,
        rejectionReason: null,
      };
    } else {
      return {
        isAllowed: false,
        distanceKm: dist,
        latitude: cityCoords.lat,
        longitude: cityCoords.lon,
        rejectionReason: `Miasto ${params.city} oddalone o ${dist.toFixed(1)} km od centrum (${params.centerCity || "wybranego miasta"}), limit to ${maxRadius} km`,
      };
    }
  }

  // Default: allow
  return {
    isAllowed: true,
    distanceKm: 0.0,
    latitude: null,
    longitude: null,
    rejectionReason: null,
  };
}
