export function exportToCSV(data: Record<string, any>[], filename: string): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);

  const escapeValue = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => escapeValue(row[h])).join(",")
    ),
  ];

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatStandingsForShare(standings: any[]): string {
  const lines = ["League Standings", ""];
  standings.forEach((team, index) => {
    const rank = index + 1;
    const record = `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ""}`;
    lines.push(`#${rank} ${team.ownerName} (${record}) - PF: ${Number(team.pointsFor).toFixed(1)}, PA: ${Number(team.pointsAgainst).toFixed(1)}`);
  });
  return lines.join("\n");
}

export function formatPowerRankingsForShare(rankings: any[]): string {
  const lines = ["Power Rankings", ""];
  rankings.forEach((team) => {
    lines.push(`#${team.rank} ${team.teamName} [${team.tier}] - Score: ${Number(team.powerScore).toFixed(1)}`);
  });
  return lines.join("\n");
}

export function formatTradeAnalysisForShare(
  analysis: any,
  teamAName: string,
  teamBName: string,
  teamAAssets: any[],
  teamBAssets: any[]
): string {
  const lines = [
    "Trade Analysis - DT Sleeper Agent",
    `Grade: ${analysis.grade}`,
    "",
  ];

  lines.push(`${teamAName} trades away:`);
  if (teamAAssets.length > 0) {
    teamAAssets.forEach((a: any) => {
      lines.push(`  ${a.name} (${a.position || "Pick"}) - Value: ${a.value?.toLocaleString() ?? "N/A"}`);
    });
  } else {
    lines.push("  (no assets)");
  }
  lines.push(`  Raw Total: ${(analysis.teamA?.totalValue ?? 0).toLocaleString()}`);
  if (analysis.teamA?.adjustedTotal != null) {
    lines.push(`  Adjusted Total: ${analysis.teamA.adjustedTotal.toLocaleString()}`);
  }

  lines.push("");
  lines.push(`${teamBName} trades away:`);
  if (teamBAssets.length > 0) {
    teamBAssets.forEach((a: any) => {
      lines.push(`  ${a.name} (${a.position || "Pick"}) - Value: ${a.value?.toLocaleString() ?? "N/A"}`);
    });
  } else {
    lines.push("  (no assets)");
  }
  lines.push(`  Raw Total: ${(analysis.teamB?.totalValue ?? 0).toLocaleString()}`);
  if (analysis.teamB?.adjustedTotal != null) {
    lines.push(`  Adjusted Total: ${analysis.teamB.adjustedTotal.toLocaleString()}`);
  }

  lines.push("");
  if (analysis.isFair || analysis.winner === "even") {
    lines.push("Verdict: This trade is fairly even!");
  } else {
    const winner = analysis.winner === "A" ? teamAName : teamBName;
    const pctDiff = analysis.fairnessPercent ?? analysis.percentageDiff ?? 0;
    lines.push(`Verdict: ${winner} gets the better deal by ${Math.abs(pctDiff).toFixed(1)}%`);
  }

  if (analysis.aiAnalysis) {
    lines.push("", "AI Analysis:", analysis.aiAnalysis);
  }

  return lines.join("\n");
}

export function formatTradeHistoryForShare(trades: any[]): string {
  const lines = ["Trade History - DT Sleeper Agent", ""];
  trades.forEach((trade, idx) => {
    const date = new Date(trade.timestamp).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    lines.push(`Trade #${idx + 1} (${date} - ${trade.season})`);
    lines.push(`  ${trade.team1.ownerName} received: ${trade.team1.received.map((a: any) => a.displayName || a.name).join(", ")}`);
    lines.push(`  ${trade.team2.ownerName} received: ${trade.team2.received.map((a: any) => a.displayName || a.name).join(", ")}`);
    if (trade.absValueDiff > 0) {
      lines.push(`  Value difference: ${trade.absValueDiff.toLocaleString()}`);
    }
    lines.push("");
  });
  return lines.join("\n");
}

export function formatRosterForShare(players: any[], teamName: string): string {
  const lines = [`${teamName} - Roster`, ""];
  const starters = players.filter((p: any) => p.isStarter);
  const bench = players.filter((p: any) => !p.isStarter);

  if (starters.length > 0) {
    lines.push("Starters:");
    starters.forEach((p: any) => {
      lines.push(`  ${p.slotPosition || p.position} - ${p.name} (${p.team}) - Dynasty Value: ${p.dynastyValue?.toLocaleString() ?? "N/A"}`);
    });
  }

  if (bench.length > 0) {
    lines.push("", "Bench:");
    bench.forEach((p: any) => {
      lines.push(`  ${p.position} - ${p.name} (${p.team}) - Dynasty Value: ${p.dynastyValue?.toLocaleString() ?? "N/A"}`);
    });
  }

  return lines.join("\n");
}

export function formatScheduleForShare(schedule: any[]): string {
  const lines = ["Season Schedule", ""];
  schedule.forEach((week: any) => {
    const opponentName = week.opponent?.ownerName || "BYE";
    const result = week.result === "bye" ? "BYE" :
      ((week.userPoints ?? 0) > 0 || (week.opponentPoints ?? 0) > 0)
        ? `${(week.userPoints ?? 0).toFixed(1)} - ${(week.opponentPoints ?? 0).toFixed(1)}`
        : "TBD";
    lines.push(`Week ${week.week}: vs ${opponentName} - ${result}`);
  });
  return lines.join("\n");
}

export function formatPlayersForShare(players: any[]): string {
  const lines = ["Top NFL Players", ""];
  players.slice(0, 50).forEach((p: any) => {
    lines.push(`#${p.overallRank ?? "-"} ${p.fullName} (${p.position} - ${p.team || "FA"}) - Pts: ${(p.fantasyPoints ?? 0).toFixed(1)}`);
  });
  return lines.join("\n");
}

export function formatWatchlistForShare(watchlist: any[]): string {
  const lines = ["Watchlist", ""];
  watchlist.forEach((item: any) => {
    const vc = item.valueChange ?? 0;
    const change = vc > 0 ? `+${vc}` : `${vc}`;
    lines.push(`${item.playerName} (${item.position} - ${item.team || "FA"}) - Value: ${item.currentValue ?? 0} (${change})`);
  });
  return lines.join("\n");
}

export function formatDevyForShare(players: any[]): string {
  const lines = ["Devy Rankings", ""];
  players.slice(0, 50).forEach((p: any) => {
    lines.push(`#${p.rank ?? "-"} ${p.name} (${p.position}) - ${p.college || "N/A"} - ${p.draftEligibleYear || "TBD"} - Value: ${p.value ?? 0}`);
  });
  return lines.join("\n");
}

export function formatDraftBoardForShare(players: any[]): string {
  const lines = ["2026 NFL Draft Board", ""];
  players.slice(0, 50).forEach((p: any) => {
    const stock = p.stockStatus === "rising" ? " ^" : p.stockStatus === "falling" ? " v" : "";
    lines.push(`#${p.rank} ${p.name} (${p.position}) - ${p.college}${stock}`);
  });
  return lines.join("\n");
}

export function formatMatchupsForShare(matchups: any[], week: number): string {
  const lines = [`Week ${week} Matchups`, ""];
  matchups.forEach((m: any) => {
    if (m.teamB) {
      lines.push(`${m.teamA.ownerName} (${(m.teamA.totalPoints ?? 0).toFixed(1)}) vs ${m.teamB.ownerName} (${(m.teamB.totalPoints ?? 0).toFixed(1)})`);
    } else {
      lines.push(`${m.teamA.ownerName} (${(m.teamA.totalPoints ?? 0).toFixed(1)}) - BYE`);
    }
  });
  return lines.join("\n");
}
