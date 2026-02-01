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

// IDP position detection
const IDP_POSITIONS = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "ILB", "OLB", "MLB", "NT", "FS", "SS", "ED"];
function isIDPPosition(position: string): boolean {
  return IDP_POSITIONS.includes(position?.toUpperCase() || "");
}

// Cache for Sleeper season stats to avoid duplicate fetches
const sleeperSeasonStatsCache: Map<string, { data: any; time: number }> = new Map();
const SLEEPER_STATS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache for season stats

// Fetch IDP stats from Sleeper with caching
async function fetchSleeperSeasonStats(season: string): Promise<any> {
  const cacheKey = `sleeper-stats-${season}`;
  const cached = sleeperSeasonStatsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < SLEEPER_STATS_CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    sleeperSeasonStatsCache.set(cacheKey, { data, time: Date.now() });
    return data;
  } catch (error) {
    console.error(`Error fetching Sleeper stats for ${season}:`, error);
    return null;
  }
}

// Fetch multiple seasons of IDP stats in parallel with caching
async function fetchIDPSeasonHistory(sleeperPlayerId: string, position: string, currentTeam?: string): Promise<{ career: CareerStats | null; seasons: SeasonStats[] }> {
  if (!isIDPPosition(position)) {
    return { career: null, seasons: [] };
  }
  
  const currentYear = new Date().getFullYear();
  const yearsToFetch = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5];
  
  // Fetch all seasons in parallel
  const seasonStatsPromises = yearsToFetch.map(year => fetchSleeperSeasonStats(year.toString()));
  const allSeasonStats = await Promise.all(seasonStatsPromises);
  
  const seasons: SeasonStats[] = [];
  const careerTotals: Record<string, number> = {};
  let totalGames = 0;
  
  for (let i = 0; i < yearsToFetch.length; i++) {
    const year = yearsToFetch[i];
    const allStats = allSeasonStats[i];
    if (!allStats) continue;
    
    const playerStats = allStats[sleeperPlayerId];
    if (!playerStats) continue;
    
    const games = playerStats.gp || 0;
    if (games > 0) {
      // Map IDP stats to display format
      const stats: Record<string, number | string> = {
        TOT: playerStats.idp_tkl || 0,
        SOLO: playerStats.idp_tkl_solo || 0,
        AST: playerStats.idp_tkl_ast || 0,
        SACK: playerStats.idp_sack || 0,
        TFL: playerStats.idp_tkl_loss || 0,
        "QB HUR": playerStats.idp_qb_hit || 0,
        INT: playerStats.idp_int || 0,
        PD: playerStats.idp_pass_def || 0,
        FF: playerStats.idp_ff || 0,
        FR: playerStats.idp_fum_rec || 0,
        TD: playerStats.idp_def_td || 0,
        SAF: playerStats.idp_safe || 0,
      };
      
      // Use team from stats if available, otherwise use current team
      const team = playerStats.team || currentTeam || "";
      
      seasons.push({
        season: year.toString(),
        team,
        games,
        gamesStarted: playerStats.gs || 0,
        stats,
      });
      
      // Accumulate career totals
      for (const [key, val] of Object.entries(stats)) {
        if (typeof val === "number") {
          careerTotals[key] = (careerTotals[key] || 0) + val;
        }
      }
      totalGames += games;
    }
  }
  
  seasons.sort((a, b) => parseInt(b.season) - parseInt(a.season));
  
  const career: CareerStats | null = totalGames > 0 ? {
    games: totalGames,
    gamesStarted: seasons.reduce((sum, s) => sum + s.gamesStarted, 0),
    stats: careerTotals,
  } : null;
  
  console.log(`[IDP Stats] Fetched ${seasons.length} seasons for player ${sleeperPlayerId}, total games: ${totalGames}`);
  
  return { career, seasons };
}

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

// Fetch player statistics from ESPN - using the web API that works
async function fetchPlayerStats(espnId: string): Promise<{ career: CareerStats | null; seasons: SeasonStats[] }> {
  try {
    // Use the same working web API endpoint format as game logs
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/stats`
    );
    if (!response.ok) {
      console.log(`ESPN stats API returned ${response.status} for player ${espnId}`);
      return { career: null, seasons: [] };
    }
    
    const data = await response.json() as any;
    
    const seasons: SeasonStats[] = [];
    let career: CareerStats | null = null;
    
    // ESPN structure: categories array, each with names, totals (career), and statistics (seasons)
    const categories = data.categories || [];
    
    // Build career stats from all categories' totals
    const careerStats: Record<string, number | string> = {};
    let careerGames = 0;
    
    for (const category of categories) {
      const names = category.names || [];
      const totals = category.totals || [];
      
      // Map career totals
      for (let i = 0; i < names.length && i < totals.length; i++) {
        const name = names[i];
        const val = totals[i];
        if (val !== undefined && val !== null && val !== "-") {
          // Remove commas from numbers like "66,274"
          const cleanVal = typeof val === "string" ? val.replace(/,/g, "") : val;
          const numVal = parseFloat(cleanVal);
          careerStats[name] = isNaN(numVal) ? val : numVal;
          
          if (name === "gamesPlayed" && typeof numVal === "number") {
            careerGames = numVal;
          }
        }
      }
    }
    
    if (Object.keys(careerStats).length > 0) {
      career = {
        games: careerGames,
        gamesStarted: typeof careerStats.gamesStarted === "number" ? careerStats.gamesStarted : 0,
        stats: careerStats,
      };
    }
    
    // Build season stats from first category with statistics (they share the same season structure)
    const seasonMap = new Map<string, { games: number; stats: Record<string, number | string> }>();
    
    for (const category of categories) {
      const names = category.names || [];
      const statistics = category.statistics || [];
      
      for (const stat of statistics) {
        const seasonYear = stat.season?.year?.toString() || "";
        if (!seasonYear) continue;
        
        if (!seasonMap.has(seasonYear)) {
          seasonMap.set(seasonYear, { games: 0, stats: {} });
        }
        
        const seasonData = seasonMap.get(seasonYear)!;
        const statValues = stat.stats || [];
        
        for (let i = 0; i < names.length && i < statValues.length; i++) {
          const name = names[i];
          const val = statValues[i];
          if (val !== undefined && val !== null && val !== "-") {
            const cleanVal = typeof val === "string" ? val.replace(/,/g, "") : val;
            const numVal = parseFloat(cleanVal);
            seasonData.stats[name] = isNaN(numVal) ? val : numVal;
            
            if (name === "gamesPlayed" && typeof numVal === "number") {
              seasonData.games = numVal;
            }
          }
        }
      }
    }
    
    // Convert map to array sorted by season descending
    Array.from(seasonMap.entries()).forEach(([seasonYear, seasonData]) => {
      seasons.push({
        season: seasonYear,
        team: "",
        games: seasonData.games,
        gamesStarted: typeof seasonData.stats.gamesStarted === "number" ? seasonData.stats.gamesStarted : 0,
        stats: seasonData.stats,
      });
    });
    
    seasons.sort((a, b) => parseInt(b.season) - parseInt(a.season));
    
    console.log(`ESPN stats for ${espnId}: ${Object.keys(careerStats).length} career stats, ${seasons.length} seasons`);
    
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

// Fetch splits data from ESPN - using web API
async function fetchSplits(espnId: string): Promise<PlayerSplits | null> {
  try {
    // Use the web API endpoint format
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/splits`
    );
    if (!response.ok) {
      console.log(`ESPN splits API returned ${response.status} for player ${espnId}`);
      return null;
    }
    
    const data = await response.json() as any;
    
    const result: PlayerSplits = {
      home: {},
      away: {},
      wins: {},
      losses: {},
      byMonth: {},
    };
    
    // ESPN splits structure: splitCategories array, each with splits array
    // names array at top level maps to stats array in each split
    const splitCategories = data.splitCategories || [];
    const statNames = data.names || [];
    
    for (const category of splitCategories) {
      const categoryName = (category.name || category.displayName || "").toLowerCase();
      const splits = category.splits || [];
      
      for (const split of splits) {
        const splitName = (split.name || split.displayName || "").toLowerCase();
        
        // Build stats from values array
        const stats: Record<string, number | string> = {};
        const statValues = split.stats || [];
        
        for (let i = 0; i < statNames.length && i < statValues.length; i++) {
          const val = statValues[i];
          if (val !== undefined && val !== null && val !== "-") {
            const cleanVal = typeof val === "string" ? val.replace(/,/g, "") : val;
            const numVal = parseFloat(cleanVal);
            stats[statNames[i]] = isNaN(numVal) ? val : numVal;
          }
        }
        
        if (splitName === "home") {
          result.home = stats;
        } else if (splitName === "away") {
          result.away = stats;
        } else if (splitName.includes("win")) {
          result.wins = stats;
        } else if (splitName.includes("loss")) {
          result.losses = stats;
        } else if (categoryName === "month") {
          result.byMonth[split.displayName || split.name || splitName] = stats;
        }
      }
    }
    
    // Check if we got any meaningful data
    const hasData = Object.keys(result.home).length > 0 || 
                    Object.keys(result.away).length > 0 ||
                    Object.keys(result.wins).length > 0;
    
    console.log(`ESPN splits for ${espnId}: home=${Object.keys(result.home).length}, away=${Object.keys(result.away).length}, wins=${Object.keys(result.wins).length}`);
    
    return hasData ? result : null;
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
    // For IDP players, fetch IDP stats from Sleeper
    let careerStats: CareerStats | null = null;
    let seasonStats: SeasonStats[] = [];
    
    if (isIDPPosition(sleeperData.position)) {
      const idpStats = await fetchIDPSeasonHistory(playerId, sleeperData.position, sleeperData.team);
      careerStats = idpStats.career;
      seasonStats = idpStats.seasons;
    }
    
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
      careerStats,
      seasonStats,
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
  const cacheKey = `profile-v18-${sleeperPlayerId}`;
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
    
    // Helper function to fix QB interceptions from game logs
    // ESPN career stats "interceptions" field shows defensive INTs caught, not passing INTs thrown
    const applyQbIntsFix = (
      position: string,
      playerNameForLog: string,
      gameLogsData: GameLog[],
      careerStatsInput: any,
      seasonStatsInput: any[]
    ): { careerStats: any; seasonStats: any[] } => {
      if (position !== "QB") {
        return { careerStats: careerStatsInput, seasonStats: seasonStatsInput };
      }
      
      console.log(`[QB FIX] Applying interceptions fix for ${playerNameForLog}`);
      
      // Helper to get interceptions from game log stats (ESPN uses different field names)
      const getIntsFromLog = (stats: Record<string, number | string>): number => {
        const possibleKeys = ["INT", "interceptions", "passingInterceptions", "int", "Interceptions"];
        for (const key of possibleKeys) {
          if (stats[key] !== undefined && stats[key] !== null && stats[key] !== "-") {
            const val = Number(stats[key]);
            if (!isNaN(val)) return val;
          }
        }
        return 0;
      };
      
      // Log first game's stat keys for debugging
      if (gameLogsData.length > 0) {
        const sampleKeys = Object.keys(gameLogsData[0].stats);
        console.log(`[QB INT Debug] ${playerNameForLog}: game log stat keys = [${sampleKeys.join(", ")}]`);
      }
      
      // Build a map of season -> INTs from game logs
      const seasonIntsMap = new Map<string, number>();
      for (const log of gameLogsData) {
        const gameInts = getIntsFromLog(log.stats);
        const current = seasonIntsMap.get(log.season) || 0;
        seasonIntsMap.set(log.season, current + gameInts);
      }
      
      // Calculate career INTs from game logs
      const careerIntsFromLogs = gameLogsData.reduce((sum, log) => sum + getIntsFromLog(log.stats), 0);
      
      // Apply game log INTs to season stats
      const fixedSeasonStats = seasonStatsInput.map(season => {
        const seasonIntsFromLogs = seasonIntsMap.get(season.season);
        if (seasonIntsFromLogs !== undefined) {
          return {
            ...season,
            stats: { ...season.stats, interceptions: seasonIntsFromLogs },
          };
        }
        return season;
      });
      
      console.log(`[QB INT] ${playerNameForLog}: careerIntsFromLogs=${careerIntsFromLogs}, seasonsWithData=${seasonIntsMap.size}, gameLogsAnalyzed=${gameLogsData.length}`);
      
      // Update career stats with game log INT total
      let fixedCareerStats = careerStatsInput;
      if (careerStatsInput && gameLogsData.length > 0) {
        fixedCareerStats = {
          ...careerStatsInput,
          stats: { ...careerStatsInput.stats, interceptions: careerIntsFromLogs },
        };
      }
      
      return { careerStats: fixedCareerStats, seasonStats: fixedSeasonStats };
    };
    
    // If ESPN bio fails, fall back to Sleeper data but keep any ESPN data we got
    if (!bio) {
      const sleeperProfile = await createProfileFromSleeper(sleeperPlayerId, playerName);
      console.log(`[PROFILE DEBUG] ${playerName}: ESPN bio null, using Sleeper bio. position=${sleeperProfile.bio.position}`);
      
      // For IDP players, use the IDP stats already fetched in sleeperProfile
      if (isIDPPosition(sleeperProfile.bio.position) && sleeperProfile.seasonStats.length > 0) {
        console.log(`[IDP PROFILE] ${playerName}: Using IDP stats from Sleeper profile for position ${sleeperProfile.bio.position}`);
        
        const profile: PlayerProfile = {
          bio: sleeperProfile.bio,
          careerStats: sleeperProfile.careerStats,
          seasonStats: sleeperProfile.seasonStats,
          recentGameLogs: sleeperProfile.recentGameLogs,
          splits: splits || sleeperProfile.splits,
          espnId,
        };
        playerStatsCache.set(cacheKey, { data: profile, time: Date.now() });
        return profile;
      }
      
      // Determine what career/season stats to use
      let mergedCareerStats = statsData.career || sleeperProfile.careerStats;
      let mergedSeasonStats = statsData.seasons.length > 0 ? statsData.seasons : sleeperProfile.seasonStats;
      const mergedGameLogs = gameLogs.length > 0 ? gameLogs : sleeperProfile.recentGameLogs;
      
      // Apply QB fix if position is QB (using Sleeper position)
      const fixedStats = applyQbIntsFix(
        sleeperProfile.bio.position,
        playerName,
        mergedGameLogs,
        mergedCareerStats,
        mergedSeasonStats
      );
      
      const profile: PlayerProfile = {
        bio: sleeperProfile.bio,
        careerStats: fixedStats.careerStats,
        seasonStats: fixedStats.seasonStats,
        recentGameLogs: mergedGameLogs,
        splits: splits || sleeperProfile.splits,
        espnId,
      };
      playerStatsCache.set(cacheKey, { data: profile, time: Date.now() });
      return profile;
    }
    
    console.log(`[PROFILE DEBUG] ${playerName}: bio.position=${bio.position}, gameLogs.length=${gameLogs.length}`);
    
    // For IDP players, use Sleeper IDP stats (ESPN often doesn't return defensive stats properly)
    if (isIDPPosition(bio.position)) {
      console.log(`[IDP PROFILE] ${playerName}: Fetching IDP stats from Sleeper for position ${bio.position}`);
      const idpStats = await fetchIDPSeasonHistory(sleeperPlayerId, bio.position, bio.teamAbbr || bio.team);
      
      // If we got IDP stats from Sleeper, use those
      if (idpStats.seasons.length > 0) {
        const profile: PlayerProfile = {
          bio,
          careerStats: idpStats.career,
          seasonStats: idpStats.seasons,
          recentGameLogs: gameLogs,
          splits,
          espnId,
        };
        playerStatsCache.set(cacheKey, { data: profile, time: Date.now() });
        return profile;
      }
    }
    
    // Apply QB interceptions fix
    const fixedStats = applyQbIntsFix(
      bio.position,
      playerName,
      gameLogs,
      statsData.career,
      statsData.seasons
    );
    let careerStats = fixedStats.careerStats;
    let seasonStats = fixedStats.seasonStats;
    
    const profile: PlayerProfile = {
      bio,
      careerStats,
      seasonStats,
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
