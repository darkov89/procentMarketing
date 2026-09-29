/**
 * Geographic validation & Haversine distance calculator.
 * Strict enforcement of AGENTS.md: Wrocław is unconditionally excluded with zero tolerance.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export const LEGNICA_RYNEK: GeoPoint = {
  lat: 51.2070,
  lon: 16.1605,
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
 * Checks if a string contains any variant of Wrocław.
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
 * Validates a lead's geographic location.
 * Wrocław is unconditionally rejected regardless of coordinates or distance.
 */
export function validateGeo(params: {
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maxRadiusKm?: number;
}): GeoValidationResult {
  const maxRadius = params.maxRadiusKm ?? DEFAULT_RADIUS_KM;

  // 1. HARD RULE: Zero tolerance for Wrocław in city or address
  if (isWroclaw(params.city) || isWroclaw(params.address)) {
    return {
      isAllowed: false,
      distanceKm: null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      rejectionReason: "Bezwzględne wykluczenie: miasto Wrocław (zero tolerance)",
    };
  }

  // 2. If coordinates are provided, compute exact distance
  if (params.latitude != null && params.longitude != null) {
    const dist = haversineDistance(
      LEGNICA_RYNEK.lat,
      LEGNICA_RYNEK.lon,
      params.latitude,
      params.longitude
    );

    if (dist > maxRadius) {
      return {
        isAllowed: false,
        distanceKm: dist,
        latitude: params.latitude,
        longitude: params.longitude,
        rejectionReason: `Lokalizacja poza dozwolonym promieniem (${dist.toFixed(1)} km > ${maxRadius} km od Legnicy)`,
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

  // 3. Fallback: Known allowed towns within 30km of Legnica
  const knownAllowedTowns: Record<string, number> = {
    legnica: 0.0,
    lubin: 23.5,
    jawor: 18.2,
    złotoryja: 19.8,
    zlotoryja: 19.8,
    chojnów: 18.0,
    chojnow: 18.0,
    prochowice: 15.5,
    strzegom: 28.5,
    polkowice: 34.0, // outside default 30km
  };

  const cityKey = (params.city || "").trim().toLowerCase();
  if (cityKey in knownAllowedTowns) {
    const dist = knownAllowedTowns[cityKey];
    if (dist <= maxRadius) {
      return {
        isAllowed: true,
        distanceKm: dist,
        latitude: null,
        longitude: null,
        rejectionReason: null,
      };
    } else {
      return {
        isAllowed: false,
        distanceKm: dist,
        latitude: null,
        longitude: null,
        rejectionReason: `Miasto ${params.city} oddalone o ${dist} km (limit: ${maxRadius} km)`,
      };
    }
  }

  // Default: allow if city is Legnica or unspecified, flag distance as unknown
  return {
    isAllowed: true,
    distanceKm: 0.0,
    latitude: null,
    longitude: null,
    rejectionReason: null,
  };
}
