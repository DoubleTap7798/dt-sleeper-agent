import type { StatLeader } from './nflverse-stats';

interface RedZoneQBRaw {
  rank: number;
  player: string;
  comp: number;
  att: number;
  pct: number;
  yds: number;
  ya: number;
  passTd: number;
  int: number;
  sacks: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  rushPct: number;
  fl: number;
  games: number;
  fpts: number;
  fptsPerGame: number;
}

interface AdvancedQBRaw {
  rank: number;
  player: string;
  games: number;
  comp: number;
  att: number;
  pct: number;
  yds: number;
  ya: number;
  airYds: number;
  airPerAtt: number;
  deep10: number;
  deep20: number;
  deep30: number;
  deep40: number;
  deep50: number;
  pktTime: number;
  sacks: number;
  knockdowns: number;
  hurries: number;
  blitz: number;
  poorThrows: number;
  drops: number;
  rzAtt: number;
  rating: number;
}

function parsePlayerTeam(raw: string): { name: string; team: string } {
  const match = raw.match(/^(.+?)\s*\(([A-Z]{2,3})\)$/);
  if (match) {
    return { name: match[1].trim(), team: match[2] };
  }
  return { name: raw, team: '' };
}

const RED_ZONE_QB_DATA: RedZoneQBRaw[] = [
  { rank: 1, player: "Josh Allen (BUF)", comp: 6, att: 9, pct: 66.7, yds: 41, ya: 4.6, passTd: 2, int: 0, sacks: 0, rushAtt: 8, rushYds: 0, rushTd: 2, rushPct: 100, fl: 0, games: 17, fpts: 21.6, fptsPerGame: 1.3 },
  { rank: 2, player: "Jalen Hurts (PHI)", comp: 1, att: 1, pct: 100, yds: 3, ya: 3, passTd: 0, int: 0, sacks: 0, rushAtt: 3, rushYds: 17, rushTd: 2, rushPct: 100, fl: 0, games: 16, fpts: 13.8, fptsPerGame: 0.9 },
  { rank: 3, player: "Justin Fields (NYJ)", comp: 0, att: 0, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 1, rushAtt: 4, rushYds: 16, rushTd: 2, rushPct: 100, fl: 0, games: 9, fpts: 13.6, fptsPerGame: 1.5 },
  { rank: 4, player: "Daniel Jones (IND)", comp: 1, att: 3, pct: 33.3, yds: 4, ya: 1.3, passTd: 0, int: 0, sacks: 1, rushAtt: 5, rushYds: 9, rushTd: 2, rushPct: 100, fl: 0, games: 13, fpts: 13.1, fptsPerGame: 1.0 },
  { rank: 5, player: "Aaron Rodgers (PIT)", comp: 3, att: 3, pct: 100, yds: 26, ya: 8.7, passTd: 3, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 13.0, fptsPerGame: 0.8 },
  { rank: 6, player: "Caleb Williams (CHI)", comp: 2, att: 2, pct: 100, yds: 8, ya: 4, passTd: 1, int: 0, sacks: 0, rushAtt: 2, rushYds: 22, rushTd: 1, rushPct: 100, fl: 0, games: 17, fpts: 12.5, fptsPerGame: 0.7 },
  { rank: 7, player: "J.J. McCarthy (MIN)", comp: 1, att: 3, pct: 33.3, yds: 13, ya: 4.3, passTd: 1, int: 0, sacks: 0, rushAtt: 1, rushYds: 14, rushTd: 1, rushPct: 100, fl: 0, games: 10, fpts: 11.9, fptsPerGame: 1.2 },
  { rank: 8, player: "Brock Purdy (SF)", comp: 5, att: 10, pct: 50, yds: 30, ya: 3, passTd: 2, int: 0, sacks: 0, rushAtt: 2, rushYds: 16, rushTd: 0, rushPct: 100, fl: 0, games: 9, fpts: 10.8, fptsPerGame: 1.2 },
  { rank: 9, player: "Jordan Love (GB)", comp: 4, att: 6, pct: 66.7, yds: 35, ya: 5.8, passTd: 2, int: 0, sacks: 0, rushAtt: 2, rushYds: 5, rushTd: 0, rushPct: 100, fl: 0, games: 15, fpts: 9.9, fptsPerGame: 0.7 },
  { rank: 10, player: "Kyler Murray (ARI)", comp: 3, att: 4, pct: 75, yds: 9, ya: 2.3, passTd: 2, int: 0, sacks: 0, rushAtt: 1, rushYds: 3, rushTd: 0, rushPct: 100, fl: 0, games: 5, fpts: 8.7, fptsPerGame: 1.7 },
  { rank: 11, player: "Justin Herbert (LAC)", comp: 2, att: 3, pct: 66.7, yds: 16, ya: 5.3, passTd: 2, int: 0, sacks: 1, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 8.6, fptsPerGame: 0.5 },
  { rank: 12, player: "Patrick Mahomes II (KC)", comp: 1, att: 5, pct: 20, yds: 1, ya: 0.2, passTd: 0, int: 0, sacks: 1, rushAtt: 1, rushYds: 11, rushTd: 1, rushPct: 100, fl: 0, games: 14, fpts: 7.1, fptsPerGame: 0.5 },
  { rank: 13, player: "Lamar Jackson (BAL)", comp: 0, att: 0, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 1, rushAtt: 1, rushYds: 10, rushTd: 1, rushPct: 100, fl: 0, games: 13, fpts: 7.0, fptsPerGame: 0.5 },
  { rank: 14, player: "Michael Penix Jr. (ATL)", comp: 0, att: 2, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 1, rushAtt: 2, rushYds: 6, rushTd: 1, rushPct: 100, fl: 0, games: 9, fpts: 6.6, fptsPerGame: 0.7 },
  { rank: 15, player: "Jared Goff (DET)", comp: 4, att: 10, pct: 40, yds: 32, ya: 3.2, passTd: 1, int: 1, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 5.3, fptsPerGame: 0.3 },
  { rank: 16, player: "Jayden Daniels (WAS)", comp: 1, att: 3, pct: 33.3, yds: 7, ya: 2.3, passTd: 1, int: 0, sacks: 0, rushAtt: 1, rushYds: 9, rushTd: 0, rushPct: 100, fl: 0, games: 7, fpts: 5.2, fptsPerGame: 0.7 },
  { rank: 17, player: "Joe Flacco (CIN)", comp: 4, att: 5, pct: 80, yds: 25, ya: 5, passTd: 1, int: 0, sacks: 1, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 13, fpts: 5.0, fptsPerGame: 0.4 },
  { rank: 18, player: "Trevor Lawrence (JAC)", comp: 2, att: 3, pct: 66.7, yds: 10, ya: 3.3, passTd: 1, int: 0, sacks: 0, rushAtt: 1, rushYds: 4, rushTd: 0, rushPct: 100, fl: 0, games: 17, fpts: 4.8, fptsPerGame: 0.3 },
  { rank: 19, player: "Drake Maye (NE)", comp: 2, att: 4, pct: 50, yds: 12, ya: 3, passTd: 1, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 4.5, fptsPerGame: 0.3 },
  { rank: 20, player: "Tua Tagovailoa (MIA)", comp: 1, att: 3, pct: 33.3, yds: 11, ya: 3.7, passTd: 1, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 14, fpts: 4.4, fptsPerGame: 0.3 },
  { rank: 21, player: "Baker Mayfield (TB)", comp: 1, att: 1, pct: 100, yds: 9, ya: 9, passTd: 1, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 4.4, fptsPerGame: 0.3 },
  { rank: 22, player: "Matthew Stafford (LAR)", comp: 2, att: 2, pct: 100, yds: 6, ya: 3, passTd: 1, int: 0, sacks: 0, rushAtt: 1, rushYds: 0, rushTd: 0, rushPct: 100, fl: 0, games: 17, fpts: 4.2, fptsPerGame: 0.2 },
  { rank: 23, player: "Joe Burrow (CIN)", comp: 1, att: 4, pct: 25, yds: 1, ya: 0.3, passTd: 1, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 8, fpts: 4.0, fptsPerGame: 0.5 },
  { rank: 24, player: "Russell Wilson (NYG)", comp: 2, att: 9, pct: 22.2, yds: 12, ya: 1.3, passTd: 0, int: 0, sacks: 0, rushAtt: 2, rushYds: 9, rushTd: 0, rushPct: 100, fl: 0, games: 6, fpts: 1.4, fptsPerGame: 0.2 },
  { rank: 25, player: "Spencer Rattler (NO)", comp: 0, att: 7, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 0, rushAtt: 1, rushYds: 12, rushTd: 0, rushPct: 100, fl: 0, games: 9, fpts: 1.2, fptsPerGame: 0.1 },
  { rank: 26, player: "Bo Nix (DEN)", comp: 2, att: 2, pct: 100, yds: 8, ya: 4, passTd: 0, int: 0, sacks: 0, rushAtt: 1, rushYds: 1, rushTd: 0, rushPct: 100, fl: 0, games: 17, fpts: 0.4, fptsPerGame: 0 },
  { rank: 27, player: "Geno Smith (LV)", comp: 1, att: 1, pct: 100, yds: 7, ya: 7, passTd: 0, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 15, fpts: 0.3, fptsPerGame: 0 },
  { rank: 28, player: "C.J. Stroud (HOU)", comp: 0, att: 1, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 1, rushAtt: 1, rushYds: 2, rushTd: 0, rushPct: 100, fl: 0, games: 14, fpts: 0.2, fptsPerGame: 0 },
  { rank: 29, player: "Bryce Young (CAR)", comp: 0, att: 1, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 0, fptsPerGame: 0 },
  { rank: 30, player: "Dak Prescott (DAL)", comp: 0, att: 1, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 0, fptsPerGame: 0 },
  { rank: 31, player: "Cam Ward (TEN)", comp: 0, att: 0, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 1, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 0, fptsPerGame: 0 },
  { rank: 32, player: "Sam Darnold (SEA)", comp: 0, att: 0, pct: 0, yds: 0, ya: 0, passTd: 0, int: 0, sacks: 1, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 1, games: 17, fpts: -2, fptsPerGame: -0.1 },
];

const ADVANCED_QB_DATA: AdvancedQBRaw[] = [
  { rank: 1, player: "Josh Allen (BUF)", games: 17, comp: 319, att: 460, pct: 69, yds: 3668, ya: 8.0, airYds: 1972, airPerAtt: 4.3, deep10: 141, deep20: 56, deep30: 20, deep40: 10, deep50: 4, pktTime: 2.5, sacks: 40, knockdowns: 29, hurries: 30, blitz: 128, poorThrows: 58, drops: 18, rzAtt: 61, rating: 95 },
  { rank: 2, player: "Drake Maye (NE)", games: 17, comp: 354, att: 492, pct: 72, yds: 4394, ya: 8.9, airYds: 2804, airPerAtt: 5.7, deep10: 178, deep20: 67, deep30: 25, deep40: 6, deep50: 5, pktTime: 2.4, sacks: 47, knockdowns: 42, hurries: 43, blitz: 158, poorThrows: 65, drops: 13, rzAtt: 72, rating: 115 },
  { rank: 3, player: "Matthew Stafford (LAR)", games: 17, comp: 388, att: 597, pct: 65, yds: 4707, ya: 7.9, airYds: 2971, airPerAtt: 5.0, deep10: 184, deep20: 72, deep30: 27, deep40: 8, deep50: 4, pktTime: 2.4, sacks: 23, knockdowns: 52, hurries: 42, blitz: 159, poorThrows: 106, drops: 28, rzAtt: 104, rating: 108 },
  { rank: 4, player: "Trevor Lawrence (JAC)", games: 17, comp: 341, att: 560, pct: 61, yds: 4007, ya: 7.1, airYds: 2561, airPerAtt: 4.6, deep10: 167, deep20: 57, deep30: 17, deep40: 6, deep50: 2, pktTime: 2.4, sacks: 41, knockdowns: 40, hurries: 59, blitz: 158, poorThrows: 78, drops: 45, rzAtt: 81, rating: 91 },
  { rank: 5, player: "Dak Prescott (DAL)", games: 17, comp: 404, att: 600, pct: 67, yds: 4552, ya: 7.6, airYds: 2814, airPerAtt: 4.7, deep10: 183, deep20: 53, deep30: 27, deep40: 12, deep50: 3, pktTime: 2.4, sacks: 31, knockdowns: 56, hurries: 55, blitz: 163, poorThrows: 72, drops: 25, rzAtt: 99, rating: 100 },
  { rank: 6, player: "Caleb Williams (CHI)", games: 17, comp: 330, att: 568, pct: 58, yds: 3942, ya: 6.9, airYds: 2363, airPerAtt: 4.2, deep10: 173, deep20: 58, deep30: 18, deep40: 7, deep50: 3, pktTime: 2.5, sacks: 24, knockdowns: 41, hurries: 94, blitz: 174, poorThrows: 110, drops: 28, rzAtt: 72, rating: 90 },
  { rank: 7, player: "Bo Nix (DEN)", games: 17, comp: 388, att: 612, pct: 63, yds: 3931, ya: 6.4, airYds: 2200, airPerAtt: 3.6, deep10: 154, deep20: 47, deep30: 18, deep40: 7, deep50: 1, pktTime: 2.4, sacks: 22, knockdowns: 45, hurries: 61, blitz: 115, poorThrows: 93, drops: 43, rzAtt: 80, rating: 88 },
  { rank: 8, player: "Jared Goff (DET)", games: 17, comp: 393, att: 578, pct: 68, yds: 4564, ya: 7.9, airYds: 2438, airPerAtt: 4.2, deep10: 185, deep20: 66, deep30: 21, deep40: 8, deep50: 2, pktTime: 2.3, sacks: 38, knockdowns: 76, hurries: 39, blitz: 152, poorThrows: 82, drops: 25, rzAtt: 86, rating: 106 },
  { rank: 9, player: "Jalen Hurts (PHI)", games: 16, comp: 294, att: 454, pct: 65, yds: 3224, ya: 7.1, airYds: 2134, airPerAtt: 4.7, deep10: 117, deep20: 40, deep30: 19, deep40: 9, deep50: 3, pktTime: 2.5, sacks: 32, knockdowns: 25, hurries: 48, blitz: 162, poorThrows: 72, drops: 11, rzAtt: 49, rating: 100 },
  { rank: 10, player: "Justin Herbert (LAC)", games: 16, comp: 340, att: 512, pct: 66, yds: 3727, ya: 7.3, airYds: 2274, airPerAtt: 4.4, deep10: 144, deep20: 43, deep30: 19, deep40: 8, deep50: 6, pktTime: 2.4, sacks: 54, knockdowns: 74, hurries: 55, blitz: 158, poorThrows: 75, drops: 25, rzAtt: 77, rating: 94 },
  { rank: 11, player: "Patrick Mahomes II (KC)", games: 14, comp: 315, att: 502, pct: 63, yds: 3587, ya: 7.1, airYds: 1977, airPerAtt: 3.9, deep10: 146, deep20: 49, deep30: 21, deep40: 8, deep50: 1, pktTime: 2.2, sacks: 34, knockdowns: 69, hurries: 39, blitz: 96, poorThrows: 85, drops: 27, rzAtt: 76, rating: 90 },
  { rank: 12, player: "Baker Mayfield (TB)", games: 17, comp: 343, att: 543, pct: 63, yds: 3693, ya: 6.8, airYds: 2129, airPerAtt: 3.9, deep10: 146, deep20: 54, deep30: 16, deep40: 7, deep50: 4, pktTime: 2.3, sacks: 36, knockdowns: 20, hurries: 36, blitz: 146, poorThrows: 82, drops: 20, rzAtt: 56, rating: 90 },
  { rank: 13, player: "Sam Darnold (SEA)", games: 17, comp: 323, att: 477, pct: 68, yds: 4048, ya: 8.5, airYds: 2443, airPerAtt: 5.1, deep10: 164, deep20: 57, deep30: 20, deep40: 12, deep50: 7, pktTime: 2.4, sacks: 27, knockdowns: 35, hurries: 47, blitz: 149, poorThrows: 66, drops: 15, rzAtt: 66, rating: 101 },
  { rank: 14, player: "Jaxson Dart (NYG)", games: 14, comp: 216, att: 339, pct: 64, yds: 2272, ya: 6.7, airYds: 1279, airPerAtt: 3.8, deep10: 87, deep20: 25, deep30: 10, deep40: 3, deep50: 0, pktTime: 2.4, sacks: 35, knockdowns: 36, hurries: 25, blitz: 101, poorThrows: 51, drops: 14, rzAtt: 44, rating: 77 },
  { rank: 15, player: "Jordan Love (GB)", games: 15, comp: 291, att: 439, pct: 66, yds: 3381, ya: 7.7, airYds: 2096, airPerAtt: 4.8, deep10: 128, deep20: 49, deep30: 18, deep40: 8, deep50: 4, pktTime: 2.4, sacks: 21, knockdowns: 49, hurries: 37, blitz: 135, poorThrows: 60, drops: 17, rzAtt: 64, rating: 101 },
  { rank: 16, player: "Jacoby Brissett (ARI)", games: 14, comp: 315, att: 485, pct: 65, yds: 3366, ya: 6.9, airYds: 1953, airPerAtt: 4.0, deep10: 143, deep20: 41, deep30: 12, deep40: 3, deep50: 1, pktTime: 2.4, sacks: 43, knockdowns: 63, hurries: 45, blitz: 104, poorThrows: 81, drops: 11, rzAtt: 77, rating: 84 },
  { rank: 17, player: "Daniel Jones (IND)", games: 13, comp: 261, att: 384, pct: 68, yds: 3101, ya: 8.1, airYds: 1876, airPerAtt: 4.9, deep10: 125, deep20: 36, deep30: 13, deep40: 7, deep50: 2, pktTime: 2.3, sacks: 22, knockdowns: 41, hurries: 24, blitz: 128, poorThrows: 46, drops: 14, rzAtt: 52, rating: 100 },
  { rank: 18, player: "Aaron Rodgers (PIT)", games: 16, comp: 327, att: 498, pct: 66, yds: 3322, ya: 6.7, airYds: 1572, airPerAtt: 3.2, deep10: 125, deep20: 38, deep30: 15, deep40: 7, deep50: 4, pktTime: 2.2, sacks: 29, knockdowns: 28, hurries: 27, blitz: 97, poorThrows: 82, drops: 17, rzAtt: 74, rating: 95 },
  { rank: 19, player: "Bryce Young (CAR)", games: 16, comp: 304, att: 478, pct: 64, yds: 3011, ya: 6.3, airYds: 1739, airPerAtt: 3.6, deep10: 114, deep20: 39, deep30: 13, deep40: 4, deep50: 1, pktTime: 2.4, sacks: 27, knockdowns: 48, hurries: 54, blitz: 127, poorThrows: 73, drops: 18, rzAtt: 65, rating: 86 },
  { rank: 20, player: "Lamar Jackson (BAL)", games: 13, comp: 192, att: 302, pct: 64, yds: 2549, ya: 8.4, airYds: 1574, airPerAtt: 5.2, deep10: 97, deep20: 38, deep30: 20, deep40: 6, deep50: 2, pktTime: 2.5, sacks: 36, knockdowns: 23, hurries: 28, blitz: 125, poorThrows: 54, drops: 12, rzAtt: 41, rating: 103 },
  { rank: 21, player: "C.J. Stroud (HOU)", games: 14, comp: 273, att: 423, pct: 65, yds: 3041, ya: 7.2, airYds: 1817, airPerAtt: 4.3, deep10: 112, deep20: 39, deep30: 15, deep40: 10, deep50: 5, pktTime: 2.4, sacks: 23, knockdowns: 35, hurries: 46, blitz: 132, poorThrows: 71, drops: 9, rzAtt: 48, rating: 94 },
  { rank: 22, player: "Cam Ward (TEN)", games: 17, comp: 323, att: 540, pct: 60, yds: 3169, ya: 5.9, airYds: 1898, airPerAtt: 3.5, deep10: 125, deep20: 40, deep30: 13, deep40: 3, deep50: 0, pktTime: 2.4, sacks: 55, knockdowns: 49, hurries: 67, blitz: 138, poorThrows: 95, drops: 23, rzAtt: 49, rating: 82 },
  { rank: 23, player: "Geno Smith (LV)", games: 15, comp: 302, att: 448, pct: 67, yds: 3025, ya: 6.8, airYds: 1608, airPerAtt: 3.6, deep10: 116, deep20: 33, deep30: 11, deep40: 3, deep50: 2, pktTime: 2.5, sacks: 55, knockdowns: 42, hurries: 22, blitz: 146, poorThrows: 49, drops: 15, rzAtt: 55, rating: 87 },
  { rank: 24, player: "Brock Purdy (SF)", games: 9, comp: 197, att: 284, pct: 69, yds: 2167, ya: 7.6, airYds: 1424, airPerAtt: 5.0, deep10: 97, deep20: 33, deep30: 8, deep40: 1, deep50: 0, pktTime: 2.7, sacks: 11, knockdowns: 28, hurries: 27, blitz: 59, poorThrows: 33, drops: 9, rzAtt: 55, rating: 100 },
  { rank: 25, player: "Tua Tagovailoa (MIA)", games: 14, comp: 260, att: 384, pct: 68, yds: 2660, ya: 6.9, airYds: 1496, airPerAtt: 3.9, deep10: 113, deep20: 33, deep30: 8, deep40: 4, deep50: 0, pktTime: 2.3, sacks: 30, knockdowns: 15, hurries: 48, blitz: 85, poorThrows: 58, drops: 18, rzAtt: 53, rating: 87 },
];

interface RedZoneWRRaw {
  rank: number;
  player: string;
  rec: number;
  tgt: number;
  recPct: number;
  recYds: number;
  yr: number;
  recTd: number;
  tgtPct: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  rushPct: number;
  fl: number;
  games: number;
  fpts: number;
  fptsPerGame: number;
}

interface RedZoneRBRaw {
  rank: number;
  player: string;
  rushAtt: number;
  rushYds: number;
  ya: number;
  rushTd: number;
  rushPct: number;
  rec: number;
  tgt: number;
  recPct: number;
  recYds: number;
  yr: number;
  recTd: number;
  tgtPct: number;
  fl: number;
  games: number;
  fpts: number;
  fptsPerGame: number;
}

interface RedZoneTERaw {
  rank: number;
  player: string;
  rec: number;
  tgt: number;
  recPct: number;
  recYds: number;
  yr: number;
  recTd: number;
  tgtPct: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  rushPct: number;
  fl: number;
  games: number;
  fpts: number;
  fptsPerGame: number;
}

interface AdvancedWRRaw {
  rank: number;
  player: string;
  games: number;
  rec: number;
  yds: number;
  yr: number;
  ybc: number;
  ybcPerR: number;
  air: number;
  airPerR: number;
  yac: number;
  yacPerR: number;
  yacon: number;
  yaconPerR: number;
  brktkl: number;
  tgt: number;
  tgtPctTm: number;
  catchable: number;
  drops: number;
  rzTgt: number;
  tenPlus: number;
  twentyPlus: number;
  thirtyPlus: number;
  fortyPlus: number;
  fiftyPlus: number;
  lng: number;
}

interface AdvancedRBRaw {
  rank: number;
  player: string;
  games: number;
  att: number;
  yds: number;
  yPerAtt: number;
  ybcon: number;
  ybconPerAtt: number;
  yacon: number;
  yaconPerAtt: number;
  brktkl: number;
  tkLoss: number;
  tkLossYds: number;
  lngTd: number;
  tenPlus: number;
  twentyPlus: number;
  thirtyPlus: number;
  fortyPlus: number;
  fiftyPlus: number;
  lng: number;
  rec: number;
  tgt: number;
  rzTgt: number;
  yaconRec: number;
}

interface AdvancedTERaw {
  rank: number;
  player: string;
  games: number;
  rec: number;
  yds: number;
  yr: number;
  ybc: number;
  ybcPerR: number;
  air: number;
  airPerR: number;
  yac: number;
  yacPerR: number;
  yacon: number;
  yaconPerR: number;
  brktkl: number;
  tgt: number;
  tgtPctTm: number;
  catchable: number;
  drops: number;
  rzTgt: number;
  tenPlus: number;
  twentyPlus: number;
  thirtyPlus: number;
  fortyPlus: number;
  fiftyPlus: number;
  lng: number;
}

const RED_ZONE_WR_DATA: RedZoneWRRaw[] = [
  { rank: 1, player: "Deebo Samuel Sr. (WAS)", rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, rushAtt: 1, rushYds: 19, rushTd: 1, rushPct: 100, fl: 0, games: 16, fpts: 7.9, fptsPerGame: 0.5 },
  { rank: 2, player: "Calvin Austin III (PIT)", rec: 1, tgt: 1, recPct: 100, recYds: 18, yr: 18, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 14, fpts: 7.8, fptsPerGame: 0.6 },
  { rank: 3, player: "Jayden Reed (GB)", rec: 1, tgt: 1, recPct: 100, recYds: 17, yr: 17, recTd: 1, tgtPct: 25, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 7, fpts: 7.7, fptsPerGame: 1.1 },
  { rank: 4, player: "Isaac TeSlaa (DET)", rec: 1, tgt: 1, recPct: 100, recYds: 13, yr: 13, recTd: 1, tgtPct: 25, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 7.3, fptsPerGame: 0.4 },
  { rank: 5, player: "Justin Jefferson (MIN)", rec: 1, tgt: 2, recPct: 50, recYds: 13, yr: 13, recTd: 1, tgtPct: 66.7, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 7.3, fptsPerGame: 0.4 },
  { rank: 6, player: "Keenan Allen (LAC)", rec: 1, tgt: 1, recPct: 100, recYds: 11, yr: 11, recTd: 1, tgtPct: 33.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 7.1, fptsPerGame: 0.4 },
  { rank: 7, player: "Keon Coleman (BUF)", rec: 1, tgt: 2, recPct: 50, recYds: 10, yr: 10, recTd: 1, tgtPct: 33.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 13, fpts: 7.0, fptsPerGame: 0.5 },
  { rank: 8, player: "Brian Thomas Jr. (JAC)", rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, rushAtt: 1, rushYds: 9, rushTd: 1, rushPct: 100, fl: 0, games: 14, fpts: 6.9, fptsPerGame: 0.5 },
  { rank: 9, player: "Cedric Tillman (CLE)", rec: 1, tgt: 1, recPct: 100, recYds: 5, yr: 5, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 13, fpts: 6.5, fptsPerGame: 0.5 },
  { rank: 10, player: "Quentin Johnston (LAC)", rec: 1, tgt: 2, recPct: 50, recYds: 5, yr: 5, recTd: 1, tgtPct: 66.7, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 14, fpts: 6.5, fptsPerGame: 0.5 },
  { rank: 11, player: "DeMario Douglas (NE)", rec: 1, tgt: 3, recPct: 33.3, recYds: 2, yr: 2, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 6.2, fptsPerGame: 0.4 },
  { rank: 12, player: "Rome Odunze (CHI)", rec: 1, tgt: 1, recPct: 100, recYds: 1, yr: 1, recTd: 1, tgtPct: 50, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 12, fpts: 6.1, fptsPerGame: 0.5 },
  { rank: 13, player: "Marvin Harrison Jr. (ARI)", rec: 1, tgt: 1, recPct: 100, recYds: 1, yr: 1, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 12, fpts: 6.1, fptsPerGame: 0.5 },
  { rank: 14, player: "Ashton Dulin (IND)", rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, rushAtt: 1, rushYds: 15, rushTd: 0, rushPct: 100, fl: 0, games: 12, fpts: 1.5, fptsPerGame: 0.1 },
  { rank: 15, player: "Khalil Shakir (BUF)", rec: 2, tgt: 2, recPct: 100, recYds: 9, yr: 4.5, recTd: 0, tgtPct: 33.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 0.9, fptsPerGame: 0.1 },
  { rank: 16, player: "Joshua Palmer (BUF)", rec: 1, tgt: 2, recPct: 50, recYds: 8, yr: 8, recTd: 0, tgtPct: 33.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 12, fpts: 0.8, fptsPerGame: 0.1 },
  { rank: 17, player: "Olamide Zaccheaus (CHI)", rec: 1, tgt: 1, recPct: 100, recYds: 7, yr: 7, recTd: 0, tgtPct: 50, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 0.7, fptsPerGame: 0.0 },
  { rank: 18, player: "Jordan Whittington (LAR)", rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, rushAtt: 1, rushYds: 5, rushTd: 0, rushPct: 100, fl: 0, games: 17, fpts: 0.5, fptsPerGame: 0.0 },
  { rank: 19, player: "Courtland Sutton (DEN)", rec: 1, tgt: 1, recPct: 100, recYds: 5, yr: 5, recTd: 0, tgtPct: 50, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 0.5, fptsPerGame: 0.0 },
  { rank: 20, player: "Travis Hunter (JAC)", rec: 1, tgt: 1, recPct: 100, recYds: 4, yr: 4, recTd: 0, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 7, fpts: 0.4, fptsPerGame: 0.1 },
];

const RED_ZONE_RB_DATA: RedZoneRBRaw[] = [
  { rank: 1, player: "Javonte Williams (DAL)", rushAtt: 3, rushYds: 13, ya: 4.3, rushTd: 2, rushPct: 60, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 16, fpts: 13.3, fptsPerGame: 0.8 },
  { rank: 2, player: "J.K. Dobbins (DEN)", rushAtt: 3, rushYds: 20, ya: 6.7, rushTd: 1, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 10, fpts: 8.0, fptsPerGame: 0.8 },
  { rank: 3, player: "Chase Brown (CIN)", rushAtt: 4, rushYds: 20, ya: 5.0, rushTd: 1, rushPct: 100, rec: 0, tgt: 1, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 100, fl: 0, games: 17, fpts: 8.0, fptsPerGame: 0.5 },
  { rank: 4, player: "Jaylen Warren (PIT)", rushAtt: 4, rushYds: 12, ya: 3.0, rushTd: 0, rushPct: 100, rec: 1, tgt: 1, recPct: 100, recYds: 5, yr: 5.0, recTd: 1, tgtPct: 100, fl: 0, games: 16, fpts: 7.7, fptsPerGame: 0.5 },
  { rank: 5, player: "Alvin Kamara (NO)", rushAtt: 2, rushYds: 16, ya: 8.0, rushTd: 1, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 11, fpts: 7.6, fptsPerGame: 0.7 },
  { rank: 6, player: "Saquon Barkley (PHI)", rushAtt: 4, rushYds: 12, ya: 3.0, rushTd: 1, rushPct: 80, rec: 1, tgt: 1, recPct: 100, recYds: 3, yr: 3.0, recTd: 0, tgtPct: 100, fl: 0, games: 16, fpts: 7.5, fptsPerGame: 0.5 },
  { rank: 7, player: "Josh Jacobs (GB)", rushAtt: 5, rushYds: 13, ya: 2.6, rushTd: 1, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 15, fpts: 7.3, fptsPerGame: 0.5 },
  { rank: 8, player: "Jacory Croskey-Merritt (WAS)", rushAtt: 2, rushYds: 12, ya: 6.0, rushTd: 1, rushPct: 50, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 17, fpts: 7.2, fptsPerGame: 0.4 },
  { rank: 9, player: "James Conner (ARI)", rushAtt: 2, rushYds: 7, ya: 3.5, rushTd: 0, rushPct: 50, rec: 1, tgt: 1, recPct: 100, recYds: 4, yr: 4.0, recTd: 1, tgtPct: 100, fl: 0, games: 4, fpts: 7.1, fptsPerGame: 1.8 },
  { rank: 10, player: "De'Von Achane (MIA)", rushAtt: 0, rushYds: 0, ya: 0, rushTd: 0, rushPct: 0, rec: 1, tgt: 1, recPct: 100, recYds: 11, yr: 11.0, recTd: 1, tgtPct: 100, fl: 0, games: 16, fpts: 7.1, fptsPerGame: 0.4 },
  { rank: 11, player: "Bucky Irving (TB)", rushAtt: 1, rushYds: -1, ya: -1.0, rushTd: 0, rushPct: 100, rec: 1, tgt: 1, recPct: 100, recYds: 9, yr: 9.0, recTd: 1, tgtPct: 100, fl: 0, games: 10, fpts: 6.8, fptsPerGame: 0.7 },
  { rank: 12, player: "Zach Charbonnet (SEA)", rushAtt: 4, rushYds: 8, ya: 2.0, rushTd: 1, rushPct: 66.7, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 16, fpts: 6.8, fptsPerGame: 0.4 },
  { rank: 13, player: "Kyren Williams (LAR)", rushAtt: 4, rushYds: 8, ya: 2.0, rushTd: 1, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 17, fpts: 6.8, fptsPerGame: 0.4 },
  { rank: 14, player: "Braelon Allen (NYJ)", rushAtt: 3, rushYds: 7, ya: 2.3, rushTd: 1, rushPct: 50, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 4, fpts: 6.7, fptsPerGame: 1.7 },
  { rank: 15, player: "Ashton Jeanty (LV)", rushAtt: 2, rushYds: 7, ya: 3.5, rushTd: 1, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 17, fpts: 6.7, fptsPerGame: 0.4 },
  { rank: 16, player: "James Cook III (BUF)", rushAtt: 4, rushYds: 4, ya: 1.0, rushTd: 1, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 17, fpts: 6.4, fptsPerGame: 0.4 },
  { rank: 17, player: "Raheim Sanders (CLE)", rushAtt: 2, rushYds: 1, ya: 0.5, rushTd: 1, rushPct: 33.3, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 5, fpts: 6.1, fptsPerGame: 1.2 },
  { rank: 18, player: "Dylan Sampson (CLE)", rushAtt: 2, rushYds: 4, ya: 2.0, rushTd: 0, rushPct: 33.3, rec: 2, tgt: 2, recPct: 100, recYds: 19, yr: 9.5, recTd: 0, tgtPct: 100, fl: 0, games: 15, fpts: 2.3, fptsPerGame: 0.2 },
  { rank: 19, player: "Jonathan Taylor (IND)", rushAtt: 7, rushYds: 20, ya: 2.9, rushTd: 0, rushPct: 77.8, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 17, fpts: 2.0, fptsPerGame: 0.1 },
  { rank: 20, player: "Omarion Hampton (LAC)", rushAtt: 4, rushYds: 17, ya: 4.3, rushTd: 0, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 9, fpts: 1.7, fptsPerGame: 0.2 },
  { rank: 21, player: "Tony Pollard (TEN)", rushAtt: 3, rushYds: 16, ya: 5.3, rushTd: 0, rushPct: 60, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 17, fpts: 1.6, fptsPerGame: 0.1 },
  { rank: 22, player: "Christian McCaffrey (SF)", rushAtt: 8, rushYds: 1, ya: 0.1, rushTd: 0, rushPct: 100, rec: 2, tgt: 3, recPct: 66.7, recYds: 12, yr: 6.0, recTd: 0, tgtPct: 100, fl: 0, games: 17, fpts: 1.3, fptsPerGame: 0.1 },
  { rank: 23, player: "Bijan Robinson (ATL)", rushAtt: 4, rushYds: 11, ya: 2.8, rushTd: 0, rushPct: 66.7, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 17, fpts: 1.1, fptsPerGame: 0.1 },
  { rank: 24, player: "David Montgomery (DET)", rushAtt: 1, rushYds: 3, ya: 3.0, rushTd: 0, rushPct: 33.3, rec: 1, tgt: 1, recPct: 100, recYds: 7, yr: 7.0, recTd: 0, tgtPct: 33.3, fl: 0, games: 17, fpts: 1.0, fptsPerGame: 0.1 },
  { rank: 25, player: "Isiah Pacheco (KC)", rushAtt: 1, rushYds: 10, ya: 10.0, rushTd: 0, rushPct: 100, rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, fl: 0, games: 13, fpts: 1.0, fptsPerGame: 0.1 },
];

const RED_ZONE_TE_DATA: RedZoneTERaw[] = [
  { rank: 1, player: "Dalton Kincaid (BUF)", rec: 1, tgt: 1, recPct: 100, recYds: 15, yr: 15.0, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 12, fpts: 7.5, fptsPerGame: 0.6 },
  { rank: 2, player: "Tucker Kraft (GB)", rec: 1, tgt: 1, recPct: 100, recYds: 15, yr: 15.0, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 8, fpts: 7.5, fptsPerGame: 0.9 },
  { rank: 3, player: "Davis Allen (LAR)", rec: 1, tgt: 1, recPct: 100, recYds: 13, yr: 13.0, recTd: 1, tgtPct: 50, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 20, fpts: 7.3, fptsPerGame: 0.4 },
  { rank: 4, player: "Jake Tonges (SF)", rec: 2, tgt: 2, recPct: 100, recYds: 13, yr: 6.5, recTd: 1, tgtPct: 66.7, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 7.3, fptsPerGame: 0.5 },
  { rank: 5, player: "Zach Ertz (WAS)", rec: 1, tgt: 1, recPct: 100, recYds: 7, yr: 7.0, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 13, fpts: 6.7, fptsPerGame: 0.5 },
  { rank: 6, player: "Hunter Long (JAC)", rec: 1, tgt: 1, recPct: 100, recYds: 6, yr: 6.0, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 9, fpts: 6.6, fptsPerGame: 0.7 },
  { rank: 7, player: "George Kittle (SF)", rec: 1, tgt: 1, recPct: 100, recYds: 5, yr: 5.0, recTd: 1, tgtPct: 33.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 11, fpts: 6.5, fptsPerGame: 0.6 },
  { rank: 8, player: "Jonnu Smith (PIT)", rec: 1, tgt: 1, recPct: 100, recYds: 3, yr: 3.0, recTd: 1, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 6.3, fptsPerGame: 0.4 },
  { rank: 9, player: "Noah Fant (CIN)", rec: 1, tgt: 1, recPct: 100, recYds: 1, yr: 1.0, recTd: 1, tgtPct: 33.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 15, fpts: 6.1, fptsPerGame: 0.4 },
  { rank: 10, player: "Daniel Bellinger (NYG)", rec: 1, tgt: 1, recPct: 100, recYds: 14, yr: 14.0, recTd: 0, tgtPct: 50, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 1.4, fptsPerGame: 0.1 },
  { rank: 11, player: "Austin Hooper (NE)", rec: 1, tgt: 1, recPct: 100, recYds: 10, yr: 10.0, recTd: 0, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 1.0, fptsPerGame: 0.1 },
  { rank: 12, player: "Michael Mayer (LV)", rec: 1, tgt: 1, recPct: 100, recYds: 7, yr: 7.0, recTd: 0, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 13, fpts: 0.7, fptsPerGame: 0.1 },
  { rank: 13, player: "Tyler Warren (IND)", rec: 1, tgt: 2, recPct: 50, recYds: 4, yr: 4.0, recTd: 0, tgtPct: 100, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 0.4, fptsPerGame: 0.0 },
  { rank: 14, player: "Trey McBride (ARI)", rec: 1, tgt: 1, recPct: 100, recYds: 4, yr: 4.0, recTd: 0, tgtPct: 50, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 0.4, fptsPerGame: 0.0 },
  { rank: 15, player: "AJ Barner (SEA)", rec: 0, tgt: 0, recPct: 0, recYds: 0, yr: 0, recTd: 0, tgtPct: 0, rushAtt: 1, rushYds: 2, rushTd: 0, rushPct: 100, fl: 0, games: 17, fpts: 0.2, fptsPerGame: 0.0 },
];

const ADVANCED_WR_DATA: AdvancedWRRaw[] = [
  { rank: 1, player: "Puka Nacua (LAR)", games: 16, rec: 129, yds: 1715, yr: 13.3, ybc: 1049, ybcPerR: 8.1, air: 1541, airPerR: 11.9, yac: 666, yacPerR: 5.2, yacon: 261, yaconPerR: 2.0, brktkl: 11, tgt: 166, tgtPctTm: 28.6, catchable: 133, drops: 4, rzTgt: 16, tenPlus: 70, twentyPlus: 27, thirtyPlus: 12, fortyPlus: 3, fiftyPlus: 2, lng: 58 },
  { rank: 2, player: "Jaxon Smith-Njigba (SEA)", games: 17, rec: 119, yds: 1793, yr: 15.1, ybc: 1265, ybcPerR: 10.6, air: 1831, airPerR: 15.4, yac: 528, yacPerR: 4.4, yacon: 174, yaconPerR: 1.5, brktkl: 3, tgt: 163, tgtPctTm: 35.8, catchable: 126, drops: 5, rzTgt: 17, tenPlus: 76, twentyPlus: 27, thirtyPlus: 12, fortyPlus: 8, fiftyPlus: 4, lng: 63 },
  { rank: 3, player: "Amon-Ra St. Brown (DET)", games: 17, rec: 117, yds: 1401, yr: 12.0, ybc: 831, ybcPerR: 7.1, air: 1359, airPerR: 11.6, yac: 570, yacPerR: 4.9, yacon: 152, yaconPerR: 1.3, brktkl: 4, tgt: 172, tgtPctTm: 31.3, catchable: 128, drops: 10, rzTgt: 34, tenPlus: 56, twentyPlus: 19, thirtyPlus: 7, fortyPlus: 1, fiftyPlus: 1, lng: 52 },
  { rank: 4, player: "George Pickens (DAL)", games: 17, rec: 93, yds: 1429, yr: 15.4, ybc: 950, ybcPerR: 10.2, air: 1545, airPerR: 16.6, yac: 479, yacPerR: 5.2, yacon: 199, yaconPerR: 2.1, brktkl: 6, tgt: 137, tgtPctTm: 22.6, catchable: 97, drops: 4, rzTgt: 21, tenPlus: 62, twentyPlus: 22, thirtyPlus: 9, fortyPlus: 4, fiftyPlus: 0, lng: 45 },
  { rank: 5, player: "Ja'Marr Chase (CIN)", games: 16, rec: 125, yds: 1412, yr: 11.3, ybc: 772, ybcPerR: 6.2, air: 1570, airPerR: 12.6, yac: 640, yacPerR: 5.1, yacon: 225, yaconPerR: 1.8, brktkl: 6, tgt: 185, tgtPctTm: 30.4, catchable: 129, drops: 4, rzTgt: 21, tenPlus: 63, twentyPlus: 15, thirtyPlus: 5, fortyPlus: 2, fiftyPlus: 1, lng: 64 },
  { rank: 6, player: "Chris Olave (NO)", games: 16, rec: 100, yds: 1163, yr: 11.6, ybc: 874, ybcPerR: 8.7, air: 1841, airPerR: 18.4, yac: 289, yacPerR: 2.9, yacon: 47, yaconPerR: 0.5, brktkl: 2, tgt: 156, tgtPctTm: 27.6, catchable: 105, drops: 5, rzTgt: 13, tenPlus: 42, twentyPlus: 11, thirtyPlus: 5, fortyPlus: 4, fiftyPlus: 4, lng: 62 },
  { rank: 7, player: "Davante Adams (LAR)", games: 14, rec: 60, yds: 789, yr: 13.2, ybc: 671, ybcPerR: 11.2, air: 1439, airPerR: 24.0, yac: 118, yacPerR: 2.0, yacon: 27, yaconPerR: 0.5, brktkl: 0, tgt: 114, tgtPctTm: 19.6, catchable: 65, drops: 5, rzTgt: 31, tenPlus: 35, twentyPlus: 14, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 0, lng: 44 },
  { rank: 8, player: "Zay Flowers (BAL)", games: 17, rec: 86, yds: 1211, yr: 14.1, ybc: 753, ybcPerR: 8.8, air: 1205, airPerR: 14.0, yac: 458, yacPerR: 5.3, yacon: 105, yaconPerR: 1.2, brktkl: 9, tgt: 118, tgtPctTm: 29.0, catchable: 93, drops: 7, rzTgt: 10, tenPlus: 43, twentyPlus: 19, thirtyPlus: 10, fortyPlus: 4, fiftyPlus: 3, lng: 64 },
  { rank: 9, player: "Nico Collins (HOU)", games: 15, rec: 71, yds: 1117, yr: 15.7, ybc: 793, ybcPerR: 11.2, air: 1512, airPerR: 21.3, yac: 324, yacPerR: 4.6, yacon: 130, yaconPerR: 1.8, brktkl: 4, tgt: 120, tgtPctTm: 21.7, catchable: 72, drops: 1, rzTgt: 16, tenPlus: 46, twentyPlus: 18, thirtyPlus: 6, fortyPlus: 5, fiftyPlus: 4, lng: 57 },
  { rank: 10, player: "Jameson Williams (DET)", games: 17, rec: 65, yds: 1117, yr: 17.2, ybc: 676, ybcPerR: 10.4, air: 1303, airPerR: 20.0, yac: 441, yacPerR: 6.8, yacon: 140, yaconPerR: 2.2, brktkl: 4, tgt: 102, tgtPctTm: 18.5, catchable: 77, drops: 12, rzTgt: 8, tenPlus: 45, twentyPlus: 23, thirtyPlus: 7, fortyPlus: 5, fiftyPlus: 1, lng: 64 },
  { rank: 11, player: "Tee Higgins (CIN)", games: 15, rec: 59, yds: 846, yr: 14.3, ybc: 680, ybcPerR: 11.5, air: 1286, airPerR: 21.8, yac: 166, yacPerR: 2.8, yacon: 65, yaconPerR: 1.1, brktkl: 5, tgt: 98, tgtPctTm: 16.1, catchable: 61, drops: 2, rzTgt: 14, tenPlus: 34, twentyPlus: 14, thirtyPlus: 5, fortyPlus: 3, fiftyPlus: 0, lng: 44 },
  { rank: 12, player: "Courtland Sutton (DEN)", games: 17, rec: 74, yds: 1017, yr: 13.7, ybc: 795, ybcPerR: 10.7, air: 1543, airPerR: 20.9, yac: 222, yacPerR: 3.0, yacon: 110, yaconPerR: 1.5, brktkl: 3, tgt: 124, tgtPctTm: 21.2, catchable: 82, drops: 8, rzTgt: 17, tenPlus: 41, twentyPlus: 17, thirtyPlus: 7, fortyPlus: 2, fiftyPlus: 1, lng: 52 },
  { rank: 13, player: "Michael Wilson (ARI)", games: 17, rec: 78, yds: 1006, yr: 12.9, ybc: 733, ybcPerR: 9.4, air: 1498, airPerR: 19.2, yac: 273, yacPerR: 3.5, yacon: 126, yaconPerR: 1.6, brktkl: 3, tgt: 126, tgtPctTm: 20.4, catchable: 80, drops: 1, rzTgt: 15, tenPlus: 43, twentyPlus: 14, thirtyPlus: 8, fortyPlus: 2, fiftyPlus: 1, lng: 50 },
  { rank: 14, player: "A.J. Brown (PHI)", games: 15, rec: 78, yds: 1003, yr: 12.9, ybc: 735, ybcPerR: 9.4, air: 1425, airPerR: 18.3, yac: 268, yacPerR: 3.4, yacon: 143, yaconPerR: 1.8, brktkl: 7, tgt: 121, tgtPctTm: 26.1, catchable: 79, drops: 1, rzTgt: 12, tenPlus: 40, twentyPlus: 14, thirtyPlus: 5, fortyPlus: 1, fiftyPlus: 0, lng: 45 },
  { rank: 15, player: "Tetairoa McMillan (CAR)", games: 17, rec: 70, yds: 1014, yr: 14.5, ybc: 745, ybcPerR: 10.6, air: 1426, airPerR: 20.4, yac: 269, yacPerR: 3.8, yacon: 76, yaconPerR: 1.1, brktkl: 2, tgt: 122, tgtPctTm: 25.4, catchable: 78, drops: 8, rzTgt: 15, tenPlus: 47, twentyPlus: 17, thirtyPlus: 4, fortyPlus: 3, fiftyPlus: 0, lng: 43 },
  { rank: 16, player: "Alec Pierce (IND)", games: 15, rec: 47, yds: 1003, yr: 21.3, ybc: 829, ybcPerR: 17.6, air: 1587, airPerR: 33.8, yac: 174, yacPerR: 3.7, yacon: 58, yaconPerR: 1.2, brktkl: 1, tgt: 84, tgtPctTm: 15.8, catchable: 48, drops: 1, rzTgt: 8, tenPlus: 39, twentyPlus: 17, thirtyPlus: 9, fortyPlus: 5, fiftyPlus: 3, lng: 66 },
  { rank: 17, player: "Drake London (ATL)", games: 12, rec: 68, yds: 919, yr: 13.5, ybc: 690, ybcPerR: 10.1, air: 1220, airPerR: 17.9, yac: 229, yacPerR: 3.4, yacon: 74, yaconPerR: 1.1, brktkl: 0, tgt: 112, tgtPctTm: 21.6, catchable: 71, drops: 1, rzTgt: 13, tenPlus: 40, twentyPlus: 13, thirtyPlus: 7, fortyPlus: 3, fiftyPlus: 0, lng: 43 },
  { rank: 18, player: "Emeka Egbuka (TB)", games: 17, rec: 63, yds: 938, yr: 14.9, ybc: 603, ybcPerR: 9.6, air: 1534, airPerR: 24.3, yac: 335, yacPerR: 5.3, yacon: 66, yaconPerR: 1.0, brktkl: 1, tgt: 127, tgtPctTm: 23.5, catchable: 73, drops: 9, rzTgt: 11, tenPlus: 30, twentyPlus: 20, thirtyPlus: 8, fortyPlus: 3, fiftyPlus: 2, lng: 77 },
  { rank: 19, player: "Jaylen Waddle (MIA)", games: 16, rec: 64, yds: 910, yr: 14.2, ybc: 682, ybcPerR: 10.7, air: 1306, airPerR: 20.4, yac: 228, yacPerR: 3.6, yacon: 66, yaconPerR: 1.0, brktkl: 4, tgt: 100, tgtPctTm: 21.6, catchable: 68, drops: 5, rzTgt: 11, tenPlus: 43, twentyPlus: 14, thirtyPlus: 5, fortyPlus: 3, fiftyPlus: 0, lng: 46 },
  { rank: 20, player: "DK Metcalf (PIT)", games: 15, rec: 59, yds: 850, yr: 14.4, ybc: 436, ybcPerR: 7.4, air: 1041, airPerR: 17.6, yac: 414, yacPerR: 7.0, yacon: 180, yaconPerR: 3.1, brktkl: 8, tgt: 99, tgtPctTm: 19.0, catchable: 65, drops: 5, rzTgt: 13, tenPlus: 32, twentyPlus: 15, thirtyPlus: 5, fortyPlus: 3, fiftyPlus: 2, lng: 80 },
];

const ADVANCED_RB_DATA: AdvancedRBRaw[] = [
  { rank: 1, player: "Jonathan Taylor (IND)", games: 17, att: 323, yds: 1585, yPerAtt: 4.9, ybcon: 798, ybconPerAtt: 2.5, yacon: 787, yaconPerAtt: 2.4, brktkl: 27, tkLoss: 28, tkLossYds: -54, lngTd: 83, tenPlus: 36, twentyPlus: 9, thirtyPlus: 5, fortyPlus: 4, fiftyPlus: 3, lng: 83, rec: 46, tgt: 55, rzTgt: 4, yaconRec: 103 },
  { rank: 2, player: "Christian McCaffrey (SF)", games: 17, att: 311, yds: 1202, yPerAtt: 3.9, ybcon: 728, ybconPerAtt: 2.3, yacon: 474, yaconPerAtt: 1.5, brktkl: 10, tkLoss: 30, tkLossYds: -73, lngTd: 12, tenPlus: 27, twentyPlus: 3, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 41, rec: 102, tgt: 129, rzTgt: 25, yaconRec: 212 },
  { rank: 3, player: "Bijan Robinson (ATL)", games: 17, att: 287, yds: 1478, yPerAtt: 5.1, ybcon: 812, ybconPerAtt: 2.8, yacon: 666, yaconPerAtt: 2.3, brktkl: 22, tkLoss: 26, tkLossYds: -64, lngTd: 93, tenPlus: 36, twentyPlus: 8, thirtyPlus: 4, fortyPlus: 2, fiftyPlus: 2, lng: 93, rec: 79, tgt: 103, rzTgt: 12, yaconRec: 209 },
  { rank: 4, player: "Jahmyr Gibbs (DET)", games: 17, att: 243, yds: 1223, yPerAtt: 5.0, ybcon: 819, ybconPerAtt: 3.4, yacon: 404, yaconPerAtt: 1.7, brktkl: 18, tkLoss: 27, tkLossYds: -81, lngTd: 78, tenPlus: 27, twentyPlus: 10, thirtyPlus: 6, fortyPlus: 6, fiftyPlus: 2, lng: 78, rec: 77, tgt: 94, rzTgt: 12, yaconRec: 77 },
  { rank: 5, player: "James Cook III (BUF)", games: 17, att: 309, yds: 1621, yPerAtt: 5.2, ybcon: 935, ybconPerAtt: 3.0, yacon: 686, yaconPerAtt: 2.2, brktkl: 21, tkLoss: 14, tkLossYds: -35, lngTd: 64, tenPlus: 39, twentyPlus: 9, thirtyPlus: 5, fortyPlus: 4, fiftyPlus: 1, lng: 64, rec: 33, tgt: 40, rzTgt: 3, yaconRec: 98 },
  { rank: 6, player: "Derrick Henry (BAL)", games: 17, att: 307, yds: 1595, yPerAtt: 5.2, ybcon: 866, ybconPerAtt: 2.8, yacon: 729, yaconPerAtt: 2.4, brktkl: 13, tkLoss: 22, tkLossYds: -49, lngTd: 46, tenPlus: 36, twentyPlus: 17, thirtyPlus: 7, fortyPlus: 4, fiftyPlus: 1, lng: 59, rec: 15, tgt: 21, rzTgt: 2, yaconRec: 57 },
  { rank: 7, player: "De'Von Achane (MIA)", games: 16, att: 238, yds: 1350, yPerAtt: 5.7, ybcon: 631, ybconPerAtt: 2.7, yacon: 719, yaconPerAtt: 3.0, brktkl: 22, tkLoss: 23, tkLossYds: -54, lngTd: 59, tenPlus: 40, twentyPlus: 13, thirtyPlus: 6, fortyPlus: 4, fiftyPlus: 1, lng: 59, rec: 67, tgt: 85, rzTgt: 9, yaconRec: 108 },
  { rank: 8, player: "Kyren Williams (LAR)", games: 17, att: 259, yds: 1252, yPerAtt: 4.8, ybcon: 737, ybconPerAtt: 2.8, yacon: 515, yaconPerAtt: 2.0, brktkl: 22, tkLoss: 12, tkLossYds: -31, lngTd: 7, tenPlus: 26, twentyPlus: 6, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 34, rec: 36, tgt: 50, rzTgt: 9, yaconRec: 35 },
  { rank: 9, player: "Travis Etienne Jr. (JAC)", games: 17, att: 260, yds: 1107, yPerAtt: 4.3, ybcon: 562, ybconPerAtt: 2.2, yacon: 545, yaconPerAtt: 2.1, brktkl: 10, tkLoss: 26, tkLossYds: -60, lngTd: 48, tenPlus: 26, twentyPlus: 7, thirtyPlus: 4, fortyPlus: 3, fiftyPlus: 1, lng: 71, rec: 36, tgt: 52, rzTgt: 9, yaconRec: 121 },
  { rank: 10, player: "Chase Brown (CIN)", games: 17, att: 232, yds: 1019, yPerAtt: 4.4, ybcon: 525, ybconPerAtt: 2.3, yacon: 494, yaconPerAtt: 2.1, brktkl: 16, tkLoss: 16, tkLossYds: -36, lngTd: 12, tenPlus: 24, twentyPlus: 6, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 37, rec: 69, tgt: 88, rzTgt: 11, yaconRec: 124 },
  { rank: 11, player: "Javonte Williams (DAL)", games: 16, att: 252, yds: 1201, yPerAtt: 4.8, ybcon: 574, ybconPerAtt: 2.3, yacon: 627, yaconPerAtt: 2.5, brktkl: 25, tkLoss: 13, tkLossYds: -27, lngTd: 30, tenPlus: 26, twentyPlus: 6, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 1, lng: 66, rec: 35, tgt: 51, rzTgt: 12, yaconRec: 46 },
  { rank: 12, player: "Josh Jacobs (GB)", games: 15, att: 234, yds: 929, yPerAtt: 4.0, ybcon: 459, ybconPerAtt: 2.0, yacon: 470, yaconPerAtt: 2.0, brktkl: 16, tkLoss: 19, tkLossYds: -37, lngTd: 40, tenPlus: 23, twentyPlus: 3, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 40, rec: 36, tgt: 44, rzTgt: 6, yaconRec: 101 },
  { rank: 13, player: "Saquon Barkley (PHI)", games: 16, att: 280, yds: 1140, yPerAtt: 4.1, ybcon: 689, ybconPerAtt: 2.5, yacon: 451, yaconPerAtt: 1.6, brktkl: 18, tkLoss: 41, tkLossYds: -104, lngTd: 65, tenPlus: 28, twentyPlus: 4, thirtyPlus: 3, fortyPlus: 3, fiftyPlus: 2, lng: 65, rec: 37, tgt: 50, rzTgt: 6, yaconRec: 78 },
  { rank: 14, player: "D'Andre Swift (CHI)", games: 16, att: 223, yds: 1087, yPerAtt: 4.9, ybcon: 666, ybconPerAtt: 3.0, yacon: 421, yaconPerAtt: 1.9, brktkl: 11, tkLoss: 14, tkLossYds: -32, lngTd: 22, tenPlus: 30, twentyPlus: 5, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 25, rec: 34, tgt: 48, rzTgt: 1, yaconRec: 65 },
  { rank: 15, player: "Ashton Jeanty (LV)", games: 17, att: 266, yds: 975, yPerAtt: 3.7, ybcon: 419, ybconPerAtt: 1.6, yacon: 556, yaconPerAtt: 2.1, brktkl: 24, tkLoss: 45, tkLossYds: -82, lngTd: 64, tenPlus: 24, twentyPlus: 3, thirtyPlus: 2, fortyPlus: 2, fiftyPlus: 2, lng: 64, rec: 55, tgt: 73, rzTgt: 10, yaconRec: 148 },
  { rank: 16, player: "Rico Dowdle (CAR)", games: 17, att: 236, yds: 1076, yPerAtt: 4.6, ybcon: 596, ybconPerAtt: 2.5, yacon: 480, yaconPerAtt: 2.0, brktkl: 14, tkLoss: 16, tkLossYds: -29, lngTd: 5, tenPlus: 24, twentyPlus: 5, thirtyPlus: 2, fortyPlus: 2, fiftyPlus: 1, lng: 53, rec: 39, tgt: 50, rzTgt: 4, yaconRec: 66 },
  { rank: 17, player: "Jaylen Warren (PIT)", games: 16, att: 211, yds: 958, yPerAtt: 4.5, ybcon: 461, ybconPerAtt: 2.2, yacon: 497, yaconPerAtt: 2.4, brktkl: 23, tkLoss: 17, tkLossYds: -31, lngTd: 45, tenPlus: 23, twentyPlus: 6, thirtyPlus: 4, fortyPlus: 2, fiftyPlus: 0, lng: 45, rec: 40, tgt: 45, rzTgt: 5, yaconRec: 179 },
  { rank: 18, player: "Breece Hall (NYJ)", games: 16, att: 243, yds: 1065, yPerAtt: 4.4, ybcon: 618, ybconPerAtt: 2.5, yacon: 447, yaconPerAtt: 1.8, brktkl: 12, tkLoss: 33, tkLossYds: -88, lngTd: 59, tenPlus: 26, twentyPlus: 8, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 1, lng: 59, rec: 36, tgt: 48, rzTgt: 8, yaconRec: 96 },
  { rank: 19, player: "TreVeyon Henderson (NE)", games: 17, att: 180, yds: 911, yPerAtt: 5.1, ybcon: 549, ybconPerAtt: 3.1, yacon: 362, yaconPerAtt: 2.0, brktkl: 11, tkLoss: 19, tkLossYds: -46, lngTd: 69, tenPlus: 18, twentyPlus: 6, thirtyPlus: 4, fortyPlus: 4, fiftyPlus: 4, lng: 69, rec: 35, tgt: 42, rzTgt: 4, yaconRec: 46 },
  { rank: 20, player: "Zach Charbonnet (SEA)", games: 16, att: 184, yds: 730, yPerAtt: 4.0, ybcon: 393, ybconPerAtt: 2.1, yacon: 337, yaconPerAtt: 1.8, brktkl: 14, tkLoss: 20, tkLossYds: -45, lngTd: 27, tenPlus: 12, twentyPlus: 5, thirtyPlus: 1, fortyPlus: 0, fiftyPlus: 0, lng: 30, rec: 20, tgt: 24, rzTgt: 3, yaconRec: 32 },
  { rank: 21, player: "Kenneth Walker III (SEA)", games: 17, att: 221, yds: 1027, yPerAtt: 4.6, ybcon: 621, ybconPerAtt: 2.8, yacon: 406, yaconPerAtt: 1.8, brktkl: 23, tkLoss: 26, tkLossYds: -57, lngTd: 55, tenPlus: 33, twentyPlus: 10, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 1, lng: 55, rec: 31, tgt: 36, rzTgt: 3, yaconRec: 67 },
  { rank: 22, player: "Tony Pollard (TEN)", games: 17, att: 242, yds: 1082, yPerAtt: 4.5, ybcon: 640, ybconPerAtt: 2.6, yacon: 442, yaconPerAtt: 1.8, brktkl: 16, tkLoss: 18, tkLossYds: -30, lngTd: 65, tenPlus: 27, twentyPlus: 6, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 1, lng: 65, rec: 33, tgt: 41, rzTgt: 1, yaconRec: 62 },
  { rank: 23, player: "Alvin Kamara (NO)", games: 11, att: 131, yds: 471, yPerAtt: 3.6, ybcon: 282, ybconPerAtt: 2.2, yacon: 189, yaconPerAtt: 1.4, brktkl: 7, tkLoss: 16, tkLossYds: -27, lngTd: 18, tenPlus: 10, twentyPlus: 0, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 18, rec: 33, tgt: 39, rzTgt: 5, yaconRec: 23 },
  { rank: 24, player: "David Montgomery (DET)", games: 17, att: 158, yds: 716, yPerAtt: 4.5, ybcon: 370, ybconPerAtt: 2.3, yacon: 346, yaconPerAtt: 2.2, brktkl: 3, tkLoss: 14, tkLossYds: -26, lngTd: 35, tenPlus: 15, twentyPlus: 3, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 1, lng: 72, rec: 24, tgt: 29, rzTgt: 2, yaconRec: 49 },
  { rank: 25, player: "Jacory Croskey-Merritt (WAS)", games: 17, att: 175, yds: 805, yPerAtt: 4.6, ybcon: 443, ybconPerAtt: 2.5, yacon: 362, yaconPerAtt: 2.1, brktkl: 13, tkLoss: 17, tkLossYds: -35, lngTd: 72, tenPlus: 21, twentyPlus: 3, thirtyPlus: 2, fortyPlus: 2, fiftyPlus: 1, lng: 72, rec: 9, tgt: 13, rzTgt: 1, yaconRec: 8 },
];

const ADVANCED_TE_DATA: AdvancedTERaw[] = [
  { rank: 1, player: "Trey McBride (ARI)", games: 17, rec: 126, yds: 1239, yr: 9.8, ybc: 656, ybcPerR: 5.2, air: 1147, airPerR: 9.1, yac: 583, yacPerR: 4.6, yacon: 167, yaconPerR: 1.3, brktkl: 9, tgt: 169, tgtPctTm: 27.4, catchable: 128, drops: 2, rzTgt: 32, tenPlus: 51, twentyPlus: 12, thirtyPlus: 1, fortyPlus: 0, fiftyPlus: 0, lng: 31 },
  { rank: 2, player: "Dallas Goedert (PHI)", games: 15, rec: 60, yds: 591, yr: 9.9, ybc: 357, ybcPerR: 6.0, air: 583, airPerR: 9.7, yac: 234, yacPerR: 3.9, yacon: 59, yaconPerR: 1.0, brktkl: 3, tgt: 82, tgtPctTm: 17.7, catchable: 64, drops: 4, rzTgt: 15, tenPlus: 22, twentyPlus: 7, thirtyPlus: 3, fortyPlus: 0, fiftyPlus: 0, lng: 36 },
  { rank: 3, player: "Kyle Pitts Sr. (ATL)", games: 17, rec: 88, yds: 928, yr: 10.5, ybc: 528, ybcPerR: 6.0, air: 871, airPerR: 9.9, yac: 400, yacPerR: 4.5, yacon: 90, yaconPerR: 1.0, brktkl: 2, tgt: 118, tgtPctTm: 22.7, catchable: 91, drops: 2, rzTgt: 11, tenPlus: 43, twentyPlus: 12, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 36 },
  { rank: 4, player: "Hunter Henry (NE)", games: 17, rec: 60, yds: 768, yr: 12.8, ybc: 433, ybcPerR: 7.2, air: 692, airPerR: 11.5, yac: 335, yacPerR: 5.6, yacon: 64, yaconPerR: 1.1, brktkl: 1, tgt: 87, tgtPctTm: 18.0, catchable: 63, drops: 3, rzTgt: 22, tenPlus: 36, twentyPlus: 11, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 36 },
  { rank: 5, player: "Travis Kelce (KC)", games: 17, rec: 76, yds: 851, yr: 11.2, ybc: 430, ybcPerR: 5.7, air: 734, airPerR: 9.7, yac: 421, yacPerR: 5.5, yacon: 134, yaconPerR: 1.8, brktkl: 1, tgt: 108, tgtPctTm: 19.7, catchable: 83, drops: 7, rzTgt: 11, tenPlus: 40, twentyPlus: 9, thirtyPlus: 4, fortyPlus: 1, fiftyPlus: 0, lng: 44 },
  { rank: 6, player: "Harold Fannin Jr. (CLE)", games: 16, rec: 72, yds: 731, yr: 10.2, ybc: 379, ybcPerR: 5.3, air: 659, airPerR: 9.2, yac: 352, yacPerR: 4.9, yacon: 154, yaconPerR: 2.1, brktkl: 7, tgt: 107, tgtPctTm: 20.5, catchable: 76, drops: 4, rzTgt: 10, tenPlus: 30, twentyPlus: 8, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 35 },
  { rank: 7, player: "Tyler Warren (IND)", games: 17, rec: 76, yds: 817, yr: 10.8, ybc: 343, ybcPerR: 4.5, air: 610, airPerR: 8.0, yac: 474, yacPerR: 6.2, yacon: 118, yaconPerR: 1.6, brktkl: 4, tgt: 112, tgtPctTm: 21.1, catchable: 78, drops: 2, rzTgt: 19, tenPlus: 33, twentyPlus: 10, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 41 },
  { rank: 8, player: "Brock Bowers (LV)", games: 12, rec: 64, yds: 680, yr: 10.6, ybc: 375, ybcPerR: 5.9, air: 560, airPerR: 8.8, yac: 305, yacPerR: 4.8, yacon: 83, yaconPerR: 1.3, brktkl: 3, tgt: 86, tgtPctTm: 17.4, catchable: 68, drops: 4, rzTgt: 16, tenPlus: 24, twentyPlus: 8, thirtyPlus: 3, fortyPlus: 0, fiftyPlus: 0, lng: 38 },
  { rank: 9, player: "Colston Loveland (CHI)", games: 16, rec: 58, yds: 713, yr: 12.3, ybc: 463, ybcPerR: 8.0, air: 741, airPerR: 12.8, yac: 250, yacPerR: 4.3, yacon: 99, yaconPerR: 1.7, brktkl: 4, tgt: 82, tgtPctTm: 15.4, catchable: 61, drops: 1, rzTgt: 14, tenPlus: 28, twentyPlus: 10, thirtyPlus: 5, fortyPlus: 1, fiftyPlus: 1, lng: 58 },
  { rank: 10, player: "Jake Ferguson (DAL)", games: 17, rec: 82, yds: 600, yr: 7.3, ybc: 293, ybcPerR: 3.6, air: 476, airPerR: 5.8, yac: 307, yacPerR: 3.7, yacon: 78, yaconPerR: 1.0, brktkl: 6, tgt: 102, tgtPctTm: 16.8, catchable: 84, drops: 2, rzTgt: 23, tenPlus: 23, twentyPlus: 2, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 26 },
  { rank: 11, player: "George Kittle (SF)", games: 11, rec: 57, yds: 628, yr: 11.0, ybc: 376, ybcPerR: 6.6, air: 459, airPerR: 8.1, yac: 252, yacPerR: 4.4, yacon: 75, yaconPerR: 1.3, brktkl: 2, tgt: 69, tgtPctTm: 12.5, catchable: 58, drops: 1, rzTgt: 12, tenPlus: 30, twentyPlus: 9, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 33 },
  { rank: 12, player: "Juwan Johnson (NO)", games: 17, rec: 77, yds: 889, yr: 11.5, ybc: 527, ybcPerR: 6.8, air: 769, airPerR: 10.0, yac: 362, yacPerR: 4.7, yacon: 94, yaconPerR: 1.2, brktkl: 5, tgt: 102, tgtPctTm: 18.1, catchable: 83, drops: 6, rzTgt: 8, tenPlus: 38, twentyPlus: 11, thirtyPlus: 5, fortyPlus: 1, fiftyPlus: 1, lng: 52 },
  { rank: 13, player: "Dalton Schultz (HOU)", games: 17, rec: 82, yds: 777, yr: 9.5, ybc: 419, ybcPerR: 5.1, air: 659, airPerR: 8.0, yac: 358, yacPerR: 4.4, yacon: 75, yaconPerR: 0.9, brktkl: 3, tgt: 106, tgtPctTm: 19.2, catchable: 85, drops: 2, rzTgt: 11, tenPlus: 31, twentyPlus: 5, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 0, lng: 47 },
  { rank: 14, player: "AJ Barner (SEA)", games: 17, rec: 52, yds: 519, yr: 10.0, ybc: 248, ybcPerR: 4.8, air: 303, airPerR: 5.8, yac: 271, yacPerR: 5.2, yacon: 69, yaconPerR: 1.3, brktkl: 3, tgt: 68, tgtPctTm: 14.9, catchable: 54, drops: 2, rzTgt: 12, tenPlus: 20, twentyPlus: 3, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 1, lng: 61 },
  { rank: 15, player: "Dalton Kincaid (BUF)", games: 12, rec: 39, yds: 571, yr: 14.6, ybc: 312, ybcPerR: 8.0, air: 465, airPerR: 11.9, yac: 259, yacPerR: 6.6, yacon: 62, yaconPerR: 1.6, brktkl: 1, tgt: 49, tgtPctTm: 10.2, catchable: 40, drops: 1, rzTgt: 6, tenPlus: 26, twentyPlus: 13, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 47 },
];

function toStatLeader(player: string, value: number, games: number, position: string = 'QB'): StatLeader {
  const { name, team } = parsePlayerTeam(player);
  return {
    player_id: name.toLowerCase().replace(/\s+/g, '_'),
    player_name: name,
    team,
    position,
    value,
    games_played: games,
  };
}

function topNFromData<T>(
  data: T[],
  valueFn: (item: T) => number,
  playerFn: (item: T) => string,
  gamesFn: (item: T) => number,
  n: number = 10,
  filterZero: boolean = true,
  position: string = 'QB',
): StatLeader[] {
  return data
    .map(item => toStatLeader(playerFn(item), valueFn(item), gamesFn(item), position))
    .filter(l => !filterZero || l.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function mergeLeaders(...sources: StatLeader[][]): StatLeader[] {
  return sources.flat().sort((a, b) => b.value - a.value).slice(0, 10);
}

export function getRedZoneQBLeaders(): Record<string, StatLeader[]> {
  const d = RED_ZONE_QB_DATA;
  const p = (item: RedZoneQBRaw) => item.player;
  const g = (item: RedZoneQBRaw) => item.games;

  return {
    rz_total_td: topNFromData(d, i => i.passTd + i.rushTd, p, g),
    rz_pass_td: topNFromData(d, i => i.passTd, p, g),
    rz_rush_td: topNFromData(d, i => i.rushTd, p, g),
    rz_fpts_per_game: topNFromData(d, i => i.fptsPerGame, p, g),
    rz_fpts: topNFromData(d, i => i.fpts, p, g),
    rz_att: topNFromData(d, i => i.att + i.rushAtt, p, g),
    rz_comp_pct: topNFromData(d, i => i.att >= 3 ? i.pct : 0, p, g),
  };
}

export function getRedZoneWRLeaders(): Record<string, StatLeader[]> {
  const d = RED_ZONE_WR_DATA;
  const p = (item: RedZoneWRRaw) => item.player;
  const g = (item: RedZoneWRRaw) => item.games;
  const pos = 'WR';

  return {
    rz_wr_td: topNFromData(d, i => i.recTd + i.rushTd, p, g, 10, true, pos),
    rz_wr_tgt: topNFromData(d, i => i.tgt, p, g, 10, true, pos),
    rz_wr_rec: topNFromData(d, i => i.rec, p, g, 10, true, pos),
    rz_wr_yds: topNFromData(d, i => i.recYds + i.rushYds, p, g, 10, true, pos),
    rz_wr_fpts: topNFromData(d, i => i.fpts, p, g, 10, true, pos),
    rz_wr_fpts_per_game: topNFromData(d, i => i.fptsPerGame, p, g, 10, true, pos),
  };
}

export function getRedZoneRBLeaders(): Record<string, StatLeader[]> {
  const d = RED_ZONE_RB_DATA;
  const p = (item: RedZoneRBRaw) => item.player;
  const g = (item: RedZoneRBRaw) => item.games;
  const pos = 'RB';

  return {
    rz_rb_td: topNFromData(d, i => i.rushTd + i.recTd, p, g, 10, true, pos),
    rz_rb_att: topNFromData(d, i => i.rushAtt, p, g, 10, true, pos),
    rz_rb_rush_yds: topNFromData(d, i => i.rushYds, p, g, 10, false, pos),
    rz_rb_ya: topNFromData(d, i => i.rushAtt >= 2 ? i.ya : 0, p, g, 10, true, pos),
    rz_rb_fpts: topNFromData(d, i => i.fpts, p, g, 10, true, pos),
    rz_rb_fpts_per_game: topNFromData(d, i => i.fptsPerGame, p, g, 10, true, pos),
  };
}

export function getRedZoneTELeaders(): Record<string, StatLeader[]> {
  const d = RED_ZONE_TE_DATA;
  const p = (item: RedZoneTERaw) => item.player;
  const g = (item: RedZoneTERaw) => item.games;
  const pos = 'TE';

  return {
    rz_te_td: topNFromData(d, i => i.recTd + i.rushTd, p, g, 10, true, pos),
    rz_te_tgt: topNFromData(d, i => i.tgt, p, g, 10, true, pos),
    rz_te_rec: topNFromData(d, i => i.rec, p, g, 10, true, pos),
    rz_te_yds: topNFromData(d, i => i.recYds, p, g, 10, true, pos),
    rz_te_fpts: topNFromData(d, i => i.fpts, p, g, 10, true, pos),
    rz_te_fpts_per_game: topNFromData(d, i => i.fptsPerGame, p, g, 10, true, pos),
  };
}

export function getAdvancedWRLeaders(): Record<string, StatLeader[]> {
  const d = ADVANCED_WR_DATA;
  const p = (item: AdvancedWRRaw) => item.player;
  const g = (item: AdvancedWRRaw) => item.games;
  const pos = 'WR';

  return {
    adv_wr_yds: topNFromData(d, i => i.yds, p, g, 10, true, pos),
    adv_wr_yac: topNFromData(d, i => i.yac, p, g, 10, true, pos),
    adv_wr_yac_per_r: topNFromData(d, i => i.yacPerR, p, g, 10, true, pos),
    adv_wr_air: topNFromData(d, i => i.air, p, g, 10, true, pos),
    adv_wr_air_per_r: topNFromData(d, i => i.airPerR, p, g, 10, true, pos),
    adv_wr_tgt_share: topNFromData(d, i => i.tgtPctTm, p, g, 10, true, pos),
    adv_wr_drops: topNFromData(d, i => i.drops, p, g, 10, true, pos),
    adv_wr_brktkl: topNFromData(d, i => i.brktkl, p, g, 10, true, pos),
    adv_wr_rz_tgt: topNFromData(d, i => i.rzTgt, p, g, 10, true, pos),
    adv_wr_deep_20plus: topNFromData(d, i => i.twentyPlus, p, g, 10, true, pos),
  };
}

export function getAdvancedRBLeaders(): Record<string, StatLeader[]> {
  const d = ADVANCED_RB_DATA;
  const p = (item: AdvancedRBRaw) => item.player;
  const g = (item: AdvancedRBRaw) => item.games;
  const pos = 'RB';

  return {
    adv_rb_yds: topNFromData(d, i => i.yds, p, g, 10, true, pos),
    adv_rb_ypc: topNFromData(d, i => i.yPerAtt, p, g, 10, true, pos),
    adv_rb_yacon: topNFromData(d, i => i.yacon, p, g, 10, true, pos),
    adv_rb_yacon_per_att: topNFromData(d, i => i.yaconPerAtt, p, g, 10, true, pos),
    adv_rb_brktkl: topNFromData(d, i => i.brktkl, p, g, 10, true, pos),
    adv_rb_att: topNFromData(d, i => i.att, p, g, 10, true, pos),
    adv_rb_rz_tgt: topNFromData(d, i => i.rzTgt, p, g, 10, true, pos),
    adv_rb_deep_20plus: topNFromData(d, i => i.twentyPlus, p, g, 10, true, pos),
    adv_rb_lng: topNFromData(d, i => i.lng, p, g, 10, true, pos),
    adv_rb_rec: topNFromData(d, i => i.rec, p, g, 10, true, pos),
  };
}

export function getAdvancedTELeaders(): Record<string, StatLeader[]> {
  const d = ADVANCED_TE_DATA;
  const p = (item: AdvancedTERaw) => item.player;
  const g = (item: AdvancedTERaw) => item.games;
  const pos = 'TE';

  return {
    adv_te_yds: topNFromData(d, i => i.yds, p, g, 10, true, pos),
    adv_te_yac: topNFromData(d, i => i.yac, p, g, 10, true, pos),
    adv_te_yac_per_r: topNFromData(d, i => i.yacPerR, p, g, 10, true, pos),
    adv_te_tgt_share: topNFromData(d, i => i.tgtPctTm, p, g, 10, true, pos),
    adv_te_drops: topNFromData(d, i => i.drops, p, g, 10, true, pos),
    adv_te_brktkl: topNFromData(d, i => i.brktkl, p, g, 10, true, pos),
    adv_te_rz_tgt: topNFromData(d, i => i.rzTgt, p, g, 10, true, pos),
    adv_te_rec: topNFromData(d, i => i.rec, p, g, 10, true, pos),
  };
}

export function getAdvancedQBLeaders(): Record<string, StatLeader[]> {
  const d = ADVANCED_QB_DATA;
  const p = (item: AdvancedQBRaw) => item.player;
  const g = (item: AdvancedQBRaw) => item.games;

  return {
    adv_passing_yds: topNFromData(d, i => i.yds, p, g),
    adv_passer_rating: topNFromData(d, i => i.rating, p, g),
    adv_air_yds: topNFromData(d, i => i.airYds, p, g),
    adv_air_per_att: topNFromData(d, i => i.airPerAtt, p, g),
    adv_deep_20plus: topNFromData(d, i => i.deep20, p, g),
    adv_deep_30plus: topNFromData(d, i => i.deep30, p, g),
    adv_comp_pct: topNFromData(d, i => i.pct, p, g),
    adv_ya: topNFromData(d, i => i.ya, p, g),
    adv_sacks: topNFromData(d, i => i.sacks, p, g),
    adv_knockdowns: topNFromData(d, i => i.knockdowns, p, g),
    adv_hurries: topNFromData(d, i => i.hurries, p, g),
    adv_poor_throws: topNFromData(d, i => i.poorThrows, p, g),
    adv_drops: topNFromData(d, i => i.drops, p, g),
    adv_pkt_time: topNFromData(d, i => i.pktTime, p, g),
    adv_rz_att: topNFromData(d, i => i.rzAtt, p, g),
  };
}
