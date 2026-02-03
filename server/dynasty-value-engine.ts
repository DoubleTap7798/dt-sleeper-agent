// Dynasty Value Engine - UPGRADED ALGORITHM
// Custom value system for trade calculator - replaces KTC values
// Calculates league-specific values on 0-100 scale with 2 decimal precision
// 
// ALGORITHM OVERVIEW:
// 1. Multi-Year VOR: Calculate 3-year weighted VOR (50%/30%/20% with year discounts)
// 2. Normalize to Base Value (0-100 scale)
// 3. Apply multipliers: Age, Role Security, Injury Risk, Production Ceiling,
//    Volatility, Draft Capital, Team Context
// 4. Light scarcity bonus for elite tiers only
// 5. Blend 50/50 with KTC consensus value

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
  weightedVOR: number; // Multi-year weighted VOR
  fantasyPoints: number;
  // All multipliers applied
  ageMultiplier: number;
  roleSecurityMultiplier: number;
  injuryMultiplier: number;
  productionCeilingMultiplier: number;
  volatilityMultiplier: number;
  draftCapitalMultiplier: number;
  teamContextMultiplier: number;
  scarcityBonus: number;
  tier: number;
}

// Extended player info for multiplier calculations
export interface PlayerExtendedInfo {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number;
  injuryStatus: string | null;
  snapPct: number | null; // Snap share percentage
  depthChartOrder: number | null;
  draftRound: number | null; // NFL draft round
  gamesPlayed: number; // Games played this season
  weeklyScores: number[]; // Weekly fantasy scores for volatility
  // Historical injury data
  gamesPlayedLast3Years: number;
  maxPossibleGames: number; // 51 games over 3 years
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
  QB: { peak: [25, 32], decay: 0.03 }, // Slow decay - 3% per year after peak
  RB: { peak: [22, 27], decay: 0.05 }, // Faster decay - 5% per year after peak
  WR: { peak: [24, 29], decay: 0.04 }, // Moderate decay - 4% per year
  TE: { peak: [25, 30], decay: 0.04 }, // Moderate decay - 4% per year
  // IDP positions
  DL: { peak: [24, 30], decay: 0.05 }, // Defensive linemen peak mid-20s to 30
  LB: { peak: [24, 29], decay: 0.05 }, // Linebackers similar to WRs
  DB: { peak: [23, 28], decay: 0.06 }, // Defensive backs decline faster (speed-dependent)
};

// UPGRADED: Age Multiplier with bounded range 0.65-1.15
// Young players can get up to 15% bonus, minimum is 65% for old players
function calculateAgeMultiplier(position: string, age: number | null): number {
  if (!age) return 0.85; // Unknown age penalty
  
  const curve = AGE_CURVES[position];
  if (!curve) return 1.0;
  
  const [peakStart, peakEnd] = curve.peak;
  let multiplier = 1.0;
  
  if (age >= peakStart && age <= peakEnd) {
    multiplier = 1.0; // Peak years
  } else if (age < peakStart) {
    // Young player bonus (approaching peak) - up to 15% bonus
    const yearsToGo = peakStart - age;
    // More bonus for players closer to peak, max 15%
    const bonus = Math.min(0.15, yearsToGo * 0.04);
    multiplier = 1.0 + bonus;
  } else {
    // Decline phase - apply position-specific decay
    const yearsPastPeak = age - peakEnd;
    multiplier = 1.0 - yearsPastPeak * curve.decay;
  }
  
  // Clamp to 0.65-1.15 range
  return Math.max(0.65, Math.min(1.15, multiplier));
}

// ============================================================================
// ROLE SECURITY MULTIPLIER (NEW)
// ============================================================================
// Based on snap share, depth chart, and opportunity
// Elite locked-in starter: 1.10 to 1.15
// Solid starter: 1.00 to 1.08
// Committee player: 0.90 to 0.98
// Backup: 0.75 to 0.88

function calculateRoleSecurityMultiplier(
  position: string,
  snapPct: number | null,
  depthChartOrder: number | null
): number {
  // If no data at all, penalize with below-average value (unknown role = risky)
  if ((snapPct === null || snapPct === 0) && depthChartOrder === null) return 0.88;
  
  let multiplier = 1.0;
  
  // Snap percentage is primary indicator
  if (snapPct !== null) {
    if (snapPct >= 85) {
      // Elite locked-in starter (85%+ snaps)
      multiplier = 1.10 + ((snapPct - 85) / 15) * 0.05; // 1.10 to 1.15
    } else if (snapPct >= 65) {
      // Solid starter (65-85% snaps)
      multiplier = 1.00 + ((snapPct - 65) / 20) * 0.08; // 1.00 to 1.08
    } else if (snapPct >= 40) {
      // Committee player (40-65% snaps)
      multiplier = 0.90 + ((snapPct - 40) / 25) * 0.08; // 0.90 to 0.98
    } else if (snapPct >= 15) {
      // Backup role (15-40% snaps)
      multiplier = 0.75 + ((snapPct - 15) / 25) * 0.13; // 0.75 to 0.88
    } else {
      // Deep backup or inactive
      multiplier = 0.65 + (snapPct / 15) * 0.10; // 0.65 to 0.75
    }
  } else if (depthChartOrder !== null) {
    // Use depth chart as fallback
    if (depthChartOrder === 1) {
      multiplier = 1.08; // Starter
    } else if (depthChartOrder === 2) {
      multiplier = 0.85; // Backup
    } else {
      multiplier = 0.70; // Third string or lower
    }
  }
  
  return Math.max(0.65, Math.min(1.15, multiplier));
}

// ============================================================================
// INJURY RISK MULTIPLIER (UPGRADED)
// ============================================================================
// Combines current injury status AND historical durability

function calculateInjuryMultiplier(
  injuryStatus: string | null,
  gamesPlayedLast3Years: number = 51,
  maxPossibleGames: number = 51
): number {
  // Current status multiplier
  let currentMult = 1.0;
  if (injuryStatus) {
    const status = injuryStatus.toLowerCase();
    if (status === "ir" || status === "pup" || status === "out") {
      currentMult = 0.90;
    } else if (status === "doubtful") {
      currentMult = 0.95;
    } else if (status === "questionable" || status === "probable") {
      currentMult = 0.98;
    }
  }
  
  // Historical durability multiplier (0.93-1.00 range per spec)
  let historyMult = 1.0;
  if (maxPossibleGames > 0) {
    const durabilityRatio = gamesPlayedLast3Years / maxPossibleGames;
    if (durabilityRatio >= 0.90) {
      historyMult = 1.0; // Durable - played 90%+ of games
    } else if (durabilityRatio >= 0.75) {
      historyMult = 0.98; // Slight injury history
    } else if (durabilityRatio >= 0.50) {
      historyMult = 0.95; // Moderate injuries
    } else {
      historyMult = 0.93; // Injury prone (floor per spec)
    }
  }
  
  // Multiply both together
  return currentMult * historyMult;
}

// ============================================================================
// PRODUCTION CEILING MULTIPLIER (UPGRADED)
// ============================================================================
// Based on weekly fantasy points per game percentile
// Top 5% at position: 1.40 to 1.50
// Top 15%: 1.20 to 1.30
// Top 30%: 1.05 to 1.15
// All others: 1.00

function calculateProductionCeilingMultiplier(
  position: string,
  ppg: number,
  positionRank: number,
  totalPlayersAtPosition: number
): number {
  if (totalPlayersAtPosition === 0) return 1.0;
  
  const percentile = (positionRank / totalPlayersAtPosition) * 100;
  
  if (percentile <= 5) {
    // Top 5% - elite tier (1.40 to 1.50)
    const withinTier = percentile / 5; // 0 to 1 within this tier
    return 1.50 - withinTier * 0.10;
  } else if (percentile <= 15) {
    // Top 15% - star tier (1.20 to 1.30)
    const withinTier = (percentile - 5) / 10;
    return 1.30 - withinTier * 0.10;
  } else if (percentile <= 30) {
    // Top 30% - starter tier (1.05 to 1.15)
    const withinTier = (percentile - 15) / 15;
    return 1.15 - withinTier * 0.10;
  }
  
  // Below top 30% - no bonus
  return 1.0;
}

// ============================================================================
// VOLATILITY MULTIPLIER (NEW)
// ============================================================================
// Based on weekly consistency - consistent producers get bonus, boom/bust get penalty
// Consistent producers: 1.03 to 1.08
// Average volatility: 1.00
// Boom/bust players: 0.90 to 0.97

function calculateVolatilityMultiplier(weeklyScores: number[]): number {
  if (!weeklyScores || weeklyScores.length < 3) return 1.0;
  
  // Calculate standard deviation of weekly scores
  const mean = weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length;
  const variance = weeklyScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / weeklyScores.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (CV) = stdDev / mean
  // Lower CV = more consistent
  const cv = mean > 0 ? stdDev / mean : 1;
  
  if (cv <= 0.20) {
    // Very consistent (CV <= 20%) - 1.05 to 1.08
    return 1.05 + (0.20 - cv) * 0.15;
  } else if (cv <= 0.35) {
    // Consistent (CV 20-35%) - 1.03 to 1.05
    return 1.03 + (0.35 - cv) / 0.15 * 0.02;
  } else if (cv <= 0.50) {
    // Average volatility - 1.00
    return 1.0;
  } else if (cv <= 0.70) {
    // Boom/bust (CV 50-70%) - 0.95 to 0.97
    return 0.97 - (cv - 0.50) / 0.20 * 0.02;
  } else {
    // High boom/bust (CV > 70%) - 0.90 to 0.95
    return Math.max(0.90, 0.95 - (cv - 0.70) * 0.25);
  }
}

// ============================================================================
// DRAFT CAPITAL MULTIPLIER (NEW)
// ============================================================================
// For players under 4 years in league, based on NFL draft round
// Round 1: 1.15, Round 2: 1.08, Round 3: 1.02, Day 3: 0.90, Undrafted: 0.85
// Reduces by about 3% for each season played, floors at 1.00 once established

function calculateDraftCapitalMultiplier(
  draftRound: number | null,
  yearsExp: number
): number {
  // Only applies to players under 4 years experience
  if (yearsExp >= 4) return 1.0;
  
  // Get base multiplier from draft round
  let baseMult: number;
  if (draftRound === null || draftRound === 0) {
    baseMult = 0.85; // Undrafted
  } else if (draftRound === 1) {
    baseMult = 1.15;
  } else if (draftRound === 2) {
    baseMult = 1.08;
  } else if (draftRound === 3) {
    baseMult = 1.02;
  } else {
    baseMult = 0.90; // Day 3 (rounds 4-7)
  }
  
  // Reduce bonus by 3% per year of experience
  const yearlyDecay = yearsExp * 0.03;
  let adjustedMult = baseMult - yearlyDecay;
  
  // Floor at 1.00 for positive draft capital (don't let it become penalty once established)
  if (baseMult > 1.0) {
    adjustedMult = Math.max(1.0, adjustedMult);
  }
  
  // Clamp to spec bounds (0.85-1.15)
  return Math.max(0.85, Math.min(1.15, adjustedMult));
}

// ============================================================================
// TEAM CONTEXT MULTIPLIER (NEW)
// ============================================================================
// Based on offensive strength/team environment
// Top 5 offense: 1.05 to 1.08
// Top 15 offense: 1.02 to 1.04
// Bottom 10 offense: 0.95 to 0.98

// 2025 Offensive Rankings (based on total offensive production)
const TEAM_OFFENSIVE_RANKINGS: Record<string, number> = {
  // Top 5 offenses
  "DET": 1, "SF": 2, "BAL": 3, "BUF": 4, "MIA": 5,
  // Top 15 offenses
  "KC": 6, "DAL": 7, "PHI": 8, "CIN": 9, "MIN": 10,
  "LAR": 11, "GB": 12, "HOU": 13, "ATL": 14, "SEA": 15,
  // Middle of pack
  "LAC": 16, "TB": 17, "DEN": 18, "ARI": 19, "IND": 20,
  "WAS": 21, "CHI": 22, "JAX": 23,
  // Bottom 10 offenses
  "NO": 24, "LV": 25, "CLE": 26, "PIT": 27, "NYJ": 28,
  "NYG": 29, "TEN": 30, "NE": 31, "CAR": 32,
};

function calculateTeamContextMultiplier(team: string): number {
  const rank = TEAM_OFFENSIVE_RANKINGS[team];
  if (!rank) return 1.0; // Unknown team or FA
  
  if (rank <= 5) {
    // Top 5 offense: 1.05 to 1.08
    return 1.08 - (rank - 1) * 0.0075;
  } else if (rank <= 15) {
    // Top 15 offense: 1.02 to 1.04
    return 1.04 - (rank - 6) * 0.002;
  } else if (rank <= 23) {
    // Middle of pack: 1.00
    return 1.0;
  } else {
    // Bottom 10 offense: 0.95 to 0.98
    return 0.98 - (rank - 24) * 0.004;
  }
}

// ============================================================================
// POSITIONAL SCARCITY BONUS (LIGHT TOUCH)
// ============================================================================
// VOR already accounts for scarcity, so only apply light bonuses for elite tiers
// Superflex leagues: Top 1-3 QBs get 8-12% boost
// All leagues: Top 1-3 TEs get 10-15% boost, Top 1-5 RBs in deep leagues get 5-10% boost

function calculateScarcityBonus(
  position: string,
  positionRank: number,
  isSuperflex: boolean = false
): number {
  // Light scarcity bonuses - only for elite players at scarce positions
  
  if (position === "QB" && isSuperflex) {
    // Superflex leagues: QB scarcity matters more
    if (positionRank <= 1) return 1.12;
    if (positionRank <= 3) return 1.08;
    // No bonus for QB4+ even in superflex
  } else if (position === "TE") {
    // TE is most scarce - bigger bonuses
    if (positionRank <= 1) return 1.15;
    if (positionRank <= 3) return 1.10;
    // No bonus for TE4+
  } else if (position === "RB") {
    // RB scarcity in deep leagues
    if (positionRank <= 3) return 1.10;
    if (positionRank <= 5) return 1.05;
    // No bonus for RB6+
  }
  // WR and IDP positions don't get scarcity bonus since VOR handles it
  
  return 1.0;
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
  // displayName is just year + round - position label is added by caller
  const displayName = `${season} ${ordinal}`;
  
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
// MULTI-YEAR VOR CALCULATION (NEW)
// ============================================================================
// Calculate VOR for next 3 seasons with weighted averaging:
// Year 1: 50% weight
// Year 2: 30% weight, discounted by 8%
// Year 3: 20% weight, discounted by 15%

function calculateMultiYearVOR(
  year1Points: number,
  replacementPoints: number,
  age: number | null,
  position: string
): { weightedVOR: number; year1VOR: number; year2VOR: number; year3VOR: number } {
  const year1VOR = Math.max(0, year1Points - replacementPoints);
  
  // Project future years based on age curve
  const curve = AGE_CURVES[position];
  let year2Decay = 1.0;
  let year3Decay = 1.0;
  
  if (age && curve) {
    const [peakStart, peakEnd] = curve.peak;
    const futureAge2 = age + 1;
    const futureAge3 = age + 2;
    
    // Calculate decay for year 2
    if (futureAge2 > peakEnd) {
      year2Decay = Math.max(0.7, 1.0 - (futureAge2 - peakEnd) * curve.decay);
    }
    
    // Calculate decay for year 3
    if (futureAge3 > peakEnd) {
      year3Decay = Math.max(0.5, 1.0 - (futureAge3 - peakEnd) * curve.decay);
    }
  }
  
  // Project future VOR with age decay
  const year2VOR = year1VOR * year2Decay;
  const year3VOR = year1VOR * year3Decay;
  
  // Apply weighted average with time discounts
  // Year 1: 50% weight
  // Year 2: 30% weight, discounted by 8%
  // Year 3: 20% weight, discounted by 15%
  const weightedVOR = 
    (year1VOR * 0.50) + 
    (year2VOR * 0.30 * 0.92) + // 8% discount
    (year3VOR * 0.20 * 0.85);  // 15% discount
  
  return { weightedVOR, year1VOR, year2VOR, year3VOR };
}

// ============================================================================
// MAIN VALUE CALCULATION ENGINE (UPGRADED)
// ============================================================================

export async function calculateLeagueValues(
  leagueId: string,
  players: any[],
  scoringSettings: LeagueScoringSettings,
  rosterSettings: LeagueRosterSettings
): Promise<DynastyValue[]> {
  // Get projections for all players
  const projections = await getPlayerProjections(players);
  
  // Detect if this is a superflex league
  const isSuperflex = rosterSettings.superflexSlots > 0 || rosterSettings.qbSlots >= 2;
  
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
  const playerPoints: { player: PlayerProjection; points: number; originalPlayer: any }[] = [];
  
  for (let i = 0; i < projections.length; i++) {
    const proj = projections[i];
    const originalPlayer = players[i];
    const points = calculateFantasyPoints(proj.projections, scoringSettings, proj.position);
    playerPoints.push({ player: proj, points, originalPlayer });
  }
  
  // Sort by points within each position to get replacement level points
  const positionGroups: Record<string, { player: PlayerProjection; points: number; originalPlayer: any }[]> = {
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
    const playersAtPos = positionGroups[pos];
    if (playersAtPos.length >= replRank) {
      replacementPoints[pos] = playersAtPos[replRank - 1].points;
    } else if (playersAtPos.length > 0) {
      replacementPoints[pos] = playersAtPos[playersAtPos.length - 1].points * 0.8;
    } else {
      replacementPoints[pos] = 0;
    }
  }
  
  // Calculate values for each player with all multipliers
  const dynastyValues: DynastyValue[] = [];
  
  for (const pp of playerPoints) {
    const { player, points, originalPlayer } = pp;
    const originalPos = player.position;
    
    // Normalize IDP positions to their group for VOR calculation
    const idpGroup = getIDPPositionGroup(originalPos);
    const groupPos = (idpGroup && positionGroups[idpGroup]) ? idpGroup : originalPos;
    
    // Get position rank and total players at position
    const positionRank = positionGroups[groupPos]?.findIndex(p => p.player.playerId === player.playerId) + 1 || 999;
    const totalPlayersAtPosition = positionGroups[groupPos]?.length || 1;
    
    // STEP 1: Calculate Multi-Year Weighted VOR
    const replPoints = replacementPoints[groupPos] || 0;
    const { weightedVOR, year1VOR } = calculateMultiYearVOR(
      points, replPoints, player.age, groupPos
    );
    
    // Calculate estimated PPG (assuming 17-game season for projections)
    const estimatedPPG = points / 17;
    
    // STEP 2 & MULTIPLIERS: Get all multipliers
    
    // 1. Age Multiplier (0.65 to 1.15)
    const ageMultiplier = calculateAgeMultiplier(groupPos, player.age);
    
    // 2. Role Security Multiplier (0.65 to 1.15)
    const snapPct = originalPlayer?.snap_pct || originalPlayer?.snapPct || null;
    const depthOrder = originalPlayer?.depth_chart_order || originalPlayer?.depthChartOrder || null;
    const roleSecurityMultiplier = calculateRoleSecurityMultiplier(groupPos, snapPct, depthOrder);
    
    // 3. Injury Multiplier (combines current status + historical)
    const gamesLast3 = originalPlayer?.games_played_last_3_years || 51;
    const maxGames = originalPlayer?.max_possible_games || 51;
    const injuryMultiplier = calculateInjuryMultiplier(player.injuryStatus, gamesLast3, maxGames);
    
    // 4. Production Ceiling Multiplier (1.00 to 1.50)
    const productionCeilingMultiplier = calculateProductionCeilingMultiplier(
      groupPos, estimatedPPG, positionRank, totalPlayersAtPosition
    );
    
    // 5. Volatility Multiplier (0.90 to 1.08)
    const weeklyScores = originalPlayer?.weekly_scores || originalPlayer?.weeklyScores || [];
    const volatilityMultiplier = calculateVolatilityMultiplier(weeklyScores);
    
    // 6. Draft Capital Multiplier (0.85 to 1.15 for young players)
    const draftRound = originalPlayer?.draft_round || originalPlayer?.draftRound || null;
    const draftCapitalMultiplier = calculateDraftCapitalMultiplier(draftRound, player.yearsExp);
    
    // 7. Team Context Multiplier (0.95 to 1.08)
    const teamContextMultiplier = calculateTeamContextMultiplier(player.team);
    
    // STEP 3: Light Scarcity Bonus (only for elite tiers)
    const scarcityBonus = calculateScarcityBonus(groupPos, positionRank, isSuperflex);
    
    // Apply all multipliers to weighted VOR
    const adjustedVOR = weightedVOR * 
      ageMultiplier * 
      roleSecurityMultiplier * 
      injuryMultiplier * 
      productionCeilingMultiplier * 
      volatilityMultiplier * 
      draftCapitalMultiplier * 
      teamContextMultiplier * 
      scarcityBonus;
    
    dynastyValues.push({
      playerId: player.playerId,
      name: player.name,
      position: groupPos,
      team: player.team,
      value: 0, // Will normalize later
      rawVOR: year1VOR,
      weightedVOR: weightedVOR,
      fantasyPoints: points,
      ageMultiplier,
      roleSecurityMultiplier,
      injuryMultiplier,
      productionCeilingMultiplier,
      volatilityMultiplier,
      draftCapitalMultiplier,
      teamContextMultiplier,
      scarcityBonus,
      tier: 0, // Will calculate later
    });
  }
  
  // STEP 2 continued: Normalize to 0-100 scale (Base Dynasty Value)
  const maxVOR = Math.max(...dynastyValues.map(v => v.weightedVOR * 
    v.ageMultiplier * v.roleSecurityMultiplier * v.injuryMultiplier * 
    v.productionCeilingMultiplier * v.volatilityMultiplier * 
    v.draftCapitalMultiplier * v.teamContextMultiplier * v.scarcityBonus), 1);
  
  for (const dv of dynastyValues) {
    // Calculate final adjusted value
    const adjustedValue = dv.weightedVOR * 
      dv.ageMultiplier * dv.roleSecurityMultiplier * dv.injuryMultiplier * 
      dv.productionCeilingMultiplier * dv.volatilityMultiplier * 
      dv.draftCapitalMultiplier * dv.teamContextMultiplier * dv.scarcityBonus;
    
    // Normalize to 0-100
    let normalizedValue = (adjustedValue / maxVOR) * 100;
    
    // STEP 6: Clamp to 1-100 range
    normalizedValue = Math.max(1, Math.min(100, normalizedValue));
    
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
  if (!league) {
    // Return default 1QB settings if no league data
    return {
      qbSlots: 1, rbSlots: 2, wrSlots: 2, teSlots: 1,
      flexSlots: 2, superflexSlots: 0, benchSlots: 6, teamCount: 12,
      dlSlots: 0, lbSlots: 0, dbSlots: 0, idpFlexSlots: 0, isIDPLeague: false
    };
  }
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
  // Detect both Superflex leagues (SUPER_FLEX position) and 2QB leagues (2+ QB slots)
  return settings.superflexSlots > 0 || settings.qbSlots >= 2;
}

// ============================================================================
// KTC-STYLE VALUE ADJUSTMENT (Stud Premium)
// ============================================================================

/**
 * Calculate the "adjustment multiplier" for a player based on their value tier.
 * Elite players contribute more of their value in trades (stud premium).
 * Lower-value players contribute less (prevents quantity-for-quality trades).
 * 
 * Tiers based on 0-100 dynasty value scale:
 * - Elite (80+): 38-40% multiplier
 * - Star (65-79): 30-35% multiplier
 * - Starter (50-64): 22-28% multiplier
 * - Bench (35-49): 15-20% multiplier
 * - Depth (20-34): 12-15% multiplier
 * - Lottery (<20): 10% multiplier
 */
export function getAdjustmentMultiplier(value: number): number {
  if (value >= 80) {
    // Elite tier: 38-40% (scales with value)
    return 0.38 + ((value - 80) / 20) * 0.02;
  } else if (value >= 65) {
    // Star tier: 30-35%
    return 0.30 + ((value - 65) / 15) * 0.05;
  } else if (value >= 50) {
    // Starter tier: 22-28%
    return 0.22 + ((value - 50) / 15) * 0.06;
  } else if (value >= 35) {
    // Bench tier: 15-20%
    return 0.15 + ((value - 35) / 15) * 0.05;
  } else if (value >= 20) {
    // Depth tier: 12-15%
    return 0.12 + ((value - 20) / 15) * 0.03;
  } else {
    // Lottery tier: 10%
    return 0.10;
  }
}

/**
 * Calculate the adjusted value for a single asset.
 * Adjusted value = raw value * adjustment multiplier
 */
export function getAdjustedValue(rawValue: number): number {
  const multiplier = getAdjustmentMultiplier(rawValue);
  return rawValue * multiplier;
}

/**
 * Calculate the consolidation premium for a side of a trade.
 * This rewards sides that are trading away fewer, higher-value assets (studs).
 * 
 * The premium is designed to match KTC's "Value Adjustment" which gives
 * a ~30-40% boost when trading away elite players for multiple pieces.
 * 
 * Logic:
 * - Higher max single asset value = bigger premium
 * - Higher concentration of value in top assets = bigger premium
 * - Premium is returned as ADDITIVE VALUE (not percentage) applied to raw total
 * 
 * Returns the additive premium value to add to the adjusted total.
 */
export function calculateConsolidationPremium(
  assets: Array<{ value: number }>,
  opposingAssetCount: number
): number {
  if (assets.length === 0) return 0;
  
  // Sort assets by value (highest first)
  const sortedValues = assets.map(a => a.value).sort((a, b) => b - a);
  const maxValue = sortedValues[0];
  const totalRawValue = sortedValues.reduce((sum, v) => sum + v, 0);
  const assetCount = assets.length;
  
  // Calculate concentration: what % of total value is in the top asset
  const concentration = totalRawValue > 0 ? maxValue / totalRawValue : 0;
  
  // Premium triggers when:
  // 1. You have at least one star player (70+)
  // 2. AND either: fewer pieces than opponent OR high concentration (>60%)
  const hasFewerPieces = assetCount < opposingAssetCount;
  const hasHighConcentration = concentration > 0.60;
  
  if (maxValue < 70 || (!hasFewerPieces && !hasHighConcentration)) return 0;
  
  // Base premium rate based on max asset value tier
  // These rates are applied to the MAX ASSET VALUE (not total)
  let basePremiumRate = 0;
  
  if (maxValue >= 93) {
    // Elite 1 (top 3-5 dynasty assets like Chase, Jefferson, etc.): 35-42%
    basePremiumRate = 0.35 + ((maxValue - 93) / 7) * 0.07;
  } else if (maxValue >= 85) {
    // Elite 2 (WR1s, RB1s, elite young QBs): 25-35%
    basePremiumRate = 0.25 + ((maxValue - 85) / 8) * 0.10;
  } else if (maxValue >= 78) {
    // Star tier: 15-25%
    basePremiumRate = 0.15 + ((maxValue - 78) / 7) * 0.10;
  } else if (maxValue >= 70) {
    // Borderline star: 8-15%
    basePremiumRate = 0.08 + ((maxValue - 70) / 8) * 0.07;
  }
  
  // Amplify based on piece differential (when trading fewer pieces)
  let pieceMultiplier = 1.0;
  if (hasFewerPieces) {
    const pieceDiff = opposingAssetCount - assetCount;
    pieceMultiplier = 1 + (Math.min(pieceDiff, 4) * 0.08); // +8% per extra piece, max +32%
  }
  
  // Amplify based on concentration (high concentration = star-heavy package)
  let concentrationMultiplier = 1.0;
  if (concentration > 0.75) {
    concentrationMultiplier = 1.15; // 15% boost for super concentrated (1 stud + nothing else)
  } else if (concentration > 0.60) {
    concentrationMultiplier = 1.08; // 8% boost for concentrated packages
  }
  
  // Calculate premium as ADDITIVE value based on the star player's value
  const premiumValue = maxValue * basePremiumRate * pieceMultiplier * concentrationMultiplier;
  
  // Cap at 50% of the star's value
  return Math.min(maxValue * 0.50, premiumValue);
}

/**
 * Calculate adjusted values for a trade.
 * Returns both raw totals and adjusted totals for each side,
 * plus the fairness metrics.
 */
export interface TradeAdjustmentResult {
  teamA: {
    rawTotal: number;
    adjustedTotal: number;
    assets: Array<{ id: string; name: string; rawValue: number; adjustedValue: number; multiplier: number }>;
  };
  teamB: {
    rawTotal: number;
    adjustedTotal: number;
    assets: Array<{ id: string; name: string; rawValue: number; adjustedValue: number; multiplier: number }>;
  };
  fairnessPercent: number; // -100 to +100, negative = Team A wins, positive = Team B wins
  isFair: boolean; // Within 5% tolerance
  adjustmentNeeded: number; // Value Team B needs to add to make it fair (negative = Team A needs to add)
  winner: "A" | "B" | "even";
}

export function calculateTradeAdjustment(
  teamAAssets: Array<{ id: string; name: string; value: number }>,
  teamBAssets: Array<{ id: string; name: string; value: number }>
): TradeAdjustmentResult {
  // Calculate adjusted values for each asset
  const teamAWithAdjustments = teamAAssets.map(asset => ({
    id: asset.id,
    name: asset.name,
    rawValue: asset.value,
    adjustedValue: getAdjustedValue(asset.value),
    multiplier: getAdjustmentMultiplier(asset.value),
  }));

  const teamBWithAdjustments = teamBAssets.map(asset => ({
    id: asset.id,
    name: asset.name,
    rawValue: asset.value,
    adjustedValue: getAdjustedValue(asset.value),
    multiplier: getAdjustmentMultiplier(asset.value),
  }));

  // Sum base adjusted totals (without consolidation premium)
  const teamARawTotal = teamAWithAdjustments.reduce((sum, a) => sum + a.rawValue, 0);
  const teamABaseAdjusted = teamAWithAdjustments.reduce((sum, a) => sum + a.adjustedValue, 0);
  const teamBRawTotal = teamBWithAdjustments.reduce((sum, a) => sum + a.rawValue, 0);
  const teamBBaseAdjusted = teamBWithAdjustments.reduce((sum, a) => sum + a.adjustedValue, 0);

  // Calculate consolidation premiums for each side (additive value, not percentage)
  // This rewards teams trading fewer, higher-value assets (star player premium)
  const teamAConsolidationPremium = calculateConsolidationPremium(teamAAssets, teamBAssets.length);
  const teamBConsolidationPremium = calculateConsolidationPremium(teamBAssets, teamAAssets.length);

  // Apply consolidation premium as ADDITIVE value to adjusted totals
  const teamAAdjustedTotal = teamABaseAdjusted + teamAConsolidationPremium;
  const teamBAdjustedTotal = teamBBaseAdjusted + teamBConsolidationPremium;

  // Calculate fairness based on adjusted values (with consolidation premium)
  const totalAdjusted = teamAAdjustedTotal + teamBAdjustedTotal;
  let fairnessPercent = 0;
  
  if (totalAdjusted > 0) {
    // Positive = Team B wins (receives more adjusted value)
    // Negative = Team A wins (receives more adjusted value)
    const diff = teamAAdjustedTotal - teamBAdjustedTotal;
    fairnessPercent = (diff / totalAdjusted) * 100;
  }

  // Within 5% tolerance is considered fair
  const isFair = Math.abs(fairnessPercent) <= 5;

  // Determine winner: Team receives what the other sends
  // Team A receives teamB's assets, Team B receives teamA's assets
  let winner: "A" | "B" | "even" = "even";
  if (!isFair) {
    // If teamA is sending more adjusted value, Team B wins
    winner = teamAAdjustedTotal > teamBAdjustedTotal ? "B" : "A";
  }

  // Calculate adjustment needed (in raw value terms)
  const adjustmentNeeded = teamAAdjustedTotal - teamBAdjustedTotal;

  return {
    teamA: {
      rawTotal: teamARawTotal,
      adjustedTotal: teamAAdjustedTotal,
      assets: teamAWithAdjustments,
    },
    teamB: {
      rawTotal: teamBRawTotal,
      adjustedTotal: teamBAdjustedTotal,
      assets: teamBWithAdjustments,
    },
    fairnessPercent,
    isFair,
    adjustmentNeeded,
    winner,
  };
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
    
    // Simplified production multiplier for quick value calculation
    // Elite producers (top tier PPG) get bonus, low producers get penalty
    const eliteThresholds: Record<string, number> = { QB: 20, RB: 15, WR: 14, TE: 12, DL: 10, LB: 12, DB: 10 };
    const elitePPG = eliteThresholds[groupPos] || 12;
    let productionMultiplier = 1.0;
    if (ppg >= elitePPG) {
      productionMultiplier = 1.25 + Math.min(0.25, (ppg - elitePPG) / elitePPG * 0.5);
    } else if (ppg >= elitePPG * 0.6) {
      productionMultiplier = 1.0 + ((ppg - elitePPG * 0.6) / (elitePPG * 0.4)) * 0.25;
    }
    value *= Math.min(1.50, productionMultiplier);
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
  
  // If no consensus value, player is NOT in DynastyProcess top ~500
  // Apply moderate penalty but consider actual production/age
  if (consensusValue === null || consensusValue === undefined) {
    // Players not in consensus get penalty, but not as severe
    // Young players with production should still have decent value
    const hasProduction = (actualStats.ppg || 0) > 5 || (actualStats.games || 0) > 10;
    const isYoung = (age || 30) < 27;
    
    // Base cap is 35, but young producers can reach 50
    let cappedValue: number;
    if (hasProduction && isYoung) {
      // Young player with production - moderate penalty (cap at 50)
      cappedValue = Math.min(50, leagueValue * 0.65);
    } else if (hasProduction || isYoung) {
      // Either producing or young - lighter penalty (cap at 40)
      cappedValue = Math.min(40, leagueValue * 0.55);
    } else {
      // Old non-producer - heavy penalty (cap at 25)
      cappedValue = Math.min(25, leagueValue * 0.4);
    }
    
    return {
      value: Math.round(cappedValue * 10) / 10,
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
