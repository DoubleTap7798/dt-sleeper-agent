const NFLVERSE_STATS_URL_TEMPLATE = 'https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_{YEAR}.csv';
const NFLVERSE_PBP_URL_TEMPLATE = 'https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{YEAR}.csv';

export interface NFLVersePlayerStats {
  player_id: string;
  player_name: string;
  player_display_name: string;
  position: string;
  position_group: string;
  team: string;
  season: number;
  week: number;
  season_type: string;
  opponent_team: string;
  completions: number;
  attempts: number;
  passing_yards: number;
  passing_tds: number;
  interceptions: number;
  sacks: number;
  carries: number;
  rushing_yards: number;
  rushing_tds: number;
  rushing_fumbles_lost: number;
  receptions: number;
  targets: number;
  receiving_yards: number;
  receiving_tds: number;
  receiving_fumbles_lost: number;
  receiving_air_yards: number;
  receiving_yards_after_catch: number;
  receiving_first_downs: number;
  rushing_first_downs: number;
  passing_first_downs: number;
  passing_epa: number;
  rushing_epa: number;
  receiving_epa: number;
  target_share: number;
  air_yards_share: number;
  wopr: number;
  fantasy_points: number;
  fantasy_points_ppr: number;
}

export interface NFLVerseSeasonStats {
  player_id: string;
  player_name: string;
  player_display_name: string;
  position: string;
  team: string;
  season: number;
  games_played: number;
  completions: number;
  attempts: number;
  passing_yards: number;
  passing_tds: number;
  interceptions: number;
  sacks: number;
  carries: number;
  rushing_yards: number;
  rushing_tds: number;
  rushing_fumbles_lost: number;
  receptions: number;
  targets: number;
  receiving_yards: number;
  receiving_tds: number;
  receiving_fumbles_lost: number;
  receiving_first_downs: number;
  rushing_first_downs: number;
  passing_first_downs: number;
  passing_epa: number;
  rushing_epa: number;
  receiving_epa: number;
  target_share: number;
  air_yards_share: number;
  wopr: number;
  fantasy_points: number;
  fantasy_points_ppr: number;
  ppg: number;
  ppg_ppr: number;
  yards_per_carry: number;
  yards_per_reception: number;
  yards_per_target: number;
  td_rate: number;
  catch_rate: number;
}

export interface ExplosivePlayStats {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  rushing_20plus: number;
  rushing_30plus: number;
  rushing_40plus: number;
  receiving_20plus: number;
  receiving_30plus: number;
  receiving_40plus: number;
  passing_20plus: number;
  passing_30plus: number;
  passing_40plus: number;
}

export interface StatLeader {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  value: number;
  games_played?: number;
}

export interface StatLeadersResponse {
  season: number;
  categories: {
    receiving: {
      targets: StatLeader[];
      receptions: StatLeader[];
      receiving_yards: StatLeader[];
      receiving_tds: StatLeader[];
      receiving_first_downs: StatLeader[];
    };
    rushing: {
      carries: StatLeader[];
      rushing_yards: StatLeader[];
      rushing_tds: StatLeader[];
      rushing_first_downs: StatLeader[];
    };
    passing: {
      passing_yards: StatLeader[];
      passing_tds: StatLeader[];
      completions: StatLeader[];
    };
    explosive: {
      rushing_20plus: StatLeader[];
      rushing_30plus: StatLeader[];
      rushing_40plus: StatLeader[];
      receiving_20plus: StatLeader[];
      receiving_30plus: StatLeader[];
      receiving_40plus: StatLeader[];
      passing_20plus: StatLeader[];
      passing_30plus: StatLeader[];
      passing_40plus: StatLeader[];
    };
    efficiency: {
      target_share: StatLeader[];
      yards_per_carry: StatLeader[];
      catch_rate: StatLeader[];
      wopr: StatLeader[];
      ppg_ppr: StatLeader[];
    };
    fantasy: {
      fantasy_points_ppr: StatLeader[];
      ppg_ppr: StatLeader[];
    };
  };
}

interface StatsCache {
  weeklyData: NFLVersePlayerStats[];
  seasonData: NFLVerseSeasonStats[];
  fetchedAt: Date;
  season: number;
}

interface ExplosiveCache {
  data: ExplosivePlayStats[];
  fetchedAt: Date;
  season: number;
}

let statsCache: StatsCache | null = null;
let explosiveCache: ExplosiveCache | null = null;
const STATS_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

function getMostRecentNFLSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 9) {
    return year;
  }
  return year - 1;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function safeFloat(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function safeInt(val: string): number {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

async function fetchNFLVerseStats(season: number): Promise<NFLVersePlayerStats[]> {
  const url = NFLVERSE_STATS_URL_TEMPLATE.replace('{YEAR}', String(season));
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'text/csv' },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch nflverse stats: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const headerIndex: Record<string, number> = {};
    headers.forEach((h, i) => { headerIndex[h.replace(/"/g, '')] = i; });

    const players: NFLVersePlayerStats[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 10) continue;

      const get = (col: string) => values[headerIndex[col]] || '';
      const position = get('position');
      
      if (!['QB', 'RB', 'WR', 'TE'].includes(position)) continue;
      if (get('season_type') !== 'REG') continue;

      players.push({
        player_id: get('player_id'),
        player_name: get('player_name'),
        player_display_name: get('player_display_name'),
        position,
        position_group: get('position_group'),
        team: get('recent_team') || get('team'),
        season: safeInt(get('season')),
        week: safeInt(get('week')),
        season_type: get('season_type'),
        opponent_team: get('opponent_team'),
        completions: safeInt(get('completions')),
        attempts: safeInt(get('attempts')),
        passing_yards: safeFloat(get('passing_yards')),
        passing_tds: safeInt(get('passing_tds')),
        interceptions: safeInt(get('interceptions')),
        sacks: safeInt(get('sacks')),
        carries: safeInt(get('carries')),
        rushing_yards: safeFloat(get('rushing_yards')),
        rushing_tds: safeInt(get('rushing_tds')),
        rushing_fumbles_lost: safeInt(get('rushing_fumbles_lost')),
        receptions: safeInt(get('receptions')),
        targets: safeInt(get('targets')),
        receiving_yards: safeFloat(get('receiving_yards')),
        receiving_tds: safeInt(get('receiving_tds')),
        receiving_fumbles_lost: safeInt(get('receiving_fumbles_lost')),
        receiving_air_yards: safeFloat(get('receiving_air_yards')),
        receiving_yards_after_catch: safeFloat(get('receiving_yards_after_catch')),
        receiving_first_downs: safeInt(get('receiving_first_downs')),
        rushing_first_downs: safeInt(get('rushing_first_downs')),
        passing_first_downs: safeInt(get('passing_first_downs')),
        passing_epa: safeFloat(get('passing_epa')),
        rushing_epa: safeFloat(get('rushing_epa')),
        receiving_epa: safeFloat(get('receiving_epa')),
        target_share: safeFloat(get('target_share')),
        air_yards_share: safeFloat(get('air_yards_share')),
        wopr: safeFloat(get('wopr')),
        fantasy_points: safeFloat(get('fantasy_points')),
        fantasy_points_ppr: safeFloat(get('fantasy_points_ppr')),
      });
    }

    console.log(`Fetched ${players.length} weekly stat lines from nflverse for ${season}`);
    return players;

  } catch (error) {
    console.error(`Error fetching nflverse stats for ${season}:`, error);
    return [];
  }
}

function aggregateToSeason(weeklyStats: NFLVersePlayerStats[]): NFLVerseSeasonStats[] {
  const playerMap = new Map<string, NFLVersePlayerStats[]>();

  for (const stat of weeklyStats) {
    const key = stat.player_id || stat.player_display_name;
    if (!playerMap.has(key)) {
      playerMap.set(key, []);
    }
    playerMap.get(key)!.push(stat);
  }

  const seasonStats: NFLVerseSeasonStats[] = [];

  for (const [, weeks] of Array.from(playerMap.entries())) {
    if (weeks.length === 0) continue;

    const first = weeks[0];
    const gp = weeks.length;

    const sum = (fn: (w: NFLVersePlayerStats) => number) =>
      weeks.reduce((acc: number, w: NFLVersePlayerStats) => acc + fn(w), 0);
    const avg = (fn: (w: NFLVersePlayerStats) => number) =>
      gp > 0 ? sum(fn) / gp : 0;

    const totalCarries = sum(w => w.carries);
    const totalRushYards = sum(w => w.rushing_yards);
    const totalTargets = sum(w => w.targets);
    const totalReceptions = sum(w => w.receptions);
    const totalRecYards = sum(w => w.receiving_yards);
    const totalFP = sum(w => w.fantasy_points);
    const totalFPPPR = sum(w => w.fantasy_points_ppr);
    const totalTDs = sum(w => w.passing_tds) + sum(w => w.rushing_tds) + sum(w => w.receiving_tds);
    const totalOpportunities = totalCarries + totalTargets;

    seasonStats.push({
      player_id: first.player_id,
      player_name: first.player_name,
      player_display_name: first.player_display_name,
      position: first.position,
      team: first.team,
      season: first.season,
      games_played: gp,
      completions: sum(w => w.completions),
      attempts: sum(w => w.attempts),
      passing_yards: sum(w => w.passing_yards),
      passing_tds: sum(w => w.passing_tds),
      interceptions: sum(w => w.interceptions),
      sacks: sum(w => w.sacks),
      carries: totalCarries,
      rushing_yards: totalRushYards,
      rushing_tds: sum(w => w.rushing_tds),
      rushing_fumbles_lost: sum(w => w.rushing_fumbles_lost),
      receptions: totalReceptions,
      targets: totalTargets,
      receiving_yards: totalRecYards,
      receiving_tds: sum(w => w.receiving_tds),
      receiving_fumbles_lost: sum(w => w.receiving_fumbles_lost),
      receiving_first_downs: sum(w => w.receiving_first_downs),
      rushing_first_downs: sum(w => w.rushing_first_downs),
      passing_first_downs: sum(w => w.passing_first_downs),
      passing_epa: sum(w => w.passing_epa),
      rushing_epa: sum(w => w.rushing_epa),
      receiving_epa: sum(w => w.receiving_epa),
      target_share: avg(w => w.target_share),
      air_yards_share: avg(w => w.air_yards_share),
      wopr: avg(w => w.wopr),
      fantasy_points: totalFP,
      fantasy_points_ppr: totalFPPPR,
      ppg: gp > 0 ? totalFP / gp : 0,
      ppg_ppr: gp > 0 ? totalFPPPR / gp : 0,
      yards_per_carry: totalCarries > 0 ? totalRushYards / totalCarries : 0,
      yards_per_reception: totalReceptions > 0 ? totalRecYards / totalReceptions : 0,
      yards_per_target: totalTargets > 0 ? totalRecYards / totalTargets : 0,
      td_rate: totalOpportunities > 0 ? totalTDs / totalOpportunities : 0,
      catch_rate: totalTargets > 0 ? totalReceptions / totalTargets : 0,
    });
  }

  seasonStats.sort((a, b) => b.fantasy_points_ppr - a.fantasy_points_ppr);
  return seasonStats;
}

export async function getNFLVerseStats(season?: number): Promise<{
  weekly: NFLVersePlayerStats[];
  season: NFLVerseSeasonStats[];
  fetchedAt: Date;
  seasonYear: number;
}> {
  const targetSeason = season || getMostRecentNFLSeason();

  if (
    statsCache &&
    statsCache.season === targetSeason &&
    (Date.now() - statsCache.fetchedAt.getTime()) < STATS_CACHE_DURATION_MS
  ) {
    return {
      weekly: statsCache.weeklyData,
      season: statsCache.seasonData,
      fetchedAt: statsCache.fetchedAt,
      seasonYear: statsCache.season,
    };
  }

  let weeklyData: NFLVersePlayerStats[];
  let usedSeason = targetSeason;

  try {
    weeklyData = await fetchNFLVerseStats(targetSeason);
    if (weeklyData.length === 0 && !season) {
      console.log(`[nflverse] No data for ${targetSeason}, falling back to ${targetSeason - 1}`);
      weeklyData = await fetchNFLVerseStats(targetSeason - 1);
      usedSeason = targetSeason - 1;
    }
  } catch (err) {
    if (!season) {
      console.log(`[nflverse] Failed to fetch ${targetSeason}, falling back to ${targetSeason - 1}`);
      weeklyData = await fetchNFLVerseStats(targetSeason - 1);
      usedSeason = targetSeason - 1;
    } else {
      throw err;
    }
  }

  const seasonData = aggregateToSeason(weeklyData);

  statsCache = {
    weeklyData,
    seasonData,
    fetchedAt: new Date(),
    season: usedSeason,
  };

  return {
    weekly: weeklyData,
    season: seasonData,
    fetchedAt: statsCache.fetchedAt,
    seasonYear: usedSeason,
  };
}

async function fetchExplosivePlayStats(season: number): Promise<ExplosivePlayStats[]> {
  const url = NFLVERSE_PBP_URL_TEMPLATE.replace('{YEAR}', String(season));

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'text/csv' },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PBP data: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');

    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const headerIndex: Record<string, number> = {};
    headers.forEach((h, i) => { headerIndex[h.replace(/"/g, '')] = i; });

    interface PlayerAccum {
      player_id: string;
      player_name: string;
      team: string;
      rushing_20plus: number;
      rushing_30plus: number;
      rushing_40plus: number;
      receiving_20plus: number;
      receiving_30plus: number;
      receiving_40plus: number;
      passing_20plus: number;
      passing_30plus: number;
      passing_40plus: number;
    }

    const playerMap = new Map<string, PlayerAccum>();

    const getOrCreate = (id: string, name: string, team: string): PlayerAccum | null => {
      if (!id && !name) return null;
      const key = id || name;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          player_id: id,
          player_name: name,
          team: team,
          rushing_20plus: 0, rushing_30plus: 0, rushing_40plus: 0,
          receiving_20plus: 0, receiving_30plus: 0, receiving_40plus: 0,
          passing_20plus: 0, passing_30plus: 0, passing_40plus: 0,
        });
      }
      const p = playerMap.get(key)!;
      if (team && !p.team) p.team = team;
      return p;
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = parseCSVLine(line);
      if (values.length < 10) continue;

      const get = (col: string) => values[headerIndex[col]] || '';

      if (get('season_type') !== 'REG') continue;

      const rushYards = safeFloat(get('rushing_yards'));
      const recYards = safeFloat(get('receiving_yards'));
      const passYards = safeFloat(get('passing_yards'));
      const posteam = get('posteam');

      if (rushYards >= 20) {
        const rusherId = get('rusher_player_id');
        const rusherName = get('rusher_player_name');
        if (rusherId || rusherName) {
          const p = getOrCreate(rusherId, rusherName, posteam);
          if (p) {
            p.rushing_20plus++;
            if (rushYards >= 30) p.rushing_30plus++;
            if (rushYards >= 40) p.rushing_40plus++;
          }
        }
      }

      if (recYards >= 20) {
        const receiverId = get('receiver_player_id');
        const receiverName = get('receiver_player_name');
        if (receiverId || receiverName) {
          const p = getOrCreate(receiverId, receiverName, posteam);
          if (p) {
            p.receiving_20plus++;
            if (recYards >= 30) p.receiving_30plus++;
            if (recYards >= 40) p.receiving_40plus++;
          }
        }
      }

      if (passYards >= 20) {
        const passerId = get('passer_player_id');
        const passerName = get('passer_player_name');
        if (passerId || passerName) {
          const p = getOrCreate(passerId, passerName, posteam);
          if (p) {
            p.passing_20plus++;
            if (passYards >= 30) p.passing_30plus++;
            if (passYards >= 40) p.passing_40plus++;
          }
        }
      }
    }

    const results: ExplosivePlayStats[] = [];
    for (const [, accum] of Array.from(playerMap.entries())) {
      results.push({
        player_id: accum.player_id,
        player_name: accum.player_name,
        team: accum.team,
        position: '',
        rushing_20plus: accum.rushing_20plus,
        rushing_30plus: accum.rushing_30plus,
        rushing_40plus: accum.rushing_40plus,
        receiving_20plus: accum.receiving_20plus,
        receiving_30plus: accum.receiving_30plus,
        receiving_40plus: accum.receiving_40plus,
        passing_20plus: accum.passing_20plus,
        passing_30plus: accum.passing_30plus,
        passing_40plus: accum.passing_40plus,
      });
    }

    console.log(`[nflverse] Parsed ${results.length} players with explosive play stats for ${season}`);
    return results;

  } catch (error) {
    console.error(`Error fetching PBP explosive stats for ${season}:`, error);
    return [];
  }
}

export async function getExplosivePlayStats(season?: number): Promise<{
  stats: ExplosivePlayStats[];
  fetchedAt: Date;
  seasonYear: number;
}> {
  const targetSeason = season || getMostRecentNFLSeason();

  if (
    explosiveCache &&
    explosiveCache.season === targetSeason &&
    (Date.now() - explosiveCache.fetchedAt.getTime()) < STATS_CACHE_DURATION_MS
  ) {
    return {
      stats: explosiveCache.data,
      fetchedAt: explosiveCache.fetchedAt,
      seasonYear: explosiveCache.season,
    };
  }

  let data: ExplosivePlayStats[];
  let usedSeason = targetSeason;

  try {
    data = await fetchExplosivePlayStats(targetSeason);
    if (data.length === 0 && !season) {
      console.log(`[nflverse] No PBP data for ${targetSeason}, falling back to ${targetSeason - 1}`);
      data = await fetchExplosivePlayStats(targetSeason - 1);
      usedSeason = targetSeason - 1;
    }
  } catch (err) {
    if (!season) {
      console.log(`[nflverse] Failed PBP fetch ${targetSeason}, falling back to ${targetSeason - 1}`);
      data = await fetchExplosivePlayStats(targetSeason - 1);
      usedSeason = targetSeason - 1;
    } else {
      throw err;
    }
  }

  explosiveCache = {
    data,
    fetchedAt: new Date(),
    season: usedSeason,
  };

  return {
    stats: explosiveCache.data,
    fetchedAt: explosiveCache.fetchedAt,
    seasonYear: usedSeason,
  };
}

export async function getStatLeaders(season?: number): Promise<StatLeadersResponse> {
  const [nflverseResult, explosiveResult] = await Promise.all([
    getNFLVerseStats(season),
    getExplosivePlayStats(season),
  ]);

  const seasonStats = nflverseResult.season;
  const explosiveStats = explosiveResult.stats;
  const usedSeason = nflverseResult.seasonYear;

  const efficiencyMinGames = 5;

  function toLeader(p: NFLVerseSeasonStats, value: number): StatLeader {
    return {
      player_id: p.player_id,
      player_name: p.player_display_name,
      team: p.team,
      position: p.position,
      value,
      games_played: p.games_played,
    };
  }

  function topN(
    stats: NFLVerseSeasonStats[],
    valueFn: (p: NFLVerseSeasonStats) => number,
    n: number = 10,
    minGames?: number,
  ): StatLeader[] {
    let filtered = stats;
    if (minGames) {
      filtered = stats.filter(p => p.games_played >= minGames);
    }
    return filtered
      .map(p => toLeader(p, valueFn(p)))
      .filter(l => l.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }

  function explosiveLeader(e: ExplosivePlayStats, value: number): StatLeader {
    return {
      player_id: e.player_id,
      player_name: e.player_name,
      team: e.team,
      position: e.position,
      value,
    };
  }

  function topNExplosive(
    valueFn: (e: ExplosivePlayStats) => number,
    n: number = 10,
  ): StatLeader[] {
    return explosiveStats
      .map(e => explosiveLeader(e, valueFn(e)))
      .filter(l => l.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }

  return {
    season: usedSeason,
    categories: {
      receiving: {
        targets: topN(seasonStats, p => p.targets),
        receptions: topN(seasonStats, p => p.receptions),
        receiving_yards: topN(seasonStats, p => p.receiving_yards),
        receiving_tds: topN(seasonStats, p => p.receiving_tds),
        receiving_first_downs: topN(seasonStats, p => p.receiving_first_downs),
      },
      rushing: {
        carries: topN(seasonStats, p => p.carries),
        rushing_yards: topN(seasonStats, p => p.rushing_yards),
        rushing_tds: topN(seasonStats, p => p.rushing_tds),
        rushing_first_downs: topN(seasonStats, p => p.rushing_first_downs),
      },
      passing: {
        passing_yards: topN(seasonStats, p => p.passing_yards),
        passing_tds: topN(seasonStats, p => p.passing_tds),
        completions: topN(seasonStats, p => p.completions),
      },
      explosive: {
        rushing_20plus: topNExplosive(e => e.rushing_20plus),
        rushing_30plus: topNExplosive(e => e.rushing_30plus),
        rushing_40plus: topNExplosive(e => e.rushing_40plus),
        receiving_20plus: topNExplosive(e => e.receiving_20plus),
        receiving_30plus: topNExplosive(e => e.receiving_30plus),
        receiving_40plus: topNExplosive(e => e.receiving_40plus),
        passing_20plus: topNExplosive(e => e.passing_20plus),
        passing_30plus: topNExplosive(e => e.passing_30plus),
        passing_40plus: topNExplosive(e => e.passing_40plus),
      },
      efficiency: {
        target_share: topN(seasonStats, p => p.target_share, 10, efficiencyMinGames),
        yards_per_carry: topN(seasonStats, p => p.yards_per_carry, 10, efficiencyMinGames),
        catch_rate: topN(seasonStats, p => p.catch_rate, 10, efficiencyMinGames),
        wopr: topN(seasonStats, p => p.wopr, 10, efficiencyMinGames),
        ppg_ppr: topN(seasonStats, p => p.ppg_ppr, 10, efficiencyMinGames),
      },
      fantasy: {
        fantasy_points_ppr: topN(seasonStats, p => p.fantasy_points_ppr),
        ppg_ppr: topN(seasonStats, p => p.ppg_ppr, 10, efficiencyMinGames),
      },
    },
  };
}

export async function getPlayerSeasonStats(playerName: string, season?: number): Promise<NFLVerseSeasonStats | null> {
  const { season: seasonStats } = await getNFLVerseStats(season);
  const normalized = playerName.toLowerCase().trim();
  
  return seasonStats.find(p => 
    p.player_display_name.toLowerCase().trim() === normalized ||
    p.player_name.toLowerCase().trim() === normalized
  ) || null;
}

export async function getPlayerWeeklyStats(playerName: string, season?: number): Promise<NFLVersePlayerStats[]> {
  const { weekly } = await getNFLVerseStats(season);
  const normalized = playerName.toLowerCase().trim();
  
  return weekly.filter(p => 
    p.player_display_name.toLowerCase().trim() === normalized ||
    p.player_name.toLowerCase().trim() === normalized
  ).sort((a, b) => a.week - b.week);
}

export function getNFLVerseCacheStatus(): { cached: boolean; fetchedAt: Date | null; playerCount: number; season: number | null } {
  if (!statsCache) {
    return { cached: false, fetchedAt: null, playerCount: 0, season: null };
  }
  return {
    cached: true,
    fetchedAt: statsCache.fetchedAt,
    playerCount: statsCache.seasonData.length,
    season: statsCache.season,
  };
}
