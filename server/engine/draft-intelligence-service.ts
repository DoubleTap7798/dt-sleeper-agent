import { db } from "../db";
import { drafts, draftPicks, draftAdp, pickValueCurve, userProfiles } from "@shared/schema";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import * as sleeperApi from "../sleeper-api";
import { getQuickPlayerValue } from "../dynasty-value-engine";

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

  const rows = results.rows as any[];

  await db.delete(draftAdp);

  let count = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const values = batch.map((row: any) => ({
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
    }));
    await db.insert(draftAdp).values(values);
    count += values.length;
  }

  console.log(`[DraftIntel] ADP computed for ${count} players`);
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

export async function getCachedADP(options?: {
  format?: string;
  position?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ players: any[]; total: number }> {
  const cacheKey = JSON.stringify(options || {});
  
  const format = options?.format || "all";
  const position = options?.position;
  const search = options?.search;
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;

  const conditions: any[] = [];

  let orderCol = "adp_overall";
  if (format === "1QB") orderCol = "adp_1qb";
  else if (format === "SF") orderCol = "adp_sf";
  else if (format === "TEP") orderCol = "adp_tep";

  let whereClause = sql`1=1`;

  if (position) {
    whereClause = sql`${whereClause} AND position = ${position}`;
  }
  if (search) {
    whereClause = sql`${whereClause} AND LOWER(player_name) LIKE ${`%${search.toLowerCase()}%`}`;
  }
  if (format !== "all") {
    const colName = format === "1QB" ? "adp_1qb" : format === "SF" ? "adp_sf" : "adp_tep";
    whereClause = sql`${whereClause} AND ${sql.raw(colName)} IS NOT NULL`;
  }

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM draft_adp WHERE ${whereClause}
  `);
  const total = (countResult.rows[0] as any)?.total || 0;

  const dataResult = await db.execute(sql`
    SELECT * FROM draft_adp 
    WHERE ${whereClause}
    ORDER BY ${sql.raw(orderCol)} ASC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `);

  return { players: dataResult.rows as any[], total };
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
