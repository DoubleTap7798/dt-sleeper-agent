// Sleeper API Types

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
    type: number; // 0 = redraft, 1 = keeper, 2 = dynasty
  };
  status: string;
  avatar: string | null;
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

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
  age: number | null;
  years_exp: number;
  fantasy_positions: string[];
  status: string;
  injury_status: string | null;
  number: number | null;
  depth_chart_position: string | null;
  search_rank: number | null;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters_points: number[];
  starters: string[];
  players_points: Record<string, number>;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: 'trade' | 'waiver' | 'free_agent';
  status: string;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: SleeperDraftPick[];
  waiver_budget: SleeperWaiverBudget[];
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

export interface SleeperWaiverBudget {
  sender: number;
  receiver: number;
  amount: number;
}

export interface SleeperPlayoffBracket {
  r: number; // round
  m: number; // match id
  t1: number | null; // team 1 roster_id
  t2: number | null; // team 2 roster_id
  w: number | null; // winner roster_id
  l: number | null; // loser roster_id
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

// KTC (Keep Trade Cut) Value Types
export interface KTCPlayer {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  value: number;
  age: number;
  trend: number;
  isRookie?: boolean;
  isDevy?: boolean;
}

export interface KTCDraftPick {
  season: string;
  round: number;
  value: number;
}

// Trade Calculator Types
export interface TradeAsset {
  id: string;
  name: string;
  type: 'player' | 'pick';
  position?: string;
  team?: string;
  value: number;
}

export interface TradeSide {
  teamId: string;
  teamName: string;
  assets: TradeAsset[];
  totalValue: number;
}

export interface TradeAnalysisResult {
  teamA: TradeSide;
  teamB: TradeSide;
  difference: number;
  percentageDiff: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'F';
  winner: 'A' | 'B' | 'even';
  aiAnalysis?: string;
}

// Standings Types
export interface StandingsTeam {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  maxPoints: number;
  winPercentage: number;
  playoffOdds?: number;
}

// Trophy Room Types
export interface LeagueChampion {
  season: string;
  rosterId: number;
  ownerName: string;
  avatar: string | null;
}

export interface AllTimeRecord {
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalPointsFor: number;
  totalMaxPoints?: number;
  championships: number;
  winPercentage: number;
}

export interface SeasonRecord {
  ownerName: string;
  avatar: string | null;
  season: string;
  value: number;
  record?: string;
}
