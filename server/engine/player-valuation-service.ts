import { boxMullerTransform } from './monte-carlo';

export interface AgeCurveConfig {
  peakStart: number;
  peakEnd: number;
  emergenceRate: number;
  decayRate: number;
  longevityCeiling: number;
}

const POSITION_AGE_CURVES: Record<string, AgeCurveConfig> = {
  QB: { peakStart: 26, peakEnd: 33, emergenceRate: 0.06, decayRate: 0.04, longevityCeiling: 42 },
  RB: { peakStart: 22, peakEnd: 26, emergenceRate: 0.08, decayRate: 0.08, longevityCeiling: 32 },
  WR: { peakStart: 24, peakEnd: 29, emergenceRate: 0.06, decayRate: 0.05, longevityCeiling: 35 },
  TE: { peakStart: 25, peakEnd: 30, emergenceRate: 0.05, decayRate: 0.05, longevityCeiling: 36 },
  K:  { peakStart: 26, peakEnd: 38, emergenceRate: 0.02, decayRate: 0.02, longevityCeiling: 44 },
  DEF: { peakStart: 0, peakEnd: 99, emergenceRate: 0, decayRate: 0, longevityCeiling: 99 },
};

export interface ValueCurvePoint {
  year: number;
  age: number;
  projectedValue: number;
  ageMultiplier: number;
  longevityModifier: number;
  injuryRiskFactor: number;
  productionProjection: number;
  phase: 'ascending' | 'peak' | 'declining' | 'twilight';
  confidence: number;
}

export interface DNPVResult {
  dnpv: number;
  rawDNPV: number;
  annualizedValue: number;
  valueCurve: ValueCurvePoint[];
  peakYearValue: number;
  terminalValue: number;
  discountRate: number;
  horizonYears: number;
}

export interface PlayerValuation {
  playerId: string;
  position: string;
  age: number;
  currentValue: number;
  dnpv: DNPVResult;
  injuryRiskScore: number;
  archetypeCluster: string;
  longevityScore: number;
  productionTrajectory: 'ascending' | 'plateau' | 'declining';
}

const INJURY_RISK_BY_POSITION: Record<string, number> = {
  QB: 0.06, RB: 0.14, WR: 0.09, TE: 0.10, K: 0.02, DEF: 0.02,
};

const ARCHETYPE_CLUSTERS: Record<string, { label: string; longevityBonus: number; peakMultiplier: number }> = {
  'elite_franchise': { label: 'Elite Franchise', longevityBonus: 0.08, peakMultiplier: 1.15 },
  'ascending_star': { label: 'Ascending Star', longevityBonus: 0.05, peakMultiplier: 1.10 },
  'prime_producer': { label: 'Prime Producer', longevityBonus: 0.0, peakMultiplier: 1.0 },
  'aging_asset': { label: 'Aging Asset', longevityBonus: -0.05, peakMultiplier: 0.90 },
  'volatile_talent': { label: 'Volatile Talent', longevityBonus: -0.02, peakMultiplier: 1.05 },
  'depth_piece': { label: 'Depth Piece', longevityBonus: -0.03, peakMultiplier: 0.80 },
  'unknown': { label: 'Unknown Commodity', longevityBonus: 0.0, peakMultiplier: 0.85 },
};

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function getAgeCurve(position: string): AgeCurveConfig {
  return POSITION_AGE_CURVES[position] || POSITION_AGE_CURVES.WR;
}

export function computeAgeMultiplier(age: number, position: string): number {
  const curve = getAgeCurve(position);
  if (age < curve.peakStart) {
    const yearsToGo = curve.peakStart - age;
    return 1.0 + yearsToGo * curve.emergenceRate;
  }
  if (age <= curve.peakEnd) {
    return 1.0;
  }
  const yearsPostPeak = age - curve.peakEnd;
  return Math.max(0.15, 1.0 - yearsPostPeak * curve.decayRate);
}

export function computeLongevityModifier(age: number, position: string, archetypeCluster: string): number {
  const curve = getAgeCurve(position);
  const clusterConfig = ARCHETYPE_CLUSTERS[archetypeCluster] || ARCHETYPE_CLUSTERS['unknown'];
  const remainingYears = Math.max(0, curve.longevityCeiling - age);
  const maxYears = curve.longevityCeiling - curve.peakStart;
  const baseLongevity = clamp(remainingYears / maxYears);
  return clamp(baseLongevity + clusterConfig.longevityBonus);
}

export function computeInjuryRiskFactor(
  age: number,
  position: string,
  gamesPlayed: number,
  totalPossibleGames: number,
  injuryHistory: number
): number {
  const baseRisk = INJURY_RISK_BY_POSITION[position] || 0.08;
  const availabilityRate = totalPossibleGames > 0 ? gamesPlayed / totalPossibleGames : 0.9;
  const ageFactor = age > 30 ? 1 + (age - 30) * 0.03 : 1.0;
  const historyFactor = 1 + injuryHistory * 0.05;
  const adjustedRisk = baseRisk * ageFactor * historyFactor * (2 - availabilityRate);
  return clamp(1 - adjustedRisk, 0.5, 1.0);
}

export function classifyProductionTrajectory(
  weeklyScores: number[],
  age: number,
  position: string
): 'ascending' | 'plateau' | 'declining' {
  if (weeklyScores.length < 6) {
    const curve = getAgeCurve(position);
    if (age < curve.peakStart) return 'ascending';
    if (age <= curve.peakEnd) return 'plateau';
    return 'declining';
  }

  const half = Math.floor(weeklyScores.length / 2);
  const firstHalf = weeklyScores.slice(0, half);
  const secondHalf = weeklyScores.slice(half);
  const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const ratio = firstMean > 0 ? secondMean / firstMean : 1;

  if (ratio > 1.10) return 'ascending';
  if (ratio < 0.90) return 'declining';
  return 'plateau';
}

export function classifyArchetypeCluster(
  age: number,
  position: string,
  currentValue: number,
  weeklyScores: number[],
  yearsExp: number
): string {
  const curve = getAgeCurve(position);
  const mean = weeklyScores.length > 0 ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : 0;
  const cv = weeklyScores.length > 2 && mean > 0
    ? Math.sqrt(weeklyScores.reduce((s, v) => s + (v - mean) ** 2, 0) / weeklyScores.length) / mean
    : 0.5;

  if (currentValue >= 7000 && age <= curve.peakEnd && mean > 14) return 'elite_franchise';
  if (age < curve.peakStart && yearsExp <= 2) return 'ascending_star';
  if (age > curve.peakEnd + 2) return 'aging_asset';
  if (cv > 0.45 && mean > 8) return 'volatile_talent';
  if (currentValue < 2000 || mean < 5) return 'depth_piece';
  if (age >= curve.peakStart && age <= curve.peakEnd && mean > 8) return 'prime_producer';
  return 'unknown';
}

export function computeDNPV(
  currentValue: number,
  age: number,
  position: string,
  archetypeCluster: string,
  weeklyScores: number[],
  gamesPlayed: number,
  totalPossibleGames: number,
  injuryHistoryCount: number,
  contenderWeight: number = 1.0,
  horizonYears: number = 7,
  discountRate: number = 0.08
): DNPVResult {
  const clusterConfig = ARCHETYPE_CLUSTERS[archetypeCluster] || ARCHETYPE_CLUSTERS['unknown'];
  const mean = weeklyScores.length > 0 ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : currentValue / 500;
  const baseProduction = mean * 17;

  const valueCurve: ValueCurvePoint[] = [];
  let totalDNPV = 0;
  let peakYearValue = 0;
  let terminalValue = 0;

  for (let y = 0; y < horizonYears; y++) {
    const projAge = age + y;
    const curve = getAgeCurve(position);

    const ageMultiplier = computeAgeMultiplier(projAge, position);
    const longevityMod = computeLongevityModifier(projAge, position, archetypeCluster);
    const injuryRisk = computeInjuryRiskFactor(projAge, position, gamesPlayed, totalPossibleGames, injuryHistoryCount);

    const peakMult = clusterConfig.peakMultiplier;
    const productionProjection = baseProduction * ageMultiplier * peakMult * injuryRisk;

    let phase: ValueCurvePoint['phase'];
    if (projAge < curve.peakStart) phase = 'ascending';
    else if (projAge <= curve.peakEnd) phase = 'peak';
    else if (projAge <= curve.peakEnd + 3) phase = 'declining';
    else phase = 'twilight';

    const yearValue = productionProjection * ageMultiplier * longevityMod * contenderWeight;
    const discountedValue = yearValue / Math.pow(1 + discountRate, y);

    const confidence = clamp(0.95 - y * 0.10, 0.15, 0.95);

    valueCurve.push({
      year: y,
      age: projAge,
      projectedValue: r2(discountedValue),
      ageMultiplier: r2(ageMultiplier),
      longevityModifier: r2(longevityMod),
      injuryRiskFactor: r2(injuryRisk),
      productionProjection: r2(productionProjection),
      phase,
      confidence: r2(confidence),
    });

    totalDNPV += discountedValue;
    if (discountedValue > peakYearValue) peakYearValue = discountedValue;
    if (y === horizonYears - 1) terminalValue = discountedValue;
  }

  return {
    dnpv: r2(totalDNPV),
    rawDNPV: r2(totalDNPV),
    annualizedValue: r2(totalDNPV / horizonYears),
    valueCurve,
    peakYearValue: r2(peakYearValue),
    terminalValue: r2(terminalValue),
    discountRate,
    horizonYears,
  };
}

export function computePlayerValuation(
  playerId: string,
  position: string,
  age: number,
  currentValue: number,
  weeklyScores: number[],
  yearsExp: number,
  gamesPlayed: number,
  totalPossibleGames: number,
  injuryHistoryCount: number,
  contenderWeight: number = 1.0
): PlayerValuation {
  const archetypeCluster = classifyArchetypeCluster(age, position, currentValue, weeklyScores, yearsExp);

  const dnpv = computeDNPV(
    currentValue, age, position, archetypeCluster,
    weeklyScores, gamesPlayed, totalPossibleGames,
    injuryHistoryCount, contenderWeight
  );

  const injuryRiskScore = r2(1 - computeInjuryRiskFactor(age, position, gamesPlayed, totalPossibleGames, injuryHistoryCount));
  const longevityScore = r2(computeLongevityModifier(age, position, archetypeCluster));
  const productionTrajectory = classifyProductionTrajectory(weeklyScores, age, position);

  return {
    playerId,
    position,
    age,
    currentValue,
    dnpv,
    injuryRiskScore,
    archetypeCluster,
    longevityScore,
    productionTrajectory,
  };
}

const valuationCache = new Map<string, { valuation: PlayerValuation; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function getCachedValuation(playerId: string): PlayerValuation | null {
  const cached = valuationCache.get(playerId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    valuationCache.delete(playerId);
    return null;
  }
  return cached.valuation;
}

export function cacheValuation(valuation: PlayerValuation): void {
  valuationCache.set(valuation.playerId, {
    valuation,
    timestamp: Date.now(),
  });
}

export function clearValuationCache(): void {
  valuationCache.clear();
}

export function batchComputeValuations(
  players: Array<{
    playerId: string;
    position: string;
    age: number;
    currentValue: number;
    weeklyScores: number[];
    yearsExp: number;
    gamesPlayed: number;
    totalPossibleGames: number;
    injuryHistoryCount: number;
  }>,
  contenderWeight: number = 1.0
): Map<string, PlayerValuation> {
  const results = new Map<string, PlayerValuation>();

  for (const p of players) {
    const cached = getCachedValuation(p.playerId);
    if (cached) {
      results.set(p.playerId, cached);
      continue;
    }

    const valuation = computePlayerValuation(
      p.playerId, p.position, p.age, p.currentValue,
      p.weeklyScores, p.yearsExp, p.gamesPlayed,
      p.totalPossibleGames, p.injuryHistoryCount,
      contenderWeight
    );

    cacheValuation(valuation);
    results.set(p.playerId, valuation);
  }

  return results;
}
