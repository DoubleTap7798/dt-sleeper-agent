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
    fantasyPros?: DevySourceRanking;
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

export interface FantasyProsDevyEntry {
  rank: number;
  name: string;
  position: string;
  positionRank: number;
}

export const FANTASYPROS_DEVY_RANKINGS: FantasyProsDevyEntry[] = [
  { rank: 1, name: "J. Smith", position: "WR", positionRank: 1 },
  { rank: 2, name: "Bo Jackson", position: "RB", positionRank: 1 },
  { rank: 3, name: "J. Haynes", position: "RB", positionRank: 2 },
  { rank: 4, name: "A. Hardy", position: "RB", positionRank: 3 },
  { rank: 5, name: "C. Coleman", position: "WR", positionRank: 2 },
  { rank: 6, name: "K. Lacy", position: "RB", positionRank: 4 },
  { rank: 7, name: "N. Marsh", position: "WR", positionRank: 3 },
  { rank: 8, name: "A. Manning", position: "QB", positionRank: 1 },
  { rank: 9, name: "M. Toney", position: "WR", positionRank: 4 },
  { rank: 10, name: "L. Sellers", position: "QB", positionRank: 2 },
  { rank: 11, name: "D. Moore", position: "WR", positionRank: 5 },
  { rank: 12, name: "TJ Moore", position: "WR", positionRank: 6 },
  { rank: 13, name: "R. Williams", position: "WR", positionRank: 7 },
  { rank: 14, name: "D. Moore", position: "QB", positionRank: 3 },
  { rank: 15, name: "B. Wesco", position: "WR", positionRank: 8 },
  { rank: 16, name: "I. Brown", position: "RB", positionRank: 5 },
  { rank: 17, name: "J. Sayin", position: "QB", positionRank: 4 },
  { rank: 18, name: "M. Craver", position: "WR", positionRank: 9 },
  { rank: 19, name: "S. Hiter", position: "RB", positionRank: 6 },
  { rank: 20, name: "S. Leavitt", position: "QB", positionRank: 5 },
  { rank: 21, name: "B. Underwood", position: "QB", positionRank: 6 },
  { rank: 22, name: "C. Henry Jr.", position: "WR", positionRank: 10 },
  { rank: 23, name: "O. Kromah", position: "RB", positionRank: 7 },
  { rank: 24, name: "N. Frazier", position: "RB", positionRank: 8 },
  { rank: 25, name: "J. Hoover", position: "QB", positionRank: 7 },
  { rank: 26, name: "J. Davison", position: "RB", positionRank: 9 },
  { rank: 27, name: "E. Crowell", position: "RB", positionRank: 10 },
  { rank: 28, name: "D. Smothers", position: "RB", positionRank: 11 },
  { rank: 29, name: "T. Keys", position: "WR", positionRank: 11 },
  { rank: 30, name: "J. Baugh", position: "RB", positionRank: 12 },
  { rank: 31, name: "E. Singleton Jr.", position: "WR", positionRank: 12 },
  { rank: 32, name: "T. Green", position: "TE", positionRank: 1 },
  { rank: 33, name: "D. Wilson", position: "WR", positionRank: 13 },
  { rank: 34, name: "J. Mateer", position: "QB", positionRank: 8 },
  { rank: 35, name: "C. Durham", position: "RB", positionRank: 13 },
  { rank: 36, name: "J. Lott", position: "WR", positionRank: 14 },
  { rank: 37, name: "E. Feaster", position: "WR", positionRank: 15 },
  { rank: 38, name: "J. Hatton Jr.", position: "RB", positionRank: 14 },
  { rank: 39, name: "D. Taylor", position: "RB", positionRank: 15 },
  { rank: 40, name: "E. Wilson III", position: "WR", positionRank: 16 },
  { rank: 41, name: "J. Brown", position: "WR", positionRank: 17 },
  { rank: 42, name: "C. Russell", position: "WR", positionRank: 18 },
  { rank: 43, name: "L.J. Martin", position: "RB", positionRank: 16 },
  { rank: 44, name: "K. Russell", position: "QB", positionRank: 9 },
  { rank: 45, name: "V. Brown III", position: "WR", positionRank: 19 },
  { rank: 46, name: "B. Sorsby", position: "QB", positionRank: 10 },
  { rank: 47, name: "CJ Baxter", position: "RB", positionRank: 17 },
  { rank: 48, name: "E. Mosley", position: "WR", positionRank: 20 },
  { rank: 49, name: "W. Parker", position: "RB", positionRank: 18 },
  { rank: 50, name: "R. Wingo", position: "WR", positionRank: 21 },
  { rank: 51, name: "M. Simmons", position: "WR", positionRank: 22 },
  { rank: 52, name: "K.J. Edwards", position: "RB", positionRank: 19 },
  { rank: 53, name: "J. Marshall", position: "RB", positionRank: 20 },
  { rank: 54, name: "A. Marsh", position: "WR", positionRank: 23 },
  { rank: 55, name: "I. Strong", position: "WR", positionRank: 24 },
  { rank: 56, name: "J. Sagapolutele", position: "QB", positionRank: 11 },
  { rank: 57, name: "DJ Lagway", position: "QB", positionRank: 12 },
  { rank: 58, name: "L. Brooks", position: "WR", positionRank: 25 },
  { rank: 59, name: "W. Jordan", position: "RB", positionRank: 21 },
  { rank: 60, name: "D. Raiola", position: "QB", positionRank: 13 },
  { rank: 61, name: "B. Washington", position: "RB", positionRank: 22 },
  { rank: 62, name: "D. Knight", position: "QB", positionRank: 14 },
  { rank: 63, name: "M. Fletcher", position: "RB", positionRank: 23 },
  { rank: 64, name: "S. Mills-Knight", position: "RB", positionRank: 24 },
  { rank: 65, name: "J. Curtis", position: "QB", positionRank: 15 },
  { rank: 66, name: "Q. Porter", position: "WR", positionRank: 26 },
  { rank: 67, name: "KJ Duff", position: "WR", positionRank: 27 },
  { rank: 68, name: "J. Osborne", position: "RB", positionRank: 25 },
  { rank: 69, name: "H. Berry", position: "RB", positionRank: 26 },
  { rank: 70, name: "K. Henderson", position: "QB", positionRank: 16 },
  { rank: 71, name: "J. Cook II", position: "WR", positionRank: 28 },
  { rank: 72, name: "M. Washington", position: "QB", positionRank: 17 },
  { rank: 73, name: "F. Bothwell", position: "RB", positionRank: 27 },
  { rank: 74, name: "D. Hill Jr.", position: "RB", positionRank: 28 },
  { rank: 75, name: "E. Stewart", position: "WR", positionRank: 29 },
  { rank: 76, name: "CJ Bailey", position: "QB", positionRank: 18 },
  { rank: 77, name: "A. Raymond", position: "RB", positionRank: 29 },
  { rank: 78, name: "W. Young", position: "WR", positionRank: 30 },
  { rank: 79, name: "S. Wingo", position: "WR", positionRank: 31 },
  { rank: 80, name: "J. Johnson", position: "TE", positionRank: 2 },
  { rank: 81, name: "B. Bentley", position: "QB", positionRank: 19 },
  { rank: 82, name: "N. Harbor", position: "WR", positionRank: 32 },
  { rank: 83, name: "N. Hunter", position: "WR", positionRank: 33 },
  { rank: 84, name: "J. Barney", position: "WR", positionRank: 34 },
  { rank: 85, name: "C. Barkate", position: "WR", positionRank: 35 },
  { rank: 86, name: "B. Staley", position: "WR", positionRank: 36 },
  { rank: 87, name: "M. Matthews", position: "WR", positionRank: 37 },
  { rank: 88, name: "Q. Wisner", position: "RB", positionRank: 30 },
  { rank: 89, name: "J. Walton", position: "RB", positionRank: 31 },
  { rank: 90, name: "D. Robinson", position: "WR", positionRank: 38 },
  { rank: 91, name: "T. Bell", position: "RB", positionRank: 32 },
  { rank: 92, name: "D. Mensah", position: "QB", positionRank: 20 },
  { rank: 93, name: "R. Becht", position: "QB", positionRank: 21 },
  { rank: 94, name: "N. Burroughs", position: "WR", positionRank: 39 },
  { rank: 95, name: "N. Iamaleava", position: "QB", positionRank: 22 },
  { rank: 96, name: "C. Morgan", position: "WR", positionRank: 40 },
  { rank: 97, name: "T. Taylor", position: "WR", positionRank: 41 },
  { rank: 98, name: "K. Lockett", position: "WR", positionRank: 42 },
  { rank: 99, name: "M. Reed", position: "QB", positionRank: 23 },
  { rank: 100, name: "L. Reynolds", position: "TE", positionRank: 3 },
];

const FANTASYPROS_NAME_MAP: Record<string, string> = {
  "J. Smith": "Jeremiah Smith",
  "Bo Jackson": "Bo Jackson",
  "J. Haynes": "Jaylen Haynes",
  "A. Hardy": "Ahmad Hardy",
  "C. Coleman": "Cam Coleman",
  "K. Lacy": "Kyren Lacy",
  "N. Marsh": "Naeshaun Marsh",
  "A. Manning": "Arch Manning",
  "M. Toney": "Malachi Toney",
  "L. Sellers": "LaNorris Sellers",
  "D. Moore": "Dante Moore",
  "TJ Moore": "TJ Moore",
  "R. Williams": "Ryan Williams",
  "B. Wesco": "Bryant Wesco Jr.",
  "I. Brown": "Isaac Brown",
  "J. Sayin": "Julian Sayin",
  "M. Craver": "Marcus Craver",
  "S. Hiter": "Sedrick Hiter",
  "S. Leavitt": "Sam Leavitt",
  "B. Underwood": "Bryce Underwood",
  "C. Henry Jr.": "Chris Henry Jr.",
  "O. Kromah": "Omarion Kromah",
  "N. Frazier": "Nate Frazier",
  "J. Hoover": "Jaron Hoover",
  "J. Davison": "Jamarion Davison",
  "E. Crowell": "Elijah Crowell",
  "D. Smothers": "Demond Smothers",
  "T. Keys": "Terrion Keys",
  "J. Baugh": "Jaydon Baugh",
  "E. Singleton Jr.": "Emmanuel Singleton Jr.",
  "T. Green": "Tyler Green",
  "D. Wilson": "David Wilson",
  "J. Mateer": "John Mateer",
  "C. Durham": "Cameron Durham",
  "J. Lott": "Jaylin Lott",
  "E. Feaster": "Elijah Feaster",
  "J. Hatton Jr.": "Jaquez Hatton Jr.",
  "D. Taylor": "Devin Taylor",
  "E. Wilson III": "Eddie Wilson III",
  "J. Brown": "Jeremiah Brown",
  "C. Russell": "Collin Russell",
  "L.J. Martin": "L.J. Martin",
  "K. Russell": "Keelon Russell",
  "V. Brown III": "Vincent Brown III",
  "B. Sorsby": "Brendan Sorsby",
  "CJ Baxter": "CJ Baxter",
  "E. Mosley": "Elijah Mosley",
  "W. Parker": "Will Parker",
  "R. Wingo": "Ryan Wingo",
  "M. Simmons": "Marcus Simmons",
  "K.J. Edwards": "K.J. Edwards",
  "J. Marshall": "Jaylen Marshall",
  "A. Marsh": "Amare Marsh",
  "I. Strong": "Isaiah Strong",
  "J. Sagapolutele": "Jaron Sagapolutele",
  "DJ Lagway": "DJ Lagway",
  "L. Brooks": "Lorenzo Brooks",
  "W. Jordan": "Will Jordan",
  "D. Raiola": "Dylan Raiola",
  "B. Washington": "Bryson Washington",
  "D. Knight": "Devin Knight",
  "M. Fletcher": "Micah Fletcher",
  "S. Mills-Knight": "Sedrick Mills-Knight",
  "J. Curtis": "Jayden Curtis",
  "Q. Porter": "Quincy Porter",
  "KJ Duff": "KJ Duff",
  "J. Osborne": "Jaylen Osborne",
  "H. Berry": "Harold Berry",
  "K. Henderson": "Khalil Henderson",
  "J. Cook II": "James Cook II",
  "M. Washington": "Marcus Washington",
  "F. Bothwell": "Frank Bothwell",
  "D. Hill Jr.": "Dontay Hill Jr.",
  "E. Stewart": "Elijah Stewart",
  "CJ Bailey": "CJ Bailey",
  "A. Raymond": "Aaron Raymond",
  "W. Young": "Wendell Young",
  "S. Wingo": "Savion Wingo",
  "J. Johnson": "Jalen Johnson",
  "B. Bentley": "Blake Bentley",
  "N. Harbor": "Nyck Harbor",
  "N. Hunter": "Nate Hunter",
  "J. Barney": "Jeremiah Barney",
  "C. Barkate": "Colby Barkate",
  "B. Staley": "Braylon Staley",
  "M. Matthews": "Marcus Matthews",
  "Q. Wisner": "Quintrevion Wisner",
  "J. Walton": "Jalen Walton",
  "D. Robinson": "Dakorien Robinson",
  "T. Bell": "Trey Bell",
  "D. Mensah": "Daniel Mensah",
  "R. Becht": "Rocco Becht",
  "N. Burroughs": "Nate Burroughs",
  "N. Iamaleava": "Nico Iamaleava",
  "C. Morgan": "Cam Morgan",
  "T. Taylor": "Tre Taylor",
  "K. Lockett": "Kendall Lockett",
  "M. Reed": "Michael Reed",
  "L. Reynolds": "Luke Reynolds",
};

export function getFantasyProsRankByName(playerName: string, playerPosition?: string): number | null {
  const normalizedTarget = playerName.toLowerCase().trim();
  
  const matches: FantasyProsDevyEntry[] = [];
  for (const entry of FANTASYPROS_DEVY_RANKINGS) {
    const fullName = FANTASYPROS_NAME_MAP[entry.name];
    if (fullName && fullName.toLowerCase().trim() === normalizedTarget) {
      matches.push(entry);
    }
  }
  
  if (matches.length === 1) return matches[0].rank;
  if (matches.length > 1 && playerPosition) {
    const posMatch = matches.find(m => m.position === playerPosition);
    if (posMatch) return posMatch.rank;
  }
  if (matches.length > 1) return matches[0].rank;
  
  const lastNameTarget = normalizedTarget.split(' ').pop() || '';
  const firstInitialTarget = normalizedTarget.charAt(0);
  for (const entry of FANTASYPROS_DEVY_RANKINGS) {
    const fullName = FANTASYPROS_NAME_MAP[entry.name];
    if (!fullName) continue;
    const normalized = fullName.toLowerCase().trim();
    const lastName = normalized.split(' ').pop() || '';
    const firstInitial = normalized.charAt(0);
    if (lastName === lastNameTarget && firstInitial === firstInitialTarget) {
      if (!playerPosition || entry.position === playerPosition) {
        return entry.rank;
      }
    }
  }
  return null;
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
    dtDynasty: 'DT Dynasty',
    fantasyPros: 'FantasyPros'
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

    const fpRank = getFantasyProsRankByName(player.name, player.position);
    if (fpRank !== null) {
      sources.fantasyPros = {
        rank: fpRank,
        confidence: 90
      };
    }

    const ranksForConsensus = [rank];
    if (fpRank !== null) ranksForConsensus.push(fpRank);
    const consensusRank = Math.round(ranksForConsensus.reduce((a, b) => a + b, 0) / ranksForConsensus.length);
    
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
    },
    {
      sourceId: 'fantasyPros',
      sourceName: 'FantasyPros Devy Rankings',
      lastUpdated: '2026-02-12',
      playerCount: FANTASYPROS_DEVY_RANKINGS.length,
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
