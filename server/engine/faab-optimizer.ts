import {
  FAABResult,
  PlayerProjection,
  RosterContext,
  LeagueContext,
  PositionalScarcity,
} from './types';

function normalSample(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function logNormalSample(mu: number, sigma: number): number {
  const z = normalSample();
  return Math.exp(mu + sigma * z);
}

function getPositionFromSlot(slot: string): string | null {
  const map: Record<string, string> = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', K: 'K', DEF: 'DEF' };
  return map[slot] || null;
}

function getStarterSlots(rosterPositions: string[]): Record<string, number> {
  const slots: Record<string, number> = {};
  for (const pos of rosterPositions) {
    const mapped = getPositionFromSlot(pos);
    if (mapped) slots[mapped] = (slots[mapped] || 0) + 1;
  }
  const flexCount = rosterPositions.filter(p => p === 'FLEX').length;
  const superFlexCount = rosterPositions.filter(p => p === 'SUPER_FLEX').length;
  const recFlexCount = rosterPositions.filter(p => p === 'REC_FLEX').length;
  if (flexCount > 0) slots['FLEX'] = flexCount;
  if (superFlexCount > 0) slots['SUPER_FLEX'] = superFlexCount;
  if (recFlexCount > 0) slots['REC_FLEX'] = recFlexCount;
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

  for (const playerId of roster.players) {
    const player = allPlayers[playerId];
    if (!player?.position) continue;
    positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
  }

  const positions = ['QB', 'RB', 'WR', 'TE'];
  let worstNeedPosition = '';
  let worstNeedDepth = Infinity;

  for (const pos of positions) {
    const required = slots[pos] || 0;
    if (required === 0) continue;
    const have = positionCounts[pos] || 0;
    const depth = have / Math.max(required, 1);
    if (depth < worstNeedDepth) {
      worstNeedDepth = depth;
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
    if (!hasFlexSlot) return 0.05;
  }

  const targetHave = positionCounts[targetPosition] || 0;
  const targetDepth = targetHave / Math.max(targetRequired || 1, 1);

  if (targetDepth <= 1.0) return 0.9;
  if (targetDepth <= 1.5) return 0.6;
  if (targetDepth <= 2.0) return 0.35;
  return 0.15;
}

function computeContenderScore(roster: RosterContext, numTeams: number): number {
  const totalGames = roster.wins + roster.losses + roster.ties;
  if (totalGames === 0) return 0.5;
  const winRate = roster.wins / totalGames;
  const rankPct = 1 - (roster.rank - 1) / Math.max(numTeams - 1, 1);
  return winRate * 0.6 + rankPct * 0.4;
}

function computeExpectedSeasonalValue(
  targetProjection: PlayerProjection,
  targetPosition: string,
  roster: RosterContext,
  leagueContext: LeagueContext,
  allPlayers: Record<string, any>
): number {
  const remainingWeeks = Math.max(1, leagueContext.totalRegularSeasonWeeks - leagueContext.currentWeek + 1);

  let worstStarterMedian = Infinity;
  let foundStarter = false;

  for (const starterId of roster.starters) {
    if (!starterId || starterId === '0') continue;
    const player = allPlayers[starterId];
    if (!player?.position || player.position !== targetPosition) continue;
    foundStarter = true;

    const playerScores = targetProjection.weeklyScores;
    let estimatedMedian: number;

    if (player.fantasy_points_avg && player.fantasy_points_avg > 0) {
      estimatedMedian = player.fantasy_points_avg;
    } else {
      const rank = player.search_rank || 200;
      if (rank <= 20) estimatedMedian = 15;
      else if (rank <= 50) estimatedMedian = 10;
      else if (rank <= 100) estimatedMedian = 7;
      else if (rank <= 200) estimatedMedian = 4;
      else estimatedMedian = 2;
    }

    if (estimatedMedian < worstStarterMedian) {
      worstStarterMedian = estimatedMedian;
    }
  }

  if (!foundStarter) worstStarterMedian = 0;

  const weeklyGain = Math.max(0, targetProjection.median - worstStarterMedian);
  return weeklyGain * remainingWeeks;
}

export interface EnhancedFAABResult extends FAABResult {
  aggressiveBid: number;
  aggressiveWinProb: number;
  winProbCurve: Array<{ bid: number; winProb: number; netEV: number }>;
  competingBidRange: { p25: number; p50: number; p75: number; mean: number };
  budgetImpact: {
    currentBudget: number;
    initialBudget: number;
    budgetPctRemaining: number;
    budgetAfterOptimal: number;
    budgetPctAfterOptimal: number;
    leagueAvgBudget: number;
    leagueAvgPct: number;
  };
  positionScarcity: number;
  contenderScore: number;
  remainingWeeks: number;
  opportunityCost: number;
}

export function optimizeFAABBid(
  targetPlayerId: string,
  targetProjection: PlayerProjection,
  userRoster: RosterContext,
  allRosters: RosterContext[],
  leagueContext: LeagueContext,
  scarcity: PositionalScarcity[],
  allPlayers: Record<string, any>
): EnhancedFAABResult {
  const targetPosition = targetProjection.position;
  const waiverBudget = leagueContext.waiverBudget || 100;
  const maxBid = userRoster.faabRemaining;
  const numTeams = allRosters.length;
  const remainingWeeks = Math.max(1, leagueContext.totalRegularSeasonWeeks - leagueContext.currentWeek + 1);
  const totalWeeks = leagueContext.totalRegularSeasonWeeks;
  const seasonProgress = Math.min(1, leagueContext.currentWeek / totalWeeks);

  const teamNeedScore = computeTeamNeedScore(targetPosition, userRoster, leagueContext, allPlayers);
  const userContenderScore = computeContenderScore(userRoster, numTeams);

  const expectedSeasonalValue = computeExpectedSeasonalValue(
    targetProjection, targetPosition, userRoster, leagueContext, allPlayers
  );

  const posScarcity = scarcity.find(s => s.position === targetPosition);
  const scarcityMultiplier = posScarcity ? 1 + posScarcity.scarcityIndex * 0.3 : 1;
  const adjustedValue = expectedSeasonalValue * scarcityMultiplier;

  const opponents = allRosters.filter(r => r.rosterId !== userRoster.rosterId);

  const NUM_SIMULATIONS = 5000;

  const opponentBidProfiles = opponents.map(opp => {
    const need = computeTeamNeedScore(targetPosition, opp, leagueContext, allPlayers);
    const budgetPct = waiverBudget > 0 ? opp.faabRemaining / waiverBudget : 0;
    const contender = computeContenderScore(opp, numTeams);
    const aggression = 0.3 + 0.4 * seasonProgress + 0.3 * contender;

    const bidProportion = need * aggression * budgetPct;
    const meanBid = bidProportion * opp.faabRemaining;

    const sigma = 0.6 + (1 - need) * 0.4;
    const mu = meanBid > 0 ? Math.log(Math.max(meanBid, 0.5)) - (sigma * sigma) / 2 : -10;

    return { need, budgetPct, contender, meanBid, mu, sigma, maxBid: opp.faabRemaining };
  });

  const simMaxBids: number[] = new Array(NUM_SIMULATIONS);

  for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
    let maxOppBid = 0;

    for (const profile of opponentBidProfiles) {
      if (profile.maxBid <= 0 || profile.need < 0.05) continue;

      const skipProb = 1 - Math.min(profile.need, 0.95);
      if (Math.random() < skipProb * 0.5) continue;

      const rawBid = logNormalSample(profile.mu, profile.sigma);
      const bid = Math.max(0, Math.min(Math.round(rawBid), profile.maxBid));
      if (bid > maxOppBid) maxOppBid = bid;
    }

    simMaxBids[sim] = maxOppBid;
  }

  const sortedSimBids = [...simMaxBids].sort((a, b) => a - b);
  const p25 = sortedSimBids[Math.floor(NUM_SIMULATIONS * 0.25)] || 0;
  const p50 = sortedSimBids[Math.floor(NUM_SIMULATIONS * 0.50)] || 0;
  const p75 = sortedSimBids[Math.floor(NUM_SIMULATIONS * 0.75)] || 0;
  const meanCompBid = Math.round(sortedSimBids.reduce((a, b) => a + b, 0) / NUM_SIMULATIONS);

  const budgetScarcityFactor = remainingWeeks <= 3 ? 0.3 : remainingWeeks <= 6 ? 0.5 : 0.8;

  const winProbCurve: Array<{ bid: number; winProb: number; netEV: number }> = [];
  let bestEV = -Infinity;
  let optimalBid = 0;
  let optimalWinProb = 0;
  let minimumViableBid = maxBid;
  let aggressiveBid = maxBid;
  let aggressiveWinProb = 0;
  let foundMinViable = false;
  let foundAggressive = false;

  const stepSize = maxBid <= 100 ? 1 : Math.max(1, Math.floor(maxBid / 100));

  for (let bid = 0; bid <= maxBid; bid += stepSize) {
    let wins = 0;

    for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
      if (bid > simMaxBids[sim]) wins++;
      else if (bid === simMaxBids[sim] && bid > 0) wins += 0.5;
    }

    const winProb = wins / NUM_SIMULATIONS;
    const opportunityCost = (bid / Math.max(waiverBudget, 1)) * budgetScarcityFactor * adjustedValue * 0.3;
    const netEV = winProb * adjustedValue - opportunityCost;

    winProbCurve.push({ bid, winProb: Math.round(winProb * 1000) / 1000, netEV: Math.round(netEV * 100) / 100 });

    if (!foundMinViable && winProb >= 0.5) {
      minimumViableBid = bid;
      foundMinViable = true;
    }

    if (!foundAggressive && winProb >= 0.75) {
      aggressiveBid = bid;
      aggressiveWinProb = winProb;
      foundAggressive = true;
    }

    if (netEV > bestEV) {
      bestEV = netEV;
      optimalBid = bid;
      optimalWinProb = winProb;
    }
  }

  if (!foundMinViable) minimumViableBid = maxBid;
  if (!foundAggressive) {
    aggressiveBid = maxBid;
    aggressiveWinProb = winProbCurve.length > 0 ? winProbCurve[winProbCurve.length - 1].winProb : 0;
  }

  if (stepSize > 1 && optimalBid > 0) {
    const searchStart = Math.max(0, optimalBid - stepSize);
    const searchEnd = Math.min(maxBid, optimalBid + stepSize);
    for (let bid = searchStart; bid <= searchEnd; bid++) {
      let wins = 0;
      for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
        if (bid > simMaxBids[sim]) wins++;
        else if (bid === simMaxBids[sim] && bid > 0) wins += 0.5;
      }
      const winProb = wins / NUM_SIMULATIONS;
      const opportunityCost = (bid / Math.max(waiverBudget, 1)) * budgetScarcityFactor * adjustedValue * 0.3;
      const netEV = winProb * adjustedValue - opportunityCost;
      if (netEV > bestEV) {
        bestEV = netEV;
        optimalBid = bid;
        optimalWinProb = winProb;
      }
    }
  }

  const leagueAvgBudget = allRosters.reduce((sum, r) => sum + r.faabRemaining, 0) / allRosters.length;
  const leagueAvgPct = waiverBudget > 0 ? leagueAvgBudget / waiverBudget : 0;
  const opportunityCostFinal = (optimalBid / Math.max(waiverBudget, 1)) * budgetScarcityFactor * adjustedValue * 0.3;

  return {
    playerId: targetPlayerId,
    playerName: targetProjection.playerName,
    minimumViableBid: Math.round(minimumViableBid),
    optimalBid: Math.round(optimalBid),
    probabilityToWin: Math.round(optimalWinProb * 1000) / 1000,
    expectedSeasonalValueGain: Math.round(adjustedValue * 100) / 100,
    aggressionScore: maxBid > 0 ? Math.round((optimalBid / maxBid) * 1000) / 1000 : 0,
    teamNeedScore: Math.round(teamNeedScore * 1000) / 1000,
    playoffScheduleValue: 0,
    aggressiveBid: Math.round(aggressiveBid),
    aggressiveWinProb: Math.round(aggressiveWinProb * 1000) / 1000,
    winProbCurve,
    competingBidRange: { p25, p50, p75, mean: meanCompBid },
    budgetImpact: {
      currentBudget: userRoster.faabRemaining,
      initialBudget: waiverBudget,
      budgetPctRemaining: waiverBudget > 0 ? Math.round((userRoster.faabRemaining / waiverBudget) * 1000) / 10 : 0,
      budgetAfterOptimal: Math.max(0, userRoster.faabRemaining - optimalBid),
      budgetPctAfterOptimal: waiverBudget > 0 ? Math.round((Math.max(0, userRoster.faabRemaining - optimalBid) / waiverBudget) * 1000) / 10 : 0,
      leagueAvgBudget: Math.round(leagueAvgBudget),
      leagueAvgPct: Math.round(leagueAvgPct * 1000) / 10,
    },
    positionScarcity: posScarcity?.scarcityIndex || 0,
    contenderScore: Math.round(userContenderScore * 1000) / 1000,
    remainingWeeks,
    opportunityCost: Math.round(opportunityCostFinal * 100) / 100,
  };
}
