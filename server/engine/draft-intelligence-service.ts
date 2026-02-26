import { db } from "../db";
import { drafts, draftPicks, draftAdp, pickValueCurve, userProfiles, externalRankings } from "@shared/schema";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import * as sleeperApi from "../sleeper-api";
import { getQuickPlayerValue } from "../dynasty-value-engine";
import { fetchDynastyProcessRankings } from "./external-rankings-service";

const RATE_LIMIT_DELAY = 250;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface DraftIngestionStats {
  draftsProcessed: number;
  picksStored: number;
  leaguesScanned: number;
  errors: number;
}

function classifyDraftType(draft: sleeperApi.SleeperDraft): "startup" | "rookie" {
  const rounds = draft.settings?.rounds || 0;
  if (rounds >= 10) return "startup";
  return "rookie";
}

function classifyDraftFormat(draft: sleeperApi.SleeperDraft, league?: any): "1QB" | "SF" | "TEP" {
  const sfSlots = draft.settings?.slots_super_flex || 0;
  if (sfSlots > 0) return "SF";

  const scoringSettings = league?.scoring_settings || league?.scoringSettings || {};
  const tePremium = scoringSettings.bonus_rec_te || scoringSettings.rec_te || 0;
  if (tePremium > 0) return "TEP";

  return "1QB";
}

function mapSleeperStatus(status: string): "complete" | "drafting" | "upcoming" {
  if (status === "complete") return "complete";
  if (status === "drafting") return "drafting";
  return "upcoming";
}

export async function ingestDraftsForUser(sleeperUserId: string): Promise<DraftIngestionStats> {
  const stats: DraftIngestionStats = { draftsProcessed: 0, picksStored: 0, leaguesScanned: 0, errors: 0 };
  const currentYear = new Date().getFullYear();
  const seasons = [currentYear.toString(), (currentYear - 1).toString()];

  for (const season of seasons) {
    let leagues: sleeperApi.SleeperLeague[] = [];
    try {
      leagues = await sleeperApi.getUserLeagues(sleeperUserId, season);
      await sleep(RATE_LIMIT_DELAY);
    } catch (e) {
      stats.errors++;
      continue;
    }

    for (const league of leagues) {
      stats.leaguesScanned++;
      try {
        const leagueDrafts = await sleeperApi.getLeagueDrafts(league.league_id);
        await sleep(RATE_LIMIT_DELAY);

        for (const draft of leagueDrafts) {
          const draftStatus = mapSleeperStatus(draft.status);

          const existing = await db.select({ draftId: drafts.draftId, status: drafts.status })
            .from(drafts)
            .where(eq(drafts.draftId, draft.draft_id))
            .limit(1);

          if (existing.length > 0 && existing[0].status === draftStatus) {
            continue;
          }

          const draftType = classifyDraftType(draft);
          const draftFormat = classifyDraftFormat(draft, league);

          await db.insert(drafts).values({
            draftId: draft.draft_id,
            leagueId: draft.league_id,
            type: draftType,
            format: draftFormat,
            status: draftStatus,
            rounds: draft.settings?.rounds || 0,
            teams: draft.settings?.teams || 0,
            season: draft.season || season,
          }).onConflictDoUpdate({
            target: drafts.draftId,
            set: {
              status: draftStatus,
              type: draftType,
              format: draftFormat,
              rounds: draft.settings?.rounds || 0,
              teams: draft.settings?.teams || 0,
            },
          });

          if (draftStatus === "complete" || draftStatus === "drafting") {
            const picks = await sleeperApi.getDraftPicks(draft.draft_id);
            await sleep(RATE_LIMIT_DELAY);

            if (picks && picks.length > 0) {
              const existingPickCount = await db.execute(
                sql`SELECT COUNT(*)::int as cnt FROM draft_picks WHERE draft_id = ${draft.draft_id}`
              );
              const currentCount = (existingPickCount.rows[0] as any)?.cnt || 0;
              const newPicksAvailable = picks.filter(p => p.player_id).length;

              const needsUpdate = currentCount === 0 || 
                (draftStatus === "complete" && newPicksAvailable > currentCount);

              if (needsUpdate) {
                if (currentCount > 0) {
                  await db.delete(draftPicks).where(eq(draftPicks.draftId, draft.draft_id));
                }

                const pickValues = picks
                  .filter(p => p.player_id)
                  .map(p => ({
                    draftId: draft.draft_id,
                    round: p.round,
                    pickNo: p.pick_no,
                    playerId: p.player_id,
                    playerName: p.metadata ? `${p.metadata.first_name} ${p.metadata.last_name}` : null,
                    position: p.metadata?.position || null,
                    pickedBy: p.picked_by || null,
                    pickedAt: null as Date | null,
                  }));

                if (pickValues.length > 0) {
                  for (let i = 0; i < pickValues.length; i += 100) {
                    const batch = pickValues.slice(i, i + 100);
                    await db.insert(draftPicks).values(batch);
                  }
                  stats.picksStored += pickValues.length;
                }
              }
            }
          }

          stats.draftsProcessed++;
        }
      } catch (e) {
        stats.errors++;
        continue;
      }
    }
  }

  return stats;
}

export async function ingestAllDrafts(): Promise<DraftIngestionStats> {
  console.log("[DraftIntel] Starting draft ingestion for all users...");
  const totalStats: DraftIngestionStats = { draftsProcessed: 0, picksStored: 0, leaguesScanned: 0, errors: 0 };

  const users = await db.select({
    sleeperUserId: userProfiles.sleeperUserId,
  })
    .from(userProfiles)
    .where(isNotNull(userProfiles.sleeperUserId));

  const uniqueIds = [...new Set(users.map(u => u.sleeperUserId).filter(Boolean))] as string[];
  console.log(`[DraftIntel] Found ${uniqueIds.length} unique Sleeper user IDs`);

  for (const uid of uniqueIds) {
    try {
      const userStats = await ingestDraftsForUser(uid);
      totalStats.draftsProcessed += userStats.draftsProcessed;
      totalStats.picksStored += userStats.picksStored;
      totalStats.leaguesScanned += userStats.leaguesScanned;
      totalStats.errors += userStats.errors;
    } catch (e) {
      totalStats.errors++;
      console.error(`[DraftIntel] Error ingesting for user ${uid}:`, e);
    }
    await sleep(500);
  }

  console.log(`[DraftIntel] Ingestion complete: ${totalStats.draftsProcessed} drafts, ${totalStats.picksStored} picks, ${totalStats.leaguesScanned} leagues, ${totalStats.errors} errors`);
  return totalStats;
}

function computeConsensusRank(
  sleeperAdpRank: number | null,
  ecrRank: number | null,
  sleeperSampleSize: number
): number | null {
  if (sleeperAdpRank != null && ecrRank != null) {
    const w = Math.min(sleeperSampleSize / 20, 1.0);
    return sleeperAdpRank * w + ecrRank * (1 - w);
  }
  if (ecrRank != null) return ecrRank;
  if (sleeperAdpRank != null) return sleeperAdpRank;
  return null;
}

export async function computeADP(): Promise<number> {
  console.log("[DraftIntel] Computing ADP...");

  const results = await db.execute(sql`
    SELECT 
      dp.player_id,
      dp.player_name,
      dp.position,
      AVG(dp.pick_no)::real AS adp_overall,
      COUNT(*)::int AS sample_size,
      AVG(CASE WHEN d.format = '1QB' THEN dp.pick_no END)::real AS adp_1qb,
      COUNT(CASE WHEN d.format = '1QB' THEN 1 END)::int AS sample_1qb,
      AVG(CASE WHEN d.format = 'SF' THEN dp.pick_no END)::real AS adp_sf,
      COUNT(CASE WHEN d.format = 'SF' THEN 1 END)::int AS sample_sf,
      AVG(CASE WHEN d.format = 'TEP' THEN dp.pick_no END)::real AS adp_tep,
      COUNT(CASE WHEN d.format = 'TEP' THEN 1 END)::int AS sample_tep
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.draft_id
    WHERE d.status = 'complete'
    GROUP BY dp.player_id, dp.player_name, dp.position
    HAVING COUNT(*) >= 1
  `);

  const sleeperRows = results.rows as any[];

  const extRows = await db.select().from(externalRankings).where(eq(externalRankings.source, "dynastyprocess"));
  const extBySleeperIdMap = new Map<string, typeof extRows[0]>();
  for (const ext of extRows) {
    if (ext.sleeperId) {
      extBySleeperIdMap.set(ext.sleeperId, ext);
    }
  }

  await db.delete(draftAdp);

  const insertedPlayerIds = new Set<string>();
  let count = 0;

  const sleeperRankMap = new Map<string, number>();
  const sortedSleeper = [...sleeperRows].sort((a: any, b: any) => (a.adp_overall || 999) - (b.adp_overall || 999));
  sortedSleeper.forEach((row: any, idx: number) => {
    sleeperRankMap.set(row.player_id, idx + 1);
  });

  for (let i = 0; i < sleeperRows.length; i += 100) {
    const batch = sleeperRows.slice(i, i + 100);
    const values = batch.map((row: any) => {
      const ext = extBySleeperIdMap.get(row.player_id);
      const sleeperRank = sleeperRankMap.get(row.player_id) || null;
      const ecr1qb = ext?.ecr1qb || null;
      const ecrSf = ext?.ecrSf || null;
      const ecrForConsensus = ecr1qb || ecrSf;
      const consensus = computeConsensusRank(sleeperRank, ecrForConsensus, row.sample_size || 0);
      const sources: string[] = ["sleeper"];
      if (ext) sources.push("dynastyprocess");

      insertedPlayerIds.add(row.player_id);

      return {
        playerId: row.player_id,
        playerName: row.player_name,
        position: row.position,
        adpOverall: row.adp_overall,
        adp1qb: row.adp_1qb || null,
        adpSf: row.adp_sf || null,
        adpTep: row.adp_tep || null,
        sampleSize: row.sample_size || 0,
        sample1qb: row.sample_1qb || 0,
        sampleSf: row.sample_sf || 0,
        sampleTep: row.sample_tep || 0,
        ecr1qb,
        ecrSf,
        consensusRank: consensus,
        dataSources: sources.join(","),
      };
    });
    await db.insert(draftAdp).values(values);
    count += values.length;
  }

  const externalOnly = extRows.filter(ext => ext.sleeperId && !insertedPlayerIds.has(ext.sleeperId));
  console.log(`[DraftIntel] Adding ${externalOnly.length} players from external sources only`);

  for (let i = 0; i < externalOnly.length; i += 100) {
    const batch = externalOnly.slice(i, i + 100);
    const values = batch.map((ext) => {
      const consensus = computeConsensusRank(null, ext.ecr1qb, 0);
      return {
        playerId: ext.sleeperId!,
        playerName: ext.playerName,
        position: ext.position,
        adpOverall: null,
        adp1qb: null,
        adpSf: null,
        adpTep: null,
        sampleSize: 0,
        sample1qb: 0,
        sampleSf: 0,
        sampleTep: 0,
        ecr1qb: ext.ecr1qb,
        ecrSf: ext.ecrSf,
        consensusRank: consensus,
        dataSources: "dynastyprocess",
      };
    });
    await db.insert(draftAdp).values(values);
    count += values.length;
  }

  console.log(`[DraftIntel] ADP computed for ${count} players (${sleeperRows.length} from Sleeper, ${externalOnly.length} from external)`);
  return count;
}

export async function computePickValueCurve(): Promise<number> {
  console.log("[DraftIntel] Computing pick value curve...");

  let allPlayers: Record<string, any> | null = null;
  try {
    allPlayers = await sleeperApi.getAllPlayers();
  } catch {
    console.error("[DraftIntel] Could not load player data for value curve");
    return 0;
  }

  await db.delete(pickValueCurve);

  let count = 0;

  for (const draftType of ["rookie", "startup"] as const) {
    const maxPick = draftType === "rookie" ? 60 : 250;

    const pickResults = await db.execute(sql`
      SELECT dp.pick_no, dp.player_id
      FROM draft_picks dp
      JOIN drafts d ON dp.draft_id = d.draft_id
      WHERE d.status = 'complete' AND d.type = ${draftType}
      AND dp.pick_no <= ${maxPick}
      ORDER BY dp.pick_no
    `);

    const pickRows = pickResults.rows as any[];
    const pickGroups: Record<number, string[]> = {};

    for (const row of pickRows) {
      const pn = row.pick_no;
      if (!pickGroups[pn]) pickGroups[pn] = [];
      pickGroups[pn].push(row.player_id);
    }

    for (const [pickNumStr, playerIds] of Object.entries(pickGroups)) {
      const pickNum = parseInt(pickNumStr);
      let totalValue = 0;
      let validCount = 0;

      for (const pid of playerIds) {
        const player = allPlayers?.[pid];
        if (!player) continue;

        const pos = player.position || "WR";
        const age = player.age || 25;
        const yearsExp = player.years_exp || 0;
        const injuryStatus = player.injury_status || null;

        const value = getQuickPlayerValue(
          pid, pos, age, yearsExp, injuryStatus,
          {}, null, null
        );

        if (typeof value === "number" && !isNaN(value) && value > 0) {
          totalValue += value;
          validCount++;
        }
      }

      const avgValue = validCount > 0 ? Math.round(totalValue / validCount) : 0;

      if (avgValue > 0) {
        await db.insert(pickValueCurve).values({
          pickNumber: pickNum,
          draftType,
          avgDynastyValue: avgValue,
          sampleSize: validCount,
        });
        count++;
      }
    }
  }

  console.log(`[DraftIntel] Pick value curve computed for ${count} pick slots`);
  return count;
}

function pickNumberToLabel(pickNumber: number, teamsPerDraft: number = 12): string {
  const round = Math.ceil(pickNumber / teamsPerDraft);
  const pick = ((pickNumber - 1) % teamsPerDraft) + 1;
  return `${round}.${pick.toString().padStart(2, "0")}`;
}

export async function computePickEquivalents(): Promise<number> {
  console.log("[DraftIntel] Computing pick equivalents...");

  const rookieCurve = await db.select()
    .from(pickValueCurve)
    .where(eq(pickValueCurve.draftType, "rookie"));

  const startupCurve = await db.select()
    .from(pickValueCurve)
    .where(eq(pickValueCurve.draftType, "startup"));

  const rookieSorted = rookieCurve.sort((a, b) => b.avgDynastyValue - a.avgDynastyValue);
  const startupSorted = startupCurve.sort((a, b) => b.avgDynastyValue - a.avgDynastyValue);

  if (rookieSorted.length === 0 && startupSorted.length === 0) {
    console.log("[DraftIntel] No pick value curve data available, skipping equivalents");
    return 0;
  }

  let allPlayers: Record<string, any> | null = null;
  try {
    allPlayers = await sleeperApi.getAllPlayers();
  } catch {
    console.error("[DraftIntel] Could not load player data for pick equivalents");
    return 0;
  }

  const adpRows = await db.select().from(draftAdp);
  let count = 0;

  for (const adpRow of adpRows) {
    const player = allPlayers?.[adpRow.playerId];
    if (!player) continue;

    const pos = player.position || "WR";
    const age = player.age || 25;
    const yearsExp = player.years_exp || 0;
    const dynastyValue = getQuickPlayerValue(
      adpRow.playerId, pos, age, yearsExp, null,
      {}, null, null
    );

    const playerValue = typeof dynastyValue === "number" ? dynastyValue : 0;
    if (playerValue <= 0) continue;

    let rookieEq: string | null = null;
    let startupEq: string | null = null;

    if (rookieSorted.length > 0) {
      let closestRookie = rookieSorted[0];
      let minDiff = Math.abs(playerValue - closestRookie.avgDynastyValue);
      for (const entry of rookieSorted) {
        const diff = Math.abs(playerValue - entry.avgDynastyValue);
        if (diff < minDiff) {
          minDiff = diff;
          closestRookie = entry;
        }
      }
      rookieEq = pickNumberToLabel(closestRookie.pickNumber, 12);
    }

    if (startupSorted.length > 0) {
      let closestStartup = startupSorted[0];
      let minDiff = Math.abs(playerValue - closestStartup.avgDynastyValue);
      for (const entry of startupSorted) {
        const diff = Math.abs(playerValue - entry.avgDynastyValue);
        if (diff < minDiff) {
          minDiff = diff;
          closestStartup = entry;
        }
      }
      startupEq = pickNumberToLabel(closestStartup.pickNumber, 12);
    }

    await db.update(draftAdp)
      .set({
        rookiePickEq: rookieEq,
        startupPickEq: startupEq,
        lastUpdated: new Date(),
      })
      .where(eq(draftAdp.id, adpRow.id));

    count++;
  }

  console.log(`[DraftIntel] Pick equivalents computed for ${count} players`);
  return count;
}

export async function runFullDraftIntelPipeline(): Promise<void> {
  const startTime = Date.now();
  console.log("[DraftIntel] ====== Starting full Draft Intelligence pipeline ======");

  try {
    try {
      const extStats = await fetchDynastyProcessRankings();
      console.log(`[DraftIntel] External: ${extStats.matched}/${extStats.total} DynastyProcess players matched`);
    } catch (e) {
      console.error("[DraftIntel] External rankings fetch failed (continuing):", e);
    }

    const ingestionStats = await ingestAllDrafts();
    console.log(`[DraftIntel] Ingestion: ${ingestionStats.draftsProcessed} drafts, ${ingestionStats.picksStored} picks`);

    const adpCount = await computeADP();
    console.log(`[DraftIntel] ADP: ${adpCount} players`);

    const curveCount = await computePickValueCurve();
    console.log(`[DraftIntel] Curve: ${curveCount} pick slots`);

    const eqCount = await computePickEquivalents();
    console.log(`[DraftIntel] Equivalents: ${eqCount} players`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[DraftIntel] ====== Pipeline complete in ${elapsed}s ======`);
  } catch (e) {
    console.error("[DraftIntel] Pipeline failed:", e);
  }
}

let adpCache: { data: any; timestamp: number } | null = null;
let curveCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const OFFENSE_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

export async function getCachedADP(options?: {
  format?: string;
  position?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  category?: string;
}): Promise<{ players: any[]; total: number }> {
  const format = options?.format || "all";
  const position = options?.position;
  const search = options?.search;
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;
  const sort = options?.sort || "consensus";
  const category = options?.category || "offense";

  const ALLOWED_ORDER_COLS: Record<string, string> = {
    "consensus_rank": "consensus_rank",
    "adp_overall": "adp_overall",
    "adp_1qb": "adp_1qb",
    "adp_sf": "adp_sf",
    "adp_tep": "adp_tep",
    "ecr_1qb": "ecr_1qb",
    "ecr_sf": "ecr_sf",
  };

  let orderKey = "consensus_rank";
  if (sort === "sleeper") {
    if (format === "1QB") orderKey = "adp_1qb";
    else if (format === "SF") orderKey = "adp_sf";
    else if (format === "TEP") orderKey = "adp_tep";
    else orderKey = "adp_overall";
  } else if (sort === "ecr") {
    orderKey = format === "SF" ? "ecr_sf" : "ecr_1qb";
  }

  const orderCol = ALLOWED_ORDER_COLS[orderKey] || "consensus_rank";

  let whereClause = sql`1=1`;

  if (category === "offense") {
    whereClause = sql`${whereClause} AND da.position IN ('QB', 'RB', 'WR', 'TE')`;
  }

  if (position && position !== "ALL") {
    whereClause = sql`${whereClause} AND da.position = ${position}`;
  }
  if (search) {
    whereClause = sql`${whereClause} AND LOWER(da.player_name) LIKE ${`%${search.toLowerCase()}%`}`;
  }
  if (format !== "all") {
    if (sort === "ecr") {
      const ecrCol = format === "SF" ? "da.ecr_sf" : "da.ecr_1qb";
      whereClause = sql`${whereClause} AND ${sql.raw(ecrCol)} IS NOT NULL`;
    } else {
      const adpCol = format === "1QB" ? "da.adp_1qb" : format === "SF" ? "da.adp_sf" : "da.adp_tep";
      const ecrCol = format === "SF" ? "da.ecr_sf" : "da.ecr_1qb";
      whereClause = sql`${whereClause} AND (${sql.raw(adpCol)} IS NOT NULL OR ${sql.raw(ecrCol)} IS NOT NULL)`;
    }
  }

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM draft_adp da WHERE ${whereClause}
  `);
  const total = (countResult.rows[0] as any)?.total || 0;

  const dataResult = await db.execute(sql`
    SELECT da.*, 
      pmm.market_heat_level,
      pmm.market_label,
      pmm.hype_velocity
    FROM draft_adp da
    LEFT JOIN player_market_metrics pmm ON da.player_id = pmm.player_id
    WHERE ${whereClause}
    ORDER BY ${sql.raw('da.' + orderCol)} ASC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `);

  return { players: dataResult.rows as any[], total };
}

export async function getSleeperStats(): Promise<{ playerCount: number; draftCount: number; pickCount: number }> {
  const playerResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM draft_adp WHERE data_sources LIKE '%sleeper%' AND position IN ('QB', 'RB', 'WR', 'TE')
  `);
  const draftResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM drafts
  `);
  const pickResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM draft_picks
  `);
  return {
    playerCount: (playerResult.rows[0] as any)?.cnt || 0,
    draftCount: (draftResult.rows[0] as any)?.cnt || 0,
    pickCount: (pickResult.rows[0] as any)?.cnt || 0,
  };
}

export async function getPlayerADP(playerId: string): Promise<any | null> {
  const rows = await db.select()
    .from(draftAdp)
    .where(eq(draftAdp.playerId, playerId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function getCachedPickValueCurve(draftType?: string): Promise<any[]> {
  const now = Date.now();
  if (curveCache && (now - curveCache.timestamp) < CACHE_TTL && !draftType) {
    return curveCache.data;
  }

  let rows;
  if (draftType) {
    rows = await db.select()
      .from(pickValueCurve)
      .where(eq(pickValueCurve.draftType, draftType));
  } else {
    rows = await db.select().from(pickValueCurve);
  }

  const sorted = rows.sort((a, b) => a.pickNumber - b.pickNumber);

  if (!draftType) {
    curveCache = { data: sorted, timestamp: now };
  }

  return sorted;
}

export async function getEnhancedPickValueCurve(draftType: string): Promise<any[]> {
  const curveRows = await db.select()
    .from(pickValueCurve)
    .where(eq(pickValueCurve.draftType, draftType));
  
  const sorted = curveRows.sort((a, b) => a.pickNumber - b.pickNumber);
  
  const topPlayerResult = await db.execute(sql`
    SELECT dp.pick_no, dp.player_name, dp.position, COUNT(*)::int AS times_picked
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.draft_id
    WHERE d.type = ${draftType}
      AND dp.position IN ('QB', 'RB', 'WR', 'TE')
    GROUP BY dp.pick_no, dp.player_name, dp.position
    ORDER BY dp.pick_no ASC, times_picked DESC
  `);
  
  const topPlayerByPick: Record<number, { name: string; position: string; count: number }> = {};
  for (const row of topPlayerResult.rows as any[]) {
    const pickNo = row.pick_no;
    if (!topPlayerByPick[pickNo]) {
      topPlayerByPick[pickNo] = { name: row.player_name, position: row.position, count: row.times_picked };
    }
  }
  
  const maxValue = sorted.length > 0 ? Math.max(...sorted.map(s => s.avgDynastyValue)) : 1;
  
  return sorted.map((entry) => {
    const topPlayer = topPlayerByPick[entry.pickNumber];
    const valuePct = maxValue > 0 ? Math.round((entry.avgDynastyValue / maxValue) * 100) : 0;
    return {
      ...entry,
      topPlayerName: topPlayer?.name || null,
      topPlayerPosition: topPlayer?.position || null,
      topPlayerCount: topPlayer?.count || 0,
      valuePctOfTop: valuePct,
    };
  });
}

export async function getPlayerPickDistribution(playerName: string, draftType: string): Promise<{
  playerName: string;
  position: string | null;
  totalPicked: number;
  draftType: string;
  distribution: { pickNo: number; pickLabel: string; count: number }[];
}> {
  const validType = draftType === "startup" ? "startup" : "rookie";

  const result = await db.execute(sql`
    SELECT dp.player_name, dp.position, dp.pick_no, COUNT(*)::int AS times_picked
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.draft_id
    WHERE d.type = ${validType}
      AND dp.player_name = ${playerName}
      AND dp.position IN ('QB', 'RB', 'WR', 'TE')
    GROUP BY dp.player_name, dp.position, dp.pick_no
    ORDER BY dp.pick_no ASC
  `);

  const rows = result.rows as any[];
  const position = rows.length > 0 ? rows[0].position : null;
  const totalPicked = rows.reduce((sum, r) => sum + r.times_picked, 0);

  const formatPickLabel = (pickNum: number) => {
    const round = Math.ceil(pickNum / 12);
    const pick = ((pickNum - 1) % 12) + 1;
    return `${round}.${pick.toString().padStart(2, "0")}`;
  };

  return {
    playerName,
    position,
    totalPicked,
    draftType: validType,
    distribution: rows.map((r) => ({
      pickNo: r.pick_no,
      pickLabel: formatPickLabel(r.pick_no),
      count: r.times_picked,
    })),
  };
}
