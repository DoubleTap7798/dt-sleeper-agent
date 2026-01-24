// Player Stats Service
// Fetches comprehensive player data from ESPN, NFL, and Sleeper APIs

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ESPN_STATS_API = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

// Cache for player data
const playerStatsCache: Map<string, { data: any; time: number }> = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export interface PlayerBio {
  name: string;
  fullName: string;
  position: string;
  team: string;
  teamAbbr: string;
  jersey: string;
  height: string;
  weight: string;
  age: number | null;
  birthDate: string | null;
  birthPlace: string | null;
  college: string | null;
  draftInfo: string | null;
  experience: number | null;
  headshot: string | null;
  status: string;
  injuryStatus: string | null;
}

export interface CareerStats {
  games: number;
  gamesStarted: number;
  stats: Record<string, number | string>;
}

export interface SeasonStats {
  season: string;
  team: string;
  games: number;
  gamesStarted: number;
  stats: Record<string, number | string>;
}

export interface GameLog {
  week: number;
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  result: string;
  score: string;
  stats: Record<string, number | string>;
  season: string;
}

export interface PlayerSplits {
  home: Record<string, number | string>;
  away: Record<string, number | string>;
  wins: Record<string, number | string>;
  losses: Record<string, number | string>;
  byMonth: Record<string, Record<string, number | string>>;
}

export interface PlayerProfile {
  bio: PlayerBio;
  careerStats: CareerStats | null;
  seasonStats: SeasonStats[];
  recentGameLogs: GameLog[];
  splits: PlayerSplits | null;
  espnId: string | null;
}

// Map Sleeper player IDs to ESPN IDs (this would need to be maintained)
const sleeperToEspnMap: Map<string, string> = new Map();

// Search for a player on ESPN by name
async function searchESPNPlayer(playerName: string): Promise<string | null> {
  try {
    const encodedName = encodeURIComponent(playerName);
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/search?query=${encodedName}&limit=5&type=player&sport=football&league=nfl`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    
    // ESPN search API returns results in 'items' array
    const items = data.items || [];
    if (items.length > 0) {
      const player = items[0];
      return player.id?.toString() || null;
    }
    
    return null;
  } catch (error) {
    console.error("Error searching ESPN player:", error);
    return null;
  }
}

// Get ESPN player ID from Sleeper player data
async function getESPNPlayerId(sleeperPlayerId: string, playerName: string): Promise<string | null> {
  const cached = sleeperToEspnMap.get(sleeperPlayerId);
  if (cached) return cached;
  
  const espnId = await searchESPNPlayer(playerName);
  if (espnId) {
    sleeperToEspnMap.set(sleeperPlayerId, espnId);
  }
  
  return espnId;
}

// Fetch player bio from ESPN
async function fetchPlayerBio(espnId: string): Promise<PlayerBio | null> {
  try {
    const response = await fetch(`${ESPN_API_BASE}/players/${espnId}`);
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    const player = data.player || data;
    
    if (!player) return null;
    
    const draftInfo = player.draft ? 
      `Round ${player.draft.round}, Pick ${player.draft.selection} (${player.draft.year})` : null;
    
    return {
      name: player.displayName || player.fullName || "",
      fullName: player.fullName || player.displayName || "",
      position: player.position?.abbreviation || "",
      team: player.team?.displayName || "Free Agent",
      teamAbbr: player.team?.abbreviation || "FA",
      jersey: player.jersey || "",
      height: player.displayHeight || "",
      weight: player.displayWeight || "",
      age: player.age || null,
      birthDate: player.dateOfBirth || null,
      birthPlace: player.birthPlace?.city && player.birthPlace?.state 
        ? `${player.birthPlace.city}, ${player.birthPlace.state}` 
        : null,
      college: player.college?.name || null,
      draftInfo,
      experience: player.experience?.years || null,
      headshot: player.headshot?.href || null,
      status: player.status?.type || "active",
      injuryStatus: player.injuries?.[0]?.status || null,
    };
  } catch (error) {
    console.error("Error fetching player bio:", error);
    return null;
  }
}

// Fetch player statistics from ESPN
async function fetchPlayerStats(espnId: string): Promise<{ career: CareerStats | null; seasons: SeasonStats[] }> {
  try {
    const response = await fetch(`${ESPN_API_BASE}/players/${espnId}/statistics`);
    if (!response.ok) return { career: null, seasons: [] };
    
    const data = await response.json() as any;
    const statistics = data.statistics || [];
    
    const seasons: SeasonStats[] = [];
    let career: CareerStats | null = null;
    
    for (const statGroup of statistics) {
      const splits = statGroup.splits || [];
      
      for (const split of splits) {
        if (split.type === "career") {
          career = {
            games: parseInt(split.stats?.find((s: any) => s.name === "gamesPlayed")?.value || "0"),
            gamesStarted: parseInt(split.stats?.find((s: any) => s.name === "gamesStarted")?.value || "0"),
            stats: extractStats(split.stats || []),
          };
        } else if (split.type === "season" || split.season) {
          seasons.push({
            season: split.season?.year?.toString() || split.displayName || "",
            team: split.team?.abbreviation || "",
            games: parseInt(split.stats?.find((s: any) => s.name === "gamesPlayed")?.value || "0"),
            gamesStarted: parseInt(split.stats?.find((s: any) => s.name === "gamesStarted")?.value || "0"),
            stats: extractStats(split.stats || []),
          });
        }
      }
    }
    
    return { career, seasons };
  } catch (error) {
    console.error("Error fetching player stats:", error);
    return { career: null, seasons: [] };
  }
}

// Fetch game logs from ESPN for a specific season
async function fetchGameLogsForSeason(espnId: string, season: string): Promise<GameLog[]> {
  try {
    // Use the correct ESPN web API endpoint for game logs
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/gamelog?season=${season}`
    );
    if (!response.ok) {
      console.log(`ESPN gamelog API returned ${response.status} for player ${espnId} season ${season}`);
      return [];
    }
    
    const data = await response.json() as any;
    
    // The events are in an object keyed by game ID
    const eventsObj = data.events || {};
    
    // Get stat names from labels for mapping
    const statNames = data.names || [];
    
    const gameLogs: GameLog[] = [];
    
    // Process season types (preseason, regular season, postseason)
    const seasonTypes = data.seasonTypes || [];
    
    console.log(`ESPN gamelog for ${espnId} season ${season}: ${seasonTypes.length} seasonTypes, ${Object.keys(eventsObj).length} events`);
    
    for (const seasonType of seasonTypes) {
      const categories = seasonType.categories || [];
      
      for (const category of categories) {
        const categoryEvents = category.events || [];
        
        for (const eventEntry of categoryEvents) {
          const gameId = eventEntry.eventId;
          const eventData = eventsObj[gameId];
          
          if (!eventData) continue;
          
          // Build stats object from the array values
          const stats: Record<string, number | string> = {};
          const statValues = eventEntry.stats || [];
          
          for (let i = 0; i < statNames.length && i < statValues.length; i++) {
            const val = statValues[i];
            if (val !== undefined && val !== null && val !== "-") {
              const numVal = parseFloat(val);
              stats[statNames[i]] = isNaN(numVal) ? val : numVal;
            }
          }
          
          gameLogs.push({
            week: eventData.week || 0,
            date: eventData.gameDate || "",
            opponent: eventData.opponent?.abbreviation || "OPP",
            homeAway: eventData.atVs === "@" ? "away" : "home",
            result: eventData.gameResult || "",
            score: eventData.score || "",
            stats,
            season,
          });
        }
      }
    }
    
    // Sort by week descending
    gameLogs.sort((a, b) => b.week - a.week);
    
    return gameLogs;
  } catch (error) {
    console.error(`Error fetching game logs for season ${season}:`, error);
    return [];
  }
}

// Fetch game logs from multiple seasons (last 5 years)
async function fetchGameLogs(espnId: string, season?: string): Promise<GameLog[]> {
  if (season) {
    return fetchGameLogsForSeason(espnId, season);
  }
  
  // Fetch last 5 seasons in parallel
  const currentYear = new Date().getFullYear();
  const seasons = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map(String);
  
  const results = await Promise.all(
    seasons.map(s => fetchGameLogsForSeason(espnId, s))
  );
  
  // Flatten and return all game logs
  return results.flat();
}

// Fetch splits data from ESPN
async function fetchSplits(espnId: string): Promise<PlayerSplits | null> {
  try {
    const response = await fetch(`${ESPN_API_BASE}/players/${espnId}/splits`);
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    const splits = data.splitCategories || [];
    
    const result: PlayerSplits = {
      home: {},
      away: {},
      wins: {},
      losses: {},
      byMonth: {},
    };
    
    for (const category of splits) {
      const categoryName = category.name?.toLowerCase() || "";
      const categoryStats = category.splits || [];
      
      for (const split of categoryStats) {
        const splitName = split.name?.toLowerCase() || "";
        const stats = extractStats(split.stats || []);
        
        if (splitName.includes("home")) {
          result.home = stats;
        } else if (splitName.includes("away") || splitName.includes("road")) {
          result.away = stats;
        } else if (splitName.includes("win")) {
          result.wins = stats;
        } else if (splitName.includes("loss")) {
          result.losses = stats;
        } else if (categoryName.includes("month")) {
          result.byMonth[split.name || splitName] = stats;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error fetching splits:", error);
    return null;
  }
}

// Helper to extract stats into a clean object
function extractStats(statsArray: any[]): Record<string, number | string> {
  const stats: Record<string, number | string> = {};
  
  for (const stat of statsArray) {
    const name = stat.name || stat.abbreviation || "";
    const value = stat.value || stat.displayValue || 0;
    
    if (name) {
      const numValue = parseFloat(value);
      stats[name] = isNaN(numValue) ? value : numValue;
    }
  }
  
  return stats;
}

// Fetch comprehensive player data from Sleeper as fallback
interface SleeperPlayerData {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  number: number | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  college: string | null;
  years_exp: number | null;
  status: string;
  injury_status: string | null;
  fantasy_positions: string[];
  depth_chart_order: number | null;
}

async function fetchSleeperPlayerData(playerId: string): Promise<SleeperPlayerData | null> {
  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!response.ok) return null;
    
    const allPlayers = await response.json() as Record<string, SleeperPlayerData>;
    return allPlayers[playerId] || null;
  } catch (error) {
    console.error("Error fetching Sleeper player data:", error);
    return null;
  }
}

// Create player profile from Sleeper data when ESPN is unavailable
async function createProfileFromSleeper(playerId: string, playerName: string): Promise<PlayerProfile> {
  const sleeperData = await fetchSleeperPlayerData(playerId);
  
  const formatHeight = (h: string | null): string => {
    if (!h) return "";
    const inches = parseInt(h);
    if (isNaN(inches)) return h;
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  if (sleeperData) {
    return {
      bio: {
        name: sleeperData.full_name || playerName,
        fullName: sleeperData.full_name || playerName,
        position: sleeperData.position || "",
        team: sleeperData.team || "Free Agent",
        teamAbbr: sleeperData.team || "FA",
        jersey: sleeperData.number?.toString() || "",
        height: formatHeight(sleeperData.height),
        weight: sleeperData.weight ? `${sleeperData.weight} lbs` : "",
        age: sleeperData.age,
        birthDate: null,
        birthPlace: null,
        college: sleeperData.college,
        draftInfo: null,
        experience: sleeperData.years_exp,
        headshot: null,
        status: sleeperData.status || "active",
        injuryStatus: sleeperData.injury_status,
      },
      careerStats: null,
      seasonStats: [],
      recentGameLogs: [],
      splits: null,
      espnId: null,
    };
  }
  
  return {
    bio: {
      name: playerName,
      fullName: playerName,
      position: "",
      team: "",
      teamAbbr: "",
      jersey: "",
      height: "",
      weight: "",
      age: null,
      birthDate: null,
      birthPlace: null,
      college: null,
      draftInfo: null,
      experience: null,
      headshot: null,
      status: "active",
      injuryStatus: null,
    },
    careerStats: null,
    seasonStats: [],
    recentGameLogs: [],
    splits: null,
    espnId: null,
  };
}

// Main function to get comprehensive player profile
export async function getPlayerProfile(sleeperPlayerId: string, playerName: string): Promise<PlayerProfile | null> {
  const cacheKey = `profile-v3-${sleeperPlayerId}`;
  const cached = playerStatsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const espnId = await getESPNPlayerId(sleeperPlayerId, playerName);
    
    if (!espnId) {
      // Fallback to Sleeper data when ESPN is unavailable
      const profile = await createProfileFromSleeper(sleeperPlayerId, playerName);
      playerStatsCache.set(cacheKey, { data: profile, time: Date.now() });
      return profile;
    }
    
    const [bio, statsData, gameLogs, splits] = await Promise.all([
      fetchPlayerBio(espnId),
      fetchPlayerStats(espnId),
      fetchGameLogs(espnId),
      fetchSplits(espnId),
    ]);
    
    if (!bio) {
      return null;
    }
    
    const profile: PlayerProfile = {
      bio,
      careerStats: statsData.career,
      seasonStats: statsData.seasons,
      recentGameLogs: gameLogs,
      splits,
      espnId,
    };
    
    playerStatsCache.set(cacheKey, { data: profile, time: Date.now() });
    
    return profile;
  } catch (error) {
    console.error("Error getting player profile:", error);
    return null;
  }
}

// Get just game logs for a player (fetches last 5 years if no season specified)
export async function getPlayerGameLogs(sleeperPlayerId: string, playerName: string, season?: string): Promise<GameLog[]> {
  const cacheKey = `gamelogs-${sleeperPlayerId}-${season || "all-5-years"}`;
  const cached = playerStatsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const espnId = await getESPNPlayerId(sleeperPlayerId, playerName);
    if (!espnId) return [];
    
    const gameLogs = await fetchGameLogs(espnId, season);
    playerStatsCache.set(cacheKey, { data: gameLogs, time: Date.now() });
    
    return gameLogs;
  } catch (error) {
    console.error("Error getting game logs:", error);
    return [];
  }
}

// Get career and season stats for a player
export async function getPlayerCareerStats(sleeperPlayerId: string, playerName: string): Promise<{ career: CareerStats | null; seasons: SeasonStats[] }> {
  const cacheKey = `careerstats-${sleeperPlayerId}`;
  const cached = playerStatsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const espnId = await getESPNPlayerId(sleeperPlayerId, playerName);
    if (!espnId) return { career: null, seasons: [] };
    
    const statsData = await fetchPlayerStats(espnId);
    playerStatsCache.set(cacheKey, { data: statsData, time: Date.now() });
    
    return statsData;
  } catch (error) {
    console.error("Error getting career stats:", error);
    return { career: null, seasons: [] };
  }
}

// Get splits data for a player
export async function getPlayerSplits(sleeperPlayerId: string, playerName: string): Promise<PlayerSplits | null> {
  const cacheKey = `splits-${sleeperPlayerId}`;
  const cached = playerStatsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const espnId = await getESPNPlayerId(sleeperPlayerId, playerName);
    if (!espnId) return null;
    
    const splits = await fetchSplits(espnId);
    playerStatsCache.set(cacheKey, { data: splits, time: Date.now() });
    
    return splits;
  } catch (error) {
    console.error("Error getting splits:", error);
    return null;
  }
}

// Clear cache for a specific player
export function clearPlayerCache(sleeperPlayerId: string): void {
  const keysToDelete: string[] = [];
  
  Array.from(playerStatsCache.keys()).forEach(key => {
    if (key.includes(sleeperPlayerId)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => {
    playerStatsCache.delete(key);
  });
}
