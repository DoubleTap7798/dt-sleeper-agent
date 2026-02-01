// Use global fetch (Node 18+)

// Static fallback values for elite NFL players (ensures correct values if DynastyProcess lookup fails)
// Values on 0-100 scale, updated for 2025-2026 dynasty season
const ELITE_PLAYER_FALLBACKS: Record<string, { value1QB: number; value2QB: number; position: string }> = {
  // Elite QBs
  "josh allen": { value1QB: 75, value2QB: 99, position: "QB" },
  "patrick mahomes": { value1QB: 72, value2QB: 85, position: "QB" },
  "lamar jackson": { value1QB: 70, value2QB: 82, position: "QB" },
  "jalen hurts": { value1QB: 65, value2QB: 78, position: "QB" },
  "joe burrow": { value1QB: 62, value2QB: 75, position: "QB" },
  "cj stroud": { value1QB: 68, value2QB: 80, position: "QB" },
  "caleb williams": { value1QB: 60, value2QB: 72, position: "QB" },
  "jayden daniels": { value1QB: 58, value2QB: 70, position: "QB" },
  
  // Elite RBs
  "bijan robinson": { value1QB: 95, value2QB: 88, position: "RB" },
  "breece hall": { value1QB: 88, value2QB: 82, position: "RB" },
  "jahmyr gibbs": { value1QB: 85, value2QB: 78, position: "RB" },
  "jonathan taylor": { value1QB: 72, value2QB: 65, position: "RB" },
  "saquon barkley": { value1QB: 65, value2QB: 58, position: "RB" },
  "isaiah pacheco": { value1QB: 55, value2QB: 48, position: "RB" },
  "derrick henry": { value1QB: 35, value2QB: 30, position: "RB" },
  "josh jacobs": { value1QB: 45, value2QB: 40, position: "RB" },
  "kyren williams": { value1QB: 55, value2QB: 48, position: "RB" },
  "devon achane": { value1QB: 68, value2QB: 62, position: "RB" },
  "kenneth walker": { value1QB: 52, value2QB: 45, position: "RB" },
  "kenny mcintosh": { value1QB: 18, value2QB: 15, position: "RB" }, // Backup RB
  
  // Elite WRs
  "jamarr chase": { value1QB: 99, value2QB: 92, position: "WR" },
  "ja'marr chase": { value1QB: 99, value2QB: 92, position: "WR" },
  "justin jefferson": { value1QB: 93, value2QB: 85, position: "WR" },
  "ceedee lamb": { value1QB: 94, value2QB: 87, position: "WR" },
  "jaxon smithnjigba": { value1QB: 96, value2QB: 84, position: "WR" },
  "amon-ra st brown": { value1QB: 88, value2QB: 80, position: "WR" },
  "amonra st brown": { value1QB: 88, value2QB: 80, position: "WR" },
  "malik nabers": { value1QB: 90, value2QB: 82, position: "WR" },
  "marvin harrison": { value1QB: 88, value2QB: 80, position: "WR" },
  "garrett wilson": { value1QB: 82, value2QB: 75, position: "WR" },
  "nico collins": { value1QB: 78, value2QB: 72, position: "WR" },
  "drake london": { value1QB: 80, value2QB: 74, position: "WR" },
  "chris olave": { value1QB: 75, value2QB: 68, position: "WR" },
  "aj brown": { value1QB: 72, value2QB: 65, position: "WR" },
  "tyreek hill": { value1QB: 55, value2QB: 48, position: "WR" },
  "davante adams": { value1QB: 48, value2QB: 42, position: "WR" },
  
  // Elite TEs
  "brock bowers": { value1QB: 92, value2QB: 85, position: "TE" }, // Elite TE1
  "sam laporta": { value1QB: 75, value2QB: 68, position: "TE" },
  "trey mcbride": { value1QB: 70, value2QB: 63, position: "TE" },
  "travis kelce": { value1QB: 45, value2QB: 40, position: "TE" },
  "george kittle": { value1QB: 50, value2QB: 45, position: "TE" },
  "dalton kincaid": { value1QB: 68, value2QB: 62, position: "TE" },
  "kyle pitts": { value1QB: 55, value2QB: 50, position: "TE" },
  "mark andrews": { value1QB: 42, value2QB: 38, position: "TE" },
  "evan engram": { value1QB: 35, value2QB: 32, position: "TE" },
};

interface DynastyProcessPlayer {
  player: string;
  pos: string;
  team: string;
  age: number | null;
  draft_year: number | null;
  ecr_1qb: number;
  ecr_2qb: number;
  ecr_pos: number | null;
  value_1qb: number;
  value_2qb: number;
  scrape_date: string;
  fp_id: string | null;
}

interface ConsensusValue {
  name: string;
  position: string;
  team: string;
  age: number | null;
  rawValue1QB: number;
  rawValue2QB: number;
  normalizedValue1QB: number;
  normalizedValue2QB: number;
  fpId: string | null;
}

class DynastyConsensusService {
  private cache: Map<string, ConsensusValue> = new Map();
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
  private readonly CSV_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv";
  private maxRawValue = 10000;
  private minRawValue = 0;
  private rankPercentiles: Map<string, number> = new Map();

  async fetchAndCacheValues(): Promise<void> {
    if (this.lastFetch && (Date.now() - this.lastFetch.getTime()) < this.CACHE_DURATION_MS) {
      console.log(`[DynastyConsensus] Using cached values from ${this.lastFetch.toISOString()}`);
      return;
    }

    try {
      console.log(`[DynastyConsensus] Fetching values from DynastyProcess...`);
      const response = await fetch(this.CSV_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      if (lines.length < 2) {
        throw new Error("CSV appears empty");
      }

      const header = this.parseCSVLine(lines[0]);
      const playerIdx = header.indexOf('player');
      const posIdx = header.indexOf('pos');
      const teamIdx = header.indexOf('team');
      const ageIdx = header.indexOf('age');
      const value1qbIdx = header.indexOf('value_1qb');
      const value2qbIdx = header.indexOf('value_2qb');
      const fpIdIdx = header.indexOf('fp_id');

      this.cache.clear();
      let maxVal = 0;
      let minVal = Infinity;
      const rawPlayers: { name: string; pos: string; team: string; age: number | null; value1QB: number; value2QB: number; fpId: string | null }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = this.parseCSVLine(line);
        const playerName = cols[playerIdx];
        const pos = cols[posIdx];
        const rawValue1QB = parseFloat(cols[value1qbIdx]);
        const rawValue2QB = parseFloat(cols[value2qbIdx]) || rawValue1QB;

        if (!playerName || pos === 'PICK' || isNaN(rawValue1QB)) continue;

        const age = cols[ageIdx] && cols[ageIdx] !== 'NA' ? parseFloat(cols[ageIdx]) : null;
        const team = cols[teamIdx] || '';
        const fpId = cols[fpIdIdx] && cols[fpIdIdx] !== 'NA' ? cols[fpIdIdx] : null;

        rawPlayers.push({ name: playerName, pos, team, age, value1QB: rawValue1QB, value2QB: rawValue2QB, fpId });

        const maxOfBoth = Math.max(rawValue1QB, rawValue2QB);
        if (maxOfBoth > maxVal) maxVal = maxOfBoth;
        if (rawValue1QB < minVal && rawValue1QB > 0) minVal = rawValue1QB;
      }

      this.maxRawValue = maxVal;
      this.minRawValue = minVal;

      rawPlayers.sort((a, b) => b.value1QB - a.value1QB);
      
      for (let i = 0; i < rawPlayers.length; i++) {
        const p = rawPlayers[i];
        // Simple normalization: raw value * 0.01 (e.g., 5532 → 55.32)
        // Cap at 99.5 to prevent exact 100 values
        const normalizedValue1QB = Math.min(99.5, Math.max(0, p.value1QB * 0.01));
        const normalizedValue2QB = Math.min(99.5, Math.max(0, p.value2QB * 0.01));
        const key = this.createPlayerKey(p.name, p.pos);
        
        this.cache.set(key, {
          name: p.name,
          position: p.pos,
          team: p.team,
          age: p.age,
          rawValue1QB: p.value1QB,
          rawValue2QB: p.value2QB,
          normalizedValue1QB,
          normalizedValue2QB,
          fpId: p.fpId
        });
        this.rankPercentiles.set(key, normalizedValue1QB);
      }

      this.lastFetch = new Date();
      console.log(`[DynastyConsensus] Cached ${this.cache.size} players. Max raw: ${maxVal}, normalized to 0-100 scale`);
      
      const topPlayers1QB = Array.from(this.cache.values())
        .sort((a, b) => b.normalizedValue1QB - a.normalizedValue1QB)
        .slice(0, 5);
      console.log(`[DynastyConsensus] Top 5 (1QB): ${topPlayers1QB.map(p => `${p.name}: ${p.normalizedValue1QB.toFixed(1)}`).join(', ')}`);
      
      const topPlayers2QB = Array.from(this.cache.values())
        .sort((a, b) => b.normalizedValue2QB - a.normalizedValue2QB)
        .slice(0, 5);
      console.log(`[DynastyConsensus] Top 5 (2QB/SF): ${topPlayers2QB.map(p => `${p.name}: ${p.normalizedValue2QB.toFixed(1)}`).join(', ')}`);
    } catch (error) {
      console.error(`[DynastyConsensus] Error fetching values:`, error);
      throw error;
    }
  }

  private parseCSVLine(line: string): string[] {
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

  private createPlayerKey(name: string, position: string): string {
    const normalizedName = this.normalizeName(name);
    return `${normalizedName}|${position}`;
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[.''`-]/g, '')
      .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi, '')
      .replace(/\bst\./gi, 'saint')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getConsensusValue(playerName: string, position: string): ConsensusValue | null {
    const key = this.createPlayerKey(playerName, position);
    let value = this.cache.get(key);
    
    if (!value) {
      const normalizedSearch = this.normalizeName(playerName);
      const entries = Array.from(this.cache.entries());
      for (const [k, v] of entries) {
        if (k.includes(normalizedSearch) && k.endsWith(`|${position}`)) {
          value = v;
          break;
        }
      }
    }

    if (!value) {
      const normalizedSearch = this.normalizeName(playerName);
      const entries = Array.from(this.cache.entries());
      for (const [k, v] of entries) {
        const [cachedName, cachedPos] = k.split('|');
        if (cachedPos === position) {
          if (cachedName.includes(normalizedSearch.split(' ')[0]) && 
              cachedName.includes(normalizedSearch.split(' ').pop() || '')) {
            value = v;
            break;
          }
        }
      }
    }

    return value || null;
  }

  getNormalizedValue(playerName: string, position: string, isSuperflex: boolean = false): number | null {
    const consensus = this.getConsensusValue(playerName, position);
    if (consensus) {
      return isSuperflex ? consensus.normalizedValue2QB : consensus.normalizedValue1QB;
    }
    
    // Fall back to static elite player values if DynastyProcess lookup fails
    const normalizedSearchName = this.normalizeName(playerName);
    const fallback = ELITE_PLAYER_FALLBACKS[normalizedSearchName];
    if (fallback && fallback.position === position) {
      return isSuperflex ? fallback.value2QB : fallback.value1QB;
    }
    
    // Try partial name match for fallback (e.g., "Patrick Mahomes II" -> "patrick mahomes")
    for (const [fallbackName, fallbackData] of Object.entries(ELITE_PLAYER_FALLBACKS)) {
      if (fallbackData.position === position) {
        if (normalizedSearchName.includes(fallbackName) || fallbackName.includes(normalizedSearchName.split(' ')[0] + ' ' + (normalizedSearchName.split(' ').pop() || ''))) {
          return isSuperflex ? fallbackData.value2QB : fallbackData.value1QB;
        }
      }
    }
    
    return null;
  }

  blendValues(leagueValue: number, consensusValue: number | null, leagueWeight: number = 0.6): number {
    if (consensusValue === null) {
      return leagueValue;
    }

    const blended = (leagueValue * leagueWeight) + (consensusValue * (1 - leagueWeight));
    return Math.round(blended * 10) / 10;
  }

  getCacheStats(): { size: number; lastFetch: Date | null; maxRaw: number; minRaw: number; available: boolean; matchRate?: number } {
    return {
      size: this.cache.size,
      lastFetch: this.lastFetch,
      maxRaw: this.maxRawValue,
      minRaw: this.minRawValue,
      available: this.cache.size > 0
    };
  }

  isAvailable(): boolean {
    return this.cache.size > 0;
  }

  getAllConsensusValues(): ConsensusValue[] {
    return Array.from(this.cache.values());
  }
}

export const dynastyConsensusService = new DynastyConsensusService();
