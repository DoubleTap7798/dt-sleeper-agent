import { boxMullerTransform } from './monte-carlo';

export interface DraftPlayer {
  playerId: string;
  name: string;
  position: string;
  value: number;
  adp: number;
  tier: number;
  college?: string;
  nflTeam?: string;
}

export interface OpponentProfile {
  rosterId: number;
  positionalNeeds: Record<string, number>;
  draftTendencies: Record<string, number>;
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
}

export interface DraftLeverageScore {
  score: number;
  futureAvailabilityRisk: number;
  tierDropoffSeverity: number;
  positionalScarcity: number;
  components: {
    availabilityRisk: number;
    tierCliff: number;
    positionalRun: number;
  };
}

export interface PlayerAvailability {
  playerId: string;
  name: string;
  position: string;
  availabilityPct: number;
  gonePct: number;
  expectedPickGone: number;
  tierCliffWarning: boolean;
  leverageScore: DraftLeverageScore;
}

export interface DraftNowVsWaitEV {
  playerId: string;
  draftNowEV: number;
  waitOneRoundEV: number;
  waitTwoRoundsEV: number;
  optimalAction: 'draft_now' | 'wait_one' | 'wait_two';
  reasoning: string;
}

export interface DraftSimulationResult {
  availabilities: PlayerAvailability[];
  draftNowVsWait: DraftNowVsWaitEV[];
  tierCliffs: TierCliff[];
  positionalRuns: PositionalRunWarning[];
  executiveSummary: string;
}

export interface TierCliff {
  position: string;
  currentTier: number;
  nextTier: number;
  playersRemainingInTier: number;
  valueDrop: number;
  urgency: 'critical' | 'high' | 'moderate' | 'low';
}

export interface PositionalRunWarning {
  position: string;
  expectedPicksBeforeRun: number;
  runProbability: number;
  playersLikelyGone: number;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

function simulateOpponentPick(
  available: DraftPlayer[],
  opponent: OpponentProfile,
  currentPick: number
): string | null {
  if (available.length === 0) return null;

  const scored = available.map(player => {
    const needBonus = (opponent.positionalNeeds[player.position] || 0) * 0.3;
    const tendencyBonus = (opponent.draftTendencies[player.position] || 0) * 0.2;
    const valueScore = player.value / 10000;
    const adpFit = 1 - Math.abs(player.adp - currentPick) / 50;
    const noise = boxMullerTransform() * 0.08;

    let riskMod = 0;
    if (opponent.riskProfile === 'aggressive') riskMod = 0.05;
    if (opponent.riskProfile === 'conservative') riskMod = -0.03;

    return {
      playerId: player.playerId,
      score: valueScore * 0.4 + clamp(adpFit) * 0.2 + needBonus + tendencyBonus + riskMod + noise,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.playerId || null;
}

function buildDefaultOpponents(
  numTeams: number,
  rostersByTeam: Map<number, string[]>,
  allPlayers: Record<string, any>
): OpponentProfile[] {
  const opponents: OpponentProfile[] = [];
  const positions = ['QB', 'RB', 'WR', 'TE'];

  for (let i = 1; i <= numTeams; i++) {
    const roster = rostersByTeam.get(i) || [];
    const posCounts: Record<string, number> = {};
    for (const pid of roster) {
      const p = allPlayers[pid];
      if (p?.position) posCounts[p.position] = (posCounts[p.position] || 0) + 1;
    }

    const needs: Record<string, number> = {};
    const idealCounts: Record<string, number> = { QB: 2, RB: 5, WR: 5, TE: 2 };
    for (const pos of positions) {
      const current = posCounts[pos] || 0;
      const ideal = idealCounts[pos] || 3;
      needs[pos] = clamp((ideal - current) / ideal);
    }

    const tendencies: Record<string, number> = {};
    for (const pos of positions) {
      tendencies[pos] = 0.25 + (Math.random() - 0.5) * 0.1;
    }

    opponents.push({
      rosterId: i,
      positionalNeeds: needs,
      draftTendencies: tendencies,
      riskProfile: Math.random() > 0.6 ? 'aggressive' : Math.random() > 0.3 ? 'balanced' : 'conservative',
    });
  }

  return opponents;
}

function detectTierCliffs(availablePlayers: DraftPlayer[]): TierCliff[] {
  const cliffs: TierCliff[] = [];
  const positions = ['QB', 'RB', 'WR', 'TE'];

  for (const pos of positions) {
    const posPlayers = availablePlayers.filter(p => p.position === pos).sort((a, b) => b.value - a.value);
    if (posPlayers.length < 2) continue;

    const tiers = new Map<number, DraftPlayer[]>();
    for (const p of posPlayers) {
      const tier = p.tier || 1;
      if (!tiers.has(tier)) tiers.set(tier, []);
      tiers.get(tier)!.push(p);
    }

    const sortedTiers = Array.from(tiers.entries()).sort(([a], [b]) => a - b);
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const [currentTier, currentPlayers] = sortedTiers[i];
      const [nextTier, nextPlayers] = sortedTiers[i + 1];

      const currentAvgValue = currentPlayers.reduce((s: number, p: DraftPlayer) => s + p.value, 0) / currentPlayers.length;
      const nextAvgValue = nextPlayers.reduce((s: number, p: DraftPlayer) => s + p.value, 0) / nextPlayers.length;
      const valueDrop = currentAvgValue - nextAvgValue;
      const dropPct = currentAvgValue > 0 ? valueDrop / currentAvgValue : 0;

      if (dropPct > 0.15) {
        let urgency: TierCliff['urgency'] = 'low';
        if (currentPlayers.length <= 1 && dropPct > 0.3) urgency = 'critical';
        else if (currentPlayers.length <= 2 && dropPct > 0.2) urgency = 'high';
        else if (dropPct > 0.2) urgency = 'moderate';

        cliffs.push({
          position: pos,
          currentTier,
          nextTier,
          playersRemainingInTier: currentPlayers.length,
          valueDrop: r2(valueDrop),
          urgency,
        });
      }
    }
  }

  return cliffs.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
}

function detectPositionalRuns(
  simResults: Map<string, number[]>,
  availablePlayers: DraftPlayer[],
  picksBetweenUser: number
): PositionalRunWarning[] {
  const warnings: PositionalRunWarning[] = [];
  const positions = ['QB', 'RB', 'WR', 'TE'];

  for (const pos of positions) {
    const posPlayers = availablePlayers.filter(p => p.position === pos);
    if (posPlayers.length < 2) continue;

    let totalGone = 0;
    for (const player of posPlayers) {
      const picks = simResults.get(player.playerId);
      if (!picks) continue;
      const goneBefore = picks.filter(p => p <= picksBetweenUser).length / picks.length;
      totalGone += goneBefore;
    }

    const avgGoneRate = totalGone / posPlayers.length;
    if (avgGoneRate > 0.4) {
      warnings.push({
        position: pos,
        expectedPicksBeforeRun: Math.round(picksBetweenUser * (1 - avgGoneRate)),
        runProbability: r2(avgGoneRate),
        playersLikelyGone: Math.round(posPlayers.length * avgGoneRate),
      });
    }
  }

  return warnings.sort((a, b) => b.runProbability - a.runProbability);
}

export function simulateDraft(
  availablePlayers: DraftPlayer[],
  userRosterId: number,
  currentPick: number,
  draftOrder: number[],
  userPickPositions: number[],
  opponents: OpponentProfile[],
  iterations: number = 1000
): DraftSimulationResult {
  const playerPickMap = new Map<string, number[]>();
  for (const p of availablePlayers) {
    playerPickMap.set(p.playerId, []);
  }

  for (let sim = 0; sim < iterations; sim++) {
    const remaining = new Set(availablePlayers.map(p => p.playerId));
    const playerPool = new Map(availablePlayers.map(p => [p.playerId, p]));

    for (let pickIdx = 0; pickIdx < draftOrder.length && remaining.size > 0; pickIdx++) {
      const pickNumber = currentPick + pickIdx;
      const teamPicking = draftOrder[pickIdx];

      if (teamPicking === userRosterId) continue;

      const opponent = opponents.find(o => o.rosterId === teamPicking) || opponents[0];
      const pool = Array.from(remaining).map(id => playerPool.get(id)!).filter(Boolean);
      const picked = simulateOpponentPick(pool, opponent, pickNumber);

      if (picked) {
        remaining.delete(picked);
        const picks = playerPickMap.get(picked);
        if (picks) picks.push(pickNumber);
      }
    }

    remaining.forEach(pid => {
      const picks = playerPickMap.get(pid);
      if (picks) picks.push(999);
    });
  }

  const nextUserPick = userPickPositions.length > 0 ? userPickPositions[0] : currentPick + draftOrder.length;
  const secondUserPick = userPickPositions.length > 1 ? userPickPositions[1] : nextUserPick + draftOrder.length;

  const availabilities: PlayerAvailability[] = availablePlayers.map(player => {
    const picks = playerPickMap.get(player.playerId) || [];
    const goneByNext = picks.filter(p => p < nextUserPick).length / Math.max(picks.length, 1);
    const avgPickGone = picks.length > 0 ? picks.reduce((a, b) => a + b, 0) / picks.length : 999;

    const futureAvailabilityRisk = r2(goneByNext);

    const tierCliffs = detectTierCliffs(availablePlayers);
    const relevantCliff = tierCliffs.find(c => c.position === player.position);
    const tierDropoffSeverity = relevantCliff ? clamp(relevantCliff.valueDrop / 3000) : 0;

    const posPlayersLeft = availablePlayers.filter(p => p.position === player.position && p.tier <= player.tier).length;
    const positionalScarcity = clamp(1 - posPlayersLeft / 5);

    const leverageScore: DraftLeverageScore = {
      score: r2(futureAvailabilityRisk * tierDropoffSeverity * (1 + positionalScarcity)),
      futureAvailabilityRisk: r2(futureAvailabilityRisk),
      tierDropoffSeverity: r2(tierDropoffSeverity),
      positionalScarcity: r2(positionalScarcity),
      components: {
        availabilityRisk: r2(futureAvailabilityRisk),
        tierCliff: r2(tierDropoffSeverity),
        positionalRun: r2(positionalScarcity * goneByNext),
      },
    };

    return {
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      availabilityPct: r2(1 - goneByNext),
      gonePct: r2(goneByNext),
      expectedPickGone: r2(avgPickGone),
      tierCliffWarning: tierDropoffSeverity > 0.3,
      leverageScore,
    };
  });

  availabilities.sort((a, b) => b.leverageScore.score - a.leverageScore.score);

  const draftNowVsWait: DraftNowVsWaitEV[] = availablePlayers.slice(0, 10).map(player => {
    const picks = playerPickMap.get(player.playerId) || [];
    const availAtNext = picks.filter(p => p >= nextUserPick).length / Math.max(picks.length, 1);
    const availAtSecond = picks.filter(p => p >= secondUserPick).length / Math.max(picks.length, 1);

    const draftNowEV = player.value;
    const waitOneEV = player.value * availAtNext;
    const waitTwoEV = player.value * availAtSecond;

    let optimalAction: DraftNowVsWaitEV['optimalAction'] = 'draft_now';
    let reasoning = '';

    if (waitOneEV > draftNowEV * 0.85 && availAtNext > 0.7) {
      optimalAction = 'wait_one';
      reasoning = `${(availAtNext * 100).toFixed(0)}% chance still available next pick. Safe to wait and draft a higher-leverage player now.`;
    } else if (waitTwoEV > draftNowEV * 0.7 && availAtSecond > 0.5) {
      optimalAction = 'wait_two';
      reasoning = `${(availAtSecond * 100).toFixed(0)}% chance available in 2 rounds. Patient approach maximizes total draft capital.`;
    } else {
      reasoning = `Only ${(availAtNext * 100).toFixed(0)}% chance available next pick. Draft now or lose the tier entirely.`;
    }

    return {
      playerId: player.playerId,
      draftNowEV: r2(draftNowEV),
      waitOneRoundEV: r2(waitOneEV),
      waitTwoRoundsEV: r2(waitTwoEV),
      optimalAction,
      reasoning,
    };
  });

  const tierCliffs = detectTierCliffs(availablePlayers);
  const positionalRuns = detectPositionalRuns(playerPickMap, availablePlayers, nextUserPick - currentPick);

  const topLeverage = availabilities.slice(0, 3);
  const criticalCliffs = tierCliffs.filter(c => c.urgency === 'critical' || c.urgency === 'high');

  let executiveSummary = '';
  if (criticalCliffs.length > 0) {
    const cliffPos = criticalCliffs.map(c => c.position).join(', ');
    executiveSummary += `Tier cliff detected at ${cliffPos}. `;
  }
  if (topLeverage.length > 0 && topLeverage[0].gonePct > 0.6) {
    executiveSummary += `${topLeverage[0].name} has ${(topLeverage[0].gonePct * 100).toFixed(0)}% probability of being taken before your next pick. `;
  }
  if (positionalRuns.length > 0) {
    executiveSummary += `${positionalRuns[0].position} run likely — ${positionalRuns[0].playersLikelyGone} players projected gone. `;
  }

  if (!executiveSummary) {
    executiveSummary = 'No urgent draft pressure detected. Select best available or target positional need.';
  }

  return {
    availabilities,
    draftNowVsWait,
    tierCliffs,
    positionalRuns,
    executiveSummary,
  };
}

export function buildDraftSimulation(
  availablePlayers: DraftPlayer[],
  userRosterId: number,
  currentPick: number,
  totalTeams: number,
  totalRounds: number,
  rostersByTeam: Map<number, string[]>,
  allPlayers: Record<string, any>,
  iterations: number = 1000
): DraftSimulationResult {
  const remainingPicks = totalRounds * totalTeams - currentPick + 1;
  const draftOrder: number[] = [];
  const userPickPositions: number[] = [];

  for (let pick = currentPick; pick <= totalRounds * totalTeams; pick++) {
    const round = Math.ceil(pick / totalTeams);
    const posInRound = ((pick - 1) % totalTeams);
    const isSnake = round % 2 === 0;
    const teamIdx = isSnake ? totalTeams - 1 - posInRound : posInRound;
    const teamId = teamIdx + 1;

    draftOrder.push(teamId);
    if (teamId === userRosterId) {
      userPickPositions.push(pick);
    }
  }

  const opponents = buildDefaultOpponents(totalTeams, rostersByTeam, allPlayers);

  return simulateDraft(
    availablePlayers, userRosterId, currentPick,
    draftOrder, userPickPositions, opponents, iterations
  );
}
