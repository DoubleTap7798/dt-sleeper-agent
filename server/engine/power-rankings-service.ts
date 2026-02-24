import type { UFASResult } from './ufas-service';
import type { FranchiseWindowResult } from './franchise-modeling-service';

export interface PowerRankingEntry {
  rosterId: number;
  ownerName: string;
  rank: number;
  previousRank: number | null;
  rankDelta: number;
  championshipProbabilityScore: number;
  medianOutcomeProjection: number;
  volatilityIndex: number;
  compositeScore: number;
  franchiseWindow: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  rosterUFASAvg: number;
  topAssets: { name: string; ufas: number; position: string }[];
  trendDirection: 'rising' | 'stable' | 'falling';
}

export interface PowerRankingsResult {
  rankings: PowerRankingEntry[];
  leagueAvgScore: number;
  leagueMedianScore: number;
  narrativeSummary: string;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

export function computePowerRankings(
  rosters: Array<{
    rosterId: number;
    ownerName: string;
    players: Array<{
      playerId: string;
      name: string;
      position: string;
      age: number;
      value: number;
      weeklyScores: number[];
      isStarter: boolean;
    }>;
    wins: number;
    losses: number;
    fpts: number;
    previousRank?: number;
  }>,
  ufasScores: Map<string, UFASResult>,
  franchiseResults: Map<number, FranchiseWindowResult>
): PowerRankingsResult {
  const entries: PowerRankingEntry[] = [];

  for (const roster of rosters) {
    const playerUfasScores: { name: string; ufas: number; position: string }[] = [];
    let totalUFAS = 0;
    let ufasCount = 0;

    for (const p of roster.players) {
      const ufas = ufasScores.get(p.playerId);
      if (ufas) {
        totalUFAS += ufas.ufas;
        ufasCount++;
        playerUfasScores.push({ name: p.name, ufas: ufas.ufas, position: p.position });
      }
    }

    const rosterUFASAvg = ufasCount > 0 ? r2(totalUFAS / ufasCount) : 0;
    const topAssets = playerUfasScores
      .sort((a, b) => b.ufas - a.ufas)
      .slice(0, 5);

    const franchiseResult = franchiseResults.get(roster.rosterId);
    const champProb = franchiseResult?.twoYearChampionshipProb || 0;

    const starters = roster.players.filter(p => p.isStarter);
    const starterScores = starters.flatMap(p => p.weeklyScores);
    const medianProjection = starterScores.length > 0
      ? r2(starterScores.sort((a, b) => a - b)[Math.floor(starterScores.length / 2)])
      : 0;

    const starterMeans = starters.map(p =>
      p.weeklyScores.length > 0 ? p.weeklyScores.reduce((a, b) => a + b, 0) / p.weeklyScores.length : 0
    );
    const totalMean = starterMeans.reduce((a, b) => a + b, 0);
    const totalVariance = starters.reduce((sum, p) => {
      const mean = p.weeklyScores.length > 0 ? p.weeklyScores.reduce((a, b) => a + b, 0) / p.weeklyScores.length : 0;
      const variance = p.weeklyScores.length > 1
        ? p.weeklyScores.reduce((s, v) => s + (v - mean) ** 2, 0) / p.weeklyScores.length
        : 0;
      return sum + variance;
    }, 0);
    const volatilityIndex = totalMean > 0 ? r2(Math.sqrt(totalVariance) / totalMean) : 0.5;

    const compositeScore = r2(
      champProb * 35 +
      rosterUFASAvg * 0.35 +
      (1 - clamp(volatilityIndex)) * 15 +
      (roster.wins / Math.max(roster.wins + roster.losses, 1)) * 15
    );

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (topAssets.length > 0 && topAssets[0].ufas > 75) {
      strengths.push(`Elite asset: ${topAssets[0].name} (UFAS ${topAssets[0].ufas})`);
    }
    if (champProb > 0.15) strengths.push('Strong championship probability');
    if (volatilityIndex < 0.3) strengths.push('Low roster volatility');
    if (franchiseResult && franchiseResult.depthInsulationScore > 0.6) strengths.push('Deep bench insulation');

    if (volatilityIndex > 0.5) weaknesses.push('High roster volatility');
    if (champProb < 0.05) weaknesses.push('Low title equity');
    if (franchiseResult && franchiseResult.depthInsulationScore < 0.3) weaknesses.push('Thin bench depth');
    if (rosterUFASAvg < 35) weaknesses.push('Below-average roster quality');

    const recentScores = roster.players.flatMap(p => p.weeklyScores.slice(-4));
    const olderScores = roster.players.flatMap(p => p.weeklyScores.slice(0, -4));
    const recentMean = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
    const olderMean = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : 0;
    const trendDirection: PowerRankingEntry['trendDirection'] =
      recentMean > olderMean * 1.08 ? 'rising' : recentMean < olderMean * 0.92 ? 'falling' : 'stable';

    entries.push({
      rosterId: roster.rosterId,
      ownerName: roster.ownerName,
      rank: 0,
      previousRank: roster.previousRank || null,
      rankDelta: 0,
      championshipProbabilityScore: r2(champProb),
      medianOutcomeProjection: medianProjection,
      volatilityIndex,
      compositeScore,
      franchiseWindow: franchiseResult?.label || 'Balanced',
      keyStrengths: strengths.slice(0, 3),
      keyWeaknesses: weaknesses.slice(0, 3),
      rosterUFASAvg,
      topAssets,
      trendDirection,
    });
  }

  entries.sort((a, b) => b.compositeScore - a.compositeScore);
  entries.forEach((e, i) => {
    e.rank = i + 1;
    if (e.previousRank !== null) {
      e.rankDelta = e.previousRank - e.rank;
    }
  });

  const allScores = entries.map(e => e.compositeScore);
  const leagueAvgScore = allScores.length > 0 ? r2(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const sortedScores = [...allScores].sort((a, b) => a - b);
  const leagueMedianScore = sortedScores.length > 0 ? r2(sortedScores[Math.floor(sortedScores.length / 2)]) : 0;

  const leader = entries[0];
  const rising = entries.filter(e => e.trendDirection === 'rising').slice(0, 2);
  const falling = entries.filter(e => e.trendDirection === 'falling').slice(0, 2);

  let narrativeSummary = `${leader?.ownerName || 'Unknown'} leads the power rankings (score: ${leader?.compositeScore || 0}). `;
  if (rising.length > 0) {
    narrativeSummary += `Rising: ${rising.map(r => r.ownerName).join(', ')}. `;
  }
  if (falling.length > 0) {
    narrativeSummary += `Falling: ${falling.map(f => f.ownerName).join(', ')}.`;
  }

  return {
    rankings: entries,
    leagueAvgScore,
    leagueMedianScore,
    narrativeSummary,
  };
}
