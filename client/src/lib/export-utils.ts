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

export function formatTradeForShare(tradeData: any): string {
  const lines = ["Trade Analysis", ""];

  if (tradeData.sideA) {
    lines.push("Side A:");
    if (tradeData.sideA.players?.length) {
      tradeData.sideA.players.forEach((p: any) => lines.push(`  ${p.name} (${p.value})`));
    }
    if (tradeData.sideA.picks?.length) {
      tradeData.sideA.picks.forEach((p: any) => lines.push(`  ${p.name} (${p.value})`));
    }
    lines.push(`  Total: ${tradeData.sideA.totalValue}`);
  }

  if (tradeData.sideB) {
    lines.push("Side B:");
    if (tradeData.sideB.players?.length) {
      tradeData.sideB.players.forEach((p: any) => lines.push(`  ${p.name} (${p.value})`));
    }
    if (tradeData.sideB.picks?.length) {
      tradeData.sideB.picks.forEach((p: any) => lines.push(`  ${p.name} (${p.value})`));
    }
    lines.push(`  Total: ${tradeData.sideB.totalValue}`);
  }

  if (tradeData.verdict) {
    lines.push("", `Verdict: ${tradeData.verdict}`);
  }

  return lines.join("\n");
}
