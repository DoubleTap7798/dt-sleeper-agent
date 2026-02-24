import {
  TradeEvalResult,
  LeagueContext,
  RosterContext,
  StandingsEntry,
  PlayerProjection,
  CorrelationMatrix,
  PositionalScarcity,
} from './types';
import { simulateSeason } from './monte-carlo';

function findProjection(
  playerId: string,
  playerProjectionsByRoster: Map<number, PlayerProjection[]>,
  allPlayers: Record<string, any>
): PlayerProjection | null {
  const entries = Array.from(playerProjectionsByRoster.values());
  for (let i = 0; i < entries.length; i++) {
    const found = entries[i].find(p => p.playerId === playerId);
    if (found) return found;
  }

  const info = allPlayers[playerId];
  if (!info) return null;

  return {
    playerId,
    playerName: `${info.first_name || ''} ${info.last_name || ''}`.trim(),
    position: info.position || 'UNKNOWN',
    team: info.team || 'FA',
    median: 0,
    floor: 0,
    ceiling: 0,
    stdDev: 5.0,
    variance: 25.0,
    gamesPlayed: 0,
    weeklyScores: [],
    injuryStatus: info.injury_status || null,
    byeWeek: info.bye_week || null,
  };
}

function computeROSPointDelta(
  giveProjections: PlayerProjection[],
  getProjections: PlayerProjection[],
  leagueContext: LeagueContext
): number {
  const { currentWeek, totalRegularSeasonWeeks, playoffWeekStart } = leagueContext;
  const lastWeek = Math.max(totalRegularSeasonWeeks, playoffWeekStart + 2);
  let delta = 0;

  for (let week = currentWeek; week <= lastWeek; week++) {
    const weeksFromNow = week - currentWeek;
    const weight = 1.0 + 0.05 * weeksFromNow;

    const getSum = getProjections.reduce((sum, p) => {
      if (p.byeWeek === week) return sum;
      return sum + p.median;
    }, 0);

    const giveSum = giveProjections.reduce((sum, p) => {
      if (p.byeWeek === week) return sum;
      return sum + p.median;
    }, 0);

    delta += (getSum - giveSum) * weight;
  }

  return Math.round(delta * 100) / 100;
}

function computePlayoffWeightedDelta(
  giveProjections: PlayerProjection[],
  getProjections: PlayerProjection[],
  leagueContext: LeagueContext
): number {
  const { currentWeek, playoffWeekStart } = leagueContext;
  const playoffEnd = playoffWeekStart + 2;
  let delta = 0;

  for (let week = currentWeek; week <= playoffEnd; week++) {
    const isPlayoff = week >= 15 && week <= 17;
    const weight = isPlayoff ? 2.0 : 1.0;

    const getSum = getProjections.reduce((sum, p) => {
      if (p.byeWeek === week) return sum;
      return sum + p.median;
    }, 0);

    const giveSum = giveProjections.reduce((sum, p) => {
      if (p.byeWeek === week) return sum;
      return sum + p.median;
    }, 0);

    delta += (getSum - giveSum) * weight;
  }

  return Math.round(delta * 100) / 100;
}

function computeChampionshipProbabilityDelta(
  givePlayerIds: string[],
  getPlayerIds: string[],
  userRoster: RosterContext,
  standings: StandingsEntry[],
  playerProjectionsByRoster: Map<number, PlayerProjection[]>,
  correlationMatrix: CorrelationMatrix,
  leagueContext: LeagueContext
): number {
  const { currentWeek, totalRegularSeasonWeeks } = leagueContext;
  const remainingWeeks: number[] = [];
  for (let w = currentWeek; w <= totalRegularSeasonWeeks; w++) {
    remainingWeeks.push(w);
  }

  if (remainingWeeks.length === 0) return 0;

  const currentResult = simulateSeason(
    standings,
    userRoster.rosterId,
    remainingWeeks,
    playerProjectionsByRoster,
    correlationMatrix,
    leagueContext,
    2000
  );

  const giveSet = new Set(givePlayerIds);
  const currentProjections = playerProjectionsByRoster.get(userRoster.rosterId) || [];

  const hypotheticalProjections = currentProjections.filter(p => !giveSet.has(p.playerId));

  const getProjections: PlayerProjection[] = [];
  const allRosterProjections = Array.from(playerProjectionsByRoster.values());
  for (let i = 0; i < allRosterProjections.length; i++) {
    const projections = allRosterProjections[i];
    for (let j = 0; j < projections.length; j++) {
      if (getPlayerIds.includes(projections[j].playerId)) {
        getProjections.push(projections[j]);
      }
    }
  }
  hypotheticalProjections.push(...getProjections);

  const hypotheticalMap = new Map(playerProjectionsByRoster);
  hypotheticalMap.set(userRoster.rosterId, hypotheticalProjections);

  const hypotheticalResult = simulateSeason(
    standings,
    userRoster.rosterId,
    remainingWeeks,
    hypotheticalMap,
    correlationMatrix,
    leagueContext,
    2000
  );

  const delta = hypotheticalResult.championshipProbability - currentResult.championshipProbability;
  return Math.round(delta * 10000) / 10000;
}

function computePositionalScarcityDelta(
  giveProjections: PlayerProjection[],
  getProjections: PlayerProjection[],
  scarcity: PositionalScarcity[]
): number {
  const scarcityMap = new Map<string, number>();
  scarcity.forEach(s => scarcityMap.set(s.position, s.scarcityIndex));

  let giveScarcity = 0;
  for (const p of giveProjections) {
    const idx = scarcityMap.get(p.position) || 0;
    giveScarcity += idx * p.median;
  }

  let getScarcity = 0;
  for (const p of getProjections) {
    const idx = scarcityMap.get(p.position) || 0;
    getScarcity += idx * p.median;
  }

  const delta = getScarcity - giveScarcity;
  return Math.round(delta * 100) / 100;
}

function computeInjuryRiskDelta(
  giveProjections: PlayerProjection[],
  getProjections: PlayerProjection[]
): number {
  const riskScore = (status: string | null): number => {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s === 'out' || s === 'ir') return 1.0;
    if (s === 'doubtful') return 0.8;
    if (s === 'questionable') return 0.5;
    if (s === 'probable') return 0.1;
    return 0;
  };

  const giveRisk = giveProjections.length > 0
    ? giveProjections.reduce((sum, p) => sum + riskScore(p.injuryStatus), 0) / giveProjections.length
    : 0;

  const getRisk = getProjections.length > 0
    ? getProjections.reduce((sum, p) => sum + riskScore(p.injuryStatus), 0) / getProjections.length
    : 0;

  const delta = getRisk - giveRisk;
  return Math.round(Math.max(-1, Math.min(1, delta)) * 100) / 100;
}

function computeVarianceDelta(
  giveProjections: PlayerProjection[],
  getProjections: PlayerProjection[]
): number {
  const giveVariance = giveProjections.reduce((sum, p) => sum + p.variance, 0);
  const getVariance = getProjections.reduce((sum, p) => sum + p.variance, 0);
  return Math.round((getVariance - giveVariance) * 100) / 100;
}

function computeConfidence(
  giveProjections: PlayerProjection[],
  getProjections: PlayerProjection[],
  rosPointDelta: number
): number {
  const allProjections = [...giveProjections, ...getProjections];
  if (allProjections.length === 0) return 0.1;

  const minGames = Math.min(...allProjections.map(p => p.gamesPlayed));
  const avgGames = allProjections.reduce((s, p) => s + p.gamesPlayed, 0) / allProjections.length;

  let sampleConfidence: number;
  if (minGames >= 8) {
    sampleConfidence = 0.9;
  } else if (minGames >= 4) {
    sampleConfidence = 0.5 + (minGames - 4) * 0.1;
  } else {
    sampleConfidence = 0.2 + minGames * 0.075;
  }

  const totalMedian = allProjections.reduce((s, p) => s + p.median, 0);
  const separationRatio = totalMedian > 0 ? Math.abs(rosPointDelta) / totalMedian : 0;
  const separationBonus = Math.min(0.1, separationRatio * 0.5);

  const avgGamesBonus = Math.min(0.1, (avgGames / 16) * 0.1);

  const confidence = Math.max(0.1, Math.min(0.99, sampleConfidence + separationBonus + avgGamesBonus));
  return Math.round(confidence * 100) / 100;
}

export function evaluateTrade(
  givePlayerIds: string[],
  getPlayerIds: string[],
  leagueContext: LeagueContext,
  userRoster: RosterContext,
  allRosters: RosterContext[],
  standings: StandingsEntry[],
  playerProjectionsByRoster: Map<number, PlayerProjection[]>,
  correlationMatrix: CorrelationMatrix,
  allPlayers: Record<string, any>,
  scarcity: PositionalScarcity[]
): TradeEvalResult {
  const giveProjections: PlayerProjection[] = givePlayerIds
    .map(id => findProjection(id, playerProjectionsByRoster, allPlayers))
    .filter((p): p is PlayerProjection => p !== null);

  const getProjections: PlayerProjection[] = getPlayerIds
    .map(id => findProjection(id, playerProjectionsByRoster, allPlayers))
    .filter((p): p is PlayerProjection => p !== null);

  const rosPointDelta = computeROSPointDelta(giveProjections, getProjections, leagueContext);

  const playoffWeightedDelta = computePlayoffWeightedDelta(giveProjections, getProjections, leagueContext);

  const championshipProbabilityDelta = computeChampionshipProbabilityDelta(
    givePlayerIds,
    getPlayerIds,
    userRoster,
    standings,
    playerProjectionsByRoster,
    correlationMatrix,
    leagueContext
  );

  const positionalScarcityDelta = computePositionalScarcityDelta(giveProjections, getProjections, scarcity);

  const injuryRiskDelta = computeInjuryRiskDelta(giveProjections, getProjections);

  const varianceDelta = computeVarianceDelta(giveProjections, getProjections);

  const confidence = computeConfidence(giveProjections, getProjections, rosPointDelta);

  const totalGiveVariance = giveProjections.reduce((s, p) => s + p.variance, 0);
  const totalGetVariance = getProjections.reduce((s, p) => s + p.variance, 0);
  const avgVariance = (totalGiveVariance + totalGetVariance) / 2 || 1;
  const riskChangeScore = Math.round(((totalGetVariance - totalGiveVariance) / avgVariance) * 100) / 100;

  const givePlayers = giveProjections.map(p => ({
    id: p.playerId,
    name: p.playerName,
    projectedROS: Math.round(p.median * (leagueContext.totalRegularSeasonWeeks - leagueContext.currentWeek + 1) * 100) / 100,
  }));

  const getPlayers = getProjections.map(p => ({
    id: p.playerId,
    name: p.playerName,
    projectedROS: Math.round(p.median * (leagueContext.totalRegularSeasonWeeks - leagueContext.currentWeek + 1) * 100) / 100,
  }));

  return {
    rosPointDelta,
    playoffWeightedDelta,
    championshipProbabilityDelta,
    riskChangeScore,
    positionalScarcityDelta,
    injuryRiskDelta,
    varianceDelta,
    confidence,
    givePlayers,
    getPlayers,
  };
}
