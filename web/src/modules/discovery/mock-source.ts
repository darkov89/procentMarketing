import {
  DiscoverySource,
  DiscoverySearchCriteria,
  SearchPageResponse,
  PlaceSearchResult,
} from "./places";

export class MockDiscoverySource implements DiscoverySource {
  public readonly name = "mock_places";
  public callsCount = 0;
  private mockPages: Map<string, SearchPageResponse[]> = new Map();

  constructor(mockData?: Record<string, SearchPageResponse[]>) {
    if (mockData) {
      for (const [key, pages] of Object.entries(mockData)) {
        this.mockPages.set(key, pages);
      }
    }
  }

  setMockForQuery(query: string, pages: SearchPageResponse[]) {
    this.mockPages.set(query, pages);
  }

  async search(
    criteria: DiscoverySearchCriteria,
    pageToken?: string
  ): Promise<SearchPageResponse> {
    this.callsCount++;
    const pages = this.mockPages.get(criteria.textQuery);

    if (!pages || pages.length === 0) {
      return { places: [] };
    }

    if (!pageToken) {
      return pages[0];
    }

    const pageIndex = Number(pageToken);
    if (!isNaN(pageIndex) && pageIndex < pages.length) {
      return pages[pageIndex];
    }

    return { places: [] };
  }

  async getPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
    this.callsCount++;
    return {
      id: placeId,
      displayName: `Company ${placeId}`,
      websiteUri: `https://${placeId.toLowerCase()}.pl`,
      phoneNumber: "+48 71 000 00 00",
    };
  }
}
