import { computeAgeMultiplier, computeLongevityModifier, getAgeCurve } from './player-valuation-service';
import { KTC_DEVY_PLAYERS, KTCDevyPlayer } from '../ktc-values';

export interface DraftOutcomeBranch {
  round: number;
  label: string;
  probability: number;
  projectedDynastyHitRate: number;
  contractValueArc: number[];
  expectedDynastyValue: number;
}

export interface DevyValueProjection {
  playerId: string;
  name: string;
  position: string;
  college: string;
  draftEligibleYear: number;
  draftOutcomeDistribution: DraftOutcomeBranch[];
  weightedExpectedValue: number;
  dnpv: number;
  valueCurve: { year: number; age: number; projectedValue: number; phase: string; confidence: number }[];
  ceilingOutcome: number;
  floorOutcome: number;
  bustProbability: number;
  starterProbability: number;
  eliteProbability: number;
  compPlayers: { name: string; matchPct: number; wasSuccess: boolean }[];
  riskAdjustedValue: number;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

const DYNASTY_HIT_RATES_BY_ROUND: Record<string, Record<number, number>> = {
  QB: { 1: 0.65, 2: 0.42, 3: 0.25, 4: 0.12, 5: 0.05, 6: 0.03, 7: 0.02 },
  RB: { 1: 0.58, 2: 0.38, 3: 0.22, 4: 0.10, 5: 0.05, 6: 0.03, 7: 0.02 },
  WR: { 1: 0.55, 2: 0.35, 3: 0.20, 4: 0.10, 5: 0.05, 6: 0.03, 7: 0.02 },
  TE: { 1: 0.50, 2: 0.30, 3: 0.18, 4: 0.08, 5: 0.04, 6: 0.02, 7: 0.01 },
};

const CONTRACT_VALUE_ARCS: Record<number, number[]> = {
  1: [1.0, 1.05, 1.10, 1.12, 1.08, 0.95, 0.80],
  2: [0.85, 0.95, 1.05, 1.08, 1.02, 0.90, 0.75],
  3: [0.70, 0.82, 0.95, 1.00, 0.95, 0.82, 0.68],
  4: [0.55, 0.68, 0.80, 0.88, 0.82, 0.72, 0.58],
  5: [0.40, 0.52, 0.65, 0.72, 0.68, 0.58, 0.45],
  6: [0.30, 0.42, 0.52, 0.58, 0.52, 0.42, 0.32],
  7: [0.20, 0.30, 0.40, 0.45, 0.40, 0.32, 0.25],
};

function computeDraftOutcomeDistribution(player: KTCDevyPlayer): DraftOutcomeBranch[] {
  const hitRates = DYNASTY_HIT_RATES_BY_ROUND[player.position] || DYNASTY_HIT_RATES_BY_ROUND.WR;
  const branches: DraftOutcomeBranch[] = [];

  const round1Pct = player.round1Pct / 100;
  const round2Pct = Math.min(player.round2PlusPct / 100, 0.40);
  const round3Pct = Math.max(0, (player.round2PlusPct / 100) - round2Pct) * 0.6;
  const dayThreePct = Math.max(0, 1 - round1Pct - round2Pct - round3Pct);

  if (player.top10Pct > 30) {
    const top10Prob = (player.top10Pct / 100) * round1Pct;
    const lateFirstProb = round1Pct - top10Prob;

    if (top10Prob > 0.05) {
      branches.push({
        round: 1,
        label: 'Top 10 Pick',
        probability: r2(top10Prob),
        projectedDynastyHitRate: r2(hitRates[1] * 1.15),
        contractValueArc: CONTRACT_VALUE_ARCS[1].map(v => r2(v * 1.1)),
        expectedDynastyValue: 0,
      });
    }
    if (lateFirstProb > 0.05) {
      branches.push({
        round: 1,
        label: 'Late 1st Round',
        probability: r2(lateFirstProb),
        projectedDynastyHitRate: r2(hitRates[1]),
        contractValueArc: CONTRACT_VALUE_ARCS[1],
        expectedDynastyValue: 0,
      });
    }
  } else if (round1Pct > 0.05) {
    branches.push({
      round: 1,
      label: 'Round 1',
      probability: r2(round1Pct),
      projectedDynastyHitRate: r2(hitRates[1]),
      contractValueArc: CONTRACT_VALUE_ARCS[1],
      expectedDynastyValue: 0,
    });
  }

  if (round2Pct > 0.05) {
    branches.push({
      round: 2,
      label: 'Round 2',
      probability: r2(round2Pct),
      projectedDynastyHitRate: r2(hitRates[2]),
      contractValueArc: CONTRACT_VALUE_ARCS[2],
      expectedDynastyValue: 0,
    });
  }

  if (round3Pct > 0.05) {
    branches.push({
      round: 3,
      label: 'Round 3',
      probability: r2(round3Pct),
      projectedDynastyHitRate: r2(hitRates[3]),
      contractValueArc: CONTRACT_VALUE_ARCS[3],
      expectedDynastyValue: 0,
    });
  }

  if (dayThreePct > 0.05) {
    branches.push({
      round: 5,
      label: 'Day 3',
      probability: r2(dayThreePct),
      projectedDynastyHitRate: r2(hitRates[5]),
      contractValueArc: CONTRACT_VALUE_ARCS[5],
      expectedDynastyValue: 0,
    });
  }

  const totalProb = branches.reduce((s, b) => s + b.probability, 0);
  if (totalProb > 0 && Math.abs(totalProb - 1.0) > 0.01) {
    const scale = 1.0 / totalProb;
    branches.forEach(b => b.probability = r2(b.probability * scale));
  }

  const baseValue = player.value;
  branches.forEach(b => {
    const hitRateValue = baseValue * b.projectedDynastyHitRate;
    const arcAvg = b.contractValueArc.reduce((a, c) => a + c, 0) / b.contractValueArc.length;
    b.expectedDynastyValue = r2(hitRateValue * arcAvg);
  });

  return branches;
}

function computeDevyDNPV(
  player: KTCDevyPlayer,
  branches: DraftOutcomeBranch[],
  discountRate: number = 0.08
): { dnpv: number; valueCurve: DevyValueProjection['valueCurve'] } {
  const estimatedAge = 20;
  const yearsToNFL = Math.max(0, player.draftEligibleYear - 2026);
  const nflEntryAge = estimatedAge + yearsToNFL;

  let totalDNPV = 0;
  const valueCurve: DevyValueProjection['valueCurve'] = [];
  const curve = getAgeCurve(player.position);

  for (let y = 0; y < 7; y++) {
    const projAge = nflEntryAge + y;
    const calendarYear = player.draftEligibleYear + y;
    const discountYears = yearsToNFL + y;

    let yearValue = 0;
    for (const branch of branches) {
      const arcValue = y < branch.contractValueArc.length ? branch.contractValueArc[y] : 0.2;
      const branchValue = branch.expectedDynastyValue * arcValue * branch.probability;
      yearValue += branchValue;
    }

    const ageMultiplier = computeAgeMultiplier(projAge, player.position);
    yearValue *= ageMultiplier;

    const discounted = yearValue / Math.pow(1 + discountRate, discountYears);
    totalDNPV += discounted;

    let phase: string;
    if (projAge < curve.peakStart) phase = 'ascending';
    else if (projAge <= curve.peakEnd) phase = 'peak';
    else phase = 'declining';

    valueCurve.push({
      year: calendarYear,
      age: projAge,
      projectedValue: r2(discounted),
      phase,
      confidence: r2(clamp(0.90 - discountYears * 0.08, 0.15, 0.90)),
    });
  }

  return { dnpv: r2(totalDNPV), valueCurve };
}

export function projectDevyPlayer(player: KTCDevyPlayer): DevyValueProjection {
  const branches = computeDraftOutcomeDistribution(player);
  const { dnpv, valueCurve } = computeDevyDNPV(player, branches);
  const weightedExpectedValue = branches.reduce(
    (sum, b) => sum + b.expectedDynastyValue * b.probability, 0
  );

  const ceilingBranch = branches.reduce((best, b) =>
    b.expectedDynastyValue > best.expectedDynastyValue ? b : best, branches[0]);
  const floorBranch = branches.reduce((worst, b) =>
    b.expectedDynastyValue < worst.expectedDynastyValue ? b : worst, branches[0]);

  const riskAdjustedValue = r2(dnpv * (1 - player.bustPct / 200));

  return {
    playerId: player.id,
    name: player.name,
    position: player.position,
    college: player.college,
    draftEligibleYear: player.draftEligibleYear,
    draftOutcomeDistribution: branches,
    weightedExpectedValue: r2(weightedExpectedValue),
    dnpv,
    valueCurve,
    ceilingOutcome: r2(ceilingBranch?.expectedDynastyValue || 0),
    floorOutcome: r2(floorBranch?.expectedDynastyValue || 0),
    bustProbability: r2(player.bustPct / 100),
    starterProbability: r2(player.starterPct / 100),
    eliteProbability: r2(player.elitePct / 100),
    compPlayers: player.comps,
    riskAdjustedValue,
  };
}

export function projectAllDevyPlayers(): Map<string, DevyValueProjection> {
  const results = new Map<string, DevyValueProjection>();
  for (const player of KTC_DEVY_PLAYERS) {
    results.set(player.id, projectDevyPlayer(player));
  }
  return results;
}

export function getDevyDNPVRankings(): DevyValueProjection[] {
  return KTC_DEVY_PLAYERS
    .map(p => projectDevyPlayer(p))
    .sort((a, b) => b.dnpv - a.dnpv);
}
