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
  { rank: 1, player: "Josh Allen (BUF)", comp: 53, att: 92, pct: 57.6, yds: 350, ya: 3.8, passTd: 20, int: 3, sacks: 6, rushAtt: 34, rushYds: 113, rushTd: 15, rushPct: 44.1, fl: 0, games: 18, fpts: 189.3, fptsPerGame: 10.5 },
  { rank: 2, player: "Trevor Lawrence (JAX)", comp: 57, att: 99, pct: 57.6, yds: 363, ya: 3.7, passTd: 26, int: 4, sacks: 3, rushAtt: 27, rushYds: 97, rushTd: 9, rushPct: 33.3, fl: 1, games: 18, fpts: 172.2, fptsPerGame: 9.6 },
  { rank: 3, player: "Matthew Stafford (LA)", comp: 79, att: 131, pct: 60.3, yds: 517, ya: 3.9, passTd: 38, int: 2, sacks: 3, rushAtt: 4, rushYds: 7, rushTd: 0, rushPct: 0, fl: 0, games: 20, fpts: 169.4, fptsPerGame: 8.5 },
  { rank: 4, player: "Drake Maye (NE)", comp: 51, att: 94, pct: 54.3, yds: 354, ya: 3.8, passTd: 22, int: 3, sacks: 12, rushAtt: 21, rushYds: 82, rushTd: 5, rushPct: 23.8, fl: 0, games: 21, fpts: 134.4, fptsPerGame: 6.4 },
  { rank: 5, player: "Jalen Hurts (PHI)", comp: 40, att: 60, pct: 66.7, yds: 249, ya: 4.2, passTd: 17, int: 2, sacks: 3, rushAtt: 27, rushYds: 69, rushTd: 8, rushPct: 29.6, fl: 1, games: 17, fpts: 126.9, fptsPerGame: 7.5 },
  { rank: 6, player: "Bo Nix (DEN)", comp: 55, att: 99, pct: 55.6, yds: 375, ya: 3.8, passTd: 18, int: 1, sacks: 3, rushAtt: 18, rushYds: 82, rushTd: 5, rushPct: 27.8, fl: 0, games: 18, fpts: 123.2, fptsPerGame: 6.8 },
  { rank: 7, player: "Patrick Mahomes (KC)", comp: 46, att: 93, pct: 49.5, yds: 284, ya: 3.1, passTd: 18, int: 3, sacks: 3, rushAtt: 15, rushYds: 98, rushTd: 5, rushPct: 33.3, fl: 0, games: 14, fpts: 117.2, fptsPerGame: 8.4 },
  { rank: 8, player: "Jared Goff (DET)", comp: 53, att: 99, pct: 53.5, yds: 420, ya: 4.2, passTd: 25, int: 2, sacks: 5, rushAtt: 1, rushYds: 2, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 113, fptsPerGame: 6.6 },
  { rank: 9, player: "Daniel Jones (IND)", comp: 34, att: 65, pct: 52.3, yds: 226, ya: 3.5, passTd: 16, int: 0, sacks: 4, rushAtt: 16, rushYds: 30, rushTd: 5, rushPct: 31.3, fl: 0, games: 13, fpts: 106, fptsPerGame: 8.2 },
  { rank: 10, player: "Dak Prescott (DAL)", comp: 57, att: 110, pct: 51.8, yds: 346, ya: 3.1, passTd: 21, int: 3, sacks: 6, rushAtt: 8, rushYds: 21, rushTd: 2, rushPct: 25, fl: 0, games: 17, fpts: 105.9, fptsPerGame: 6.2 },
  { rank: 11, player: "Brock Purdy (SF)", comp: 37, att: 65, pct: 56.9, yds: 236, ya: 3.6, passTd: 18, int: 1, sacks: 1, rushAtt: 7, rushYds: 37, rushTd: 3, rushPct: 42.9, fl: 0, games: 11, fpts: 101.1, fptsPerGame: 9.2 },
  { rank: 12, player: "Justin Herbert (LAC)", comp: 44, att: 91, pct: 48.4, yds: 300, ya: 3.3, passTd: 20, int: 4, sacks: 7, rushAtt: 15, rushYds: 41, rushTd: 2, rushPct: 13.3, fl: 0, games: 17, fpts: 100.1, fptsPerGame: 5.9 },
  { rank: 13, player: "Jaxson Dart (NYG)", comp: 20, att: 55, pct: 36.4, yds: 175, ya: 3.2, passTd: 9, int: 0, sacks: 7, rushAtt: 22, rushYds: 86, rushTd: 8, rushPct: 36.4, fl: 0, games: 14, fpts: 99.6, fptsPerGame: 7.1 },
  { rank: 14, player: "Caleb Williams (CHI)", comp: 44, att: 96, pct: 45.8, yds: 229, ya: 2.4, passTd: 17, int: 3, sacks: 5, rushAtt: 18, rushYds: 73, rushTd: 3, rushPct: 16.7, fl: 0, games: 19, fpts: 96.5, fptsPerGame: 5.1 },
  { rank: 15, player: "Jacoby Brissett (ARI)", comp: 49, att: 96, pct: 51, yds: 384, ya: 4, passTd: 19, int: 2, sacks: 9, rushAtt: 5, rushYds: 3, rushTd: 1, rushPct: 20, fl: 0, games: 14, fpts: 93.7, fptsPerGame: 6.7 },
  { rank: 16, player: "Jordan Love (GB)", comp: 43, att: 73, pct: 58.9, yds: 320, ya: 4.4, passTd: 20, int: 1, sacks: 1, rushAtt: 6, rushYds: 25, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 93.3, fptsPerGame: 5.8 },
  { rank: 17, player: "Sam Darnold (SEA)", comp: 50, att: 91, pct: 54.9, yds: 378, ya: 4.2, passTd: 20, int: 2, sacks: 5, rushAtt: 2, rushYds: 9, rushTd: 0, rushPct: 0, fl: 0, games: 20, fpts: 92, fptsPerGame: 4.6 },
  { rank: 18, player: "Bryce Young (CAR)", comp: 42, att: 80, pct: 52.5, yds: 252, ya: 3.2, passTd: 15, int: 2, sacks: 4, rushAtt: 10, rushYds: 53, rushTd: 3, rushPct: 30, fl: 1, games: 17, fpts: 87.4, fptsPerGame: 5.1 },
  { rank: 19, player: "Baker Mayfield (TB)", comp: 40, att: 76, pct: 52.6, yds: 288, ya: 3.8, passTd: 16, int: 1, sacks: 3, rushAtt: 4, rushYds: 22, rushTd: 1, rushPct: 25, fl: 0, games: 17, fpts: 81.7, fptsPerGame: 4.8 },
  { rank: 20, player: "J.J. McCarthy (MIN)", comp: 16, att: 44, pct: 36.4, yds: 149, ya: 3.4, passTd: 10, int: 0, sacks: 6, rushAtt: 6, rushYds: 45, rushTd: 4, rushPct: 66.7, fl: 0, games: 10, fpts: 74.5, fptsPerGame: 7.5 },
  { rank: 21, player: "Tua Tagovailoa (MIA)", comp: 36, att: 62, pct: 58.1, yds: 240, ya: 3.9, passTd: 16, int: 0, sacks: 4, rushAtt: 2, rushYds: 6, rushTd: 0, rushPct: 0, fl: 0, games: 14, fpts: 74.2, fptsPerGame: 5.3 },
  { rank: 22, player: "Aaron Rodgers (PIT)", comp: 48, att: 84, pct: 57.1, yds: 313, ya: 3.7, passTd: 14, int: 1, sacks: 3, rushAtt: 3, rushYds: 4, rushTd: 1, rushPct: 33.3, fl: 0, games: 17, fpts: 72.9, fptsPerGame: 4.3 },
  { rank: 23, player: "C.J. Stroud (HOU)", comp: 36, att: 69, pct: 52.2, yds: 191, ya: 2.8, passTd: 14, int: 1, sacks: 4, rushAtt: 6, rushYds: 14, rushTd: 1, rushPct: 16.7, fl: 0, games: 16, fpts: 69, fptsPerGame: 4.3 },
  { rank: 24, player: "Cam Ward (TEN)", comp: 36, att: 59, pct: 61, yds: 188, ya: 3.2, passTd: 12, int: 2, sacks: 5, rushAtt: 7, rushYds: 27, rushTd: 2, rushPct: 28.6, fl: 0, games: 17, fpts: 66.2, fptsPerGame: 3.9 },
  { rank: 25, player: "Geno Smith (LV)", comp: 35, att: 66, pct: 53, yds: 215, ya: 3.3, passTd: 15, int: 3, sacks: 6, rushAtt: 7, rushYds: 21, rushTd: 0, rushPct: 0, fl: 0, games: 15, fpts: 64.7, fptsPerGame: 4.3 },
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
  { rank: 1, player: "Davante Adams (LA)", rec: 14, tgt: 34, recPct: 41.2, recYds: 67, yr: 4.8, recTd: 13, tgtPct: 26, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 98.7, fptsPerGame: 5.8 },
  { rank: 2, player: "Amon-Ra St. Brown (DET)", rec: 20, tgt: 35, recPct: 57.1, recYds: 134, yr: 6.7, recTd: 10, tgtPct: 34.7, rushAtt: 1, rushYds: 1, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 93.5, fptsPerGame: 5.5 },
  { rank: 3, player: "Jaxon Smith-Njigba (SEA)", rec: 15, tgt: 23, recPct: 65.2, recYds: 104, yr: 6.9, recTd: 8, tgtPct: 25.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 20, fpts: 73.4, fptsPerGame: 3.7 },
  { rank: 4, player: "Puka Nacua (LA)", rec: 18, tgt: 21, recPct: 85.7, recYds: 114, yr: 6.3, recTd: 6, tgtPct: 16, rushAtt: 4, rushYds: 14, rushTd: 1, rushPct: 25, fl: 0, games: 19, fpts: 72.8, fptsPerGame: 3.8 },
  { rank: 5, player: "Ja'Marr Chase (CIN)", rec: 13, tgt: 22, recPct: 59.1, recYds: 111, yr: 8.5, recTd: 7, tgtPct: 23.9, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 66.1, fptsPerGame: 4.1 },
  { rank: 6, player: "Jauan Jennings (SF)", rec: 11, tgt: 23, recPct: 47.8, recYds: 85, yr: 7.7, recTd: 7, tgtPct: 21.5, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 61.5, fptsPerGame: 3.6 },
  { rank: 7, player: "Drake London (ATL)", rec: 9, tgt: 16, recPct: 56.3, recYds: 72, yr: 8, recTd: 7, tgtPct: 22.9, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 12, fpts: 58.2, fptsPerGame: 4.9 },
  { rank: 8, player: "Romeo Doubs (GB)", rec: 11, tgt: 20, recPct: 55, recYds: 52, yr: 4.7, recTd: 6, tgtPct: 24.4, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 52.2, fptsPerGame: 3.1 },
  { rank: 9, player: "Isaac TeSlaa (DET)", rec: 7, tgt: 11, recPct: 63.6, recYds: 89, yr: 12.7, recTd: 6, tgtPct: 10.9, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 14, fpts: 51.9, fptsPerGame: 3.7 },
  { rank: 10, player: "Parker Washington (JAX)", rec: 13, tgt: 19, recPct: 68.4, recYds: 76, yr: 5.8, recTd: 5, tgtPct: 19, rushAtt: 1, rushYds: -8, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 49.8, fptsPerGame: 3.1 },
  { rank: 11, player: "Rashee Rice (KC)", rec: 11, tgt: 19, recPct: 57.9, recYds: 53, yr: 4.8, recTd: 4, tgtPct: 18.8, rushAtt: 3, rushYds: 12, rushTd: 1, rushPct: 33.3, fl: 0, games: 8, fpts: 47.5, fptsPerGame: 5.9 },
  { rank: 12, player: "Troy Franklin (DEN)", rec: 14, tgt: 21, recPct: 66.7, recYds: 94, yr: 6.7, recTd: 4, tgtPct: 20.6, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 47.4, fptsPerGame: 2.8 },
  { rank: 13, player: "Deebo Samuel Sr. (WAS)", rec: 9, tgt: 13, recPct: 69.2, recYds: 62, yr: 6.9, recTd: 4, tgtPct: 20.6, rushAtt: 4, rushYds: 16, rushTd: 1, rushPct: 25, fl: 0, games: 16, fpts: 46.8, fptsPerGame: 2.9 },
  { rank: 14, player: "Courtland Sutton (DEN)", rec: 8, tgt: 21, recPct: 38.1, recYds: 78, yr: 9.8, recTd: 5, tgtPct: 20.6, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 19, fpts: 45.8, fptsPerGame: 2.4 },
  { rank: 15, player: "Chris Olave (NO)", rec: 7, tgt: 15, recPct: 46.7, recYds: 84, yr: 12, recTd: 5, tgtPct: 24.2, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 45.4, fptsPerGame: 2.8 },
  { rank: 16, player: "Stefon Diggs (NE)", rec: 10, tgt: 13, recPct: 76.9, recYds: 51, yr: 5.1, recTd: 5, tgtPct: 13.8, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 21, fpts: 45.1, fptsPerGame: 2.1 },
  { rank: 17, player: "George Pickens (DAL)", rec: 11, tgt: 23, recPct: 47.8, recYds: 84, yr: 7.6, recTd: 4, tgtPct: 20.5, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 43.4, fptsPerGame: 2.6 },
  { rank: 18, player: "Michael Pittman (IND)", rec: 8, tgt: 18, recPct: 44.4, recYds: 52, yr: 6.5, recTd: 5, tgtPct: 19.8, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 43.2, fptsPerGame: 2.5 },
  { rank: 19, player: "Tetairoa McMillan (CAR)", rec: 10, tgt: 15, recPct: 66.7, recYds: 84, yr: 8.4, recTd: 4, tgtPct: 17.2, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 18, fpts: 42.4, fptsPerGame: 2.4 },
  { rank: 20, player: "Marquise Brown (KC)", rec: 7, tgt: 10, recPct: 70, recYds: 51, yr: 7.3, recTd: 5, tgtPct: 9.9, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 42.1, fptsPerGame: 2.6 },
  { rank: 21, player: "Quentin Johnston (LAC)", rec: 10, tgt: 15, recPct: 66.7, recYds: 75, yr: 7.5, recTd: 4, tgtPct: 16, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 14, fpts: 41.5, fptsPerGame: 3 },
  { rank: 22, player: "Tee Higgins (CIN)", rec: 10, tgt: 16, recPct: 62.5, recYds: 69, yr: 6.9, recTd: 4, tgtPct: 17.4, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 15, fpts: 40.9, fptsPerGame: 2.7 },
  { rank: 23, player: "Josh Downs (IND)", rec: 10, tgt: 15, recPct: 66.7, recYds: 68, yr: 6.8, recTd: 4, tgtPct: 16.5, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 40.8, fptsPerGame: 2.6 },
  { rank: 24, player: "DJ Moore (CHI)", rec: 7, tgt: 13, recPct: 53.8, recYds: 20, yr: 2.9, recTd: 4, tgtPct: 13.4, rushAtt: 3, rushYds: 18, rushTd: 1, rushPct: 33.3, fl: 0, games: 19, fpts: 40.8, fptsPerGame: 2.1 },
  { rank: 25, player: "Michael Wilson (ARI)", rec: 8, tgt: 17, recPct: 47.1, recYds: 73, yr: 9.1, recTd: 4, tgtPct: 14.5, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 39.3, fptsPerGame: 2.3 },
];

const RED_ZONE_RB_DATA: RedZoneRBRaw[] = [
  { rank: 1, player: "Christian McCaffrey (SF)", rushAtt: 80, rushYds: 137, ya: 1.7, rushTd: 10, rushPct: 12.5, rec: 22, tgt: 27, recPct: 81.5, recYds: 133, yr: 6, recTd: 8, tgtPct: 25.2, fl: 0, games: 19, fpts: 157, fptsPerGame: 8.3 },
  { rank: 2, player: "Kyren Williams (LA)", rushAtt: 61, rushYds: 178, ya: 2.9, rushTd: 12, rushPct: 19.7, rec: 12, tgt: 14, recPct: 85.7, recYds: 94, yr: 7.8, recTd: 5, tgtPct: 10.7, fl: 1, games: 20, fpts: 139.2, fptsPerGame: 7 },
  { rank: 3, player: "Jahmyr Gibbs (DET)", rushAtt: 52, rushYds: 168, ya: 3.2, rushTd: 9, rushPct: 17.3, rec: 12, tgt: 15, recPct: 80, recYds: 109, yr: 9.1, recTd: 5, tgtPct: 14.9, fl: 0, games: 17, fpts: 123.7, fptsPerGame: 7.3 },
  { rank: 4, player: "Jonathan Taylor (IND)", rushAtt: 71, rushYds: 204, ya: 2.9, rushTd: 14, rushPct: 19.7, rec: 4, tgt: 5, recPct: 80, recYds: 33, yr: 8.3, recTd: 2, tgtPct: 5.5, fl: 0, games: 17, fpts: 123.7, fptsPerGame: 7.3 },
  { rank: 5, player: "Travis Etienne (JAX)", rushAtt: 56, rushYds: 163, ya: 2.9, rushTd: 5, rushPct: 8.9, rec: 9, tgt: 11, recPct: 81.8, recYds: 91, yr: 10.1, recTd: 6, tgtPct: 11, fl: 0, games: 18, fpts: 100.4, fptsPerGame: 5.6 },
  { rank: 6, player: "Josh Jacobs (GB)", rushAtt: 58, rushYds: 164, ya: 2.8, rushTd: 12, rushPct: 20.7, rec: 5, tgt: 6, recPct: 83.3, recYds: 29, yr: 5.8, recTd: 1, tgtPct: 7.3, fl: 1, games: 16, fpts: 100.3, fptsPerGame: 6.3 },
  { rank: 7, player: "Javonte Williams (DAL)", rushAtt: 54, rushYds: 159, ya: 2.9, rushTd: 10, rushPct: 18.5, rec: 8, tgt: 12, recPct: 66.7, recYds: 29, yr: 3.6, recTd: 2, tgtPct: 10.7, fl: 0, games: 16, fpts: 98.8, fptsPerGame: 6.2 },
  { rank: 8, player: "Chase Brown (CIN)", rushAtt: 37, rushYds: 116, ya: 3.1, rushTd: 6, rushPct: 16.2, rec: 8, tgt: 12, recPct: 66.7, recYds: 63, yr: 7.9, recTd: 5, tgtPct: 13, fl: 0, games: 17, fpts: 91.9, fptsPerGame: 5.4 },
  { rank: 9, player: "Zach Charbonnet (SEA)", rushAtt: 53, rushYds: 126, ya: 2.4, rushTd: 11, rushPct: 20.8, rec: 3, tgt: 3, recPct: 100, recYds: 7, yr: 2.3, recTd: 0, tgtPct: 3.3, fl: 0, games: 17, fpts: 82.3, fptsPerGame: 4.8 },
  { rank: 10, player: "Derrick Henry (BAL)", rushAtt: 63, rushYds: 158, ya: 2.5, rushTd: 10, rushPct: 15.9, rec: 2, tgt: 2, recPct: 100, recYds: 13, yr: 6.5, recTd: 0, tgtPct: 2.8, fl: 0, games: 17, fpts: 79.1, fptsPerGame: 4.7 },
  { rank: 11, player: "RJ Harvey (DEN)", rushAtt: 31, rushYds: 52, ya: 1.7, rushTd: 5, rushPct: 16.1, rec: 10, tgt: 13, recPct: 76.9, recYds: 55, yr: 5.5, recTd: 4, tgtPct: 12.7, fl: 0, games: 19, fpts: 74.7, fptsPerGame: 3.9 },
  { rank: 12, player: "D'Andre Swift (CHI)", rushAtt: 47, rushYds: 157, ya: 3.3, rushTd: 9, rushPct: 19.1, rec: 1, tgt: 1, recPct: 100, recYds: 1, yr: 1, recTd: 0, tgtPct: 1, fl: 0, games: 18, fpts: 70.8, fptsPerGame: 3.9 },
  { rank: 13, player: "Kenneth Walker III (SEA)", rushAtt: 51, rushYds: 172, ya: 3.4, rushTd: 8, rushPct: 15.7, rec: 3, tgt: 4, recPct: 75, recYds: 17, yr: 5.7, recTd: 0, tgtPct: 4.4, fl: 0, games: 20, fpts: 69.9, fptsPerGame: 3.5 },
  { rank: 14, player: "Bijan Robinson (ATL)", rushAtt: 36, rushYds: 90, ya: 2.5, rushTd: 5, rushPct: 13.9, rec: 9, tgt: 13, recPct: 69.2, recYds: 71, yr: 7.9, recTd: 3, tgtPct: 18.6, fl: 2, games: 17, fpts: 69.1, fptsPerGame: 4.1 },
  { rank: 15, player: "Kenneth Gainwell (PIT)", rushAtt: 23, rushYds: 49, ya: 2.1, rushTd: 5, rushPct: 21.7, rec: 14, tgt: 17, recPct: 82.4, recYds: 74, yr: 5.3, recTd: 2, tgtPct: 19.1, fl: 0, games: 18, fpts: 68.3, fptsPerGame: 3.8 },
  { rank: 16, player: "James Cook (BUF)", rushAtt: 63, rushYds: 162, ya: 2.6, rushTd: 7, rushPct: 11.1, rec: 3, tgt: 3, recPct: 100, recYds: 10, yr: 3.3, recTd: 1, tgtPct: 2.9, fl: 1, games: 19, fpts: 66.2, fptsPerGame: 3.5 },
  { rank: 17, player: "Kareem Hunt (KC)", rushAtt: 38, rushYds: 89, ya: 2.3, rushTd: 8, rushPct: 21.1, rec: 2, tgt: 5, recPct: 40, recYds: 13, yr: 6.5, recTd: 1, tgtPct: 5, fl: 1, games: 17, fpts: 64.2, fptsPerGame: 3.8 },
  { rank: 18, player: "Ashton Jeanty (LV)", rushAtt: 35, rushYds: 58, ya: 1.7, rushTd: 3, rushPct: 8.6, rec: 9, tgt: 10, recPct: 90, recYds: 44, yr: 4.9, recTd: 4, tgtPct: 14.3, fl: 0, games: 17, fpts: 61.2, fptsPerGame: 3.6 },
  { rank: 19, player: "De'Von Achane (MIA)", rushAtt: 32, rushYds: 97, ya: 3, rushTd: 3, rushPct: 9.4, rec: 7, tgt: 11, recPct: 63.6, recYds: 51, yr: 7.3, recTd: 3, tgtPct: 15.1, fl: 0, games: 16, fpts: 57.8, fptsPerGame: 3.6 },
  { rank: 20, player: "Rhamondre Stevenson (NE)", rushAtt: 31, rushYds: 57, ya: 1.8, rushTd: 5, rushPct: 16.1, rec: 6, tgt: 7, recPct: 85.7, recYds: 47, yr: 7.8, recTd: 2, tgtPct: 7.4, fl: 1, games: 18, fpts: 56.4, fptsPerGame: 3.1 },
  { rank: 21, player: "Bhayshul Tuten (JAX)", rushAtt: 27, rushYds: 88, ya: 3.3, rushTd: 5, rushPct: 18.5, rec: 2, tgt: 2, recPct: 100, recYds: 24, yr: 12, recTd: 2, tgtPct: 2, fl: 0, games: 16, fpts: 55.2, fptsPerGame: 3.5 },
  { rank: 22, player: "Jacory Croskey-Merritt (WAS)", rushAtt: 32, rushYds: 110, ya: 3.4, rushTd: 7, rushPct: 21.9, rec: 1, tgt: 1, recPct: 100, recYds: 11, yr: 11, recTd: 0, tgtPct: 1.6, fl: 0, games: 17, fpts: 55.1, fptsPerGame: 3.2 },
  { rank: 23, player: "Cam Skattebo (NYG)", rushAtt: 24, rushYds: 65, ya: 2.7, rushTd: 5, rushPct: 20.8, rec: 3, tgt: 4, recPct: 75, recYds: 32, yr: 10.7, recTd: 2, tgtPct: 4.6, fl: 1, games: 8, fpts: 52.7, fptsPerGame: 6.6 },
  { rank: 24, player: "Saquon Barkley (PHI)", rushAtt: 49, rushYds: 93, ya: 1.9, rushTd: 5, rushPct: 10.2, rec: 5, tgt: 8, recPct: 62.5, recYds: 22, yr: 4.4, recTd: 1, tgtPct: 11.8, fl: 0, games: 17, fpts: 52.5, fptsPerGame: 3.1 },
  { rank: 25, player: "Woody Marks (HOU)", rushAtt: 41, rushYds: 96, ya: 2.3, rushTd: 3, rushPct: 7.3, rec: 6, tgt: 10, recPct: 60, recYds: 25, yr: 4.2, recTd: 3, tgtPct: 10.1, fl: 1, games: 18, fpts: 52.1, fptsPerGame: 2.9 },
];

const RED_ZONE_TE_DATA: RedZoneTERaw[] = [
  { rank: 1, player: "Trey McBride (ARI)", rec: 20, tgt: 34, recPct: 58.8, recYds: 177, yr: 8.9, recTd: 11, tgtPct: 29.1, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 103.7, fptsPerGame: 6.1 },
  { rank: 2, player: "Dallas Goedert (PHI)", rec: 15, tgt: 17, recPct: 88.2, recYds: 90, yr: 6, recTd: 11, tgtPct: 25, rushAtt: 1, rushYds: 1, rushTd: 1, rushPct: 100, fl: 0, games: 16, fpts: 96.1, fptsPerGame: 6 },
  { rank: 3, player: "Colby Parkinson (LA)", rec: 16, tgt: 24, recPct: 66.7, recYds: 130, yr: 8.1, recTd: 7, tgtPct: 18.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 1, games: 17, fpts: 69, fptsPerGame: 4.1 },
  { rank: 4, player: "AJ Barner (SEA)", rec: 12, tgt: 16, recPct: 75, recYds: 123, yr: 10.3, recTd: 6, tgtPct: 17.6, rushAtt: 3, rushYds: 4, rushTd: 1, rushPct: 33.3, fl: 0, games: 20, fpts: 66.7, fptsPerGame: 3.3 },
  { rank: 5, player: "Jake Ferguson (DAL)", rec: 15, tgt: 25, recPct: 60, recYds: 97, yr: 6.5, recTd: 7, tgtPct: 22.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 66.7, fptsPerGame: 3.9 },
  { rank: 6, player: "Hunter Henry (NE)", rec: 15, tgt: 24, recPct: 62.5, recYds: 133, yr: 8.9, recTd: 5, tgtPct: 25.5, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 21, fpts: 58.3, fptsPerGame: 2.8 },
  { rank: 7, player: "George Kittle (SF)", rec: 12, tgt: 13, recPct: 92.3, recYds: 96, yr: 8, recTd: 6, tgtPct: 12.1, rushAtt: 1, rushYds: -3, rushTd: 0, rushPct: 0, fl: 0, games: 12, fpts: 57.3, fptsPerGame: 4.8 },
  { rank: 8, player: "Brock Bowers (LV)", rec: 10, tgt: 18, recPct: 55.6, recYds: 76, yr: 7.6, recTd: 6, tgtPct: 25.7, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 12, fpts: 53.6, fptsPerGame: 4.5 },
  { rank: 9, player: "Tucker Kraft (GB)", rec: 9, tgt: 12, recPct: 75, recYds: 104, yr: 11.6, recTd: 5, tgtPct: 14.6, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 8, fpts: 49.4, fptsPerGame: 6.2 },
  { rank: 10, player: "Tyler Warren (IND)", rec: 11, tgt: 23, recPct: 47.8, recYds: 65, yr: 5.9, recTd: 4, tgtPct: 25.3, rushAtt: 4, rushYds: 5, rushTd: 1, rushPct: 25, fl: 0, games: 17, fpts: 48, fptsPerGame: 2.8 },
  { rank: 11, player: "Dalton Kincaid (BUF)", rec: 8, tgt: 11, recPct: 72.7, recYds: 98, yr: 12.3, recTd: 5, tgtPct: 10.7, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 14, fpts: 47.8, fptsPerGame: 3.4 },
  { rank: 12, player: "Darren Waller (MIA)", rec: 6, tgt: 8, recPct: 75, recYds: 43, yr: 7.2, recTd: 6, tgtPct: 11, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 8, fpts: 46.3, fptsPerGame: 5.8 },
  { rank: 13, player: "Harold Fannin Jr. (CLE)", rec: 7, tgt: 11, recPct: 63.6, recYds: 48, yr: 6.9, recTd: 4, tgtPct: 16.2, rushAtt: 2, rushYds: 2, rushTd: 1, rushPct: 50, fl: 0, games: 16, fpts: 42, fptsPerGame: 2.6 },
  { rank: 14, player: "Kyle Pitts (ATL)", rec: 7, tgt: 13, recPct: 53.8, recYds: 50, yr: 7.1, recTd: 5, tgtPct: 18.6, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 42, fptsPerGame: 2.5 },
  { rank: 15, player: "Colston Loveland (CHI)", rec: 11, tgt: 19, recPct: 57.9, recYds: 61, yr: 5.5, recTd: 4, tgtPct: 19.6, rushAtt: 1, rushYds: -2, rushTd: 0, rushPct: 0, fl: 0, games: 18, fpts: 40.9, fptsPerGame: 2.3 },
  { rank: 16, player: "Dawson Knox (BUF)", rec: 8, tgt: 14, recPct: 57.1, recYds: 64, yr: 8, recTd: 4, tgtPct: 13.6, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 18, fpts: 38.4, fptsPerGame: 2.1 },
  { rank: 17, player: "Zach Ertz (WAS)", rec: 6, tgt: 9, recPct: 66.7, recYds: 53, yr: 8.8, recTd: 4, tgtPct: 14.3, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 13, fpts: 35.3, fptsPerGame: 2.7 },
  { rank: 18, player: "Mark Andrews (BAL)", rec: 6, tgt: 15, recPct: 40, recYds: 51, yr: 8.5, recTd: 4, tgtPct: 21.1, rushAtt: 3, rushYds: 2, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 35.3, fptsPerGame: 2.1 },
  { rank: 19, player: "David Njoku (CLE)", rec: 6, tgt: 9, recPct: 66.7, recYds: 44, yr: 7.3, recTd: 4, tgtPct: 13.2, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 11, fpts: 34.4, fptsPerGame: 3.1 },
  { rank: 20, player: "Theo Johnson (NYG)", rec: 6, tgt: 14, recPct: 42.9, recYds: 38, yr: 6.3, recTd: 4, tgtPct: 16.1, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 15, fpts: 33.8, fptsPerGame: 2.3 },
  { rank: 21, player: "Travis Kelce (KC)", rec: 9, tgt: 13, recPct: 69.2, recYds: 61, yr: 6.8, recTd: 3, tgtPct: 12.9, rushAtt: 1, rushYds: 1, rushTd: 0, rushPct: 0, fl: 0, games: 17, fpts: 33.2, fptsPerGame: 2 },
  { rank: 22, player: "Jake Tonges (SF)", rec: 6, tgt: 7, recPct: 85.7, recYds: 28, yr: 4.7, recTd: 4, tgtPct: 6.5, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 11, fpts: 32.8, fptsPerGame: 3 },
  { rank: 23, player: "T.J. Hockenson (MIN)", rec: 8, tgt: 11, recPct: 72.7, recYds: 55, yr: 6.9, recTd: 3, tgtPct: 12, rushAtt: 1, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 15, fpts: 31.5, fptsPerGame: 2.1 },
  { rank: 24, player: "Oronde Gadsden II (LAC)", rec: 7, tgt: 15, recPct: 46.7, recYds: 45, yr: 6.4, recTd: 3, tgtPct: 16, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 16, fpts: 29.5, fptsPerGame: 1.8 },
  { rank: 25, player: "Dalton Schultz (HOU)", rec: 7, tgt: 14, recPct: 50, recYds: 38, yr: 5.4, recTd: 3, tgtPct: 14.1, rushAtt: 0, rushYds: 0, rushTd: 0, rushPct: 0, fl: 0, games: 19, fpts: 28.8, fptsPerGame: 1.5 },
];

const ADVANCED_WR_DATA: AdvancedWRRaw[] = [
  { rank: 1, player: "Jaxon Smith-Njigba (SEA)", games: 17, rec: 119, yds: 1793, yr: 15.1, ybc: 1265, ybcPerR: 10.6, air: 1833, airPerR: 11.2, yac: 528, yacPerR: 4.4, yacon: 174, yaconPerR: 1.5, brktkl: 3, tgt: 163, tgtPctTm: 35.7, catchable: 126, drops: 5, rzTgt: 17, tenPlus: 76, twentyPlus: 27, thirtyPlus: 12, fortyPlus: 8, fiftyPlus: 4, lng: 63 },
  { rank: 2, player: "Puka Nacua (LAR)", games: 16, rec: 129, yds: 1715, yr: 13.3, ybc: 1049, ybcPerR: 8.1, air: 1566, airPerR: 9.4, yac: 666, yacPerR: 5.2, yacon: 261, yaconPerR: 2.0, brktkl: 11, tgt: 166, tgtPctTm: 28.6, catchable: 133, drops: 4, rzTgt: 17, tenPlus: 70, twentyPlus: 27, thirtyPlus: 12, fortyPlus: 3, fiftyPlus: 2, lng: 58 },
  { rank: 3, player: "George Pickens (DAL)", games: 17, rec: 93, yds: 1429, yr: 15.4, ybc: 950, ybcPerR: 10.2, air: 1547, airPerR: 11.3, yac: 479, yacPerR: 5.2, yacon: 199, yaconPerR: 2.1, brktkl: 6, tgt: 137, tgtPctTm: 22.5, catchable: 97, drops: 4, rzTgt: 23, tenPlus: 62, twentyPlus: 22, thirtyPlus: 9, fortyPlus: 4, fiftyPlus: 0, lng: 45 },
  { rank: 4, player: "Ja'Marr Chase (CIN)", games: 16, rec: 125, yds: 1412, yr: 11.3, ybc: 772, ybcPerR: 6.2, air: 1570, airPerR: 8.5, yac: 640, yacPerR: 5.1, yacon: 225, yaconPerR: 1.8, brktkl: 6, tgt: 185, tgtPctTm: 30.3, catchable: 129, drops: 4, rzTgt: 22, tenPlus: 63, twentyPlus: 15, thirtyPlus: 5, fortyPlus: 2, fiftyPlus: 1, lng: 64 },
  { rank: 5, player: "Amon-Ra St. Brown (DET)", games: 17, rec: 117, yds: 1401, yr: 12.0, ybc: 831, ybcPerR: 7.1, air: 1390, airPerR: 8.1, yac: 570, yacPerR: 4.9, yacon: 152, yaconPerR: 1.3, brktkl: 4, tgt: 172, tgtPctTm: 31.3, catchable: 128, drops: 10, rzTgt: 35, tenPlus: 56, twentyPlus: 19, thirtyPlus: 7, fortyPlus: 1, fiftyPlus: 1, lng: 52 },
  { rank: 6, player: "Zay Flowers (BAL)", games: 17, rec: 86, yds: 1211, yr: 14.1, ybc: 753, ybcPerR: 8.8, air: 1204, airPerR: 10.1, yac: 458, yacPerR: 5.3, yacon: 105, yaconPerR: 1.2, brktkl: 9, tgt: 119, tgtPctTm: 29.1, catchable: 93, drops: 7, rzTgt: 12, tenPlus: 43, twentyPlus: 19, thirtyPlus: 10, fortyPlus: 4, fiftyPlus: 3, lng: 64 },
  { rank: 7, player: "Chris Olave (NO)", games: 16, rec: 100, yds: 1163, yr: 11.6, ybc: 874, ybcPerR: 8.7, air: 1841, airPerR: 11.8, yac: 289, yacPerR: 2.9, yacon: 47, yaconPerR: 0.5, brktkl: 2, tgt: 156, tgtPctTm: 27.6, catchable: 105, drops: 5, rzTgt: 15, tenPlus: 42, twentyPlus: 11, thirtyPlus: 5, fortyPlus: 4, fiftyPlus: 4, lng: 62 },
  { rank: 8, player: "Nico Collins (HOU)", games: 15, rec: 71, yds: 1117, yr: 15.7, ybc: 793, ybcPerR: 11.2, air: 1529, airPerR: 12.6, yac: 324, yacPerR: 4.6, yacon: 130, yaconPerR: 1.8, brktkl: 4, tgt: 121, tgtPctTm: 21.7, catchable: 72, drops: 1, rzTgt: 19, tenPlus: 46, twentyPlus: 18, thirtyPlus: 6, fortyPlus: 5, fiftyPlus: 4, lng: 57 },
  { rank: 9, player: "Jameson Williams (DET)", games: 17, rec: 65, yds: 1109, yr: 17.1, ybc: 676, ybcPerR: 10.4, air: 1289, airPerR: 12.6, yac: 433, yacPerR: 6.7, yacon: 140, yaconPerR: 2.2, brktkl: 4, tgt: 102, tgtPctTm: 18.5, catchable: 77, drops: 12, rzTgt: 9, tenPlus: 45, twentyPlus: 23, thirtyPlus: 7, fortyPlus: 5, fiftyPlus: 1, lng: 64 },
  { rank: 10, player: "CeeDee Lamb (DAL)", games: 13, rec: 75, yds: 1077, yr: 14.4, ybc: 754, ybcPerR: 10.1, air: 1403, airPerR: 12.0, yac: 323, yacPerR: 4.3, yacon: 128, yaconPerR: 1.7, brktkl: 3, tgt: 117, tgtPctTm: 19.2, catchable: 85, drops: 5, rzTgt: 17, tenPlus: 42, twentyPlus: 16, thirtyPlus: 10, fortyPlus: 3, fiftyPlus: 2, lng: 74 },
  { rank: 11, player: "Justin Jefferson (MIN)", games: 17, rec: 84, yds: 1048, yr: 12.5, ybc: 597, ybcPerR: 7.1, air: 1438, airPerR: 10.1, yac: 451, yacPerR: 5.4, yacon: 134, yaconPerR: 1.6, brktkl: 4, tgt: 142, tgtPctTm: 30.1, catchable: 106, drops: 3, rzTgt: 19, tenPlus: 52, twentyPlus: 12, thirtyPlus: 4, fortyPlus: 2, fiftyPlus: 1, lng: 50 },
  { rank: 12, player: "Courtland Sutton (DEN)", games: 17, rec: 74, yds: 1017, yr: 13.7, ybc: 795, ybcPerR: 10.7, air: 1542, airPerR: 12.3, yac: 222, yacPerR: 3.0, yacon: 110, yaconPerR: 1.5, brktkl: 3, tgt: 125, tgtPctTm: 21.2, catchable: 82, drops: 8, rzTgt: 20, tenPlus: 41, twentyPlus: 17, thirtyPlus: 7, fortyPlus: 2, fiftyPlus: 1, lng: 52 },
  { rank: 13, player: "Wan'Dale Robinson (NYG)", games: 16, rec: 92, yds: 1014, yr: 11.0, ybc: 628, ybcPerR: 6.8, air: 1187, airPerR: 8.4, yac: 386, yacPerR: 4.2, yacon: 120, yaconPerR: 1.3, brktkl: 5, tgt: 141, tgtPctTm: 27.9, catchable: 102, drops: 6, rzTgt: 14, tenPlus: 34, twentyPlus: 14, thirtyPlus: 7, fortyPlus: 2, fiftyPlus: 1, lng: 50 },
  { rank: 14, player: "Tetairoa McMillan (CAR)", games: 17, rec: 70, yds: 1013, yr: 14.5, ybc: 745, ybcPerR: 10.6, air: 1410, airPerR: 11.6, yac: 268, yacPerR: 3.8, yacon: 76, yaconPerR: 1.1, brktkl: 2, tgt: 122, tgtPctTm: 25.3, catchable: 78, drops: 8, rzTgt: 15, tenPlus: 47, twentyPlus: 17, thirtyPlus: 4, fortyPlus: 3, fiftyPlus: 0, lng: 43 },
  { rank: 15, player: "Stefon Diggs (NE)", games: 17, rec: 85, yds: 1013, yr: 11.9, ybc: 659, ybcPerR: 7.8, air: 871, airPerR: 8.5, yac: 354, yacPerR: 4.2, yacon: 110, yaconPerR: 1.3, brktkl: 3, tgt: 102, tgtPctTm: 21.2, catchable: 74, drops: 4, rzTgt: 12, tenPlus: 44, twentyPlus: 17, thirtyPlus: 7, fortyPlus: 0, fiftyPlus: 0, lng: 34 },
  { rank: 16, player: "DeVonta Smith (PHI)", games: 17, rec: 77, yds: 1008, yr: 13.1, ybc: 715, ybcPerR: 9.3, air: 1355, airPerR: 11.9, yac: 293, yacPerR: 3.8, yacon: 95, yaconPerR: 1.2, brktkl: 3, tgt: 114, tgtPctTm: 24.5, catchable: 82, drops: 4, rzTgt: 12, tenPlus: 36, twentyPlus: 14, thirtyPlus: 6, fortyPlus: 4, fiftyPlus: 2, lng: 79 },
  { rank: 17, player: "Michael Wilson (ARI)", games: 17, rec: 78, yds: 1006, yr: 12.9, ybc: 733, ybcPerR: 9.4, air: 1502, airPerR: 11.8, yac: 273, yacPerR: 3.5, yacon: 126, yaconPerR: 1.6, brktkl: 3, tgt: 127, tgtPctTm: 20.5, catchable: 80, drops: 1, rzTgt: 17, tenPlus: 43, twentyPlus: 14, thirtyPlus: 8, fortyPlus: 2, fiftyPlus: 1, lng: 50 },
  { rank: 18, player: "A.J. Brown (PHI)", games: 15, rec: 78, yds: 1003, yr: 12.9, ybc: 735, ybcPerR: 9.4, air: 1425, airPerR: 11.8, yac: 268, yacPerR: 3.4, yacon: 143, yaconPerR: 1.8, brktkl: 7, tgt: 121, tgtPctTm: 26.0, catchable: 79, drops: 1, rzTgt: 13, tenPlus: 40, twentyPlus: 14, thirtyPlus: 5, fortyPlus: 1, fiftyPlus: 0, lng: 45 },
  { rank: 19, player: "Alec Pierce (IND)", games: 15, rec: 47, yds: 1003, yr: 21.3, ybc: 829, ybcPerR: 17.6, air: 1593, airPerR: 19.0, yac: 174, yacPerR: 3.7, yacon: 58, yaconPerR: 1.2, brktkl: 1, tgt: 84, tgtPctTm: 15.7, catchable: 48, drops: 1, rzTgt: 9, tenPlus: 39, twentyPlus: 17, thirtyPlus: 9, fortyPlus: 5, fiftyPlus: 3, lng: 66 },
  { rank: 20, player: "Emeka Egbuka (TB)", games: 17, rec: 63, yds: 938, yr: 14.9, ybc: 603, ybcPerR: 9.6, air: 1572, airPerR: 12.3, yac: 335, yacPerR: 5.3, yacon: 66, yaconPerR: 1.0, brktkl: 1, tgt: 128, tgtPctTm: 23.5, catchable: 73, drops: 9, rzTgt: 15, tenPlus: 30, twentyPlus: 20, thirtyPlus: 8, fortyPlus: 3, fiftyPlus: 2, lng: 77 },
  { rank: 21, player: "Drake London (ATL)", games: 12, rec: 68, yds: 919, yr: 13.5, ybc: 690, ybcPerR: 10.1, air: 1221, airPerR: 10.8, yac: 229, yacPerR: 3.4, yacon: 74, yaconPerR: 1.1, brktkl: 0, tgt: 113, tgtPctTm: 21.6, catchable: 71, drops: 1, rzTgt: 16, tenPlus: 40, twentyPlus: 13, thirtyPlus: 7, fortyPlus: 3, fiftyPlus: 0, lng: 43 },
  { rank: 22, player: "Jaylen Waddle (MIA)", games: 16, rec: 64, yds: 910, yr: 14.2, ybc: 682, ybcPerR: 10.7, air: 1306, airPerR: 13.1, yac: 228, yacPerR: 3.6, yacon: 66, yaconPerR: 1.0, brktkl: 4, tgt: 100, tgtPctTm: 21.5, catchable: 68, drops: 5, rzTgt: 11, tenPlus: 43, twentyPlus: 14, thirtyPlus: 5, fortyPlus: 3, fiftyPlus: 0, lng: 46 },
  { rank: 23, player: "DK Metcalf (PIT)", games: 15, rec: 59, yds: 850, yr: 14.4, ybc: 436, ybcPerR: 7.4, air: 1044, airPerR: 10.5, yac: 414, yacPerR: 7.0, yacon: 180, yaconPerR: 3.1, brktkl: 8, tgt: 99, tgtPctTm: 18.9, catchable: 65, drops: 5, rzTgt: 13, tenPlus: 32, twentyPlus: 15, thirtyPlus: 5, fortyPlus: 3, fiftyPlus: 2, lng: 80 },
  { rank: 24, player: "Parker Washington (JAX)", games: 15, rec: 58, yds: 847, yr: 14.6, ybc: 582, ybcPerR: 10.0, air: 1187, airPerR: 12.2, yac: 265, yacPerR: 4.6, yacon: 116, yaconPerR: 2.0, brktkl: 6, tgt: 97, tgtPctTm: 17.7, catchable: 75, drops: 7, rzTgt: 16, tenPlus: 33, twentyPlus: 17, thirtyPlus: 4, fortyPlus: 2, fiftyPlus: 1, lng: 63 },
  { rank: 25, player: "Tee Higgins (CIN)", games: 15, rec: 59, yds: 846, yr: 14.3, ybc: 680, ybcPerR: 11.5, air: 1314, airPerR: 13.3, yac: 166, yacPerR: 2.8, yacon: 65, yaconPerR: 1.1, brktkl: 5, tgt: 99, tgtPctTm: 16.2, catchable: 61, drops: 2, rzTgt: 16, tenPlus: 34, twentyPlus: 14, thirtyPlus: 5, fortyPlus: 3, fiftyPlus: 0, lng: 44 },
  { rank: 26, player: "Jakobi Meyers (JAX)", games: 16, rec: 75, yds: 835, yr: 11.1, ybc: 553, ybcPerR: 7.4, air: 1008, airPerR: 9.2, yac: 282, yacPerR: 3.8, yacon: 150, yaconPerR: 2.0, brktkl: 7, tgt: 110, tgtPctTm: 20.0, catchable: 71, drops: 5, rzTgt: 15, tenPlus: 31, twentyPlus: 10, thirtyPlus: 2, fortyPlus: 2, fiftyPlus: 1, lng: 50 },
  { rank: 27, player: "Michael Pittman (IND)", games: 17, rec: 80, yds: 793, yr: 9.9, ybc: 525, ybcPerR: 6.6, air: 907, airPerR: 8.0, yac: 268, yacPerR: 3.4, yacon: 96, yaconPerR: 1.2, brktkl: 7, tgt: 114, tgtPctTm: 21.3, catchable: 78, drops: 3, rzTgt: 18, tenPlus: 39, twentyPlus: 5, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 27 },
  { rank: 28, player: "Davante Adams (LAR)", games: 14, rec: 60, yds: 789, yr: 13.2, ybc: 672, ybcPerR: 11.2, air: 1444, airPerR: 12.7, yac: 117, yacPerR: 1.9, yacon: 27, yaconPerR: 0.5, brktkl: 0, tgt: 114, tgtPctTm: 19.6, catchable: 65, drops: 5, rzTgt: 32, tenPlus: 35, twentyPlus: 14, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 0, lng: 44 },
  { rank: 29, player: "Ladd McConkey (LAC)", games: 16, rec: 66, yds: 789, yr: 12.0, ybc: 479, ybcPerR: 7.3, air: 1046, airPerR: 9.9, yac: 310, yacPerR: 4.7, yacon: 92, yaconPerR: 1.4, brktkl: 5, tgt: 106, tgtPctTm: 19.5, catchable: 68, drops: 3, rzTgt: 15, tenPlus: 33, twentyPlus: 8, thirtyPlus: 3, fortyPlus: 2, fiftyPlus: 1, lng: 58 },
  { rank: 30, player: "Keenan Allen (LAC)", games: 17, rec: 81, yds: 777, yr: 9.6, ybc: 546, ybcPerR: 6.7, air: 1027, airPerR: 8.4, yac: 231, yacPerR: 2.9, yacon: 81, yaconPerR: 1.0, brktkl: 3, tgt: 122, tgtPctTm: 22.4, catchable: 93, drops: 5, rzTgt: 16, tenPlus: 28, twentyPlus: 6, thirtyPlus: 3, fortyPlus: 0, fiftyPlus: 0, lng: 31 },
];

const ADVANCED_RB_DATA: AdvancedRBRaw[] = [
  { rank: 1, player: "James Cook (BUF)", games: 17, att: 309, yds: 1621, yPerAtt: 5.2, ybcon: 935, ybconPerAtt: 3.0, yacon: 686, yaconPerAtt: 2.2, brktkl: 21, tkLoss: 14, tkLossYds: -35, lngTd: 64, tenPlus: 39, twentyPlus: 9, thirtyPlus: 5, fortyPlus: 4, fiftyPlus: 1, lng: 64, rec: 33, tgt: 40, rzTgt: 3, yaconRec: 98 },
  { rank: 2, player: "Derrick Henry (BAL)", games: 17, att: 307, yds: 1595, yPerAtt: 5.2, ybcon: 866, ybconPerAtt: 2.8, yacon: 729, yaconPerAtt: 2.4, brktkl: 13, tkLoss: 22, tkLossYds: -49, lngTd: 46, tenPlus: 36, twentyPlus: 17, thirtyPlus: 7, fortyPlus: 4, fiftyPlus: 1, lng: 59, rec: 15, tgt: 21, rzTgt: 2, yaconRec: 57 },
  { rank: 3, player: "Jonathan Taylor (IND)", games: 17, att: 324, yds: 1585, yPerAtt: 4.9, ybcon: 798, ybconPerAtt: 2.5, yacon: 787, yaconPerAtt: 2.4, brktkl: 27, tkLoss: 28, tkLossYds: -54, lngTd: 83, tenPlus: 36, twentyPlus: 9, thirtyPlus: 5, fortyPlus: 4, fiftyPlus: 3, lng: 83, rec: 46, tgt: 56, rzTgt: 5, yaconRec: 103 },
  { rank: 4, player: "Bijan Robinson (ATL)", games: 17, att: 288, yds: 1478, yPerAtt: 5.1, ybcon: 812, ybconPerAtt: 2.8, yacon: 666, yaconPerAtt: 2.3, brktkl: 22, tkLoss: 26, tkLossYds: -64, lngTd: 93, tenPlus: 36, twentyPlus: 8, thirtyPlus: 4, fortyPlus: 2, fiftyPlus: 2, lng: 93, rec: 79, tgt: 103, rzTgt: 13, yaconRec: 209 },
  { rank: 5, player: "De'Von Achane (MIA)", games: 16, att: 238, yds: 1350, yPerAtt: 5.7, ybcon: 631, ybconPerAtt: 2.7, yacon: 719, yaconPerAtt: 3.0, brktkl: 22, tkLoss: 23, tkLossYds: -53, lngTd: 59, tenPlus: 40, twentyPlus: 13, thirtyPlus: 6, fortyPlus: 4, fiftyPlus: 1, lng: 59, rec: 67, tgt: 85, rzTgt: 11, yaconRec: 108 },
  { rank: 6, player: "Kyren Williams (LAR)", games: 17, att: 259, yds: 1252, yPerAtt: 4.8, ybcon: 737, ybconPerAtt: 2.8, yacon: 515, yaconPerAtt: 2.0, brktkl: 22, tkLoss: 12, tkLossYds: -31, lngTd: 7, tenPlus: 26, twentyPlus: 6, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 34, rec: 36, tgt: 50, rzTgt: 10, yaconRec: 35 },
  { rank: 7, player: "Jahmyr Gibbs (DET)", games: 17, att: 243, yds: 1223, yPerAtt: 5.0, ybcon: 819, ybconPerAtt: 3.4, yacon: 404, yaconPerAtt: 1.7, brktkl: 18, tkLoss: 26, tkLossYds: -77, lngTd: 78, tenPlus: 27, twentyPlus: 10, thirtyPlus: 6, fortyPlus: 6, fiftyPlus: 2, lng: 78, rec: 77, tgt: 94, rzTgt: 15, yaconRec: 77 },
  { rank: 8, player: "Javonte Williams (DAL)", games: 16, att: 252, yds: 1201, yPerAtt: 4.8, ybcon: 574, ybconPerAtt: 2.3, yacon: 627, yaconPerAtt: 2.5, brktkl: 25, tkLoss: 13, tkLossYds: -27, lngTd: 30, tenPlus: 26, twentyPlus: 6, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 1, lng: 66, rec: 35, tgt: 51, rzTgt: 12, yaconRec: 46 },
  { rank: 9, player: "Christian McCaffrey (SF)", games: 17, att: 311, yds: 1202, yPerAtt: 3.9, ybcon: 728, ybconPerAtt: 2.3, yacon: 474, yaconPerAtt: 1.5, brktkl: 10, tkLoss: 30, tkLossYds: -73, lngTd: 12, tenPlus: 27, twentyPlus: 3, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 41, rec: 102, tgt: 129, rzTgt: 25, yaconRec: 212 },
  { rank: 10, player: "Saquon Barkley (PHI)", games: 16, att: 281, yds: 1140, yPerAtt: 4.1, ybcon: 689, ybconPerAtt: 2.5, yacon: 451, yaconPerAtt: 1.6, brktkl: 18, tkLoss: 41, tkLossYds: -105, lngTd: 65, tenPlus: 28, twentyPlus: 4, thirtyPlus: 3, fortyPlus: 3, fiftyPlus: 2, lng: 65, rec: 37, tgt: 51, rzTgt: 8, yaconRec: 78 },
  { rank: 11, player: "Travis Etienne (JAX)", games: 17, att: 260, yds: 1107, yPerAtt: 4.3, ybcon: 562, ybconPerAtt: 2.2, yacon: 545, yaconPerAtt: 2.1, brktkl: 10, tkLoss: 26, tkLossYds: -60, lngTd: 48, tenPlus: 26, twentyPlus: 7, thirtyPlus: 4, fortyPlus: 3, fiftyPlus: 1, lng: 71, rec: 36, tgt: 52, rzTgt: 10, yaconRec: 121 },
  { rank: 12, player: "D'Andre Swift (CHI)", games: 16, att: 223, yds: 1087, yPerAtt: 4.9, ybcon: 666, ybconPerAtt: 3.0, yacon: 421, yaconPerAtt: 1.9, brktkl: 11, tkLoss: 14, tkLossYds: -32, lngTd: 22, tenPlus: 30, twentyPlus: 5, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 25, rec: 34, tgt: 48, rzTgt: 1, yaconRec: 65 },
  { rank: 13, player: "Tony Pollard (TEN)", games: 17, att: 242, yds: 1082, yPerAtt: 4.5, ybcon: 640, ybconPerAtt: 2.6, yacon: 442, yaconPerAtt: 1.8, brktkl: 16, tkLoss: 18, tkLossYds: -30, lngTd: 65, tenPlus: 27, twentyPlus: 6, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 1, lng: 65, rec: 33, tgt: 41, rzTgt: 1, yaconRec: 62 },
  { rank: 14, player: "Rico Dowdle (CAR)", games: 17, att: 237, yds: 1076, yPerAtt: 4.5, ybcon: 596, ybconPerAtt: 2.5, yacon: 480, yaconPerAtt: 2.0, brktkl: 14, tkLoss: 15, tkLossYds: -20, lngTd: 5, tenPlus: 24, twentyPlus: 5, thirtyPlus: 2, fortyPlus: 2, fiftyPlus: 1, lng: 53, rec: 39, tgt: 50, rzTgt: 5, yaconRec: 66 },
  { rank: 15, player: "Breece Hall (NYJ)", games: 16, att: 243, yds: 1065, yPerAtt: 4.4, ybcon: 618, ybconPerAtt: 2.5, yacon: 447, yaconPerAtt: 1.8, brktkl: 12, tkLoss: 33, tkLossYds: -88, lngTd: 59, tenPlus: 26, twentyPlus: 8, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 1, lng: 59, rec: 36, tgt: 48, rzTgt: 9, yaconRec: 96 },
  { rank: 16, player: "Kenneth Walker III (SEA)", games: 17, att: 221, yds: 1027, yPerAtt: 4.6, ybcon: 621, ybconPerAtt: 2.8, yacon: 406, yaconPerAtt: 1.8, brktkl: 23, tkLoss: 26, tkLossYds: -57, lngTd: 55, tenPlus: 33, twentyPlus: 10, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 1, lng: 55, rec: 31, tgt: 36, rzTgt: 3, yaconRec: 67 },
  { rank: 17, player: "Chase Brown (CIN)", games: 17, att: 233, yds: 1019, yPerAtt: 4.4, ybcon: 525, ybconPerAtt: 2.3, yacon: 494, yaconPerAtt: 2.1, brktkl: 16, tkLoss: 16, tkLossYds: -36, lngTd: 12, tenPlus: 24, twentyPlus: 6, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 37, rec: 69, tgt: 89, rzTgt: 12, yaconRec: 124 },
  { rank: 18, player: "Ashton Jeanty (LV)", games: 17, att: 267, yds: 975, yPerAtt: 3.7, ybcon: 419, ybconPerAtt: 1.6, yacon: 556, yaconPerAtt: 2.1, brktkl: 24, tkLoss: 45, tkLossYds: -82, lngTd: 64, tenPlus: 24, twentyPlus: 3, thirtyPlus: 2, fortyPlus: 2, fiftyPlus: 2, lng: 64, rec: 55, tgt: 73, rzTgt: 10, yaconRec: 148 },
  { rank: 19, player: "Jaylen Warren (PIT)", games: 16, att: 211, yds: 958, yPerAtt: 4.5, ybcon: 461, ybconPerAtt: 2.2, yacon: 497, yaconPerAtt: 2.4, brktkl: 23, tkLoss: 17, tkLossYds: -31, lngTd: 45, tenPlus: 23, twentyPlus: 6, thirtyPlus: 4, fortyPlus: 2, fiftyPlus: 0, lng: 45, rec: 40, tgt: 45, rzTgt: 5, yaconRec: 179 },
  { rank: 20, player: "Josh Jacobs (GB)", games: 15, att: 234, yds: 929, yPerAtt: 4.0, ybcon: 459, ybconPerAtt: 2.0, yacon: 470, yaconPerAtt: 2.0, brktkl: 16, tkLoss: 19, tkLossYds: -37, lngTd: 40, tenPlus: 23, twentyPlus: 3, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 40, rec: 36, tgt: 44, rzTgt: 6, yaconRec: 101 },
  { rank: 21, player: "TreVeyon Henderson (NE)", games: 17, att: 180, yds: 911, yPerAtt: 5.1, ybcon: 549, ybconPerAtt: 3.1, yacon: 362, yaconPerAtt: 2.0, brktkl: 11, tkLoss: 19, tkLossYds: -47, lngTd: 69, tenPlus: 18, twentyPlus: 6, thirtyPlus: 4, fortyPlus: 4, fiftyPlus: 4, lng: 69, rec: 35, tgt: 42, rzTgt: 4, yaconRec: 46 },
  { rank: 22, player: "Quinshon Judkins (CLE)", games: 14, att: 231, yds: 827, yPerAtt: 3.6, ybcon: 430, ybconPerAtt: 1.9, yacon: 397, yaconPerAtt: 1.7, brktkl: 14, tkLoss: 24, tkLossYds: -50, lngTd: 46, tenPlus: 18, twentyPlus: 4, thirtyPlus: 4, fortyPlus: 1, fiftyPlus: 0, lng: 46, rec: 26, tgt: 36, rzTgt: 1, yaconRec: 42 },
  { rank: 23, player: "Jacory Croskey-Merritt (WAS)", games: 17, att: 176, yds: 805, yPerAtt: 4.6, ybcon: 443, ybconPerAtt: 2.5, yacon: 362, yaconPerAtt: 2.1, brktkl: 13, tkLoss: 17, tkLossYds: -35, lngTd: 72, tenPlus: 21, twentyPlus: 3, thirtyPlus: 2, fortyPlus: 2, fiftyPlus: 1, lng: 72, rec: 9, tgt: 13, rzTgt: 1, yaconRec: 8 },
  { rank: 24, player: "Kyle Monangai (CHI)", games: 16, att: 171, yds: 783, yPerAtt: 4.6, ybcon: 410, ybconPerAtt: 2.4, yacon: 373, yaconPerAtt: 2.2, brktkl: 15, tkLoss: 17, tkLossYds: -41, lngTd: 8, tenPlus: 15, twentyPlus: 3, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 39, rec: 18, tgt: 30, rzTgt: 3, yaconRec: 28 },
  { rank: 25, player: "J.K. Dobbins (DEN)", games: 10, att: 153, yds: 772, yPerAtt: 5.0, ybcon: 386, ybconPerAtt: 2.5, yacon: 386, yaconPerAtt: 2.5, brktkl: 9, tkLoss: 9, tkLossYds: -17, lngTd: 19, tenPlus: 21, twentyPlus: 5, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 0, lng: 41, rec: 11, tgt: 14, rzTgt: 0, yaconRec: 15 },
  { rank: 26, player: "Jordan Mason (MIN)", games: 16, att: 159, yds: 758, yPerAtt: 4.8, ybcon: 410, ybconPerAtt: 2.6, yacon: 348, yaconPerAtt: 2.2, brktkl: 12, tkLoss: 16, tkLossYds: -24, lngTd: 16, tenPlus: 22, twentyPlus: 4, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 24, rec: 14, tgt: 16, rzTgt: 1, yaconRec: 18 },
  { rank: 27, player: "Blake Corum (LAR)", games: 17, att: 145, yds: 746, yPerAtt: 5.1, ybcon: 388, ybconPerAtt: 2.7, yacon: 358, yaconPerAtt: 2.5, brktkl: 10, tkLoss: 10, tkLossYds: -26, lngTd: 48, tenPlus: 23, twentyPlus: 5, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 0, lng: 48, rec: 8, tgt: 14, rzTgt: 1, yaconRec: 12 },
  { rank: 28, player: "Tyrone Tracy Jr. (NYG)", games: 15, att: 176, yds: 740, yPerAtt: 4.2, ybcon: 378, ybconPerAtt: 2.1, yacon: 362, yaconPerAtt: 2.1, brktkl: 11, tkLoss: 12, tkLossYds: -20, lngTd: 31, tenPlus: 19, twentyPlus: 3, thirtyPlus: 1, fortyPlus: 0, fiftyPlus: 0, lng: 31, rec: 36, tgt: 48, rzTgt: 5, yaconRec: 58 },
  { rank: 29, player: "Zach Charbonnet (SEA)", games: 16, att: 185, yds: 730, yPerAtt: 3.9, ybcon: 393, ybconPerAtt: 2.1, yacon: 337, yaconPerAtt: 1.8, brktkl: 14, tkLoss: 20, tkLossYds: -45, lngTd: 27, tenPlus: 12, twentyPlus: 5, thirtyPlus: 1, fortyPlus: 0, fiftyPlus: 0, lng: 30, rec: 20, tgt: 24, rzTgt: 3, yaconRec: 32 },
  { rank: 30, player: "David Montgomery (DET)", games: 17, att: 158, yds: 716, yPerAtt: 4.5, ybcon: 370, ybconPerAtt: 2.3, yacon: 346, yaconPerAtt: 2.2, brktkl: 3, tkLoss: 13, tkLossYds: -17, lngTd: 35, tenPlus: 15, twentyPlus: 3, thirtyPlus: 3, fortyPlus: 1, fiftyPlus: 1, lng: 72, rec: 24, tgt: 29, rzTgt: 2, yaconRec: 49 },
];

const ADVANCED_TE_DATA: AdvancedTERaw[] = [
  { rank: 1, player: "Trey McBride (ARI)", games: 17, rec: 126, yds: 1239, yr: 9.8, ybc: 656, ybcPerR: 5.2, air: 1126, airPerR: 6.6, yac: 583, yacPerR: 4.6, yacon: 167, yaconPerR: 1.3, brktkl: 9, tgt: 170, tgtPctTm: 27.4, catchable: 128, drops: 2, rzTgt: 34, tenPlus: 51, twentyPlus: 12, thirtyPlus: 1, fortyPlus: 0, fiftyPlus: 0, lng: 31 },
  { rank: 2, player: "Kyle Pitts (ATL)", games: 17, rec: 88, yds: 928, yr: 10.5, ybc: 528, ybcPerR: 6.0, air: 869, airPerR: 7.3, yac: 400, yacPerR: 4.5, yacon: 90, yaconPerR: 1.0, brktkl: 2, tgt: 119, tgtPctTm: 22.8, catchable: 91, drops: 2, rzTgt: 13, tenPlus: 43, twentyPlus: 12, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 36 },
  { rank: 3, player: "Juwan Johnson (NO)", games: 17, rec: 77, yds: 889, yr: 11.5, ybc: 527, ybcPerR: 6.8, air: 773, airPerR: 7.6, yac: 362, yacPerR: 4.7, yacon: 94, yaconPerR: 1.2, brktkl: 5, tgt: 102, tgtPctTm: 18.0, catchable: 83, drops: 6, rzTgt: 8, tenPlus: 38, twentyPlus: 11, thirtyPlus: 5, fortyPlus: 1, fiftyPlus: 1, lng: 52 },
  { rank: 4, player: "Travis Kelce (KC)", games: 17, rec: 76, yds: 851, yr: 11.2, ybc: 427, ybcPerR: 5.6, air: 735, airPerR: 6.7, yac: 424, yacPerR: 5.6, yacon: 134, yaconPerR: 1.8, brktkl: 1, tgt: 109, tgtPctTm: 19.7, catchable: 83, drops: 7, rzTgt: 13, tenPlus: 40, twentyPlus: 9, thirtyPlus: 4, fortyPlus: 1, fiftyPlus: 0, lng: 44 },
  { rank: 5, player: "Tyler Warren (IND)", games: 17, rec: 76, yds: 817, yr: 10.8, ybc: 343, ybcPerR: 4.5, air: 602, airPerR: 5.3, yac: 474, yacPerR: 6.2, yacon: 118, yaconPerR: 1.6, brktkl: 4, tgt: 114, tgtPctTm: 21.3, catchable: 78, drops: 2, rzTgt: 23, tenPlus: 33, twentyPlus: 10, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 41 },
  { rank: 6, player: "Dalton Schultz (HOU)", games: 17, rec: 82, yds: 777, yr: 9.5, ybc: 419, ybcPerR: 5.1, air: 659, airPerR: 6.2, yac: 358, yacPerR: 4.4, yacon: 75, yaconPerR: 0.9, brktkl: 3, tgt: 107, tgtPctTm: 19.2, catchable: 85, drops: 2, rzTgt: 12, tenPlus: 31, twentyPlus: 5, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 0, lng: 47 },
  { rank: 7, player: "Hunter Henry (NE)", games: 17, rec: 60, yds: 768, yr: 12.8, ybc: 433, ybcPerR: 7.2, air: 710, airPerR: 8.2, yac: 335, yacPerR: 5.6, yacon: 64, yaconPerR: 1.1, brktkl: 1, tgt: 87, tgtPctTm: 18.0, catchable: 63, drops: 3, rzTgt: 22, tenPlus: 36, twentyPlus: 11, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 36 },
  { rank: 8, player: "Harold Fannin Jr. (CLE)", games: 16, rec: 72, yds: 731, yr: 10.2, ybc: 379, ybcPerR: 5.3, air: 646, airPerR: 6.0, yac: 352, yacPerR: 4.9, yacon: 154, yaconPerR: 2.1, brktkl: 7, tgt: 108, tgtPctTm: 20.6, catchable: 76, drops: 4, rzTgt: 11, tenPlus: 30, twentyPlus: 8, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 35 },
  { rank: 9, player: "Colston Loveland (CHI)", games: 16, rec: 58, yds: 713, yr: 12.3, ybc: 463, ybcPerR: 8.0, air: 746, airPerR: 9.0, yac: 250, yacPerR: 4.3, yacon: 99, yaconPerR: 1.7, brktkl: 4, tgt: 83, tgtPctTm: 15.5, catchable: 61, drops: 1, rzTgt: 15, tenPlus: 28, twentyPlus: 10, thirtyPlus: 5, fortyPlus: 1, fiftyPlus: 1, lng: 58 },
  { rank: 10, player: "Brock Bowers (LV)", games: 12, rec: 64, yds: 680, yr: 10.6, ybc: 375, ybcPerR: 5.9, air: 560, airPerR: 6.4, yac: 305, yacPerR: 4.8, yacon: 83, yaconPerR: 1.3, brktkl: 3, tgt: 87, tgtPctTm: 17.5, catchable: 68, drops: 4, rzTgt: 18, tenPlus: 24, twentyPlus: 8, thirtyPlus: 3, fortyPlus: 0, fiftyPlus: 0, lng: 38 },
  { rank: 11, player: "Oronde Gadsden II (LAC)", games: 15, rec: 49, yds: 664, yr: 13.6, ybc: 443, ybcPerR: 9.0, air: 624, airPerR: 9.0, yac: 221, yacPerR: 4.5, yacon: 72, yaconPerR: 1.5, brktkl: 3, tgt: 69, tgtPctTm: 12.7, catchable: 52, drops: 3, rzTgt: 15, tenPlus: 24, twentyPlus: 11, thirtyPlus: 4, fortyPlus: 2, fiftyPlus: 1, lng: 53 },
  { rank: 12, player: "George Kittle (SF)", games: 11, rec: 57, yds: 628, yr: 11.0, ybc: 376, ybcPerR: 6.6, air: 460, airPerR: 6.7, yac: 252, yacPerR: 4.4, yacon: 75, yaconPerR: 1.3, brktkl: 2, tgt: 69, tgtPctTm: 12.5, catchable: 58, drops: 1, rzTgt: 13, tenPlus: 30, twentyPlus: 9, thirtyPlus: 2, fortyPlus: 0, fiftyPlus: 0, lng: 33 },
  { rank: 13, player: "Jake Ferguson (DAL)", games: 17, rec: 82, yds: 600, yr: 7.3, ybc: 293, ybcPerR: 3.6, air: 475, airPerR: 4.6, yac: 307, yacPerR: 3.7, yacon: 78, yaconPerR: 1.0, brktkl: 6, tgt: 103, tgtPctTm: 16.9, catchable: 84, drops: 2, rzTgt: 25, tenPlus: 23, twentyPlus: 2, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 26 },
  { rank: 14, player: "Dallas Goedert (PHI)", games: 15, rec: 60, yds: 591, yr: 9.8, ybc: 357, ybcPerR: 6.0, air: 583, airPerR: 7.1, yac: 234, yacPerR: 3.9, yacon: 59, yaconPerR: 1.0, brktkl: 3, tgt: 82, tgtPctTm: 17.6, catchable: 64, drops: 4, rzTgt: 15, tenPlus: 22, twentyPlus: 7, thirtyPlus: 3, fortyPlus: 0, fiftyPlus: 0, lng: 36 },
  { rank: 15, player: "Cade Otton (TB)", games: 15, rec: 59, yds: 572, yr: 9.7, ybc: 263, ybcPerR: 4.5, air: 419, airPerR: 5.1, yac: 309, yacPerR: 5.2, yacon: 82, yaconPerR: 1.4, brktkl: 4, tgt: 82, tgtPctTm: 15.0, catchable: 62, drops: 2, rzTgt: 7, tenPlus: 23, twentyPlus: 7, thirtyPlus: 0, fortyPlus: 0, fiftyPlus: 0, lng: 27 },
  { rank: 16, player: "Dalton Kincaid (BUF)", games: 12, rec: 39, yds: 571, yr: 14.6, ybc: 312, ybcPerR: 8.0, air: 465, airPerR: 9.3, yac: 259, yacPerR: 6.6, yacon: 62, yaconPerR: 1.6, brktkl: 1, tgt: 50, tgtPctTm: 10.2, catchable: 40, drops: 1, rzTgt: 9, tenPlus: 26, twentyPlus: 13, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 0, lng: 47 },
  { rank: 17, player: "Chig Okonkwo (TEN)", games: 17, rec: 56, yds: 560, yr: 10.0, ybc: 218, ybcPerR: 3.9, air: 366, airPerR: 4.6, yac: 342, yacPerR: 6.1, yacon: 95, yaconPerR: 1.7, brktkl: 5, tgt: 79, tgtPctTm: 14.9, catchable: 60, drops: 3, rzTgt: 5, tenPlus: 24, twentyPlus: 6, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 0, lng: 43 },
  { rank: 18, player: "Mitchell Evans (CAR)", games: 19, rec: 49, yds: 539, yr: 11.0, ybc: 394, ybcPerR: 8.0, air: 915, airPerR: 10.5, yac: 145, yacPerR: 3.0, yacon: 48, yaconPerR: 1.0, brktkl: 2, tgt: 87, tgtPctTm: 18.0, catchable: 55, drops: 6, rzTgt: 13, tenPlus: 23, twentyPlus: 7, thirtyPlus: 2, fortyPlus: 1, fiftyPlus: 0, lng: 45 },
  { rank: 19, player: "Brenton Strange (JAX)", games: 12, rec: 46, yds: 540, yr: 11.7, ybc: 293, ybcPerR: 6.4, air: 414, airPerR: 6.9, yac: 247, yacPerR: 5.4, yacon: 72, yaconPerR: 1.6, brktkl: 3, tgt: 60, tgtPctTm: 10.9, catchable: 48, drops: 2, rzTgt: 10, tenPlus: 26, twentyPlus: 9, thirtyPlus: 1, fortyPlus: 0, fiftyPlus: 0, lng: 30 },
  { rank: 20, player: "AJ Barner (SEA)", games: 16, rec: 52, yds: 519, yr: 10.0, ybc: 248, ybcPerR: 4.8, air: 297, airPerR: 4.4, yac: 271, yacPerR: 5.2, yacon: 69, yaconPerR: 1.3, brktkl: 3, tgt: 68, tgtPctTm: 14.9, catchable: 54, drops: 2, rzTgt: 13, tenPlus: 20, twentyPlus: 3, thirtyPlus: 1, fortyPlus: 1, fiftyPlus: 1, lng: 61 },
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
