import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateInitialGrid,
  splitSaturatedCell,
  deduplicatePlaces,
  estimateSearchCost,
  GeoBoundingBox,
  PlaceSearchResult,
} from "../src/modules/discovery/places";
import { MockDiscoverySource } from "../src/modules/discovery/mock-source";
import {
  createSearchRun,
  processSearchRunBatch,
} from "../src/modules/discovery/search-runner";
import { withTenant, searchRuns } from "@/lib/db";
import { eq } from "drizzle-orm";

describe("Phase 3 Places Grid & Discovery Engine (Step 3.1 & 3.2)", () => {
  const wroclawBounds: GeoBoundingBox = {
    minLat: 51.05,
    maxLat: 51.15,
    minLng: 16.95,
    maxLng: 17.1,
  };

  it("generates correct initial grid subdivision", () => {
    const grid = generateInitialGrid(wroclawBounds, 2, 2);
    assert.equal(grid.length, 4, "2x2 grid should produce 4 cells");
    assert.equal(grid[0].cellKey, "c_0_0");
    assert.equal(grid[3].cellKey, "c_1_1");

    // Check bounds integrity
    for (const cell of grid) {
      assert.ok(cell.bbox.minLat >= wroclawBounds.minLat);
      assert.ok(cell.bbox.maxLat <= wroclawBounds.maxLat);
      assert.ok(cell.bbox.minLng >= wroclawBounds.minLng);
      assert.ok(cell.bbox.maxLng <= wroclawBounds.maxLng);
    }
  });

  it("subdivides saturated cell into 4 quad-tree quadrants", () => {
    const originalCell = {
      cellKey: "c_0_0",
      bbox: { minLat: 51.0, maxLat: 51.2, minLng: 17.0, maxLng: 17.2 },
    };

    const subCells = splitSaturatedCell(originalCell.cellKey, originalCell.bbox);
    assert.equal(subCells.length, 4, "Quad-tree split must yield 4 sub-cells");

    const keys = subCells.map((c) => c.cellKey);
    assert.deepEqual(keys, ["c_0_0_nw", "c_0_0_ne", "c_0_0_sw", "c_0_0_se"]);

    // Center coordinates
    const midLat = 51.1;
    const midLng = 17.1;

    // NW quadrant
    assert.equal(subCells[0].bbox.minLat, midLat);
    assert.equal(subCells[0].bbox.maxLat, 51.2);
    assert.equal(subCells[0].bbox.minLng, 17.0);
    assert.equal(subCells[0].bbox.maxLng, midLng);
  });

  it("deduplicates places by place_id, website domain, phone and name+address", () => {
    const rawPlaces: PlaceSearchResult[] = [
      {
        id: "ChIJ111",
        displayName: "Firma Alfa",
        formattedAddress: "ul. Główna 1, Wrocław",
        websiteUri: "https://alfa.pl",
        phoneNumber: "+48 71 111 22 33",
      },
      {
        id: "ChIJ111", // duplicate place_id
        displayName: "Firma Alfa Oddział",
        formattedAddress: "ul. Główna 1, Wrocław",
        websiteUri: "https://alfa.pl/kontakt",
      },
      {
        id: "ChIJ222",
        displayName: "Alfa Services",
        formattedAddress: "ul. Inna 5, Wrocław",
        websiteUri: "https://www.alfa.pl", // duplicate domain
      },
      {
        id: "ChIJ333",
        displayName: "Alfa Telefon",
        formattedAddress: "ul. Trzecia 10, Wrocław",
        phoneNumber: "711112233", // duplicate normalized phone
      },
      {
        id: "ChIJ444",
        displayName: "Firma Alfa",
        formattedAddress: "ul. Główna 1, Wrocław", // duplicate normalized name+address
      },
      {
        id: "ChIJ555",
        displayName: "Firma Beta",
        formattedAddress: "ul. Polna 2, Wrocław",
        websiteUri: "https://beta-company.pl",
        phoneNumber: "+48 71 999 88 77",
      },
    ];

    const { unique, duplicatesCount } = deduplicatePlaces(rawPlaces);
    assert.equal(unique.length, 2, "Only Firma Alfa and Firma Beta are unique");
    assert.equal(duplicatesCount, 4, "4 duplicate records detected and skipped");
    assert.equal(unique[0].id, "ChIJ111");
    assert.equal(unique[1].id, "ChIJ555");
  });

  it("estimates search requests and costs accurately", () => {
    const estimate = estimateSearchCost(4, 1.5, 20); // 4 cells * 1.5 = 6 reqs * 20 groszy = 120 groszy
    assert.equal(estimate.estimatedRequests, 6);
    assert.equal(estimate.estimatedCostMinor, 120);
  });

  it("executes search run batch with cell checkpoints and provenance records", async () => {
    const tenantId = 1;
    const testQuery = `test_places_${Date.now()}`;

    // Setup mock source with 2 companies
    const mockSource = new MockDiscoverySource({
      [testQuery]: [
        {
          places: [
            {
              id: `place_${Date.now()}_1`,
              displayName: `Unikalna Firma Testowa 1 ${Date.now()}`,
              formattedAddress: "ul. Testowa 1, Wrocław",
              websiteUri: `https://test1-${Date.now()}.pl`,
            },
            {
              id: `place_${Date.now()}_2`,
              displayName: `Unikalna Firma Testowa 2 ${Date.now()}`,
              formattedAddress: "ul. Testowa 2, Wrocław",
              websiteUri: `https://test2-${Date.now()}.pl`,
            },
          ],
        },
      ],
    });

    // 1. Create search run
    const { runId } = await createSearchRun({
      tenantId,
      criteria: {
        textQuery: testQuery,
        bbox: wroclawBounds,
      },
      gridRows: 1,
      gridCols: 1, // 1 cell
    });

    assert.ok(runId > 0, "Search run must be created");

    // 2. Process batch
    const result = await processSearchRunBatch(tenantId, runId, mockSource, {
      maxCellsToProcess: 5,
      queryText: testQuery,
    });

    assert.equal(result.newCount, 2, "Should discover 2 new companies");

    // 3. Verify run status and stats
    const run = await withTenant(tenantId, async (tx) => {
      const [r] = await tx.select().from(searchRuns).where(eq(searchRuns.id, runId));
      return r;
    });

    assert.ok(run, "Run must exist");
    assert.equal(run.newCount, 2);
    assert.equal(run.usedRequests, 1);
  });
});
