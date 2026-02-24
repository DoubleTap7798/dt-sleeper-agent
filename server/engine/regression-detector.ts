import { PlayerProjection } from './types';

export interface RegressionAlert {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  alertType: 'td_overperformance' | 'td_underperformance' | 'usage_spike' | 'usage_decline' | 'breakout_candidate' | 'regression_candidate';
  severity: 'high' | 'medium' | 'low';
  metric: string;
  currentValue: number;
  expectedValue: number;
  delta: number;
  description: string;
}

const POSITION_TD_RATES: Record<string, number> = {
  QB: 1.8,
  RB: 0.55,
  WR: 0.45,
  TE: 0.35,
};

const POSITION_AVG_POINTS: Record<string, number> = {
  QB: 18,
  RB: 12,
  WR: 11,
  TE: 8,
};

export function detectRegressionAlerts(
  projections: PlayerProjection[],
  allPlayers: Record<string, any>,
): RegressionAlert[] {
  const alerts: RegressionAlert[] = [];

  for (const proj of projections) {
    if (proj.gamesPlayed < 3 || proj.position === 'K' || proj.position === 'DEF') continue;

    const playerInfo = allPlayers[proj.playerId];
    if (!playerInfo) continue;

    detectTDRegression(proj, playerInfo, alerts);
    detectUsageTrends(proj, playerInfo, alerts);
    detectBreakoutCandidates(proj, playerInfo, alerts);
  }

  return alerts
    .sort((a, b) => {
      const sevOrder = { high: 0, medium: 1, low: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    })
    .slice(0, 20);
}

function detectTDRegression(
  proj: PlayerProjection,
  playerInfo: any,
  alerts: RegressionAlert[],
) {
  const expectedTDRate = POSITION_TD_RATES[proj.position] || 0.4;
  const scores = proj.weeklyScores;
  if (scores.length < 4) return;

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const posAvg = POSITION_AVG_POINTS[proj.position] || 10;

  const recentScores = scores.slice(-3);
  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const earlyScores = scores.slice(0, -3);
  const earlyAvg = earlyScores.length > 0 ? earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length : avgScore;

  const overperformanceRatio = avgScore / posAvg;

  if (overperformanceRatio > 1.4 && scores.length >= 5) {
    const highScoringWeeks = scores.filter(s => s > posAvg * 1.5).length;
    const tdDependency = highScoringWeeks / scores.length;

    if (tdDependency > 0.4) {
      alerts.push({
        playerId: proj.playerId,
        playerName: proj.playerName,
        position: proj.position,
        team: proj.team,
        alertType: 'td_overperformance',
        severity: overperformanceRatio > 1.6 ? 'high' : 'medium',
        metric: 'TD-Dependent Scoring',
        currentValue: Math.round(avgScore * 10) / 10,
        expectedValue: Math.round(posAvg * 10) / 10,
        delta: Math.round((avgScore - posAvg) * 10) / 10,
        description: `Scoring ${Math.round((overperformanceRatio - 1) * 100)}% above position average — ${Math.round(tdDependency * 100)}% of weeks are TD-dependent big games. Regression likely.`,
      });
    }
  }

  if (overperformanceRatio < 0.7 && scores.length >= 5) {
    alerts.push({
      playerId: proj.playerId,
      playerName: proj.playerName,
      position: proj.position,
      team: proj.team,
      alertType: 'td_underperformance',
      severity: overperformanceRatio < 0.5 ? 'high' : 'medium',
      metric: 'Below Expected Scoring',
      currentValue: Math.round(avgScore * 10) / 10,
      expectedValue: Math.round(posAvg * 10) / 10,
      delta: Math.round((avgScore - posAvg) * 10) / 10,
      description: `Scoring ${Math.round((1 - overperformanceRatio) * 100)}% below position average. Positive regression candidate if usage holds.`,
    });
  }
}

function detectUsageTrends(
  proj: PlayerProjection,
  playerInfo: any,
  alerts: RegressionAlert[],
) {
  const scores = proj.weeklyScores;
  if (scores.length < 5) return;

  const recentWindow = 3;
  const recentScores = scores.slice(-recentWindow);
  const earlyScores = scores.slice(0, -recentWindow);

  if (earlyScores.length < 2) return;

  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const earlyAvg = earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length;

  if (earlyAvg <= 0) return;

  const changeRatio = (recentAvg - earlyAvg) / earlyAvg;

  if (changeRatio > 0.3) {
    alerts.push({
      playerId: proj.playerId,
      playerName: proj.playerName,
      position: proj.position,
      team: proj.team,
      alertType: 'usage_spike',
      severity: changeRatio > 0.5 ? 'high' : 'medium',
      metric: 'Recent Scoring Surge',
      currentValue: Math.round(recentAvg * 10) / 10,
      expectedValue: Math.round(earlyAvg * 10) / 10,
      delta: Math.round((recentAvg - earlyAvg) * 10) / 10,
      description: `Scoring up ${Math.round(changeRatio * 100)}% over last ${recentWindow} weeks (${recentAvg.toFixed(1)} vs ${earlyAvg.toFixed(1)} early). Breakout probability increasing.`,
    });
  }

  if (changeRatio < -0.3) {
    alerts.push({
      playerId: proj.playerId,
      playerName: proj.playerName,
      position: proj.position,
      team: proj.team,
      alertType: 'usage_decline',
      severity: changeRatio < -0.5 ? 'high' : 'medium',
      metric: 'Recent Scoring Drop',
      currentValue: Math.round(recentAvg * 10) / 10,
      expectedValue: Math.round(earlyAvg * 10) / 10,
      delta: Math.round((recentAvg - earlyAvg) * 10) / 10,
      description: `Scoring down ${Math.round(Math.abs(changeRatio) * 100)}% over last ${recentWindow} weeks (${recentAvg.toFixed(1)} vs ${earlyAvg.toFixed(1)} early). Usage may be declining.`,
    });
  }
}

function detectBreakoutCandidates(
  proj: PlayerProjection,
  playerInfo: any,
  alerts: RegressionAlert[],
) {
  const scores = proj.weeklyScores;
  if (scores.length < 4) return;

  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const floor = sorted[Math.floor(n * 0.25)];
  const ceiling = sorted[Math.min(Math.floor(n * 0.75), n - 1)];
  const median = proj.median;

  if (median <= 0 || ceiling <= 0) return;

  const ceilingToMedianRatio = ceiling / median;
  const floorToMedianRatio = floor / median;

  const recentScores = scores.slice(-3);
  const recentTrend = recentScores.length >= 2
    ? (recentScores[recentScores.length - 1] - recentScores[0]) / Math.max(1, recentScores[0])
    : 0;

  if (ceilingToMedianRatio > 1.8 && recentTrend > 0.15 && median < (POSITION_AVG_POINTS[proj.position] || 10)) {
    alerts.push({
      playerId: proj.playerId,
      playerName: proj.playerName,
      position: proj.position,
      team: proj.team,
      alertType: 'breakout_candidate',
      severity: recentTrend > 0.3 ? 'high' : 'medium',
      metric: 'Breakout Potential',
      currentValue: Math.round(median * 10) / 10,
      expectedValue: Math.round(ceiling * 10) / 10,
      delta: Math.round((ceiling - median) * 10) / 10,
      description: `High ceiling (${ceiling.toFixed(1)}) relative to median (${median.toFixed(1)}) with upward recent trend. Breakout probability increasing.`,
    });
  }

  if (floorToMedianRatio < 0.3 && ceilingToMedianRatio < 1.2 && median > (POSITION_AVG_POINTS[proj.position] || 10) * 1.2) {
    alerts.push({
      playerId: proj.playerId,
      playerName: proj.playerName,
      position: proj.position,
      team: proj.team,
      alertType: 'regression_candidate',
      severity: 'medium',
      metric: 'Regression Risk',
      currentValue: Math.round(median * 10) / 10,
      expectedValue: Math.round(floor * 10) / 10,
      delta: Math.round((median - floor) * 10) / 10,
      description: `Low floor (${floor.toFixed(1)}) with compressed ceiling (${ceiling.toFixed(1)}) suggests scoring may normalize downward.`,
    });
  }
}
