import {
  RosterContext,
  PlayerProjection,
  LeagueContext,
  PortfolioAnalysis,
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
  const recommendation = generateRecommendation(
    diversificationScore,
    injuryFragilityIndex,
    volatilityScore,
    playoffLeverageScore,
    teamConcentration
  );

  return {
    diversificationScore: Math.round(diversificationScore * 1000) / 1000,
    fragilityScore: Math.round(fragilityScore * 1000) / 1000,
    volatilityScore: Math.round(volatilityScore * 1000) / 1000,
    playoffLeverageScore: Math.round(playoffLeverageScore * 1000) / 1000,
    teamConcentration,
    positionalDepth,
    boomBustClustering: Math.round(boomBustClustering * 1000) / 1000,
    injuryFragilityIndex: Math.round(injuryFragilityIndex * 1000) / 1000,
    recommendation,
  };
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

  return Math.min(1, Math.max(0, 1 - hhi));
}

function computeInjuryFragilityIndex(
  roster: RosterContext,
  playerProjections: PlayerProjection[],
  allPlayers: Record<string, any>
): number {
  const positionalWeights: Record<string, number> = {
    QB: 0.3,
    RB: 0.2,
    WR: 0.2,
    TE: 0.15,
    K: 0.1,
    DEF: 0.1,
  };

  const projMap = new Map<string, PlayerProjection>();
  for (const p of playerProjections) {
    projMap.set(p.playerId, p);
  }

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
      else if (status === 'out') severityMultiplier = 1.0;
      else if (status === 'ir') severityMultiplier = 1.0;

      totalFragility += weight * severityMultiplier;
    }
  }

  return Math.min(1, Math.max(0, totalFragility));
}

function computeBoomBustClustering(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>
): number {
  const starterCVs: number[] = [];

  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (!proj || proj.median <= 0) continue;

    const cv = proj.stdDev / proj.median;
    starterCVs.push(cv);
  }

  if (starterCVs.length === 0) return 0.5;

  const avgCV = starterCVs.reduce((a, b) => a + b, 0) / starterCVs.length;
  return Math.min(1, Math.max(0, avgCV));
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

  for (const pos of positions) {
    playersByPosition.set(pos, []);
  }

  for (const playerId of roster.players) {
    const proj = projMap.get(playerId);
    const player = allPlayers[playerId];
    const position = proj?.position || player?.position;
    if (!position || !playersByPosition.has(position)) continue;

    playersByPosition.get(position)!.push({
      id: playerId,
      isStarter: roster.starters.includes(playerId),
      median: proj?.median || 0,
    });
  }

  for (const pos of positions) {
    const players = playersByPosition.get(pos) || [];
    const starters = players.filter(p => p.isStarter).sort((a, b) => b.median - a.median);
    const bench = players.filter(p => !p.isStarter).sort((a, b) => b.median - a.median);

    if (starters.length === 0) {
      depth[pos] = 0;
      continue;
    }

    const worstStarter = starters[starters.length - 1];
    const bestBench = bench.length > 0 ? bench[0] : null;

    if (!bestBench || worstStarter.median <= 0) {
      depth[pos] = 0;
      continue;
    }

    const dropOff = (worstStarter.median - bestBench.median) / worstStarter.median;
    depth[pos] = Math.round(Math.min(1, Math.max(0, 1 - dropOff)) * 1000) / 1000;
  }

  return depth;
}

function computePlayoffScheduleLeverage(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>,
  allPlayers: Record<string, any>,
  leagueContext: LeagueContext
): number {
  const playoffWeeks = [15, 16, 17];
  const starterTeams = new Set<string>();

  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    const player = allPlayers[playerId];
    const team = proj?.team || player?.team;
    if (team && team !== 'FA') {
      starterTeams.add(team);
    }
  }

  if (starterTeams.size === 0) return 0.5;

  const uniqueTeamCount = starterTeams.size;
  const maxTeams = 32;
  const teamSpread = uniqueTeamCount / Math.min(roster.starters.length, maxTeams);

  const starterProjections: number[] = [];
  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (proj) {
      starterProjections.push(proj.median);
    }
  }

  if (starterProjections.length === 0) return 0.5;

  const avgProjection = starterProjections.reduce((a, b) => a + b, 0) / starterProjections.length;
  const hasStrongStarters = avgProjection > 10;

  let leverage = teamSpread * 0.5 + (hasStrongStarters ? 0.3 : 0.1);

  const byeWeeks = new Set<number>();
  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (proj?.byeWeek && playoffWeeks.includes(proj.byeWeek)) {
      leverage -= 0.1;
    }
    if (proj?.byeWeek) {
      byeWeeks.add(proj.byeWeek);
    }
  }

  return Math.min(1, Math.max(0, leverage));
}

function computeVolatilityScore(
  roster: RosterContext,
  projMap: Map<string, PlayerProjection>
): number {
  const stdDevs: number[] = [];

  for (const playerId of roster.starters) {
    const proj = projMap.get(playerId);
    if (proj) {
      stdDevs.push(proj.stdDev);
    }
  }

  if (stdDevs.length === 0) return 0.5;

  const avgStdDev = stdDevs.reduce((a, b) => a + b, 0) / stdDevs.length;
  const maxReasonableStdDev = 10;

  return Math.min(1, Math.max(0, avgStdDev / maxReasonableStdDev));
}

function generateRecommendation(
  diversificationScore: number,
  injuryFragilityIndex: number,
  volatilityScore: number,
  playoffLeverageScore: number,
  teamConcentration: Record<string, number>
): string {
  const maxConcentration = Math.max(...Object.values(teamConcentration), 0);

  if (maxConcentration >= 4 || diversificationScore < 0.5) {
    return 'HIGH CONCENTRATION RISK - DIVERSIFY';
  }

  if (injuryFragilityIndex > 0.5) {
    return 'INJURY FRAGILE - ADD DEPTH';
  }

  if (volatilityScore > 0.6) {
    return 'HIGH VOLATILITY - STABILIZE FLOOR';
  }

  if (playoffLeverageScore < 0.3) {
    return 'PLAYOFF SCHEDULE UNFAVORABLE - CONSIDER TRADES';
  }

  return 'ROSTER IS WELL-BALANCED';
}
