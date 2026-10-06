import {
  withTenant,
  searchRuns,
  searchRunCells,
  leads,
  leadFieldValues,
  campaignLeads,
  campaigns,
} from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { consume } from "@/lib/limits";
import {
  DiscoverySource,
  DiscoverySearchCriteria,
  GeoBoundingBox,
  PlaceSearchResult,
  generateInitialGrid,
  splitSaturatedCell,
  deduplicatePlaces,
} from "./places";

export interface CreateSearchRunParams {
  tenantId: number;
  campaignId?: number;
  templateId?: number;
  criteria: DiscoverySearchCriteria;
  gridRows?: number;
  gridCols?: number;
}

/**
 * Initializes a new search run with its initial geographical grid cells.
 */
export async function createSearchRun(params: CreateSearchRunParams) {
  const { tenantId, campaignId, templateId, criteria, gridRows = 2, gridCols = 2 } = params;

  return await withTenant(tenantId, async (tx) => {
    const initialCells = generateInitialGrid(criteria.bbox, gridRows, gridCols);
    const estimatedRequests = Math.ceil(initialCells.length * 1.5);

    const [run] = await tx
      .insert(searchRuns)
      .values({
        tenantId,
        campaignId: campaignId || null,
        templateId: templateId || null,
        status: "draft",
        estimatedRequests,
        usedRequests: 0,
        foundCount: 0,
        newCount: 0,
        duplicatesCount: 0,
      })
      .returning();

    for (const cell of initialCells) {
      await tx.insert(searchRunCells).values({
        tenantId,
        runId: run.id,
        cellKey: cell.cellKey,
        bbox: cell.bbox,
        status: "pending",
        pagesFetched: 0,
        resultsCount: 0,
        saturated: false,
      });
    }

    return { runId: run.id, cellCount: initialCells.length, estimatedRequests };
  });
}

/**
 * Processes a single batch of pending cells for a search run.
 * Designed to fit within serverless execution timeouts (Vercel maxDuration).
 * Respects quota limits via consume(tenantId, 'google_requests', count).
 */
export async function processSearchRunBatch(
  tenantId: number,
  runId: number,
  source: DiscoverySource,
  options: {
    maxCellsToProcess?: number;
    queryText: string;
    maxQuadTreeDepth?: number;
  }
) {
  const { maxCellsToProcess = 5, queryText, maxQuadTreeDepth = 2 } = options;

  // 1. Fetch search run and verify status
  const run = await withTenant(tenantId, async (tx) => {
    const [found] = await tx.select().from(searchRuns).where(eq(searchRuns.id, runId));
    return found;
  });

  if (!run) {
    throw new Error(`Search run ${runId} not found for tenant ${tenantId}`);
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "budget_exceeded") {
    return { status: run.status, processedCells: 0, finished: true };
  }

  // 2. Fetch pending cells
  const pendingCells = await withTenant(tenantId, async (tx) => {
    return await tx
      .select()
      .from(searchRunCells)
      .where(
        and(
          eq(searchRunCells.runId, runId),
          eq(searchRunCells.status, "pending")
        )
      )
      .limit(maxCellsToProcess);
  });

  if (pendingCells.length === 0) {
    // Check if there are any still processing
    const remaining = await withTenant(tenantId, async (tx) => {
      return await tx
        .select()
        .from(searchRunCells)
        .where(
          and(
            eq(searchRunCells.runId, runId),
            sql`status IN ('pending', 'processing')`
          )
        );
    });

    if (remaining.length === 0) {
      // Mark run as completed
      await withTenant(tenantId, async (tx) => {
        await tx
          .update(searchRuns)
          .set({ status: "completed", finishedAt: new Date() })
          .where(eq(searchRuns.id, runId));
      });
      return { status: "completed", processedCells: 0, finished: true };
    }

    return { status: "processing", processedCells: 0, finished: false };
  }

  // Mark run as running if draft
  if (run.status === "draft") {
    await withTenant(tenantId, async (tx) => {
      await tx
        .update(searchRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(searchRuns.id, runId));
    });
  }

  let totalNewFound = 0;
  let totalDuplicates = 0;
  let usedRequests = 0;

  for (const cell of pendingCells) {
    // Lock cell
    await withTenant(tenantId, async (tx) => {
      await tx
        .update(searchRunCells)
        .set({ status: "processing", lockedAt: new Date() })
        .where(eq(searchRunCells.id, cell.id));
    });

    const bbox = cell.bbox as unknown as GeoBoundingBox;
    const cellPlaces: PlaceSearchResult[] = [];
    let pageToken: string | undefined = undefined;
    let pagesFetched = 0;
    let isSaturated = false;

    try {
      do {
        // Enforce quota limit before API call
        await consume(tenantId, "google_requests", 1);
        usedRequests++;

        const response = await source.search(
          {
            textQuery: queryText,
            bbox,
          },
          pageToken
        );

        pagesFetched++;
        cellPlaces.push(...response.places);
        pageToken = response.nextPageToken;

        // Hard Google Places limit is 60 items (3 pages x 20)
        if (cellPlaces.length >= 60) {
          isSaturated = true;
          break;
        }
      } while (pageToken && pagesFetched < 3);

      // Check if cell needs quad-tree subdivision
      const currentDepth = (cell.cellKey.match(/_/g) || []).length;
      if (isSaturated && currentDepth <= maxQuadTreeDepth) {
        const subCells = splitSaturatedCell(cell.cellKey, bbox);
        await withTenant(tenantId, async (tx) => {
          await tx
            .update(searchRunCells)
            .set({
              status: "saturated",
              pagesFetched,
              resultsCount: cellPlaces.length,
              saturated: true,
              updatedAt: new Date(),
            })
            .where(eq(searchRunCells.id, cell.id));

          for (const sub of subCells) {
            await tx.insert(searchRunCells).values({
              tenantId,
              runId,
              cellKey: sub.cellKey,
              bbox: sub.bbox,
              status: "pending",
              pagesFetched: 0,
              resultsCount: 0,
              saturated: false,
            });
          }
        });
      } else {
        // Deduplicate collected places
        const { unique, duplicatesCount } = deduplicatePlaces(cellPlaces);
        totalDuplicates += duplicatesCount;

        // Persist discovered leads with provenance
        for (const place of unique) {
          await withTenant(tenantId, async (tx) => {
            // Check if lead already exists in DB by placeId / website / companyName
            const [existing] = await tx
              .select()
              .from(leads)
              .where(
                and(
                  eq(leads.tenantId, tenantId),
                  eq(leads.companyName, place.displayName)
                )
              );

            let leadId = existing?.id;

            if (!existing) {
              const [inserted] = await tx
                .insert(leads)
                .values({
                  tenantId,
                  companyName: place.displayName,
                  website: place.websiteUri || null,
                  phoneNormalized: place.phoneNumber || null,
                  address: place.formattedAddress || null,
                  latitude: place.location?.lat || null,
                  longitude: place.location?.lng || null,
                  sourceName: source.name,
                  status: "new",
                })
                .returning();
              leadId = inserted.id;
              totalNewFound++;

              // Also link to campaign (run.campaignId or tenant's active/default campaign)
              let targetCampaignId = run.campaignId;
              if (!targetCampaignId) {
                const [defaultCampaign] = await tx
                  .select({ id: campaigns.id })
                  .from(campaigns)
                  .where(eq(campaigns.tenantId, tenantId))
                  .limit(1);
                targetCampaignId = defaultCampaign?.id;
              }

              if (targetCampaignId) {
                await tx
                  .insert(campaignLeads)
                  .values({
                    tenantId,
                    campaignId: targetCampaignId,
                    leadId,
                    state: "new",
                  })
                  .onConflictDoNothing();
              }
            }

            // Record provenance in lead_field_values
            if (leadId) {
              await tx.insert(leadFieldValues).values({
                tenantId,
                leadId,
                field: "google_places_data",
                value: {
                  placeId: place.id,
                  displayName: place.displayName,
                  types: place.types,
                  rating: place.rating,
                  userRatingCount: place.userRatingCount,
                },
                source: source.name,
                sourceUrl: place.websiteUri || null,
                confidence: 1.0,
                retrievedAt: new Date(),
              });
            }
          });
        }

        await withTenant(tenantId, async (tx) => {
          await tx
            .update(searchRunCells)
            .set({
              status: "completed",
              pagesFetched,
              resultsCount: cellPlaces.length,
              saturated: false,
              updatedAt: new Date(),
            })
            .where(eq(searchRunCells.id, cell.id));
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isQuotaError = errorMessage.includes("Quota limit exceeded");

      await withTenant(tenantId, async (tx) => {
        await tx
          .update(searchRunCells)
          .set({
            status: "failed",
            error: errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(searchRunCells.id, cell.id));

        if (isQuotaError) {
          await tx
            .update(searchRuns)
            .set({
              status: "budget_exceeded",
              error: errorMessage,
            })
            .where(eq(searchRuns.id, runId));
        }
      });

      if (isQuotaError) {
        return {
          status: "budget_exceeded",
          processedCells: 1,
          finished: true,
          error: errorMessage,
        };
      }
    }
  }

  // Update run stats
  await withTenant(tenantId, async (tx) => {
    await tx
      .update(searchRuns)
      .set({
        usedRequests: sql`${searchRuns.usedRequests} + ${usedRequests}`,
        newCount: sql`${searchRuns.newCount} + ${totalNewFound}`,
        duplicatesCount: sql`${searchRuns.duplicatesCount} + ${totalDuplicates}`,
        foundCount: sql`${searchRuns.foundCount} + ${totalNewFound + totalDuplicates}`,
      })
      .where(eq(searchRuns.id, runId));
  });

  return {
    status: "processing",
    processedCells: pendingCells.length,
    finished: false,
    newCount: totalNewFound,
    duplicatesCount: totalDuplicates,
  };
}
