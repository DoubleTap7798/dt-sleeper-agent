import {
  PlayerProjection,
  CorrelationMatrix,
  SimulationResult,
  SeasonSimResult,
  StandingsEntry,
  LeagueContext,
} from './types';

export function boxMullerTransform(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

export function sampleFromDistribution(projection: PlayerProjection, useLogNormal: boolean = false): number {
  const z = boxMullerTransform();
  const mean = projection.median;
  const sd = projection.stdDev;

  if (useLogNormal && mean > 0 && sd > 0) {
    const variance = sd * sd;
    const logVariance = Math.log(1 + variance / (mean * mean));
    const logMean = Math.log(mean) - logVariance / 2;
    const logStdDev = Math.sqrt(logVariance);
    return Math.max(0, Math.exp(logMean + logStdDev * z));
  }

  return Math.max(0, mean + sd * z);
}

function ensurePositiveDefinite(matrix: number[][]): number[][] {
  const n = matrix.length;
  const result = matrix.map(row => [...row]);
  const EPSILON = 1e-6;
  const SHRINKAGE = 0.1;

  let isPD = true;
  for (let i = 0; i < n; i++) {
    let diag = result[i][i];
    for (let k = 0; k < i; k++) {
      diag -= result[i][k] * result[i][k];
    }
    if (diag <= EPSILON) {
      isPD = false;
      break;
    }
  }

  if (isPD) return result;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        result[i][j] = 1;
      } else {
        result[i][j] = matrix[i][j] * (1 - SHRINKAGE);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    result[i][i] = Math.max(result[i][i], EPSILON * 10);
  }

  return result;
}

function choleskyDecomposition(matrix: number[][]): number[][] {
  const pd = ensurePositiveDefinite(matrix);
  const n = pd.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = pd[i][i] - sum;
        L[i][j] = val > 0 ? Math.sqrt(val) : 1e-6;
      } else {
        L[i][j] = L[j][j] > 1e-10 ? (pd[i][j] - sum) / L[j][j] : 0;
      }
    }
  }

  return L;
}

export function sampleCorrelated(projections: PlayerProjection[], correlationMatrix: CorrelationMatrix): number[] {
  const n = projections.length;
  if (n === 0) return [];
  if (n === 1) {
    const cv = projections[0].stdDev / (projections[0].median || 1);
    return [sampleFromDistribution(projections[0], cv > 0.5)];
  }

  const corrMatrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      return correlationMatrix.get(projections[i].playerId, projections[j].playerId);
    })
  );

  const L = choleskyDecomposition(corrMatrix);

  const independentZ: number[] = Array.from({ length: n }, () => boxMullerTransform());

  const correlatedZ: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += L[i][j] * independentZ[j];
    }
    correlatedZ[i] = sum;
  }

  return projections.map((proj, i) => {
    const mean = proj.median;
    const sd = proj.stdDev;
    const cv = sd / (mean || 1);

    if (cv > 0.5 && mean > 0 && sd > 0) {
      const variance = sd * sd;
      const logVariance = Math.log(1 + variance / (mean * mean));
      const logMean = Math.log(mean) - logVariance / 2;
      const logStdDev = Math.sqrt(logVariance);
      return Math.max(0, Math.exp(logMean + logStdDev * correlatedZ[i]));
    }

    return Math.max(0, mean + sd * correlatedZ[i]);
  });
}

function computePercentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const frac = idx - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

function computeDistribution(scores: number[]): { p25: number; p50: number; p75: number; mean: number; stdDev: number } {
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n;
  return {
    p25: Math.round(computePercentile(sorted, 25) * 100) / 100,
    p50: Math.round(computePercentile(sorted, 50) * 100) / 100,
    p75: Math.round(computePercentile(sorted, 75) * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
  };
}

function simulateTeamScore(projections: PlayerProjection[], correlationMatrix: CorrelationMatrix): number {
  if (projections.length === 0) return 0;
  const samples = sampleCorrelated(projections, correlationMatrix);
  return samples.reduce((a, b) => a + b, 0);
}

export function simulateMatchup(
  userProjections: PlayerProjection[],
  opponentProjections: PlayerProjection[],
  correlationMatrix: CorrelationMatrix,
  iterations: number = 10000
): SimulationResult {
  const userScores: number[] = new Array(iterations);
  const opponentScores: number[] = new Array(iterations);
  const margins: number[] = new Array(iterations);
  let wins = 0;

  for (let i = 0; i < iterations; i++) {
    const userScore = simulateTeamScore(userProjections, correlationMatrix);
    const oppScore = simulateTeamScore(opponentProjections, correlationMatrix);
    userScores[i] = userScore;
    opponentScores[i] = oppScore;
    margins[i] = userScore - oppScore;
    if (userScore > oppScore) wins++;
  }

  const winProbability = Math.round((wins / iterations) * 10000) / 10000;

  const expectedMargin = margins.reduce((a, b) => a + b, 0) / iterations;

  const marginVariance = margins.reduce((sum, m) => sum + (m - expectedMargin) ** 2, 0) / iterations;
  const marginStdDev = Math.sqrt(marginVariance);

  const userExpected = userScores.reduce((a, b) => a + b, 0) / iterations;
  const oppExpected = opponentScores.reduce((a, b) => a + b, 0) / iterations;
  const lowerProjectedIsUser = userExpected < oppExpected;
  const upsetProbability = lowerProjectedIsUser ? winProbability : 1 - winProbability;

  let confidenceScore: number;
  if (Math.abs(expectedMargin) < 0.001) {
    confidenceScore = 0.1;
  } else {
    confidenceScore = 1 - (2 * marginStdDev / Math.abs(expectedMargin));
  }
  confidenceScore = Math.max(0.1, Math.min(0.99, confidenceScore));

  const userMean = userScores.reduce((a, b) => a + b, 0) / iterations;
  const userStd = Math.sqrt(userScores.reduce((s, v) => s + (v - userMean) ** 2, 0) / iterations);
  const volatilityScore = userMean > 0 ? Math.round(Math.min(1, userStd / userMean) * 100) / 100 : 0.5;

  return {
    winProbability,
    expectedMargin: Math.round(expectedMargin * 100) / 100,
    marginVariance: Math.round(marginVariance * 100) / 100,
    upsetProbability: Math.round(upsetProbability * 10000) / 10000,
    confidenceScore: Math.round(confidenceScore * 10000) / 10000,
    userScoreDistribution: computeDistribution(userScores),
    opponentScoreDistribution: computeDistribution(opponentScores),
    iterations,
    volatilityScore,
  };
}

export function simulateSeason(
  standings: StandingsEntry[],
  userRosterId: number,
  remainingWeeks: number[],
  playerProjectionsByRoster: Map<number, PlayerProjection[]>,
  correlationMatrix: CorrelationMatrix,
  leagueContext: LeagueContext,
  iterations: number = 10000
): SeasonSimResult {
  const playoffSpots = leagueContext.playoffTeams;
  const finishCounts: Record<number, number> = {};
  for (let pos = 1; pos <= standings.length; pos++) {
    finishCounts[pos] = 0;
  }

  let playoffAppearances = 0;
  let championships = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalFinish = 0;

  const scheduleByRoster = new Map<number, number[]>();
  standings.forEach(s => {
    scheduleByRoster.set(s.rosterId, [...s.remainingSchedule]);
  });

  for (let iter = 0; iter < iterations; iter++) {
    const simWins = new Map<number, number>();
    const simLosses = new Map<number, number>();
    const simPoints = new Map<number, number>();

    standings.forEach(s => {
      simWins.set(s.rosterId, s.wins);
      simLosses.set(s.rosterId, s.losses);
      simPoints.set(s.rosterId, s.fpts);
    });

    for (let weekIdx = 0; weekIdx < remainingWeeks.length; weekIdx++) {
      const matchedPairs = new Set<number>();

      for (const entry of standings) {
        if (matchedPairs.has(entry.rosterId)) continue;

        const schedule = scheduleByRoster.get(entry.rosterId);
        if (!schedule || weekIdx >= schedule.length) continue;

        const opponentId = schedule[weekIdx];
        if (matchedPairs.has(opponentId)) continue;

        matchedPairs.add(entry.rosterId);
        matchedPairs.add(opponentId);

        const roster1Projs = playerProjectionsByRoster.get(entry.rosterId) || [];
        const roster2Projs = playerProjectionsByRoster.get(opponentId) || [];

        const score1 = simulateTeamScore(roster1Projs, correlationMatrix);
        const score2 = simulateTeamScore(roster2Projs, correlationMatrix);

        simPoints.set(entry.rosterId, (simPoints.get(entry.rosterId) || 0) + score1);
        simPoints.set(opponentId, (simPoints.get(opponentId) || 0) + score2);

        if (score1 > score2) {
          simWins.set(entry.rosterId, (simWins.get(entry.rosterId) || 0) + 1);
          simLosses.set(opponentId, (simLosses.get(opponentId) || 0) + 1);
        } else if (score2 > score1) {
          simWins.set(opponentId, (simWins.get(opponentId) || 0) + 1);
          simLosses.set(entry.rosterId, (simLosses.get(entry.rosterId) || 0) + 1);
        } else {
          simWins.set(entry.rosterId, (simWins.get(entry.rosterId) || 0) + 1);
          simLosses.set(opponentId, (simLosses.get(opponentId) || 0) + 1);
        }
      }
    }

    const finalStandings = standings.map(s => ({
      rosterId: s.rosterId,
      wins: simWins.get(s.rosterId) || 0,
      losses: simLosses.get(s.rosterId) || 0,
      points: simPoints.get(s.rosterId) || 0,
    }));

    finalStandings.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      return b.points - a.points;
    });

    const userFinishIdx = finalStandings.findIndex(s => s.rosterId === userRosterId);
    const userFinish = userFinishIdx + 1;
    totalFinish += userFinish;
    finishCounts[userFinish] = (finishCounts[userFinish] || 0) + 1;

    const userRecord = finalStandings.find(s => s.rosterId === userRosterId);
    if (userRecord) {
      totalWins += userRecord.wins;
      totalLosses += userRecord.losses;
    }

    const madePlayoffs = userFinish <= playoffSpots;
    if (madePlayoffs) {
      playoffAppearances++;

      const playoffTeams = finalStandings.slice(0, playoffSpots).map(s => s.rosterId);
      let bracket = [...playoffTeams];

      while (bracket.length > 1) {
        const nextRound: number[] = [];
        for (let m = 0; m < bracket.length; m += 2) {
          if (m + 1 >= bracket.length) {
            nextRound.push(bracket[m]);
            continue;
          }

          const team1Projs = playerProjectionsByRoster.get(bracket[m]) || [];
          const team2Projs = playerProjectionsByRoster.get(bracket[m + 1]) || [];

          const s1 = simulateTeamScore(team1Projs, correlationMatrix);
          const s2 = simulateTeamScore(team2Projs, correlationMatrix);

          nextRound.push(s1 >= s2 ? bracket[m] : bracket[m + 1]);
        }
        bracket = nextRound;
      }

      if (bracket[0] === userRosterId) {
        championships++;
      }
    }
  }

  const playoffProbability = Math.round((playoffAppearances / iterations) * 10000) / 10000;
  const championshipProbability = Math.round((championships / iterations) * 10000) / 10000;
  const expectedWins = Math.round((totalWins / iterations) * 100) / 100;
  const expectedLosses = Math.round((totalLosses / iterations) * 100) / 100;
  const expectedFinish = Math.round((totalFinish / iterations) * 100) / 100;

  const finishDistribution: Record<number, number> = {};
  for (const [pos, count] of Object.entries(finishCounts)) {
    finishDistribution[Number(pos)] = Math.round((count / iterations) * 10000) / 10000;
  }

  const expectedMarginProxy = Math.abs(playoffProbability - 0.5) * 2;
  let confidenceScore: number;
  if (expectedMarginProxy < 0.001) {
    confidenceScore = 0.1;
  } else {
    confidenceScore = Math.min(0.99, Math.max(0.1, 0.5 + expectedMarginProxy * 0.49));
  }

  return {
    playoffProbability,
    championshipProbability,
    expectedWins,
    expectedLosses,
    expectedFinish,
    finishDistribution,
    confidenceScore: Math.round(confidenceScore * 10000) / 10000,
    iterations,
  };
}
