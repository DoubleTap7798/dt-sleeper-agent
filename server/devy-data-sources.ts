import { KTCDevyPlayer, KTC_DEVY_PLAYERS, getDevyPlayers } from './ktc-values';

export interface DevySourceRanking {
  rank: number;
  value?: number;
  tier?: number;
  confidence?: number;
}

export interface DevySourceData {
  sourceId: string;
  sourceName: string;
  lastUpdated: string;
  players: Map<string, DevySourceRanking>;
}

export interface MultiSourceDevyPlayer extends KTCDevyPlayer {
  overallRank: number;
  sources: {
    dtDynasty?: DevySourceRanking;
  };
  consensusRank: number;
  sourceAgreement: 'high' | 'medium' | 'low';
  rankVariance: number;
  hotTake?: {
    source: string;
    direction: 'higher' | 'lower';
    difference: number;
  };
}

const DYNASTY_PROCESS_VALUES_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv';

export interface DynastyProcessPlayer {
  player: string;
  pos: string;
  team: string;
  age: string;
  draft_year: string;
  ecr_1qb: string;
  ecr_2qb: string;
  ecr_pos: string;
  value_1qb: string;
  value_2qb: string;
  fantasypros_id: string;
}

let dynastyProcessCache: {
  data: DynastyProcessPlayer[];
  fetchedAt: Date;
} | null = null;

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

async function fetchDynastyProcessValues(): Promise<DynastyProcessPlayer[]> {
  if (dynastyProcessCache && (Date.now() - dynastyProcessCache.fetchedAt.getTime()) < CACHE_DURATION_MS) {
    return dynastyProcessCache.data;
  }

  try {
    const response = await fetch(DYNASTY_PROCESS_VALUES_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Dynasty Process data: ${response.statusText}`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].replace(/"/g, '').split(',');
    const players: DynastyProcessPlayer[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= headers.length) {
        const player: any = {};
        headers.forEach((header, index) => {
          player[header] = values[index];
        });
        if (player.player && player.pos) {
          players.push(player);
        }
      }
    }

    dynastyProcessCache = {
      data: players,
      fetchedAt: new Date()
    };

    console.log(`Fetched ${players.length} players from Dynasty Process`);
    return players;

  } catch (error) {
    console.error('Error fetching Dynasty Process values:', error);
    return dynastyProcessCache?.data || [];
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSourceAgreement(sources: MultiSourceDevyPlayer['sources']): 'high' | 'medium' | 'low' {
  const ranks = Object.values(sources)
    .filter((s): s is DevySourceRanking => s !== undefined && s.rank !== undefined)
    .map(s => s.rank);

  if (ranks.length < 2) return 'high';

  const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  const variance = ranks.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / ranks.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev <= 3) return 'high';
  if (stdDev <= 8) return 'medium';
  return 'low';
}

function calculateRankVariance(sources: MultiSourceDevyPlayer['sources']): number {
  const ranks = Object.values(sources)
    .filter((s): s is DevySourceRanking => s !== undefined && s.rank !== undefined)
    .map(s => s.rank);

  if (ranks.length < 2) return 0;

  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  return max - min;
}

function findHotTake(sources: MultiSourceDevyPlayer['sources'], consensusRank: number): MultiSourceDevyPlayer['hotTake'] {
  const sourceEntries = Object.entries(sources)
    .filter((entry): entry is [string, DevySourceRanking] => {
      const data = entry[1];
      return data !== undefined && data.rank !== undefined;
    });

  if (sourceEntries.length < 2) return undefined;

  let biggestDiff = 0;
  let hotTake: MultiSourceDevyPlayer['hotTake'] = undefined;

  const sourceLabels: Record<string, string> = {
    dtDynasty: 'DT Dynasty'
  };

  for (const [source, data] of sourceEntries) {
    const diff = Math.abs(data.rank - consensusRank);
    if (diff > biggestDiff && diff >= 5) {
      biggestDiff = diff;
      hotTake = {
        source: sourceLabels[source] || source,
        direction: data.rank < consensusRank ? 'higher' : 'lower',
        difference: diff
      };
    }
  }

  return hotTake;
}

export async function getMultiSourceDevyPlayers(): Promise<MultiSourceDevyPlayer[]> {
  const ktcPlayers = getDevyPlayers();
  
  const multiSourcePlayers: MultiSourceDevyPlayer[] = ktcPlayers.map((player, index) => {
    const rank = index + 1;
    
    const sources: MultiSourceDevyPlayer['sources'] = {
      dtDynasty: {
        rank: rank,
        value: player.value,
        tier: player.tier,
        confidence: 100
      }
    };

    const consensusRank = rank;
    const sourceAgreement = calculateSourceAgreement(sources);
    const rankVariance = calculateRankVariance(sources);
    const hotTake = findHotTake(sources, consensusRank);

    return {
      ...player,
      overallRank: rank,
      sources,
      consensusRank,
      sourceAgreement,
      rankVariance,
      hotTake
    };
  });

  return multiSourcePlayers;
}

export async function getDynastyProcessNFLValues(): Promise<DynastyProcessPlayer[]> {
  return fetchDynastyProcessValues();
}

export async function getDynastyProcessPlayerByName(playerName: string): Promise<DynastyProcessPlayer | null> {
  const players = await fetchDynastyProcessValues();
  const normalized = playerName.toLowerCase().trim();
  return players.find(p => p.player.toLowerCase().trim() === normalized) || null;
}

export async function getDynastyProcessECRRankings(format: '1qb' | '2qb' = '1qb'): Promise<{
  player: string;
  pos: string;
  team: string;
  age: number;
  ecr: number;
  value: number;
  fantasypros_id: string;
}[]> {
  const players = await fetchDynastyProcessValues();
  const ecrField = format === '2qb' ? 'ecr_2qb' : 'ecr_1qb';
  const valueField = format === '2qb' ? 'value_2qb' : 'value_1qb';

  return players
    .filter(p => p[ecrField] && parseFloat(p[ecrField]) > 0)
    .map(p => ({
      player: p.player,
      pos: p.pos,
      team: p.team,
      age: parseFloat(p.age) || 0,
      ecr: parseFloat(p[ecrField]) || 999,
      value: parseInt(p[valueField]) || 0,
      fantasypros_id: p.fantasypros_id || '',
    }))
    .sort((a, b) => a.ecr - b.ecr);
}

export interface DataSourceStatus {
  sourceId: string;
  sourceName: string;
  lastUpdated: string;
  playerCount: number;
  status: 'active' | 'stale' | 'error';
}

export async function getDataSourceStatus(): Promise<DataSourceStatus[]> {
  const { getNFLVerseCacheStatus } = await import('./nflverse-stats');
  const nflverseStatus = getNFLVerseCacheStatus();

  const sources: DataSourceStatus[] = [
    {
      sourceId: 'dtDynasty',
      sourceName: 'DT Dynasty (Curated)',
      lastUpdated: new Date().toISOString().split('T')[0],
      playerCount: KTC_DEVY_PLAYERS.length,
      status: 'active'
    }
  ];

  if (dynastyProcessCache) {
    const ageHours = (Date.now() - dynastyProcessCache.fetchedAt.getTime()) / (1000 * 60 * 60);
    sources.push({
      sourceId: 'dynastyProcess',
      sourceName: 'Dynasty Process (NFL Values & ECR)',
      lastUpdated: dynastyProcessCache.fetchedAt.toISOString().split('T')[0],
      playerCount: dynastyProcessCache.data.length,
      status: ageHours < 48 ? 'active' : 'stale'
    });
  }

  if (nflverseStatus.cached && nflverseStatus.fetchedAt) {
    const ageHours = (Date.now() - nflverseStatus.fetchedAt.getTime()) / (1000 * 60 * 60);
    sources.push({
      sourceId: 'nflverse',
      sourceName: `nflverse Player Stats (${nflverseStatus.season})`,
      lastUpdated: nflverseStatus.fetchedAt.toISOString().split('T')[0],
      playerCount: nflverseStatus.playerCount,
      status: ageHours < 48 ? 'active' : 'stale'
    });
  }

  try {
    const cfbd = await import('./cfbd-service');
    const cfbdStatus = cfbd.getCFBDCacheStatus();
    sources.push({
      sourceId: 'cfbd',
      sourceName: 'College Football Data API',
      lastUpdated: cfbdStatus.apiKeyConfigured ? new Date().toISOString().split('T')[0] : 'N/A',
      playerCount: cfbdStatus.entryCount,
      status: cfbdStatus.apiKeyConfigured ? 'active' : 'inactive'
    });
  } catch {
    sources.push({
      sourceId: 'cfbd',
      sourceName: 'College Football Data API',
      lastUpdated: 'N/A',
      playerCount: 0,
      status: 'inactive'
    });
  }

  return sources;
}

export async function refreshAllSources(): Promise<{ success: boolean; message: string }> {
  try {
    const { getNFLVerseStats } = await import('./nflverse-stats');
    
    await fetchDynastyProcessValues();
    await getNFLVerseStats(2024);
    
    return {
      success: true,
      message: `Successfully refreshed all data sources`
    };
  } catch (error) {
    return {
      success: false,
      message: `Error refreshing sources: ${error}`
    };
  }
}
