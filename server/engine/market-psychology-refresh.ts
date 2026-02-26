import * as sleeperApi from "../sleeper-api";
import { computeAllPlayerMetrics, computeMarketIndices, type PlayerInput } from "./market-psychology-service";
import { storage } from "../storage";

export async function refreshMarketPsychologyData(): Promise<number> {
  const startTime = Date.now();
  console.log("[MarketPsychology] Starting full market metrics refresh...");

  try {
    const existingCache = await storage.getMarketIndexCache();
    const dVix = existingCache?.dynastyVolatilityIndex || 10;
    const leagueAvgVol = existingCache?.leagueAvgVolatility || 5;

    const allPlayers = await sleeperApi.getAllPlayers();
    if (!allPlayers || Object.keys(allPlayers).length === 0) {
      console.warn("[MarketPsychology] No players returned from Sleeper API");
      return 0;
    }

    const trendingAdds = await sleeperApi.getTrendingPlayers("add", 50);
    const trendingDrops = await sleeperApi.getTrendingPlayers("drop", 50);

    const addCounts = new Map<string, number>();
    const dropCounts = new Map<string, number>();
    for (const t of trendingAdds) addCounts.set(t.player_id, t.count);
    for (const t of trendingDrops) dropCounts.set(t.player_id, t.count);

    const validPositions = new Set(["QB", "RB", "WR", "TE"]);
    const playerInputs: PlayerInput[] = [];

    for (const [playerId, player] of Object.entries(allPlayers)) {
      if (!player || !validPositions.has(player.position)) continue;
      if (!player.active && !player.team) continue;

      const addCount = addCounts.get(playerId) || 0;
      const dropCount = dropCounts.get(playerId) || 0;
      const rosterDelta = (addCount - dropCount) / Math.max(1, addCount + dropCount) * 5;

      const searchRank = player.search_rank || 9999;
      const rosterPct = player.team ? Math.min(100, Math.max(0, 100 - (searchRank / 100))) : 0;

      playerInputs.push({
        playerId,
        name: player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim(),
        position: player.position,
        team: player.team || null,
        searchRank,
        rosterPct,
        age: player.age || 25,
        yearsExp: player.years_exp || 0,
        injuryStatus: player.injury_status || null,
        trendValues: {
          trend7Day: addCount > 0 ? Math.min(5, addCount / 50) : dropCount > 0 ? -Math.min(5, dropCount / 50) : 0,
          trend30Day: rosterDelta * 0.5,
          seasonChange: 0,
        },
        rosterDelta,
        isOnTradeBlock: false,
        faabBidsReceived: addCount > 20 ? 3 : addCount > 5 ? 1 : 0,
        depthChartRank: player.depth_chart_order || 1,
      });
    }

    const metrics = computeAllPlayerMetrics(playerInputs, dVix, leagueAvgVol);

    const count = await storage.upsertPlayerMarketMetricsBatch(metrics as any[]);

    const indices = computeMarketIndices(metrics);
    await storage.upsertMarketIndexCache({
      leagueId: null,
      dynastyMarketIndex: indices.dynastyMarketIndex,
      dynastyVolatilityIndex: indices.dynastyVolatilityIndex,
      avgHypePremium: indices.avgHypePremium,
      leagueTradeVolume7d: 0,
      leagueAvgVolatility: indices.leagueAvgVolatility,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MarketPsychology] Full refresh complete: ${count} players processed in ${elapsed}s`);
    console.log(`[MarketPsychology] DMI=${indices.dynastyMarketIndex}, D-VIX=${indices.dynastyVolatilityIndex}, AvgHype=${indices.avgHypePremium}`);
    return count;
  } catch (error: any) {
    console.error("[MarketPsychology] Full refresh error:", error.message || error);
    throw error;
  }
}

export async function refreshMarketIndices(): Promise<void> {
  try {
    const allMetrics = await storage.getAllPlayerMarketMetrics(10000, 0);
    if (allMetrics.length === 0) return;

    const indices = computeMarketIndices(allMetrics);
    await storage.upsertMarketIndexCache({
      leagueId: null,
      dynastyMarketIndex: indices.dynastyMarketIndex,
      dynastyVolatilityIndex: indices.dynastyVolatilityIndex,
      avgHypePremium: indices.avgHypePremium,
      leagueTradeVolume7d: 0,
      leagueAvgVolatility: indices.leagueAvgVolatility,
    });

    console.log(`[MarketPsychology] Index cache refreshed: DMI=${indices.dynastyMarketIndex}, D-VIX=${indices.dynastyVolatilityIndex}`);
  } catch (error: any) {
    console.error("[MarketPsychology] Index cache refresh error:", error.message || error);
  }
}
