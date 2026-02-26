import type {
  LeagueContext,
  RosterContext,
  StandingsEntry,
  PlayerProjection,
  CorrelationMatrix,
  PositionalScarcity,
  DecisionMetrics,
  SimulationResult,
  SeasonSimResult,
  TradeEvalResult,
  FAABResult,
  UserRiskProfile,
  PortfolioAnalysis,
  ChampionshipPath,
} from './types';
import { simulateMatchup, simulateSeason } from './monte-carlo';
import { evaluateTrade } from './trade-eval';
import { optimizeFAABBid } from './faab-optimizer';
import { analyzePortfolio } from './portfolio-analyzer';
import { computeChampionshipPath, computeChampionshipDelta } from './championship-path';
import { analyzeRiskProfile, getRecommendationAdjustment } from './risk-profiler';
import {
  getLeagueContext,
  getRosterContext,
  getAllRosterContexts,
  getStandings,
  getPlayerProjections,
  getMatchupContext,
  getPositionalScarcity,
} from './data-ingestion';
import { buildCorrelationMatrix } from './projection-model';
import * as sleeperApi from '../sleeper-api';

export interface MatchupAnalysisResult {
  simulation: SimulationResult;
  userLineup: { playerId: string; name: string; position: string; median: number; floor: number; ceiling: number }[];
  opponentLineup: { playerId: string; name: string; position: string; median: number; floor: number; ceiling: number }[];
  keyMatchups: { description: string; advantage: 'user' | 'opponent' | 'even'; delta: number }[];
  riskAssessment: string;
}

export interface LineupOptimizationResult {
  currentLineup: { playerId: string; name: string; position: string; projected: number }[];
  optimizedLineup: { playerId: string; name: string; position: string; projected: number }[];
  swaps: { out: string; in: string; evDelta: number; reason: string }[];
  totalEvGain: number;
  winProbabilityChange: number;
  confidence: number;
}

export interface SeasonOutlookResult {
  seasonSim: SeasonSimResult;
  championshipPath: ChampionshipPath;
  portfolio: PortfolioAnalysis;
  standings: StandingsEntry[];
  strengths: string[];
  weaknesses: string[];
}

export interface FullTradeAnalysis {
  tradeEval: TradeEvalResult;
  championshipDelta: { currentOdds: number; newOdds: number; delta: number };
  decision: DecisionMetrics;
}

export interface WaiverAnalysis {
  faabResult: FAABResult & Record<string, any>;
  decision: DecisionMetrics;
  rosterImpact: { positionFilled: string; playerDropped: string | null; netEvGain: number };
}

function computeDecisionMetrics(
  evDelta: number,
  winProbShift: number,
  playoffProbShift: number,
  champProbShift: number,
  confidence: number,
): DecisionMetrics {
  const riskLevel = Math.abs(evDelta) < 5 ? 'low' : Math.abs(evDelta) < 15 ? 'medium' : 'high';

  let recommendation: DecisionMetrics['recommendation'];
  const score = evDelta * 0.3 + champProbShift * 100 * 0.4 + playoffProbShift * 100 * 0.2 + winProbShift * 100 * 0.1;

  if (score > 10) recommendation = 'strong_yes';
  else if (score > 3) recommendation = 'lean_yes';
  else if (score > -3) recommendation = 'neutral';
  else if (score > -10) recommendation = 'lean_no';
  else recommendation = 'strong_no';

  return {
    evDelta,
    winProbabilityShift: winProbShift,
    playoffProbabilityShift: playoffProbShift,
    championshipProbabilityShift: champProbShift,
    confidence: Math.max(0.1, Math.min(0.99, confidence)),
    riskLevel,
    recommendation,
  };
}

export async function runMatchupAnalysis(
  leagueId: string,
  sleeperUserId: string,
  week: number,
): Promise<MatchupAnalysisResult> {
  const [leagueCtx, matchupCtx] = await Promise.all([
    getLeagueContext(leagueId),
    getMatchupContext(leagueId, sleeperUserId, week),
  ]);

  const allPlayers = await sleeperApi.getAllPlayers();
  const allProjections = [...matchupCtx.userProjections, ...matchupCtx.opponentProjections];
  const corrMatrix = buildCorrelationMatrix(allProjections, allPlayers);

  const simulation = simulateMatchup(
    matchupCtx.userProjections,
    matchupCtx.opponentProjections,
    corrMatrix,
  );

  const userLineup = matchupCtx.userProjections.map(p => ({
    playerId: p.playerId,
    name: p.playerName,
    position: p.position,
    median: p.median,
    floor: p.floor,
    ceiling: p.ceiling,
  }));

  const opponentLineup = matchupCtx.opponentProjections.map(p => ({
    playerId: p.playerId,
    name: p.playerName,
    position: p.position,
    median: p.median,
    floor: p.floor,
    ceiling: p.ceiling,
  }));

  const keyMatchups: MatchupAnalysisResult['keyMatchups'] = [];
  const positionGroups = ['QB', 'RB', 'WR', 'TE'];
  for (const pos of positionGroups) {
    const userAtPos = matchupCtx.userProjections.filter(p => p.position === pos);
    const oppAtPos = matchupCtx.opponentProjections.filter(p => p.position === pos);
    const userSum = userAtPos.reduce((s, p) => s + p.median, 0);
    const oppSum = oppAtPos.reduce((s, p) => s + p.median, 0);
    const delta = userSum - oppSum;
    keyMatchups.push({
      description: `${pos} advantage`,
      advantage: delta > 2 ? 'user' : delta < -2 ? 'opponent' : 'even',
      delta: Math.round(delta * 100) / 100,
    });
  }

  let riskAssessment: string;
  if (simulation.winProbability > 0.7) riskAssessment = 'FAVORED - Play your studs, minimize risk';
  else if (simulation.winProbability > 0.55) riskAssessment = 'SLIGHT EDGE - Consider ceiling plays at FLEX';
  else if (simulation.winProbability > 0.45) riskAssessment = 'COIN FLIP - Maximize upside in lineup construction';
  else if (simulation.winProbability > 0.3) riskAssessment = 'UNDERDOG - Swing for the fences with boom players';
  else riskAssessment = 'HEAVY UNDERDOG - Load up on correlated ceiling stacks';

  return { simulation, userLineup, opponentLineup, keyMatchups, riskAssessment };
}

export async function runLineupOptimization(
  leagueId: string,
  sleeperUserId: string,
  week: number,
): Promise<LineupOptimizationResult> {
  const [leagueCtx, matchupCtx] = await Promise.all([
    getLeagueContext(leagueId),
    getMatchupContext(leagueId, sleeperUserId, week),
  ]);

  const allPlayers = await sleeperApi.getAllPlayers();
  const userRoster = matchupCtx.userRoster;
  const allPlayerIds = userRoster.players || [];

  const projections = await getPlayerProjections(
    allPlayerIds,
    leagueCtx.scoringSettings,
    leagueCtx.season,
    leagueCtx.currentWeek,
  );

  const projMap = new Map(projections.map(p => [p.playerId, p]));

  const currentStarters = (userRoster.starters || []).map(id => ({
    playerId: id,
    name: projMap.get(id)?.playerName || id,
    position: projMap.get(id)?.position || allPlayers[id]?.position || '?',
    projected: projMap.get(id)?.median || 0,
  }));

  const positionSlots = leagueCtx.rosterPositions.filter(p => p !== 'BN');
  const availablePlayers = projections.filter(p => allPlayerIds.includes(p.playerId));

  const optimized = optimizeLineupForSlots(positionSlots, availablePlayers, allPlayers);

  const swaps: LineupOptimizationResult['swaps'] = [];
  const currentStarterIds = new Set(userRoster.starters || []);
  const optimizedIds = new Set(optimized.map(p => p.playerId));

  for (const opt of optimized) {
    if (!currentStarterIds.has(opt.playerId)) {
      const benchedStarter = currentStarters.find(
        s => !optimizedIds.has(s.playerId) && canPlaySlot(s.position, opt.position),
      );
      if (benchedStarter) {
        swaps.push({
          out: benchedStarter.name,
          in: opt.playerName,
          evDelta: opt.median - (projMap.get(benchedStarter.playerId)?.median || 0),
          reason: `+${(opt.median - (projMap.get(benchedStarter.playerId)?.median || 0)).toFixed(1)} projected points`,
        });
      }
    }
  }

  const totalEvGain = swaps.reduce((s, sw) => s + sw.evDelta, 0);

  const corrMatrix = buildCorrelationMatrix(
    [...matchupCtx.userProjections, ...matchupCtx.opponentProjections],
    allPlayers,
  );

  const currentSim = simulateMatchup(matchupCtx.userProjections, matchupCtx.opponentProjections, corrMatrix);
  const optimizedProjections = optimized.map(p => projMap.get(p.playerId)).filter(Boolean) as PlayerProjection[];
  const optimizedSim = simulateMatchup(optimizedProjections, matchupCtx.opponentProjections, corrMatrix);

  return {
    currentLineup: currentStarters,
    optimizedLineup: optimized.map(p => ({
      playerId: p.playerId,
      name: p.playerName,
      position: p.position,
      projected: p.median,
    })),
    swaps,
    totalEvGain: Math.round(totalEvGain * 100) / 100,
    winProbabilityChange: optimizedSim.winProbability - currentSim.winProbability,
    confidence: Math.min(currentSim.confidenceScore, optimizedSim.confidenceScore),
  };
}

function canPlaySlot(playerPos: string, slotPos: string): boolean {
  if (playerPos === slotPos) return true;
  if (slotPos === 'FLEX' && ['RB', 'WR', 'TE'].includes(playerPos)) return true;
  if (slotPos === 'SUPER_FLEX' && ['QB', 'RB', 'WR', 'TE'].includes(playerPos)) return true;
  if (slotPos === 'REC_FLEX' && ['WR', 'TE'].includes(playerPos)) return true;
  if (slotPos === 'WRRB_FLEX' && ['WR', 'RB'].includes(playerPos)) return true;
  return false;
}

function optimizeLineupForSlots(
  slots: string[],
  players: PlayerProjection[],
  allPlayers: Record<string, any>,
): PlayerProjection[] {
  const sorted = [...players].sort((a, b) => b.median - a.median);
  const used = new Set<string>();
  const lineup: PlayerProjection[] = [];

  const fixedSlots = slots.filter(s => !['FLEX', 'SUPER_FLEX', 'REC_FLEX', 'WRRB_FLEX', 'BN'].includes(s));
  const flexSlots = slots.filter(s => ['FLEX', 'SUPER_FLEX', 'REC_FLEX', 'WRRB_FLEX'].includes(s));

  for (const slot of fixedSlots) {
    const best = sorted.find(p => p.position === slot && !used.has(p.playerId));
    if (best) {
      lineup.push(best);
      used.add(best.playerId);
    }
  }

  for (const slot of flexSlots) {
    const best = sorted.find(p => canPlaySlot(p.position, slot) && !used.has(p.playerId));
    if (best) {
      lineup.push(best);
      used.add(best.playerId);
    }
  }

  return lineup;
}

export async function runTradeAnalysis(
  leagueId: string,
  sleeperUserId: string,
  givePlayerIds: string[],
  getPlayerIds: string[],
): Promise<FullTradeAnalysis> {
  const [leagueCtx, allRosters, standings, allPlayers] = await Promise.all([
    getLeagueContext(leagueId),
    getAllRosterContexts(leagueId),
    getStandings(leagueId),
    sleeperApi.getAllPlayers(),
  ]);

  const userRoster = allRosters.find(r => r.ownerId === sleeperUserId);
  if (!userRoster) throw new Error('User roster not found');

  const scarcity = await getPositionalScarcity(leagueId, leagueCtx.scoringSettings);

  const allPlayerIds = new Set<string>();
  allRosters.forEach(r => r.players.forEach(id => allPlayerIds.add(id)));
  const projections = await getPlayerProjections(
    Array.from(allPlayerIds),
    leagueCtx.scoringSettings,
    leagueCtx.season,
    leagueCtx.currentWeek,
  );

  const projMap = new Map(projections.map(p => [p.playerId, p]));
  const projByRoster = new Map<number, PlayerProjection[]>();
  for (const roster of allRosters) {
    const rosterProjs = (roster.starters || [])
      .map(id => projMap.get(id))
      .filter(Boolean) as PlayerProjection[];
    projByRoster.set(roster.rosterId, rosterProjs);
  }

  const corrMatrix = buildCorrelationMatrix(projections, allPlayers);

  const tradeEval = await evaluateTrade(
    givePlayerIds,
    getPlayerIds,
    leagueCtx,
    userRoster,
    allRosters,
    standings,
    projByRoster,
    corrMatrix,
    allPlayers,
    scarcity,
  );

  const hypotheticalProjs = new Map(projByRoster);
  const currentUserProjs = projByRoster.get(userRoster.rosterId) || [];
  const newUserProjs = currentUserProjs
    .filter(p => !givePlayerIds.includes(p.playerId))
    .concat(getPlayerIds.map(id => projMap.get(id)).filter(Boolean) as PlayerProjection[]);
  hypotheticalProjs.set(userRoster.rosterId, newUserProjs);

  const champDelta = await computeChampionshipDelta(
    userRoster.rosterId,
    projByRoster,
    hypotheticalProjs,
    standings,
    corrMatrix,
    leagueCtx,
  );

  const decision = computeDecisionMetrics(
    tradeEval.rosPointDelta,
    0,
    tradeEval.championshipProbabilityDelta,
    champDelta.delta,
    tradeEval.confidence,
  );

  return { tradeEval, championshipDelta: champDelta, decision };
}

export async function runWaiverAnalysis(
  leagueId: string,
  sleeperUserId: string,
  targetPlayerId: string,
): Promise<WaiverAnalysis> {
  const [leagueCtx, allRosters, allPlayers] = await Promise.all([
    getLeagueContext(leagueId),
    getAllRosterContexts(leagueId),
    sleeperApi.getAllPlayers(),
  ]);

  const userRoster = allRosters.find(r => r.ownerId === sleeperUserId);
  if (!userRoster) throw new Error('User roster not found');

  const scarcity = await getPositionalScarcity(leagueId, leagueCtx.scoringSettings);

  const targetProj = (await getPlayerProjections(
    [targetPlayerId],
    leagueCtx.scoringSettings,
    leagueCtx.season,
    leagueCtx.currentWeek,
  ))[0];

  if (!targetProj) throw new Error('Target player projection not found');

  const faabResult = await optimizeFAABBid(
    targetPlayerId,
    targetProj,
    userRoster,
    allRosters,
    leagueCtx,
    scarcity,
    allPlayers,
  );

  const targetPos = targetProj.position;
  const rosterPlayerIds = userRoster.players || [];
  const rosterProjs = await getPlayerProjections(
    rosterPlayerIds,
    leagueCtx.scoringSettings,
    leagueCtx.season,
    leagueCtx.currentWeek,
  );
  const worstAtPos = rosterProjs
    .filter(p => p.position === targetPos)
    .sort((a, b) => a.median - b.median)[0];

  const decision = computeDecisionMetrics(
    faabResult.expectedSeasonalValueGain,
    0,
    0,
    0,
    Math.min(0.99, faabResult.probabilityToWin),
  );

  return {
    faabResult,
    decision,
    rosterImpact: {
      positionFilled: targetPos,
      playerDropped: worstAtPos?.playerName || null,
      netEvGain: faabResult.expectedSeasonalValueGain,
    },
  };
}

export async function runSeasonOutlook(
  leagueId: string,
  sleeperUserId: string,
): Promise<SeasonOutlookResult> {
  const [leagueCtx, allRosters, standings, allPlayers] = await Promise.all([
    getLeagueContext(leagueId),
    getAllRosterContexts(leagueId),
    getStandings(leagueId),
    sleeperApi.getAllPlayers(),
  ]);

  const userRoster = allRosters.find(r => r.ownerId === sleeperUserId);
  if (!userRoster) throw new Error('User roster not found');

  const allPlayerIds = new Set<string>();
  allRosters.forEach(r => r.players.forEach(id => allPlayerIds.add(id)));
  const projections = await getPlayerProjections(
    Array.from(allPlayerIds),
    leagueCtx.scoringSettings,
    leagueCtx.season,
    leagueCtx.currentWeek,
  );

  const projMap = new Map(projections.map(p => [p.playerId, p]));
  const projByRoster = new Map<number, PlayerProjection[]>();
  for (const roster of allRosters) {
    const rosterProjs = (roster.starters || [])
      .map(id => projMap.get(id))
      .filter(Boolean) as PlayerProjection[];
    projByRoster.set(roster.rosterId, rosterProjs);
  }

  const corrMatrix = buildCorrelationMatrix(projections, allPlayers);

  const remainingWeeks = Array.from(
    { length: leagueCtx.totalRegularSeasonWeeks - leagueCtx.currentWeek },
    (_, i) => leagueCtx.currentWeek + i + 1,
  );

  const seasonSim = simulateSeason(
    standings,
    userRoster.rosterId,
    remainingWeeks,
    projByRoster,
    corrMatrix,
    leagueCtx,
  );

  const championshipPath = computeChampionshipPath(
    userRoster.rosterId,
    standings,
    projByRoster,
    corrMatrix,
    leagueCtx,
  );

  const userProjs = (userRoster.starters || [])
    .map(id => projMap.get(id))
    .filter(Boolean) as PlayerProjection[];

  const portfolio = analyzePortfolio(userRoster, userProjs, allPlayers, leagueCtx);

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (portfolio.diversificationScore > 0.7) strengths.push('Well-diversified roster');
  else weaknesses.push('High team concentration risk');

  if (portfolio.fragilityScore < 0.3) strengths.push('Healthy roster');
  else weaknesses.push('Injury-fragile roster');

  if (portfolio.volatilityScore < 0.4) strengths.push('Stable scoring floor');
  else weaknesses.push('High scoring variance');

  if (seasonSim.playoffProbability > 0.6) strengths.push('Strong playoff position');
  else if (seasonSim.playoffProbability < 0.3) weaknesses.push('Playoff berth at risk');

  return { seasonSim, championshipPath, portfolio, standings, strengths, weaknesses };
}
