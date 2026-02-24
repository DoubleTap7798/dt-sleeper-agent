import {
  LeagueContext,
  RosterContext,
  StandingsEntry,
  PlayerProjection,
  MatchupContext,
  PositionalScarcity,
} from './types';
import * as sleeperApi from '../sleeper-api';

const cache = new Map<string, { data: any; time: number }>();
const CACHE_TTL: Record<string, number> = {
  leagueContext: 5 * 60 * 1000,
  rosterContexts: 2 * 60 * 1000,
  standings: 2 * 60 * 1000,
  projections: 10 * 60 * 1000,
  weeklyStats: 30 * 60 * 1000,
  positionalScarcity: 10 * 60 * 1000,
};

function getCached<T>(key: string, ttlKey: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  const ttl = CACHE_TTL[ttlKey] || 5 * 60 * 1000;
  if (Date.now() - entry.time > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any): void {
  if (cache.size >= 500) {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    cache.forEach((v, k) => {
      if (v.time < oldestTime) {
        oldestTime = v.time;
        oldest = k;
      }
    });
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, time: Date.now() });
}

async function fetchWeeklyStats(season: string, week: number): Promise<Record<string, any>> {
  const cacheKey = `weeklyStats:${season}:${week}`;
  const cached = getCached<Record<string, any>>(cacheKey, 'weeklyStats');
  if (cached) return cached;

  try {
    const response = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`);
    if (!response.ok) return {};
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch {
    return {};
  }
}

async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

function computeRanks(rosters: sleeperApi.SleeperRoster[]): Map<number, number> {
  const sorted = [...rosters].sort((a, b) => {
    const aWins = a.settings?.wins || 0;
    const bWins = b.settings?.wins || 0;
    if (aWins !== bWins) return bWins - aWins;
    const aPts = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
    const bPts = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
    return bPts - aPts;
  });
  const rankMap = new Map<number, number>();
  sorted.forEach((r, i) => rankMap.set(r.roster_id, i + 1));
  return rankMap;
}

function rosterToContext(roster: sleeperApi.SleeperRoster, rank: number, waiverBudget: number): RosterContext {
  return {
    rosterId: roster.roster_id,
    ownerId: roster.owner_id || '',
    players: roster.players || [],
    starters: roster.starters || [],
    wins: roster.settings?.wins || 0,
    losses: roster.settings?.losses || 0,
    ties: roster.settings?.ties || 0,
    fpts: (roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100,
    fptsAgainst: (roster.settings?.fpts_against || 0) + (roster.settings?.fpts_against_decimal || 0) / 100,
    rank,
    faabRemaining: Math.max(0, waiverBudget - (roster.settings?.waiver_budget_used || 0)),
    waiverPosition: roster.settings?.waiver_position || 0,
  };
}

export async function getLeagueContext(leagueId: string): Promise<LeagueContext> {
  const cacheKey = `leagueContext:${leagueId}`;
  const cached = getCached<LeagueContext>(cacheKey, 'leagueContext');
  if (cached) return cached;

  const [league, state] = await Promise.all([
    sleeperApi.getLeague(leagueId),
    sleeperApi.getState(),
  ]);

  if (!league) {
    throw new Error(`League ${leagueId} not found`);
  }

  const currentWeek = state?.week || 1;
  const playoffWeekStart = league.settings?.playoff_week_start || 15;

  const context: LeagueContext = {
    leagueId: league.league_id,
    leagueName: league.name,
    scoringSettings: league.scoring_settings || {},
    rosterPositions: league.roster_positions || [],
    totalRosters: league.total_rosters,
    playoffTeams: league.settings?.playoff_teams || 6,
    playoffWeekStart: playoffWeekStart,
    currentWeek,
    totalRegularSeasonWeeks: playoffWeekStart - 1,
    waiverBudget: league.settings?.waiver_budget || 100,
    leagueType: league.settings?.type || 0,
    season: league.season,
  };

  setCache(cacheKey, context);
  return context;
}

export async function getRosterContext(leagueId: string, sleeperUserId: string): Promise<RosterContext> {
  const contexts = await getAllRosterContexts(leagueId);
  const userContext = contexts.find(c => c.ownerId === sleeperUserId);
  if (!userContext) {
    throw new Error(`Roster not found for user ${sleeperUserId} in league ${leagueId}`);
  }
  return userContext;
}

export async function getAllRosterContexts(leagueId: string): Promise<RosterContext[]> {
  const cacheKey = `rosterContexts:${leagueId}`;
  const cached = getCached<RosterContext[]>(cacheKey, 'rosterContexts');
  if (cached) return cached;

  const [rosters, leagueContext] = await Promise.all([
    sleeperApi.getLeagueRosters(leagueId),
    getLeagueContext(leagueId),
  ]);

  const rankMap = computeRanks(rosters);

  const contexts = rosters.map(roster =>
    rosterToContext(roster, rankMap.get(roster.roster_id) || rosters.length, leagueContext.waiverBudget)
  ).sort((a, b) => a.rank - b.rank);

  setCache(cacheKey, contexts);
  return contexts;
}

export async function getStandings(leagueId: string): Promise<StandingsEntry[]> {
  const cacheKey = `standings:${leagueId}`;
  const cached = getCached<StandingsEntry[]>(cacheKey, 'standings');
  if (cached) return cached;

  const [contexts, leagueContext] = await Promise.all([
    getAllRosterContexts(leagueId),
    getLeagueContext(leagueId),
  ]);

  const { currentWeek, totalRegularSeasonWeeks } = leagueContext;

  const remainingWeeks: number[] = [];
  for (let w = currentWeek; w <= totalRegularSeasonWeeks; w++) {
    remainingWeeks.push(w);
  }

  const scheduleMap = new Map<number, number[]>();
  contexts.forEach(c => scheduleMap.set(c.rosterId, []));

  const matchupPromises = remainingWeeks.map(w => sleeperApi.getMatchups(leagueId, w));
  const allMatchups = await Promise.all(matchupPromises);

  allMatchups.forEach((weekMatchups) => {
    const matchupGroups = new Map<number, number[]>();
    weekMatchups.forEach(m => {
      if (!matchupGroups.has(m.matchup_id)) {
        matchupGroups.set(m.matchup_id, []);
      }
      matchupGroups.get(m.matchup_id)!.push(m.roster_id);
    });

    matchupGroups.forEach(rosterIds => {
      if (rosterIds.length === 2) {
        const existing0 = scheduleMap.get(rosterIds[0]) || [];
        existing0.push(rosterIds[1]);
        scheduleMap.set(rosterIds[0], existing0);

        const existing1 = scheduleMap.get(rosterIds[1]) || [];
        existing1.push(rosterIds[0]);
        scheduleMap.set(rosterIds[1], existing1);
      }
    });
  });

  const standings: StandingsEntry[] = contexts.map(c => ({
    rosterId: c.rosterId,
    ownerId: c.ownerId,
    wins: c.wins,
    losses: c.losses,
    ties: c.ties,
    fpts: c.fpts,
    rank: c.rank,
    remainingSchedule: scheduleMap.get(c.rosterId) || [],
  }));

  setCache(cacheKey, standings);
  return standings;
}

const POSITION_VARIANCE: Record<string, number> = {
  QB: 6.0,
  RB: 5.5,
  WR: 5.0,
  TE: 4.0,
  K: 3.0,
  DEF: 4.0,
};

export async function getPlayerProjections(
  playerIds: string[],
  scoringSettings: Record<string, number>,
  season: string,
  currentWeek: number
): Promise<PlayerProjection[]> {
  const allPlayers = await sleeperApi.getAllPlayers();
  const projections = await sleeperApi.fetchSleeperProjections(season, currentWeek);

  const weeksToFetch: number[] = [];
  for (let w = 1; w < currentWeek; w++) {
    weeksToFetch.push(w);
  }

  const weeklyStatsData = await processBatches(weeksToFetch, 10, async (week) => {
    const stats = await fetchWeeklyStats(season, week);
    return { week, stats };
  });

  const weeklyStatsMap = new Map<number, Record<string, any>>();
  weeklyStatsData.forEach(({ week, stats }) => {
    weeklyStatsMap.set(week, stats);
  });

  const results: PlayerProjection[] = [];

  for (const playerId of playerIds) {
    const playerInfo = allPlayers[playerId];
    const playerName = playerInfo
      ? `${playerInfo.first_name || ''} ${playerInfo.last_name || ''}`.trim()
      : playerId;
    const position = playerInfo?.position || 'UNKNOWN';
    const team = playerInfo?.team || 'FA';
    const injuryStatus = playerInfo?.injury_status || null;
    const byeWeek = playerInfo?.bye_week || null;

    const weeklyScores: number[] = [];

    for (const [, weekStats] of Array.from(weeklyStatsMap)) {
      const playerStats = weekStats[playerId];
      if (playerStats && playerStats.gp && playerStats.gp > 0) {
        const pts = sleeperApi.calculateFantasyPoints(playerStats, scoringSettings);
        weeklyScores.push(pts);
      }
    }

    let median: number;
    let floor: number;
    let ceiling: number;
    let stdDev: number;

    if (weeklyScores.length >= 3) {
      const sorted = [...weeklyScores].sort((a, b) => a - b);
      const n = sorted.length;
      median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

      const q1Idx = Math.floor(n * 0.25);
      const q3Idx = Math.floor(n * 0.75);
      floor = sorted[q1Idx];
      ceiling = sorted[Math.min(q3Idx, n - 1)];

      const mean = weeklyScores.reduce((a, b) => a + b, 0) / n;
      const variance = weeklyScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (n > 1 ? n - 1 : n);
      stdDev = Math.sqrt(variance);
      const minStdDev = (POSITION_VARIANCE[position] || 5.0) * 0.3;
      if (stdDev < minStdDev) stdDev = minStdDev;
    } else {
      const proj = projections[playerId];
      if (proj) {
        median = sleeperApi.calculateFantasyPoints(proj, scoringSettings);
      } else {
        median = 0;
      }
      const posVar = POSITION_VARIANCE[position] || 5.0;
      stdDev = posVar;
      floor = Math.max(0, median - stdDev);
      ceiling = median + stdDev;
    }

    results.push({
      playerId,
      playerName,
      position,
      team,
      median: Math.round(median * 100) / 100,
      floor: Math.round(floor * 100) / 100,
      ceiling: Math.round(ceiling * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      variance: Math.round(stdDev * stdDev * 100) / 100,
      gamesPlayed: weeklyScores.length,
      weeklyScores,
      injuryStatus,
      byeWeek,
    });
  }

  return results;
}

export async function getMatchupContext(
  leagueId: string,
  sleeperUserId: string,
  week: number
): Promise<MatchupContext> {
  const [contexts, leagueContext, matchups] = await Promise.all([
    getAllRosterContexts(leagueId),
    getLeagueContext(leagueId),
    sleeperApi.getMatchups(leagueId, week),
  ]);

  const userContext = contexts.find(c => c.ownerId === sleeperUserId);
  if (!userContext) {
    throw new Error(`Roster not found for user ${sleeperUserId}`);
  }

  if (!matchups || matchups.length === 0) {
    const allPlayerIds = [...userContext.players];
    const allProjections = await getPlayerProjections(
      allPlayerIds,
      leagueContext.scoringSettings,
      leagueContext.season,
      leagueContext.currentWeek
    );
    const projectionMap = new Map<string, PlayerProjection>();
    allProjections.forEach(p => projectionMap.set(p.playerId, p));
    const userProjections = userContext.players
      .map(id => projectionMap.get(id))
      .filter((p): p is PlayerProjection => p !== undefined);
    return {
      week,
      userRoster: userContext,
      opponentRoster: {
        rosterId: 0, ownerId: '', players: [], starters: [],
        wins: 0, losses: 0, ties: 0, fpts: 0, fptsAgainst: 0,
        rank: 0, faabRemaining: 0, waiverPosition: 0,
      },
      userProjections,
      opponentProjections: [],
    };
  }

  const userMatchup = matchups.find(m => m.roster_id === userContext.rosterId);
  if (!userMatchup) {
    throw new Error(`No matchup found for roster ${userContext.rosterId} in week ${week}. The season may not have started yet.`);
  }

  const opponentMatchup = matchups.find(
    m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userContext.rosterId
  );

  let opponentContext: RosterContext;
  if (opponentMatchup) {
    const found = contexts.find(c => c.rosterId === opponentMatchup.roster_id);
    opponentContext = found || {
      rosterId: opponentMatchup.roster_id,
      ownerId: '',
      players: [],
      starters: [],
      wins: 0,
      losses: 0,
      ties: 0,
      fpts: 0,
      fptsAgainst: 0,
      rank: contexts.length,
      faabRemaining: 0,
      waiverPosition: 0,
    };
  } else {
    opponentContext = {
      rosterId: 0,
      ownerId: '',
      players: [],
      starters: [],
      wins: 0,
      losses: 0,
      ties: 0,
      fpts: 0,
      fptsAgainst: 0,
      rank: 0,
      faabRemaining: 0,
      waiverPosition: 0,
    };
  }

  const allPlayerIds = Array.from(
    new Set([...userContext.players, ...opponentContext.players])
  );

  const allProjections = await getPlayerProjections(
    allPlayerIds,
    leagueContext.scoringSettings,
    leagueContext.season,
    leagueContext.currentWeek
  );

  const projectionMap = new Map<string, PlayerProjection>();
  allProjections.forEach(p => projectionMap.set(p.playerId, p));

  const userProjections = userContext.players
    .map(id => projectionMap.get(id))
    .filter((p): p is PlayerProjection => p !== undefined);

  const opponentProjections = opponentContext.players
    .map(id => projectionMap.get(id))
    .filter((p): p is PlayerProjection => p !== undefined);

  return {
    week,
    userRoster: userContext,
    opponentRoster: opponentContext,
    userProjections,
    opponentProjections,
  };
}

export async function getPositionalScarcity(
  leagueId: string,
  scoringSettings: Record<string, number>
): Promise<PositionalScarcity[]> {
  const cacheKey = `positionalScarcity:${leagueId}`;
  const cached = getCached<PositionalScarcity[]>(cacheKey, 'positionalScarcity');
  if (cached) return cached;

  const [contexts, leagueContext, allPlayers] = await Promise.all([
    getAllRosterContexts(leagueId),
    getLeagueContext(leagueId),
    sleeperApi.getAllPlayers(),
  ]);

  const allRosteredPlayerIds = new Set<string>();
  contexts.forEach(c => c.players.forEach(id => allRosteredPlayerIds.add(id)));

  const positionPlayers = new Map<string, string[]>();
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  positions.forEach(pos => positionPlayers.set(pos, []));

  allRosteredPlayerIds.forEach(id => {
    const player = allPlayers[id];
    if (player?.position && positionPlayers.has(player.position)) {
      positionPlayers.get(player.position)!.push(id);
    }
  });

  const allPlayerIds = Array.from(allRosteredPlayerIds);
  const projections = await getPlayerProjections(
    allPlayerIds,
    scoringSettings,
    leagueContext.season,
    leagueContext.currentWeek
  );

  const projMap = new Map<string, PlayerProjection>();
  projections.forEach(p => projMap.set(p.playerId, p));

  const totalRosters = leagueContext.totalRosters;

  const scarcityResults: PositionalScarcity[] = positions.map(pos => {
    const playerIds = positionPlayers.get(pos) || [];
    const playerProjs = playerIds
      .map(id => projMap.get(id))
      .filter((p): p is PlayerProjection => p !== undefined)
      .sort((a, b) => b.median - a.median);

    const totalPoints = playerProjs.reduce((sum, p) => sum + p.median, 0);
    const leagueAvgPoints = playerProjs.length > 0 ? totalPoints / playerProjs.length : 0;

    const starterCount = leagueContext.rosterPositions.filter(
      rp => rp === pos || (pos !== 'K' && pos !== 'DEF' && (rp === 'FLEX' || rp === 'SUPER_FLEX' || rp === 'REC_FLEX'))
    ).length;

    const replacementIdx = Math.min(
      Math.max(totalRosters * Math.max(starterCount, 1), 0),
      playerProjs.length - 1
    );
    const replacementLevel = replacementIdx >= 0 && playerProjs.length > 0
      ? playerProjs[Math.min(replacementIdx, playerProjs.length - 1)].median
      : 0;

    const topPlayerMedian = playerProjs.length > 0 ? playerProjs[0].median : 0;
    const vor = topPlayerMedian - replacementLevel;

    const range = topPlayerMedian - replacementLevel;
    const maxRange = Math.max(...positions.map(p => {
      const pProjs = (positionPlayers.get(p) || [])
        .map(id => projMap.get(id))
        .filter((pp): pp is PlayerProjection => pp !== undefined)
        .sort((a, b) => b.median - a.median);
      if (pProjs.length < 2) return 0;
      return pProjs[0].median - pProjs[pProjs.length - 1].median;
    }));

    const scarcityIndex = maxRange > 0 ? Math.min(1, range / maxRange) : 0;

    return {
      position: pos,
      leagueAvgPoints: Math.round(leagueAvgPoints * 100) / 100,
      replacementLevel: Math.round(replacementLevel * 100) / 100,
      vor: Math.round(vor * 100) / 100,
      scarcityIndex: Math.round(scarcityIndex * 100) / 100,
    };
  });

  setCache(cacheKey, scarcityResults);
  return scarcityResults;
}
