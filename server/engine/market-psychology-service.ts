import type { InsertPlayerMarketMetrics } from "@shared/schema";
import * as ktcValues from "../ktc-values";

export type MarketHeatLevel = "COLD" | "NEUTRAL" | "HEATING" | "HOT";

export type MarketLabel = "Momentum Breakout" | "Bubble Risk" | "Accumulation Zone" | "Distribution Phase" | null;

export interface PlayerInput {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  searchRank: number;
  rosterPct: number;
  age: number;
  yearsExp: number;
  injuryStatus: string | null;
  trendValues: {
    trend7Day: number;
    trend30Day: number;
    seasonChange: number;
  };
  rosterDelta: number;
  isOnTradeBlock: boolean;
  faabBidsReceived: number;
  depthChartRank: number;
}

export interface MarketIndices {
  dynastyMarketIndex: number;
  dynastyVolatilityIndex: number;
  avgHypePremium: number;
  leagueAvgVolatility: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return clamp(((val - min) / (max - min)) * 100, 0, 100);
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function computeSentimentScore(player: PlayerInput): number {
  const searchPopularity = normalize(500 - (player.searchRank || 500), 0, 500);
  const rosterSentiment = normalize(player.rosterPct, 0, 100);

  const t7 = player.trendValues.trend7Day || 0;
  const t30 = player.trendValues.trend30Day || 0;
  const season = player.trendValues.seasonChange || 0;

  const trendSentiment = clamp(50 + (t7 * 3 + t30 * 1.5 + season * 0.5), 0, 100);
  const addDropVelocity = clamp(50 + player.rosterDelta * 10, 0, 100);

  const newsToneProxy = searchPopularity > 70 && t7 > 0 ? 65 + t7 * 2 :
    searchPopularity > 50 ? 50 + t7 : 40;

  const weighted =
    0.35 * searchPopularity +
    0.20 * rosterSentiment +
    0.20 * trendSentiment +
    0.15 * addDropVelocity +
    0.10 * clamp(newsToneProxy, 0, 100);

  return Math.round(clamp(weighted, 0, 100) * 10) / 10;
}

export function computeHypeVelocity(player: PlayerInput): number {
  const t7 = player.trendValues.trend7Day || 0;
  const t30 = player.trendValues.trend30Day || 0;

  const shortTermSentiment = 50 + t7 * 5;
  const longTermSentiment = 50 + t30 * 2;

  const rawVelocity = (shortTermSentiment - longTermSentiment) * 2;
  const rosterBoost = player.rosterDelta * 5;

  return Math.round(clamp(rawVelocity + rosterBoost, -100, 100) * 10) / 10;
}

export function computeDemandIndex(player: PlayerInput): number {
  const addDropVelocity = clamp(50 + player.rosterDelta * 15, 0, 100);
  const tradeInquiries = player.isOnTradeBlock ? 30 : (player.searchRank < 100 ? 70 : 40);
  const faabActivity = clamp(player.faabBidsReceived * 20, 0, 100);
  const rosterDelta = normalize(player.rosterPct, 0, 100);
  const tradeBlockCount = player.isOnTradeBlock ? 80 : 20;

  const weighted =
    0.30 * addDropVelocity +
    0.25 * tradeInquiries +
    0.20 * faabActivity +
    0.15 * rosterDelta +
    0.10 * tradeBlockCount;

  return Math.round(clamp(weighted, 0, 100) * 10) / 10;
}

export function computeTrueSupply(player: PlayerInput): number {
  const tradeBlockPct = player.isOnTradeBlock ? 70 : 10;
  const tradeFrequency14d = player.isOnTradeBlock ? 60 :
    player.searchRank < 50 ? 40 :
    player.searchRank < 200 ? 25 : 10;
  const unrosteredPct = 100 - player.rosterPct;

  const raw =
    (tradeBlockPct * 0.5) +
    (tradeFrequency14d * 0.3) +
    (unrosteredPct * 0.2);

  return Math.round(clamp(raw, 0, 100) * 10) / 10;
}

export function computeSupplyIndex(player: PlayerInput): number {
  return computeTrueSupply(player);
}

export function computeHypePremiumTanh(
  demandIndex: number,
  dVix: number
): number {
  const normalizedDemand = (demandIndex - 50) / 50;
  const maxPremium = 15 + (dVix / 2);
  const raw = Math.tanh(normalizedDemand * 1.5) * maxPremium;
  return Math.round(clamp(raw, -maxPremium, maxPremium) * 100) / 100;
}

export function computeAdjustedMarketValue(baseDynastyValue: number, hypePremiumPct: number): number {
  return Math.round(baseDynastyValue * (1 + hypePremiumPct / 100));
}

export function classifyMarketHeat(hypeVelocity: number): MarketHeatLevel {
  if (hypeVelocity > 30) return "HOT";
  if (hypeVelocity > 10) return "HEATING";
  if (hypeVelocity < -20) return "COLD";
  return "NEUTRAL";
}

export function computeVolatility14d(hypePremiumPct: number, hypeVelocity: number): number {
  const base = Math.abs(hypePremiumPct) * (1 + Math.abs(hypeVelocity) / 100);
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.round(base * jitter * 100) / 100;
}

export function computeBetaScore(volatility14d: number, leagueAvgVolatility: number): number {
  const avgVol = leagueAvgVolatility > 0 ? leagueAvgVolatility : 5;
  return Math.round((volatility14d / avgVol) * 100) / 100;
}

export function classifyMarketLabel(
  hypePremiumPct: number,
  hypeVelocity: number,
  volatility14d: number,
  supplyIndex: number,
  medianVolatility: number
): MarketLabel {
  if (hypePremiumPct > 10 && hypeVelocity > 20) return "Momentum Breakout";
  if (hypePremiumPct > 15 && volatility14d > medianVolatility * 1.5) return "Bubble Risk";
  if (hypePremiumPct < -5 && hypeVelocity > 0 && supplyIndex < 40) return "Accumulation Zone";
  if (hypePremiumPct > 5 && hypeVelocity < -10 && supplyIndex > 60) return "Distribution Phase";
  return null;
}

export function computePlayerMetrics(
  player: PlayerInput,
  dVix: number = 10,
  leagueAvgVolatility: number = 5,
  medianVolatility: number = 3
): Omit<InsertPlayerMarketMetrics, "id"> {
  const sentimentScore = computeSentimentScore(player);
  const hypeVelocity = computeHypeVelocity(player);
  const demandIndex = computeDemandIndex(player);
  const supplyIndex = computeTrueSupply(player);

  const baseDynastyValue = ktcValues.getPlayerValue(
    player.playerId,
    player.position,
    player.age,
    player.yearsExp,
    player.searchRank,
    !!player.team
  );

  const hypePremiumPct = computeHypePremiumTanh(demandIndex, dVix);
  const adjustedMarketValue = computeAdjustedMarketValue(baseDynastyValue, hypePremiumPct);
  const marketHeatLevel = classifyMarketHeat(hypeVelocity);
  const volatility14d = computeVolatility14d(hypePremiumPct, hypeVelocity);
  const betaScore = computeBetaScore(volatility14d, leagueAvgVolatility);
  const marketLabel = classifyMarketLabel(hypePremiumPct, hypeVelocity, volatility14d, supplyIndex, medianVolatility);

  return {
    playerId: player.playerId,
    playerName: player.name,
    position: player.position,
    team: player.team,
    sentimentScore,
    hypeVelocity,
    demandIndex,
    supplyIndex,
    hypePremiumPct,
    adjustedMarketValue,
    baseDynastyValue,
    marketHeatLevel,
    searchRank: player.searchRank,
    rosterPct: player.rosterPct,
    volatility14d,
    betaScore,
    marketLabel,
    trueSupply: supplyIndex,
    gapScore: 0,
    fundamentalRank: null,
    marketRank: null,
  };
}

export function computeAllPlayerMetrics(
  players: PlayerInput[],
  dVix: number = 10,
  leagueAvgVolatility: number = 5
): Omit<InsertPlayerMarketMetrics, "id">[] {
  const rawMetrics = players.map(p => computePlayerMetrics(p, dVix, leagueAvgVolatility));

  const volatilities = rawMetrics.map(m => m.volatility14d).filter(v => v > 0);
  const sortedVols = [...volatilities].sort((a, b) => a - b);
  const medianVolatility = sortedVols.length > 0
    ? sortedVols[Math.floor(sortedVols.length / 2)]
    : 3;

  const metricsWithLabels = players.map(p =>
    computePlayerMetrics(p, dVix, leagueAvgVolatility, medianVolatility)
  );

  const byFundamental = [...metricsWithLabels].sort((a, b) => b.baseDynastyValue - a.baseDynastyValue);
  const byMarket = [...metricsWithLabels].sort((a, b) => b.adjustedMarketValue - a.adjustedMarketValue);

  const fundamentalRankMap = new Map<string, number>();
  const marketRankMap = new Map<string, number>();
  byFundamental.forEach((m, i) => fundamentalRankMap.set(m.playerId, i + 1));
  byMarket.forEach((m, i) => marketRankMap.set(m.playerId, i + 1));

  return metricsWithLabels.map(m => {
    const fRank = fundamentalRankMap.get(m.playerId) || 0;
    const mRank = marketRankMap.get(m.playerId) || 0;
    return {
      ...m,
      fundamentalRank: fRank,
      marketRank: mRank,
      gapScore: fRank - mRank,
    };
  });
}

export function computeMarketIndices(
  allMetrics: Array<{ hypePremiumPct: number; adjustedMarketValue: number; volatility14d: number }>
): MarketIndices {
  if (allMetrics.length === 0) {
    return { dynastyMarketIndex: 0, dynastyVolatilityIndex: 0, avgHypePremium: 0, leagueAvgVolatility: 0 };
  }

  const sorted = [...allMetrics].sort((a, b) => b.adjustedMarketValue - a.adjustedMarketValue);
  const top100 = sorted.slice(0, 100);

  const totalValue = top100.reduce((s, m) => s + Math.abs(m.adjustedMarketValue), 0);
  const dmi = totalValue > 0
    ? top100.reduce((s, m) => s + m.hypePremiumPct * (Math.abs(m.adjustedMarketValue) / totalValue), 0)
    : 0;

  const top100Premiums = top100.map(m => m.hypePremiumPct);
  const dVix = stddev(top100Premiums);

  const allPremiums = allMetrics.map(m => m.hypePremiumPct);
  const avgHype = allPremiums.reduce((a, b) => a + b, 0) / allPremiums.length;

  const allVols = allMetrics.map(m => m.volatility14d).filter(v => v > 0);
  const avgVol = allVols.length > 0 ? allVols.reduce((a, b) => a + b, 0) / allVols.length : 5;

  return {
    dynastyMarketIndex: Math.round(dmi * 100) / 100,
    dynastyVolatilityIndex: Math.round(dVix * 100) / 100,
    avgHypePremium: Math.round(avgHype * 100) / 100,
    leagueAvgVolatility: Math.round(avgVol * 100) / 100,
  };
}

export function getHypeInflationMultiplier(demandIndex: number, supplyIndex: number): number {
  const raw = 1 + ((demandIndex - supplyIndex) / 200);
  return Math.round(clamp(raw, 0.80, 1.35) * 1000) / 1000;
}

export function getMarketFrictionModifier(demandIndex: number, supplyIndex: number): number {
  if (demandIndex > 70 && supplyIndex < 40) {
    const intensity = ((demandIndex - 70) / 30 + (40 - supplyIndex) / 40) / 2;
    return 0.05 + intensity * 0.07;
  }
  if (demandIndex < 40 && supplyIndex > 60) {
    const intensity = ((40 - demandIndex) / 40 + (supplyIndex - 60) / 40) / 2;
    return -(0.05 + intensity * 0.10);
  }
  return 0;
}
