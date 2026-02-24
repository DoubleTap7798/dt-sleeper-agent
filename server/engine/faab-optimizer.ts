import {
  FAABResult,
  PlayerProjection,
  RosterContext,
  LeagueContext,
  PositionalScarcity,
} from './types';

function betaSample(alpha: number, beta: number): number {
  if (alpha <= 0) alpha = 0.01;
  if (beta <= 0) beta = 0.01;

  const gammaAlpha = gammaSample(alpha);
  const gammaBeta = gammaSample(beta);
  return gammaAlpha / (gammaAlpha + gammaBeta);
}

function gammaSample(shape: number): number {
  if (shape < 1) {
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;

    do {
      x = normalSample();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function normalSample(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function getPositionFromSlot(slot: string): string | null {
  const map: Record<string, string> = {
    QB: 'QB',
    RB: 'RB',
    WR: 'WR',
    TE: 'TE',
    K: 'K',
    DEF: 'DEF',
  };
  return map[slot] || null;
}

function getStarterSlots(rosterPositions: string[]): Record<string, number> {
  const slots: Record<string, number> = {};
  for (const pos of rosterPositions) {
    const mapped = getPositionFromSlot(pos);
    if (mapped) {
      slots[mapped] = (slots[mapped] || 0) + 1;
    }
  }

  const flexCount = rosterPositions.filter(p => p === 'FLEX').length;
  const superFlexCount = rosterPositions.filter(p => p === 'SUPER_FLEX').length;
  const recFlexCount = rosterPositions.filter(p => p === 'REC_FLEX').length;

  if (flexCount > 0) {
    slots['FLEX'] = flexCount;
  }
  if (superFlexCount > 0) {
    slots['SUPER_FLEX'] = superFlexCount;
  }
  if (recFlexCount > 0) {
    slots['REC_FLEX'] = recFlexCount;
  }

  return slots;
}

function isFlexEligible(position: string, slotType: string): boolean {
  if (slotType === 'FLEX') return ['RB', 'WR', 'TE'].includes(position);
  if (slotType === 'SUPER_FLEX') return ['QB', 'RB', 'WR', 'TE'].includes(position);
  if (slotType === 'REC_FLEX') return ['WR', 'TE'].includes(position);
  return false;
}

function computeTeamNeedScore(
  targetPosition: string,
  roster: RosterContext,
  leagueContext: LeagueContext,
  allPlayers: Record<string, any>
): number {
  const slots = getStarterSlots(leagueContext.rosterPositions);

  const positionCounts: Record<string, number> = {};
  const positionStrengths: Record<string, number> = {};

  for (const playerId of roster.players) {
    const player = allPlayers[playerId];
    if (!player?.position) continue;
    const pos = player.position;
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
  }

  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  let worstNeedPosition = '';
  let worstNeedScore = Infinity;

  for (const pos of positions) {
    const required = slots[pos] || 0;
    if (required === 0) continue;
    const have = positionCounts[pos] || 0;
    const depth = have / Math.max(required, 1);
    positionStrengths[pos] = depth;

    if (depth < worstNeedScore) {
      worstNeedScore = depth;
      worstNeedPosition = pos;
    }
  }

  if (worstNeedPosition === targetPosition) return 1.0;

  const targetRequired = slots[targetPosition] || 0;
  if (targetRequired === 0) {
    const flexTypes = ['FLEX', 'SUPER_FLEX', 'REC_FLEX'];
    let hasFlexSlot = false;
    for (const ft of flexTypes) {
      if (slots[ft] && isFlexEligible(targetPosition, ft)) {
        hasFlexSlot = true;
        break;
      }
    }
    if (!hasFlexSlot) return 0.1;
  }

  const targetHave = positionCounts[targetPosition] || 0;
  const targetDepth = targetHave / Math.max(targetRequired, 1);

  if (targetDepth <= 1.0) return 0.9;
  if (targetDepth <= 1.5) return 0.6;
  if (targetDepth <= 2.0) return 0.4;
  return 0.2;
}

function computeExpectedSeasonalValue(
  targetProjection: PlayerProjection,
  targetPosition: string,
  roster: RosterContext,
  leagueContext: LeagueContext,
  allPlayers: Record<string, any>
): number {
  const remainingWeeks = Math.max(
    1,
    leagueContext.totalRegularSeasonWeeks - leagueContext.currentWeek + 1
  );

  let worstStarterMedian = Infinity;
  let foundStarter = false;

  for (const starterId of roster.starters) {
    if (!starterId || starterId === '0') continue;
    const player = allPlayers[starterId];
    if (!player?.position || player.position !== targetPosition) continue;
    foundStarter = true;
    const estimatedMedian = player.fantasy_points_avg || player.search_rank ? (100 - (player.search_rank || 50)) / 5 : 5;
    if (estimatedMedian < worstStarterMedian) {
      worstStarterMedian = estimatedMedian;
    }
  }

  if (!foundStarter) {
    worstStarterMedian = 0;
  }

  const weeklyGain = Math.max(0, targetProjection.median - worstStarterMedian);
  return weeklyGain * remainingWeeks;
}

function computePlayoffScheduleValue(
  targetProjection: PlayerProjection,
  allPlayers: Record<string, any>
): number {
  const team = targetProjection.team;
  if (!team || team === 'FA') return 0;

  const teamPlayers = Object.values(allPlayers).filter(
    (p: any) => p?.team === team && p?.position && ['QB', 'RB', 'WR', 'TE'].includes(p.position)
  );

  const avgRank = teamPlayers.length > 0
    ? teamPlayers.reduce((sum: number, p: any) => sum + (p.search_rank || 50), 0) / teamPlayers.length
    : 50;

  const teamStrength = Math.max(0, Math.min(1, (100 - avgRank) / 100));
  return teamStrength * 0.5;
}

function simulateOpponentBids(
  opponents: RosterContext[],
  targetPosition: string,
  leagueContext: LeagueContext,
  allPlayers: Record<string, any>,
  numSimulations: number
): number[][] {
  const seasonProgress = Math.min(
    1,
    leagueContext.currentWeek / leagueContext.totalRegularSeasonWeeks
  );

  const opponentParams: { need: number; aggression: number; faabPct: number; maxBid: number }[] = [];

  for (const opp of opponents) {
    const need = computeTeamNeedScore(targetPosition, opp, leagueContext, allPlayers);

    const faabPct = leagueContext.waiverBudget > 0
      ? opp.faabRemaining / leagueContext.waiverBudget
      : 0;

    const aggression = 0.3 + 0.7 * seasonProgress;

    opponentParams.push({
      need,
      aggression,
      faabPct,
      maxBid: opp.faabRemaining,
    });
  }

  const simResults: number[][] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const bids: number[] = [];

    for (const params of opponentParams) {
      if (params.maxBid <= 0 || params.need < 0.1) {
        bids.push(0);
        continue;
      }

      const alphaBase = params.need * params.aggression * params.faabPct;
      const alpha = Math.max(0.01, Math.min(alphaBase, 0.99));
      const beta = 1 - alpha;

      const sample = betaSample(alpha, beta);
      const bid = Math.round(sample * params.maxBid);
      bids.push(Math.min(bid, params.maxBid));
    }

    simResults.push(bids);
  }

  return simResults;
}

export function optimizeFAABBid(
  targetPlayerId: string,
  targetProjection: PlayerProjection,
  userRoster: RosterContext,
  allRosters: RosterContext[],
  leagueContext: LeagueContext,
  scarcity: PositionalScarcity[],
  allPlayers: Record<string, any>
): FAABResult {
  const targetPosition = targetProjection.position;

  const teamNeedScore = computeTeamNeedScore(
    targetPosition,
    userRoster,
    leagueContext,
    allPlayers
  );

  const expectedSeasonalValue = computeExpectedSeasonalValue(
    targetProjection,
    targetPosition,
    userRoster,
    leagueContext,
    allPlayers
  );

  const playoffScheduleValue = computePlayoffScheduleValue(
    targetProjection,
    allPlayers
  );

  const opponents = allRosters.filter(r => r.rosterId !== userRoster.rosterId);

  const NUM_SIMULATIONS = 1000;
  const opponentBidSimulations = simulateOpponentBids(
    opponents,
    targetPosition,
    leagueContext,
    allPlayers,
    NUM_SIMULATIONS
  );

  const maxBid = userRoster.faabRemaining;
  const totalValue = expectedSeasonalValue * (1 + playoffScheduleValue) * teamNeedScore;

  const posScarcity = scarcity.find(s => s.position === targetPosition);
  const scarcityMultiplier = posScarcity ? 1 + posScarcity.scarcityIndex * 0.5 : 1;
  const adjustedValue = totalValue * scarcityMultiplier;

  const faabValueRatio = leagueContext.waiverBudget > 0
    ? adjustedValue / leagueContext.waiverBudget
    : 0;

  let bestEV = -Infinity;
  let optimalBid = 0;
  let minimumViableBid = 0;
  let optimalWinProb = 0;
  let foundMinViable = false;

  const stepSize = Math.max(1, Math.floor(maxBid / 100));

  for (let bid = 0; bid <= maxBid; bid += stepSize) {
    let wins = 0;

    for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
      const oppBids = opponentBidSimulations[sim];
      const maxOppBid = Math.max(...oppBids, 0);
      if (bid > maxOppBid) {
        wins++;
      } else if (bid === maxOppBid && bid > 0) {
        wins += 0.5;
      }
    }

    const winProb = wins / NUM_SIMULATIONS;

    const bidCost = leagueContext.waiverBudget > 0
      ? (bid / leagueContext.waiverBudget) * adjustedValue * 0.5
      : 0;

    const ev = winProb * adjustedValue - bidCost;

    if (!foundMinViable && winProb > 0.5) {
      minimumViableBid = bid;
      foundMinViable = true;
    }

    if (ev > bestEV) {
      bestEV = ev;
      optimalBid = bid;
      optimalWinProb = winProb;
    }
  }

  if (stepSize > 1 && optimalBid > 0) {
    const searchStart = Math.max(0, optimalBid - stepSize);
    const searchEnd = Math.min(maxBid, optimalBid + stepSize);

    for (let bid = searchStart; bid <= searchEnd; bid++) {
      let wins = 0;

      for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
        const oppBids = opponentBidSimulations[sim];
        const maxOppBid = Math.max(...oppBids, 0);
        if (bid > maxOppBid) {
          wins++;
        } else if (bid === maxOppBid && bid > 0) {
          wins += 0.5;
        }
      }

      const winProb = wins / NUM_SIMULATIONS;
      const bidCost = leagueContext.waiverBudget > 0
        ? (bid / leagueContext.waiverBudget) * adjustedValue * 0.5
        : 0;
      const ev = winProb * adjustedValue - bidCost;

      if (ev > bestEV) {
        bestEV = ev;
        optimalBid = bid;
        optimalWinProb = winProb;
      }
    }
  }

  if (!foundMinViable && stepSize > 1) {
    for (let bid = 0; bid <= maxBid; bid++) {
      let wins = 0;
      for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
        const oppBids = opponentBidSimulations[sim];
        const maxOppBid = Math.max(...oppBids, 0);
        if (bid > maxOppBid) wins++;
        else if (bid === maxOppBid && bid > 0) wins += 0.5;
      }
      if (wins / NUM_SIMULATIONS > 0.5) {
        minimumViableBid = bid;
        break;
      }
    }
  }

  const aggressionScore = maxBid > 0
    ? Math.min(1, optimalBid / maxBid)
    : 0;

  return {
    playerId: targetPlayerId,
    playerName: targetProjection.playerName,
    minimumViableBid: Math.round(minimumViableBid),
    optimalBid: Math.round(optimalBid),
    probabilityToWin: Math.round(optimalWinProb * 1000) / 1000,
    expectedSeasonalValueGain: Math.round(adjustedValue * 100) / 100,
    aggressionScore: Math.round(aggressionScore * 1000) / 1000,
    teamNeedScore: Math.round(teamNeedScore * 1000) / 1000,
    playoffScheduleValue: Math.round(playoffScheduleValue * 1000) / 1000,
  };
}
