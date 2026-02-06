const NFLVERSE_STATS_URL_TEMPLATE = 'https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_{YEAR}.csv';

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

interface StatsCache {
  weeklyData: NFLVersePlayerStats[];
  seasonData: NFLVerseSeasonStats[];
  fetchedAt: Date;
  season: number;
}

let statsCache: StatsCache | null = null;
const STATS_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

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
  const targetSeason = season || 2024;

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

  const weeklyData = await fetchNFLVerseStats(targetSeason);
  const seasonData = aggregateToSeason(weeklyData);

  statsCache = {
    weeklyData,
    seasonData,
    fetchedAt: new Date(),
    season: targetSeason,
  };

  return {
    weekly: weeklyData,
    season: seasonData,
    fetchedAt: statsCache.fetchedAt,
    seasonYear: targetSeason,
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
