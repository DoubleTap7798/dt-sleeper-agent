// NFL and College team logo utilities for fallback when player headshots aren't available

// NFL team abbreviations to ESPN team ID mapping
const NFL_TEAM_IDS: Record<string, string> = {
  ARI: "ari", ARZ: "ari", 
  ATL: "atl",
  BAL: "bal",
  BUF: "buf",
  CAR: "car",
  CHI: "chi",
  CIN: "cin",
  CLE: "cle",
  DAL: "dal",
  DEN: "den",
  DET: "det",
  GB: "gb", GBP: "gb",
  HOU: "hou",
  IND: "ind",
  JAX: "jax", JAC: "jax",
  KC: "kc", KCC: "kc",
  LV: "lv", LVR: "lv", OAK: "lv",
  LAC: "lac", SD: "lac",
  LAR: "lar", LA: "lar", STL: "lar",
  MIA: "mia",
  MIN: "min",
  NE: "ne", NEP: "ne",
  NO: "no", NOS: "no",
  NYG: "nyg",
  NYJ: "nyj",
  PHI: "phi",
  PIT: "pit",
  SF: "sf", SFO: "sf",
  SEA: "sea",
  TB: "tb", TBB: "tb",
  TEN: "ten",
  WAS: "wsh", WSH: "wsh",
  FA: "nfl" // Free agent - use NFL logo
};

// Get NFL team logo URL from team abbreviation
export function getNFLTeamLogo(teamAbbr: string | null | undefined): string | null {
  if (!teamAbbr) return null;
  const normalized = teamAbbr.toUpperCase().trim();
  const teamId = NFL_TEAM_IDS[normalized];
  if (teamId) {
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId}.png`;
  }
  return null;
}

// College team name to ESPN team ID mapping
const COLLEGE_TEAM_IDS: Record<string, string> = {
  "ohio state": "194",
  "ohio st": "194",
  "osu": "194",
  "alabama": "333",
  "bama": "333",
  "georgia": "61",
  "uga": "61",
  "texas": "251",
  "michigan": "130",
  "penn state": "213",
  "penn st": "213",
  "lsu": "99",
  "notre dame": "87",
  "oregon": "2483",
  "usc": "30",
  "florida": "57",
  "clemson": "228",
  "oklahoma": "201",
  "tennessee": "2633",
  "texas a&m": "245",
  "miami": "2390",
  "colorado": "38",
  "auburn": "2",
  "florida state": "52",
  "florida st": "52",
  "wisconsin": "275",
  "ole miss": "145",
  "mississippi": "145",
  "south carolina": "2579",
  "missouri": "142",
  "iowa": "2294",
  "kentucky": "96",
  "virginia tech": "259",
  "arizona state": "9",
  "arizona": "12",
  "utah": "254",
  "washington": "264",
  "ucla": "26",
  "byu": "252",
  "kansas state": "2306",
  "kansas st": "2306",
  "nebraska": "158",
  "north carolina": "153",
  "unc": "153",
  "oklahoma state": "197",
  "oklahoma st": "197",
  "arkansas": "8",
  "louisville": "97",
  "pittsburgh": "221",
  "pitt": "221",
  "iowa state": "66",
  "iowa st": "66",
  "baylor": "239",
  "cal": "25",
  "california": "25",
  "texas tech": "2641",
  "stanford": "24",
  "indiana": "84",
  "maryland": "120",
  "illinois": "356",
  "minnesota": "135",
  "purdue": "2509",
  "northwestern": "77",
  "rutgers": "164",
  "michigan state": "127",
  "michigan st": "127"
};

// Get college team logo URL from school name
export function getCollegeTeamLogo(schoolName: string | null | undefined): string | null {
  if (!schoolName) return null;
  const normalizedName = schoolName.toLowerCase().trim();
  const teamId = COLLEGE_TEAM_IDS[normalizedName];
  if (teamId) {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
  }
  // Try partial match
  for (const [key, id] of Object.entries(COLLEGE_TEAM_IDS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
    }
  }
  return null;
}
