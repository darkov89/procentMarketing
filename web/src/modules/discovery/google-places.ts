import {
  DiscoverySource,
  DiscoverySearchCriteria,
  SearchPageResponse,
  PlaceSearchResult,
} from "./places";

export interface GooglePlacesConfig {
  apiKey: string;
}

/**
 * Production-ready Google Places (New) adapter.
 * Uses POST https://places.googleapis.com/v1/places:searchText with X-Goog-FieldMask.
 */
export class GooglePlacesSource implements DiscoverySource {
  public readonly name = "google_places";
  private apiKey: string;

  constructor(config: GooglePlacesConfig) {
    if (!config.apiKey) {
      throw new Error("GooglePlacesSource requires a valid apiKey");
    }
    this.apiKey = config.apiKey;
  }

  async search(
    criteria: DiscoverySearchCriteria,
    pageToken?: string
  ): Promise<SearchPageResponse> {
    const endpoint = "https://places.googleapis.com/v1/places:searchText";

    const requestBody: Record<string, unknown> = {
      textQuery: criteria.textQuery,
      pageSize: 20,
      locationRestriction: {
        rectangle: {
          low: {
            latitude: criteria.bbox.minLat,
            longitude: criteria.bbox.minLng,
          },
          high: {
            latitude: criteria.bbox.maxLat,
            longitude: criteria.bbox.maxLng,
          },
        },
      },
    };

    if (criteria.includedType) {
      requestBody.includedType = criteria.includedType;
    }
    if (criteria.minRating) {
      requestBody.minRating = criteria.minRating;
    }
    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

    // Essential + Pro fields mask to optimize cost (contact fields fetched separately via Details if needed)
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.types",
      "places.primaryType",
      "places.rating",
      "places.userRatingCount",
      "nextPageToken",
    ].join(",");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Places API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const rawPlaces = Array.isArray(data.places) ? data.places : [];

    const places: PlaceSearchResult[] = rawPlaces.map((p: any) => ({
      id: p.id || (p.name ? p.name.replace("places/", "") : ""),
      displayName: p.displayName?.text || p.displayName || "",
      formattedAddress: p.formattedAddress,
      location: p.location
        ? { lat: p.location.latitude, lng: p.location.longitude }
        : undefined,
      types: p.types,
      primaryType: p.primaryType,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
    }));

    return {
      places,
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Fetches contact details (website, phone) for a vetted place ID.
   */
  async getPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
    const resourceName = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
    const endpoint = `https://places.googleapis.com/v1/${resourceName}`;

    const fieldMask = [
      "id",
      "displayName",
      "websiteUri",
      "nationalPhoneNumber",
      "internationalPhoneNumber",
    ].join(",");

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return {
      id: data.id || placeId,
      displayName: data.displayName?.text || data.displayName || "",
      websiteUri: data.websiteUri,
      phoneNumber: data.nationalPhoneNumber || data.internationalPhoneNumber,
    };
  }
}
