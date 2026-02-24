import {
  RosterContext,
  PlayerProjection,
  LeagueContext,
  PortfolioAnalysis,
  PortfolioArchetype,
  ImpactTranslation,
  StressTestResult,
  WhatIfScenario,
} from './types';

export function analyzePortfolio(
  roster: RosterContext,
  playerProjections: PlayerProjection[],
  allPlayers: Record<string, any>,
  leagueContext: LeagueContext
): PortfolioAnalysis {
  const projMap = new Map<string, PlayerProjection>();
  for (const p of playerProjections) {
    projMap.set(p.playerId, p);
  }

  const teamConcentration = computeTeamConcentration(roster, allPlayers);
  const diversificationScore = computeDiversificationScore(teamConcentration, roster.players.length);
  const injuryFragilityIndex = computeInjuryFragilityIndex(roster, playerProjections, allPlayers);
  const boomBustClustering = computeBoomBustClustering(roster, projMap);
  const positionalDepth = computePositionalDepthResilience(roster, projMap, allPlayers, leagueContext);
  const playoffLeverageScore = computePlayoffScheduleLeverage(roster, projMap, allPlayers, leagueContext);
  const volatilityScore = computeVolatilityScore(roster, projMap);
  const fragilityScore = injuryFragilityIndex;

  const totalWeeklyVariance = computeTotalWeeklyVariance(roster, projMap);
  const baselinePlayoffProb = estimatePlayoffProb(roster, leagueContext);
  const baselineTitleEquity = estimateTitleEquity(roster, leagueContext, totalWeeklyVariance);

  const impactTranslations = computeImpactTranslations(
    diversificationScore, fragilityScore, volatilityScore, playoffLeverageScore,
    totalWeeklyVariance, baselinePlayoffProb, baselineTitleEquity
  );

  const stressTests = computeStressTests(
    roster, projMap, allPlayers, teamConcentration, baselineTitleEquity, leagueContext
  );

  const archetype = classifyArchetype(diversificationScore, fragilityScore, volatilityScore, boomBustClustering);
  const { label: archetypeLabel, description: archetypeDescription } = getArchetypeInfo(archetype);

  const whatIfScenarios = computeWhatIfScenarios(
    diversificationScore, fragilityScore, volatilityScore,
    totalWeeklyVariance, baselineTitleEquity, teamConcentration
  );

  const recommendation = generateRecommendation(
    diversificationScore, injuryFragilityIndex, volatilityScore, playoffLeverageScore, teamConcentration
  );

  return {
    diversificationScore: r3(diversificationScore),
    fragilityScore: r3(fragilityScore),
    volatilityScore: r3(volatilityScore),
    playoffLeverageScore: r3(playoffLeverageScore),
    teamConcentration,
    positionalDepth,
    boomBustClustering: r3(boomBustClustering),
    injuryFragilityIndex: r3(injuryFragilityIndex),
    recommendation,
    archetype,
    archetypeLabel,
    archetypeDescription,
    impactTranslations,
    stressTests,
    whatIfScenarios,
    totalWeeklyVariance: r3(totalWeeklyVariance),
    baselinePlayoffProb: r3(baselinePlayoffProb),
    baselineTitleEquity: r3(baselineTitleEquity),
  };
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

function computeTotalWeeklyVariance(roster: RosterContext, projMap: Map<string, PlayerProjection>): number {
  let totalVar = 0;
  for (const pid of roster.starters) {
    const proj = projMap.get(pid);
    if (proj) totalVar += proj.variance || (proj.stdDev * proj.stdDev);
  }
  return totalVar;
}

function estimatePlayoffProb(roster: RosterContext, ctx: LeagueContext): number {
  const winPct = roster.wins / Math.max(1, roster.wins + roster.losses + roster.ties);
  const weeksLeft = Math.max(1, ctx.totalRegularSeasonWeeks - ctx.currentWeek);
  const playoffSlots = ctx.playoffTeams / ctx.totalRosters;
  const base = winPct * 0.6 + playoffSlots * 0.3 + (roster.rank <= ctx.playoffTeams ? 0.1 : 0);
  return clamp(base);
}

function estimateTitleEquity(roster: RosterContext, ctx: LeagueContext, weeklyVariance: number): number {
  const playoffProb = estimatePlayoffProb(roster, ctx);
  const ptsPerGame = roster.fpts / Math.max(1, roster.wins + roster.losses + roster.ties);
  const strengthFactor = clamp(ptsPerGame / 130, 0.3, 1.0);
  const variancePenalty = clamp(1 - (weeklyVariance / 800), 0.5, 1.0);
  const playoffRounds = 3;
  const winPerRound = strengthFactor * variancePenalty;
  const champProb = playoffProb * Math.pow(winPerRound, playoffRounds);
  return clamp(champProb * 0.8, 0, 0.5);
}

function computeImpactTranslations(
  divScore: number, fragScore: number, volScore: number, leverageScore: number,
  totalVariance: number, playoffProb: number, titleEquity: number
): PortfolioAnalysis['impactTranslations'] {
  const sqrtVar = Math.sqrt(totalVariance);

  return {
    diversification: {
      weeklyVariancePts: r3((1 - divScore) * sqrtVar * 0.25),
      playoffProbDelta: r3((divScore - 0.7) * 0.08),
      titleEquityDelta: r3((divScore - 0.7) * titleEquity * 0.15),
    },
    fragility: {
      weeklyVariancePts: r3(fragScore * sqrtVar * 0.3),
      playoffProbDelta: r3(-fragScore * 0.12),
      titleEquityDelta: r3(-fragScore * titleEquity * 0.25),
    },
    volatility: {
      weeklyVariancePts: r3(volScore * sqrtVar * 0.4),
      playoffProbDelta: r3(-volScore * 0.06 + 0.02),
      titleEquityDelta: r3(volScore > 0.5 ? -volScore * titleEquity * 0.1 : volScore * titleEquity * 0.05),
    },
    playoffLeverage: {
      weeklyVariancePts: r3((1 - leverageScore) * 1.5),
      playoffProbDelta: r3((leverageScore - 0.5) * 0.1),
      titleEquityDelta: r3((leverageScore - 0.5) * titleEquity * 0.2),
    },
  };
}

function computeStressTests(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>,
  allPlayers: Record<string, any>,
  teamConcentration: Record<string, number>,
  baselineTitleEquity: number,
  leagueContext: LeagueContext
): StressTestResult[] {
  const sortedTeams = Object.entries(teamConcentration)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return sortedTeams.map(([team, count]) => {
    let projLoss = 0;
    for (const pid of roster.starters) {
      const player = allPlayers[pid];
      const proj = projMap.get(pid);
      if (player?.team === team && proj) {
        projLoss += proj.median * 0.6;
      }
    }

    const ptsPerGame = roster.fpts / Math.max(1, roster.wins + roster.losses + roster.ties);
    const reducedPts = Math.max(60, ptsPerGame - projLoss);
    const strengthHit = clamp(reducedPts / 130, 0.2, 1.0);
    const playoffProb = estimatePlayoffProb(roster, leagueContext);
    const newTitleEquity = clamp(playoffProb * Math.pow(strengthHit * 0.85, 3) * 0.8, 0, 0.5);

    return {
      team,
      playerCount: count,
      projectedLoss: r3(projLoss),
      titleEquityBefore: r3(baselineTitleEquity),
      titleEquityAfter: r3(newTitleEquity),
      titleEquityDelta: r3(newTitleEquity - baselineTitleEquity),
    };
  });
}

function classifyArchetype(
  divScore: number, fragScore: number, volScore: number, boomBust: number
): PortfolioArchetype {
  if (volScore > 0.6 && fragScore > 0.4) return 'glass_cannon';
  if (divScore > 0.75 && volScore < 0.35 && fragScore < 0.2) return 'fortress';
  if (divScore > 0.6 && volScore < 0.5 && fragScore < 0.3) return 'balanced_contender';
  if (volScore > 0.5 && boomBust > 0.4) return 'volatile_lottery';
  if (divScore < 0.5) return 'concentrated_bet';
  return 'depth_resilient';
}

function getArchetypeInfo(archetype: PortfolioArchetype): { label: string; description: string } {
  const map: Record<PortfolioArchetype, { label: string; description: string }> = {
    glass_cannon: {
      label: 'Glass Cannon',
      description: 'High ceiling roster with critical fragility exposure. One injury away from collapse.',
    },
    fortress: {
      label: 'Fortress',
      description: 'Well-diversified, low-volatility portfolio. Built to survive adversity and grind out wins.',
    },
    balanced_contender: {
      label: 'Balanced Contender',
      description: 'Strong foundation with manageable risk. Positioned for sustained playoff runs.',
    },
    volatile_lottery: {
      label: 'Volatile Lottery',
      description: 'High-variance portfolio that wins big or loses big. Boom-or-bust weekly outcomes.',
    },
    concentrated_bet: {
      label: 'Concentrated Bet',
      description: 'Heavy exposure to few NFL teams. Correlated outcomes amplify both upside and downside.',
    },
    depth_resilient: {
      label: 'Depth Resilient',
      description: 'Solid bench depth absorbs starter losses. Consistency over ceiling.',
    },
  };
  return map[archetype];
}

function computeWhatIfScenarios(
  divScore: number, fragScore: number, volScore: number,
  totalVariance: number, baselineTitleEquity: number,
  teamConcentration: Record<string, number>
): WhatIfScenario[] {
  const scenarios: WhatIfScenario[] = [];
  const maxConc = Math.max(...Object.values(teamConcentration), 0);
  const sqrtVar = Math.sqrt(totalVariance);

  scenarios.push({
    id: 'remove_concentrated',
    label: 'Shed Top Stack',
    description: `Trade away 1 player from your most concentrated NFL team (${maxConc} players stacked)`,
    riskDelta: {
      diversification: r3(clamp(divScore + 0.08) - divScore),
      fragility: r3(-0.03),
      volatility: r3(-0.02),
    },
    titleEquityDelta: r3(maxConc >= 3 ? baselineTitleEquity * 0.06 : baselineTitleEquity * 0.02),
    weeklyVarianceDelta: r3(-sqrtVar * 0.08),
  });

  scenarios.push({
    id: 'add_low_vol',
    label: 'Add Floor Player',
    description: 'Replace a boom/bust bench piece with a high-floor, low-variance starter',
    riskDelta: {
      diversification: r3(0.02),
      fragility: r3(-0.05),
      volatility: r3(clamp(volScore - 0.08) - volScore),
    },
    titleEquityDelta: r3(volScore > 0.4 ? baselineTitleEquity * 0.04 : baselineTitleEquity * 0.01),
    weeklyVarianceDelta: r3(-sqrtVar * 0.12),
  });

  scenarios.push({
    id: 'diversify_exposure',
    label: 'Diversify Exposure',
    description: 'Trade a stacked pair for assets on different NFL teams',
    riskDelta: {
      diversification: r3(clamp(divScore + 0.12) - divScore),
      fragility: r3(-0.02),
      volatility: r3(-0.04),
    },
    titleEquityDelta: r3(divScore < 0.65 ? baselineTitleEquity * 0.08 : baselineTitleEquity * 0.03),
    weeklyVarianceDelta: r3(-sqrtVar * 0.15),
  });

  scenarios.push({
    id: 'add_handcuff',
    label: 'Handcuff Key RB',
    description: 'Add the backup RB for your most fragile starter to hedge injury risk',
    riskDelta: {
      diversification: r3(-0.01),
      fragility: r3(-0.12),
      volatility: r3(0.01),
    },
    titleEquityDelta: r3(fragScore > 0.3 ? baselineTitleEquity * 0.05 : baselineTitleEquity * 0.01),
    weeklyVarianceDelta: r3(-sqrtVar * 0.05),
  });

  return scenarios;
}

function computeTeamConcentration(
  roster: RosterContext,
  allPlayers: Record<string, any>
): Record<string, number> {
  const teamCounts: Record<string, number> = {};
  for (const playerId of roster.players) {
    const player = allPlayers[playerId];
    const team = player?.team || 'FA';
    if (team === 'FA') continue;
    teamCounts[team] = (teamCounts[team] || 0) + 1;
  }
  return teamCounts;
}

function computeDiversificationScore(
  teamConcentration: Record<string, number>,
  totalPlayers: number
): number {
  if (totalPlayers <= 1) return 0;
  const counts = Object.values(teamConcentration);
  const activePlayers = counts.reduce((a, b) => a + b, 0);
  if (activePlayers <= 1) return 0;
  let hhi = 0;
  for (const count of counts) {
    const share = count / activePlayers;
    hhi += share * share;
  }
  return clamp(1 - hhi);
}

function computeInjuryFragilityIndex(
  roster: RosterContext,
  playerProjections: PlayerProjection[],
  allPlayers: Record<string, any>
): number {
  const positionalWeights: Record<string, number> = {
    QB: 0.3, RB: 0.2, WR: 0.2, TE: 0.15, K: 0.1, DEF: 0.1,
  };
  const projMap = new Map<string, PlayerProjection>();
  for (const p of playerProjections) projMap.set(p.playerId, p);

  let totalFragility = 0;
  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (!proj) continue;
    const injuryStatuses = ['questionable', 'doubtful', 'out', 'ir'];
    if (proj.injuryStatus && injuryStatuses.includes(proj.injuryStatus.toLowerCase())) {
      const weight = positionalWeights[proj.position] || 0.1;
      let severityMultiplier = 1.0;
      const status = proj.injuryStatus.toLowerCase();
      if (status === 'questionable') severityMultiplier = 0.3;
      else if (status === 'doubtful') severityMultiplier = 0.7;
      else if (status === 'out' || status === 'ir') severityMultiplier = 1.0;
      totalFragility += weight * severityMultiplier;
    }
  }
  return clamp(totalFragility);
}

function computeBoomBustClustering(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>
): number {
  const starterCVs: number[] = [];
  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (!proj || proj.median <= 0) continue;
    starterCVs.push(proj.stdDev / proj.median);
  }
  if (starterCVs.length === 0) return 0.5;
  return clamp(starterCVs.reduce((a, b) => a + b, 0) / starterCVs.length);
}

function computePositionalDepthResilience(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>,
  allPlayers: Record<string, any>,
  leagueContext: LeagueContext
): Record<string, number> {
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const depth: Record<string, number> = {};
  const playersByPosition = new Map<string, { id: string; isStarter: boolean; median: number }[]>();
  for (const pos of positions) playersByPosition.set(pos, []);

  for (const playerId of roster.players) {
    const proj = projMap.get(playerId);
    const player = allPlayers[playerId];
    const position = proj?.position || player?.position;
    if (!position || !playersByPosition.has(position)) continue;
    playersByPosition.get(position)!.push({
      id: playerId, isStarter: roster.starters.includes(playerId), median: proj?.median || 0,
    });
  }

  for (const pos of positions) {
    const players = playersByPosition.get(pos) || [];
    const starters = players.filter(p => p.isStarter).sort((a, b) => b.median - a.median);
    const bench = players.filter(p => !p.isStarter).sort((a, b) => b.median - a.median);
    if (starters.length === 0) { depth[pos] = 0; continue; }
    const worstStarter = starters[starters.length - 1];
    const bestBench = bench.length > 0 ? bench[0] : null;
    if (!bestBench || worstStarter.median <= 0) { depth[pos] = 0; continue; }
    const dropOff = (worstStarter.median - bestBench.median) / worstStarter.median;
    depth[pos] = r3(clamp(1 - dropOff));
  }
  return depth;
}

function computePlayoffScheduleLeverage(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>,
  allPlayers: Record<string, any>,
  leagueContext: LeagueContext
): number {
  const starterTeams = new Set<string>();
  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    const player = allPlayers[playerId];
    const team = proj?.team || player?.team;
    if (team && team !== 'FA') starterTeams.add(team);
  }
  if (starterTeams.size === 0) return 0.5;

  const teamSpread = starterTeams.size / Math.min(roster.starters.length, 32);
  const starterProjections: number[] = [];
  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (proj) starterProjections.push(proj.median);
  }
  if (starterProjections.length === 0) return 0.5;

  const avgProjection = starterProjections.reduce((a, b) => a + b, 0) / starterProjections.length;
  let leverage = teamSpread * 0.5 + (avgProjection > 10 ? 0.3 : 0.1);

  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (proj?.byeWeek && [15, 16, 17].includes(proj.byeWeek)) leverage -= 0.1;
  }
  return clamp(leverage);
}

function computeVolatilityScore(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>
): number {
  const stdDevs: number[] = [];
  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (proj) stdDevs.push(proj.stdDev);
  }
  if (stdDevs.length === 0) return 0.5;
  return clamp(stdDevs.reduce((a, b) => a + b, 0) / stdDevs.length / 10);
}

function generateRecommendation(
  diversificationScore: number,
  injuryFragilityIndex: number,
  volatilityScore: number,
  playoffLeverageScore: number,
  teamConcentration: Record<string, number>
): string {
  const maxConcentration = Math.max(...Object.values(teamConcentration), 0);
  if (maxConcentration >= 4 || diversificationScore < 0.5) return 'HIGH CONCENTRATION RISK - DIVERSIFY';
  if (injuryFragilityIndex > 0.5) return 'INJURY FRAGILE - ADD DEPTH';
  if (volatilityScore > 0.6) return 'HIGH VOLATILITY - STABILIZE FLOOR';
  if (playoffLeverageScore < 0.3) return 'PLAYOFF SCHEDULE UNFAVORABLE - CONSIDER TRADES';
  return 'ROSTER IS WELL-BALANCED';
}
