import type { FranchiseWindow } from './franchise-modeling-service';

export interface ManagerProfile {
  rosterId: number;
  ownerName: string;
  tradingFrequency: 'high' | 'medium' | 'low';
  riskProfile: 'aggressive' | 'balanced' | 'conservative';
  pickHoarder: boolean;
  franchiseWindow: FranchiseWindow;
  positionalNeeds: Record<string, number>;
  tradeCount: number;
  avgTradeValue: number;
}

export interface PositionalScarcityIndex {
  position: string;
  scarcityScore: number;
  elitePlayerCount: number;
  startablePlayerCount: number;
  replacementLevelGap: number;
  demandPressure: number;
}

export interface ProactiveTradeTarget {
  targetRosterId: number;
  targetOwnerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  targetPlayerPosition: string;
  reasoning: string;
  suggestedOffer: string[];
  expectedAcceptanceProbability: number;
  evGain: number;
  urgency: 'high' | 'medium' | 'low';
}

export interface LeagueMarketSnapshot {
  contenderCount: number;
  rebuilderCount: number;
  balancedCount: number;
  avgLeagueTradeFrequency: number;
  positionalScarcity: PositionalScarcityIndex[];
  managerProfiles: ManagerProfile[];
  proactiveTargets: ProactiveTradeTarget[];
  marketNarrative: string;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }
function clamp(v: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, v)); }

export function buildManagerProfiles(
  rosters: Array<{
    rosterId: number;
    ownerName: string;
    players: string[];
    wins: number;
    losses: number;
    fpts: number;
  }>,
  transactions: any[],
  allPlayers: Record<string, any>,
  franchiseWindows: Map<number, FranchiseWindow>
): ManagerProfile[] {
  const profiles: ManagerProfile[] = [];

  for (const roster of rosters) {
    const rosterTrades = transactions.filter(
      (t: any) => t.type === 'trade' && (t.roster_ids || []).includes(roster.rosterId)
    );
    const tradeCount = rosterTrades.length;

    const tradingFrequency: ManagerProfile['tradingFrequency'] =
      tradeCount >= 8 ? 'high' : tradeCount >= 3 ? 'medium' : 'low';

    const posCounts: Record<string, number> = {};
    const idealCounts: Record<string, number> = { QB: 2, RB: 5, WR: 5, TE: 2 };
    for (const pid of roster.players) {
      const p = allPlayers[pid];
      if (p?.position) posCounts[p.position] = (posCounts[p.position] || 0) + 1;
    }

    const needs: Record<string, number> = {};
    for (const [pos, ideal] of Object.entries(idealCounts)) {
      const current = posCounts[pos] || 0;
      needs[pos] = r2(clamp((ideal - current) / ideal));
    }

    let draftPickCount = 0;
    for (const t of transactions) {
      if (t.type === 'trade' && t.draft_picks) {
        for (const dp of t.draft_picks) {
          if (dp.owner_id === roster.rosterId) draftPickCount++;
        }
      }
    }
    const pickHoarder = draftPickCount >= 6;

    const winRate = (roster.wins + roster.losses) > 0
      ? roster.wins / (roster.wins + roster.losses) : 0.5;

    let riskProfile: ManagerProfile['riskProfile'] = 'balanced';
    if (tradeCount >= 8 || pickHoarder) riskProfile = 'aggressive';
    else if (tradeCount <= 2 && winRate > 0.5) riskProfile = 'conservative';

    const window = franchiseWindows.get(roster.rosterId) || 'balanced';

    let totalTradeValue = 0;
    for (const t of rosterTrades) {
      if (t.adds) totalTradeValue += Object.keys(t.adds).length * 2000;
    }
    const avgTradeValue = tradeCount > 0 ? r2(totalTradeValue / tradeCount) : 0;

    profiles.push({
      rosterId: roster.rosterId,
      ownerName: roster.ownerName,
      tradingFrequency,
      riskProfile,
      pickHoarder,
      franchiseWindow: window,
      positionalNeeds: needs,
      tradeCount,
      avgTradeValue,
    });
  }

  return profiles;
}

export function computeLeagueScarcity(
  allRosterPlayers: Array<{ position: string; value: number; isStarter: boolean }>,
  positions: string[] = ['QB', 'RB', 'WR', 'TE']
): PositionalScarcityIndex[] {
  const results: PositionalScarcityIndex[] = [];

  for (const pos of positions) {
    const posPlayers = allRosterPlayers.filter(p => p.position === pos);
    if (posPlayers.length === 0) {
      results.push({ position: pos, scarcityScore: 0.5, elitePlayerCount: 0, startablePlayerCount: 0, replacementLevelGap: 0, demandPressure: 0.5 });
      continue;
    }

    const sorted = [...posPlayers].sort((a, b) => b.value - a.value);
    const avgValue = sorted.reduce((s, p) => s + p.value, 0) / sorted.length;
    const eliteThreshold = avgValue * 1.5;
    const startableThreshold = avgValue * 0.6;
    const replacementIdx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));

    const eliteCount = sorted.filter(p => p.value > eliteThreshold).length;
    const startableCount = sorted.filter(p => p.value > startableThreshold).length;
    const replacementGap = sorted[0]?.value && sorted[replacementIdx]?.value
      ? r2((sorted[0].value - sorted[replacementIdx].value) / sorted[0].value)
      : 0;

    const starterCount = posPlayers.filter(p => p.isStarter).length;
    const demandPressure = r2(clamp(starterCount / Math.max(startableCount, 1)));

    const scarcityScore = r2(clamp(
      replacementGap * 0.4 + (1 - startableCount / Math.max(posPlayers.length, 1)) * 0.3 + demandPressure * 0.3
    ));

    results.push({
      position: pos,
      scarcityScore,
      elitePlayerCount: eliteCount,
      startablePlayerCount: startableCount,
      replacementLevelGap: replacementGap,
      demandPressure,
    });
  }

  return results;
}

export function generateProactiveTradeTargets(
  userRosterId: number,
  userWindow: FranchiseWindow,
  userNeeds: Record<string, number>,
  managerProfiles: ManagerProfile[],
  allPlayers: Record<string, any>,
  rostersByTeam: Map<number, string[]>,
  playerValues: Map<string, number>
): ProactiveTradeTarget[] {
  const targets: ProactiveTradeTarget[] = [];

  for (const manager of managerProfiles) {
    if (manager.rosterId === userRosterId) continue;
    if (manager.tradingFrequency === 'low' && manager.riskProfile === 'conservative') continue;

    const theirRoster = rostersByTeam.get(manager.rosterId) || [];
    const theirWindow = manager.franchiseWindow;

    for (const pid of theirRoster) {
      const player = allPlayers[pid];
      if (!player?.position || !player?.age) continue;

      const playerValue = playerValues.get(pid) || 0;
      if (playerValue < 1000) continue;

      const pos = player.position;
      const age = player.age;
      const userNeed = userNeeds[pos] || 0;
      if (userNeed < 0.2) continue;

      let opportunity = false;
      let reasoning = '';
      let suggestedOffer: string[] = [];
      let evGain = 0;

      if (theirWindow === 'rebuild' && age > 28 && userWindow === 'win_now') {
        opportunity = true;
        reasoning = `${manager.ownerName} is rebuilding. ${player.first_name} ${player.last_name} (${age}) is a sell candidate for them. Target for win-now push.`;
        suggestedOffer = ['2026 2nd + bench piece'];
        evGain = r2(playerValue * 0.15);
      }

      if (theirWindow === 'win_now' && age < 24 && (userWindow === 'rebuild' || userWindow === 'productive_struggle')) {
        opportunity = true;
        reasoning = `${manager.ownerName} is in win-now mode. May undervalue young ${player.first_name} ${player.last_name}. Offer aging veteran in return.`;
        suggestedOffer = ['Aging veteran + 2027 3rd'];
        evGain = r2(playerValue * 0.20);
      }

      if (manager.positionalNeeds[pos] && manager.positionalNeeds[pos] < 0.3 && userNeed > 0.5) {
        const theirSurplus = 1 - (manager.positionalNeeds[pos] || 0);
        if (theirSurplus > 0.7) {
          opportunity = true;
          reasoning = `${manager.ownerName} has ${pos} surplus. ${player.first_name} ${player.last_name} is expendable for them. Target at discount.`;
          suggestedOffer = [`Player from your surplus + draft pick`];
          evGain = r2(playerValue * 0.10);
        }
      }

      if (!opportunity) continue;

      const acceptProb = clamp(
        (manager.tradingFrequency === 'high' ? 0.4 : 0.2) +
        (manager.riskProfile === 'aggressive' ? 0.1 : 0) +
        (evGain > 500 ? -0.05 : 0.05),
        0.05, 0.7
      );

      targets.push({
        targetRosterId: manager.rosterId,
        targetOwnerName: manager.ownerName,
        targetPlayerId: pid,
        targetPlayerName: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
        targetPlayerPosition: pos,
        reasoning,
        suggestedOffer,
        expectedAcceptanceProbability: r2(acceptProb),
        evGain,
        urgency: evGain > 1500 ? 'high' : evGain > 500 ? 'medium' : 'low',
      });
    }
  }

  targets.sort((a, b) => b.evGain - a.evGain);
  return targets.slice(0, 10);
}

export function buildLeagueMarketSnapshot(
  rosters: Array<{
    rosterId: number;
    ownerName: string;
    players: string[];
    wins: number;
    losses: number;
    fpts: number;
  }>,
  transactions: any[],
  allPlayers: Record<string, any>,
  franchiseWindows: Map<number, FranchiseWindow>,
  userRosterId: number,
  userWindow: FranchiseWindow,
  userNeeds: Record<string, number>,
  playerValues: Map<string, number>
): LeagueMarketSnapshot {
  const managerProfiles = buildManagerProfiles(rosters, transactions, allPlayers, franchiseWindows);

  const contenderCount = managerProfiles.filter(m =>
    m.franchiseWindow === 'win_now' || m.franchiseWindow === 'contender'
  ).length;
  const rebuilderCount = managerProfiles.filter(m =>
    m.franchiseWindow === 'rebuild' || m.franchiseWindow === 'productive_struggle'
  ).length;
  const balancedCount = managerProfiles.filter(m => m.franchiseWindow === 'balanced').length;

  const avgTradeFreq = rosters.length > 0
    ? r2(managerProfiles.reduce((s, m) => s + m.tradeCount, 0) / rosters.length)
    : 0;

  const allRosterPlayers: Array<{ position: string; value: number; isStarter: boolean }> = [];
  for (const roster of rosters) {
    for (const pid of roster.players) {
      const p = allPlayers[pid];
      if (p?.position) {
        allRosterPlayers.push({
          position: p.position,
          value: playerValues.get(pid) || 0,
          isStarter: false,
        });
      }
    }
  }

  const positionalScarcity = computeLeagueScarcity(allRosterPlayers);

  const rostersByTeam = new Map<number, string[]>();
  for (const r of rosters) rostersByTeam.set(r.rosterId, r.players);

  const proactiveTargets = generateProactiveTradeTargets(
    userRosterId, userWindow, userNeeds,
    managerProfiles, allPlayers, rostersByTeam, playerValues
  );

  const topScarcity = [...positionalScarcity].sort((a, b) => b.scarcityScore - a.scarcityScore);
  const scarcestPos = topScarcity[0]?.position || 'RB';

  let marketNarrative = `League has ${contenderCount} contender(s) and ${rebuilderCount} rebuilder(s). `;
  marketNarrative += `${scarcestPos} is the scarcest position (${(topScarcity[0]?.scarcityScore * 100 || 50).toFixed(0)}% scarcity index). `;
  if (proactiveTargets.length > 0) {
    marketNarrative += `${proactiveTargets.length} actionable trade target(s) identified. `;
    marketNarrative += `Top target: ${proactiveTargets[0].targetPlayerName} from ${proactiveTargets[0].targetOwnerName}.`;
  }

  return {
    contenderCount,
    rebuilderCount,
    balancedCount,
    avgLeagueTradeFrequency: avgTradeFreq,
    positionalScarcity,
    managerProfiles,
    proactiveTargets,
    marketNarrative,
  };
}
