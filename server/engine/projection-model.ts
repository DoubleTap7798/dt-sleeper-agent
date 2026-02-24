import { PlayerProjection, CorrelationMatrix, CorrelationEntry } from './types';

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (x[i] !== undefined && y[i] !== undefined && !isNaN(x[i]) && !isNaN(y[i])) {
      pairs.push([x[i], y[i]]);
    }
  }

  if (pairs.length < 2) return 0;

  const meanX = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const [xi, yi] of pairs) {
    const dx = xi - meanX;
    const dy = yi - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  if (denom === 0) return 0;

  return Math.max(-1, Math.min(1, sumXY / denom));
}

export function computePlayerDistribution(scores: number[]): {
  median: number;
  floor: number;
  ceiling: number;
  mean: number;
  stdDev: number;
  variance: number;
  skewness: number;
  coefficientOfVariation: number;
  sampleSize: number;
} {
  const n = scores.length;
  if (n === 0) {
    return { median: 0, floor: 0, ceiling: 0, mean: 0, stdDev: 0, variance: 0, skewness: 0, coefficientOfVariation: 0, sampleSize: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / n;

  const getPercentile = (p: number): number => {
    const idx = (p / 100) * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    const frac = idx - lower;
    return sorted[lower] * (1 - frac) + sorted[upper] * frac;
  };

  const median = getPercentile(50);
  const floor = getPercentile(25);
  const ceiling = getPercentile(75);

  let sumSqDiff = 0;
  let sumCubeDiff = 0;
  for (const s of scores) {
    const diff = s - mean;
    sumSqDiff += diff * diff;
    sumCubeDiff += diff * diff * diff;
  }

  const variance = n > 1 ? sumSqDiff / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  let skewness = 0;
  if (n >= 3 && stdDev > 0) {
    const populationStdDev = Math.sqrt(sumSqDiff / n);
    const m3 = sumCubeDiff / n;
    skewness = (n / ((n - 1) * (n - 2))) * (sumCubeDiff / (populationStdDev * populationStdDev * populationStdDev)) * (n > 2 ? 1 : 0);
    if (!isFinite(skewness)) skewness = 0;
  }

  const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 0;

  return {
    median: Math.round(median * 100) / 100,
    floor: Math.round(floor * 100) / 100,
    ceiling: Math.round(ceiling * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    skewness: Math.round(skewness * 100) / 100,
    coefficientOfVariation: Math.round(coefficientOfVariation * 100) / 100,
    sampleSize: n,
  };
}

export function getDefaultCorrelations(): Map<string, number> {
  const defaults = new Map<string, number>();
  defaults.set('qb_wr', 0.4);
  defaults.set('qb_te', 0.3);
  defaults.set('qb_rb', 0.15);
  defaults.set('rb_def', -0.1);
  defaults.set('same_team', 0.05);
  defaults.set('opp_def', -0.15);
  defaults.set('general', 0.0);
  return defaults;
}

function classifyCorrelationType(
  p1: PlayerProjection,
  p2: PlayerProjection,
  allPlayers: Record<string, any>
): CorrelationEntry['type'] {
  const pos1 = p1.position.toUpperCase();
  const pos2 = p2.position.toUpperCase();
  const sameTeam = p1.team === p2.team && p1.team !== 'FA' && p1.team !== '';

  if (sameTeam) {
    if ((pos1 === 'QB' && pos2 === 'WR') || (pos1 === 'WR' && pos2 === 'QB')) return 'qb_wr';
    if ((pos1 === 'QB' && pos2 === 'TE') || (pos1 === 'TE' && pos2 === 'QB')) return 'qb_te';
    if ((pos1 === 'QB' && pos2 === 'RB') || (pos1 === 'RB' && pos2 === 'QB')) return 'qb_rb';
    return 'same_team';
  }

  if ((pos1 === 'DEF' || pos2 === 'DEF') && p1.team !== p2.team) {
    const nonDef = pos1 === 'DEF' ? p2 : p1;
    const defPlayer = pos1 === 'DEF' ? p1 : p2;
    const nonDefInfo = allPlayers[nonDef.playerId];
    const defInfo = allPlayers[defPlayer.playerId];

    if (nonDef.position === 'RB') return 'rb_def';
    return 'opp_def';
  }

  return 'general';
}

export function buildCorrelationMatrix(
  playerProjections: PlayerProjection[],
  allPlayers: Record<string, any>
): CorrelationMatrix {
  const entries: CorrelationEntry[] = [];
  const correlationMap = new Map<string, number>();
  const defaults = getDefaultCorrelations();

  for (let i = 0; i < playerProjections.length; i++) {
    for (let j = i + 1; j < playerProjections.length; j++) {
      const p1 = playerProjections[i];
      const p2 = playerProjections[j];

      const type = classifyCorrelationType(p1, p2, allPlayers);
      if (type === 'general') continue;

      const minLen = Math.min(p1.weeklyScores.length, p2.weeklyScores.length);
      let correlation: number;
      let sampleSize: number;

      if (minLen >= 4) {
        const x = p1.weeklyScores.slice(0, minLen);
        const y = p2.weeklyScores.slice(0, minLen);
        correlation = pearsonCorrelation(x, y);
        sampleSize = minLen;
      } else {
        correlation = defaults.get(type) || 0;
        sampleSize = minLen;
      }

      const key = [p1.playerId, p2.playerId].sort().join(':');
      correlationMap.set(key, correlation);

      entries.push({
        player1Id: p1.playerId,
        player2Id: p2.playerId,
        correlation: Math.round(correlation * 1000) / 1000,
        sampleSize,
        type,
      });
    }
  }

  return {
    entries,
    get(p1: string, p2: string): number {
      if (p1 === p2) return 1;
      const key = [p1, p2].sort().join(':');
      return correlationMap.get(key) || 0;
    },
  };
}

export function computePositionalBaselines(position: string): {
  avgMedian: number;
  avgStdDev: number;
  avgFloor: number;
  avgCeiling: number;
  volatilityMultiplier: number;
} {
  const baselines: Record<string, { avgMedian: number; avgStdDev: number; avgFloor: number; avgCeiling: number; volatilityMultiplier: number }> = {
    QB: { avgMedian: 18, avgStdDev: 6, avgFloor: 12, avgCeiling: 24, volatilityMultiplier: 0.8 },
    RB: { avgMedian: 12, avgStdDev: 7, avgFloor: 5, avgCeiling: 19, volatilityMultiplier: 1.2 },
    WR: { avgMedian: 11, avgStdDev: 6.5, avgFloor: 4.5, avgCeiling: 17.5, volatilityMultiplier: 1.1 },
    TE: { avgMedian: 8, avgStdDev: 5.5, avgFloor: 2.5, avgCeiling: 13.5, volatilityMultiplier: 1.3 },
    K: { avgMedian: 8, avgStdDev: 3.5, avgFloor: 4.5, avgCeiling: 11.5, volatilityMultiplier: 0.7 },
    DEF: { avgMedian: 7, avgStdDev: 5, avgFloor: 2, avgCeiling: 12, volatilityMultiplier: 1.0 },
  };

  const pos = position.toUpperCase();
  return baselines[pos] || { avgMedian: 8, avgStdDev: 5, avgFloor: 3, avgCeiling: 13, volatilityMultiplier: 1.0 };
}

export function computeVolatilityScore(projection: PlayerProjection): number {
  if (projection.weeklyScores.length < 2) {
    const baselines = computePositionalBaselines(projection.position);
    return Math.min(1, Math.max(0, baselines.volatilityMultiplier * 0.5));
  }

  const dist = computePlayerDistribution(projection.weeklyScores);
  const baselines = computePositionalBaselines(projection.position);

  const cvRatio = baselines.avgMedian > 0
    ? dist.coefficientOfVariation / (baselines.avgStdDev / baselines.avgMedian)
    : dist.coefficientOfVariation;

  const cvScore = Math.min(1, cvRatio * 0.4);

  const iqr = dist.ceiling - dist.floor;
  const expectedIqr = baselines.avgCeiling - baselines.avgFloor;
  const iqrRatio = expectedIqr > 0 ? iqr / expectedIqr : 1;
  const iqrScore = Math.min(1, iqrRatio * 0.3);

  const skewnessScore = Math.min(1, Math.abs(dist.skewness) * 0.15);

  const logNormalBonus = isLogNormal(projection.weeklyScores) ? 0.15 : 0;

  return Math.min(1, Math.max(0, cvScore + iqrScore + skewnessScore + logNormalBonus));
}

export function isLogNormal(scores: number[]): boolean {
  if (scores.length < 5) return false;

  const positiveScores = scores.filter(s => s > 0);
  if (positiveScores.length < 5) return false;

  const dist = computePlayerDistribution(scores);

  const logScores = positiveScores.map(s => Math.log(s));
  const logDist = computePlayerDistribution(logScores);

  return dist.skewness > 0.5 && Math.abs(logDist.skewness) < Math.abs(dist.skewness);
}
