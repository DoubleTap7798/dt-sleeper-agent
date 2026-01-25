// Use global fetch (Node 18+)

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
  rawValue: number;
  normalizedValue: number;
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
      const fpIdIdx = header.indexOf('fp_id');

      this.cache.clear();
      let maxVal = 0;
      let minVal = Infinity;
      const rawPlayers: { name: string; pos: string; team: string; age: number | null; value: number; fpId: string | null }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = this.parseCSVLine(line);
        const playerName = cols[playerIdx];
        const pos = cols[posIdx];
        const rawValue = parseFloat(cols[value1qbIdx]);

        if (!playerName || pos === 'PICK' || isNaN(rawValue)) continue;

        const age = cols[ageIdx] && cols[ageIdx] !== 'NA' ? parseFloat(cols[ageIdx]) : null;
        const team = cols[teamIdx] || '';
        const fpId = cols[fpIdIdx] && cols[fpIdIdx] !== 'NA' ? cols[fpIdIdx] : null;

        rawPlayers.push({ name: playerName, pos, team, age, value: rawValue, fpId });

        if (rawValue > maxVal) maxVal = rawValue;
        if (rawValue < minVal && rawValue > 0) minVal = rawValue;
      }

      this.maxRawValue = maxVal;
      this.minRawValue = minVal;

      rawPlayers.sort((a, b) => b.value - a.value);
      
      for (let i = 0; i < rawPlayers.length; i++) {
        const p = rawPlayers[i];
        // Simple normalization: raw value * 0.01 (e.g., 5532 → 55.32)
        // Cap at 99.5 to prevent exact 100 values
        const normalizedValue = Math.min(99.5, Math.max(0, p.value * 0.01));
        const key = this.createPlayerKey(p.name, p.pos);
        
        this.cache.set(key, {
          name: p.name,
          position: p.pos,
          team: p.team,
          age: p.age,
          rawValue: p.value,
          normalizedValue,
          fpId: p.fpId
        });
        this.rankPercentiles.set(key, normalizedValue);
      }

      this.lastFetch = new Date();
      console.log(`[DynastyConsensus] Cached ${this.cache.size} players. Max raw: ${maxVal}, normalized to 0-100 scale`);
      
      const topPlayers = Array.from(this.cache.values())
        .sort((a, b) => b.normalizedValue - a.normalizedValue)
        .slice(0, 5);
      console.log(`[DynastyConsensus] Top 5: ${topPlayers.map(p => `${p.name}: ${p.normalizedValue.toFixed(1)}`).join(', ')}`);
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
