// Keep Trade Cut (KTC) Value Service
// This provides dynasty trade values for players and picks

interface PlayerValue {
  value: number;
  trend: number;
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
