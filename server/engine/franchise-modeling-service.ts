import { computeAgeMultiplier, getAgeCurve, computeLongevityModifier } from './player-valuation-service';

export type FranchiseWindow = 'win_now' | 'contender' | 'balanced' | 'productive_struggle' | 'rebuild';

export interface FranchiseWindowResult {
  classification: FranchiseWindow;
  label: string;
  description: string;
  windowScore: number;
  ageWeightedProductionScore: number;
  draftCapitalReserves: number;
  depthInsulationScore: number;
  positionalPeakClustering: number;
  twoYearChampionshipProb: number;
  keyMetrics: {
    avgStarterAge: number;
    corePlayersInPrime: number;
    totalCorePlayersAtRisk: number;
    draftPicksOwned: number;
    futureDraftCapitalValue: number;
    benchDepthRatio: number;
  };
  recommendations: string[];
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

export interface RosterPlayer {
  playerId: string;
  position: string;
  age: number;
  value: number;
  weeklyScores: number[];
  isStarter: boolean;
  yearsExp: number;
}

export interface DraftCapital {
  year: string;
  round: number;
  estimatedValue: number;
}

export function computeAgeWeightedProduction(players: RosterPlayer[]): number {
  if (players.length === 0) return 0;
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const p of players) {
    if (!p.isStarter) continue;
    const mean = p.weeklyScores.length > 0 ? p.weeklyScores.reduce((a, b) => a + b, 0) / p.weeklyScores.length : 0;
    const ageMult = computeAgeMultiplier(p.age, p.position);
    const weight = mean * ageMult;
    totalWeighted += weight;
    totalWeight += 1;
  }

  return totalWeight > 0 ? r2(totalWeighted / totalWeight) : 0;
}

export function computeDraftCapitalReserves(draftCapital: DraftCapital[]): number {
  const totalValue = draftCapital.reduce((sum, dc) => sum + dc.estimatedValue, 0);
  return r2(clamp(totalValue / 25000));
}

export function computeDepthInsulation(players: RosterPlayer[]): number {
  const positions = ['QB', 'RB', 'WR', 'TE'];
  let totalDepth = 0;
  let posCount = 0;

  for (const pos of positions) {
    const posPlayers = players.filter(p => p.position === pos).sort((a, b) => b.value - a.value);
    const starters = posPlayers.filter(p => p.isStarter);
    const bench = posPlayers.filter(p => !p.isStarter);

    if (starters.length === 0) continue;
    posCount++;

    const worstStarterValue = starters[starters.length - 1].value;
    const bestBenchValue = bench.length > 0 ? bench[0].value : 0;

    if (worstStarterValue <= 0) {
      totalDepth += 0;
    } else {
      const dropOff = (worstStarterValue - bestBenchValue) / worstStarterValue;
      totalDepth += clamp(1 - dropOff);
    }
  }

  return posCount > 0 ? r2(totalDepth / posCount) : 0;
}

export function computePositionalPeakClustering(players: RosterPlayer[]): number {
  const starters = players.filter(p => p.isStarter);
  if (starters.length === 0) return 0;

  let inPrime = 0;
  for (const p of starters) {
    const curve = getAgeCurve(p.position);
    if (p.age >= curve.peakStart && p.age <= curve.peakEnd) {
      inPrime++;
    }
  }

  return r2(inPrime / starters.length);
}

function computeTwoYearChampProb(
  ageWeighted: number,
  peakClustering: number,
  depthInsulation: number,
  draftCapitalReserves: number
): number {
  const productionFactor = clamp(ageWeighted / 15, 0, 1);
  const peakFactor = peakClustering;
  const depthFactor = depthInsulation * 0.5;
  const base = productionFactor * 0.40 + peakFactor * 0.35 + depthFactor * 0.15 + draftCapitalReserves * 0.10;
  return r2(clamp(base * 0.3, 0, 0.35));
}

export function computeWindowScore(
  ageWeightedProduction: number,
  peakClustering: number,
  twoYearProb: number,
  players: RosterPlayer[]
): number {
  const starters = players.filter(p => p.isStarter);
  const avgAge = starters.length > 0 ? starters.reduce((s, p) => s + p.age, 0) / starters.length : 25;

  let ageDecayRisk = 0;
  for (const p of starters) {
    const curve = getAgeCurve(p.position);
    if (p.age > curve.peakEnd) {
      ageDecayRisk += (p.age - curve.peakEnd) * curve.decayRate * (p.value / 5000);
    }
  }
  ageDecayRisk = clamp(ageDecayRisk / Math.max(starters.length, 1), 0, 1);

  const primeWeight = clamp(ageWeightedProduction / 15, 0, 1);
  const windowScore = (primeWeight * twoYearProb) - (ageDecayRisk * (1 - twoYearProb));

  return r2(windowScore);
}

function classifyWindow(
  windowScore: number,
  peakClustering: number,
  ageWeighted: number,
  draftCapital: number,
  players: RosterPlayer[]
): { classification: FranchiseWindow; label: string; description: string } {
  const starters = players.filter(p => p.isStarter);
  const avgAge = starters.length > 0 ? starters.reduce((s, p) => s + p.age, 0) / starters.length : 25;

  if (windowScore > 0.06 && peakClustering > 0.55 && ageWeighted > 12) {
    return {
      classification: 'win_now',
      label: 'Win Now',
      description: 'Peak competitive window. Roster core is in prime years with championship-caliber production. Maximize short-term moves.',
    };
  }

  if (windowScore > 0.02 && peakClustering > 0.40 && ageWeighted > 9) {
    return {
      classification: 'contender',
      label: 'Contender',
      description: '1-2 year competitive window. Core assets approaching or in peak production. Target marginal upgrades to push over the top.',
    };
  }

  if (peakClustering < 0.20 && draftCapital > 0.5 && avgAge < 24) {
    return {
      classification: 'rebuild',
      label: 'Rebuild',
      description: 'Building for the future. Stockpile draft capital and young assets. Trade aging veterans at peak value.',
    };
  }

  if (peakClustering < 0.30 && draftCapital > 0.35) {
    return {
      classification: 'productive_struggle',
      label: 'Productive Struggle',
      description: 'Strategic accumulation phase. Compete to avoid obvious tanking while building future asset base.',
    };
  }

  return {
    classification: 'balanced',
    label: 'Balanced',
    description: 'Mix of competing and building. Roster has both win-now and future pieces. Avoid panic moves in either direction.',
  };
}

function generateWindowRecommendations(
  classification: FranchiseWindow,
  peakClustering: number,
  depthInsulation: number,
  draftCapital: number,
  players: RosterPlayer[]
): string[] {
  const recs: string[] = [];
  const starters = players.filter(p => p.isStarter);

  const agingStarters = starters.filter(p => {
    const curve = getAgeCurve(p.position);
    return p.age > curve.peakEnd;
  });

  const youngHighValue = players.filter(p => {
    const curve = getAgeCurve(p.position);
    return p.age < curve.peakStart && p.value > 4000;
  });

  switch (classification) {
    case 'win_now':
      recs.push('Trade future picks for immediate upgrades at weakest starting positions');
      if (depthInsulation < 0.5) recs.push('Depth is thin — acquire handcuffs and backup starters before playoffs');
      if (agingStarters.length > 0) recs.push(`${agingStarters.length} core starter(s) past peak — monitor trade value for post-season sell window`);
      break;
    case 'contender':
      recs.push('Target 1-2 roster upgrades to push into title contention');
      if (draftCapital > 0.4) recs.push('Convert excess draft capital into proven producers');
      recs.push('Maintain flexibility — avoid mortgaging future for marginal upgrades');
      break;
    case 'balanced':
      recs.push('Evaluate each move on 3-year horizon, not just this season');
      if (youngHighValue.length > 0) recs.push(`${youngHighValue.length} ascending asset(s) — hold unless offered premium return`);
      recs.push('Target buy-low veterans from rebuilding teams');
      break;
    case 'productive_struggle':
      recs.push('Sell veterans at peak market value for future draft capital');
      recs.push('Accumulate assets from 2026-2027 draft classes');
      recs.push('Avoid acquiring players over 28 unless elite producers');
      break;
    case 'rebuild':
      recs.push('Aggressively trade all players past peak window for draft picks');
      recs.push('Target ascending assets under 24 in trades');
      recs.push('Stockpile 1st and 2nd round picks for next 2 draft classes');
      break;
  }

  return recs;
}

export function analyzefranchiseWindow(
  players: RosterPlayer[],
  draftCapital: DraftCapital[]
): FranchiseWindowResult {
  const ageWeightedProduction = computeAgeWeightedProduction(players);
  const draftCapitalReserves = computeDraftCapitalReserves(draftCapital);
  const depthInsulation = computeDepthInsulation(players);
  const peakClustering = computePositionalPeakClustering(players);

  const twoYearChampProb = computeTwoYearChampProb(
    ageWeightedProduction, peakClustering, depthInsulation, draftCapitalReserves
  );

  const windowScore = computeWindowScore(
    ageWeightedProduction, peakClustering, twoYearChampProb, players
  );

  const { classification, label, description } = classifyWindow(
    windowScore, peakClustering, ageWeightedProduction, draftCapitalReserves, players
  );

  const recommendations = generateWindowRecommendations(
    classification, peakClustering, depthInsulation, draftCapitalReserves, players
  );

  const starters = players.filter(p => p.isStarter);
  const avgStarterAge = starters.length > 0
    ? r2(starters.reduce((s, p) => s + p.age, 0) / starters.length) : 0;

  const corePlayersInPrime = starters.filter(p => {
    const curve = getAgeCurve(p.position);
    return p.age >= curve.peakStart && p.age <= curve.peakEnd;
  }).length;

  const atRiskPlayers = starters.filter(p => {
    const curve = getAgeCurve(p.position);
    return p.age > curve.peakEnd - 1;
  }).length;

  return {
    classification,
    label,
    description,
    windowScore,
    ageWeightedProductionScore: ageWeightedProduction,
    draftCapitalReserves,
    depthInsulationScore: depthInsulation,
    positionalPeakClustering: peakClustering,
    twoYearChampionshipProb: twoYearChampProb,
    keyMetrics: {
      avgStarterAge,
      corePlayersInPrime,
      totalCorePlayersAtRisk: atRiskPlayers,
      draftPicksOwned: draftCapital.length,
      futureDraftCapitalValue: r2(draftCapital.reduce((s, dc) => s + dc.estimatedValue, 0)),
      benchDepthRatio: r2(players.filter(p => !p.isStarter).length / Math.max(starters.length, 1)),
    },
    recommendations,
  };
}
