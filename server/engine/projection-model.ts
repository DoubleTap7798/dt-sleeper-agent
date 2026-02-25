import { PlayerProjection, CorrelationMatrix, CorrelationEntry } from './types';
import { getAgeCurve, computeAgeMultiplier } from './player-valuation-service';

export interface ThreeYearProjectionInput {
  playerId: string;
  age: number;
  position: string;
  historicalPPG: number[];
  currentUsage?: {
    snapPct?: number;
    targetShare?: number;
    redZoneShare?: number;
    carriesPerGame?: number;
  };
}

export interface YearProjection {
  year: number;
  projectedPPG: number;
  floor: number;
  ceiling: number;
  confidence: number;
}

export interface ThreeYearProjectionResult {
  year1: YearProjection;
  year2: YearProjection;
  year3: YearProjection;
  trajectory: 'ascending' | 'stable' | 'declining';
  careerPPG: number;
  recentPPG: number;
}

const DYNASTY_AGE_MODELS: Record<string, { peakStart: number; peakEnd: number; cliffAge: number; decayRate: number; growthRate: number }> = {
  QB: { peakStart: 24, peakEnd: 34, cliffAge: 38, decayRate: 0.03, growthRate: 0.05 },
  RB: { peakStart: 22, peakEnd: 26, cliffAge: 27, decayRate: 0.10, growthRate: 0.08 },
  WR: { peakStart: 25, peakEnd: 29, cliffAge: 31, decayRate: 0.06, growthRate: 0.06 },
  TE: { peakStart: 25, peakEnd: 30, cliffAge: 32, decayRate: 0.05, growthRate: 0.04 },
};

function getDynastyAgeModel(position: string) {
  return DYNASTY_AGE_MODELS[position.toUpperCase()] || DYNASTY_AGE_MODELS.WR;
}

function computeAgeFactor(age: number, position: string): number {
  const model = getDynastyAgeModel(position);

  if (age < model.peakStart) {
    const yearsToGo = model.peakStart - age;
    return Math.max(0.6, 1.0 - yearsToGo * model.growthRate);
  }

  if (age >= model.peakStart && age <= model.peakEnd) {
    return 1.0;
  }

  if (age > model.peakEnd && age <= model.cliffAge) {
    const yearsPostPeak = age - model.peakEnd;
    return Math.max(0.5, 1.0 - yearsPostPeak * model.decayRate);
  }

  const yearsPostCliff = age - model.cliffAge;
  const preCliffDecay = (model.cliffAge - model.peakEnd) * model.decayRate;
  const cliffValue = Math.max(0.5, 1.0 - preCliffDecay);
  return Math.max(0.15, cliffValue - yearsPostCliff * model.decayRate * 1.5);
}

function computeUsageAdjustment(usage?: ThreeYearProjectionInput['currentUsage']): number {
  if (!usage) return 1.0;

  let adjustment = 1.0;

  if (usage.snapPct !== undefined) {
    if (usage.snapPct > 0.75) adjustment += 0.03;
    else if (usage.snapPct < 0.50) adjustment -= 0.05;
  }

  if (usage.targetShare !== undefined) {
    if (usage.targetShare > 0.25) adjustment += 0.04;
    else if (usage.targetShare < 0.12) adjustment -= 0.03;
  }

  if (usage.redZoneShare !== undefined) {
    if (usage.redZoneShare > 0.20) adjustment += 0.03;
    else if (usage.redZoneShare < 0.05) adjustment -= 0.02;
  }

  if (usage.carriesPerGame !== undefined) {
    if (usage.carriesPerGame > 18) adjustment += 0.03;
    else if (usage.carriesPerGame < 8) adjustment -= 0.04;
  }

  return Math.max(0.8, Math.min(1.15, adjustment));
}

function determineTrajectory(year1PPG: number, year3PPG: number): 'ascending' | 'stable' | 'declining' {
  if (year1PPG <= 0) return 'stable';
  const ratio = year3PPG / year1PPG;
  if (ratio > 1.05) return 'ascending';
  if (ratio < 0.90) return 'declining';
  return 'stable';
}

const projectionCache = new Map<string, { result: ThreeYearProjectionResult; timestamp: number }>();
const PROJECTION_CACHE_TTL = 15 * 60 * 1000;

export function compute3YearProjection(input: ThreeYearProjectionInput): ThreeYearProjectionResult {
  const currentSeason = new Date().getFullYear();
  const cacheKey = `${input.playerId}:${currentSeason}`;

  const cached = projectionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PROJECTION_CACHE_TTL) {
    return cached.result;
  }

  const { age, position, historicalPPG, currentUsage } = input;
  const pos = position.toUpperCase();

  const validPPG = historicalPPG.filter(v => v > 0);
  const careerPPG = validPPG.length > 0
    ? validPPG.reduce((a, b) => a + b, 0) / validPPG.length
    : 0;

  const recentSeasons = validPPG.slice(-2);
  const recentPPG = recentSeasons.length > 0
    ? recentSeasons.reduce((a, b) => a + b, 0) / recentSeasons.length
    : careerPPG;

  const basePPG = recentSeasons.length >= 2
    ? recentPPG * 0.7 + careerPPG * 0.3
    : recentPPG * 0.5 + careerPPG * 0.5;

  const usageAdj = computeUsageAdjustment(currentUsage);

  const years: YearProjection[] = [];
  for (let y = 1; y <= 3; y++) {
    const projectedAge = age + y;
    const currentAgeFactor = computeAgeFactor(age, pos);
    const futureAgeFactor = computeAgeFactor(projectedAge, pos);
    const ageRatio = currentAgeFactor > 0 ? futureAgeFactor / currentAgeFactor : futureAgeFactor;

    let projectedPPG = basePPG * ageRatio * usageAdj;

    if (y >= 2) {
      const usageDecay = 1.0 - (y - 1) * 0.02;
      projectedPPG *= usageDecay;
    }

    projectedPPG = Math.max(0, projectedPPG);

    const baseConfidence = 0.85 - (y - 1) * 0.12;
    const dataConfidence = Math.min(1, validPPG.length / 4);
    const confidence = Math.max(0.25, Math.min(0.95, baseConfidence * dataConfidence));

    const volatility = validPPG.length >= 2
      ? Math.sqrt(validPPG.reduce((s, v) => s + (v - careerPPG) ** 2, 0) / validPPG.length) / (careerPPG || 1)
      : 0.3;

    const spreadFactor = (1 + volatility) * (1 + (y - 1) * 0.15);
    const floor = Math.max(0, r2(projectedPPG * (1 - 0.25 * spreadFactor)));
    const ceiling = r2(projectedPPG * (1 + 0.20 * spreadFactor));

    years.push({
      year: y,
      projectedPPG: r2(projectedPPG),
      floor,
      ceiling,
      confidence: r2(confidence),
    });
  }

  const trajectory = determineTrajectory(years[0].projectedPPG, years[2].projectedPPG);

  const result: ThreeYearProjectionResult = {
    year1: years[0],
    year2: years[1],
    year3: years[2],
    trajectory,
    careerPPG: r2(careerPPG),
    recentPPG: r2(recentPPG),
  };

  projectionCache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

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
  defaults.set('qb_wr', 0.45);
  defaults.set('qb_te', 0.3);
  defaults.set('qb_rb', 0.15);
  defaults.set('rb_def', -0.15);
  defaults.set('same_team', 0.05);
  defaults.set('same_team_wr', -0.08);
  defaults.set('opp_def', -0.15);
  defaults.set('game_stack', 0.15);
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
    if (pos1 === 'WR' && pos2 === 'WR') return 'same_team_wr';
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
