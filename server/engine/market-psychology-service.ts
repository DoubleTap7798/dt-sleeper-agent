import type { InsertPlayerMarketMetrics } from "@shared/schema";
import * as ktcValues from "../ktc-values";

export type MarketHeatLevel = "COLD" | "NEUTRAL" | "HEATING" | "HOT";

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

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return clamp(((val - min) / (max - min)) * 100, 0, 100);
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

export function computeSupplyIndex(player: PlayerInput): number {
  const tradeBlockPct = player.isOnTradeBlock ? 70 : 10;

  const faEligibility = player.rosterPct < 50 ? 80 : player.rosterPct < 80 ? 40 : 10;

  const injuryAvailability = !player.injuryStatus ? 20 :
    player.injuryStatus === "IR" ? 90 :
      player.injuryStatus === "Out" ? 80 :
        player.injuryStatus === "Doubtful" ? 60 : 30;

  const posDepthSupply = clamp(player.depthChartRank * 15, 0, 100);

  const weighted =
    0.40 * tradeBlockPct +
    0.25 * faEligibility +
    0.20 * injuryAvailability +
    0.15 * posDepthSupply;

  return Math.round(clamp(weighted, 0, 100) * 10) / 10;
}

export function computeHypePremium(
  sentimentScore: number,
  hypeVelocity: number,
  demandIndex: number,
  baseDynastyValue: number
): number {
  const trueTalentScore = normalize(baseDynastyValue, 0, 10000);

  const rawHypeSignal =
    0.40 * sentimentScore +
    0.30 * clamp(50 + hypeVelocity / 2, 0, 100) +
    0.30 * demandIndex;

  const raw = (rawHypeSignal - trueTalentScore) / 100;

  return Math.round(clamp(raw, -0.25, 0.25) * 1000) / 1000;
}

export function computeAdjustedMarketValue(baseDynastyValue: number, hypePremiumPct: number): number {
  return Math.round(baseDynastyValue * (1 + hypePremiumPct));
}

export function classifyMarketHeat(hypeVelocity: number): MarketHeatLevel {
  if (hypeVelocity > 30) return "HOT";
  if (hypeVelocity > 10) return "HEATING";
  if (hypeVelocity < -20) return "COLD";
  return "NEUTRAL";
}

export function computePlayerMetrics(player: PlayerInput): Omit<InsertPlayerMarketMetrics, "id"> {
  const sentimentScore = computeSentimentScore(player);
  const hypeVelocity = computeHypeVelocity(player);
  const demandIndex = computeDemandIndex(player);
  const supplyIndex = computeSupplyIndex(player);

  const baseDynastyValue = ktcValues.getPlayerValue(
    player.playerId,
    player.position,
    player.age,
    player.yearsExp,
    player.searchRank,
    !!player.team
  );

  const hypePremiumPct = computeHypePremium(sentimentScore, hypeVelocity, demandIndex, baseDynastyValue);
  const adjustedMarketValue = computeAdjustedMarketValue(baseDynastyValue, hypePremiumPct);
  const marketHeatLevel = classifyMarketHeat(hypeVelocity);

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
  };
}

export function computeAllPlayerMetrics(players: PlayerInput[]): Omit<InsertPlayerMarketMetrics, "id">[] {
  return players.map(p => computePlayerMetrics(p));
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
