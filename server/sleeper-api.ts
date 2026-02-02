// Sleeper API Service
// Documentation: https://docs.sleeper.app/

const SLEEPER_API_BASE = "https://api.sleeper.app/v1";

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
    [key: string]: any;
  };
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: {
    playoff_teams: number;
    playoff_week_start: number;
    waiver_type: number;
    waiver_budget: number;
    trade_deadline: number;
    type: number;
    leg?: number;
    league_average_match?: number; // 1 if median scoring is enabled (extra game vs median each week)
    best_ball?: number; // 1 if best ball league
    num_teams?: number; // Number of teams in the league
  };
  status: string;
  avatar: string | null;
  previous_league_id: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
    ppts: number;
    ppts_decimal: number;
    division?: number;
    waiver_budget_used?: number;
    waiver_position?: number;
  };
  metadata?: Record<string, string>;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: "trade" | "waiver" | "free_agent";
  status: string;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: {
    season: string;
    round: number;
    roster_id: number;
    previous_owner_id: number;
    owner_id: number;
  }[];
  waiver_budget: { sender: number; receiver: number; amount: number }[];
  created: number;
  status_updated?: number;
  metadata?: Record<string, string>;
  consenter_ids?: number[];
  leg?: number;
}

export interface SleeperDraftPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters_points: number[];
  starters: string[];
  players_points: Record<string, number>;
}

async function fetchFromSleeper<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}${endpoint}`);
    if (!response.ok) {
      console.error(`Sleeper API error: ${response.status} for ${endpoint}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Sleeper API fetch error for ${endpoint}:`, error);
    return null;
  }
}

export async function getSleeperUser(username: string): Promise<SleeperUser | null> {
  return fetchFromSleeper<SleeperUser>(`/user/${username}`);
}

export async function getUserLeagues(userId: string, season: string = "2026"): Promise<SleeperLeague[]> {
  const leagues = await fetchFromSleeper<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`);
  return leagues || [];
}

export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  return fetchFromSleeper<SleeperLeague>(`/league/${leagueId}`);
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const rosters = await fetchFromSleeper<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  return rosters || [];
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  const users = await fetchFromSleeper<SleeperUser[]>(`/league/${leagueId}/users`);
  return users || [];
}

export async function getLeagueTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
  const transactions = await fetchFromSleeper<SleeperTransaction[]>(
    `/league/${leagueId}/transactions/${week}`
  );
  return transactions || [];
}

export async function getAllLeagueTransactions(leagueId: string): Promise<SleeperTransaction[]> {
  // Fetch transactions for all weeks in parallel (1-18 for regular season + playoffs)
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const weekPromises = weeks.map((week) => getLeagueTransactions(leagueId, week));
  const results = await Promise.all(weekPromises);
  
  return results.flat();
}

export interface LeagueHistory {
  leagueId: string;
  season: string;
  name: string;
}

export async function getLeagueHistory(leagueId: string): Promise<LeagueHistory[]> {
  const history: LeagueHistory[] = [];
  let currentLeagueId: string | null = leagueId;
  
  while (currentLeagueId) {
    const league = await getLeague(currentLeagueId);
    if (!league) break;
    
    history.push({
      leagueId: league.league_id,
      season: league.season,
      name: league.name,
    });
    
    currentLeagueId = league.previous_league_id;
  }
  
  return history;
}

export interface SeasonTransactions {
  season: string;
  leagueId: string;
  transactions: SleeperTransaction[];
}

export async function getAllHistoricalTransactions(leagueId: string): Promise<SeasonTransactions[]> {
  const history = await getLeagueHistory(leagueId);
  
  const results = await Promise.all(
    history.map(async (h) => {
      const transactions = await getAllLeagueTransactions(h.leagueId);
      return {
        season: h.season,
        leagueId: h.leagueId,
        transactions,
      };
    })
  );
  
  return results.sort((a, b) => b.season.localeCompare(a.season));
}

export async function getLeagueDraftPicks(leagueId: string): Promise<SleeperDraftPick[]> {
  const picks = await fetchFromSleeper<SleeperDraftPick[]>(`/league/${leagueId}/traded_picks`);
  return picks || [];
}

// Draft types and endpoints
export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  type: "linear" | "snake" | "auction";
  status: "pre_draft" | "drafting" | "complete" | "paused";
  season: string;
  settings: {
    rounds: number;
    slots_wr: number;
    slots_rb: number;
    slots_qb: number;
    slots_te: number;
    slots_flex: number;
    slots_super_flex: number;
    slots_k: number;
    slots_def: number;
    slots_idp_flex?: number;
    slots_dl?: number;
    slots_lb?: number;
    slots_db?: number;
    teams: number;
    pick_timer: number;
    cpu_autopick: number;
    alpha_sort: number;
    player_type: number;
    reversal_round?: number; // How many rounds before direction reverses (default 1 for standard snake)
  };
  start_time: number | null;
  slot_to_roster_id?: Record<string, number>;
  draft_order?: Record<string, number>;
  metadata?: {
    name?: string;
    description?: string;
  };
  created: number;
  last_picked?: number;
  last_message_id?: string;
}

export interface SleeperDraftPickResult {
  player_id: string;
  picked_by: string;
  roster_id: number;
  round: number;
  draft_slot: number;
  pick_no: number;
  metadata: {
    first_name: string;
    last_name: string;
    team: string;
    position: string;
    number?: string;
  };
  is_keeper: boolean | null;
  draft_id: string;
}

export async function getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  const drafts = await fetchFromSleeper<SleeperDraft[]>(`/league/${leagueId}/drafts`);
  return drafts || [];
}

export async function getDraft(draftId: string): Promise<SleeperDraft | null> {
  return fetchFromSleeper<SleeperDraft>(`/draft/${draftId}`);
}

export async function getDraftPicks(draftId: string): Promise<SleeperDraftPickResult[]> {
  const picks = await fetchFromSleeper<SleeperDraftPickResult[]>(`/draft/${draftId}/picks`);
  return picks || [];
}

export async function getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  const matchups = await fetchFromSleeper<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`);
  return matchups || [];
}

export interface PlayoffBracketMatch {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  w: number | null;
  l: number | null;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

export async function getPlayoffBracket(leagueId: string): Promise<PlayoffBracketMatch[]> {
  const bracket = await fetchFromSleeper<PlayoffBracketMatch[]>(`/league/${leagueId}/winners_bracket`);
  return bracket || [];
}

export function findChampionFromBracket(bracket: PlayoffBracketMatch[]): number | null {
  if (!bracket || bracket.length === 0) return null;
  
  const maxRound = Math.max(...bracket.map(m => m.r));
  const finalMatch = bracket.find(m => m.r === maxRound && m.w !== null);
  
  return finalMatch?.w || null;
}

export interface SeasonRosters {
  season: string;
  leagueId: string;
  rosters: SleeperRoster[];
  users: SleeperUser[];
}

export async function getAllHistoricalRosters(leagueId: string): Promise<SeasonRosters[]> {
  const history = await getLeagueHistory(leagueId);
  
  const results = await Promise.all(
    history.map(async (h) => {
      const [rosters, users] = await Promise.all([
        getLeagueRosters(h.leagueId),
        getLeagueUsers(h.leagueId),
      ]);
      return {
        season: h.season,
        leagueId: h.leagueId,
        rosters,
        users,
      };
    })
  );
  
  return results.sort((a, b) => b.season.localeCompare(a.season));
}

export async function getState(): Promise<{ week: number; season: string; display_week: number; season_type: string; league_season: string } | null> {
  return fetchFromSleeper<{ week: number; season: string; display_week: number; season_type: string; league_season: string }>("/state/nfl");
}

// Player stats types
export interface PlayerStats {
  [playerId: string]: {
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
    pass_yd?: number;
    pass_td?: number;
    pass_int?: number;
    pass_att?: number;
    pass_cmp?: number;
    rush_yd?: number;
    rush_td?: number;
    rush_att?: number;
    rec?: number;
    rec_yd?: number;
    rec_td?: number;
    fum?: number;
    fum_lost?: number;
    gp?: number;
    [key: string]: number | undefined;
  };
}

// Cache for player stats - keyed by season
const statsCacheMap: Map<string, { data: PlayerStats; time: number }> = new Map();
const STATS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Get season stats for all players
export async function getSeasonStats(season: string = "2024", seasonType: string = "regular"): Promise<PlayerStats> {
  const cacheKey = `${season}-${seasonType}`;
  const now = Date.now();
  const cached = statsCacheMap.get(cacheKey);
  
  if (cached && now - cached.time < STATS_CACHE_DURATION) {
    return cached.data;
  }

  try {
    let response = await fetch(`https://api.sleeper.app/v1/stats/nfl/${seasonType}/${season}`);
    
    // If current season fails, try previous season (stats may not be available yet)
    if (!response.ok && parseInt(season) > 2020) {
      const fallbackSeason = String(parseInt(season) - 1);
      console.log(`Stats not available for ${season}, trying ${fallbackSeason}`);
      response = await fetch(`https://api.sleeper.app/v1/stats/nfl/${seasonType}/${fallbackSeason}`);
    }
    
    if (!response.ok) {
      console.error(`Stats API error: ${response.status}`);
      return cached?.data || {};
    }
    const stats = await response.json();
    // Get actual season from response URL in case we fell back
    const actualSeason = response.url.split('/').pop() || season;
    statsCacheMap.set(`${actualSeason}-${seasonType}`, { data: stats, time: now });
    return stats;
  } catch (error) {
    console.error("Error fetching player stats:", error);
    return cached?.data || {};
  }
}

// Determine scoring type from league settings
export function getScoringType(scoringSettings: Record<string, number>): "ppr" | "half_ppr" | "std" {
  const recPoints = scoringSettings.rec || 0;
  if (recPoints >= 1) return "ppr";
  if (recPoints >= 0.5) return "half_ppr";
  return "std";
}

// Standard scoring defaults for PPR format  
const STANDARD_PPR_DEFAULTS: Record<string, number> = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -2,
  pass_2pt: 2,
  rush_yd: 0.1,
  rush_td: 6,
  rush_2pt: 2,
  rec: 1,
  rec_yd: 0.1,
  rec_td: 6,
  rec_2pt: 2,
  fum_lost: -2,
};

// Keys that are not stat multipliers (don't have corresponding stats)
const NON_STAT_KEYS = new Set([
  // Points allowed ranges (defense)
  "pts_allow_0", "pts_allow_1_6", "pts_allow_7_13", "pts_allow_14_20",
  "pts_allow_21_27", "pts_allow_28_34", "pts_allow_35p",
  // Position-specific bonuses handled separately
  "bonus_rec_te", "bonus_rec_rb", "bonus_rec_wr",
]);

// Calculate fantasy points using a hybrid approach:
// 1. Use Sleeper's pre-calculated pts_* as base (includes per-game bonuses correctly)
// 2. Adjust for differences in core scoring categories
// 3. Add points for additional scoring categories not in standard formats
export function calculateFantasyPoints(
  stats: PlayerStats[string],
  scoringSettings: Record<string, number>
): number {
  if (!stats) return 0;
  
  // Get the base pre-calculated points from Sleeper
  const scoringType = getScoringType(scoringSettings);
  let basePoints = 0;
  let hasBasePoints = false;
  
  if (scoringType === "ppr" && stats.pts_ppr !== undefined) {
    basePoints = stats.pts_ppr;
    hasBasePoints = true;
  } else if (scoringType === "half_ppr" && stats.pts_half_ppr !== undefined) {
    basePoints = stats.pts_half_ppr;
    hasBasePoints = true;
  } else if (scoringType === "std" && stats.pts_std !== undefined) {
    basePoints = stats.pts_std;
    hasBasePoints = true;
  }
  
  if (!hasBasePoints) {
    // No pre-calculated points, use fully generic calculation
    return calculateFantasyPointsGeneric(stats, scoringSettings);
  }
  
  // Get the defaults for the scoring type to calculate differences
  const defaults = { ...STANDARD_PPR_DEFAULTS };
  if (scoringType === "half_ppr") {
    defaults.rec = 0.5;
  } else if (scoringType === "std") {
    defaults.rec = 0;
  }
  
  // Iterate ALL scoring settings and apply adjustments/additions
  for (const [scoringKey, leagueValue] of Object.entries(scoringSettings)) {
    if (typeof leagueValue !== "number") continue;
    if (NON_STAT_KEYS.has(scoringKey)) continue;
    
    const statValue = stats[scoringKey];
    if (typeof statValue !== "number") continue;
    
    const defaultValue = defaults[scoringKey];
    
    if (typeof defaultValue === "number") {
      // This is a key included in standard scoring - adjust for difference
      const diff = (leagueValue - defaultValue) * statValue;
      if (Math.abs(diff) > 0.001) {
        basePoints += diff;
      }
    } else {
      // This is an additional key not in standard scoring - add full value
      if (leagueValue !== 0) {
        basePoints += statValue * leagueValue;
      }
    }
  }
  
  return Math.round(basePoints * 100) / 100;
}

// Fully generic calculation when no pre-calculated points available
function calculateFantasyPointsGeneric(
  stats: PlayerStats[string],
  scoringSettings: Record<string, number>
): number {
  let points = 0;
  
  // Iterate all scoring settings and apply matching stats
  for (const [scoringKey, scoringValue] of Object.entries(scoringSettings)) {
    if (typeof scoringValue !== "number" || scoringValue === 0) continue;
    if (NON_STAT_KEYS.has(scoringKey)) continue;
    
    // Check if stats has a matching key
    const statValue = stats[scoringKey];
    if (typeof statValue === "number") {
      points += statValue * scoringValue;
    }
  }
  
  return Math.round(points * 100) / 100;
}

// Player data is large - we'll cache it in memory
let playersCache: Record<string, any> | null = null;
let playersCacheTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getAllPlayers(): Promise<Record<string, any>> {
  const now = Date.now();
  if (playersCache && now - playersCacheTime < CACHE_DURATION) {
    return playersCache;
  }

  const players = await fetchFromSleeper<Record<string, any>>("/players/nfl");
  if (players) {
    playersCache = players;
    playersCacheTime = now;
    return players;
  }

  return playersCache || {};
}

// Trending players - most added/dropped across all Sleeper leagues
export interface TrendingPlayer {
  player_id: string;
  count: number;
}

export async function getTrendingPlayers(type: "add" | "drop", limit: number = 25): Promise<TrendingPlayer[]> {
  const result = await fetchFromSleeper<TrendingPlayer[]>(`/players/nfl/trending/${type}?limit=${limit}`);
  return result || [];
}

export async function getPlayerById(playerId: string): Promise<any | null> {
  const players = await getAllPlayers();
  return players[playerId] || null;
}

// Helper to get Sleeper avatar URL
export function getAvatarUrl(avatarId: string | null): string | null {
  if (!avatarId) return null;
  return `https://sleepercdn.com/avatars/${avatarId}`;
}

// Calculate playoff odds based on current standings and remaining schedule
export function calculatePlayoffOdds(
  rosters: SleeperRoster[],
  playoffTeams: number,
  currentWeek: number,
  totalWeeks: number = 14
): Map<number, number> {
  const odds = new Map<number, number>();
  const sortedRosters = [...rosters].sort((a, b) => {
    const aWins = a.settings.wins;
    const bWins = b.settings.wins;
    if (aWins !== bWins) return bWins - aWins;
    const aPts = (a.settings.fpts || 0) + (a.settings.fpts_decimal || 0) / 100;
    const bPts = (b.settings.fpts || 0) + (b.settings.fpts_decimal || 0) / 100;
    return bPts - aPts;
  });

  const remainingGames = Math.max(0, totalWeeks - currentWeek);
  
  sortedRosters.forEach((roster, index) => {
    const currentRank = index + 1;
    const wins = roster.settings.wins || 0;
    const totalGames = wins + (roster.settings.losses || 0) + (roster.settings.ties || 0);
    const winRate = totalGames > 0 ? wins / totalGames : 0.5;
    
    // Base odds calculation
    let baseOdds: number;
    if (currentRank <= playoffTeams) {
      // In playoff position
      const cushion = playoffTeams - currentRank;
      baseOdds = 70 + cushion * 8 + winRate * 15;
    } else {
      // Outside playoff position
      const gamesBack = currentRank - playoffTeams;
      baseOdds = Math.max(5, 60 - gamesBack * 15 + winRate * 20);
    }

    // Adjust for remaining games
    const remainingFactor = remainingGames / totalWeeks;
    const adjustedOdds = baseOdds * (1 - remainingFactor * 0.3);
    
    odds.set(roster.roster_id, Math.min(99, Math.max(1, Math.round(adjustedOdds))));
  });

  return odds;
}

// Calculate the league median score from matchups for a given week
// Median is the average of the two middle scores
export function calculateMedianFromMatchups(matchups: SleeperMatchup[]): number {
  if (!matchups || matchups.length === 0) return 0;
  
  // Get all scores from this week
  const scores = matchups
    .map(m => m.points || 0)
    .filter(s => s > 0) // Exclude teams that haven't played yet
    .sort((a, b) => b - a); // Sort descending
  
  if (scores.length === 0) return 0;
  
  // Calculate median - average of two middle scores
  const midIndex = Math.floor(scores.length / 2);
  if (scores.length % 2 === 0) {
    // Even number of teams - average the two middle scores
    return (scores[midIndex - 1] + scores[midIndex]) / 2;
  } else {
    // Odd number of teams - just the middle score
    return scores[midIndex];
  }
}

// Get median record for a roster from matchups across multiple weeks
export interface MedianRecord {
  wins: number;
  losses: number;
  ties: number;
  weeklyResults: {
    week: number;
    score: number;
    median: number;
    result: 'W' | 'L' | 'T';
  }[];
}

export async function getMedianRecordForRoster(
  leagueId: string,
  rosterId: number,
  weeks: number[] // weeks to check
): Promise<MedianRecord> {
  const record: MedianRecord = {
    wins: 0,
    losses: 0,
    ties: 0,
    weeklyResults: []
  };
  
  for (const week of weeks) {
    const matchups = await getMatchups(leagueId, week);
    if (!matchups || matchups.length === 0) continue;
    
    const rosterMatchup = matchups.find((m: SleeperMatchup) => m.roster_id === rosterId);
    if (!rosterMatchup || !rosterMatchup.points) continue;
    
    const median = calculateMedianFromMatchups(matchups);
    const score = rosterMatchup.points;
    
    if (score > median) {
      record.wins++;
      record.weeklyResults.push({ week, score, median, result: 'W' });
    } else if (score < median) {
      record.losses++;
      record.weeklyResults.push({ week, score, median, result: 'L' });
    } else {
      record.ties++;
      record.weeklyResults.push({ week, score, median, result: 'T' });
    }
  }
  
  return record;
}
