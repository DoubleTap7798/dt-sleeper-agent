// Keep Trade Cut (KTC) Value Service
// This provides dynasty trade values for players and picks

interface PlayerValue {
  value: number;
  trend: number;
}

// KTC Devy Player Data
// Updated from https://keeptradecut.com/devy-rankings
export interface KTCDevyPlayer {
  id: string;
  name: string;
  position: string;
  positionRank: number;
  college: string;
  tier: number;
  trend30Day: number;
  value: number;
  draftEligibleYear: number;
}

// KTC Devy Rankings - Updated January 2026
// Data source: https://keeptradecut.com/devy-rankings
export const KTC_DEVY_PLAYERS: KTCDevyPlayer[] = [
  { id: "16015", name: "Jeremiah Smith", position: "WR", positionRank: 1, college: "Ohio State", tier: 1, trend30Day: 0, value: 9999, draftEligibleYear: 2026 },
  { id: "12520", name: "Jeremiyah Love", position: "RB", positionRank: 1, college: "Notre Dame", tier: 1, trend30Day: 0, value: 9849, draftEligibleYear: 2026 },
  { id: "7227", name: "Fernando Mendoza", position: "QB", positionRank: 1, college: "Indiana", tier: 2, trend30Day: 2, value: 7385, draftEligibleYear: 2026 },
  { id: "11097", name: "Jordyn Tyson", position: "WR", positionRank: 2, college: "Arizona State", tier: 2, trend30Day: 1, value: 6943, draftEligibleYear: 2026 },
  { id: "13346", name: "Arch Manning", position: "QB", positionRank: 2, college: "Texas", tier: 2, trend30Day: 4, value: 6899, draftEligibleYear: 2027 },
  { id: "12723", name: "Makai Lemon", position: "WR", positionRank: 3, college: "USC", tier: 2, trend30Day: 0, value: 6861, draftEligibleYear: 2026 },
  { id: "13276", name: "Carnell Tate", position: "WR", positionRank: 4, college: "Ohio State", tier: 2, trend30Day: 3, value: 6649, draftEligibleYear: 2026 },
  { id: "13285", name: "Dante Moore", position: "QB", positionRank: 3, college: "Oregon", tier: 3, trend30Day: 1, value: 6043, draftEligibleYear: 2026 },
  { id: "15996", name: "Julian Sayin", position: "QB", positionRank: 4, college: "Ohio State", tier: 4, trend30Day: 1, value: 5373, draftEligibleYear: 2027 },
  { id: "15994", name: "Ryan Williams", position: "WR", positionRank: 5, college: "Alabama", tier: 4, trend30Day: 2, value: 5293, draftEligibleYear: 2027 },
  { id: "16010", name: "Cam Coleman", position: "WR", positionRank: 6, college: "Texas", tier: 5, trend30Day: 4, value: 4783, draftEligibleYear: 2027 },
  { id: "13238", name: "KC Concepcion", position: "WR", positionRank: 7, college: "Texas A&M", tier: 5, trend30Day: 0, value: 4639, draftEligibleYear: 2026 },
  { id: "11985", name: "Denzel Boston", position: "WR", positionRank: 8, college: "Washington", tier: 5, trend30Day: 0, value: 4502, draftEligibleYear: 2026 },
  { id: "19871", name: "Malachi Toney", position: "WR", positionRank: 9, college: "Miami", tier: 5, trend30Day: 6, value: 4485, draftEligibleYear: 2027 },
  { id: "12676", name: "Justice Haynes", position: "RB", positionRank: 2, college: "Georgia Tech", tier: 6, trend30Day: 4, value: 4213, draftEligibleYear: 2026 },
  { id: "13329", name: "Kenyon Sadiq", position: "TE", positionRank: 1, college: "Oregon", tier: 6, trend30Day: 2, value: 4043, draftEligibleYear: 2026 },
  { id: "19469", name: "Bryce Underwood", position: "QB", positionRank: 5, college: "Michigan", tier: 6, trend30Day: 8, value: 4013, draftEligibleYear: 2028 },
  { id: "12827", name: "LaNorris Sellers", position: "QB", positionRank: 6, college: "South Carolina", tier: 6, trend30Day: 0, value: 3976, draftEligibleYear: 2026 },
  { id: "10584", name: "Jonah Coleman", position: "RB", positionRank: 3, college: "Washington", tier: 6, trend30Day: 2, value: 3806, draftEligibleYear: 2026 },
  { id: "19480", name: "Dakorien Moore", position: "WR", positionRank: 10, college: "Oregon", tier: 7, trend30Day: 1, value: 3540, draftEligibleYear: 2028 },
  { id: "11803", name: "Ty Simpson", position: "QB", positionRank: 7, college: "Alabama", tier: 7, trend30Day: 5, value: 3452, draftEligibleYear: 2026 },
  { id: "11961", name: "Jadarian Price", position: "RB", positionRank: 4, college: "Notre Dame", tier: 7, trend30Day: 10, value: 3353, draftEligibleYear: 2026 },
  { id: "11912", name: "Antonio Williams", position: "WR", positionRank: 11, college: "Clemson", tier: 7, trend30Day: 0, value: 3303, draftEligibleYear: 2026 },
  { id: "11847", name: "Chris Bell", position: "WR", positionRank: 12, college: "Louisville", tier: 7, trend30Day: 5, value: 3292, draftEligibleYear: 2026 },
  { id: "11973", name: "Kaytron Allen", position: "RB", positionRank: 5, college: "Penn State", tier: 7, trend30Day: 3, value: 3207, draftEligibleYear: 2026 },
  { id: "16682", name: "Ryan Wingo", position: "WR", positionRank: 13, college: "Texas", tier: 8, trend30Day: 2, value: 3092, draftEligibleYear: 2027 },
  { id: "11998", name: "Nicholas Singleton", position: "RB", positionRank: 6, college: "Penn State", tier: 8, trend30Day: 1, value: 3091, draftEligibleYear: 2026 },
  { id: "16246", name: "DJ Lagway", position: "QB", positionRank: 8, college: "Baylor", tier: 9, trend30Day: 3, value: 2957, draftEligibleYear: 2027 },
  { id: "17630", name: "Ahmad Hardy", position: "RB", positionRank: 7, college: "Missouri", tier: 9, trend30Day: 5, value: 2881, draftEligibleYear: 2027 },
  { id: "14345", name: "Zachariah Branch", position: "WR", positionRank: 14, college: "Georgia", tier: 9, trend30Day: 3, value: 2840, draftEligibleYear: 2027 },
  { id: "16659", name: "Bryant Wesco Jr.", position: "WR", positionRank: 15, college: "Clemson", tier: 9, trend30Day: 10, value: 2778, draftEligibleYear: 2028 },
  { id: "12885", name: "Sam Leavitt", position: "QB", positionRank: 9, college: "LSU", tier: 9, trend30Day: 8, value: 2777, draftEligibleYear: 2026 },
  { id: "7023", name: "Chris Brazzell II", position: "WR", positionRank: 16, college: "Tennessee", tier: 9, trend30Day: 7, value: 2714, draftEligibleYear: 2026 },
  { id: "13696", name: "Nyck Harbor", position: "WR", positionRank: 17, college: "South Carolina", tier: 9, trend30Day: 5, value: 2692, draftEligibleYear: 2027 },
  { id: "7240", name: "John Mateer", position: "QB", positionRank: 10, college: "Oklahoma", tier: 9, trend30Day: 2, value: 2659, draftEligibleYear: 2026 },
  { id: "16193", name: "Isaac Brown", position: "RB", positionRank: 8, college: "Louisville", tier: 9, trend30Day: 9, value: 2646, draftEligibleYear: 2027 },
  { id: "16791", name: "Nick Marsh", position: "WR", positionRank: 18, college: "Michigan State", tier: 10, trend30Day: 5, value: 2320, draftEligibleYear: 2027 },
  { id: "16704", name: "Dylan Raiola", position: "QB", positionRank: 11, college: "Oregon", tier: 11, trend30Day: 3, value: 2131, draftEligibleYear: 2027 },
  { id: "6182", name: "Garrett Nussmeier", position: "QB", positionRank: 12, college: "LSU", tier: 11, trend30Day: 1, value: 2040, draftEligibleYear: 2026 },
  { id: "13242", name: "Eric Singleton Jr.", position: "WR", positionRank: 19, college: "Florida", tier: 11, trend30Day: 10, value: 2019, draftEligibleYear: 2027 },
  { id: "16674", name: "T.J. Moore", position: "WR", positionRank: 20, college: "Clemson", tier: 11, trend30Day: 5, value: 2001, draftEligibleYear: 2028 },
  { id: "19751", name: "Keelon Russell", position: "QB", positionRank: 13, college: "Alabama", tier: 11, trend30Day: 15, value: 1999, draftEligibleYear: 2028 },
  { id: "6756", name: "Evan Stewart", position: "WR", positionRank: 21, college: "Oregon", tier: 11, trend30Day: 4, value: 1995, draftEligibleYear: 2026 },
  { id: "13348", name: "CJ Baxter Jr.", position: "RB", positionRank: 9, college: "Kentucky", tier: 11, trend30Day: 0, value: 1954, draftEligibleYear: 2027 },
  { id: "14527", name: "Duce Robinson", position: "WR", positionRank: 22, college: "Florida State", tier: 11, trend30Day: 0, value: 1938, draftEligibleYear: 2027 },
  { id: "12778", name: "Rueben Owens II", position: "RB", positionRank: 10, college: "Texas A&M", tier: 11, trend30Day: 5, value: 1914, draftEligibleYear: 2026 },
  { id: "12910", name: "Eugene Wilson III", position: "WR", positionRank: 23, college: "LSU", tier: 11, trend30Day: 6, value: 1907, draftEligibleYear: 2027 },
  { id: "11972", name: "Drew Allar", position: "QB", positionRank: 14, college: "Penn State", tier: 11, trend30Day: 2, value: 1834, draftEligibleYear: 2026 },
  { id: "11095", name: "Barion Brown", position: "WR", positionRank: 24, college: "LSU", tier: 11, trend30Day: 3, value: 1789, draftEligibleYear: 2026 },
  { id: "12070", name: "Emmett Johnson", position: "RB", positionRank: 11, college: "Nebraska", tier: 11, trend30Day: 12, value: 1781, draftEligibleYear: 2026 },
];

export function getDevyPlayers(): KTCDevyPlayer[] {
  return KTC_DEVY_PLAYERS.map((player, index) => ({
    ...player,
    rank: index + 1,
  }));
}

export function getDevyPlayerById(playerId: string): (KTCDevyPlayer & { rank: number }) | null {
  const index = KTC_DEVY_PLAYERS.findIndex(p => p.id === playerId);
  if (index === -1) return null;
  return {
    ...KTC_DEVY_PLAYERS[index],
    rank: index + 1,
  };
}

// KTC values cache (in production, you'd fetch from KTC API or scrape)
// These are sample values - in production, integrate with KTC's actual API
const POSITION_BASE_VALUES: Record<string, number> = {
  QB: 7000,
  RB: 6000,
  WR: 6500,
  TE: 5000,
  K: 500,
  DEF: 500,
};

const PICK_VALUES: Record<string, Record<number, number>> = {
  "2025": {
    1: 7500,
    2: 4500,
    3: 2500,
    4: 1000,
    5: 500,
  },
  "2026": {
    1: 6500,
    2: 4000,
    3: 2000,
    4: 800,
    5: 400,
  },
  "2027": {
    1: 5500,
    2: 3500,
    3: 1500,
    4: 600,
    5: 300,
  },
};

// Sample player values - in production this would come from KTC API
// Format: playerId -> { value, trend }
const PLAYER_VALUES_OVERRIDE: Record<string, PlayerValue> = {};

export function getPlayerValue(
  playerId: string,
  position: string,
  age: number | null,
  yearsExp: number
): number {
  // Check for override value first
  if (PLAYER_VALUES_OVERRIDE[playerId]) {
    return PLAYER_VALUES_OVERRIDE[playerId].value;
  }

  // Calculate base value from position
  let baseValue = POSITION_BASE_VALUES[position] || 3000;

  // Age adjustment
  if (age) {
    if (position === "QB") {
      // QBs have longer careers
      if (age < 27) baseValue *= 1.1;
      else if (age > 32) baseValue *= 0.6;
      else if (age > 35) baseValue *= 0.3;
    } else if (position === "RB") {
      // RBs decline faster
      if (age < 24) baseValue *= 1.2;
      else if (age > 27) baseValue *= 0.7;
      else if (age > 29) baseValue *= 0.4;
    } else if (position === "WR" || position === "TE") {
      if (age < 25) baseValue *= 1.1;
      else if (age > 29) baseValue *= 0.7;
      else if (age > 32) baseValue *= 0.4;
    }
  }

  // Experience adjustment (rookies have more potential value in dynasty)
  if (yearsExp === 0) baseValue *= 1.15;
  else if (yearsExp === 1) baseValue *= 1.05;
  else if (yearsExp > 8) baseValue *= 0.7;

  // Add some variance based on player ID hash (simulates different player values)
  const hash = playerId.split("").reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const variance = 0.7 + (Math.abs(hash) % 60) / 100; // 0.7 to 1.3 multiplier
  baseValue *= variance;

  return Math.round(baseValue);
}

export function getPickValue(season: string, round: number): number {
  const seasonPicks = PICK_VALUES[season];
  if (!seasonPicks) {
    // Future picks decrease in value
    const yearDiff = parseInt(season) - 2025;
    const discount = Math.max(0.5, 1 - yearDiff * 0.15);
    return Math.round((PICK_VALUES["2025"][round] || 500) * discount);
  }
  return seasonPicks[round] || 500;
}

export function getPickName(season: string, round: number, originalOwner?: string): string {
  const ordinal = round === 1 ? "1st" : round === 2 ? "2nd" : round === 3 ? "3rd" : `${round}th`;
  if (originalOwner) {
    return `${season} ${ordinal} (${originalOwner})`;
  }
  return `${season} ${ordinal}`;
}

export function calculateTradeGrade(
  teamAValue: number,
  teamBValue: number
): { grade: string; winner: "A" | "B" | "even"; difference: number; percentageDiff: number } {
  // teamAValue = what Team A gives away
  // teamBValue = what Team B gives away
  // Team A RECEIVES teamBValue, Team B RECEIVES teamAValue
  // Team A wins if they receive more than they give (teamBValue > teamAValue)
  
  const difference = Math.abs(teamAValue - teamBValue);
  const maxValue = Math.max(teamAValue, teamBValue);
  const percentageDiff = maxValue > 0 ? (difference / maxValue) * 100 : 0;

  let grade: string;
  let winner: "A" | "B" | "even";

  // Determine winner: Team wins if they RECEIVE more than they GIVE
  // Team A receives teamBValue, so A wins if teamBValue > teamAValue
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
  } else if (percentageDiff < 35) {
    grade = "C+";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 40) {
    grade = "C";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 45) {
    grade = "C-";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 50) {
    grade = "D+";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 55) {
    grade = "D";
    winner = teamAWins ? "A" : "B";
  } else if (percentageDiff < 60) {
    grade = "D-";
    winner = teamAWins ? "A" : "B";
  } else {
    grade = "F";
    winner = teamAWins ? "A" : "B";
  }

  // Difference: positive = Team A receives more, negative = Team B receives more
  return {
    grade,
    winner,
    difference: teamBValue - teamAValue,
    percentageDiff,
  };
}
