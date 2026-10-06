export interface GeoBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PlaceSearchResult {
  id: string; // place_id e.g. "ChIJ..."
  displayName: string;
  formattedAddress?: string;
  location?: GeoPoint;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  phoneNumber?: string;
  primaryType?: string;
}

export interface SearchPageResponse {
  places: PlaceSearchResult[];
  nextPageToken?: string;
}

export interface DiscoverySearchCriteria {
  textQuery: string;
  bbox: GeoBoundingBox;
  includedType?: string;
  minRating?: number;
}

/**
 * Universal interface for discovery sources (Google Places, REGON, CSV, etc.)
 */
export interface DiscoverySource {
  name: string;
  search(criteria: DiscoverySearchCriteria, pageToken?: string): Promise<SearchPageResponse>;
  getPlaceDetails?(placeId: string): Promise<PlaceSearchResult | null>;
}

/**
 * Generates an initial rectangular grid of bounding boxes covering the target area.
 * @param bounds Outer bounding box
 * @param rows Number of latitudinal divisions
 * @param cols Number of longitudinal divisions
 */
export function generateInitialGrid(
  bounds: GeoBoundingBox,
  rows: number = 2,
  cols: number = 2
): { cellKey: string; bbox: GeoBoundingBox }[] {
  if (rows <= 0 || cols <= 0) {
    throw new Error("Grid rows and cols must be greater than 0");
  }

  const latStep = (bounds.maxLat - bounds.minLat) / rows;
  const lngStep = (bounds.maxLng - bounds.minLng) / cols;

  const cells: { cellKey: string; bbox: GeoBoundingBox }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const minLat = bounds.minLat + r * latStep;
      const maxLat = bounds.minLat + (r + 1) * latStep;
      const minLng = bounds.minLng + c * lngStep;
      const maxLng = bounds.minLng + (c + 1) * lngStep;

      cells.push({
        cellKey: `c_${r}_${c}`,
        bbox: {
          minLat: Number(minLat.toFixed(6)),
          maxLat: Number(maxLat.toFixed(6)),
          minLng: Number(minLng.toFixed(6)),
          maxLng: Number(maxLng.toFixed(6)),
        },
      });
    }
  }

  return cells;
}

/**
 * Subdivides a saturated bounding box into 4 quad-tree quadrants (2x2).
 */
export function splitSaturatedCell(
  cellKey: string,
  bbox: GeoBoundingBox
): { cellKey: string; bbox: GeoBoundingBox }[] {
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const midLng = (bbox.minLng + bbox.maxLng) / 2;

  return [
    // Top-Left (NW)
    {
      cellKey: `${cellKey}_nw`,
      bbox: {
        minLat: Number(midLat.toFixed(6)),
        maxLat: Number(bbox.maxLat.toFixed(6)),
        minLng: Number(bbox.minLng.toFixed(6)),
        maxLng: Number(midLng.toFixed(6)),
      },
    },
    // Top-Right (NE)
    {
      cellKey: `${cellKey}_ne`,
      bbox: {
        minLat: Number(midLat.toFixed(6)),
        maxLat: Number(bbox.maxLat.toFixed(6)),
        minLng: Number(midLng.toFixed(6)),
        maxLng: Number(bbox.maxLng.toFixed(6)),
      },
    },
    // Bottom-Left (SW)
    {
      cellKey: `${cellKey}_sw`,
      bbox: {
        minLat: Number(bbox.minLat.toFixed(6)),
        maxLat: Number(midLat.toFixed(6)),
        minLng: Number(bbox.minLng.toFixed(6)),
        maxLng: Number(midLng.toFixed(6)),
      },
    },
    // Bottom-Right (SE)
    {
      cellKey: `${cellKey}_se`,
      bbox: {
        minLat: Number(bbox.minLat.toFixed(6)),
        maxLat: Number(midLat.toFixed(6)),
        minLng: Number(midLng.toFixed(6)),
        maxLng: Number(bbox.maxLng.toFixed(6)),
      },
    },
  ];
}

/**
 * Deduplicates discovered places across Place ID, Domain, Phone, and normalized Name+Address.
 */
export function deduplicatePlaces(places: PlaceSearchResult[]): {
  unique: PlaceSearchResult[];
  duplicatesCount: number;
} {
  const seenPlaceIds = new Set<string>();
  const seenDomains = new Set<string>();
  const seenPhones = new Set<string>();
  const seenNameAddresses = new Set<string>();

  const unique: PlaceSearchResult[] = [];
  let duplicatesCount = 0;

  for (const place of places) {
    // 1. Check place_id
    if (place.id && seenPlaceIds.has(place.id)) {
      duplicatesCount++;
      continue;
    }

    // 2. Check website domain if present
    let domain: string | null = null;
    if (place.websiteUri) {
      try {
        const parsed = new URL(place.websiteUri.startsWith("http") ? place.websiteUri : `http://${place.websiteUri}`);
        domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
      } catch {
        // ignore malformed URLs in deduplication
      }
    }
    if (domain && seenDomains.has(domain)) {
      duplicatesCount++;
      continue;
    }

    // 3. Check normalized phone if present (normalize Polish prefix 48)
    let phone = place.phoneNumber ? place.phoneNumber.replace(/\D/g, "") : null;
    if (phone && phone.length === 11 && phone.startsWith("48")) {
      phone = phone.slice(2);
    }
    if (phone && phone.length >= 7 && seenPhones.has(phone)) {
      duplicatesCount++;
      continue;
    }

    // 4. Check name + address combo
    const normalizedNameAddr = `${(place.displayName || "").toLowerCase().trim()}|${(place.formattedAddress || "").toLowerCase().trim()}`;
    if (normalizedNameAddr !== "|" && seenNameAddresses.has(normalizedNameAddr)) {
      duplicatesCount++;
      continue;
    }

    // If all checks pass, record keys
    if (place.id) seenPlaceIds.add(place.id);
    if (domain) seenDomains.add(domain);
    if (phone && phone.length >= 7) seenPhones.add(phone);
    if (normalizedNameAddr !== "|") seenNameAddresses.add(normalizedNameAddr);

    unique.push(place);
  }

  return { unique, duplicatesCount };
}

/**
 * Estimates API requests and monetary cost based on grid cell count and tenant pricing.
 * @param cellCount Number of initial grid cells
 * @param avgPagesPerCell Expected average pages per cell (1 to 3)
 * @param pricePerRequestUnit Cost per request (e.g. in PLN minor/grosze from tenant limits or config)
 */
export function estimateSearchCost(
  cellCount: number,
  avgPagesPerCell: number = 1.5,
  pricePerRequestMinor: number = 15 // default e.g. 0.15 PLN (15 groszy)
): {
  estimatedRequests: number;
  estimatedCostMinor: number;
} {
  const estimatedRequests = Math.ceil(cellCount * avgPagesPerCell);
  const estimatedCostMinor = estimatedRequests * pricePerRequestMinor;

  return {
    estimatedRequests,
    estimatedCostMinor,
  };
}
