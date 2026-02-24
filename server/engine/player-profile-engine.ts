import { boxMullerTransform } from './monte-carlo';

const AGE_CURVES: Record<string, { peak: [number, number]; decay: number; emergenceBonus: number }> = {
  QB: { peak: [25, 32], decay: 0.03, emergenceBonus: 0.04 },
  RB: { peak: [22, 27], decay: 0.05, emergenceBonus: 0.06 },
  WR: { peak: [24, 29], decay: 0.04, emergenceBonus: 0.05 },
  TE: { peak: [25, 30], decay: 0.04, emergenceBonus: 0.04 },
  K: { peak: [26, 36], decay: 0.02, emergenceBonus: 0.02 },
  DL: { peak: [24, 30], decay: 0.05, emergenceBonus: 0.04 },
  EDGE: { peak: [24, 30], decay: 0.05, emergenceBonus: 0.04 },
  LB: { peak: [24, 29], decay: 0.05, emergenceBonus: 0.04 },
  CB: { peak: [23, 28], decay: 0.06, emergenceBonus: 0.05 },
  S: { peak: [24, 30], decay: 0.04, emergenceBonus: 0.04 },
  DB: { peak: [23, 28], decay: 0.06, emergenceBonus: 0.05 },
};

export type PlayerArchetype =
  | 'alpha_producer'
  | 'ascending_asset'
  | 'prime_window'
  | 'declining_veteran'
  | 'volatile_upside'
  | 'floor_anchor'
  | 'injury_risk'
  | 'unknown_commodity';

export interface ArchetypeResult {
  archetype: PlayerArchetype;
  label: string;
  description: string;
  confidence: number;
}

export interface DynastyAssetScore {
  composite: number;
  productionGrade: number;
  ageGrade: number;
  roleSecurityGrade: number;
  volatilityGrade: number;
  injuryResilienceGrade: number;
  draftCapitalGrade: number;
  tier: string;
}

export interface MonteCarloDistribution {
  iterations: number;
  mean: number;
  median: number;
  stdDev: number;
  floor: number;
  ceiling: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  histogram: { bucket: number; count: number }[];
  boomProb: number;
  bustProb: number;
  boomThreshold: number;
  bustThreshold: number;
}

export interface AgeCurvePoint {
  age: number;
  year: number;
  projectedValue: number;
  confidence: number;
  phase: 'ascending' | 'peak' | 'declining';
}

export interface AgeCurveProjection {
  currentAge: number;
  position: string;
  peakWindow: [number, number];
  yearsUntilDecline: number;
  projections: AgeCurvePoint[];
  depreciationRate: number;
}

export interface CorrelationRisk {
  correlatedPlayers: {
    playerId: string;
    playerName: string;
    team: string;
    position: string;
    correlationCoeff: number;
    correlationType: string;
    stackRisk: 'high' | 'medium' | 'low';
  }[];
  teamExposure: Record<string, number>;
  maxCorrelation: number;
  stackRiskSummary: string;
}

export interface MarketSentiment {
  dynastyValue: number;
  dynastyTier: number;
  valueRank: number;
  positionRank: number;
  ktcValue: number | null;
  valueTrend: 'rising' | 'stable' | 'falling';
  valueVsProduction: number;
  tradeVolume: 'high' | 'medium' | 'low';
}

export interface StressTestScenario {
  id: string;
  label: string;
  description: string;
  projectedPointsDelta: number;
  valueImpactPct: number;
  probabilityOfOccurrence: number;
  sensitivityScore: number;
}

export interface DevyProspectData {
  isDevy: boolean;
  collegeTeam: string | null;
  class: string | null;
  draftProjection: string | null;
  athleticScore: number | null;
  productionScore: number | null;
  archetype: string | null;
  comparison: string | null;
}

export interface ElitePlayerProfile {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number;
  archetype: ArchetypeResult;
  dynastyAssetScore: DynastyAssetScore;
  monteCarlo: MonteCarloDistribution;
  ageCurve: AgeCurveProjection;
  correlationRisk: CorrelationRisk;
  marketSentiment: MarketSentiment;
  stressTests: StressTestScenario[];
  devyProspect: DevyProspectData;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

export function classifyArchetype(
  age: number | null,
  position: string,
  weeklyScores: number[],
  gamesPlayed: number,
  yearsExp: number,
  injuryStatus: string | null,
  snapPct: number | null
): ArchetypeResult {
  const hasProduction = weeklyScores.length >= 4;
  const mean = hasProduction ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : 0;
  const cv = hasProduction && mean > 0
    ? Math.sqrt(weeklyScores.reduce((s, v) => s + (v - mean) ** 2, 0) / weeklyScores.length) / mean
    : 0.5;

  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  const isPrePeak = age !== null && age < curve.peak[0];
  const isPeak = age !== null && age >= curve.peak[0] && age <= curve.peak[1];
  const isPostPeak = age !== null && age > curve.peak[1];

  const injuryStatuses = ['out', 'ir', 'doubtful'];
  const isInjured = injuryStatus && injuryStatuses.includes(injuryStatus.toLowerCase());

  if (isInjured && gamesPlayed < 8) {
    return { archetype: 'injury_risk', label: 'Injury Risk', description: 'Significant health concerns limit upside projection and add volatility to asset valuation.', confidence: 0.8 };
  }

  if (hasProduction && mean > 15 && cv < 0.35 && (isPeak || isPrePeak)) {
    return { archetype: 'alpha_producer', label: 'Alpha Producer', description: 'Elite, consistent output with peak-window production. Cornerstone dynasty asset.', confidence: 0.85 };
  }

  if (isPrePeak && yearsExp <= 2 && (snapPct === null || snapPct > 40)) {
    return { archetype: 'ascending_asset', label: 'Ascending Asset', description: 'Pre-peak player with rising trajectory. Highest long-term ROI potential in the portfolio.', confidence: 0.7 };
  }

  if (isPeak && hasProduction && mean > 8) {
    return { archetype: 'prime_window', label: 'Prime Window', description: 'Currently in peak production years. Maximize value now through competitive rosters.', confidence: 0.75 };
  }

  if (isPostPeak && hasProduction) {
    return { archetype: 'declining_veteran', label: 'Declining Veteran', description: 'Past peak production window. Sell-high candidate before age-driven depreciation accelerates.', confidence: 0.7 };
  }

  if (hasProduction && cv > 0.45) {
    return { archetype: 'volatile_upside', label: 'Volatile Upside', description: 'High-variance output creates boom/bust weekly exposure. Ceiling player with floor risk.', confidence: 0.65 };
  }

  if (hasProduction && cv < 0.3 && mean > 5) {
    return { archetype: 'floor_anchor', label: 'Floor Anchor', description: 'Reliable weekly producer with low variance. Stabilizes roster projections.', confidence: 0.7 };
  }

  return { archetype: 'unknown_commodity', label: 'Unknown Commodity', description: 'Insufficient data to classify. Monitor snap share and target trends for signal.', confidence: 0.4 };
}

export function computeDynastyAssetScore(
  weeklyScores: number[],
  age: number | null,
  position: string,
  yearsExp: number,
  snapPct: number | null,
  draftRound: number | null,
  gamesPlayed: number,
  injuryStatus: string | null,
  dynastyValue: number
): DynastyAssetScore {
  const mean = weeklyScores.length > 0 ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : 0;
  const cv = weeklyScores.length > 0 && mean > 0
    ? Math.sqrt(weeklyScores.reduce((s, v) => s + (v - mean) ** 2, 0) / weeklyScores.length) / mean
    : 0.5;

  const productionGrade = clamp(mean / 22, 0, 1);

  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  let ageGrade = 0.5;
  if (age !== null) {
    if (age < curve.peak[0]) ageGrade = clamp(0.7 + (curve.peak[0] - age) * 0.05);
    else if (age >= curve.peak[0] && age <= curve.peak[1]) ageGrade = 0.8;
    else ageGrade = clamp(0.8 - (age - curve.peak[1]) * curve.decay * 3);
  }

  const roleSecurityGrade = snapPct !== null ? clamp(snapPct / 85) : 0.5;
  const volatilityGrade = clamp(1 - cv * 1.2);
  const injuryResilienceGrade = clamp(gamesPlayed / 17);
  const injuryPenalty = injuryStatus && ['out', 'ir'].includes(injuryStatus.toLowerCase()) ? 0.7 : 1.0;
  const draftCapitalGrade = draftRound !== null ? clamp(1.1 - draftRound * 0.12) : 0.4;

  const composite = r2(
    productionGrade * 0.30 +
    ageGrade * 0.20 +
    roleSecurityGrade * 0.15 +
    volatilityGrade * 0.10 +
    injuryResilienceGrade * 0.10 * injuryPenalty +
    draftCapitalGrade * 0.15
  );

  const tier = composite >= 0.8 ? 'S' : composite >= 0.65 ? 'A' : composite >= 0.5 ? 'B' : composite >= 0.35 ? 'C' : 'D';

  return {
    composite: r2(composite),
    productionGrade: r2(productionGrade),
    ageGrade: r2(ageGrade),
    roleSecurityGrade: r2(roleSecurityGrade),
    volatilityGrade: r2(volatilityGrade),
    injuryResilienceGrade: r2(injuryResilienceGrade * injuryPenalty),
    draftCapitalGrade: r2(draftCapitalGrade),
    tier,
  };
}

export function runPlayerMonteCarlo(
  weeklyScores: number[],
  projectedMedian: number,
  projectedStdDev: number,
  iterations: number = 5000
): MonteCarloDistribution {
  const mean = projectedMedian > 0 ? projectedMedian : (weeklyScores.length > 0 ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : 8);
  const sd = projectedStdDev > 0 ? projectedStdDev : (weeklyScores.length >= 3
    ? Math.sqrt(weeklyScores.reduce((s, v) => s + (v - mean) ** 2, 0) / weeklyScores.length)
    : mean * 0.35);

  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const z = boxMullerTransform();
    results.push(Math.max(0, mean + sd * z));
  }
  results.sort((a, b) => a - b);

  const simMean = results.reduce((a, b) => a + b, 0) / iterations;
  const simMedian = results[Math.floor(iterations / 2)];
  const simStdDev = Math.sqrt(results.reduce((s, v) => s + (v - simMean) ** 2, 0) / iterations);

  const getP = (p: number) => results[Math.floor(iterations * p / 100)] || 0;

  const boomThreshold = mean * 1.5;
  const bustThreshold = mean * 0.5;
  const boomCount = results.filter(v => v >= boomThreshold).length;
  const bustCount = results.filter(v => v <= bustThreshold).length;

  const bucketWidth = Math.max(1, (results[results.length - 1] - results[0]) / 20);
  const bucketMin = Math.floor(results[0]);
  const histMap = new Map<number, number>();
  for (const v of results) {
    const bucket = Math.floor((v - bucketMin) / bucketWidth) * bucketWidth + bucketMin;
    histMap.set(bucket, (histMap.get(bucket) || 0) + 1);
  }
  const histogram = Array.from(histMap.entries())
    .map(([bucket, count]) => ({ bucket: r2(bucket), count }))
    .sort((a, b) => a.bucket - b.bucket);

  return {
    iterations,
    mean: r2(simMean),
    median: r2(simMedian),
    stdDev: r2(simStdDev),
    floor: r2(getP(5)),
    ceiling: r2(getP(95)),
    p10: r2(getP(10)),
    p25: r2(getP(25)),
    p75: r2(getP(75)),
    p90: r2(getP(90)),
    histogram,
    boomProb: r2(boomCount / iterations),
    bustProb: r2(bustCount / iterations),
    boomThreshold: r2(boomThreshold),
    bustThreshold: r2(bustThreshold),
  };
}

export function projectAgeCurve(
  age: number | null,
  position: string,
  currentValue: number,
  currentSeason: number
): AgeCurveProjection {
  const curAge = age || 25;
  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  const [peakStart, peakEnd] = curve.peak;
  const yearsUntilDecline = Math.max(0, peakEnd - curAge);

  const projections: AgeCurvePoint[] = [];
  for (let y = 0; y <= 3; y++) {
    const projAge = curAge + y;
    let multiplier = 1.0;

    if (projAge < peakStart) {
      multiplier = 1.0 + Math.min(0.1, (peakStart - projAge) * curve.emergenceBonus);
    } else if (projAge >= peakStart && projAge <= peakEnd) {
      multiplier = 1.0;
    } else {
      multiplier = Math.max(0.4, 1.0 - (projAge - peakEnd) * curve.decay);
    }

    const phase: 'ascending' | 'peak' | 'declining' =
      projAge < peakStart ? 'ascending' : projAge <= peakEnd ? 'peak' : 'declining';
    const confidence = y === 0 ? 0.95 : y === 1 ? 0.75 : y === 2 ? 0.55 : 0.4;

    projections.push({
      age: projAge,
      year: currentSeason + y,
      projectedValue: r2(currentValue * multiplier),
      confidence: r2(confidence),
      phase,
    });
  }

  return {
    currentAge: curAge,
    position,
    peakWindow: curve.peak,
    yearsUntilDecline,
    projections,
    depreciationRate: r2(curve.decay * 100),
  };
}

export function computeCorrelationRisk(
  playerId: string,
  playerTeam: string,
  playerPosition: string,
  rosterPlayers: string[],
  allPlayers: Record<string, any>
): CorrelationRisk {
  const teamExposure: Record<string, number> = {};
  const correlatedPlayers: CorrelationRisk['correlatedPlayers'] = [];

  const defaultCorrelations: Record<string, number> = {
    'QB-WR': 0.45, 'QB-TE': 0.35, 'QB-RB': 0.15,
    'WR-WR': -0.08, 'RB-DEF': -0.15, 'same_team': 0.15,
  };

  for (const pid of rosterPlayers) {
    if (pid === playerId) continue;
    const p = allPlayers[pid];
    if (!p) continue;
    const pTeam = p.team || 'FA';
    if (pTeam !== 'FA') teamExposure[pTeam] = (teamExposure[pTeam] || 0) + 1;

    if (pTeam === playerTeam && pTeam !== 'FA') {
      const pPos = p.position || 'UNK';
      const key = [playerPosition, pPos].sort().join('-');
      const corr = defaultCorrelations[key] || defaultCorrelations['same_team'] || 0.1;
      const stackRisk: 'high' | 'medium' | 'low' = Math.abs(corr) > 0.3 ? 'high' : Math.abs(corr) > 0.15 ? 'medium' : 'low';

      correlatedPlayers.push({
        playerId: pid,
        playerName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || pid,
        team: pTeam,
        position: pPos,
        correlationCoeff: r2(corr),
        correlationType: key === 'QB-WR' ? 'QB-WR Stack' : key === 'QB-TE' ? 'QB-TE Stack' : `Same Team (${key})`,
        stackRisk,
      });
    }
  }

  const maxCorrelation = correlatedPlayers.length > 0
    ? Math.max(...correlatedPlayers.map(c => Math.abs(c.correlationCoeff)))
    : 0;

  const sameTeamCount = teamExposure[playerTeam] || 0;
  const stackRiskSummary = sameTeamCount >= 3
    ? `High concentration: ${sameTeamCount + 1} players from ${playerTeam}. Correlated downside risk in bad game scripts.`
    : sameTeamCount >= 1
      ? `Moderate exposure: ${sameTeamCount + 1} ${playerTeam} players. Stack provides upside correlation.`
      : 'Minimal same-team correlation. Diversified exposure.';

  return { correlatedPlayers, teamExposure, maxCorrelation: r2(maxCorrelation), stackRiskSummary };
}

export function computeMarketSentiment(
  dynastyValue: number,
  weeklyScores: number[],
  position: string,
  allDynastyValues: { playerId: string; value: number; position: string }[],
  ktcValue: number | null
): MarketSentiment {
  const sorted = [...allDynastyValues].sort((a, b) => b.value - a.value);
  const valueRank = sorted.findIndex(v => v.value <= dynastyValue) + 1 || sorted.length;
  const positionSorted = sorted.filter(v => v.position === position);
  const positionRank = positionSorted.findIndex(v => v.value <= dynastyValue) + 1 || positionSorted.length;

  const mean = weeklyScores.length > 0 ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : 0;
  const productionBasedValue = mean * 500;
  const valueVsProduction = dynastyValue > 0 ? r2(productionBasedValue / dynastyValue) : 0;

  const tier = dynastyValue >= 8000 ? 1 : dynastyValue >= 6000 ? 2 : dynastyValue >= 4000 ? 3 : dynastyValue >= 2000 ? 4 : 5;

  const recentScores = weeklyScores.slice(-6);
  const olderScores = weeklyScores.slice(0, -6);
  let valueTrend: 'rising' | 'stable' | 'falling' = 'stable';
  if (recentScores.length >= 3 && olderScores.length >= 3) {
    const recentMean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const olderMean = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
    if (recentMean > olderMean * 1.15) valueTrend = 'rising';
    else if (recentMean < olderMean * 0.85) valueTrend = 'falling';
  }

  const tradeVolume: 'high' | 'medium' | 'low' = dynastyValue >= 5000 ? 'high' : dynastyValue >= 2000 ? 'medium' : 'low';

  return {
    dynastyValue,
    dynastyTier: tier,
    valueRank,
    positionRank,
    ktcValue,
    valueTrend,
    valueVsProduction,
    tradeVolume,
  };
}

export function computeStressTests(
  weeklyScores: number[],
  projectedMedian: number,
  age: number | null,
  position: string,
  injuryStatus: string | null,
  snapPct: number | null,
  dynastyValue: number
): StressTestScenario[] {
  const mean = weeklyScores.length > 0 ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length : projectedMedian;
  const scenarios: StressTestScenario[] = [];

  scenarios.push({
    id: 'season_ending_injury',
    label: 'Season-Ending Injury',
    description: `Player suffers a major injury, missing remaining games`,
    projectedPointsDelta: r2(-mean * 10),
    valueImpactPct: r2(-0.35),
    probabilityOfOccurrence: r2(position === 'RB' ? 0.12 : 0.08),
    sensitivityScore: r2(0.9),
  });

  scenarios.push({
    id: 'usage_decline',
    label: 'Role Reduction',
    description: `Snap share drops 20%+ due to committee or coaching change`,
    projectedPointsDelta: r2(-mean * 0.25 * 10),
    valueImpactPct: r2(-0.18),
    probabilityOfOccurrence: r2(snapPct && snapPct > 70 ? 0.15 : 0.25),
    sensitivityScore: r2(0.7),
  });

  scenarios.push({
    id: 'qb_change',
    label: 'Quarterback Change',
    description: `New QB impacts target share or rushing scheme`,
    projectedPointsDelta: r2(position === 'QB' ? 0 : -mean * 0.15 * 10),
    valueImpactPct: r2(position === 'QB' ? 0 : -0.12),
    probabilityOfOccurrence: r2(position === 'QB' ? 0 : 0.10),
    sensitivityScore: r2(position === 'QB' ? 0 : 0.6),
  });

  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  const curAge = age || 25;
  const yearsFromDecline = Math.max(0, curve.peak[1] - curAge);
  scenarios.push({
    id: 'age_cliff',
    label: 'Accelerated Aging',
    description: `Production declines ${(curve.decay * 200).toFixed(0)}% faster than expected age curve`,
    projectedPointsDelta: r2(-mean * curve.decay * 2 * 10),
    valueImpactPct: r2(yearsFromDecline <= 1 ? -0.30 : -0.15),
    probabilityOfOccurrence: r2(yearsFromDecline <= 1 ? 0.20 : 0.08),
    sensitivityScore: r2(yearsFromDecline <= 2 ? 0.85 : 0.4),
  });

  scenarios.push({
    id: 'breakout',
    label: 'Breakout Scenario',
    description: `Usage increases and efficiency spikes, production jumps 30%+`,
    projectedPointsDelta: r2(mean * 0.3 * 10),
    valueImpactPct: r2(0.25),
    probabilityOfOccurrence: r2(curAge < curve.peak[0] ? 0.20 : 0.08),
    sensitivityScore: r2(0.65),
  });

  return scenarios;
}

export function computeDevyProspectData(
  playerId: string,
  allPlayers: Record<string, any>
): DevyProspectData {
  const player = allPlayers[playerId];
  if (!player) return { isDevy: false, collegeTeam: null, class: null, draftProjection: null, athleticScore: null, productionScore: null, archetype: null, comparison: null };

  const isRookie = (player.years_exp || 0) === 0;
  const hasNFLTeam = !!player.team;
  const isDevy = isRookie && !hasNFLTeam;

  if (!isDevy) {
    return { isDevy: false, collegeTeam: player.college || null, class: null, draftProjection: null, athleticScore: null, productionScore: null, archetype: null, comparison: null };
  }

  return {
    isDevy: true,
    collegeTeam: player.college || null,
    class: player.metadata?.rookie_year || null,
    draftProjection: player.metadata?.draft_projection || null,
    athleticScore: null,
    productionScore: null,
    archetype: null,
    comparison: null,
  };
}

export function buildEliteProfile(
  playerId: string,
  allPlayers: Record<string, any>,
  weeklyScores: number[],
  projectedMedian: number,
  projectedStdDev: number,
  dynastyValue: number,
  ktcValue: number | null,
  allDynastyValues: { playerId: string; value: number; position: string }[],
  rosterPlayers: string[],
  currentSeason: number
): ElitePlayerProfile {
  const player = allPlayers[playerId];
  const playerName = player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : playerId;
  const position = player?.position || 'UNK';
  const team = player?.team || 'FA';
  const age = player?.age || null;
  const yearsExp = player?.years_exp || 0;
  const injuryStatus = player?.injury_status || null;
  const snapPct = player?.snap_pct || null;
  const draftRound = player?.draft_round ? parseInt(player.draft_round) : null;
  const gamesPlayed = weeklyScores.filter(s => s > 0).length;

  const archetype = classifyArchetype(age, position, weeklyScores, gamesPlayed, yearsExp, injuryStatus, snapPct);
  const dynastyAssetScore = computeDynastyAssetScore(weeklyScores, age, position, yearsExp, snapPct, draftRound, gamesPlayed, injuryStatus, dynastyValue);
  const monteCarlo = runPlayerMonteCarlo(weeklyScores, projectedMedian, projectedStdDev);
  const ageCurve = projectAgeCurve(age, position, dynastyValue, currentSeason);
  const correlationRisk = computeCorrelationRisk(playerId, team, position, rosterPlayers, allPlayers);
  const marketSentiment = computeMarketSentiment(dynastyValue, weeklyScores, position, allDynastyValues, ktcValue);
  const stressTests = computeStressTests(weeklyScores, projectedMedian, age, position, injuryStatus, snapPct, dynastyValue);
  const devyProspect = computeDevyProspectData(playerId, allPlayers);

  return {
    playerId,
    playerName,
    position,
    team,
    age,
    yearsExp,
    archetype,
    dynastyAssetScore,
    monteCarlo,
    ageCurve,
    correlationRisk,
    marketSentiment,
    stressTests,
    devyProspect,
  };
}
