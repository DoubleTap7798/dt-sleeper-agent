const CFBD_BASE_URL = 'https://api.collegefootballdata.com';

function getApiKey(): string {
  return process.env.CFBD_API_KEY || '';
}

function getHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Accept': 'application/json',
  };
}

export interface CFBDPlayerSearchResult {
  id: number;
  team: string;
  name: string;
  firstName: string;
  lastName: string;
  weight: number;
  height: number;
  jersey: number;
  position: string;
  hometown: string;
  teamColor: string;
  teamColorSecondary: string;
}

export interface CFBDPlayerSeasonStat {
  playerId: number;
  player: string;
  team: string;
  conference: string;
  category: string;
  statType: string;
  stat: number;
}

export interface CFBDPlayerUsage {
  season: number;
  id: number;
  name: string;
  position: string;
  team: string;
  conference: string;
  usage: {
    overall: number;
    pass: number;
    rush: number;
    firstDown: number;
    secondDown: number;
    thirdDown: number;
    standardDowns: number;
    passingDowns: number;
  };
}

export interface CFBDPlayerPPA {
  season: number;
  id: number;
  name: string;
  position: string;
  team: string;
  conference: string;
  countablePlays: number;
  averagePPA: {
    all: number;
    pass: number;
    rush: number;
    firstDown: number;
    secondDown: number;
    thirdDown: number;
    standardDowns: number;
    passingDowns: number;
  };
  totalPPA: {
    all: number;
    pass: number;
    rush: number;
    firstDown: number;
    secondDown: number;
    thirdDown: number;
    standardDowns: number;
    passingDowns: number;
  };
}

export interface CFBDPlayerGameStat {
  id: number;
  teams: Array<{
    school: string;
    conference: string;
    homeAway: string;
    points: number;
    categories: Array<{
      name: string;
      types: Array<{
        name: string;
        athletes: Array<{
          id: string;
          name: string;
          stat: string;
        }>;
      }>;
    }>;
  }>;
}

export interface CFBDReturningProduction {
  season: number;
  team: string;
  conference: string;
  totalPPA: number;
  totalPassingPPA: number;
  totalReceivingPPA: number;
  totalRushingPPA: number;
  percentPPA: number;
  percentPassingPPA: number;
  percentReceivingPPA: number;
  percentRushingPPA: number;
  usage: number;
  passingUsage: number;
  receivingUsage: number;
  rushingUsage: number;
}

export interface CFBDPlayerProfile {
  searchResult: CFBDPlayerSearchResult | null;
  seasonStats: Record<string, Record<string, number>>;
  usage: CFBDPlayerUsage | null;
  ppa: CFBDPlayerPPA | null;
}

export interface CFBDCacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const cache = new Map<string, CFBDCacheEntry<any>>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && (Date.now() - entry.fetchedAt) < CACHE_DURATION_MS) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, fetchedAt: Date.now() });
}

async function cfbdFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('CFBD_API_KEY not configured');
  }

  const queryString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `${CFBD_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
  const cacheKey = url;

  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(url, { headers: getHeaders() });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`CFBD API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as T;
  setCache(cacheKey, data);
  return data;
}

export async function searchPlayer(name: string, team?: string, year?: number): Promise<CFBDPlayerSearchResult[]> {
  const params: Record<string, string | number> = { searchTerm: name };
  if (team) params.team = team;
  if (year) params.year = year;

  return cfbdFetch<CFBDPlayerSearchResult[]>('/player/search', params);
}

export async function getPlayerSeasonStats(
  year: number,
  options: { team?: string; conference?: string; category?: string } = {}
): Promise<CFBDPlayerSeasonStat[]> {
  const params: Record<string, string | number> = { year };
  if (options.team) params.team = options.team;
  if (options.conference) params.conference = options.conference;
  if (options.category) params.category = options.category;

  return cfbdFetch<CFBDPlayerSeasonStat[]>('/stats/player/season', params);
}

export async function getPlayerUsage(
  year: number,
  options: { team?: string; conference?: string; position?: string; playerId?: number } = {}
): Promise<CFBDPlayerUsage[]> {
  const params: Record<string, string | number> = { year };
  if (options.team) params.team = options.team;
  if (options.conference) params.conference = options.conference;
  if (options.position) params.position = options.position;
  if (options.playerId) params.playerId = options.playerId;

  return cfbdFetch<CFBDPlayerUsage[]>('/player/usage', params);
}

export async function getPlayerPPASeason(
  year: number,
  options: { team?: string; conference?: string; position?: string; playerId?: number; threshold?: number } = {}
): Promise<CFBDPlayerPPA[]> {
  const params: Record<string, string | number> = { year };
  if (options.team) params.team = options.team;
  if (options.conference) params.conference = options.conference;
  if (options.position) params.position = options.position;
  if (options.playerId) params.playerId = options.playerId;
  if (options.threshold) params.threshold = options.threshold;

  return cfbdFetch<CFBDPlayerPPA[]>('/ppa/players/season', params);
}

export async function getReturningProduction(
  year: number,
  options: { team?: string; conference?: string } = {}
): Promise<CFBDReturningProduction[]> {
  const params: Record<string, string | number> = { year };
  if (options.team) params.team = options.team;
  if (options.conference) params.conference = options.conference;

  return cfbdFetch<CFBDReturningProduction[]>('/player/returning', params);
}

function getMostRecentCFBSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) return year;
  return year - 1;
}

function normalizeTeamName(college: string): string {
  const mappings: Record<string, string> = {
    'Ohio State': 'Ohio State',
    'Notre Dame': 'Notre Dame',
    'Penn State': 'Penn State',
    'Michigan State': 'Michigan State',
    'Texas A&M': 'Texas A&M',
    'South Carolina': 'South Carolina',
    'North Carolina': 'North Carolina',
    'Oklahoma State': 'Oklahoma State',
    'Florida State': 'Florida State',
    'Mississippi State': 'Mississippi State',
    'Ole Miss': 'Mississippi',
    'LSU': 'LSU',
    'USC': 'USC',
    'UCLA': 'UCLA',
    'UCF': 'UCF',
    'SMU': 'SMU',
    'TCU': 'TCU',
    'BYU': 'BYU',
  };
  return mappings[college] || college;
}

export async function getFullPlayerProfile(
  playerName: string,
  college: string,
  position: string
): Promise<CFBDPlayerProfile> {
  const cacheKey = `profile:${playerName}:${college}`;
  const cached = getCached<CFBDPlayerProfile>(cacheKey);
  if (cached) return cached;

  const season = getMostRecentCFBSeason();
  const team = normalizeTeamName(college);

  let searchResult: CFBDPlayerSearchResult | null = null;
  let seasonStats: Record<string, Record<string, number>> = {};
  let usage: CFBDPlayerUsage | null = null;
  let ppa: CFBDPlayerPPA | null = null;

  try {
    const results = await searchPlayer(playerName, team);
    if (results.length > 0) {
      searchResult = results[0];
    }
  } catch (err) {
    console.error(`[CFBD] Player search failed for ${playerName}:`, err);
  }

  const categories = position === 'QB' 
    ? ['passing', 'rushing']
    : position === 'RB' 
    ? ['rushing', 'receiving']
    : ['receiving', 'rushing'];

  const statPromises = categories.map(async (category) => {
    try {
      const stats = await getPlayerSeasonStats(season, { team, category });
      const playerStats = stats.filter(s => 
        s.player.toLowerCase().includes(playerName.split(' ').pop()?.toLowerCase() || '') &&
        s.player.toLowerCase().includes(playerName.split(' ')[0]?.toLowerCase() || '')
      );
      
      if (!seasonStats[category]) seasonStats[category] = {};
      for (const stat of playerStats) {
        seasonStats[category][stat.statType] = stat.stat;
      }
    } catch (err) {
      console.error(`[CFBD] Stats fetch failed for ${playerName} (${category}):`, err);
    }
  });

  const usagePromise = (async () => {
    try {
      const usageData = await getPlayerUsage(season, { team });
      const playerUsage = usageData.find(u =>
        u.name.toLowerCase().includes(playerName.split(' ').pop()?.toLowerCase() || '') &&
        u.name.toLowerCase().includes(playerName.split(' ')[0]?.toLowerCase() || '')
      );
      if (playerUsage) usage = playerUsage;
    } catch (err) {
      console.error(`[CFBD] Usage fetch failed for ${playerName}:`, err);
    }
  })();

  const ppaPromise = (async () => {
    try {
      const ppaData = await getPlayerPPASeason(season, { team });
      const playerPPA = ppaData.find(p =>
        p.name.toLowerCase().includes(playerName.split(' ').pop()?.toLowerCase() || '') &&
        p.name.toLowerCase().includes(playerName.split(' ')[0]?.toLowerCase() || '')
      );
      if (playerPPA) ppa = playerPPA;
    } catch (err) {
      console.error(`[CFBD] PPA fetch failed for ${playerName}:`, err);
    }
  })();

  await Promise.all([...statPromises, usagePromise, ppaPromise]);

  const profile: CFBDPlayerProfile = { searchResult, seasonStats, usage, ppa };
  setCache(cacheKey, profile);
  return profile;
}

export async function getTeamPlayerStats(
  team: string,
  year?: number
): Promise<{
  passing: CFBDPlayerSeasonStat[];
  rushing: CFBDPlayerSeasonStat[];
  receiving: CFBDPlayerSeasonStat[];
}> {
  const season = year || getMostRecentCFBSeason();
  const normalizedTeam = normalizeTeamName(team);

  const [passing, rushing, receiving] = await Promise.all([
    getPlayerSeasonStats(season, { team: normalizedTeam, category: 'passing' }),
    getPlayerSeasonStats(season, { team: normalizedTeam, category: 'rushing' }),
    getPlayerSeasonStats(season, { team: normalizedTeam, category: 'receiving' }),
  ]);

  return { passing, rushing, receiving };
}

export function getCFBDCacheStatus(): { 
  cached: boolean; 
  entryCount: number; 
  apiKeyConfigured: boolean;
} {
  return {
    cached: cache.size > 0,
    entryCount: cache.size,
    apiKeyConfigured: !!getApiKey(),
  };
}
