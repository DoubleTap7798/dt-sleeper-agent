// Dynasty Value Engine
// Custom value system for trade calculator - replaces KTC values
// Calculates league-specific values on 0-100 scale with 2 decimal precision

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface LeagueScoringSettings {
  passYds: number;
  passTd: number;
  passInt: number;
  pass2pt: number;
  passFd: number; // Passing first down
  rushYds: number;
  rushTd: number;
  rush2pt: number;
  rushFd: number; // Rushing first down
  rec: number; // PPR points
  recYds: number;
  recTd: number;
  rec2pt: number;
  recFd: number; // Receiving first down
  fumLost: number;
  bonusRecTe: number; // TE Premium
  bonusRecRb: number; // RB Reception bonus
  bonusRecWr: number; // WR Reception bonus
  bonus100RushYds?: number;
  bonus100RecYds?: number;
  bonus300PassYds?: number;
  // IDP scoring settings
  idpTkl: number; // Solo tackle
  idpAst: number; // Assisted tackle
  idpSack: number; // Sack
  idpInt: number; // Interception
  idpFF: number; // Forced fumble
  idpFR: number; // Fumble recovery
  idpPD: number; // Pass defended
  idpTFL: number; // Tackle for loss
  idpSafety: number; // Safety
  idpTd: number; // Defensive touchdown
  idpBlkKick: number; // Blocked kick
  idpQBHit: number; // QB hit
}

export interface LeagueRosterSettings {
  teamCount: number;
  qbSlots: number;
  rbSlots: number;
  wrSlots: number;
  teSlots: number;
  flexSlots: number; // RB/WR/TE flex
  superflexSlots: number; // QB/RB/WR/TE superflex
  benchSlots: number;
  // IDP roster slots
  dlSlots: number;
  lbSlots: number;
  dbSlots: number;
  idpFlexSlots: number; // DL/LB/DB flex
  isIDPLeague: boolean;
}

export interface PlayerProjection {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number;
  injuryStatus: string | null;
  projections: {
    passYds: number;
    passTd: number;
    passInt: number;
    rushYds: number;
    rushTd: number;
    receptions: number;
    recYds: number;
    recTd: number;
  };
}

export interface DynastyValue {
  playerId: string;
  name: string;
  position: string;
  team: string;
  value: number; // 0-100 scale with 2 decimals
  rawVOR: number;
  fantasyPoints: number;
  ageMultiplier: number;
  injuryMultiplier: number;
  scarcityBonus: number;
  productionMultiplier: number; // Bonus for elite performers
  tier: number;
}

export interface DraftPickValue {
  season: string;
  round: number;
  value: number; // 0-100 scale
  displayName: string;
}

// ============================================================================
// AGE CURVES BY POSITION
// ============================================================================

const AGE_CURVES: Record<string, { peak: [number, number]; decay: number }> = {
  QB: { peak: [25, 32], decay: 0.03 }, // Slow decay
  RB: { peak: [22, 27], decay: 0.05 }, // Extended peak to 27, reduced decay from 0.08 to 0.05
  WR: { peak: [24, 29], decay: 0.04 }, // Extended peak to 29, reduced decay
  TE: { peak: [25, 30], decay: 0.04 }, // Extended peak to 30
  // IDP positions
  DL: { peak: [24, 30], decay: 0.05 }, // Defensive linemen peak mid-20s to 30
  LB: { peak: [24, 29], decay: 0.05 }, // Linebackers similar to WRs
  DB: { peak: [23, 28], decay: 0.06 }, // Defensive backs decline a bit faster (speed-dependent)
};

function calculateAgeMultiplier(position: string, age: number | null): number {
  if (!age) return 0.85; // Unknown age penalty
  
  const curve = AGE_CURVES[position];
  if (!curve) return 1.0;
  
  const [peakStart, peakEnd] = curve.peak;
  
  if (age >= peakStart && age <= peakEnd) {
    return 1.0; // Peak years
  } else if (age < peakStart) {
    // Young player bonus (approaching peak)
    const yearsToGo = peakStart - age;
    return Math.max(0.7, 1.0 - yearsToGo * 0.02);
  } else {
    // Decline phase
    const yearsPastPeak = age - peakEnd;
    return Math.max(0.2, 1.0 - yearsPastPeak * curve.decay);
  }
}

// ============================================================================
// INJURY ADJUSTMENT
// ============================================================================

function calculateInjuryMultiplier(injuryStatus: string | null): number {
  if (!injuryStatus) return 1.0;
  
  const status = injuryStatus.toLowerCase();
  
  if (status === "ir" || status === "pup" || status === "out") {
    return 0.90; // 10% reduction for IR/Out
  } else if (status === "doubtful") {
    return 0.95;
  } else if (status === "questionable" || status === "probable") {
    return 0.98; // Slight reduction
  }
  
  return 1.0;
}

// ============================================================================
// POSITIONAL SCARCITY BONUS
// ============================================================================

function calculateScarcityBonus(position: string, positionRank: number): number {
  // Top-tier scarcity bonuses
  if (position === "QB") {
    if (positionRank <= 3) return 1.15;
    if (positionRank <= 8) return 1.08;
    if (positionRank <= 12) return 1.03;
  } else if (position === "RB") {
    if (positionRank <= 5) return 1.12;
    if (positionRank <= 12) return 1.06;
    if (positionRank <= 24) return 1.02;
  } else if (position === "WR") {
    if (positionRank <= 5) return 1.10;
    if (positionRank <= 12) return 1.05;
    if (positionRank <= 24) return 1.02;
  } else if (position === "TE") {
    // TE is most scarce - bigger bonuses
    if (positionRank <= 3) return 1.20;
    if (positionRank <= 6) return 1.12;
    if (positionRank <= 12) return 1.05;
  } else if (position === "DL") {
    // Edge rushers / sack specialists are valuable in IDP
    if (positionRank <= 5) return 1.12;
    if (positionRank <= 12) return 1.06;
    if (positionRank <= 24) return 1.02;
  } else if (position === "LB") {
    // Tackle machine linebackers are very valuable
    if (positionRank <= 5) return 1.15;
    if (positionRank <= 12) return 1.08;
    if (positionRank <= 24) return 1.03;
  } else if (position === "DB") {
    // Ball-hawking DBs have value
    if (positionRank <= 5) return 1.10;
    if (positionRank <= 12) return 1.05;
    if (positionRank <= 24) return 1.02;
  }
  
  return 1.0;
}

// ============================================================================
// PRODUCTION MULTIPLIER - Rewards elite performers
// ============================================================================

function calculateProductionMultiplier(position: string, ppg: number, totalPoints: number): number {
  // Base thresholds by position for "elite" production
  const eliteThresholds: Record<string, { elitePPG: number; goodPPG: number; eliteTotal: number }> = {
    QB: { elitePPG: 20, goodPPG: 15, eliteTotal: 300 },
    RB: { elitePPG: 15, goodPPG: 10, eliteTotal: 200 },
    WR: { elitePPG: 14, goodPPG: 10, eliteTotal: 200 },
    TE: { elitePPG: 12, goodPPG: 8, eliteTotal: 150 },
    DL: { elitePPG: 10, goodPPG: 6, eliteTotal: 120 },
    LB: { elitePPG: 12, goodPPG: 8, eliteTotal: 150 },
    DB: { elitePPG: 10, goodPPG: 6, eliteTotal: 120 },
  };
  
  const thresholds = eliteThresholds[position];
  if (!thresholds) return 1.0;
  
  let multiplier = 1.0;
  
  // PPG-based bonus (proven weekly production)
  if (ppg >= thresholds.elitePPG) {
    // Elite producer: 1.25-1.40x bonus based on how far above threshold
    const excess = (ppg - thresholds.elitePPG) / thresholds.elitePPG;
    multiplier += 0.25 + Math.min(0.15, excess * 0.3);
  } else if (ppg >= thresholds.goodPPG) {
    // Good producer: 1.10-1.25x bonus
    const ratio = (ppg - thresholds.goodPPG) / (thresholds.elitePPG - thresholds.goodPPG);
    multiplier += 0.10 + ratio * 0.15;
  }
  
  // Total points bonus (volume/durability reward)
  if (totalPoints >= thresholds.eliteTotal) {
    // Additional 5-10% for high total points (played full season as starter)
    const excess = (totalPoints - thresholds.eliteTotal) / thresholds.eliteTotal;
    multiplier += 0.05 + Math.min(0.05, excess * 0.1);
  }
  
  return Math.min(1.50, multiplier); // Cap at 50% bonus max
}

// ============================================================================
// DEPTH CHART MULTIPLIER - Adjusts value based on starter/backup status
// ============================================================================

function calculateDepthChartMultiplier(position: string, depthOrder: number | null): number {
  if (!depthOrder || depthOrder < 1) return 1.0; // Unknown depth - neutral
  
  // Position-specific depth multipliers
  // Starters (depth 1) get full value, backups get progressively less
  const depthMultipliers: Record<string, number[]> = {
    // [depth1, depth2, depth3, depth4+]
    QB: [1.0, 0.55, 0.30, 0.15], // QB2 has some value as handcuff
    RB: [1.0, 0.65, 0.45, 0.25], // RB2 can be valuable in committees
    WR: [1.0, 0.70, 0.50, 0.30], // WR depth matters less - more starters
    TE: [1.0, 0.55, 0.35, 0.20], // TE2 rarely sees volume
    // IDP positions - depth matters but less dramatically
    DL: [1.0, 0.75, 0.55, 0.35],
    LB: [1.0, 0.75, 0.55, 0.35],
    DB: [1.0, 0.75, 0.55, 0.35],
  };
  
  const multipliers = depthMultipliers[position];
  if (!multipliers) return 1.0;
  
  // Clamp depth order to valid index
  const index = Math.min(depthOrder - 1, multipliers.length - 1);
  return multipliers[index];
}

// ============================================================================
// FANTASY POINTS CALCULATION
// ============================================================================

// IDP position group mapping
const IDP_POSITIONS = new Set(["DL", "LB", "DB", "DE", "DT", "NT", "ED", "ILB", "OLB", "MLB", "CB", "S", "FS", "SS"]);

function getIDPPositionGroup(position: string): "DL" | "LB" | "DB" | null {
  switch (position) {
    case "DL": case "DE": case "DT": case "NT": case "ED": return "DL";
    case "LB": case "ILB": case "OLB": case "MLB": return "LB";
    case "DB": case "CB": case "S": case "FS": case "SS": return "DB";
    default: return null;
  }
}

// Typical per-game stats by IDP position group (used for value calculation)
// Based on historical averages for starting IDP players
const IDP_POSITION_AVERAGES: Record<string, {
  soloTkl: number;
  astTkl: number;
  sacks: number;
  interceptions: number;
  pd: number;
  ff: number;
  fr: number;
  tfl: number;
  qbHits: number;
}> = {
  DL: { soloTkl: 2.5, astTkl: 1.5, sacks: 0.35, interceptions: 0, pd: 0.1, ff: 0.05, fr: 0.02, tfl: 0.5, qbHits: 0.4 },
  LB: { soloTkl: 5.0, astTkl: 3.0, sacks: 0.15, interceptions: 0.05, pd: 0.2, ff: 0.03, fr: 0.03, tfl: 0.4, qbHits: 0.1 },
  DB: { soloTkl: 3.5, astTkl: 1.5, sacks: 0.02, interceptions: 0.12, pd: 0.5, ff: 0.02, fr: 0.01, tfl: 0.1, qbHits: 0 },
};

function calculateIDPFantasyPoints(
  position: string,
  scoring: LeagueScoringSettings,
  gamesPlayed: number = 17
): number {
  const group = getIDPPositionGroup(position);
  if (!group) return 0;
  
  const avg = IDP_POSITION_AVERAGES[group];
  if (!avg) return 0;
  
  let ppg = 0;
  
  // Calculate points per game based on league scoring
  ppg += avg.soloTkl * scoring.idpTkl;
  ppg += avg.astTkl * scoring.idpAst;
  ppg += avg.sacks * scoring.idpSack;
  ppg += avg.interceptions * scoring.idpInt;
  ppg += avg.pd * scoring.idpPD;
  ppg += avg.ff * scoring.idpFF;
  ppg += avg.fr * scoring.idpFR;
  ppg += avg.tfl * scoring.idpTFL;
  ppg += avg.qbHits * scoring.idpQBHit;
  
  // Season total
  return ppg * gamesPlayed;
}

function calculateFantasyPoints(
  projection: PlayerProjection["projections"],
  scoring: LeagueScoringSettings,
  position?: string
): number {
  // Check if this is an IDP position
  if (position && IDP_POSITIONS.has(position)) {
    return calculateIDPFantasyPoints(position, scoring);
  }
  
  let points = 0;
  
  // Passing
  points += (projection.passYds || 0) * (scoring.passYds || 0.04);
  points += (projection.passTd || 0) * (scoring.passTd || 4);
  points += (projection.passInt || 0) * (scoring.passInt || -2);
  
  // Estimate passing first downs (~4% of pass attempts result in first downs not counting TDs)
  const estPassFd = (projection.passYds || 0) / 15; // Rough estimate: 1 FD per 15 pass yards
  points += estPassFd * (scoring.passFd || 0);
  
  // Rushing
  points += (projection.rushYds || 0) * (scoring.rushYds || 0.1);
  points += (projection.rushTd || 0) * (scoring.rushTd || 6);
  
  // Estimate rushing first downs (~1 per 10 yards)
  const estRushFd = (projection.rushYds || 0) / 10;
  points += estRushFd * (scoring.rushFd || 0);
  
  // Receiving
  const receptions = projection.receptions || 0;
  points += receptions * (scoring.rec || 0);
  points += (projection.recYds || 0) * (scoring.recYds || 0.1);
  points += (projection.recTd || 0) * (scoring.recTd || 6);
  
  // Estimate receiving first downs (~40% of receptions are first downs)
  const estRecFd = receptions * 0.4;
  points += estRecFd * (scoring.recFd || 0);
  
  // Position-specific reception bonuses (TE Premium, RB/WR bonuses)
  if (position === "TE" && scoring.bonusRecTe) {
    points += receptions * scoring.bonusRecTe;
  } else if (position === "RB" && scoring.bonusRecRb) {
    points += receptions * scoring.bonusRecRb;
  } else if (position === "WR" && scoring.bonusRecWr) {
    points += receptions * scoring.bonusRecWr;
  }
  
  return points;
}

// ============================================================================
// REPLACEMENT LEVEL CALCULATION
// ============================================================================

function calculateReplacementLevel(
  roster: LeagueRosterSettings,
  position: string
): number {
  const { teamCount, qbSlots, rbSlots, wrSlots, teSlots, flexSlots, superflexSlots,
          dlSlots, lbSlots, dbSlots, idpFlexSlots } = roster;
  
  // Estimate starters per position based on roster settings
  let startersNeeded: number;
  
  switch (position) {
    case "QB":
      // QBs fill QB slots + most superflex slots
      startersNeeded = teamCount * (qbSlots + superflexSlots * 0.8);
      break;
    case "RB":
      // RBs fill RB slots + share of flex
      startersNeeded = teamCount * (rbSlots + flexSlots * 0.4);
      break;
    case "WR":
      // WRs fill WR slots + share of flex
      startersNeeded = teamCount * (wrSlots + flexSlots * 0.45);
      break;
    case "TE":
      // TEs fill TE slots + small share of flex
      startersNeeded = teamCount * (teSlots + flexSlots * 0.15);
      break;
    // IDP positions
    case "DL":
    case "DE":
    case "DT":
    case "NT":
    case "ED":
      startersNeeded = teamCount * (dlSlots + idpFlexSlots * 0.33);
      break;
    case "LB":
    case "ILB":
    case "OLB":
    case "MLB":
      startersNeeded = teamCount * (lbSlots + idpFlexSlots * 0.40);
      break;
    case "DB":
    case "CB":
    case "S":
    case "FS":
    case "SS":
      startersNeeded = teamCount * (dbSlots + idpFlexSlots * 0.27);
      break;
    default:
      startersNeeded = teamCount;
  }
  
  // Round up to get replacement player rank
  return Math.ceil(startersNeeded);
}

// ============================================================================
// DRAFT PICK VALUES
// ============================================================================

const DRAFT_PICK_BASE_VALUES: Record<number, number> = {
  1: 80, // 1st round picks are very valuable
  2: 55,
  3: 35,
  4: 18,
  5: 8,
};

const PICK_POSITION_ADJUSTMENTS: Record<string, number> = {
  early: 1.25, // Early 1st = ~100
  mid: 1.0,
  late: 0.80,
};

export function getDraftPickValue(
  season: string,
  round: number,
  pickPosition?: "early" | "mid" | "late",
  currentYear: number = new Date().getFullYear()
): DraftPickValue {
  const baseValue = DRAFT_PICK_BASE_VALUES[round] || 5;
  const yearDiff = parseInt(season) - currentYear;
  
  // Future picks lose ~10% per year
  const yearDecay = Math.max(0.5, 1 - yearDiff * 0.10);
  
  // Position adjustment if specified
  const positionMult = pickPosition ? PICK_POSITION_ADJUSTMENTS[pickPosition] : 1.0;
  
  let value = baseValue * yearDecay * positionMult;
  
  // Cap at 100
  value = Math.min(100, value);
  
  // Round to 2 decimals
  value = Math.round(value * 100) / 100;
  
  const ordinal = round === 1 ? "1st" : round === 2 ? "2nd" : round === 3 ? "3rd" : `${round}th`;
  const displayName = `${season} ${ordinal}${pickPosition ? ` (${pickPosition})` : ""}`;
  
  return {
    season,
    round,
    value,
    displayName,
  };
}

export function getAllDraftPickValues(currentYear: number = new Date().getFullYear()): DraftPickValue[] {
  const picks: DraftPickValue[] = [];
  
  for (let yearOffset = 0; yearOffset <= 3; yearOffset++) {
    const season = String(currentYear + yearOffset);
    for (let round = 1; round <= 4; round++) {
      // Add early/mid/late for 1st round only
      if (round === 1) {
        picks.push(getDraftPickValue(season, round, "early", currentYear));
        picks.push(getDraftPickValue(season, round, "mid", currentYear));
        picks.push(getDraftPickValue(season, round, "late", currentYear));
      } else {
        picks.push(getDraftPickValue(season, round, undefined, currentYear));
      }
    }
  }
  
  return picks;
}

// ============================================================================
// DEVY PROSPECT VALUES
// ============================================================================

export interface DevyProspect {
  id: string;
  name: string;
  position: string;
  college: string;
  draftEligibleYear: number;
  tier: number;
  projectedRound?: number;
  value: number;
}

export function calculateDevyValue(
  tier: number,
  draftEligibleYear: number,
  projectedRound: number = 1,
  currentYear: number = new Date().getFullYear()
): number {
  // Base value from tier (Tier 1 = highest)
  const tierBaseValues: Record<number, number> = {
    1: 95, // Elite prospects
    2: 85,
    3: 75,
    4: 65,
    5: 55,
    6: 45,
    7: 35,
    8: 28,
    9: 22,
    10: 16,
    11: 12,
  };
  
  const baseValue = tierBaseValues[tier] || 10;
  
  // Adjust for draft year distance (further = more uncertainty)
  const yearsUntilDraft = draftEligibleYear - currentYear;
  const yearDiscount = Math.max(0.6, 1 - yearsUntilDraft * 0.08);
  
  // Adjust for projected round
  const roundMultiplier = projectedRound === 1 ? 1.0 :
                          projectedRound === 2 ? 0.75 :
                          projectedRound === 3 ? 0.55 : 0.4;
  
  let value = baseValue * yearDiscount * roundMultiplier;
  value = Math.round(value * 100) / 100;
  
  return value;
}

// ============================================================================
// MAIN VALUE CALCULATION ENGINE
// ============================================================================

export async function calculateLeagueValues(
  leagueId: string,
  players: any[],
  scoringSettings: LeagueScoringSettings,
  rosterSettings: LeagueRosterSettings
): Promise<DynastyValue[]> {
  // Get projections for all players
  const projections = await getPlayerProjections(players);
  
  // Calculate replacement level for each position (including IDP if applicable)
  const replacementLevels: Record<string, number> = {
    QB: calculateReplacementLevel(rosterSettings, "QB"),
    RB: calculateReplacementLevel(rosterSettings, "RB"),
    WR: calculateReplacementLevel(rosterSettings, "WR"),
    TE: calculateReplacementLevel(rosterSettings, "TE"),
  };
  
  // Add IDP replacement levels if this is an IDP league
  if (rosterSettings.isIDPLeague) {
    replacementLevels.DL = calculateReplacementLevel(rosterSettings, "DL");
    replacementLevels.LB = calculateReplacementLevel(rosterSettings, "LB");
    replacementLevels.DB = calculateReplacementLevel(rosterSettings, "DB");
  }
  
  // Calculate fantasy points for each player (including position-specific bonuses)
  const playerPoints: { player: PlayerProjection; points: number }[] = [];
  
  for (const proj of projections) {
    const points = calculateFantasyPoints(proj.projections, scoringSettings, proj.position);
    playerPoints.push({ player: proj, points });
  }
  
  // Sort by points within each position to get replacement level points
  const positionGroups: Record<string, { player: PlayerProjection; points: number }[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
  };
  
  // Add IDP position groups if applicable
  if (rosterSettings.isIDPLeague) {
    positionGroups.DL = [];
    positionGroups.LB = [];
    positionGroups.DB = [];
  }
  
  for (const pp of playerPoints) {
    let pos = pp.player.position;
    // Normalize IDP positions to their group (DL, LB, DB)
    const idpGroup = getIDPPositionGroup(pos);
    if (idpGroup && positionGroups[idpGroup]) {
      pos = idpGroup;
    }
    if (positionGroups[pos]) {
      positionGroups[pos].push(pp);
    }
  }
  
  // Sort each position by points descending
  for (const pos of Object.keys(positionGroups)) {
    positionGroups[pos].sort((a, b) => b.points - a.points);
  }
  
  // Get replacement level points for each position
  const replacementPoints: Record<string, number> = {};
  for (const pos of Object.keys(positionGroups)) {
    const replRank = replacementLevels[pos];
    const players = positionGroups[pos];
    if (players.length >= replRank) {
      replacementPoints[pos] = players[replRank - 1].points;
    } else if (players.length > 0) {
      replacementPoints[pos] = players[players.length - 1].points * 0.8;
    } else {
      replacementPoints[pos] = 0;
    }
  }
  
  // Calculate VOR for each player
  const dynastyValues: DynastyValue[] = [];
  
  for (const pp of playerPoints) {
    const { player, points } = pp;
    const originalPos = player.position;
    
    // Normalize IDP positions to their group for VOR calculation
    const idpGroup = getIDPPositionGroup(originalPos);
    const groupPos = (idpGroup && positionGroups[idpGroup]) ? idpGroup : originalPos;
    
    // Get position rank
    const positionRank = positionGroups[groupPos]?.findIndex(p => p.player.playerId === player.playerId) + 1 || 999;
    
    // Calculate raw VOR
    const replPoints = replacementPoints[groupPos] || 0;
    const rawVOR = Math.max(0, points - replPoints);
    
    // Calculate estimated PPG (assuming 17-game season for projections)
    const estimatedPPG = points / 17;
    
    // Apply dynasty adjustments (use group position for age curves)
    const ageMultiplier = calculateAgeMultiplier(groupPos, player.age);
    const injuryMultiplier = calculateInjuryMultiplier(player.injuryStatus);
    const scarcityBonus = calculateScarcityBonus(groupPos, positionRank);
    const productionMultiplier = calculateProductionMultiplier(groupPos, estimatedPPG, points);
    
    // Final adjusted VOR - production multiplier rewards elite performers
    const adjustedVOR = rawVOR * ageMultiplier * injuryMultiplier * scarcityBonus * productionMultiplier;
    
    dynastyValues.push({
      playerId: player.playerId,
      name: player.name,
      position: groupPos, // Use group position for display
      team: player.team,
      value: 0, // Will normalize later
      rawVOR: adjustedVOR,
      fantasyPoints: points,
      ageMultiplier,
      injuryMultiplier,
      scarcityBonus,
      productionMultiplier,
      tier: 0, // Will calculate later
    });
  }
  
  // Normalize to 0-100 scale
  const maxVOR = Math.max(...dynastyValues.map(v => v.rawVOR), 1);
  
  for (const dv of dynastyValues) {
    // Normalize to 0-100
    let normalizedValue = (dv.rawVOR / maxVOR) * 100;
    
    // Round to 2 decimal places
    normalizedValue = Math.round(normalizedValue * 100) / 100;
    
    dv.value = normalizedValue;
    
    // Assign tier based on value
    if (normalizedValue >= 90) dv.tier = 1;
    else if (normalizedValue >= 75) dv.tier = 2;
    else if (normalizedValue >= 60) dv.tier = 3;
    else if (normalizedValue >= 45) dv.tier = 4;
    else if (normalizedValue >= 30) dv.tier = 5;
    else if (normalizedValue >= 15) dv.tier = 6;
    else dv.tier = 7;
  }
  
  // Sort by value descending
  dynastyValues.sort((a, b) => b.value - a.value);
  
  return dynastyValues;
}

// ============================================================================
// PLAYER PROJECTION HELPER
// ============================================================================

async function getPlayerProjections(players: any[]): Promise<PlayerProjection[]> {
  const projections: PlayerProjection[] = [];
  
  for (const player of players) {
    // Get player details - handle both formats
    const playerId = player.player_id || player.playerId || player.id;
    const name = player.full_name || player.name || `${player.first_name} ${player.last_name}`;
    const position = player.position || "UNKNOWN";
    const team = player.team || "FA";
    
    // Calculate age from birth date or use provided age
    let age: number | null = player.age || null;
    if (!age && player.birth_date) {
      const birthYear = new Date(player.birth_date).getFullYear();
      age = new Date().getFullYear() - birthYear;
    }
    
    const yearsExp = player.years_exp || 0;
    const injuryStatus = player.injury_status || null;
    
    // Use Sleeper projections if available, otherwise estimate
    const proj = player.projected_stats || player.projections || {};
    
    projections.push({
      playerId,
      name,
      position,
      team,
      age,
      yearsExp,
      injuryStatus,
      projections: {
        passYds: proj.pass_yd || proj.passYds || 0,
        passTd: proj.pass_td || proj.passTd || 0,
        passInt: proj.pass_int || proj.passInt || 0,
        rushYds: proj.rush_yd || proj.rushYds || 0,
        rushTd: proj.rush_td || proj.rushTd || 0,
        receptions: proj.rec || proj.receptions || 0,
        recYds: proj.rec_yd || proj.recYds || 0,
        recTd: proj.rec_td || proj.recTd || 0,
      },
    });
  }
  
  return projections;
}

// ============================================================================
// PARSE LEAGUE SETTINGS FROM SLEEPER
// ============================================================================

export function parseLeagueScoringSettings(leagueSettings: any): LeagueScoringSettings {
  const scoring = leagueSettings.scoring_settings || {};
  
  return {
    passYds: scoring.pass_yd || 0.04,
    passTd: scoring.pass_td || 4,
    passInt: scoring.pass_int || -2,
    pass2pt: scoring.pass_2pt || 2,
    passFd: scoring.pass_fd || 0, // Passing first down
    rushYds: scoring.rush_yd || 0.1,
    rushTd: scoring.rush_td || 6,
    rush2pt: scoring.rush_2pt || 2,
    rushFd: scoring.rush_fd || 0, // Rushing first down
    rec: scoring.rec || 0, // PPR setting
    recYds: scoring.rec_yd || 0.1,
    recTd: scoring.rec_td || 6,
    rec2pt: scoring.rec_2pt || 2,
    recFd: scoring.rec_fd || 0, // Receiving first down
    fumLost: scoring.fum_lost || -2,
    bonusRecTe: scoring.bonus_rec_te || 0, // TE Premium
    bonusRecRb: scoring.bonus_rec_rb || 0, // RB Reception bonus
    bonusRecWr: scoring.bonus_rec_wr || 0, // WR Reception bonus
    bonus100RushYds: scoring.bonus_rush_yd_100 || 0,
    bonus100RecYds: scoring.bonus_rec_yd_100 || 0,
    bonus300PassYds: scoring.bonus_pass_yd_300 || 0,
    // IDP scoring - Sleeper uses idp_tkl_solo, idp_tkl_ast, etc.
    // Note: idp_tkl is total tackles in some formats, we use solo tackle points
    idpTkl: scoring.idp_tkl_solo || scoring.idp_tkl || 1,
    idpAst: scoring.idp_tkl_ast || 0.5,
    idpSack: scoring.idp_sack || 2,
    idpInt: scoring.idp_int || 3,
    idpFF: scoring.idp_ff || 2,
    idpFR: scoring.idp_fum_rec || 2,
    idpPD: scoring.idp_pass_def || 1,
    idpTFL: scoring.idp_tkl_loss || 1,
    idpSafety: scoring.idp_safe || 2,
    idpTd: scoring.idp_td || scoring.def_td || 6,
    idpBlkKick: scoring.idp_blk_kick || 2,
    idpQBHit: scoring.idp_qb_hit || 0.5,
  };
}

export function parseLeagueRosterSettings(league: any): LeagueRosterSettings {
  const rosterPositions: string[] = league.roster_positions || [];
  const teamCount = league.total_rosters || 12;
  
  let qbSlots = 0, rbSlots = 0, wrSlots = 0, teSlots = 0;
  let flexSlots = 0, superflexSlots = 0, benchSlots = 0;
  let dlSlots = 0, lbSlots = 0, dbSlots = 0, idpFlexSlots = 0;
  
  for (const pos of rosterPositions) {
    switch (pos) {
      case "QB": qbSlots++; break;
      case "RB": rbSlots++; break;
      case "WR": wrSlots++; break;
      case "TE": teSlots++; break;
      case "FLEX": flexSlots++; break;
      case "SUPER_FLEX": superflexSlots++; break;
      case "BN": benchSlots++; break;
      // IDP positions
      case "DL": case "DE": case "DT": case "NT": case "ED": dlSlots++; break;
      case "LB": case "ILB": case "OLB": case "MLB": lbSlots++; break;
      case "DB": case "CB": case "S": case "FS": case "SS": dbSlots++; break;
      case "IDP_FLEX": idpFlexSlots++; break;
    }
  }
  
  const isIDPLeague = dlSlots > 0 || lbSlots > 0 || dbSlots > 0 || idpFlexSlots > 0;
  
  return {
    teamCount,
    qbSlots,
    rbSlots,
    wrSlots,
    teSlots,
    flexSlots,
    superflexSlots,
    benchSlots,
    dlSlots,
    lbSlots,
    dbSlots,
    idpFlexSlots,
    isIDPLeague,
  };
}

export function isLeagueSuperflex(league: any): boolean {
  const settings = parseLeagueRosterSettings(league);
  return settings.superflexSlots > 0;
}

// ============================================================================
// TRADE GRADE CALCULATION (updated for 0-100 scale)
// ============================================================================

export function calculateTradeGrade(
  teamAValue: number,
  teamBValue: number
): { grade: string; winner: "A" | "B" | "even"; difference: number; percentageDiff: number } {
  const difference = Math.abs(teamAValue - teamBValue);
  const maxValue = Math.max(teamAValue, teamBValue);
  const percentageDiff = maxValue > 0 ? (difference / maxValue) * 100 : 0;

  let grade: string;
  let winner: "A" | "B" | "even";

  // Team A wins if they RECEIVE more than they GIVE (teamBValue > teamAValue)
  const teamAWins = teamBValue > teamAValue;

  if (percentageDiff < 5) {
    grade = "A+";
    winner = "even";
  } else if (percentageDiff < 10) {
    grade = "A";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 15) {
    grade = "A-";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 20) {
    grade = "B+";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 25) {
    grade = "B";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 30) {
    grade = "B-";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 40) {
    grade = "C";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 50) {
    grade = "D";
    winner = teamAWins ? "A" : "B";
  } else {
    grade = "F";
    winner = teamAWins ? "A" : "B";
  }

  return {
    grade,
    winner,
    difference: teamBValue - teamAValue, // Positive = Team A receives more
    percentageDiff: Math.round(percentageDiff * 100) / 100,
  };
}

// ============================================================================
// QUICK VALUE LOOKUP (for use without full league calculation)
// ============================================================================

// Default values for quick lookup when full calculation isn't needed
// These are baseline values that will be adjusted by league settings
const DEFAULT_PLAYER_VALUES: Record<string, number> = {};

export interface QuickPlayerValueResult {
  value: number;
  leagueValue: number;
  consensusValue: number | null;
  blended: boolean;
}

export function getQuickPlayerValue(
  playerId: string,
  position: string,
  age: number | null,
  yearsExp: number,
  injuryStatus: string | null = null,
  actualStats: { points?: number; games?: number; ppg?: number } = {},
  depthChartOrder: number | null = null,
  leagueScoring: LeagueScoringSettings | null = null
): number {
  // Base values by position - adjusted based on league scoring type
  let positionBaseValues: Record<string, number> = {
    QB: 65,
    RB: 55,
    WR: 60,
    TE: 45,
    K: 5,
    DEF: 5,
    // IDP positions - generally lower than offensive players
    DL: 40,
    LB: 42,
    DB: 38,
  };
  
  // Track scoring adjustments for debugging
  let scoringAdjustments: string[] = [];
  
  // Adjust base values based on league scoring settings
  if (leagueScoring) {
    // PPR scoring boosts pass catchers - SIGNIFICANT adjustments
    const pprBonus = leagueScoring.rec || 0;
    if (pprBonus >= 1.0) {
      // Full PPR - major boost to pass catchers
      positionBaseValues.WR += 12;
      positionBaseValues.RB += 8; // Pass-catching backs benefit significantly
      positionBaseValues.TE += 15;
      scoringAdjustments.push(`FullPPR(WR+12,RB+8,TE+15)`);
    } else if (pprBonus >= 0.5) {
      // Half PPR
      positionBaseValues.WR += 6;
      positionBaseValues.RB += 4;
      positionBaseValues.TE += 8;
      scoringAdjustments.push(`HalfPPR(WR+6,RB+4,TE+8)`);
    } else {
      scoringAdjustments.push(`Standard(no PPR bonus)`);
    }
    
    // 6-pt passing TDs boost QBs significantly
    if (leagueScoring.passTd >= 6) {
      positionBaseValues.QB += 12;
      scoringAdjustments.push(`6ptPassTD(QB+12)`);
    } else if (leagueScoring.passTd >= 5) {
      positionBaseValues.QB += 6;
      scoringAdjustments.push(`5ptPassTD(QB+6)`);
    }
    
    // TE premium - significant boost
    if (leagueScoring.bonusRecTe && leagueScoring.bonusRecTe > 0) {
      const teBonus = Math.min(20, leagueScoring.bonusRecTe * 8);
      positionBaseValues.TE += teBonus;
      scoringAdjustments.push(`TEPremium(TE+${teBonus})`);
    }
    
    // Bonus yardage scoring - boosts workhorse players
    if (leagueScoring.bonus100RushYds && leagueScoring.bonus100RushYds > 0) {
      // 100-yard rushing bonus benefits bell-cow RBs
      positionBaseValues.RB += Math.min(8, leagueScoring.bonus100RushYds * 2);
      scoringAdjustments.push(`100YdRush(RB+${Math.min(8, leagueScoring.bonus100RushYds * 2)})`);
    }
    if (leagueScoring.bonus100RecYds && leagueScoring.bonus100RecYds > 0) {
      // 100-yard receiving bonus benefits WR1s
      positionBaseValues.WR += Math.min(6, leagueScoring.bonus100RecYds * 2);
      positionBaseValues.TE += Math.min(4, leagueScoring.bonus100RecYds * 1.5);
      scoringAdjustments.push(`100YdRec(WR+${Math.min(6, leagueScoring.bonus100RecYds * 2)})`);
    }
    if (leagueScoring.bonus300PassYds && leagueScoring.bonus300PassYds > 0) {
      // 300-yard passing bonus benefits high-volume passers
      positionBaseValues.QB += Math.min(8, leagueScoring.bonus300PassYds * 2);
      scoringAdjustments.push(`300YdPass(QB+${Math.min(8, leagueScoring.bonus300PassYds * 2)})`);
    }
    
    // First-down scoring - benefits possession receivers and grind-it-out RBs
    if (leagueScoring.rushFd && leagueScoring.rushFd > 0) {
      positionBaseValues.RB += Math.min(6, leagueScoring.rushFd * 4);
      scoringAdjustments.push(`RushFD(RB+${Math.min(6, leagueScoring.rushFd * 4)})`);
    }
    if (leagueScoring.recFd && leagueScoring.recFd > 0) {
      positionBaseValues.WR += Math.min(5, leagueScoring.recFd * 3);
      positionBaseValues.TE += Math.min(5, leagueScoring.recFd * 3);
      scoringAdjustments.push(`RecFD(WR/TE+${Math.min(5, leagueScoring.recFd * 3)})`);
    }
    if (leagueScoring.passFd && leagueScoring.passFd > 0) {
      positionBaseValues.QB += Math.min(5, leagueScoring.passFd * 3);
      scoringAdjustments.push(`PassFD(QB+${Math.min(5, leagueScoring.passFd * 3)})`);
    }
    
  } else {
    // No league scoring provided - log this for debugging
    scoringAdjustments.push("NoLeagueScoring(using defaults)");
  }
  
  let value = positionBaseValues[position] || 30;
  
  // Apply depth chart multiplier - this is critical for realistic values!
  // Normalize position for IDP
  const groupPos = getIDPPositionGroup(position) || position;
  value *= calculateDepthChartMultiplier(groupPos, depthChartOrder);
  
  // Apply age curve
  value *= calculateAgeMultiplier(groupPos, age);
  
  // Apply injury adjustment
  value *= calculateInjuryMultiplier(injuryStatus);
  
  // Experience adjustment
  if (yearsExp === 0) value *= 1.1;
  else if (yearsExp === 1) value *= 1.05;
  else if (yearsExp > 10) value *= 0.7;
  
  // Apply production multiplier based on actual stats (most important for realistic values!)
  if (actualStats.points !== undefined || actualStats.ppg !== undefined) {
    const totalPoints = actualStats.points || 0;
    const ppg = actualStats.ppg !== undefined 
      ? actualStats.ppg 
      : (actualStats.games && actualStats.games > 0 ? totalPoints / actualStats.games : 0);
    
    const productionMultiplier = calculateProductionMultiplier(groupPos, ppg, totalPoints);
    value *= productionMultiplier;
  } else if (!depthChartOrder || depthChartOrder <= 0) {
    // No actual stats AND no depth chart - add small variance based on player ID
    const hash = playerId.split("").reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const variance = 0.85 + (Math.abs(hash) % 30) / 100;
    value *= variance;
  }
  
  // Cap and round
  value = Math.min(100, Math.max(0, value));
  value = Math.round(value * 100) / 100;
  
  return value;
}

// ============================================================================
// AVERAGED VALUE CALCULATION (simple 50/50 blend with consensus)
// ============================================================================
// Approach: Simple average of league value and KTC consensus value
// - KTC raw value × 0.01 = normalized (e.g., 5532 → 55.32)
// - Average with league value: (leagueValue + ktcNormalized) / 2
// - Just publish the final dynasty value

export function getBlendedPlayerValue(
  playerId: string,
  playerName: string,
  position: string,
  age: number | null,
  yearsExp: number,
  injuryStatus: string | null = null,
  actualStats: { points?: number; games?: number; ppg?: number } = {},
  depthChartOrder: number | null = null,
  leagueScoring: LeagueScoringSettings | null = null,
  consensusValue: number | null = null,
  _leagueWeight: number = 0.5 // Not used - always 50/50
): QuickPlayerValueResult {
  const leagueValue = getQuickPlayerValue(
    playerId,
    position,
    age,
    yearsExp,
    injuryStatus,
    actualStats,
    depthChartOrder,
    leagueScoring
  );
  
  // If no consensus value, return pure league value
  if (consensusValue === null || consensusValue === undefined) {
    return {
      value: Math.round(leagueValue * 10) / 10,
      leagueValue: Math.round(leagueValue * 10) / 10,
      consensusValue: null,
      blended: false
    };
  }
  
  const roundedLeague = Math.round(leagueValue * 10) / 10;
  const roundedConsensus = Math.round(consensusValue * 10) / 10;
  
  // Simple 50/50 average of league and consensus values
  const averagedValue = (roundedLeague + roundedConsensus) / 2;
  const finalValue = Math.round(averagedValue * 10) / 10;
  
  return {
    value: finalValue,
    leagueValue: roundedLeague,
    consensusValue: roundedConsensus,
    blended: true // Always blended when consensus is available
  };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// Main functions:
// - calculateLeagueValues: Full league-specific value calculation
// - getDraftPickValue / getAllDraftPickValues: Draft pick values
// - calculateDevyValue: College prospect values
// - calculateTradeGrade: Trade evaluation
// - parseLeagueScoringSettings / parseLeagueRosterSettings: Parse Sleeper data
// - getQuickPlayerValue: Quick fallback value calculation
// - getBlendedPlayerValue: Average of league + KTC values (50/50)
