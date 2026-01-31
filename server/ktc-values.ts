// Keep Trade Cut (KTC) Value Service
// This provides dynasty trade values for players and picks

interface PlayerValue {
  value: number;
  trend: number;
}

// Historical comp player for devy comparisons
export interface DevyComp {
  name: string;
  matchPct: number;
  wasSuccess: boolean;
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
  trend7Day: number;
  trend30Day: number;
  seasonChange: number;
  value: number;
  draftEligibleYear: number;
  // Breakout/Bust probability
  starterPct: number;
  elitePct: number;
  bustPct: number;
  // Draft capital confidence
  top10Pct: number;
  round1Pct: number;
  round2PlusPct: number;
  // Trade value equivalent
  pickEquivalent: string;
  pickMultiplier: number;
  // Market share metrics
  dominatorRating: number;
  yardShare: number;
  tdShare: number;
  breakoutAge: number | null;
  // Historical comps
  comps: DevyComp[];
  // Path to production
  depthRole: "Starter" | "WR1" | "WR2" | "RB1" | "RB2" | "TE1" | "Backup" | "Buried";
  pathContext: string;
  // Age vs Class indicator
  ageClass: "young-breakout" | "normal" | "old-producer";
}

// KTC Devy Rankings - Updated January 2026
// Data source: https://keeptradecut.com/devy-rankings
// Enhanced with probability scores, market share metrics, and historical comps
export const KTC_DEVY_PLAYERS: KTCDevyPlayer[] = [
  { id: "16015", name: "Jeremiah Smith", position: "WR", positionRank: 1, college: "Ohio State", tier: 1, trend7Day: 0, trend30Day: 0, seasonChange: 5, value: 9999, draftEligibleYear: 2026, starterPct: 92, elitePct: 68, bustPct: 3, top10Pct: 85, round1Pct: 99, round2PlusPct: 1, pickEquivalent: "2026 Early 1st + Mid 2nd", pickMultiplier: 1.8, dominatorRating: 42.5, yardShare: 38.2, tdShare: 45.0, breakoutAge: 18.5, comps: [{ name: "Justin Jefferson", matchPct: 88, wasSuccess: true }, { name: "Ja'Marr Chase", matchPct: 82, wasSuccess: true }], depthRole: "WR1", pathContext: "Clear path to WR1 reps immediately in NFL", ageClass: "young-breakout" },
  { id: "12520", name: "Jeremiyah Love", position: "RB", positionRank: 1, college: "Notre Dame", tier: 1, trend7Day: 2, trend30Day: 0, seasonChange: 8, value: 9849, draftEligibleYear: 2026, starterPct: 85, elitePct: 52, bustPct: 8, top10Pct: 55, round1Pct: 88, round2PlusPct: 12, pickEquivalent: "2026 Early 1st + Late 2nd", pickMultiplier: 1.6, dominatorRating: 35.8, yardShare: 32.1, tdShare: 40.5, breakoutAge: 19.2, comps: [{ name: "Saquon Barkley", matchPct: 75, wasSuccess: true }, { name: "Jonathan Taylor", matchPct: 72, wasSuccess: true }], depthRole: "RB1", pathContext: "Workhorse profile, likely Day 1 starter", ageClass: "young-breakout" },
  { id: "7227", name: "Fernando Mendoza", position: "QB", positionRank: 1, college: "Indiana", tier: 2, trend7Day: 1, trend30Day: 2, seasonChange: 15, value: 7385, draftEligibleYear: 2026, starterPct: 72, elitePct: 35, bustPct: 15, top10Pct: 28, round1Pct: 65, round2PlusPct: 35, pickEquivalent: "2026 Mid 1st", pickMultiplier: 1.2, dominatorRating: 28.5, yardShare: 0, tdShare: 0, breakoutAge: 21.8, comps: [{ name: "Baker Mayfield", matchPct: 70, wasSuccess: true }, { name: "Kirk Cousins", matchPct: 65, wasSuccess: true }], depthRole: "Starter", pathContext: "Could compete for starting job Year 1-2", ageClass: "normal" },
  { id: "11097", name: "Jordyn Tyson", position: "WR", positionRank: 2, college: "Arizona State", tier: 2, trend7Day: 0, trend30Day: 1, seasonChange: 12, value: 6943, draftEligibleYear: 2026, starterPct: 78, elitePct: 42, bustPct: 12, top10Pct: 35, round1Pct: 72, round2PlusPct: 28, pickEquivalent: "2026 Mid 1st", pickMultiplier: 1.15, dominatorRating: 38.2, yardShare: 35.5, tdShare: 38.0, breakoutAge: 19.8, comps: [{ name: "Terry McLaurin", matchPct: 78, wasSuccess: true }, { name: "Stefon Diggs", matchPct: 72, wasSuccess: true }], depthRole: "WR1", pathContext: "Alpha profile, WR1 in 2-3 years", ageClass: "young-breakout" },
  { id: "13346", name: "Arch Manning", position: "QB", positionRank: 2, college: "Texas", tier: 2, trend7Day: 2, trend30Day: 4, seasonChange: 18, value: 6899, draftEligibleYear: 2027, starterPct: 80, elitePct: 55, bustPct: 10, top10Pct: 60, round1Pct: 85, round2PlusPct: 15, pickEquivalent: "2027 Early 1st + 3rd", pickMultiplier: 1.35, dominatorRating: 25.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Peyton Manning", matchPct: 68, wasSuccess: true }, { name: "Matt Ryan", matchPct: 65, wasSuccess: true }], depthRole: "Starter", pathContext: "Franchise QB upside, waiting behind Quinn Ewers", ageClass: "young-breakout" },
  { id: "12723", name: "Makai Lemon", position: "WR", positionRank: 3, college: "USC", tier: 2, trend7Day: -1, trend30Day: 0, seasonChange: 5, value: 6861, draftEligibleYear: 2026, starterPct: 75, elitePct: 38, bustPct: 14, top10Pct: 30, round1Pct: 68, round2PlusPct: 32, pickEquivalent: "2026 Mid 1st", pickMultiplier: 1.1, dominatorRating: 32.5, yardShare: 28.8, tdShare: 32.0, breakoutAge: 19.5, comps: [{ name: "Chris Olave", matchPct: 75, wasSuccess: true }, { name: "Garrett Wilson", matchPct: 70, wasSuccess: true }], depthRole: "WR1", pathContext: "Clear WR1 path with Zachariah Branch", ageClass: "young-breakout" },
  { id: "13276", name: "Carnell Tate", position: "WR", positionRank: 4, college: "Ohio State", tier: 2, trend7Day: 1, trend30Day: 3, seasonChange: 10, value: 6649, draftEligibleYear: 2026, starterPct: 72, elitePct: 35, bustPct: 16, top10Pct: 25, round1Pct: 62, round2PlusPct: 38, pickEquivalent: "2026 Late 1st", pickMultiplier: 1.0, dominatorRating: 28.0, yardShare: 22.5, tdShare: 28.0, breakoutAge: 20.1, comps: [{ name: "DeVonta Smith", matchPct: 72, wasSuccess: true }, { name: "Jaylen Waddle", matchPct: 68, wasSuccess: true }], depthRole: "WR2", pathContext: "Behind Jeremiah Smith, needs to carve role", ageClass: "normal" },
  { id: "13285", name: "Dante Moore", position: "QB", positionRank: 3, college: "Oregon", tier: 3, trend7Day: 0, trend30Day: 1, seasonChange: -5, value: 6043, draftEligibleYear: 2026, starterPct: 65, elitePct: 28, bustPct: 22, top10Pct: 18, round1Pct: 52, round2PlusPct: 48, pickEquivalent: "2026 Late 1st", pickMultiplier: 0.95, dominatorRating: 22.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Deshaun Watson", matchPct: 62, wasSuccess: true }, { name: "Teddy Bridgewater", matchPct: 58, wasSuccess: false }], depthRole: "Backup", pathContext: "Development needed, backup Year 1", ageClass: "normal" },
  { id: "15996", name: "Julian Sayin", position: "QB", positionRank: 4, college: "Ohio State", tier: 4, trend7Day: 0, trend30Day: 1, seasonChange: 8, value: 5373, draftEligibleYear: 2027, starterPct: 70, elitePct: 32, bustPct: 18, top10Pct: 22, round1Pct: 58, round2PlusPct: 42, pickEquivalent: "2027 Mid 1st", pickMultiplier: 1.0, dominatorRating: 20.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Tua Tagovailoa", matchPct: 72, wasSuccess: true }, { name: "Drew Lock", matchPct: 55, wasSuccess: false }], depthRole: "Starter", pathContext: "OSU starter after 2025, high upside", ageClass: "young-breakout" },
  { id: "15994", name: "Ryan Williams", position: "WR", positionRank: 5, college: "Alabama", tier: 4, trend7Day: 1, trend30Day: 2, seasonChange: 20, value: 5293, draftEligibleYear: 2027, starterPct: 82, elitePct: 48, bustPct: 8, top10Pct: 42, round1Pct: 78, round2PlusPct: 22, pickEquivalent: "2027 Early-Mid 1st", pickMultiplier: 1.25, dominatorRating: 35.0, yardShare: 30.5, tdShare: 35.0, breakoutAge: 17.8, comps: [{ name: "Tyreek Hill", matchPct: 70, wasSuccess: true }, { name: "Jameson Williams", matchPct: 75, wasSuccess: true }], depthRole: "WR1", pathContext: "Alpha WR1, youngest breakout in class", ageClass: "young-breakout" },
  { id: "16010", name: "Cam Coleman", position: "WR", positionRank: 6, college: "Texas", tier: 5, trend7Day: 2, trend30Day: 4, seasonChange: 25, value: 4783, draftEligibleYear: 2027, starterPct: 75, elitePct: 38, bustPct: 12, top10Pct: 28, round1Pct: 65, round2PlusPct: 35, pickEquivalent: "2027 Mid 1st", pickMultiplier: 1.1, dominatorRating: 30.0, yardShare: 26.5, tdShare: 30.0, breakoutAge: 18.5, comps: [{ name: "Jaxon Smith-Njigba", matchPct: 72, wasSuccess: true }, { name: "Chris Godwin", matchPct: 68, wasSuccess: true }], depthRole: "WR1", pathContext: "Texas WR1 after Manning leaves", ageClass: "young-breakout" },
  { id: "13238", name: "KC Concepcion", position: "WR", positionRank: 7, college: "Texas A&M", tier: 5, trend7Day: 0, trend30Day: 0, seasonChange: 3, value: 4639, draftEligibleYear: 2026, starterPct: 68, elitePct: 28, bustPct: 18, top10Pct: 15, round1Pct: 48, round2PlusPct: 52, pickEquivalent: "2026 Early 2nd", pickMultiplier: 0.85, dominatorRating: 25.5, yardShare: 22.0, tdShare: 25.0, breakoutAge: 20.2, comps: [{ name: "Michael Pittman Jr.", matchPct: 70, wasSuccess: true }, { name: "Brandin Cooks", matchPct: 65, wasSuccess: true }], depthRole: "WR2", pathContext: "Solid WR2, needs NFL alpha role", ageClass: "normal" },
  { id: "11985", name: "Denzel Boston", position: "WR", positionRank: 8, college: "Washington", tier: 5, trend7Day: -1, trend30Day: 0, seasonChange: -2, value: 4502, draftEligibleYear: 2026, starterPct: 65, elitePct: 25, bustPct: 20, top10Pct: 12, round1Pct: 42, round2PlusPct: 58, pickEquivalent: "2026 Early 2nd", pickMultiplier: 0.8, dominatorRating: 28.0, yardShare: 25.0, tdShare: 28.0, breakoutAge: 20.5, comps: [{ name: "Allen Robinson", matchPct: 68, wasSuccess: true }, { name: "Corey Davis", matchPct: 60, wasSuccess: false }], depthRole: "WR1", pathContext: "UW alpha but NFL role TBD", ageClass: "normal" },
  { id: "19871", name: "Malachi Toney", position: "WR", positionRank: 9, college: "Miami", tier: 5, trend7Day: 3, trend30Day: 6, seasonChange: 30, value: 4485, draftEligibleYear: 2027, starterPct: 70, elitePct: 32, bustPct: 15, top10Pct: 20, round1Pct: 55, round2PlusPct: 45, pickEquivalent: "2027 Late 1st", pickMultiplier: 0.95, dominatorRating: 30.0, yardShare: 28.0, tdShare: 32.0, breakoutAge: 18.8, comps: [{ name: "Tyreek Hill", matchPct: 65, wasSuccess: true }, { name: "Mecole Hardman", matchPct: 55, wasSuccess: false }], depthRole: "WR1", pathContext: "Electric speed, Miami feature WR", ageClass: "young-breakout" },
  { id: "12676", name: "Justice Haynes", position: "RB", positionRank: 2, college: "Georgia Tech", tier: 6, trend7Day: 2, trend30Day: 4, seasonChange: 12, value: 4213, draftEligibleYear: 2026, starterPct: 72, elitePct: 30, bustPct: 15, top10Pct: 18, round1Pct: 45, round2PlusPct: 55, pickEquivalent: "2026 Early 2nd", pickMultiplier: 0.75, dominatorRating: 32.0, yardShare: 28.5, tdShare: 35.0, breakoutAge: 19.5, comps: [{ name: "Nick Chubb", matchPct: 68, wasSuccess: true }, { name: "Damien Harris", matchPct: 62, wasSuccess: true }], depthRole: "RB1", pathContext: "Workhorse back, solid floor", ageClass: "young-breakout" },
  { id: "13329", name: "Kenyon Sadiq", position: "TE", positionRank: 1, college: "Oregon", tier: 6, trend7Day: 1, trend30Day: 2, seasonChange: 10, value: 4043, draftEligibleYear: 2026, starterPct: 75, elitePct: 35, bustPct: 12, top10Pct: 25, round1Pct: 55, round2PlusPct: 45, pickEquivalent: "2026 Late 1st", pickMultiplier: 0.9, dominatorRating: 22.0, yardShare: 18.0, tdShare: 25.0, breakoutAge: 20.0, comps: [{ name: "Kyle Pitts", matchPct: 65, wasSuccess: true }, { name: "Dalton Kincaid", matchPct: 70, wasSuccess: true }], depthRole: "TE1", pathContext: "Elite TE prospect, Day 1 starter potential", ageClass: "normal" },
  { id: "19469", name: "Bryce Underwood", position: "QB", positionRank: 5, college: "Michigan", tier: 6, trend7Day: 4, trend30Day: 8, seasonChange: 35, value: 4013, draftEligibleYear: 2028, starterPct: 75, elitePct: 45, bustPct: 12, top10Pct: 40, round1Pct: 72, round2PlusPct: 28, pickEquivalent: "2028 Early-Mid 1st", pickMultiplier: 1.2, dominatorRating: 28.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Trevor Lawrence", matchPct: 62, wasSuccess: true }, { name: "Jalen Hurts", matchPct: 70, wasSuccess: true }], depthRole: "Starter", pathContext: "Future Michigan starter, elite tools", ageClass: "young-breakout" },
  { id: "12827", name: "LaNorris Sellers", position: "QB", positionRank: 6, college: "South Carolina", tier: 6, trend7Day: 0, trend30Day: 0, seasonChange: 5, value: 3976, draftEligibleYear: 2026, starterPct: 62, elitePct: 25, bustPct: 22, top10Pct: 12, round1Pct: 38, round2PlusPct: 62, pickEquivalent: "2026 Mid 2nd", pickMultiplier: 0.7, dominatorRating: 20.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Jalen Hurts", matchPct: 65, wasSuccess: true }, { name: "Tyrod Taylor", matchPct: 58, wasSuccess: false }], depthRole: "Starter", pathContext: "Dual-threat, needs development", ageClass: "normal" },
  { id: "10584", name: "Jonah Coleman", position: "RB", positionRank: 3, college: "Washington", tier: 6, trend7Day: 1, trend30Day: 2, seasonChange: 8, value: 3806, draftEligibleYear: 2026, starterPct: 68, elitePct: 25, bustPct: 18, top10Pct: 10, round1Pct: 35, round2PlusPct: 65, pickEquivalent: "2026 Mid 2nd", pickMultiplier: 0.65, dominatorRating: 28.0, yardShare: 25.0, tdShare: 30.0, breakoutAge: 20.2, comps: [{ name: "Derrick Henry", matchPct: 58, wasSuccess: true }, { name: "Kareem Hunt", matchPct: 65, wasSuccess: true }], depthRole: "RB1", pathContext: "Workhorse profile, committee risk", ageClass: "normal" },
  { id: "19480", name: "Dakorien Moore", position: "WR", positionRank: 10, college: "Oregon", tier: 7, trend7Day: 0, trend30Day: 1, seasonChange: 15, value: 3540, draftEligibleYear: 2028, starterPct: 72, elitePct: 38, bustPct: 14, top10Pct: 25, round1Pct: 60, round2PlusPct: 40, pickEquivalent: "2028 Mid 1st", pickMultiplier: 1.0, dominatorRating: 32.0, yardShare: 28.0, tdShare: 32.0, breakoutAge: 18.0, comps: [{ name: "Marvin Harrison Jr.", matchPct: 60, wasSuccess: true }, { name: "Rome Odunze", matchPct: 68, wasSuccess: true }], depthRole: "WR1", pathContext: "Future Oregon alpha WR", ageClass: "young-breakout" },
  { id: "11803", name: "Ty Simpson", position: "QB", positionRank: 7, college: "Alabama", tier: 7, trend7Day: 2, trend30Day: 5, seasonChange: 20, value: 3452, draftEligibleYear: 2026, starterPct: 60, elitePct: 22, bustPct: 25, top10Pct: 8, round1Pct: 32, round2PlusPct: 68, pickEquivalent: "2026 Mid 2nd", pickMultiplier: 0.6, dominatorRating: 18.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Mac Jones", matchPct: 62, wasSuccess: true }, { name: "AJ McCarron", matchPct: 55, wasSuccess: false }], depthRole: "Starter", pathContext: "Alabama starter, pro-style system", ageClass: "normal" },
  { id: "11961", name: "Jadarian Price", position: "RB", positionRank: 4, college: "Notre Dame", tier: 7, trend7Day: 5, trend30Day: 10, seasonChange: 28, value: 3353, draftEligibleYear: 2026, starterPct: 65, elitePct: 22, bustPct: 20, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2026 Mid-Late 2nd", pickMultiplier: 0.55, dominatorRating: 25.0, yardShare: 22.0, tdShare: 28.0, breakoutAge: 20.5, comps: [{ name: "Aaron Jones", matchPct: 65, wasSuccess: true }, { name: "Damien Williams", matchPct: 58, wasSuccess: false }], depthRole: "RB2", pathContext: "Behind Jeremiyah Love, change of pace", ageClass: "normal" },
  { id: "11912", name: "Antonio Williams", position: "WR", positionRank: 11, college: "Clemson", tier: 7, trend7Day: 0, trend30Day: 0, seasonChange: 0, value: 3303, draftEligibleYear: 2026, starterPct: 62, elitePct: 22, bustPct: 22, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2026 Late 2nd", pickMultiplier: 0.5, dominatorRating: 25.0, yardShare: 22.0, tdShare: 25.0, breakoutAge: 20.8, comps: [{ name: "Diontae Johnson", matchPct: 65, wasSuccess: true }, { name: "Laviska Shenault", matchPct: 55, wasSuccess: false }], depthRole: "WR1", pathContext: "Clemson alpha, needs separation improvement", ageClass: "normal" },
  { id: "11847", name: "Chris Bell", position: "WR", positionRank: 12, college: "Louisville", tier: 7, trend7Day: 2, trend30Day: 5, seasonChange: 15, value: 3292, draftEligibleYear: 2026, starterPct: 64, elitePct: 24, bustPct: 20, top10Pct: 10, round1Pct: 32, round2PlusPct: 68, pickEquivalent: "2026 Mid-Late 2nd", pickMultiplier: 0.55, dominatorRating: 30.0, yardShare: 28.0, tdShare: 32.0, breakoutAge: 20.0, comps: [{ name: "Tyler Boyd", matchPct: 68, wasSuccess: true }, { name: "Robbie Anderson", matchPct: 55, wasSuccess: false }], depthRole: "WR1", pathContext: "Louisville feature, reliable producer", ageClass: "normal" },
  { id: "11973", name: "Kaytron Allen", position: "RB", positionRank: 5, college: "Penn State", tier: 7, trend7Day: 1, trend30Day: 3, seasonChange: 5, value: 3207, draftEligibleYear: 2026, starterPct: 65, elitePct: 22, bustPct: 20, top10Pct: 8, round1Pct: 25, round2PlusPct: 75, pickEquivalent: "2026 Late 2nd", pickMultiplier: 0.5, dominatorRating: 22.0, yardShare: 18.0, tdShare: 25.0, breakoutAge: 20.5, comps: [{ name: "Zach Moss", matchPct: 68, wasSuccess: false }, { name: "James Conner", matchPct: 62, wasSuccess: true }], depthRole: "RB1", pathContext: "PSU thunder, shares with Singleton", ageClass: "normal" },
  { id: "16682", name: "Ryan Wingo", position: "WR", positionRank: 13, college: "Texas", tier: 8, trend7Day: 1, trend30Day: 2, seasonChange: 10, value: 3092, draftEligibleYear: 2027, starterPct: 62, elitePct: 22, bustPct: 22, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.5, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 19.8, comps: [{ name: "Kadarius Toney", matchPct: 60, wasSuccess: false }, { name: "Parris Campbell", matchPct: 55, wasSuccess: false }], depthRole: "WR2", pathContext: "Behind Cam Coleman at Texas", ageClass: "normal" },
  { id: "11998", name: "Nicholas Singleton", position: "RB", positionRank: 6, college: "Penn State", tier: 8, trend7Day: 0, trend30Day: 1, seasonChange: 2, value: 3091, draftEligibleYear: 2026, starterPct: 64, elitePct: 22, bustPct: 20, top10Pct: 8, round1Pct: 25, round2PlusPct: 75, pickEquivalent: "2026 Late 2nd", pickMultiplier: 0.5, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 19.8, comps: [{ name: "Travis Etienne", matchPct: 62, wasSuccess: true }, { name: "Jaylen Warren", matchPct: 58, wasSuccess: true }], depthRole: "RB1", pathContext: "PSU lightning, explosive burst", ageClass: "young-breakout" },
  { id: "16246", name: "DJ Lagway", position: "QB", positionRank: 8, college: "Florida", tier: 9, trend7Day: 1, trend30Day: 3, seasonChange: 18, value: 2957, draftEligibleYear: 2027, starterPct: 65, elitePct: 28, bustPct: 20, top10Pct: 15, round1Pct: 42, round2PlusPct: 58, pickEquivalent: "2027 Early 2nd", pickMultiplier: 0.7, dominatorRating: 22.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Anthony Richardson", matchPct: 70, wasSuccess: true }, { name: "Malik Willis", matchPct: 58, wasSuccess: false }], depthRole: "Starter", pathContext: "Florida starter, elite arm talent", ageClass: "young-breakout" },
  { id: "17630", name: "Ahmad Hardy", position: "RB", positionRank: 7, college: "Missouri", tier: 9, trend7Day: 2, trend30Day: 5, seasonChange: 22, value: 2881, draftEligibleYear: 2027, starterPct: 62, elitePct: 22, bustPct: 22, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2027 Mid 2nd", pickMultiplier: 0.55, dominatorRating: 28.0, yardShare: 25.0, tdShare: 30.0, breakoutAge: 19.2, comps: [{ name: "Isiah Pacheco", matchPct: 68, wasSuccess: true }, { name: "Dameon Pierce", matchPct: 62, wasSuccess: true }], depthRole: "RB1", pathContext: "Missouri workhorse, physical runner", ageClass: "young-breakout" },
  { id: "14345", name: "Zachariah Branch", position: "WR", positionRank: 14, college: "USC", tier: 9, trend7Day: 1, trend30Day: 3, seasonChange: 12, value: 2840, draftEligibleYear: 2027, starterPct: 65, elitePct: 25, bustPct: 18, top10Pct: 12, round1Pct: 35, round2PlusPct: 65, pickEquivalent: "2027 Mid 2nd", pickMultiplier: 0.55, dominatorRating: 25.0, yardShare: 22.0, tdShare: 25.0, breakoutAge: 18.8, comps: [{ name: "Tyreek Hill", matchPct: 58, wasSuccess: true }, { name: "Marquise Brown", matchPct: 65, wasSuccess: true }], depthRole: "WR2", pathContext: "Elite speed, shares with Makai Lemon", ageClass: "young-breakout" },
  { id: "16659", name: "Bryant Wesco Jr.", position: "WR", positionRank: 15, college: "Clemson", tier: 9, trend7Day: 5, trend30Day: 10, seasonChange: 35, value: 2778, draftEligibleYear: 2028, starterPct: 68, elitePct: 30, bustPct: 15, top10Pct: 18, round1Pct: 45, round2PlusPct: 55, pickEquivalent: "2028 Early 2nd", pickMultiplier: 0.7, dominatorRating: 28.0, yardShare: 25.0, tdShare: 30.0, breakoutAge: 18.2, comps: [{ name: "CeeDee Lamb", matchPct: 60, wasSuccess: true }, { name: "Tee Higgins", matchPct: 65, wasSuccess: true }], depthRole: "WR1", pathContext: "Future Clemson alpha WR", ageClass: "young-breakout" },
  { id: "12885", name: "Sam Leavitt", position: "QB", positionRank: 9, college: "Arizona State", tier: 9, trend7Day: 4, trend30Day: 8, seasonChange: 28, value: 2777, draftEligibleYear: 2026, starterPct: 58, elitePct: 20, bustPct: 28, top10Pct: 5, round1Pct: 22, round2PlusPct: 78, pickEquivalent: "2026 Mid 2nd", pickMultiplier: 0.55, dominatorRating: 18.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Marcus Mariota", matchPct: 62, wasSuccess: false }, { name: "Geno Smith", matchPct: 58, wasSuccess: true }], depthRole: "Starter", pathContext: "ASU starter, late bloomer", ageClass: "old-producer" },
  { id: "7023", name: "Chris Brazzell II", position: "WR", positionRank: 16, college: "Tennessee", tier: 9, trend7Day: 3, trend30Day: 7, seasonChange: 20, value: 2714, draftEligibleYear: 2026, starterPct: 60, elitePct: 20, bustPct: 25, top10Pct: 5, round1Pct: 22, round2PlusPct: 78, pickEquivalent: "2026 Mid-Late 2nd", pickMultiplier: 0.5, dominatorRating: 25.0, yardShare: 22.0, tdShare: 28.0, breakoutAge: 20.5, comps: [{ name: "Jakobi Meyers", matchPct: 65, wasSuccess: true }, { name: "Kendrick Bourne", matchPct: 58, wasSuccess: true }], depthRole: "WR1", pathContext: "Tennessee alpha, reliable target", ageClass: "normal" },
  { id: "13696", name: "Nyck Harbor", position: "WR", positionRank: 17, college: "South Carolina", tier: 9, trend7Day: 2, trend30Day: 5, seasonChange: 15, value: 2692, draftEligibleYear: 2027, starterPct: 60, elitePct: 22, bustPct: 22, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.5, dominatorRating: 25.0, yardShare: 22.0, tdShare: 25.0, breakoutAge: 19.5, comps: [{ name: "Terry McLaurin", matchPct: 58, wasSuccess: true }, { name: "Darnell Mooney", matchPct: 62, wasSuccess: true }], depthRole: "WR1", pathContext: "SC featured WR, speed threat", ageClass: "young-breakout" },
  { id: "7240", name: "John Mateer", position: "QB", positionRank: 10, college: "Oklahoma", tier: 9, trend7Day: 1, trend30Day: 2, seasonChange: 8, value: 2659, draftEligibleYear: 2026, starterPct: 55, elitePct: 18, bustPct: 30, top10Pct: 5, round1Pct: 18, round2PlusPct: 82, pickEquivalent: "2026 Late 2nd", pickMultiplier: 0.45, dominatorRating: 20.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Taysom Hill", matchPct: 62, wasSuccess: false }, { name: "Tyler Huntley", matchPct: 58, wasSuccess: false }], depthRole: "Starter", pathContext: "Oklahoma starter, dual-threat", ageClass: "old-producer" },
  { id: "16193", name: "Isaac Brown", position: "RB", positionRank: 8, college: "Louisville", tier: 9, trend7Day: 4, trend30Day: 9, seasonChange: 32, value: 2646, draftEligibleYear: 2027, starterPct: 62, elitePct: 22, bustPct: 22, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2027 Mid 2nd", pickMultiplier: 0.55, dominatorRating: 30.0, yardShare: 28.0, tdShare: 32.0, breakoutAge: 19.0, comps: [{ name: "Javonte Williams", matchPct: 62, wasSuccess: true }, { name: "Devin Singletary", matchPct: 58, wasSuccess: true }], depthRole: "RB1", pathContext: "Louisville feature, explosive", ageClass: "young-breakout" },
  { id: "16791", name: "Nick Marsh", position: "WR", positionRank: 18, college: "Michigan State", tier: 10, trend7Day: 2, trend30Day: 5, seasonChange: 18, value: 2320, draftEligibleYear: 2027, starterPct: 58, elitePct: 20, bustPct: 25, top10Pct: 5, round1Pct: 22, round2PlusPct: 78, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.45, dominatorRating: 28.0, yardShare: 25.0, tdShare: 28.0, breakoutAge: 19.2, comps: [{ name: "Christian Kirk", matchPct: 62, wasSuccess: true }, { name: "Zay Flowers", matchPct: 58, wasSuccess: true }], depthRole: "WR1", pathContext: "MSU alpha, breakout candidate", ageClass: "young-breakout" },
  { id: "16704", name: "Dylan Raiola", position: "QB", positionRank: 11, college: "Nebraska", tier: 11, trend7Day: 1, trend30Day: 3, seasonChange: 10, value: 2131, draftEligibleYear: 2027, starterPct: 62, elitePct: 25, bustPct: 22, top10Pct: 12, round1Pct: 35, round2PlusPct: 65, pickEquivalent: "2027 Mid 2nd", pickMultiplier: 0.55, dominatorRating: 20.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Justin Herbert", matchPct: 55, wasSuccess: true }, { name: "Sam Darnold", matchPct: 58, wasSuccess: false }], depthRole: "Starter", pathContext: "Nebraska starter, high pedigree", ageClass: "young-breakout" },
  { id: "6182", name: "Garrett Nussmeier", position: "QB", positionRank: 12, college: "LSU", tier: 11, trend7Day: 0, trend30Day: 1, seasonChange: 5, value: 2040, draftEligibleYear: 2026, starterPct: 58, elitePct: 18, bustPct: 28, top10Pct: 5, round1Pct: 18, round2PlusPct: 82, pickEquivalent: "2026 Late 2nd", pickMultiplier: 0.42, dominatorRating: 18.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Gardner Minshew", matchPct: 65, wasSuccess: true }, { name: "Davis Mills", matchPct: 58, wasSuccess: false }], depthRole: "Starter", pathContext: "LSU starter, gunslinger style", ageClass: "old-producer" },
  { id: "13242", name: "Eric Singleton Jr.", position: "WR", positionRank: 19, college: "Georgia", tier: 11, trend7Day: 5, trend30Day: 10, seasonChange: 40, value: 2019, draftEligibleYear: 2027, starterPct: 60, elitePct: 22, bustPct: 22, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.48, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 19.5, comps: [{ name: "Quentin Johnston", matchPct: 58, wasSuccess: true }, { name: "Jameson Williams", matchPct: 55, wasSuccess: true }], depthRole: "WR2", pathContext: "Georgia rotation, explosive upside", ageClass: "young-breakout" },
  { id: "16674", name: "T.J. Moore", position: "WR", positionRank: 20, college: "Clemson", tier: 11, trend7Day: 2, trend30Day: 5, seasonChange: 15, value: 2001, draftEligibleYear: 2028, starterPct: 62, elitePct: 24, bustPct: 20, top10Pct: 10, round1Pct: 32, round2PlusPct: 68, pickEquivalent: "2028 Mid 2nd", pickMultiplier: 0.52, dominatorRating: 25.0, yardShare: 22.0, tdShare: 25.0, breakoutAge: 18.5, comps: [{ name: "DeVonta Smith", matchPct: 58, wasSuccess: true }, { name: "Jahan Dotson", matchPct: 62, wasSuccess: true }], depthRole: "WR2", pathContext: "Behind Bryant Wesco Jr.", ageClass: "young-breakout" },
  { id: "19751", name: "Keelon Russell", position: "QB", positionRank: 13, college: "Alabama", tier: 11, trend7Day: 8, trend30Day: 15, seasonChange: 50, value: 1999, draftEligibleYear: 2028, starterPct: 68, elitePct: 35, bustPct: 15, top10Pct: 25, round1Pct: 52, round2PlusPct: 48, pickEquivalent: "2028 Mid 1st", pickMultiplier: 0.85, dominatorRating: 25.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Kyler Murray", matchPct: 62, wasSuccess: true }, { name: "Lamar Jackson", matchPct: 58, wasSuccess: true }], depthRole: "Starter", pathContext: "Future Alabama starter, elite athlete", ageClass: "young-breakout" },
  { id: "6756", name: "Evan Stewart", position: "WR", positionRank: 21, college: "Oregon", tier: 11, trend7Day: 2, trend30Day: 4, seasonChange: 10, value: 1995, draftEligibleYear: 2026, starterPct: 58, elitePct: 18, bustPct: 28, top10Pct: 5, round1Pct: 18, round2PlusPct: 82, pickEquivalent: "2026 Late 2nd", pickMultiplier: 0.42, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 21.0, comps: [{ name: "Rashid Shaheed", matchPct: 62, wasSuccess: true }, { name: "Jalen Reagor", matchPct: 55, wasSuccess: false }], depthRole: "WR2", pathContext: "Oregon depth, speed specialist", ageClass: "old-producer" },
  { id: "13348", name: "CJ Baxter Jr.", position: "RB", positionRank: 9, college: "Texas", tier: 11, trend7Day: 0, trend30Day: 0, seasonChange: -5, value: 1954, draftEligibleYear: 2027, starterPct: 55, elitePct: 18, bustPct: 30, top10Pct: 5, round1Pct: 18, round2PlusPct: 82, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.4, dominatorRating: 20.0, yardShare: 15.0, tdShare: 20.0, breakoutAge: 20.5, comps: [{ name: "Ke'Shawn Vaughn", matchPct: 58, wasSuccess: false }, { name: "Royce Freeman", matchPct: 55, wasSuccess: false }], depthRole: "RB2", pathContext: "Texas depth, injury concerns", ageClass: "normal" },
  { id: "14527", name: "Duce Robinson", position: "TE", positionRank: 2, college: "USC", tier: 11, trend7Day: 0, trend30Day: 0, seasonChange: 0, value: 1938, draftEligibleYear: 2027, starterPct: 62, elitePct: 25, bustPct: 20, top10Pct: 12, round1Pct: 35, round2PlusPct: 65, pickEquivalent: "2027 Mid 2nd", pickMultiplier: 0.52, dominatorRating: 18.0, yardShare: 12.0, tdShare: 18.0, breakoutAge: 19.8, comps: [{ name: "Mark Andrews", matchPct: 62, wasSuccess: true }, { name: "Noah Fant", matchPct: 58, wasSuccess: true }], depthRole: "TE1", pathContext: "USC featured TE, athletic freak", ageClass: "young-breakout" },
  { id: "12778", name: "Rueben Owens II", position: "RB", positionRank: 10, college: "Louisville", tier: 11, trend7Day: 2, trend30Day: 5, seasonChange: 12, value: 1914, draftEligibleYear: 2026, starterPct: 55, elitePct: 15, bustPct: 32, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2026 3rd", pickMultiplier: 0.35, dominatorRating: 20.0, yardShare: 15.0, tdShare: 20.0, breakoutAge: 20.8, comps: [{ name: "Ty Johnson", matchPct: 58, wasSuccess: false }, { name: "Jaylen Samuels", matchPct: 52, wasSuccess: false }], depthRole: "RB2", pathContext: "Louisville depth, change of pace", ageClass: "old-producer" },
  { id: "12910", name: "Eugene Wilson III", position: "WR", positionRank: 22, college: "Georgia", tier: 11, trend7Day: 3, trend30Day: 6, seasonChange: 18, value: 1907, draftEligibleYear: 2027, starterPct: 58, elitePct: 20, bustPct: 25, top10Pct: 5, round1Pct: 22, round2PlusPct: 78, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.45, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 19.8, comps: [{ name: "Wan'Dale Robinson", matchPct: 62, wasSuccess: true }, { name: "Rondale Moore", matchPct: 58, wasSuccess: true }], depthRole: "WR2", pathContext: "Georgia rotation, slot specialist", ageClass: "young-breakout" },
  { id: "11972", name: "Drew Allar", position: "QB", positionRank: 14, college: "Penn State", tier: 11, trend7Day: 1, trend30Day: 2, seasonChange: 5, value: 1834, draftEligibleYear: 2026, starterPct: 55, elitePct: 15, bustPct: 32, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2026 3rd", pickMultiplier: 0.35, dominatorRating: 18.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Drew Lock", matchPct: 62, wasSuccess: false }, { name: "Will Levis", matchPct: 58, wasSuccess: false }], depthRole: "Starter", pathContext: "PSU starter, arm talent but inconsistent", ageClass: "normal" },
  { id: "11095", name: "Barion Brown", position: "WR", positionRank: 23, college: "Kentucky", tier: 11, trend7Day: 1, trend30Day: 3, seasonChange: 8, value: 1789, draftEligibleYear: 2026, starterPct: 55, elitePct: 15, bustPct: 32, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2026 3rd", pickMultiplier: 0.35, dominatorRating: 25.0, yardShare: 22.0, tdShare: 25.0, breakoutAge: 20.2, comps: [{ name: "Velus Jones Jr.", matchPct: 58, wasSuccess: false }, { name: "Quez Watkins", matchPct: 55, wasSuccess: false }], depthRole: "WR1", pathContext: "Kentucky alpha, return specialist", ageClass: "normal" },
  { id: "12070", name: "Emmett Johnson", position: "RB", positionRank: 11, college: "Nebraska", tier: 11, trend7Day: 6, trend30Day: 12, seasonChange: 35, value: 1781, draftEligibleYear: 2026, starterPct: 55, elitePct: 15, bustPct: 32, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2026 3rd", pickMultiplier: 0.35, dominatorRating: 25.0, yardShare: 22.0, tdShare: 28.0, breakoutAge: 20.0, comps: [{ name: "Khalil Herbert", matchPct: 62, wasSuccess: true }, { name: "Mike Boone", matchPct: 55, wasSuccess: false }], depthRole: "RB1", pathContext: "Nebraska workhorse, productive", ageClass: "normal" },
  // Additional players to reach 60+ total
  { id: "18001", name: "Quinshon Judkins", position: "RB", positionRank: 12, college: "Ohio State", tier: 12, trend7Day: 2, trend30Day: 5, seasonChange: 15, value: 1720, draftEligibleYear: 2026, starterPct: 65, elitePct: 25, bustPct: 18, top10Pct: 12, round1Pct: 38, round2PlusPct: 62, pickEquivalent: "2026 Early 2nd", pickMultiplier: 0.65, dominatorRating: 32.0, yardShare: 28.0, tdShare: 35.0, breakoutAge: 20.0, comps: [{ name: "Josh Jacobs", matchPct: 70, wasSuccess: true }, { name: "Najee Harris", matchPct: 65, wasSuccess: true }], depthRole: "RB1", pathContext: "OSU featured back, transfer from Ole Miss", ageClass: "normal" },
  { id: "18002", name: "TreVeyon Henderson", position: "RB", positionRank: 13, college: "Ohio State", tier: 12, trend7Day: 1, trend30Day: 3, seasonChange: 8, value: 1680, draftEligibleYear: 2026, starterPct: 60, elitePct: 20, bustPct: 22, top10Pct: 8, round1Pct: 28, round2PlusPct: 72, pickEquivalent: "2026 Mid 2nd", pickMultiplier: 0.55, dominatorRating: 28.0, yardShare: 22.0, tdShare: 28.0, breakoutAge: 19.5, comps: [{ name: "Chris Carson", matchPct: 62, wasSuccess: true }, { name: "Sony Michel", matchPct: 58, wasSuccess: true }], depthRole: "RB2", pathContext: "OSU committee, explosive talent", ageClass: "young-breakout" },
  { id: "18003", name: "Cade Klubnik", position: "QB", positionRank: 15, college: "Clemson", tier: 12, trend7Day: 0, trend30Day: 2, seasonChange: 5, value: 1650, draftEligibleYear: 2026, starterPct: 52, elitePct: 15, bustPct: 35, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2026 3rd", pickMultiplier: 0.32, dominatorRating: 18.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Trevor Siemian", matchPct: 58, wasSuccess: false }, { name: "Case Keenum", matchPct: 55, wasSuccess: false }], depthRole: "Starter", pathContext: "Clemson starter, developing", ageClass: "normal" },
  { id: "18004", name: "Jalen Milroe", position: "QB", positionRank: 16, college: "Alabama", tier: 12, trend7Day: 3, trend30Day: 8, seasonChange: 25, value: 1620, draftEligibleYear: 2026, starterPct: 58, elitePct: 22, bustPct: 25, top10Pct: 8, round1Pct: 25, round2PlusPct: 75, pickEquivalent: "2026 Mid 2nd", pickMultiplier: 0.5, dominatorRating: 22.0, yardShare: 0, tdShare: 0, breakoutAge: null, comps: [{ name: "Lamar Jackson", matchPct: 55, wasSuccess: true }, { name: "RG3", matchPct: 58, wasSuccess: false }], depthRole: "Starter", pathContext: "Alabama starter, electric runner", ageClass: "normal" },
  { id: "18005", name: "Elic Ayomanor", position: "WR", positionRank: 24, college: "Stanford", tier: 12, trend7Day: 2, trend30Day: 5, seasonChange: 15, value: 1580, draftEligibleYear: 2026, starterPct: 55, elitePct: 18, bustPct: 28, top10Pct: 5, round1Pct: 18, round2PlusPct: 82, pickEquivalent: "2026 Late 2nd", pickMultiplier: 0.42, dominatorRating: 35.0, yardShare: 32.0, tdShare: 35.0, breakoutAge: 20.0, comps: [{ name: "Michael Pittman Jr.", matchPct: 68, wasSuccess: true }, { name: "Curtis Samuel", matchPct: 55, wasSuccess: true }], depthRole: "WR1", pathContext: "Stanford alpha, complete receiver", ageClass: "normal" },
  { id: "18006", name: "Tetairoa McMillan", position: "WR", positionRank: 25, college: "Arizona", tier: 12, trend7Day: 4, trend30Day: 10, seasonChange: 30, value: 1550, draftEligibleYear: 2026, starterPct: 72, elitePct: 35, bustPct: 12, top10Pct: 22, round1Pct: 55, round2PlusPct: 45, pickEquivalent: "2026 Late 1st", pickMultiplier: 0.85, dominatorRating: 40.0, yardShare: 38.0, tdShare: 42.0, breakoutAge: 19.5, comps: [{ name: "Mike Evans", matchPct: 72, wasSuccess: true }, { name: "DK Metcalf", matchPct: 68, wasSuccess: true }], depthRole: "WR1", pathContext: "Arizona alpha, X receiver", ageClass: "young-breakout" },
  { id: "18007", name: "Kelvin Banks Jr.", position: "RB", positionRank: 14, college: "Texas", tier: 12, trend7Day: 1, trend30Day: 3, seasonChange: 8, value: 1520, draftEligibleYear: 2027, starterPct: 55, elitePct: 15, bustPct: 32, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2027 3rd", pickMultiplier: 0.32, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 20.2, comps: [{ name: "Gus Edwards", matchPct: 62, wasSuccess: true }, { name: "Mark Ingram", matchPct: 58, wasSuccess: true }], depthRole: "RB2", pathContext: "Texas depth, committee role", ageClass: "normal" },
  { id: "18008", name: "Luther Burden III", position: "WR", positionRank: 26, college: "Missouri", tier: 12, trend7Day: 2, trend30Day: 6, seasonChange: 18, value: 1490, draftEligibleYear: 2026, starterPct: 68, elitePct: 30, bustPct: 15, top10Pct: 18, round1Pct: 48, round2PlusPct: 52, pickEquivalent: "2026 Early 2nd", pickMultiplier: 0.72, dominatorRating: 38.0, yardShare: 35.0, tdShare: 40.0, breakoutAge: 19.2, comps: [{ name: "AJ Brown", matchPct: 65, wasSuccess: true }, { name: "Deebo Samuel", matchPct: 68, wasSuccess: true }], depthRole: "WR1", pathContext: "Missouri alpha, YAC monster", ageClass: "young-breakout" },
  { id: "18009", name: "Johntay Cook II", position: "WR", positionRank: 27, college: "Texas", tier: 12, trend7Day: 1, trend30Day: 2, seasonChange: 5, value: 1450, draftEligibleYear: 2027, starterPct: 55, elitePct: 18, bustPct: 28, top10Pct: 5, round1Pct: 18, round2PlusPct: 82, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.42, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 19.8, comps: [{ name: "Amon-Ra St. Brown", matchPct: 58, wasSuccess: true }, { name: "Elijah Moore", matchPct: 55, wasSuccess: true }], depthRole: "WR2", pathContext: "Texas depth, slot role", ageClass: "young-breakout" },
  { id: "18010", name: "Harold Perkins Jr.", position: "RB", positionRank: 15, college: "LSU", tier: 12, trend7Day: 0, trend30Day: 1, seasonChange: 3, value: 1420, draftEligibleYear: 2027, starterPct: 52, elitePct: 15, bustPct: 35, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2027 3rd", pickMultiplier: 0.3, dominatorRating: 18.0, yardShare: 12.0, tdShare: 18.0, breakoutAge: 20.5, comps: [{ name: "Deebo Samuel", matchPct: 52, wasSuccess: true }, { name: "Cordarrelle Patterson", matchPct: 55, wasSuccess: true }], depthRole: "Backup", pathContext: "LSU gadget player, LB convert", ageClass: "normal" },
  { id: "18011", name: "Donovan Edwards", position: "RB", positionRank: 16, college: "Michigan", tier: 12, trend7Day: 0, trend30Day: 2, seasonChange: 5, value: 1380, draftEligibleYear: 2026, starterPct: 55, elitePct: 15, bustPct: 32, top10Pct: 3, round1Pct: 12, round2PlusPct: 88, pickEquivalent: "2026 3rd", pickMultiplier: 0.32, dominatorRating: 25.0, yardShare: 22.0, tdShare: 25.0, breakoutAge: 20.8, comps: [{ name: "Kenneth Gainwell", matchPct: 62, wasSuccess: true }, { name: "Nyheim Hines", matchPct: 58, wasSuccess: true }], depthRole: "RB1", pathContext: "Michigan featured back, pass catcher", ageClass: "normal" },
  { id: "18012", name: "Jaden Greathouse", position: "WR", positionRank: 28, college: "Texas", tier: 12, trend7Day: 1, trend30Day: 3, seasonChange: 10, value: 1350, draftEligibleYear: 2027, starterPct: 55, elitePct: 18, bustPct: 28, top10Pct: 5, round1Pct: 18, round2PlusPct: 82, pickEquivalent: "2027 Late 2nd", pickMultiplier: 0.4, dominatorRating: 22.0, yardShare: 18.0, tdShare: 22.0, breakoutAge: 19.5, comps: [{ name: "Darnell Mooney", matchPct: 60, wasSuccess: true }, { name: "Byron Pringle", matchPct: 52, wasSuccess: false }], depthRole: "WR2", pathContext: "Texas rotation, reliable target", ageClass: "young-breakout" },
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
