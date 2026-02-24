export interface PlayerProjection {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  median: number;
  floor: number;
  ceiling: number;
  stdDev: number;
  variance: number;
  gamesPlayed: number;
  weeklyScores: number[];
  injuryStatus: string | null;
  byeWeek: number | null;
}

export interface CorrelationEntry {
  player1Id: string;
  player2Id: string;
  correlation: number;
  sampleSize: number;
  type: 'qb_wr' | 'qb_te' | 'qb_rb' | 'rb_def' | 'same_team' | 'same_team_wr' | 'opp_def' | 'game_stack' | 'general';
}

export interface CorrelationMatrix {
  entries: CorrelationEntry[];
  get(p1: string, p2: string): number;
}

export interface LeagueContext {
  leagueId: string;
  leagueName: string;
  scoringSettings: Record<string, number>;
  rosterPositions: string[];
  totalRosters: number;
  playoffTeams: number;
  playoffWeekStart: number;
  currentWeek: number;
  totalRegularSeasonWeeks: number;
  waiverBudget: number;
  leagueType: number;
  season: string;
}

export interface RosterContext {
  rosterId: number;
  ownerId: string;
  players: string[];
  starters: string[];
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fptsAgainst: number;
  rank: number;
  faabRemaining: number;
  waiverPosition: number;
}

export interface MatchupContext {
  week: number;
  userRoster: RosterContext;
  opponentRoster: RosterContext;
  userProjections: PlayerProjection[];
  opponentProjections: PlayerProjection[];
}

export interface StandingsEntry {
  rosterId: number;
  ownerId: string;
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  rank: number;
  remainingSchedule: number[];
}

export interface SimulationResult {
  winProbability: number;
  expectedMargin: number;
  marginVariance: number;
  upsetProbability: number;
  confidenceScore: number;
  volatilityScore: number;
  userScoreDistribution: { p25: number; p50: number; p75: number; mean: number; stdDev: number };
  opponentScoreDistribution: { p25: number; p50: number; p75: number; mean: number; stdDev: number };
  iterations: number;
}

export interface SeasonSimResult {
  playoffProbability: number;
  championshipProbability: number;
  expectedWins: number;
  expectedLosses: number;
  expectedFinish: number;
  finishDistribution: Record<number, number>;
  confidenceScore: number;
  iterations: number;
}

export interface TradeEvalResult {
  rosPointDelta: number;
  playoffWeightedDelta: number;
  championshipProbabilityDelta: number;
  riskChangeScore: number;
  positionalScarcityDelta: number;
  injuryRiskDelta: number;
  varianceDelta: number;
  confidence: number;
  givePlayers: { id: string; name: string; projectedROS: number }[];
  getPlayers: { id: string; name: string; projectedROS: number }[];
}

export interface FAABResult {
  playerId: string;
  playerName: string;
  minimumViableBid: number;
  optimalBid: number;
  probabilityToWin: number;
  expectedSeasonalValueGain: number;
  aggressionScore: number;
  teamNeedScore: number;
  playoffScheduleValue: number;
}

export type RiskClassification = 'conservative' | 'balanced' | 'aggressive' | 'chaos';

export interface UserRiskProfile {
  classification: RiskClassification;
  lineupVolatility: number;
  tradeAggressiveness: number;
  faabAggression: number;
  underdogTendency: number;
  scores: {
    conservative: number;
    balanced: number;
    aggressive: number;
    chaos: number;
  };
}

export interface PortfolioAnalysis {
  diversificationScore: number;
  fragilityScore: number;
  volatilityScore: number;
  playoffLeverageScore: number;
  teamConcentration: Record<string, number>;
  positionalDepth: Record<string, number>;
  boomBustClustering: number;
  injuryFragilityIndex: number;
  recommendation: string;
}

export interface ChampionshipPath {
  currentChampionshipOdds: number;
  projectedChampionshipOdds: number;
  delta: number;
  keyMoves: {
    description: string;
    oddsChange: number;
    evDelta: number;
    confidence: number;
  }[];
  weekByWeekOutlook: {
    week: number;
    winProbability: number;
    cumulativePlayoffOdds: number;
  }[];
}

export interface PositionalScarcity {
  position: string;
  leagueAvgPoints: number;
  replacementLevel: number;
  vor: number;
  scarcityIndex: number;
}

export interface DecisionMetrics {
  evDelta: number;
  winProbabilityShift: number;
  playoffProbabilityShift: number;
  championshipProbabilityShift: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'strong_yes' | 'lean_yes' | 'neutral' | 'lean_no' | 'strong_no';
}
