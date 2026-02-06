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
  stats: string; // Formatted stats string for display
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
  console.log(`[College Search] Searching for: "${playerName}" at "${school || 'unknown school'}"`);
  
  // Strategy 1: Direct search API
  try {
    const encodedName = encodeURIComponent(playerName);
    const searchUrl = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodedName}&limit=10&type=player&sport=football&league=college-football`;
    console.log(`[College Search] Strategy 1 - Direct search URL: ${searchUrl}`);
    const response = await fetch(searchUrl);
    
    if (response.ok) {
      const data = await response.json() as any;
      const items = data.items || [];
      console.log(`[College Search] Strategy 1 - Found ${items.length} items`);
      if (items.length > 0) {
        if (school) {
          const schoolLower = school.toLowerCase();
          const match = items.find((item: any) => {
            const itemSchool = (item.team?.displayName || item.teamName || "").toLowerCase();
            return itemSchool.includes(schoolLower) || schoolLower.includes(itemSchool);
          });
          if (match) {
            console.log(`[College Search] Strategy 1 - Found match: ${match.id}`);
            return match.id?.toString() || null;
          }
        }
        console.log(`[College Search] Strategy 1 - Using first result: ${items[0].id}`);
        return items[0].id?.toString() || null;
      }
    } else {
      console.log(`[College Search] Strategy 1 - Failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("[College Search] Strategy 1 failed:", error);
  }
  
  // Strategy 2: Search team roster if we have a school
  if (school) {
    const teamId = getTeamIdFromSchool(school);
    console.log(`[College Search] Strategy 2 - Team ID for "${school}": ${teamId || 'not found'}`);
    if (teamId) {
      try {
        const rosterUrl = `${ESPN_CFB_API_BASE}/teams/${teamId}/roster`;
        console.log(`[College Search] Strategy 2 - Fetching roster: ${rosterUrl}`);
        const response = await fetch(rosterUrl);
        if (response.ok) {
          const data = await response.json() as any;
          const athletes = data.athletes || [];
          const nameLower = playerName.toLowerCase();
          console.log(`[College Search] Strategy 2 - Found ${athletes.length} position groups`);
          
          for (const group of athletes) {
            const items = group.items || [];
            for (const athlete of items) {
              const athleteName = (athlete.fullName || athlete.displayName || "").toLowerCase();
              if (athleteName === nameLower || athleteName.includes(nameLower) || nameLower.includes(athleteName)) {
                console.log(`[College Search] Strategy 2 - Found player: ${athlete.id} (${athlete.fullName})`);
                return athlete.id?.toString() || null;
              }
            }
          }
          console.log(`[College Search] Strategy 2 - Player "${playerName}" not found in roster`);
        } else {
          console.log(`[College Search] Strategy 2 - Roster fetch failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error("[College Search] Strategy 2 (roster) failed:", error);
      }
    }
  } else {
    console.log(`[College Search] Strategy 2 - Skipped (no school provided)`);
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
    // Use the common v3 API endpoint which works reliably
    const response = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/athletes/${espnId}`);
    if (!response.ok) {
      console.log(`[College Bio] Failed to fetch bio for ${espnId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json() as any;
    const player = data.athlete || data;
    
    if (!player) {
      console.log(`[College Bio] No athlete data in response for ${espnId}`);
      return null;
    }
    
    // Class year mapping
    const classMap: Record<number, string> = {
      1: "Freshman",
      2: "Sophomore", 
      3: "Junior",
      4: "Senior",
      5: "5th Year Senior"
    };
    
    // Get team info from college field
    const teamName = player.college?.name || player.team?.displayName || "";
    const teamAbbr = player.college?.abbrev || player.team?.abbreviation || "";
    const teamLogo = player.college?.id ? 
      `https://a.espncdn.com/i/teamlogos/ncaa/500/${player.college.id}.png` : 
      getCollegeTeamLogo(teamName);
    
    // Format height if available
    const height = player.displayHeight || 
      (player.height ? `${Math.floor(player.height / 12)}' ${player.height % 12}"` : "");
    
    // Format weight if available  
    const weight = player.displayWeight || (player.weight ? `${player.weight} lbs` : "");
    
    return {
      name: player.displayName || player.fullName || "",
      fullName: player.fullName || player.displayName || "",
      position: player.position?.abbreviation || player.position?.name || "",
      team: teamName,
      teamAbbr: teamAbbr,
      jersey: player.jersey || "",
      height: height,
      weight: weight,
      hometown: player.birthPlace?.city ? `${player.birthPlace.city}, ${player.birthPlace.state || player.birthPlace.country || ""}` : null,
      class: classMap[player.experience?.years] || player.experience?.displayValue || null,
      headshot: player.headshot?.href || `https://a.espncdn.com/i/headshots/college-football/players/full/${espnId}.png`,
      teamLogo: teamLogo,
      espnId: espnId
    };
  } catch (error) {
    console.error("[College Bio] Error fetching college player bio:", error);
    return null;
  }
}

// Normalize ESPN stat names to our internal format
function normalizeStatName(espnName: string): string {
  const nameMap: Record<string, string> = {
    "receptions": "receptions",
    "receivingYards": "recYds",
    "yardsPerReception": "recAvg",
    "receivingTouchdowns": "recTd",
    "longReception": "recLong",
    "rushingAttempts": "rushAtt",
    "rushingYards": "rushYds",
    "yardsPerRushAttempt": "rushAvg",
    "rushingTouchdowns": "rushTd",
    "longRushing": "rushLong",
    "passingAttempts": "passAtt",
    "completions": "passComp",
    "passingYards": "passYds",
    "passingTouchdowns": "passTd",
    "interceptions": "passInt",
    "longPassing": "passLong",
    "completionPct": "passPct",
    "passerRating": "passRtg",
    "adjustedQBR": "qbr",
    "totalTackles": "tackles",
    "soloTackles": "soloTackles",
    "assistedTackles": "astTackles",
    "sacks": "sacks",
    "tacklesForLoss": "tfl",
    "passesDefended": "passDeflect",
    "QBHurries": "qbHurries",
    "forcedFumbles": "ff",
    "fumbleRecoveries": "fr",
    "defensiveTouchdowns": "defTd",
    "safeties": "safeties",
    "stuffs": "tfl",
    "passesDeflected": "passDeflect",
    "qbHits": "qbHurries",
  };
  return nameMap[espnName] || espnName;
}

// Parse stat value, handling comma-formatted numbers
function parseStatValue(value: any): number | string {
  if (value === undefined || value === null || value === "" || value === "--") {
    return 0;
  }
  // Remove commas from numbers like "1,243"
  const cleanValue = String(value).replace(/,/g, "");
  const num = Number(cleanValue);
  return isNaN(num) ? value : num;
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
        const normalizedName = normalizeStatName(names[i]);
        const value = parseStatValue(totals[i]);
        if (value !== 0 || totals[i] === "0" || totals[i] === 0) {
          careerTotals[normalizedName] = value;
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
          const normalizedName = normalizeStatName(names[i]);
          const value = parseStatValue(values[i]);
          existingSeason.stats[normalizedName] = value;
        }
        
        // Extract games played - ESPN doesn't always include this, check multiple sources
        const gamesIdx = names.findIndex((n: string) => 
          n.toLowerCase() === "gp" || n.toLowerCase() === "g" || n.toLowerCase() === "games"
        );
        if (gamesIdx >= 0 && values[gamesIdx]) {
          existingSeason.games = Number(String(values[gamesIdx]).replace(/,/g, "")) || 0;
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
    
    // Get stat names from the top-level names array
    const statNames: string[] = data.names || [];
    const statLabels: string[] = data.labels || [];
    
    // Events object contains opponent info keyed by eventId
    const eventsInfo: Record<string, any> = data.events || {};
    
    // Season types contain the actual game stats
    const seasonTypes = data.seasonTypes || [];
    
    for (const seasonType of seasonTypes) {
      const categories = seasonType.categories || [];
      
      for (const category of categories) {
        const categoryEvents = category.events || [];
        
        for (const evt of categoryEvents) {
          const eventId = evt.eventId;
          const eventStats = evt.stats || [];
          
          // Get opponent info from the events object
          const eventInfo = eventsInfo[eventId] || {};
          const opponent = eventInfo.opponent?.displayName || 
                          eventInfo.opponent?.abbreviation || 
                          "Unknown";
          const atVs = eventInfo.atVs || "vs";
          const week = eventInfo.week || 0;
          const gameDate = eventInfo.gameDate || "";
          
          // Build game stats object using normalized names
          const gameStats: Record<string, number | string> = {};
          for (let i = 0; i < statNames.length && i < eventStats.length; i++) {
            const normalizedName = normalizeStatName(statNames[i]);
            const value = parseStatValue(eventStats[i]);
            gameStats[normalizedName] = value;
          }
          
          // Format stats string for display
          let statsStr = "";
          const rec = gameStats.receptions || 0;
          const recYds = gameStats.recYds || 0;
          const recTd = gameStats.recTd || 0;
          const rushAtt = gameStats.rushAtt || 0;
          const rushYds = gameStats.rushYds || 0;
          const rushTd = gameStats.rushTd || 0;
          
          if (rec || recYds) {
            statsStr += `${rec} rec, ${recYds} yds`;
            if (recTd) statsStr += `, ${recTd} TD`;
          }
          if (rushAtt || rushYds) {
            if (statsStr) statsStr += " | ";
            statsStr += `${rushAtt} car, ${rushYds} yds`;
            if (rushTd) statsStr += `, ${rushTd} TD`;
          }
          
          gameLogs.push({
            week: week,
            date: gameDate,
            opponent: opponent,
            homeAway: atVs === "@" ? "away" : "home",
            result: "",
            score: "",
            stats: statsStr || "No stats",
            season: season
          });
        }
      }
    }
    
    // Sort by week descending (most recent first)
    gameLogs.sort((a, b) => b.week - a.week);
    
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
