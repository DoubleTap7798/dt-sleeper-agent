import type { PlayerValuation } from './player-valuation-service';
import type { UFASResult } from './ufas-service';
import type { FranchiseWindowResult } from './franchise-modeling-service';
import type { TradeSimResult } from './trade-simulation-service';
import type { DraftSimulationResult } from './draft-simulation-service';
import type { PowerRankingEntry } from './power-rankings-service';
import type { LeagueMarketSnapshot } from './market-dynamics-service';

function r2(v: number): number { return Math.round(v * 100) / 100; }

export interface GMBriefing {
  headline: string;
  keyInsight: string;
  actionItems: string[];
  riskFlags: string[];
  evSummary: string;
}

export function generatePlayerBriefing(
  valuation: PlayerValuation,
  ufas: UFASResult,
  franchiseWindow: string
): GMBriefing {
  const { dnpv, archetypeCluster, longevityScore, productionTrajectory, injuryRiskScore } = valuation;

  const trajectoryLabel = productionTrajectory === 'ascending' ? 'upward' : productionTrajectory === 'declining' ? 'downward' : 'stable';
  const tierContext = `${ufas.tier}-tier asset (UFAS ${ufas.ufas})`;
  const windowFit = ufas.components.windowFitAdjustment >= 1.0 ? 'aligns with' : 'conflicts with';

  const headline = `${tierContext} | ${archetypeCluster.replace('_', ' ')} | ${trajectoryLabel} trajectory`;

  const keyInsight = `7-year DNPV: ${dnpv.dnpv.toFixed(0)} | ` +
    `Peak year value: ${dnpv.peakYearValue.toFixed(0)} | ` +
    `Annualized: ${dnpv.annualizedValue.toFixed(0)} | ` +
    `${windowFit} your ${franchiseWindow.replace('_', ' ')} window`;

  const actionItems: string[] = [];
  if (productionTrajectory === 'declining' && longevityScore < 0.4) {
    actionItems.push(`SELL — declining trajectory with ${(longevityScore * 100).toFixed(0)}% longevity score. Extract value before further depreciation.`);
  } else if (productionTrajectory === 'ascending' && ufas.ufas < 60) {
    actionItems.push(`HOLD — ascending trajectory suggests value appreciation. Current UFAS ${ufas.ufas} likely to improve.`);
  } else if (ufas.ufas >= 75) {
    actionItems.push(`HOLD — elite asset. Only trade for franchise-altering return (2+ 1sts equivalent).`);
  } else {
    actionItems.push(`MONITOR — evaluate trade offers against ${dnpv.annualizedValue.toFixed(0)} annualized DNPV threshold.`);
  }

  if (injuryRiskScore > 0.15) {
    actionItems.push(`Injury risk elevated (${(injuryRiskScore * 100).toFixed(0)}%). Acquire handcuff or positional insurance.`);
  }

  const riskFlags: string[] = [];
  if (injuryRiskScore > 0.20) riskFlags.push(`High injury risk: ${(injuryRiskScore * 100).toFixed(0)}%`);
  if (longevityScore < 0.30) riskFlags.push(`Low longevity: ${(longevityScore * 100).toFixed(0)}% remaining career value`);
  if (ufas.components.riskAdjustment > 0.3) riskFlags.push(`Elevated composite risk: ${(ufas.components.riskAdjustment * 100).toFixed(0)}%`);
  if (dnpv.terminalValue < dnpv.peakYearValue * 0.2) riskFlags.push('Steep value decline projected in outer years');

  const evSummary = `${dnpv.horizonYears}-year discounted value: ${dnpv.dnpv.toFixed(0)} at ${(dnpv.discountRate * 100).toFixed(0)}% discount rate. ` +
    `Value curve: ${dnpv.valueCurve.filter(v => v.phase === 'peak').length} peak years, ` +
    `${dnpv.valueCurve.filter(v => v.phase === 'declining' || v.phase === 'twilight').length} declining years.`;

  return { headline, keyInsight, actionItems, riskFlags, evSummary };
}

export function generateTradeBriefing(
  tradeResult: TradeSimResult,
  franchiseWindow: string
): GMBriefing {
  const { verdict, immediateEVDelta, threeYearEVDelta, fiveYearEVDelta, bustProbability, windowAlignment, championshipProbabilityDelta } = tradeResult;

  const verdictLabels: Record<string, string> = {
    'strong_accept': 'STRONG ACCEPT',
    'lean_accept': 'LEAN ACCEPT',
    'neutral': 'NEUTRAL',
    'lean_reject': 'LEAN REJECT',
    'strong_reject': 'STRONG REJECT',
  };

  const headline = `${verdictLabels[verdict]} | Championship equity ${championshipProbabilityDelta >= 0 ? '+' : ''}${(championshipProbabilityDelta * 100).toFixed(1)}%`;

  const keyInsight = `Immediate EV: ${immediateEVDelta > 0 ? '+' : ''}${immediateEVDelta.toFixed(0)} | ` +
    `3-year EV: ${threeYearEVDelta > 0 ? '+' : ''}${threeYearEVDelta.toFixed(0)} | ` +
    `5-year EV: ${fiveYearEVDelta > 0 ? '+' : ''}${fiveYearEVDelta.toFixed(0)} | ` +
    `Window fit: ${windowAlignment > 0 ? 'aligned' : 'misaligned'}`;

  const actionItems: string[] = [];
  if (verdict === 'strong_accept' || verdict === 'lean_accept') {
    actionItems.push('Execute trade — positive expected value across all horizons.');
  } else if (verdict === 'strong_reject') {
    actionItems.push('Reject — significant negative EV. See counter-offers for alternatives.');
  } else {
    actionItems.push('Evaluate counter-offers — marginal trade may improve with adjustments.');
  }

  if (tradeResult.counterOffers.length > 0) {
    actionItems.push(`${tradeResult.counterOffers.length} counter-offer(s) generated. Best: ${tradeResult.counterOffers[0].description}`);
  }

  const riskFlags: string[] = [];
  if (bustProbability > 0.20) riskFlags.push(`Bust probability: ${(bustProbability * 100).toFixed(0)}% — high downside risk`);
  if (tradeResult.volatilityDelta > 0.15) riskFlags.push(`Volatility increase: +${(tradeResult.volatilityDelta * 100).toFixed(0)}%`);
  if (windowAlignment < -0.2) riskFlags.push(`Window misalignment: trade ${windowAlignment < -0.5 ? 'strongly' : ''} conflicts with ${franchiseWindow.replace('_', ' ')} strategy`);

  const evSummary = tradeResult.executiveSummary;

  return { headline, keyInsight, actionItems, riskFlags, evSummary };
}

export function generateDraftBriefing(
  draftResult: DraftSimulationResult,
  userNeeds: Record<string, number>
): GMBriefing {
  const { tierCliffs, positionalRuns, availabilities, executiveSummary } = draftResult;

  const criticalCliffs = tierCliffs.filter(c => c.urgency === 'critical' || c.urgency === 'high');
  const topTargets = availabilities.filter(a => a.gonePct > 0.5).slice(0, 3);

  const headline = criticalCliffs.length > 0
    ? `ALERT: ${criticalCliffs.map(c => c.position).join(', ')} tier cliff — act now`
    : topTargets.length > 0
      ? `${topTargets.length} target(s) at risk — ${topTargets.map(t => t.name).join(', ')}`
      : 'Board stable — select best available';

  const needPositions = Object.entries(userNeeds)
    .filter(([_, need]) => need > 0.5)
    .sort(([, a], [, b]) => b - a)
    .map(([pos]) => pos);

  const keyInsight = `Priority needs: ${needPositions.join(', ') || 'none urgent'} | ` +
    `${criticalCliffs.length} tier cliff(s) | ` +
    `${positionalRuns.length} positional run warning(s)`;

  const actionItems: string[] = [];
  if (draftResult.draftNowVsWait.length > 0) {
    const topPick = draftResult.draftNowVsWait[0];
    if (topPick.optimalAction === 'draft_now') {
      actionItems.push(`Draft ${availabilities.find(a => a.playerId === topPick.playerId)?.name || 'target'} NOW — ${topPick.reasoning}`);
    } else {
      actionItems.push(`Safe to wait — ${topPick.reasoning}`);
    }
  }

  if (positionalRuns.length > 0) {
    actionItems.push(`${positionalRuns[0].position} run incoming — ${positionalRuns[0].playersLikelyGone} players projected gone`);
  }

  const riskFlags: string[] = [];
  for (const cliff of criticalCliffs) {
    riskFlags.push(`${cliff.position} tier ${cliff.currentTier} to ${cliff.nextTier}: ${cliff.playersRemainingInTier} player(s) left, ${cliff.valueDrop.toFixed(0)} value drop`);
  }

  return { headline, keyInsight, actionItems, riskFlags, evSummary: executiveSummary };
}

export function generatePowerRankingBriefing(
  entry: PowerRankingEntry,
  leagueAvg: number
): GMBriefing {
  const { rank, compositeScore, championshipProbabilityScore, volatilityIndex, rosterUFASAvg, franchiseWindow, trendDirection } = entry;

  const trendLabel = trendDirection === 'rising' ? 'trending up' : trendDirection === 'falling' ? 'trending down' : 'holding steady';
  const vsLeague = compositeScore > leagueAvg ? 'above' : 'below';

  const headline = `Rank #${rank} | ${franchiseWindow} | ${trendLabel}`;

  const keyInsight = `Composite: ${compositeScore.toFixed(1)} (${vsLeague} league avg ${leagueAvg.toFixed(1)}) | ` +
    `Championship prob: ${(championshipProbabilityScore * 100).toFixed(1)}% | ` +
    `UFAS avg: ${rosterUFASAvg.toFixed(1)} | ` +
    `Volatility: ${(volatilityIndex * 100).toFixed(0)}%`;

  const actionItems: string[] = [];
  if (entry.keyWeaknesses.length > 0) {
    actionItems.push(`Address: ${entry.keyWeaknesses[0]}`);
  }
  if (trendDirection === 'falling') {
    actionItems.push('Production trending downward — evaluate roster changes');
  }
  if (rank <= 3) {
    actionItems.push('Top-3 position — protect advantage, avoid unnecessary trades');
  }

  const riskFlags = entry.keyWeaknesses;
  const evSummary = `${entry.ownerName} ranks #${rank} with ${(championshipProbabilityScore * 100).toFixed(1)}% title equity. ` +
    `Top assets: ${entry.topAssets.slice(0, 3).map(a => `${a.name} (${a.ufas})`).join(', ')}.`;

  return { headline, keyInsight, actionItems, riskFlags, evSummary };
}

export function generateMarketBriefing(
  snapshot: LeagueMarketSnapshot,
  userWindow: string
): GMBriefing {
  const { contenderCount, rebuilderCount, positionalScarcity, proactiveTargets, marketNarrative } = snapshot;

  const topScarcity = [...positionalScarcity].sort((a, b) => b.scarcityScore - a.scarcityScore);
  const scarcestPos = topScarcity[0]?.position || 'RB';

  const headline = `${contenderCount} contender(s) vs ${rebuilderCount} rebuilder(s) | ${scarcestPos} most scarce`;

  const keyInsight = `Trade market: ${snapshot.avgLeagueTradeFrequency.toFixed(1)} avg trades/team | ` +
    `Scarcity leader: ${scarcestPos} (${(topScarcity[0]?.scarcityScore * 100 || 50).toFixed(0)}%) | ` +
    `${proactiveTargets.length} trade target(s) identified`;

  const actionItems: string[] = [];
  if (proactiveTargets.length > 0) {
    const top = proactiveTargets[0];
    actionItems.push(`Target ${top.targetPlayerName} from ${top.targetOwnerName}: ${top.reasoning}`);
  }

  if (topScarcity[0]?.scarcityScore > 0.6) {
    actionItems.push(`${scarcestPos} scarcity premium — ${topScarcity[0].scarcityScore > 0.7 ? 'significant' : 'moderate'} markup expected in trades`);
  }

  const riskFlags: string[] = [];
  if (contenderCount >= 6) riskFlags.push('Congested contender field — trade market will be expensive');
  if (rebuilderCount <= 1) riskFlags.push('Few rebuilders — limited trade partners for veteran acquisitions');

  return { headline, keyInsight, actionItems, riskFlags, evSummary: marketNarrative };
}

export function generateWarRoomBriefing(
  powerRank: PowerRankingEntry,
  franchiseResult: FranchiseWindowResult,
  marketSnapshot: LeagueMarketSnapshot
): GMBriefing {
  const headline = `#${powerRank.rank} Overall | ${franchiseResult.label} | ` +
    `${(franchiseResult.twoYearChampionshipProb * 100).toFixed(1)}% title equity`;

  const keyInsight = `Window score: ${franchiseResult.windowScore.toFixed(2)} | ` +
    `Depth: ${(franchiseResult.depthInsulationScore * 100).toFixed(0)}% | ` +
    `Peak alignment: ${(franchiseResult.positionalPeakClustering * 100).toFixed(0)}% | ` +
    `Draft capital: ${(franchiseResult.draftCapitalReserves * 100).toFixed(0)}%`;

  const actionItems = franchiseResult.recommendations.slice(0, 3);

  if (marketSnapshot.proactiveTargets.length > 0) {
    actionItems.push(`Top trade target: ${marketSnapshot.proactiveTargets[0].targetPlayerName} (${marketSnapshot.proactiveTargets[0].reasoning.split('.')[0]})`);
  }

  const riskFlags: string[] = [];
  if (franchiseResult.keyMetrics.totalCorePlayersAtRisk > 2) {
    riskFlags.push(`${franchiseResult.keyMetrics.totalCorePlayersAtRisk} core starters approaching/past peak — window closing`);
  }
  if (franchiseResult.depthInsulationScore < 0.3) {
    riskFlags.push('Thin depth — 1 injury from significant production loss');
  }
  if (powerRank.volatilityIndex > 0.5) {
    riskFlags.push(`High roster volatility (${(powerRank.volatilityIndex * 100).toFixed(0)}%) — inconsistent week-to-week output`);
  }

  const evSummary = `${franchiseResult.label} window with ${(franchiseResult.twoYearChampionshipProb * 100).toFixed(1)}% 2-year title probability. ` +
    `${franchiseResult.keyMetrics.corePlayersInPrime} core players in prime. ` +
    `${franchiseResult.keyMetrics.draftPicksOwned} draft picks owned (${franchiseResult.keyMetrics.futureDraftCapitalValue.toFixed(0)} total value).`;

  return { headline, keyInsight, actionItems, riskFlags, evSummary };
}
