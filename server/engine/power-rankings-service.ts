import type { UFASResult } from './ufas-service';
import type { FranchiseWindowResult } from './franchise-modeling-service';

export interface PowerRankingEntry {
  rosterId: number;
  ownerName: string;
  rank: number;
  previousRank: number | null;
  rankDelta: number;
  compositeScore: number;
  championshipOdds: number;
  rosterEV: number;
  futurePickEV: number;
  ageCurveAdj: number;
  depthScore: number;
  liquidityScore: number;
  riskPenalty: number;
  avgStarterAge: number;
  ageGrade: string;
  riskLevel: string;
  tier: string;
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
      injuryStatus?: string | null;
    }>;
    wins: number;
    losses: number;
    fpts: number;
    previousRank?: number;
    draftPickCount?: number;
    futurePickEV?: number;
  }>,
  ufasScores: Map<string, UFASResult>,
  franchiseResults: Map<number, FranchiseWindowResult>
): PowerRankingsResult {
  const AGE_CURVES: Record<string, { peak: [number, number]; decline: number }> = {
    QB: { peak: [24, 32], decline: 0.06 },
    RB: { peak: [22, 27], decline: 0.12 },
    WR: { peak: [23, 30], decline: 0.08 },
    TE: { peak: [24, 30], decline: 0.07 },
  };

  const entries: PowerRankingEntry[] = [];

  for (const roster of rosters) {
    const playerUfasScores: { name: string; ufas: number; position: string }[] = [];
    let totalUFAS = 0;
    let ufasCount = 0;
    let rosterEV = 0;
    let starterAgeSum = 0;
    let starterCount = 0;
    let topTierAssets = 0;
    let midTierAssets = 0;
    let flexLevelAssets = 0;
    let injuryRiskCount = 0;
    let decliningCount = 0;

    for (const p of roster.players) {
      const ufas = ufasScores.get(p.playerId);
      if (ufas) {
        totalUFAS += ufas.ufas;
        ufasCount++;
        playerUfasScores.push({ name: p.name, ufas: ufas.ufas, position: p.position });
        rosterEV += ufas.ufas;
      } else {
        rosterEV += p.value * 0.5;
      }

      if (p.isStarter) {
        starterAgeSum += p.age;
        starterCount++;
      }

      if (p.value >= 70) topTierAssets++;
      else if (p.value >= 40) midTierAssets++;
      if (p.value >= 20) flexLevelAssets++;

      if (p.injuryStatus && ["Out", "IR", "PUP", "Questionable"].includes(p.injuryStatus)) {
        injuryRiskCount++;
      }

      const curve = AGE_CURVES[p.position] || AGE_CURVES.WR;
      if (p.age > curve.peak[1] + 2 && p.value < 40) decliningCount++;
    }

    const rosterUFASAvg = ufasCount > 0 ? r2(totalUFAS / ufasCount) : 0;
    const topAssets = playerUfasScores
      .sort((a, b) => b.ufas - a.ufas)
      .slice(0, 5);

    const avgStarterAge = starterCount > 0 ? starterAgeSum / starterCount : 27;
    let ageCurveAdj = 0;
    if (avgStarterAge < 25) ageCurveAdj = 15;
    else if (avgStarterAge <= 27) ageCurveAdj = 10;
    else if (avgStarterAge <= 29) ageCurveAdj = 3;
    else ageCurveAdj = -10;

    const depthScore = starterCount * 2 + flexLevelAssets;
    const liquidityScore = topTierAssets * 3 + midTierAssets;

    let riskPenalty = 0;
    if (injuryRiskCount >= 3) riskPenalty += 8;
    else if (injuryRiskCount >= 1) riskPenalty += 3;
    if (decliningCount >= 3) riskPenalty += 7;
    else if (decliningCount >= 1) riskPenalty += 3;
    riskPenalty = Math.min(riskPenalty, 20);

    const futurePickEV = roster.futurePickEV || 0;

    const compositeRaw = rosterEV + futurePickEV + ageCurveAdj + depthScore + liquidityScore - riskPenalty;

    let ageGrade: string;
    if (avgStarterAge < 25) ageGrade = "A";
    else if (avgStarterAge < 27) ageGrade = "A-";
    else if (avgStarterAge < 28) ageGrade = "B+";
    else if (avgStarterAge < 29) ageGrade = "B";
    else if (avgStarterAge < 30) ageGrade = "B-";
    else ageGrade = "C";

    let riskLevel: string;
    if (riskPenalty <= 3) riskLevel = "Low";
    else if (riskPenalty <= 8) riskLevel = "Moderate";
    else if (riskPenalty <= 14) riskLevel = "Elevated";
    else riskLevel = "High";

    const franchiseResult = franchiseResults.get(roster.rosterId);

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (topAssets.length > 0 && topAssets[0].ufas > 75) {
      strengths.push(`Elite asset: ${topAssets[0].name} (UFAS ${topAssets[0].ufas})`);
    }
    if (futurePickEV > 150) strengths.push('Strong draft capital');
    if (avgStarterAge < 26) strengths.push('Young core');
    if (liquidityScore >= 10) strengths.push('High trade flexibility');

    if (riskPenalty >= 10) weaknesses.push('Elevated risk profile');
    if (avgStarterAge >= 29) weaknesses.push('Aging core');
    if (rosterUFASAvg < 35) weaknesses.push('Below-average roster quality');
    if (futurePickEV < 50) weaknesses.push('Low draft capital');

    const hasSeasonData = roster.players.some(p => p.weeklyScores.length > 0);
    let trendDirection: PowerRankingEntry['trendDirection'] = 'stable';
    if (hasSeasonData) {
      const recentScores = roster.players.flatMap(p => p.weeklyScores.slice(-4));
      const olderScores = roster.players.flatMap(p => p.weeklyScores.slice(0, -4));
      const recentMean = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
      const olderMean = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : 0;
      trendDirection = recentMean > olderMean * 1.08 ? 'rising' : recentMean < olderMean * 0.92 ? 'falling' : 'stable';
    }

    entries.push({
      rosterId: roster.rosterId,
      ownerName: roster.ownerName,
      rank: 0,
      previousRank: roster.previousRank || null,
      rankDelta: 0,
      compositeScore: compositeRaw,
      championshipOdds: 0,
      rosterEV: r2(rosterEV),
      futurePickEV: r2(futurePickEV),
      ageCurveAdj,
      depthScore,
      liquidityScore,
      riskPenalty,
      avgStarterAge: r2(avgStarterAge),
      ageGrade,
      riskLevel,
      tier: '',
      franchiseWindow: franchiseResult?.label || 'Balanced',
      keyStrengths: strengths.slice(0, 3),
      keyWeaknesses: weaknesses.slice(0, 3),
      rosterUFASAvg,
      topAssets,
      trendDirection,
    });
  }

  const allRaw = entries.map(e => e.compositeScore);
  const minScore = Math.min(...allRaw);
  const maxScore = Math.max(...allRaw);
  const range = maxScore - minScore || 1;

  const SOFTMAX_TEMP = 25;

  for (const e of entries) {
    e.compositeScore = r2(((e.compositeScore - minScore) / range) * 100);
  }

  const expScores = entries.map(e => Math.exp(e.compositeScore / SOFTMAX_TEMP));
  const expSum = expScores.reduce((a, b) => a + b, 0);

  entries.forEach((e, i) => {
    e.championshipOdds = r2((expScores[i] / expSum) * 100);

    if (e.compositeScore >= 80) e.tier = "Elite Contender";
    else if (e.compositeScore >= 70) e.tier = "Contender";
    else if (e.compositeScore >= 60) e.tier = "Competitive";
    else if (e.compositeScore >= 45) e.tier = "Retool";
    else e.tier = "Rebuild";
  });

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

  let narrativeSummary = `${leader?.ownerName || 'Unknown'} leads the dynasty rankings (score: ${leader?.compositeScore || 0}). `;
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
