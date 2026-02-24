import OpenAI from 'openai';
import type {
  SimulationResult,
  TradeEvalResult,
  FAABResult,
  PortfolioAnalysis,
  ChampionshipPath,
  SeasonSimResult,
  DecisionMetrics,
  UserRiskProfile,
} from './types';
import type { ElitePlayerProfile } from './player-profile-engine';
import type {
  MatchupAnalysisResult,
  LineupOptimizationResult,
  FullTradeAnalysis,
  WaiverAnalysis,
  SeasonOutlookResult,
} from './optimizer';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

async function explainWithLLM(systemPrompt: string, dataPayload: string): Promise<string> {
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: dataPayload,
        },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });
    return response.choices[0]?.message?.content || 'Analysis complete.';
  } catch (e) {
    return 'Unable to generate explanation at this time.';
  }
}

export async function explainMatchup(analysis: MatchupAnalysisResult): Promise<string> {
  const sys = `You are a high-stakes fantasy football analyst. Explain the Monte Carlo matchup simulation results in 2-3 concise paragraphs. Be direct and actionable. Reference the specific numbers provided. Do NOT invent any statistics - only reference the data given to you. Focus on what the manager should DO.`;

  const data = JSON.stringify({
    winProbability: `${(analysis.simulation.winProbability * 100).toFixed(1)}%`,
    expectedMargin: analysis.simulation.expectedMargin.toFixed(1),
    upsetProbability: `${(analysis.simulation.upsetProbability * 100).toFixed(1)}%`,
    confidence: `${(analysis.simulation.confidenceScore * 100).toFixed(0)}%`,
    userScoreRange: `${analysis.simulation.userScoreDistribution.p25.toFixed(0)}-${analysis.simulation.userScoreDistribution.p75.toFixed(0)}`,
    opponentScoreRange: `${analysis.simulation.opponentScoreDistribution.p25.toFixed(0)}-${analysis.simulation.opponentScoreDistribution.p75.toFixed(0)}`,
    keyMatchups: analysis.keyMatchups,
    riskAssessment: analysis.riskAssessment,
    iterations: analysis.simulation.iterations,
  });

  return explainWithLLM(sys, data);
}

export async function explainLineupOptimization(result: LineupOptimizationResult): Promise<string> {
  const sys = `You are a high-stakes fantasy football lineup consultant. Explain the recommended lineup changes in 2-3 concise sentences. Be direct about which swaps to make and why. Reference the projected point gains. Do NOT invent statistics.`;

  const data = JSON.stringify({
    swaps: result.swaps,
    totalEvGain: result.totalEvGain.toFixed(1),
    winProbabilityChange: `${(result.winProbabilityChange * 100).toFixed(1)}%`,
    confidence: `${(result.confidence * 100).toFixed(0)}%`,
  });

  return explainWithLLM(sys, data);
}

export async function explainTrade(analysis: FullTradeAnalysis): Promise<string> {
  const sys = `You are a dynasty fantasy football trade analyst for high-stakes leagues. Explain the trade evaluation results in 2-3 concise paragraphs. Frame everything in terms of championship equity. Be blunt about whether this trade should be accepted or rejected. Reference the specific numbers. Do NOT invent statistics.`;

  const data = JSON.stringify({
    rosPointDelta: analysis.tradeEval.rosPointDelta.toFixed(1),
    playoffWeightedDelta: analysis.tradeEval.playoffWeightedDelta.toFixed(1),
    championshipOddsChange: `${analysis.championshipDelta.currentOdds.toFixed(1)}% → ${analysis.championshipDelta.newOdds.toFixed(1)}% (${analysis.championshipDelta.delta > 0 ? '+' : ''}${analysis.championshipDelta.delta.toFixed(1)}%)`,
    riskChange: analysis.tradeEval.riskChangeScore.toFixed(2),
    scarcityImpact: analysis.tradeEval.positionalScarcityDelta.toFixed(1),
    varianceChange: analysis.tradeEval.varianceDelta.toFixed(1),
    confidence: `${(analysis.tradeEval.confidence * 100).toFixed(0)}%`,
    givePlayers: analysis.tradeEval.givePlayers,
    getPlayers: analysis.tradeEval.getPlayers,
    recommendation: analysis.decision.recommendation,
  });

  return explainWithLLM(sys, data);
}

export async function explainWaiver(analysis: WaiverAnalysis): Promise<string> {
  const sys = `You are a FAAB bidding strategist for high-stakes fantasy football. Explain the recommended bid in 2-3 concise sentences. Be specific about bid amounts and the game theory behind the recommendation. Do NOT invent statistics.`;

  const data = JSON.stringify({
    playerName: analysis.faabResult.playerName,
    optimalBid: `$${analysis.faabResult.optimalBid}`,
    minimumViableBid: `$${analysis.faabResult.minimumViableBid}`,
    probabilityToWin: `${(analysis.faabResult.probabilityToWin * 100).toFixed(0)}%`,
    expectedValueGain: analysis.faabResult.expectedSeasonalValueGain.toFixed(1),
    aggressionScore: analysis.faabResult.aggressionScore.toFixed(2),
    teamNeed: analysis.faabResult.teamNeedScore.toFixed(2),
    rosterImpact: analysis.rosterImpact,
    recommendation: analysis.decision.recommendation,
  });

  return explainWithLLM(sys, data);
}

export async function explainSeasonOutlook(result: SeasonOutlookResult): Promise<string> {
  const sys = `You are a season-long fantasy football strategist for high-stakes dynasty leagues. Explain the season outlook in 2-3 paragraphs. Focus on playoff path, championship equity, and what moves to prioritize. Be direct and actionable. Do NOT invent statistics.`;

  const data = JSON.stringify({
    playoffProbability: `${(result.seasonSim.playoffProbability * 100).toFixed(1)}%`,
    championshipProbability: `${(result.seasonSim.championshipProbability * 100).toFixed(1)}%`,
    expectedRecord: `${result.seasonSim.expectedWins.toFixed(0)}-${result.seasonSim.expectedLosses.toFixed(0)}`,
    expectedFinish: result.seasonSim.expectedFinish.toFixed(1),
    currentChampionshipOdds: `${result.championshipPath.currentChampionshipOdds.toFixed(1)}%`,
    keyWeeks: result.championshipPath.keyMoves.slice(0, 3),
    portfolio: {
      diversification: result.portfolio.diversificationScore.toFixed(2),
      fragility: result.portfolio.fragilityScore.toFixed(2),
      volatility: result.portfolio.volatilityScore.toFixed(2),
      playoffLeverage: result.portfolio.playoffLeverageScore.toFixed(2),
      recommendation: result.portfolio.recommendation,
    },
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    confidence: `${(result.seasonSim.confidenceScore * 100).toFixed(0)}%`,
  });

  return explainWithLLM(sys, data);
}

export async function explainPortfolio(portfolio: PortfolioAnalysis): Promise<string> {
  const sys = `You are a quantitative portfolio risk analyst for competitive fantasy football. Write 3-4 bullet points. Each bullet MUST:
- Start with a specific metric or number from the data
- Quantify the impact on title equity or weekly variance
- Name specific NFL teams or positions affected
- End with one concrete, actionable trade/waiver move

NEVER use phrases like "consider diversifying", "you might want to", "it's worth noting". Every sentence must contain a number. Be direct and prescriptive like a Bloomberg terminal alert.

Format: Use bullet points starting with •`;

  const data = JSON.stringify({
    archetype: portfolio.archetypeLabel,
    archetypeDesc: portfolio.archetypeDescription,
    diversification: portfolio.diversificationScore.toFixed(2),
    fragility: portfolio.fragilityScore.toFixed(2),
    volatility: portfolio.volatilityScore.toFixed(2),
    playoffLeverage: portfolio.playoffLeverageScore.toFixed(2),
    titleEquity: (portfolio.baselineTitleEquity * 100).toFixed(1) + '%',
    weeklyVariance: portfolio.totalWeeklyVariance.toFixed(1),
    teamConcentration: portfolio.teamConcentration,
    positionalDepth: portfolio.positionalDepth,
    stressTests: portfolio.stressTests.map(s => ({
      team: s.team,
      players: s.playerCount,
      titleEquityDrop: (s.titleEquityDelta * 100).toFixed(1) + '%',
    })),
    topRisk: portfolio.recommendation,
  });

  return explainWithLLM(sys, data);
}

export async function explainChampionshipPath(path: ChampionshipPath): Promise<string> {
  const sys = `You are a championship equity analyst for high-stakes fantasy football. Explain the championship path analysis in 2-3 paragraphs. Focus on what specific weeks and matchups matter most for title odds. Frame everything in terms of title equity percentage. Do NOT invent statistics.`;

  const data = JSON.stringify({
    currentOdds: `${path.currentChampionshipOdds.toFixed(1)}%`,
    projectedOdds: `${path.projectedChampionshipOdds.toFixed(1)}%`,
    delta: `${path.delta > 0 ? '+' : ''}${path.delta.toFixed(1)}%`,
    keyMoves: path.keyMoves,
    weekByWeekOutlook: path.weekByWeekOutlook.slice(0, 6),
  });

  return explainWithLLM(sys, data);
}

export async function explainPlayerProfile(profile: ElitePlayerProfile): Promise<string> {
  const sys = `You are a dynasty fantasy football asset analyst writing an executive brief. Using ONLY the structured data provided, write 4-5 bullet points. Rules:
- Every bullet MUST reference a specific number from the data
- Frame in terms of dynasty asset value, not fantasy points
- Include one actionable BUY/HOLD/SELL signal with reasoning
- Reference the archetype, Monte Carlo probabilities, and age curve
- If stress test sensitivity > 0.7, flag it explicitly
- NO generic advice. NO "consider" or "might want to". Be prescriptive.

Format: Bullet points starting with •`;

  const data = JSON.stringify({
    player: profile.playerName,
    position: profile.position,
    team: profile.team,
    age: profile.age,
    archetype: profile.archetype.label,
    archetypeConfidence: `${(profile.archetype.confidence * 100).toFixed(0)}%`,
    dynastyAssetScore: {
      composite: profile.dynastyAssetScore.composite,
      tier: profile.dynastyAssetScore.tier,
      production: profile.dynastyAssetScore.productionGrade,
      age: profile.dynastyAssetScore.ageGrade,
      roleSecurity: profile.dynastyAssetScore.roleSecurityGrade,
      volatility: profile.dynastyAssetScore.volatilityGrade,
    },
    monteCarlo: {
      weeklyMean: profile.monteCarlo.mean,
      floor: profile.monteCarlo.floor,
      ceiling: profile.monteCarlo.ceiling,
      boomProb: `${(profile.monteCarlo.boomProb * 100).toFixed(0)}%`,
      bustProb: `${(profile.monteCarlo.bustProb * 100).toFixed(0)}%`,
      stdDev: profile.monteCarlo.stdDev,
    },
    ageCurve: {
      currentAge: profile.ageCurve.currentAge,
      peakWindow: profile.ageCurve.peakWindow,
      yearsUntilDecline: profile.ageCurve.yearsUntilDecline,
      depreciationRate: `${profile.ageCurve.depreciationRate}%/yr`,
      threeYearProjections: profile.ageCurve.projections.map(p => ({
        year: p.year,
        value: p.projectedValue,
        phase: p.phase,
      })),
    },
    marketSentiment: {
      dynastyValue: profile.marketSentiment.dynastyValue,
      tier: profile.marketSentiment.dynastyTier,
      posRank: profile.marketSentiment.positionRank,
      trend: profile.marketSentiment.valueTrend,
      valueVsProduction: profile.marketSentiment.valueVsProduction,
    },
    topStressTest: profile.stressTests
      .filter(s => s.sensitivityScore > 0.6)
      .sort((a, b) => b.sensitivityScore - a.sensitivityScore)
      .slice(0, 2)
      .map(s => ({ scenario: s.label, valueDrop: `${(s.valueImpactPct * 100).toFixed(0)}%`, probability: `${(s.probabilityOfOccurrence * 100).toFixed(0)}%`, sensitivity: s.sensitivityScore })),
    correlationRisk: profile.correlationRisk.stackRiskSummary,
  });

  return explainWithLLM(sys, data);
}
