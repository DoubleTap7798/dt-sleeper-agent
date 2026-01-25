// College Football Stats Service
// Fetches real college player data from ESPN APIs

const ESPN_CFB_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";

// Cache for college player data
const collegeStatsCache: Map<string, { data: any; time: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour (college stats change less frequently)

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

// Search for a college player on ESPN by name
async function searchCollegePlayer(playerName: string, school?: string): Promise<string | null> {
  try {
    const encodedName = encodeURIComponent(playerName);
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/search?query=${encodedName}&limit=10&type=player&sport=football&league=college-football`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    
    const items = data.items || [];
    if (items.length > 0) {
      // If school provided, try to match it
      if (school) {
        const schoolLower = school.toLowerCase();
        const match = items.find((item: any) => {
          const itemSchool = (item.team?.displayName || item.teamName || "").toLowerCase();
          return itemSchool.includes(schoolLower) || schoolLower.includes(itemSchool);
        });
        if (match) return match.id?.toString() || null;
      }
      // Return first result if no school match
      return items[0].id?.toString() || null;
    }
    
    return null;
  } catch (error) {
    console.error("Error searching college player:", error);
    return null;
  }
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
    
    return {
      name: player.displayName || player.fullName || "",
      fullName: player.fullName || player.displayName || "",
      position: player.position?.abbreviation || "",
      team: player.team?.displayName || "",
      teamAbbr: player.team?.abbreviation || "",
      jersey: player.jersey || "",
      height: player.displayHeight || "",
      weight: player.displayWeight || "",
      hometown: player.birthPlace?.city ? `${player.birthPlace.city}, ${player.birthPlace.state || player.birthPlace.country || ""}` : null,
      class: classMap[player.experience?.years] || player.experience?.displayValue || null,
      headshot: player.headshot?.href || `https://a.espncdn.com/i/headshots/college-football/players/full/${espnId}.png`,
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
