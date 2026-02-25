import * as sleeperApi from "../sleeper-api";

export interface InSeasonRankingEntry {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  teamName: string;
  rank: number;
  inSeasonScore: number;
  starterPPG: number;
  nStarterPPG: number;
  winPct: number;
  nWinPct: number;
  pointsAboveMedian: number;
  nPointsAboveMedian: number;
  allPlayPct: number;
  nAllPlayPct: number;
  momentum: number;
  nMomentum: number;
  injuryDepth: number;
  nInjuryDepth: number;
  tier: string;
  strategy: string;
  championshipOdds: number;
  playoffOdds: number;
  weeklyDelta: number | null;
  oddsDelta: number | null;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  weeklyScores: number[];
  topPlayers: Array<{ name: string; position: string; value: number }>;
  mode: "in-season";
}

export interface InSeasonRankingsResult {
  rankings: InSeasonRankingEntry[];
  offseason: boolean;
  leagueAvgScore: number;
  leagueMedianScore: number;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function normalizeAcrossLeague(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => r2(((v - min) / range) * 100));
}

export async function computeInSeasonRankings(leagueId: string): Promise<InSeasonRankingsResult> {
  const [league, rosters, leagueUsers, state, allPlayers] = await Promise.all([
    sleeperApi.getLeague(leagueId),
    sleeperApi.getLeagueRosters(leagueId),
    sleeperApi.getLeagueUsers(leagueId),
    sleeperApi.getState(),
    sleeperApi.getAllPlayers(),
  ]);

  if (!league) {
    return { rankings: [], offseason: true, leagueAvgScore: 0, leagueMedianScore: 0 };
  }

  const totalGames = rosters.reduce((sum, r) => sum + (r.settings.wins || 0) + (r.settings.losses || 0) + (r.settings.ties || 0), 0);
  if (totalGames === 0) {
    return { rankings: [], offseason: true, leagueAvgScore: 0, leagueMedianScore: 0 };
  }

  const currentWeek = state?.week || 1;
  const numTeams = rosters.length;
  const userMap = new Map(leagueUsers.map((u: any) => [u.user_id, u]));

  const playoffStart = league.settings?.playoff_week_start || 15;
  const lastRegularWeek = Math.min(currentWeek - 1, playoffStart - 1);

  const weeklyMatchups: Map<number, sleeperApi.SleeperMatchup[]> = new Map();
  const weekFetches: Promise<void>[] = [];
  for (let w = 1; w <= lastRegularWeek; w++) {
    weekFetches.push(
      sleeperApi.getMatchups(leagueId, w).then(m => {
        if (m && m.length > 0) weeklyMatchups.set(w, m);
      })
    );
  }
  await Promise.all(weekFetches);

  const rosterWeeklyScores: Map<number, number[]> = new Map();
  const weeksWithData: number[] = [];

  for (let w = 1; w <= lastRegularWeek; w++) {
    const matchups = weeklyMatchups.get(w);
    if (!matchups || matchups.length === 0) continue;

    const hasScores = matchups.some(m => m.points > 0);
    if (!hasScores) continue;

    weeksWithData.push(w);
    for (const m of matchups) {
      const scores = rosterWeeklyScores.get(m.roster_id) || [];
      scores.push(m.points || 0);
      rosterWeeklyScores.set(m.roster_id, scores);
    }
  }

  const scoredWeeks = weeksWithData.length;
  if (scoredWeeks === 0) {
    return { rankings: [], offseason: true, leagueAvgScore: 0, leagueMedianScore: 0 };
  }

  const allPlayResults: Map<number, { wins: number; total: number }> = new Map();
  for (const week of weeksWithData) {
    const matchups = weeklyMatchups.get(week);
    if (!matchups) continue;
    const weekScores = matchups.map(m => ({ rosterId: m.roster_id, points: m.points || 0 }));

    for (const team of weekScores) {
      const winsThisWeek = weekScores.filter(
        opp => opp.rosterId !== team.rosterId && team.points > opp.points
      ).length;
      const current = allPlayResults.get(team.rosterId) || { wins: 0, total: 0 };
      current.wins += winsThisWeek;
      current.total += numTeams - 1;
      allPlayResults.set(team.rosterId, current);
    }
  }

  const allPointsFor = rosters.map(r => (r.settings.fpts || 0) + (r.settings.fpts_decimal || 0) / 100);
  const leagueMedianPoints = [...allPointsFor].sort((a, b) => a - b)[Math.floor(allPointsFor.length / 2)] || 0;

  const IDP_POSITIONS = new Set(["LB", "DL", "CB", "S", "SAF", "EDGE", "ILB", "OLB", "DE", "DT", "NT", "DB", "FS", "SS", "MLB", "DEF"]);

  const rawMetrics = rosters.map((roster: any) => {
    const user = userMap.get(roster.owner_id);
    const wins = roster.settings.wins || 0;
    const losses = roster.settings.losses || 0;
    const ties = roster.settings.ties || 0;
    const gamesPlayed = wins + losses + ties;
    const pointsFor = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;

    const winPctRaw = gamesPlayed > 0 ? wins / gamesPlayed : 0.5;

    const ptsAboveMedian = pointsFor - leagueMedianPoints;

    const allPlay = allPlayResults.get(roster.roster_id);
    const allPlayPctRaw = allPlay && allPlay.total > 0 ? allPlay.wins / allPlay.total : 0.5;

    const weeklyScores = rosterWeeklyScores.get(roster.roster_id) || [];
    const seasonAvg = weeklyScores.length > 0
      ? weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length
      : 0;
    const last3 = weeklyScores.slice(-3);
    const last3Avg = last3.length > 0
      ? last3.reduce((a, b) => a + b, 0) / last3.length
      : 0;
    const momentumRaw = seasonAvg > 0 ? (last3Avg - seasonAvg) / seasonAvg : 0;

    const starterPPGRaw = gamesPlayed > 0 ? pointsFor / gamesPlayed : 0;

    const playerIds: string[] = roster.players || [];
    const starters = new Set((roster.starters || []).filter((s: string) => s && s !== "0"));
    let healthyStarters = 0;
    let healthyBench = 0;
    let injuredCount = 0;

    const topStarters: Array<{ name: string; position: string; value: number }> = [];

    for (const pid of playerIds) {
      const player = allPlayers[pid];
      if (!player) continue;
      const pos = player.position || "";
      if (IDP_POSITIONS.has(pos) || pos === "K" || pos === "DEF") continue;

      const isInjured = player.injury_status && ["Out", "IR", "PUP", "Doubtful"].includes(player.injury_status);

      if (starters.has(pid)) {
        if (!isInjured) healthyStarters++;
        else injuredCount++;

        const ppg = player.fantasy_data_id ? (starterPPGRaw / Math.max(starters.size, 1)) : 0;
        topStarters.push({
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: pos,
          value: r2(ppg),
        });
      } else {
        if (!isInjured && ["QB", "RB", "WR", "TE"].includes(pos)) {
          healthyBench++;
        }
        if (isInjured) injuredCount++;
      }
    }

    const injuryDepthRaw = healthyStarters + healthyBench * 0.3 - injuredCount * 0.5;

    return {
      rosterId: roster.roster_id,
      ownerId: roster.owner_id,
      ownerName: user?.display_name || user?.username || "Unknown",
      avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
      teamName: user?.metadata?.team_name || user?.display_name || user?.username || "Unknown",
      starterPPGRaw,
      winPctRaw,
      ptsAboveMedian,
      allPlayPctRaw,
      momentumRaw,
      injuryDepthRaw,
      record: { wins, losses, ties },
      pointsFor,
      weeklyScores,
      topPlayers: topStarters.slice(0, 5),
    };
  });

  const nStarterPPGs = normalizeAcrossLeague(rawMetrics.map(t => t.starterPPGRaw));
  const nWinPcts = normalizeAcrossLeague(rawMetrics.map(t => t.winPctRaw));
  const nAboveMedians = normalizeAcrossLeague(rawMetrics.map(t => t.ptsAboveMedian));
  const nAllPlays = normalizeAcrossLeague(rawMetrics.map(t => t.allPlayPctRaw));
  const nMomentums = normalizeAcrossLeague(rawMetrics.map(t => t.momentumRaw));
  const nInjuryDepths = normalizeAcrossLeague(rawMetrics.map(t => t.injuryDepthRaw));

  const WEIGHTS = {
    starterPPG: 0.25,
    winPct: 0.20,
    aboveMedian: 0.15,
    allPlay: 0.15,
    momentum: 0.15,
    injuryDepth: 0.10,
  };

  const entries: InSeasonRankingEntry[] = rawMetrics.map((team, idx) => {
    const nSPPG = nStarterPPGs[idx];
    const nWP = nWinPcts[idx];
    const nAM = nAboveMedians[idx];
    const nAP = nAllPlays[idx];
    const nMom = nMomentums[idx];
    const nID = nInjuryDepths[idx];

    const inSeasonScore = r2(
      nSPPG * WEIGHTS.starterPPG +
      nWP * WEIGHTS.winPct +
      nAM * WEIGHTS.aboveMedian +
      nAP * WEIGHTS.allPlay +
      nMom * WEIGHTS.momentum +
      nID * WEIGHTS.injuryDepth
    );

    let tier: string;
    if (inSeasonScore >= 85) tier = "Elite";
    else if (inSeasonScore >= 70) tier = "Strong";
    else if (inSeasonScore >= 50) tier = "Average";
    else if (inSeasonScore >= 35) tier = "Below Average";
    else tier = "Weak";

    let strategy: string;
    if (nMom >= 80 && nWP >= 60) strategy = "Hot Streak";
    else if (nWP >= 70 && nAP >= 70) strategy = "Consistent Contender";
    else if (nAP >= 65 && nWP < 55) strategy = "Underperformer";
    else if (nWP >= 65 && nAP < 50) strategy = "Overachiever";
    else if (nMom >= 70 && nWP < 50) strategy = "Surging";
    else if (nWP < 35 && nSPPG < 40) strategy = "Rebuilding";
    else strategy = tier;

    return {
      rosterId: team.rosterId,
      ownerId: team.ownerId,
      ownerName: team.ownerName,
      avatar: team.avatar,
      teamName: team.teamName,
      rank: 0,
      inSeasonScore,
      starterPPG: r2(team.starterPPGRaw),
      nStarterPPG: nSPPG,
      winPct: r2(team.winPctRaw * 100),
      nWinPct: nWP,
      pointsAboveMedian: r2(team.ptsAboveMedian),
      nPointsAboveMedian: nAM,
      allPlayPct: r2(team.allPlayPctRaw * 100),
      nAllPlayPct: nAP,
      momentum: r2(team.momentumRaw * 100),
      nMomentum: nMom,
      injuryDepth: r2(team.injuryDepthRaw),
      nInjuryDepth: nID,
      tier,
      strategy,
      championshipOdds: 0,
      playoffOdds: 0,
      weeklyDelta: null,
      oddsDelta: null,
      record: team.record,
      pointsFor: team.pointsFor,
      weeklyScores: team.weeklyScores,
      topPlayers: team.topPlayers,
      mode: "in-season" as const,
    };
  });

  entries.sort((a, b) => b.inSeasonScore - a.inSeasonScore);

  const SOFTMAX_TEMP = 25;
  const expScores = entries.map(e => Math.exp(e.inSeasonScore / SOFTMAX_TEMP));
  const expSum = expScores.reduce((a, b) => a + b, 0);

  entries.forEach((e, i) => {
    e.rank = i + 1;
    e.championshipOdds = r2((expScores[i] / expSum) * 100);
    e.playoffOdds = Math.min(r2(e.championshipOdds * (numTeams / 2)), 99);
  });

  const allScores = entries.map(e => e.inSeasonScore);
  const leagueAvgScore = allScores.length > 0 ? r2(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const sorted = [...allScores].sort((a, b) => a - b);
  const leagueMedianScore = sorted.length > 0 ? r2(sorted[Math.floor(sorted.length / 2)]) : 0;

  return {
    rankings: entries,
    offseason: false,
    leagueAvgScore,
    leagueMedianScore,
  };
}
