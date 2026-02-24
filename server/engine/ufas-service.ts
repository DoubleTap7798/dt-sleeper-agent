import { computeAgeMultiplier, computeLongevityModifier, computeInjuryRiskFactor, classifyArchetypeCluster, getAgeCurve } from './player-valuation-service';
import type { FranchiseWindow } from './franchise-modeling-service';

export interface UFASResult {
  ufas: number;
  components: {
    baseTalentScore: number;
    longevityMultiplier: number;
    windowFitAdjustment: number;
    scarcityMultiplier: number;
    riskAdjustment: number;
    marketDemandModifier: number;
  };
  tier: string;
  tierRank: number;
}

export interface PositionalScarcityData {
  position: string;
  leagueAvgValue: number;
  replacementLevelValue: number;
  scarcityIndex: number;
  eliteCount: number;
  totalRostered: number;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

function computeBaseTalentScore(
  weeklyScores: number[],
  currentValue: number,
  position: string
): number {
  const mean = weeklyScores.length > 0
    ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length
    : 0;

  const positionMax: Record<string, number> = { QB: 25, RB: 18, WR: 18, TE: 14, K: 12, DEF: 12 };
  const maxProd = positionMax[position] || 15;
  const productionScore = clamp(mean / maxProd);

  const valueScore = clamp(currentValue / 10000);

  return r2(productionScore * 0.60 + valueScore * 0.40);
}

function computeWindowFitAdjustment(
  age: number,
  position: string,
  franchiseWindow: FranchiseWindow
): number {
  const curve = getAgeCurve(position);
  const isPrePeak = age < curve.peakStart;
  const isPeak = age >= curve.peakStart && age <= curve.peakEnd;
  const isPostPeak = age > curve.peakEnd;

  const windowMultipliers: Record<FranchiseWindow, { prePeak: number; peak: number; postPeak: number }> = {
    'win_now':           { prePeak: 0.85, peak: 1.15, postPeak: 0.95 },
    'contender':         { prePeak: 0.90, peak: 1.10, postPeak: 0.85 },
    'balanced':          { prePeak: 1.00, peak: 1.00, postPeak: 0.80 },
    'productive_struggle': { prePeak: 1.10, peak: 0.95, postPeak: 0.65 },
    'rebuild':           { prePeak: 1.20, peak: 0.85, postPeak: 0.50 },
  };

  const mults = windowMultipliers[franchiseWindow];
  if (isPrePeak) return r2(mults.prePeak);
  if (isPeak) return r2(mults.peak);
  return r2(mults.postPeak);
}

function computeScarcityMultiplier(
  position: string,
  scarcityData: PositionalScarcityData[]
): number {
  const posScarcity = scarcityData.find(s => s.position === position);
  if (!posScarcity) return 1.0;
  return r2(1.0 + (posScarcity.scarcityIndex - 0.5) * 0.3);
}

function computeRiskAdjustment(
  age: number,
  position: string,
  weeklyScores: number[],
  gamesPlayed: number,
  totalPossibleGames: number,
  injuryHistoryCount: number
): number {
  const injuryRisk = 1 - computeInjuryRiskFactor(age, position, gamesPlayed, totalPossibleGames, injuryHistoryCount);

  const mean = weeklyScores.length > 0 ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : 0;
  const cv = weeklyScores.length > 2 && mean > 0
    ? Math.sqrt(weeklyScores.reduce((s, v) => s + (v - mean) ** 2, 0) / weeklyScores.length) / mean
    : 0.5;
  const volatilityRisk = clamp(cv * 0.5);

  const curve = getAgeCurve(position);
  const ageRisk = age > curve.peakEnd ? clamp((age - curve.peakEnd) * 0.08) : 0;

  return r2(injuryRisk * 0.35 + volatilityRisk * 0.35 + ageRisk * 0.30);
}

function computeMarketDemandModifier(
  position: string,
  currentValue: number,
  leagueAvgValue: number
): number {
  if (leagueAvgValue <= 0) return 1.0;
  const demandRatio = currentValue / leagueAvgValue;
  if (demandRatio > 1.5) return 1.10;
  if (demandRatio > 1.0) return 1.05;
  if (demandRatio < 0.5) return 0.90;
  return 1.0;
}

function assignTier(ufas: number): { tier: string; tierRank: number } {
  if (ufas >= 85) return { tier: 'S', tierRank: 1 };
  if (ufas >= 72) return { tier: 'A', tierRank: 2 };
  if (ufas >= 58) return { tier: 'B', tierRank: 3 };
  if (ufas >= 42) return { tier: 'C', tierRank: 4 };
  if (ufas >= 25) return { tier: 'D', tierRank: 5 };
  return { tier: 'F', tierRank: 6 };
}

export function computeUFAS(
  weeklyScores: number[],
  currentValue: number,
  age: number,
  position: string,
  yearsExp: number,
  gamesPlayed: number,
  totalPossibleGames: number,
  injuryHistoryCount: number,
  franchiseWindow: FranchiseWindow,
  scarcityData: PositionalScarcityData[],
  leagueAvgValue: number
): UFASResult {
  const archetypeCluster = classifyArchetypeCluster(age, position, currentValue, weeklyScores, yearsExp);

  const baseTalentScore = computeBaseTalentScore(weeklyScores, currentValue, position);
  const longevityMultiplier = computeLongevityModifier(age, position, archetypeCluster);
  const windowFitAdjustment = computeWindowFitAdjustment(age, position, franchiseWindow);
  const scarcityMultiplier = computeScarcityMultiplier(position, scarcityData);
  const riskAdjustment = computeRiskAdjustment(age, position, weeklyScores, gamesPlayed, totalPossibleGames, injuryHistoryCount);
  const marketDemandModifier = computeMarketDemandModifier(position, currentValue, leagueAvgValue);

  const rawScore = baseTalentScore * longevityMultiplier * windowFitAdjustment * scarcityMultiplier * marketDemandModifier;
  const adjustedScore = rawScore * (1 - riskAdjustment * 0.4);

  const ufas = r2(Math.min(100, adjustedScore * 100));
  const { tier, tierRank } = assignTier(ufas);

  return {
    ufas,
    components: {
      baseTalentScore: r2(baseTalentScore),
      longevityMultiplier: r2(longevityMultiplier),
      windowFitAdjustment: r2(windowFitAdjustment),
      scarcityMultiplier: r2(scarcityMultiplier),
      riskAdjustment: r2(riskAdjustment),
      marketDemandModifier: r2(marketDemandModifier),
    },
    tier,
    tierRank,
  };
}

export function computePositionalScarcity(
  allPlayerValues: Array<{ position: string; value: number }>,
  positions: string[] = ['QB', 'RB', 'WR', 'TE']
): PositionalScarcityData[] {
  const results: PositionalScarcityData[] = [];

  for (const pos of positions) {
    const posPlayers = allPlayerValues.filter(p => p.position === pos);
    if (posPlayers.length === 0) {
      results.push({ position: pos, leagueAvgValue: 0, replacementLevelValue: 0, scarcityIndex: 0.5, eliteCount: 0, totalRostered: 0 });
      continue;
    }

    const sorted = [...posPlayers].sort((a, b) => b.value - a.value);
    const avgValue = sorted.reduce((s, p) => s + p.value, 0) / sorted.length;

    const replacementIdx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));
    const replacementLevelValue = sorted[replacementIdx]?.value || 0;

    const eliteCount = sorted.filter(p => p.value > avgValue * 1.5).length;

    const scarcityIndex = clamp(1 - (replacementLevelValue / Math.max(avgValue, 1)));

    results.push({
      position: pos,
      leagueAvgValue: r2(avgValue),
      replacementLevelValue: r2(replacementLevelValue),
      scarcityIndex: r2(scarcityIndex),
      eliteCount,
      totalRostered: posPlayers.length,
    });
  }

  return results;
}

export function batchComputeUFAS(
  players: Array<{
    playerId: string;
    weeklyScores: number[];
    currentValue: number;
    age: number;
    position: string;
    yearsExp: number;
    gamesPlayed: number;
    totalPossibleGames: number;
    injuryHistoryCount: number;
  }>,
  franchiseWindow: FranchiseWindow,
  scarcityData: PositionalScarcityData[],
  leagueAvgValue: number
): Map<string, UFASResult> {
  const results = new Map<string, UFASResult>();

  for (const p of players) {
    const ufas = computeUFAS(
      p.weeklyScores, p.currentValue, p.age, p.position,
      p.yearsExp, p.gamesPlayed, p.totalPossibleGames,
      p.injuryHistoryCount, franchiseWindow, scarcityData,
      leagueAvgValue
    );
    results.set(p.playerId, ufas);
  }

  return results;
}
