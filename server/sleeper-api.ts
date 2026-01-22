// Sleeper API Service
// Documentation: https://docs.sleeper.app/

const SLEEPER_API_BASE = "https://api.sleeper.app/v1";

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
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

export async function getUserLeagues(userId: string, season: string = "2025"): Promise<SleeperLeague[]> {
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

export async function getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  const matchups = await fetchFromSleeper<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`);
  return matchups || [];
}

export async function getState(): Promise<{ week: number; season: string; display_week: number } | null> {
  return fetchFromSleeper<{ week: number; season: string; display_week: number }>("/state/nfl");
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
