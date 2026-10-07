/**
 * Google Maps, Geocoding & Places API Integration
 * Supports both Google Places API (New) v1 and Legacy Places API Text Search,
 * plus comprehensive API key self-diagnostics.
 */

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  address: string;
  city: string;
  lat?: number;
  lon?: number;
  rating?: number | null;
  reviewsCount?: number;
  phone?: string;
  website?: string;
  businessStatus?: string;
  types?: string[];
  sourceEngine: "google_places_new" | "google_places_legacy";
}

export interface GoogleKeyDiagnostic {
  isValid: boolean;
  geocodingOk: boolean;
  placesNewOk: boolean;
  placesLegacyOk: boolean;
  status: "OK" | "REQUEST_DENIED" | "API_DISABLED" | "INVALID_KEY" | "NETWORK_ERROR";
  message: string;
  actionableHint?: string;
}

/**
 * Live test of a Google Maps / Places API key across all relevant services.
 */
export async function testGoogleApiKey(apiKey: string): Promise<GoogleKeyDiagnostic> {
  const cleanKey = apiKey.trim();
  if (!cleanKey || cleanKey.includes("••••••••")) {
    return {
      isValid: false,
      geocodingOk: false,
      placesNewOk: false,
      placesLegacyOk: false,
      status: "INVALID_KEY",
      message: "Klucz API jest pusty lub zamaskowany.",
      actionableHint: "Wklej pełny klucz API zaczynający się zazwyczaj od 'AIzaSy...'.",
    };
  }

  let geocodingOk = false;
  let placesLegacyOk = false;
  let placesNewOk = false;
  let lastErrorMsg = "";

  // 1. Test Geocoding API
  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Wroc%C5%82aw&key=${cleanKey}&language=pl`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(6000) });
    const geoData = await geoRes.json();

    if (geoData.status === "OK") {
      geocodingOk = true;
    } else {
      lastErrorMsg = geoData.error_message || geoData.status;
    }
  } catch (err: any) {
    lastErrorMsg = err?.message || String(err);
  }

  // 2. Test Google Places API (New v1)
  try {
    const pNewUrl = `https://places.googleapis.com/v1/places:searchText`;
    const pNewRes = await fetch(pNewUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": cleanKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: "hotel Wrocław",
        pageSize: 1,
        languageCode: "pl",
      }),
      signal: AbortSignal.timeout(6000),
    });

    const pNewData = await pNewRes.json();
    if (pNewRes.ok && Array.isArray(pNewData.places)) {
      placesNewOk = true;
    } else if (pNewData.error) {
      lastErrorMsg = pNewData.error.message || lastErrorMsg;
    }
  } catch {}

  // 3. Test Google Places API (Legacy Text Search)
  try {
    const pLegUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=hotel+Wroc%C5%82aw&key=${cleanKey}&language=pl`;
    const pLegRes = await fetch(pLegUrl, { signal: AbortSignal.timeout(6000) });
    const pLegData = await pLegRes.json();

    if (pLegData.status === "OK" || pLegData.status === "ZERO_RESULTS") {
      placesLegacyOk = true;
    } else {
      lastErrorMsg = pLegData.error_message || lastErrorMsg;
    }
  } catch {}

  const hasAnyWorking = geocodingOk || placesNewOk || placesLegacyOk;

  if (hasAnyWorking) {
    const features: string[] = [];
    if (placesNewOk) features.push("Places API v1 (New)");
    if (placesLegacyOk) features.push("Places API (Legacy)");
    if (geocodingOk) features.push("Geocoding & Maps");

    return {
      isValid: true,
      geocodingOk,
      placesNewOk,
      placesLegacyOk,
      status: "OK",
      message: `Klucz Google API jest poprawny i aktywny! Włączone usługi: ${features.join(", ")}.`,
    };
  }

  // Diagnostics on failure
  let status: GoogleKeyDiagnostic["status"] = "REQUEST_DENIED";
  let actionableHint = "Upewnij się, że klucz posiada włączone billing (rozliczenia) w Google Cloud Console oraz włączoną usługę 'Places API' lub 'Geocoding API'.";

  if (lastErrorMsg.includes("API key not valid") || lastErrorMsg.includes("INVALID_ARGUMENT")) {
    status = "INVALID_KEY";
    actionableHint = "Klucz jest nieprawidłowy lub został usunięty w Google Cloud Console. Skopiuj go ponownie.";
  } else if (lastErrorMsg.includes("not authorized") || lastErrorMsg.includes("has not been used in project") || lastErrorMsg.includes("disabled")) {
    status = "API_DISABLED";
    actionableHint = "W konsoli Google Cloud przejdź do: 'APIs & Services' -> 'Library' i włącz: 'Places API (New)' oraz 'Geocoding API'.";
  } else if (lastErrorMsg.includes("IP") || lastErrorMsg.includes("Referer") || lastErrorMsg.includes("restricted")) {
    status = "REQUEST_DENIED";
    actionableHint = "Klucz posiada ograniczenia domenowe (HTTP referrers) lub IP. Ponieważ Lead Machine odpytuje Google z serwera, wyłącz ograniczenia 'HTTP referrers' lub dodaj 'None'/'IP address'.";
  }

  return {
    isValid: false,
    geocodingOk,
    placesNewOk,
    placesLegacyOk,
    status,
    message: `Błąd Google API: ${lastErrorMsg || "Brak autoryzacji"}`,
    actionableHint,
  };
}

/**
 * Searches Google Places with dual engine support (New v1 preferred, Legacy fallback).
 */
export async function searchGooglePlaces(params: {
  keyword: string;
  city: string;
  voivodeship?: string;
  apiKey: string;
  maxResults?: number;
}): Promise<{ items: GooglePlaceResult[]; error?: string; engineUsed: string }> {
  const { keyword, city, voivodeship, apiKey, maxResults = 15 } = params;
  const cleanKey = apiKey.trim();
  const locationContext = voivodeship && voivodeship !== "Cała Polska" ? `${city}, woj. ${voivodeship}` : city;
  const query = `${keyword} ${locationContext} Polska`;

  // 1. Try Google Places API (New v1)
  try {
    const pNewUrl = `https://places.googleapis.com/v1/places:searchText`;
    const allPlaces: any[] = [];
    let pageToken: string | undefined = undefined;

    while (allPlaces.length < maxResults) {
      const pNewRes: Response = await fetch(pNewUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": cleanKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.location,places.businessStatus,nextPageToken",
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: Math.min(maxResults - allPlaces.length, 20),
          pageToken,
          languageCode: "pl",
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (!pNewRes.ok) break;
      const pNewData: any = await pNewRes.json();
      if (!Array.isArray(pNewData.places) || pNewData.places.length === 0) break;

      allPlaces.push(...pNewData.places);
      if (!pNewData.nextPageToken || allPlaces.length >= maxResults) break;
      pageToken = pNewData.nextPageToken;
    }

    if (allPlaces.length > 0) {
      const items: GooglePlaceResult[] = allPlaces.map((p: any) => ({
        placeId: p.id,
        name: p.displayName?.text || "",
        address: p.formattedAddress || "",
        city: extractCityFromAddress(p.formattedAddress, city),
        lat: p.location?.latitude,
        lon: p.location?.longitude,
        rating: p.rating || null,
        reviewsCount: p.userRatingCount || 0,
        phone: p.internationalPhoneNumber || p.nationalPhoneNumber || "",
        website: p.websiteUri || "",
        businessStatus: p.businessStatus,
        sourceEngine: "google_places_new" as const,
      }));

      return { items, engineUsed: "google_places_new" };
    }
  } catch (err) {
    console.warn("Places API New attempt failed, falling back to legacy:", err);
  }

  // 2. Fallback to Google Places API (Legacy Text Search)
  try {
    const encQuery = encodeURIComponent(query);
    const pLegUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encQuery}&key=${cleanKey}&language=pl`;
    const pLegRes = await fetch(pLegUrl, { signal: AbortSignal.timeout(9000) });
    const pLegData = await pLegRes.json();

    if (pLegData.status === "OK" && Array.isArray(pLegData.results) && pLegData.results.length > 0) {
      const items: GooglePlaceResult[] = [];

      for (const p of pLegData.results.slice(0, maxResults)) {
        let phone = "";
        let website = "";
        let rating = p.rating || null;
        let reviews = p.user_ratings_total || 0;

        // Fetch details if place_id exists
        if (p.place_id) {
          try {
            const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=name,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,geometry,formatted_address&key=${cleanKey}&language=pl`;
            const detRes = await fetch(detUrl, { signal: AbortSignal.timeout(4000) });
            const detData = await detRes.json();
            if (detData.result) {
              phone = detData.result.international_phone_number || detData.result.formatted_phone_number || "";
              website = detData.result.website || "";
              if (detData.result.rating) rating = detData.result.rating;
              if (detData.result.user_ratings_total) reviews = detData.result.user_ratings_total;
            }
          } catch {}
        }

        items.push({
          placeId: p.place_id,
          name: p.name,
          address: p.formatted_address || "",
          city: extractCityFromAddress(p.formatted_address, city),
          lat: p.geometry?.location?.lat,
          lon: p.geometry?.location?.lng,
          rating,
          reviewsCount: reviews,
          phone,
          website,
          sourceEngine: "google_places_legacy",
        });
      }

      return { items, engineUsed: "google_places_legacy" };
    }

    if (pLegData.status && pLegData.status !== "OK" && pLegData.status !== "ZERO_RESULTS") {
      return {
        items: [],
        error: pLegData.error_message || `Google Places status: ${pLegData.status}`,
        engineUsed: "google_places_legacy",
      };
    }
  } catch (err: any) {
    return {
      items: [],
      error: err?.message || String(err),
      engineUsed: "error",
    };
  }

  return { items: [], engineUsed: "none" };
}

function extractCityFromAddress(address: string | undefined, defaultCity: string): string {
  if (!address) return defaultCity;
  // Match standard Polish postal code + city pattern: "59-220 Legnica" or "00-001 Warszawa"
  const match = address.match(/\d{2}-\d{3}\s+([^,]+)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return defaultCity;
}
