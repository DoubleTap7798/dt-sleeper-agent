import { db } from "../db";
import { externalRankings } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as sleeperApi from "../sleeper-api";

const DYNASTYPROCESS_CSV_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv";

interface DPRow {
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
  scrape_date: string;
  fp_id: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(jr\.?|sr\.?|iii|ii|iv|v)$/i, "")
    .replace(/[.'''`]/g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const POSITION_MAP: Record<string, string> = {
  "PK": "K",
  "DEF": "DEF",
  "DST": "DEF",
  "DB": "DB",
  "DL": "DL",
  "LB": "LB",
};

function buildSleeperNameIndex(players: Record<string, any>): Map<string, string> {
  const index = new Map<string, string>();

  for (const [id, p] of Object.entries(players)) {
    if (!p || !p.full_name || !p.position) continue;
    const key = `${normalizeName(p.full_name)}|${p.position}`;
    if (!index.has(key)) {
      index.set(key, id);
    }
  }

  return index;
}

function matchPlayerToSleeper(
  name: string,
  position: string,
  nameIndex: Map<string, string>
): string | null {
  const mappedPos = POSITION_MAP[position] || position;
  const normalized = normalizeName(name);

  const exactKey = `${normalized}|${mappedPos}`;
  if (nameIndex.has(exactKey)) {
    return nameIndex.get(exactKey)!;
  }

  const originalKey = `${normalized}|${position}`;
  if (nameIndex.has(originalKey)) {
    return nameIndex.get(originalKey)!;
  }

  for (const [key, id] of nameIndex.entries()) {
    const [indexName, indexPos] = key.split("|");
    if ((indexPos === mappedPos || indexPos === position) && indexName === normalized) {
      return id;
    }
  }

  return null;
}

export async function fetchDynastyProcessRankings(): Promise<{ matched: number; total: number }> {
  console.log("[ExternalRankings] Fetching DynastyProcess rankings...");

  const response = await fetch(DYNASTYPROCESS_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch DynastyProcess CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.trim().split("\n");

  if (lines.length < 2) {
    throw new Error("DynastyProcess CSV is empty");
  }

  const headerFields = parseCSVLine(lines[0]);
  const rows: DPRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 12) continue;

    rows.push({
      player: fields[0],
      pos: fields[1],
      team: fields[2],
      age: fields[3],
      draft_year: fields[4],
      ecr_1qb: fields[5],
      ecr_2qb: fields[6],
      ecr_pos: fields[7],
      value_1qb: fields[8],
      value_2qb: fields[9],
      scrape_date: fields[10],
      fp_id: fields[11],
    });
  }

  console.log(`[ExternalRankings] Parsed ${rows.length} players from DynastyProcess CSV`);

  let allPlayers: Record<string, any> | null = null;
  try {
    allPlayers = await sleeperApi.getAllPlayers();
  } catch (e) {
    console.error("[ExternalRankings] Could not load Sleeper players for matching");
    allPlayers = {};
  }

  const nameIndex = buildSleeperNameIndex(allPlayers || {});

  await db.delete(externalRankings).where(eq(externalRankings.source, "dynastyprocess"));

  let matched = 0;
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map((row) => {
      const ecr1qb = parseFloat(row.ecr_1qb);
      const ecrSf = parseFloat(row.ecr_2qb);
      const ecrPos = parseFloat(row.ecr_pos);
      const val1qb = parseFloat(row.value_1qb);
      const valSf = parseFloat(row.value_2qb);
      const sleeperId = matchPlayerToSleeper(row.player, row.pos, nameIndex);

      if (sleeperId) matched++;

      return {
        playerName: row.player,
        position: row.pos || null,
        team: row.team === "NA" ? null : row.team,
        source: "dynastyprocess" as const,
        ecr1qb: isNaN(ecr1qb) ? null : ecr1qb,
        ecrSf: isNaN(ecrSf) ? null : ecrSf,
        ecrPositional: isNaN(ecrPos) ? null : ecrPos,
        value1qb: isNaN(val1qb) ? null : val1qb,
        valueSf: isNaN(valSf) ? null : valSf,
        fpId: row.fp_id || null,
        sleeperId,
      };
    });

    await db.insert(externalRankings).values(values);
  }

  console.log(`[ExternalRankings] DynastyProcess: ${matched}/${rows.length} matched to Sleeper IDs`);
  return { matched, total: rows.length };
}

export async function getExternalRankingsForSource(source: string) {
  return db.select().from(externalRankings).where(eq(externalRankings.source, source));
}

export async function getExternalRankingsSummary(): Promise<Array<{
  source: string;
  playerCount: number;
  matchedCount: number;
  lastUpdated: string | null;
  description: string;
}>> {
  const dpRows = await db.select().from(externalRankings).where(eq(externalRankings.source, "dynastyprocess"));

  const matchedCount = dpRows.filter(r => r.sleeperId).length;
  const lastUpdated = dpRows.length > 0 && dpRows[0].lastUpdated
    ? dpRows[0].lastUpdated.toISOString()
    : null;

  return [
    {
      source: "dynastyprocess",
      playerCount: dpRows.length,
      matchedCount,
      lastUpdated,
      description: "DynastyProcess expert consensus rankings (ECR) for 1QB and Superflex formats with dynasty values. Updated weekly from community aggregate data.",
    },
  ];
}
