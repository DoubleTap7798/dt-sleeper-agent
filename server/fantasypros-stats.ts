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
