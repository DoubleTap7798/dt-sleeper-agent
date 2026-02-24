import { boxMullerTransform } from './monte-carlo';
import { computeAgeMultiplier, getAgeCurve } from './player-valuation-service';
import type { FranchiseWindow } from './franchise-modeling-service';

export interface TradeAsset {
  playerId: string;
  name: string;
  position: string;
  age: number;
  currentValue: number;
  weeklyScores: number[];
  yearsExp: number;
  isDraftPick?: boolean;
  pickYear?: string;
  pickRound?: number;
}

export interface OutcomeDistribution {
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  mean: number;
  stdDev: number;
}

export interface TradeSimResult {
  immediateEVDelta: number;
  threeYearEVDelta: number;
  fiveYearEVDelta: number;
  giveOutcomeDistribution: OutcomeDistribution;
  getOutcomeDistribution: OutcomeDistribution;
  netOutcomeDistribution: OutcomeDistribution;
  bustProbability: number;
  championshipProbabilityDelta: number;
  volatilityScore: number;
  volatilityDelta: number;
  windowAlignment: number;
  executiveSummary: string;
  counterOffers: CounterOffer[];
  verdict: 'strong_accept' | 'lean_accept' | 'neutral' | 'lean_reject' | 'strong_reject';
}

export interface CounterOffer {
  id: string;
  description: string;
  adjustedAssets: { give: string[]; get: string[] };
  evDelta: number;
  reasoning: string;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

function simulateAssetValue(asset: TradeAsset, yearsForward: number, iterations: number = 1000): number[] {
  const results: number[] = [];
  const curve = getAgeCurve(asset.position);
  const mean = asset.weeklyScores.length > 0
    ? asset.weeklyScores.reduce((a, b) => a + b, 0) / asset.weeklyScores.length
    : asset.currentValue / 600;

  const cv = asset.weeklyScores.length > 2 && mean > 0
    ? Math.sqrt(asset.weeklyScores.reduce((s, v) => s + (v - mean) ** 2, 0) / asset.weeklyScores.length) / mean
    : 0.4;

  for (let i = 0; i < iterations; i++) {
    let value = asset.currentValue;
    for (let y = 0; y < yearsForward; y++) {
      const projAge = asset.age + y;
      const ageMult = computeAgeMultiplier(projAge, asset.position);
      const noise = boxMullerTransform() * cv * 0.3;
      const breakoutChance = projAge < curve.peakStart ? 0.08 : 0;
      const injuryChance = asset.position === 'RB' ? 0.12 : 0.07;

      let yearMultiplier = ageMult + noise;
      if (Math.random() < breakoutChance) yearMultiplier *= 1.25;
      if (Math.random() < injuryChance) yearMultiplier *= 0.5;

      value *= Math.max(0.1, yearMultiplier);
    }
    results.push(Math.max(0, value));
  }

  results.sort((a, b) => a - b);
  return results;
}

function computeDistribution(values: number[]): OutcomeDistribution {
  const n = values.length;
  if (n === 0) return { p10: 0, p25: 0, median: 0, p75: 0, p90: 0, mean: 0, stdDev: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const getP = (p: number) => sorted[Math.floor(n * p / 100)] || 0;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n);

  return {
    p10: r2(getP(10)),
    p25: r2(getP(25)),
    median: r2(getP(50)),
    p75: r2(getP(75)),
    p90: r2(getP(90)),
    mean: r2(mean),
    stdDev: r2(stdDev),
  };
}

function computeVolatilityScore(dist: OutcomeDistribution): number {
  if (dist.median <= 0) return 0.5;
  return r2(clamp(dist.stdDev / dist.median));
}

function computeWindowAlignment(
  giveAssets: TradeAsset[],
  getAssets: TradeAsset[],
  window: FranchiseWindow
): number {
  const windowPreference: Record<FranchiseWindow, { preferYoung: number; preferPeak: number; preferVet: number }> = {
    'win_now':           { preferYoung: 0.3, preferPeak: 1.0, preferVet: 0.7 },
    'contender':         { preferYoung: 0.5, preferPeak: 1.0, preferVet: 0.5 },
    'balanced':          { preferYoung: 0.7, preferPeak: 0.8, preferVet: 0.5 },
    'productive_struggle': { preferYoung: 1.0, preferPeak: 0.6, preferVet: 0.3 },
    'rebuild':           { preferYoung: 1.0, preferPeak: 0.4, preferVet: 0.2 },
  };

  const prefs = windowPreference[window];

  function scoreAsset(a: TradeAsset): number {
    const curve = getAgeCurve(a.position);
    if (a.age < curve.peakStart) return prefs.preferYoung;
    if (a.age <= curve.peakEnd) return prefs.preferPeak;
    return prefs.preferVet;
  }

  const getScore = getAssets.length > 0
    ? getAssets.reduce((s, a) => s + scoreAsset(a), 0) / getAssets.length : 0;
  const giveScore = giveAssets.length > 0
    ? giveAssets.reduce((s, a) => s + scoreAsset(a), 0) / giveAssets.length : 0;

  return r2(getScore - giveScore);
}

function generateCounterOffers(
  giveAssets: TradeAsset[],
  getAssets: TradeAsset[],
  netEV: number
): CounterOffer[] {
  const offers: CounterOffer[] = [];

  if (netEV < -500) {
    const deficit = Math.abs(netEV);
    offers.push({
      id: 'add_pick',
      description: 'Request additional draft pick',
      adjustedAssets: {
        give: giveAssets.map(a => a.name),
        get: [...getAssets.map(a => a.name), `+ 2026 ${deficit > 3000 ? '1st' : deficit > 1500 ? '2nd' : '3rd'}`],
      },
      evDelta: r2(deficit * 0.6),
      reasoning: `Current offer is ${deficit.toFixed(0)} below fair value. Adding a draft pick closes the gap.`,
    });

    if (giveAssets.length > 1) {
      const leastValuable = [...giveAssets].sort((a, b) => a.currentValue - b.currentValue)[0];
      offers.push({
        id: 'remove_give',
        description: `Remove ${leastValuable.name} from give side`,
        adjustedAssets: {
          give: giveAssets.filter(a => a.playerId !== leastValuable.playerId).map(a => a.name),
          get: getAssets.map(a => a.name),
        },
        evDelta: r2(leastValuable.currentValue),
        reasoning: `Removing ${leastValuable.name} (${leastValuable.currentValue} value) makes the trade closer to fair.`,
      });
    }
  }

  if (netEV > 2000) {
    offers.push({
      id: 'sweeten_deal',
      description: 'Add sweetener to close deal faster',
      adjustedAssets: {
        give: [...giveAssets.map(a => a.name), '+ 2027 3rd'],
        get: getAssets.map(a => a.name),
      },
      evDelta: r2(-1500),
      reasoning: 'Adding a late-round pick as incentive increases acceptance probability without significant cost.',
    });
  }

  return offers;
}

function determineVerdict(
  immediateEV: number,
  threeYearEV: number,
  windowAlignment: number,
  bustProb: number
): TradeSimResult['verdict'] {
  const composite = immediateEV * 0.3 + threeYearEV * 0.4 + windowAlignment * 3000 * 0.2 - bustProb * 2000 * 0.1;

  if (composite > 2000) return 'strong_accept';
  if (composite > 500) return 'lean_accept';
  if (composite > -500) return 'neutral';
  if (composite > -2000) return 'lean_reject';
  return 'strong_reject';
}

export function simulateTrade(
  giveAssets: TradeAsset[],
  getAssets: TradeAsset[],
  franchiseWindow: FranchiseWindow,
  currentChampProb: number = 0.10,
  iterations: number = 1000
): TradeSimResult {
  const giveImmediate = giveAssets.reduce((s, a) => s + a.currentValue, 0);
  const getImmediate = getAssets.reduce((s, a) => s + a.currentValue, 0);
  const immediateEVDelta = r2(getImmediate - giveImmediate);

  const give3yr = giveAssets.flatMap(a => simulateAssetValue(a, 3, iterations));
  const get3yr = getAssets.flatMap(a => simulateAssetValue(a, 3, iterations));
  const give5yr = giveAssets.flatMap(a => simulateAssetValue(a, 5, iterations));
  const get5yr = getAssets.flatMap(a => simulateAssetValue(a, 5, iterations));

  const giveDist3 = computeDistribution(give3yr);
  const getDist3 = computeDistribution(get3yr);
  const giveDist5 = computeDistribution(give5yr);
  const getDist5 = computeDistribution(get5yr);

  const threeYearEVDelta = r2(getDist3.mean - giveDist3.mean);
  const fiveYearEVDelta = r2(getDist5.mean - giveDist5.mean);

  const netValues3 = [];
  const minLen = Math.min(get3yr.length, give3yr.length);
  for (let i = 0; i < minLen; i++) {
    netValues3.push((get3yr[i] || 0) - (give3yr[i] || 0));
  }
  const netDist = computeDistribution(netValues3);

  const bustCount = netValues3.filter(v => v < -giveImmediate * 0.5).length;
  const bustProbability = r2(bustCount / Math.max(netValues3.length, 1));

  const giveVol = computeVolatilityScore(giveDist3);
  const getVol = computeVolatilityScore(getDist3);
  const volatilityDelta = r2(getVol - giveVol);

  const windowAlignment = computeWindowAlignment(giveAssets, getAssets, franchiseWindow);

  const champDelta = r2(
    (immediateEVDelta / 10000) * 0.03 +
    windowAlignment * 0.02 -
    bustProbability * 0.01
  );

  const counterOffers = generateCounterOffers(giveAssets, getAssets, immediateEVDelta);

  const verdict = determineVerdict(immediateEVDelta, threeYearEVDelta, windowAlignment, bustProbability);

  const champDirWord = champDelta >= 0 ? 'increases' : 'decreases';
  const volWord = volatilityDelta >= 0 ? 'increases' : 'decreases';

  const executiveSummary =
    `This trade ${champDirWord} championship odds by ${Math.abs(champDelta * 100).toFixed(1)}% ` +
    `but ${volWord} long-term volatility by ${Math.abs(volatilityDelta * 100).toFixed(1)}%. ` +
    `3-year EV delta: ${threeYearEVDelta > 0 ? '+' : ''}${threeYearEVDelta.toFixed(0)}. ` +
    `${windowAlignment > 0 ? 'Aligns with' : 'Conflicts with'} your ${franchiseWindow.replace('_', ' ')} window.`;

  return {
    immediateEVDelta,
    threeYearEVDelta,
    fiveYearEVDelta,
    giveOutcomeDistribution: giveDist3,
    getOutcomeDistribution: getDist3,
    netOutcomeDistribution: netDist,
    bustProbability,
    championshipProbabilityDelta: champDelta,
    volatilityScore: r2(getVol),
    volatilityDelta,
    windowAlignment,
    executiveSummary,
    counterOffers,
    verdict,
  };
}
