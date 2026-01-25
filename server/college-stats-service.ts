// College Football Stats Service
// Fetches real college player data from ESPN APIs

const ESPN_CFB_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";

// Cache for college player data
const collegeStatsCache: Map<string, { data: any; time: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour (college stats change less frequently)

// College team ESPN ID mapping for logo fallbacks
// ESPN team logo URL: https://a.espncdn.com/i/teamlogos/ncaa/500/{teamId}.png
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

// Get team logo URL from school name
export function getCollegeTeamLogo(schoolName: string): string | null {
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

export interface CollegePlayerBio {
  name: string;
  fullName: string;
  position: string;
  team: string;
  teamAbbr: string;
  jersey: string;
  height: string;
  weight: string;
  hometown: string | null;
  class: string | null;
  headshot: string | null;
  teamLogo: string | null;
  espnId: string;
}

export interface CollegeSeasonStats {
  year: string;
  games: number;
  stats: Record<string, number | string>;
}

export interface CollegeGameLog {
  week: number;
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  result: string;
  score: string;
  stats: Record<string, number | string>;
  season: string;
}

export interface CollegePlayerProfile {
  bio: CollegePlayerBio;
  seasons: CollegeSeasonStats[];
  careerTotals: Record<string, number | string>;
  gameLogs: CollegeGameLog[];
  espnId: string | null;
}

// Search for a college player on ESPN by name - tries multiple strategies
async function searchCollegePlayer(playerName: string, school?: string): Promise<string | null> {
  // Strategy 1: Direct search API
  try {
    const encodedName = encodeURIComponent(playerName);
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/search?query=${encodedName}&limit=10&type=player&sport=football&league=college-football`
    );
    
    if (response.ok) {
      const data = await response.json() as any;
      const items = data.items || [];
      if (items.length > 0) {
        if (school) {
          const schoolLower = school.toLowerCase();
          const match = items.find((item: any) => {
            const itemSchool = (item.team?.displayName || item.teamName || "").toLowerCase();
            return itemSchool.includes(schoolLower) || schoolLower.includes(itemSchool);
          });
          if (match) return match.id?.toString() || null;
        }
        return items[0].id?.toString() || null;
      }
    }
  } catch (error) {
    console.error("Search strategy 1 failed:", error);
  }
  
  // Strategy 2: Search team roster if we have a school
  if (school) {
    const teamId = getTeamIdFromSchool(school);
    if (teamId) {
      try {
        const response = await fetch(`${ESPN_CFB_API_BASE}/teams/${teamId}/roster`);
        if (response.ok) {
          const data = await response.json() as any;
          const athletes = data.athletes || [];
          const nameLower = playerName.toLowerCase();
          
          for (const group of athletes) {
            const items = group.items || [];
            for (const athlete of items) {
              const athleteName = (athlete.fullName || athlete.displayName || "").toLowerCase();
              if (athleteName === nameLower || athleteName.includes(nameLower) || nameLower.includes(athleteName)) {
                return athlete.id?.toString() || null;
              }
            }
          }
        }
      } catch (error) {
        console.error("Search strategy 2 (roster) failed:", error);
      }
    }
  }
  
  // Strategy 3: Alternative search with just last name
  try {
    const lastName = playerName.split(' ').pop() || playerName;
    const encodedLastName = encodeURIComponent(lastName);
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/search?query=${encodedLastName}&limit=20&type=player&sport=football&league=college-football`
    );
    
    if (response.ok) {
      const data = await response.json() as any;
      const items = data.items || [];
      const nameLower = playerName.toLowerCase();
      
      for (const item of items) {
        const itemName = (item.displayName || item.name || "").toLowerCase();
        if (itemName === nameLower) {
          if (school) {
            const itemSchool = (item.team?.displayName || "").toLowerCase();
            if (itemSchool.includes(school.toLowerCase())) {
              return item.id?.toString() || null;
            }
          } else {
            return item.id?.toString() || null;
          }
        }
      }
    }
  } catch (error) {
    console.error("Search strategy 3 failed:", error);
  }
  
  return null;
}

// Helper to get team ID from school name
function getTeamIdFromSchool(school: string): string | null {
  const normalizedSchool = school.toLowerCase().trim();
  if (COLLEGE_TEAM_IDS[normalizedSchool]) {
    return COLLEGE_TEAM_IDS[normalizedSchool];
  }
  for (const [key, id] of Object.entries(COLLEGE_TEAM_IDS)) {
    if (normalizedSchool.includes(key) || key.includes(normalizedSchool)) {
      return id;
    }
  }
  return null;
}

// Fetch player bio from ESPN
async function fetchCollegePlayerBio(espnId: string): Promise<CollegePlayerBio | null> {
  try {
    const response = await fetch(`${ESPN_CFB_API_BASE}/players/${espnId}`);
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    const player = data.player || data;
    
    if (!player) return null;
    
    // Class year mapping
    const classMap: Record<number, string> = {
      1: "Freshman",
      2: "Sophomore", 
      3: "Junior",
      4: "Senior",
      5: "5th Year Senior"
    };
    
    const teamName = player.team?.displayName || "";
    const teamLogo = player.team?.logo || getCollegeTeamLogo(teamName);
    
    return {
      name: player.displayName || player.fullName || "",
      fullName: player.fullName || player.displayName || "",
      position: player.position?.abbreviation || "",
      team: teamName,
      teamAbbr: player.team?.abbreviation || "",
      jersey: player.jersey || "",
      height: player.displayHeight || "",
      weight: player.displayWeight || "",
      hometown: player.birthPlace?.city ? `${player.birthPlace.city}, ${player.birthPlace.state || player.birthPlace.country || ""}` : null,
      class: classMap[player.experience?.years] || player.experience?.displayValue || null,
      headshot: player.headshot?.href || `https://a.espncdn.com/i/headshots/college-football/players/full/${espnId}.png`,
      teamLogo: teamLogo,
      espnId: espnId
    };
  } catch (error) {
    console.error("Error fetching college player bio:", error);
    return null;
  }
}

// Fetch college player stats from ESPN
async function fetchCollegePlayerStats(espnId: string): Promise<{ seasons: CollegeSeasonStats[]; careerTotals: Record<string, number | string> }> {
  try {
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/athletes/${espnId}/stats`
    );
    
    if (!response.ok) {
      console.log(`ESPN college stats API returned ${response.status} for player ${espnId}`);
      return { seasons: [], careerTotals: {} };
    }
    
    const data = await response.json() as any;
    
    const seasons: CollegeSeasonStats[] = [];
    const careerTotals: Record<string, number | string> = {};
    
    // ESPN structure: categories array, each with names and statistics
    const categories = data.categories || [];
    
    // Build career totals from all categories
    for (const category of categories) {
      const names = category.names || [];
      const totals = category.totals || [];
      
      for (let i = 0; i < names.length && i < totals.length; i++) {
        const statName = names[i];
        const value = totals[i];
        if (value !== undefined && value !== null && value !== "" && value !== "--") {
          careerTotals[statName] = isNaN(Number(value)) ? value : Number(value);
        }
      }
      
      // Process per-season statistics
      const statistics = category.statistics || [];
      for (const stat of statistics) {
        const seasonYear = stat.season?.displayName || stat.season?.year?.toString() || "";
        if (!seasonYear) continue;
        
        let existingSeason = seasons.find(s => s.year === seasonYear);
        if (!existingSeason) {
          existingSeason = {
            year: seasonYear,
            games: 0,
            stats: {}
          };
          seasons.push(existingSeason);
        }
        
        const values = stat.stats || [];
        for (let i = 0; i < names.length && i < values.length; i++) {
          const statName = names[i];
          const value = values[i];
          if (value !== undefined && value !== null && value !== "" && value !== "--") {
            existingSeason.stats[statName] = isNaN(Number(value)) ? value : Number(value);
          }
        }
        
        // Extract games played
        const gamesIdx = names.findIndex((n: string) => n.toLowerCase() === "gp" || n.toLowerCase() === "g");
        if (gamesIdx >= 0 && values[gamesIdx]) {
          existingSeason.games = Number(values[gamesIdx]) || 0;
        }
      }
    }
    
    // Sort seasons by year descending
    seasons.sort((a, b) => Number(b.year) - Number(a.year));
    
    return { seasons, careerTotals };
  } catch (error) {
    console.error("Error fetching college player stats:", error);
    return { seasons: [], careerTotals: {} };
  }
}

// Fetch game logs for a specific season
async function fetchCollegeGameLogsForSeason(espnId: string, season: string): Promise<CollegeGameLog[]> {
  try {
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/athletes/${espnId}/gamelog?season=${season}`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const gameLogs: CollegeGameLog[] = [];
    
    // ESPN game log structure varies significantly - handle multiple formats
    let events: any[] = [];
    let statNames: string[] = [];
    
    // Try different ESPN data structures
    if (Array.isArray(data.events)) {
      events = data.events;
    } else if (data.seasonTypes && Array.isArray(data.seasonTypes)) {
      for (const seasonType of data.seasonTypes) {
        if (seasonType.categories && Array.isArray(seasonType.categories)) {
          for (const cat of seasonType.categories) {
            if (cat.events && Array.isArray(cat.events)) {
              events.push(...cat.events);
            }
            if (!statNames.length && cat.names && Array.isArray(cat.names)) {
              statNames = cat.names;
            }
          }
        }
      }
    }
    
    // Get stat names from categories if not found above
    const categories = data.categories || [];
    if (!statNames.length && Array.isArray(categories) && categories.length > 0) {
      statNames = categories[0]?.names || [];
    }
    
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }
    
    for (const event of events) {
      const gameStats: Record<string, number | string> = {};
      
      // Get stats from event
      const eventStats = event.stats || [];
      for (let i = 0; i < statNames.length && i < eventStats.length; i++) {
        const value = eventStats[i];
        if (value !== undefined && value !== null && value !== "" && value !== "--") {
          gameStats[statNames[i]] = isNaN(Number(value)) ? value : Number(value);
        }
      }
      
      // Parse opponent and result from event
      const opponent = event.opponent?.displayName || event.opponent?.abbreviation || "Unknown";
      const homeAway = event.homeAway === "home" ? "home" : "away";
      const result = event.gameResult || ""; 
      const score = event.score || "";
      
      gameLogs.push({
        week: event.week || 0,
        date: event.gameDate || "",
        opponent: opponent,
        homeAway: homeAway,
        result: result,
        score: score,
        stats: gameStats,
        season: season
      });
    }
    
    return gameLogs;
  } catch (error) {
    console.error(`Error fetching college game logs for season ${season}:`, error);
    return [];
  }
}

// Fetch game logs for multiple seasons
async function fetchCollegeGameLogs(espnId: string): Promise<CollegeGameLog[]> {
  const currentYear = new Date().getFullYear();
  // College players typically have 4-5 seasons max
  const seasons = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map(String);
  
  const results = await Promise.all(
    seasons.map(s => fetchCollegeGameLogsForSeason(espnId, s))
  );
  
  return results.flat();
}

// Main function to get a college player profile
export async function getCollegePlayerProfile(playerName: string, school?: string): Promise<CollegePlayerProfile | null> {
  const cacheKey = `college-profile-${playerName.toLowerCase()}-${school?.toLowerCase() || ""}`;
  const cached = collegeStatsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    // Search for the player
    const espnId = await searchCollegePlayer(playerName, school);
    
    if (!espnId) {
      console.log(`Could not find ESPN ID for college player: ${playerName} (${school})`);
      return null;
    }
    
    // Fetch all data in parallel
    const [bio, statsData, gameLogs] = await Promise.all([
      fetchCollegePlayerBio(espnId),
      fetchCollegePlayerStats(espnId),
      fetchCollegeGameLogs(espnId)
    ]);
    
    if (!bio) {
      return null;
    }
    
    const profile: CollegePlayerProfile = {
      bio,
      seasons: statsData.seasons,
      careerTotals: statsData.careerTotals,
      gameLogs,
      espnId
    };
    
    collegeStatsCache.set(cacheKey, { data: profile, time: Date.now() });
    
    return profile;
  } catch (error) {
    console.error("Error getting college player profile:", error);
    return null;
  }
}

// Get just the ESPN ID for a college player (for headshot URLs)
export async function getCollegePlayerEspnId(playerName: string, school?: string): Promise<string | null> {
  const cacheKey = `college-espnid-${playerName.toLowerCase()}-${school?.toLowerCase() || ""}`;
  const cached = collegeStatsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }
  
  const espnId = await searchCollegePlayer(playerName, school);
  if (espnId) {
    collegeStatsCache.set(cacheKey, { data: espnId, time: Date.now() });
  }
  
  return espnId;
}

// Get college player headshot URL
export function getCollegePlayerHeadshotUrl(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/college-football/players/full/${espnId}.png`;
}

// Get NFL player headshot URL  
export function getNFLPlayerHeadshotUrl(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
}
