import { simulateSeason } from './monte-carlo';
import {
  StandingsEntry,
  PlayerProjection,
  CorrelationMatrix,
  LeagueContext,
  ChampionshipPath,
} from './types';

export function computeChampionshipPath(
  userRosterId: number,
  standings: StandingsEntry[],
  playerProjectionsByRoster: Map<number, PlayerProjection[]>,
  correlationMatrix: CorrelationMatrix,
  leagueContext: LeagueContext,
  iterations: number = 10000
): ChampionshipPath {
  const { currentWeek, totalRegularSeasonWeeks } = leagueContext;

  const remainingWeeks: number[] = [];
  for (let w = currentWeek; w <= totalRegularSeasonWeeks; w++) {
    remainingWeeks.push(w);
  }

  const baselineResult = simulateSeason(
    standings,
    userRosterId,
    remainingWeeks,
    playerProjectionsByRoster,
    correlationMatrix,
    leagueContext,
    iterations
  );

  const currentChampionshipOdds = baselineResult.championshipProbability;

  const weekByWeekOutlook = computeWeekByWeekOutlook(
    userRosterId,
    standings,
    playerProjectionsByRoster,
    correlationMatrix,
    leagueContext,
    remainingWeeks,
    iterations
  );

  const keyMoves = computeKeyMoves(
    userRosterId,
    standings,
    playerProjectionsByRoster,
    correlationMatrix,
    leagueContext,
    remainingWeeks,
    iterations
  );

  const avgKeyMoveUpside = keyMoves.length > 0
    ? keyMoves.reduce((sum, m) => sum + Math.max(0, m.oddsChange), 0) / keyMoves.length
    : 0;
  const projectedChampionshipOdds = currentChampionshipOdds + avgKeyMoveUpside * 0.5;
  const delta = projectedChampionshipOdds - currentChampionshipOdds;

  return {
    currentChampionshipOdds: Math.round(currentChampionshipOdds * 10000) / 10000,
    projectedChampionshipOdds: Math.round(projectedChampionshipOdds * 10000) / 10000,
    delta: Math.round(delta * 10000) / 10000,
    keyMoves,
    weekByWeekOutlook,
  };
}

function computeWeekByWeekOutlook(
  userRosterId: number,
  standings: StandingsEntry[],
  playerProjectionsByRoster: Map<number, PlayerProjection[]>,
  correlationMatrix: CorrelationMatrix,
  leagueContext: LeagueContext,
  remainingWeeks: number[],
  iterations: number
): { week: number; winProbability: number; cumulativePlayoffOdds: number }[] {
  const outlook: { week: number; winProbability: number; cumulativePlayoffOdds: number }[] = [];

  const userStanding = standings.find(s => s.rosterId === userRosterId);
  if (!userStanding) return outlook;

  const userProjs = playerProjectionsByRoster.get(userRosterId) || [];
  const userTotal = userProjs.reduce((sum, p) => sum + p.median, 0);

  for (let i = 0; i < remainingWeeks.length; i++) {
    const week = remainingWeeks[i];

    const opponentId = i < userStanding.remainingSchedule.length
      ? userStanding.remainingSchedule[i]
      : 0;

    let winProbability = 0.5;
    if (opponentId > 0) {
      const oppProjs = playerProjectionsByRoster.get(opponentId) || [];
      const oppTotal = oppProjs.reduce((sum, p) => sum + p.median, 0);

      if (userTotal + oppTotal > 0) {
        const diff = userTotal - oppTotal;
        const combinedStdDev = Math.sqrt(
          userProjs.reduce((sum, p) => sum + p.stdDev * p.stdDev, 0) +
          oppProjs.reduce((sum, p) => sum + p.stdDev * p.stdDev, 0)
        );
        if (combinedStdDev > 0) {
          const zScore = diff / combinedStdDev;
          winProbability = normalCDF(zScore);
        } else {
          winProbability = diff > 0 ? 0.75 : diff < 0 ? 0.25 : 0.5;
        }
      }
    }

    const weeksFromNow = remainingWeeks.slice(i);
    const partialResult = simulateSeason(
      standings,
      userRosterId,
      weeksFromNow,
      playerProjectionsByRoster,
      correlationMatrix,
      leagueContext,
      Math.max(500, Math.floor(iterations / 3))
    );

    outlook.push({
      week,
      winProbability: Math.round(winProbability * 10000) / 10000,
      cumulativePlayoffOdds: Math.round(partialResult.playoffProbability * 10000) / 10000,
    });
  }

  return outlook;
}

function computeKeyMoves(
  userRosterId: number,
  standings: StandingsEntry[],
  playerProjectionsByRoster: Map<number, PlayerProjection[]>,
  correlationMatrix: CorrelationMatrix,
  leagueContext: LeagueContext,
  remainingWeeks: number[],
  iterations: number
): { description: string; oddsChange: number; evDelta: number; confidence: number }[] {
  const weekImpacts: { week: number; impact: number; winOdds: number; lossOdds: number }[] = [];
  const reducedIterations = Math.max(500, Math.floor(iterations / 4));

  const userStanding = standings.find(s => s.rosterId === userRosterId);
  if (!userStanding) return [];

  for (let i = 0; i < Math.min(remainingWeeks.length, 6); i++) {
    const week = remainingWeeks[i];

    const winStandings = standings.map(s => {
      if (s.rosterId === userRosterId) {
        return { ...s, wins: s.wins + 1 };
      }
      const opponentId = i < userStanding.remainingSchedule.length
        ? userStanding.remainingSchedule[i]
        : 0;
      if (s.rosterId === opponentId) {
        return { ...s, losses: s.losses + 1 };
      }
      return { ...s };
    });

    const lossStandings = standings.map(s => {
      if (s.rosterId === userRosterId) {
        return { ...s, losses: s.losses + 1 };
      }
      const opponentId = i < userStanding.remainingSchedule.length
        ? userStanding.remainingSchedule[i]
        : 0;
      if (s.rosterId === opponentId) {
        return { ...s, wins: s.wins + 1 };
      }
      return { ...s };
    });

    const futureWeeks = remainingWeeks.slice(i + 1);

    const winResult = simulateSeason(
      winStandings,
      userRosterId,
      futureWeeks,
      playerProjectionsByRoster,
      correlationMatrix,
      leagueContext,
      reducedIterations
    );

    const lossResult = simulateSeason(
      lossStandings,
      userRosterId,
      futureWeeks,
      playerProjectionsByRoster,
      correlationMatrix,
      leagueContext,
      reducedIterations
    );

    const impact = winResult.championshipProbability - lossResult.championshipProbability;

    weekImpacts.push({
      week,
      impact: Math.abs(impact),
      winOdds: winResult.championshipProbability,
      lossOdds: lossResult.championshipProbability,
    });
  }

  weekImpacts.sort((a, b) => b.impact - a.impact);

  return weekImpacts.slice(0, 3).map(wi => {
    const oddsChange = wi.winOdds - wi.lossOdds;
    const confidence = Math.min(0.95, Math.max(0.3, 0.5 + wi.impact * 2));

    return {
      description: `Week ${wi.week}: Win vs Loss swing`,
      oddsChange: Math.round(oddsChange * 10000) / 10000,
      evDelta: Math.round(wi.impact * 10000) / 10000,
      confidence: Math.round(confidence * 1000) / 1000,
    };
  });
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

export function computeChampionshipDelta(
  userRosterId: number,
  currentProjections: Map<number, PlayerProjection[]>,
  hypotheticalProjections: Map<number, PlayerProjection[]>,
  standings: StandingsEntry[],
  correlationMatrix: CorrelationMatrix,
  leagueContext: LeagueContext,
  iterations: number = 10000
): { currentOdds: number; newOdds: number; delta: number } {
  const { currentWeek, totalRegularSeasonWeeks } = leagueContext;

  const remainingWeeks: number[] = [];
  for (let w = currentWeek; w <= totalRegularSeasonWeeks; w++) {
    remainingWeeks.push(w);
  }

  const currentResult = simulateSeason(
    standings,
    userRosterId,
    remainingWeeks,
    currentProjections,
    correlationMatrix,
    leagueContext,
    iterations
  );

  const hypotheticalResult = simulateSeason(
    standings,
    userRosterId,
    remainingWeeks,
    hypotheticalProjections,
    correlationMatrix,
    leagueContext,
    iterations
  );

  const currentOdds = currentResult.championshipProbability;
  const newOdds = hypotheticalResult.championshipProbability;

  return {
    currentOdds: Math.round(currentOdds * 10000) / 10000,
    newOdds: Math.round(newOdds * 10000) / 10000,
    delta: Math.round((newOdds - currentOdds) * 10000) / 10000,
  };
}
