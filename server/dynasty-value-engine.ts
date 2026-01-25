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
  RB: { peak: [22, 26], decay: 0.08 }, // Fast decay
  WR: { peak: [24, 28], decay: 0.05 }, // Moderate decay
  TE: { peak: [25, 29], decay: 0.04 }, // Moderate-slow decay
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
  }
  
  return 1.0;
}

// ============================================================================
// FANTASY POINTS CALCULATION
// ============================================================================

function calculateFantasyPoints(
  projection: PlayerProjection["projections"],
  scoring: LeagueScoringSettings,
  position?: string
): number {
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
  const { teamCount, qbSlots, rbSlots, wrSlots, teSlots, flexSlots, superflexSlots } = roster;
  
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
  
  // Calculate replacement level for each position
  const replacementLevels: Record<string, number> = {
    QB: calculateReplacementLevel(rosterSettings, "QB"),
    RB: calculateReplacementLevel(rosterSettings, "RB"),
    WR: calculateReplacementLevel(rosterSettings, "WR"),
    TE: calculateReplacementLevel(rosterSettings, "TE"),
  };
  
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
  
  for (const pp of playerPoints) {
    const pos = pp.player.position;
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
    const pos = player.position;
    
    // Get position rank
    const positionRank = positionGroups[pos]?.findIndex(p => p.player.playerId === player.playerId) + 1 || 999;
    
    // Calculate raw VOR
    const replPoints = replacementPoints[pos] || 0;
    const rawVOR = Math.max(0, points - replPoints);
    
    // Apply dynasty adjustments
    const ageMultiplier = calculateAgeMultiplier(pos, player.age);
    const injuryMultiplier = calculateInjuryMultiplier(player.injuryStatus);
    const scarcityBonus = calculateScarcityBonus(pos, positionRank);
    
    // Final adjusted VOR
    const adjustedVOR = rawVOR * ageMultiplier * injuryMultiplier * scarcityBonus;
    
    dynastyValues.push({
      playerId: player.playerId,
      name: player.name,
      position: pos,
      team: player.team,
      value: 0, // Will normalize later
      rawVOR: adjustedVOR,
      fantasyPoints: points,
      ageMultiplier,
      injuryMultiplier,
      scarcityBonus,
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
  };
}

export function parseLeagueRosterSettings(league: any): LeagueRosterSettings {
  const rosterPositions: string[] = league.roster_positions || [];
  const teamCount = league.total_rosters || 12;
  
  let qbSlots = 0, rbSlots = 0, wrSlots = 0, teSlots = 0;
  let flexSlots = 0, superflexSlots = 0, benchSlots = 0;
  
  for (const pos of rosterPositions) {
    switch (pos) {
      case "QB": qbSlots++; break;
      case "RB": rbSlots++; break;
      case "WR": wrSlots++; break;
      case "TE": teSlots++; break;
      case "FLEX": flexSlots++; break;
      case "SUPER_FLEX": superflexSlots++; break;
      case "BN": benchSlots++; break;
    }
  }
  
  return {
    teamCount,
    qbSlots,
    rbSlots,
    wrSlots,
    teSlots,
    flexSlots,
    superflexSlots,
    benchSlots,
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

export function getQuickPlayerValue(
  playerId: string,
  position: string,
  age: number | null,
  yearsExp: number,
  injuryStatus: string | null = null
): number {
  // Base values by position
  const positionBaseValues: Record<string, number> = {
    QB: 65,
    RB: 55,
    WR: 60,
    TE: 45,
    K: 5,
    DEF: 5,
  };
  
  let value = positionBaseValues[position] || 30;
  
  // Apply age curve
  value *= calculateAgeMultiplier(position, age);
  
  // Apply injury adjustment
  value *= calculateInjuryMultiplier(injuryStatus);
  
  // Experience adjustment
  if (yearsExp === 0) value *= 1.1;
  else if (yearsExp === 1) value *= 1.05;
  else if (yearsExp > 10) value *= 0.7;
  
  // Add variance based on player ID (simulates different player values)
  const hash = playerId.split("").reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const variance = 0.75 + (Math.abs(hash) % 50) / 100;
  value *= variance;
  
  // Cap and round
  value = Math.min(100, Math.max(0, value));
  value = Math.round(value * 100) / 100;
  
  return value;
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
