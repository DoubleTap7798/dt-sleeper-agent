import { UserRiskProfile, RiskClassification } from './types';

export function analyzeRiskProfile(
  userId: string,
  leagueId: string,
  transactions: any[],
  matchupHistory: { week: number; userScore: number; opponentScore: number; didStart: Map<string, boolean> }[],
  rosterHistory: { week: number; starters: string[]; projections: Map<string, number> }[],
  faabHistory: { amount: number; maxBudget: number; week: number }[]
): UserRiskProfile {
  const lineupVolatility = computeLineupVolatility(rosterHistory);
  const tradeAggressiveness = computeTradeAggressiveness(transactions);
  const faabAggression = computeFaabAggression(faabHistory);
  const underdogTendency = computeUnderdogTendency(matchupHistory, rosterHistory);

  const scores = computeClassificationScores(lineupVolatility, tradeAggressiveness, faabAggression, underdogTendency);

  let classification: RiskClassification = 'balanced';
  let maxScore = -1;
  for (const [key, value] of Object.entries(scores)) {
    if (value > maxScore) {
      maxScore = value;
      classification = key as RiskClassification;
    }
  }

  return {
    classification,
    lineupVolatility: Math.round(lineupVolatility * 1000) / 1000,
    tradeAggressiveness: Math.round(tradeAggressiveness * 1000) / 1000,
    faabAggression: Math.round(faabAggression * 1000) / 1000,
    underdogTendency: Math.round(underdogTendency * 1000) / 1000,
    scores,
  };
}

function computeLineupVolatility(
  rosterHistory: { week: number; starters: string[]; projections: Map<string, number> }[]
): number {
  if (rosterHistory.length === 0) return 0.5;

  let totalVolatility = 0;
  let weekCount = 0;

  for (const week of rosterHistory) {
    const { starters, projections } = week;
    if (starters.length === 0 || projections.size === 0) continue;

    const starterProjections: number[] = [];
    const allProjections: number[] = [];

    projections.forEach((proj, playerId) => {
      allProjections.push(proj);
      if (starters.includes(playerId)) {
        starterProjections.push(proj);
      }
    });

    if (starterProjections.length === 0 || allProjections.length <= starters.length) continue;

    const sortedAll = [...allProjections].sort((a, b) => b - a);
    const optimalStarters = sortedAll.slice(0, starters.length);

    const starterMean = starterProjections.reduce((a, b) => a + b, 0) / starterProjections.length;
    const optimalMean = optimalStarters.reduce((a, b) => a + b, 0) / optimalStarters.length;

    const starterVariance = starterProjections.reduce((sum, p) => {
      return sum + (p - starterMean) ** 2;
    }, 0) / starterProjections.length;

    const optimalVariance = optimalStarters.reduce((sum, p) => {
      return sum + (p - optimalMean) ** 2;
    }, 0) / optimalStarters.length;

    const starterCV = starterMean > 0 ? Math.sqrt(starterVariance) / starterMean : 0;
    const optimalCV = optimalMean > 0 ? Math.sqrt(optimalVariance) / optimalMean : 0;

    const weekVolatility = Math.min(1, Math.max(0, starterCV / Math.max(optimalCV, 0.01)));
    totalVolatility += weekVolatility;
    weekCount++;
  }

  if (weekCount === 0) return 0.5;
  return Math.min(1, Math.max(0, totalVolatility / weekCount));
}

function computeTradeAggressiveness(transactions: any[]): number {
  const trades = transactions.filter(t => t.type === 'trade');
  const tradeCount = trades.length;

  let baseScore: number;
  if (tradeCount <= 2) baseScore = 0.2;
  else if (tradeCount <= 5) baseScore = 0.4;
  else if (tradeCount <= 10) baseScore = 0.6;
  else baseScore = 0.8;

  let asymmetryBonus = 0;
  if (trades.length > 0) {
    let upsideCount = 0;
    for (const trade of trades) {
      if (trade.adds && trade.drops) {
        const addCount = Object.keys(trade.adds).length;
        const dropCount = Object.keys(trade.drops).length;
        if (addCount < dropCount) {
          upsideCount++;
        }
      }
    }
    asymmetryBonus = trades.length > 0 ? (upsideCount / trades.length) * 0.2 : 0;
  }

  return Math.min(1, Math.max(0, baseScore + asymmetryBonus));
}

function computeFaabAggression(
  faabHistory: { amount: number; maxBudget: number; week: number }[]
): number {
  if (faabHistory.length === 0) return 0.3;

  let totalPercentage = 0;
  let budgetRemaining = faabHistory.length > 0 ? faabHistory[0].maxBudget : 100;

  for (const bid of faabHistory) {
    const remainingAtTime = Math.max(1, budgetRemaining);
    const bidPercentage = bid.amount / remainingAtTime;
    totalPercentage += Math.min(1, bidPercentage);
    budgetRemaining -= bid.amount;
  }

  return Math.min(1, Math.max(0, totalPercentage / faabHistory.length));
}

function computeUnderdogTendency(
  matchupHistory: { week: number; userScore: number; opponentScore: number; didStart: Map<string, boolean> }[],
  rosterHistory: { week: number; starters: string[]; projections: Map<string, number> }[]
): number {
  if (matchupHistory.length === 0 || rosterHistory.length === 0) return 0.5;

  let underdogWeeks = 0;
  let totalWeeks = 0;

  const rosterMap = new Map<number, { starters: string[]; projections: Map<string, number> }>();
  for (const rh of rosterHistory) {
    rosterMap.set(rh.week, rh);
  }

  for (const matchup of matchupHistory) {
    const roster = rosterMap.get(matchup.week);
    if (!roster) continue;

    const starterTotal = roster.starters.reduce((sum, id) => {
      return sum + (roster.projections.get(id) || 0);
    }, 0);

    const allProjectionValues = Array.from(roster.projections.values());
    const sortedProjs = [...allProjectionValues].sort((a, b) => b - a);
    const optimalTotal = sortedProjs.slice(0, roster.starters.length).reduce((a, b) => a + b, 0);

    if (optimalTotal > 0 && starterTotal < optimalTotal * 0.9) {
      underdogWeeks++;
    }
    totalWeeks++;
  }

  if (totalWeeks === 0) return 0.5;
  return Math.min(1, Math.max(0, underdogWeeks / totalWeeks));
}

function computeClassificationScores(
  lineupVolatility: number,
  tradeAggressiveness: number,
  faabAggression: number,
  underdogTendency: number
): { conservative: number; balanced: number; aggressive: number; chaos: number } {
  const conservativeScore =
    (1 - lineupVolatility) * 0.3 +
    (1 - tradeAggressiveness) * 0.3 +
    (1 - faabAggression) * 0.2 +
    (1 - underdogTendency) * 0.2;

  const balancedScore =
    (1 - Math.abs(lineupVolatility - 0.5) * 2) * 0.25 +
    (1 - Math.abs(tradeAggressiveness - 0.4) * 2) * 0.25 +
    (1 - Math.abs(faabAggression - 0.4) * 2) * 0.25 +
    (1 - Math.abs(underdogTendency - 0.5) * 2) * 0.25;

  const aggressiveScore =
    lineupVolatility * 0.2 +
    tradeAggressiveness * 0.3 +
    faabAggression * 0.3 +
    underdogTendency * 0.2;

  const chaosScore =
    (lineupVolatility > 0.7 ? lineupVolatility : lineupVolatility * 0.3) * 0.3 +
    (underdogTendency > 0.6 ? underdogTendency : underdogTendency * 0.3) * 0.3 +
    (faabAggression > 0.7 ? faabAggression : faabAggression * 0.2) * 0.2 +
    (tradeAggressiveness > 0.6 ? tradeAggressiveness : tradeAggressiveness * 0.3) * 0.2;

  return {
    conservative: Math.round(conservativeScore * 1000) / 1000,
    balanced: Math.round(balancedScore * 1000) / 1000,
    aggressive: Math.round(aggressiveScore * 1000) / 1000,
    chaos: Math.round(chaosScore * 1000) / 1000,
  };
}

export function getRecommendationAdjustment(
  profile: UserRiskProfile,
  winProbability: number,
  standingsRank: number,
  playoffTeams: number,
  weeksRemaining: number
): { riskMultiplier: number; explanation: string } {
  const inPlayoffPosition = standingsRank <= playoffTeams;
  const onBubble = Math.abs(standingsRank - playoffTeams) <= 1;
  const needsToWinOut = !inPlayoffPosition && weeksRemaining <= 3;
  const comfortablyIn = inPlayoffPosition && standingsRank <= Math.floor(playoffTeams * 0.5);
  const desperation = !inPlayoffPosition && weeksRemaining <= 2;

  let riskMultiplier = 1.0;
  let explanation = '';

  if (profile.classification === 'conservative') {
    if (desperation) {
      riskMultiplier = 1.8;
      explanation = 'You typically play it safe, but your playoff hopes require aggressive moves now. Consider high-upside plays and trades.';
    } else if (needsToWinOut) {
      riskMultiplier = 1.5;
      explanation = 'Your conservative approach has served you well, but you need wins. Consider slightly riskier lineup choices.';
    } else if (onBubble) {
      riskMultiplier = 1.3;
      explanation = 'You are on the playoff bubble. A moderate increase in risk could help secure your spot.';
    } else if (comfortablyIn) {
      riskMultiplier = 0.9;
      explanation = 'You are comfortably in playoff position. Continue your safe approach to maintain your standing.';
    } else {
      riskMultiplier = 1.0;
      explanation = 'Your conservative strategy is appropriate for your current position.';
    }
  } else if (profile.classification === 'aggressive') {
    if (comfortablyIn) {
      riskMultiplier = 0.7;
      explanation = 'You are locked for playoffs. Consider dialing back aggression to protect your position and save resources for the postseason.';
    } else if (inPlayoffPosition && !onBubble) {
      riskMultiplier = 0.85;
      explanation = 'You are in a good spot. Slightly reduce risk to avoid unnecessary variance.';
    } else if (desperation) {
      riskMultiplier = 1.2;
      explanation = 'Your aggressive nature suits this situation. Go all-in on high-ceiling plays.';
    } else {
      riskMultiplier = 1.0;
      explanation = 'Your aggressive approach matches your current needs.';
    }
  } else if (profile.classification === 'chaos') {
    if (comfortablyIn) {
      riskMultiplier = 0.6;
      explanation = 'Your chaotic approach has worked, but now is the time to stabilize. Lock in your playoff spot with consistent plays.';
    } else if (inPlayoffPosition) {
      riskMultiplier = 0.75;
      explanation = 'Consider taming the chaos slightly. You are in playoff position and consistency will help you stay there.';
    } else if (desperation) {
      riskMultiplier = 1.1;
      explanation = 'Your unpredictable style may actually help in desperate times. Swing for the fences.';
    } else {
      riskMultiplier = 0.9;
      explanation = 'Consider adding some structure to your approach. Strategic chaos is better than random chaos.';
    }
  } else {
    if (desperation) {
      riskMultiplier = 1.4;
      explanation = 'Your balanced approach needs a boost. The situation calls for more aggressive plays to make playoffs.';
    } else if (needsToWinOut) {
      riskMultiplier = 1.2;
      explanation = 'Consider leaning slightly more aggressive to secure must-win matchups.';
    } else if (comfortablyIn) {
      riskMultiplier = 0.9;
      explanation = 'Your balanced approach is working. Stay the course and prepare for playoffs.';
    } else {
      riskMultiplier = 1.0;
      explanation = 'Your balanced approach is appropriate for your current standing.';
    }
  }

  if (winProbability < 0.35 && weeksRemaining > 3) {
    riskMultiplier = Math.max(riskMultiplier, 1.2);
    if (!explanation.includes('aggressive')) {
      explanation += ' This week looks tough - consider higher-ceiling plays.';
    }
  }

  return {
    riskMultiplier: Math.round(riskMultiplier * 100) / 100,
    explanation: explanation.trim(),
  };
}
