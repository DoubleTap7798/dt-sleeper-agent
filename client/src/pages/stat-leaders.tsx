import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Search, Crosshair, Zap, Target, Flame, TrendingUp, Trophy, Gauge, Brain, ArrowUpRight, ArrowDownRight, Minus, Filter } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { usePageTitle } from "@/hooks/use-page-title";

interface StatLeader {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  value: number;
  games_played?: number;
}

interface StatLeadersResponse {
  season: number;
  categories: {
    receiving: Record<string, StatLeader[]>;
    rushing: Record<string, StatLeader[]>;
    passing: Record<string, StatLeader[]>;
    explosive: Record<string, StatLeader[]>;
    efficiency: Record<string, StatLeader[]>;
    fantasy: Record<string, StatLeader[]>;
    redzone: Record<string, StatLeader[]>;
    advanced: Record<string, StatLeader[]>;
  };
}

interface DynastyPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  dynastyValue: number;
  threeYearAvgPPG: number;
  projectedPPG: number;
  riskScore: number;
  ufasScore: number;
  ufasTier: string;
  positionalRank: number;
  trajectory: string;
}

interface DynastyPlayersResponse {
  players: DynastyPlayer[];
  total: number;
  limit: number;
  offset: number;
}

const TOTAL_STATS = new Set([
  "targets", "receptions", "receiving_yards", "receiving_tds", "receiving_first_downs",
  "carries", "rushing_yards", "rushing_tds", "rushing_first_downs",
  "passing_yards", "passing_tds", "completions",
  "rushing_20plus", "rushing_30plus", "rushing_40plus",
  "receiving_20plus", "receiving_30plus", "receiving_40plus",
  "passing_20plus", "passing_30plus", "passing_40plus",
  "fantasy_points_ppr",
  "rz_total_td", "rz_pass_td", "rz_rush_td", "rz_fpts", "rz_att",
  "rz_wr_td", "rz_wr_tgt", "rz_wr_rec", "rz_wr_yds", "rz_wr_fpts",
  "rz_rb_td", "rz_rb_att", "rz_rb_rush_yds", "rz_rb_fpts",
  "rz_te_td", "rz_te_tgt", "rz_te_rec", "rz_te_yds", "rz_te_fpts",
  "adv_passing_yds", "adv_air_yds", "adv_deep_20plus", "adv_deep_30plus",
  "adv_sacks", "adv_knockdowns", "adv_hurries", "adv_poor_throws", "adv_drops", "adv_rz_att",
  "adv_wr_yds", "adv_wr_yac", "adv_wr_air", "adv_wr_drops", "adv_wr_brktkl", "adv_wr_rz_tgt", "adv_wr_deep_20plus",
  "adv_rb_yds", "adv_rb_yacon", "adv_rb_brktkl", "adv_rb_att", "adv_rb_rz_tgt", "adv_rb_deep_20plus", "adv_rb_lng", "adv_rb_rec",
  "adv_te_yds", "adv_te_yac", "adv_te_drops", "adv_te_brktkl", "adv_te_rz_tgt", "adv_te_rec",
]);

const STAT_LABELS: Record<string, string> = {
  targets: "Targets", receptions: "Receptions", receiving_yards: "Receiving Yards",
  receiving_tds: "Receiving TDs", receiving_first_downs: "Receiving 1st Downs",
  carries: "Carries", rushing_yards: "Rushing Yards", rushing_tds: "Rushing TDs",
  rushing_first_downs: "Rushing 1st Downs", passing_yards: "Passing Yards",
  passing_tds: "Passing TDs", completions: "Completions",
  rushing_20plus: "20+ Yard Runs", rushing_30plus: "30+ Yard Runs", rushing_40plus: "40+ Yard Runs",
  receiving_20plus: "20+ Yard Catches", receiving_30plus: "30+ Yard Catches", receiving_40plus: "40+ Yard Catches",
  passing_20plus: "20+ Yard Passes", passing_30plus: "30+ Yard Passes", passing_40plus: "40+ Yard Passes",
  target_share: "Target Share", yards_per_carry: "Yards/Carry", catch_rate: "Catch Rate",
  wopr: "WOPR", ppg_ppr: "PPG (PPR)", fantasy_points_ppr: "Total PPR Points",
  rz_total_td: "RZ Total TDs", rz_pass_td: "RZ Pass TDs", rz_rush_td: "RZ Rush TDs",
  rz_fpts_per_game: "RZ FPTS/G", rz_fpts: "RZ Fantasy Pts", rz_att: "RZ Attempts",
  rz_comp_pct: "RZ Comp %", rz_wr_td: "WR RZ TDs", rz_wr_tgt: "WR RZ Targets",
  rz_wr_rec: "WR RZ Receptions", rz_wr_yds: "WR RZ Yards", rz_wr_fpts: "WR RZ Fantasy Pts",
  rz_wr_fpts_per_game: "WR RZ FPTS/G", rz_rb_td: "RB RZ TDs", rz_rb_att: "RB RZ Carries",
  rz_rb_rush_yds: "RB RZ Rush Yards", rz_rb_ya: "RB RZ Yards/Att", rz_rb_fpts: "RB RZ Fantasy Pts",
  rz_rb_fpts_per_game: "RB RZ FPTS/G", rz_te_td: "TE RZ TDs", rz_te_tgt: "TE RZ Targets",
  rz_te_rec: "TE RZ Receptions", rz_te_yds: "TE RZ Yards", rz_te_fpts: "TE RZ Fantasy Pts",
  rz_te_fpts_per_game: "TE RZ FPTS/G",
  adv_passing_yds: "QB Pass Yards", adv_passer_rating: "QB Passer Rating",
  adv_air_yds: "QB Air Yards", adv_air_per_att: "QB Air Yds/Att",
  adv_deep_20plus: "QB 20+ Yd Passes", adv_deep_30plus: "QB 30+ Yd Passes",
  adv_comp_pct: "QB Comp %", adv_ya: "QB Yards/Att", adv_sacks: "QB Sacks Taken",
  adv_knockdowns: "QB Knockdowns", adv_hurries: "QB Hurries", adv_poor_throws: "QB Poor Throws",
  adv_drops: "QB Drops (WR)", adv_pkt_time: "QB Pocket Time", adv_rz_att: "QB RZ Attempts",
  adv_wr_yds: "WR Rec Yards", adv_wr_yac: "WR YAC", adv_wr_yac_per_r: "WR YAC/Rec",
  adv_wr_air: "WR Air Yards", adv_wr_air_per_r: "WR Air Yds/Rec",
  adv_wr_tgt_share: "WR Tgt Share %", adv_wr_drops: "WR Drops",
  adv_wr_brktkl: "WR Broken Tackles", adv_wr_rz_tgt: "WR RZ Targets",
  adv_wr_deep_20plus: "WR 20+ Yd Catches", adv_rb_yds: "RB Rush Yards",
  adv_rb_ypc: "RB Yards/Carry", adv_rb_yacon: "RB YACon", adv_rb_yacon_per_att: "RB YACon/Att",
  adv_rb_brktkl: "RB Broken Tackles", adv_rb_att: "RB Attempts", adv_rb_rz_tgt: "RB RZ Targets",
  adv_rb_deep_20plus: "RB 20+ Yd Runs", adv_rb_lng: "RB Long Run", adv_rb_rec: "RB Receptions",
  adv_te_yds: "TE Rec Yards", adv_te_yac: "TE YAC", adv_te_yac_per_r: "TE YAC/Rec",
  adv_te_tgt_share: "TE Tgt Share %", adv_te_drops: "TE Drops",
  adv_te_brktkl: "TE Broken Tackles", adv_te_rz_tgt: "TE RZ Targets", adv_te_rec: "TE Receptions",
};

const POSITION_COLORS: Record<string, string> = {
  QB: "text-red-400", RB: "text-green-400", WR: "text-blue-400", TE: "text-yellow-400",
};

const POSITION_FILTERS = ["All", "QB", "WR", "RB", "TE"] as const;

const CATEGORY_CONFIG = [
  { key: "receiving" as const, label: "Receiving", icon: Crosshair },
  { key: "rushing" as const, label: "Rushing", icon: Zap },
  { key: "passing" as const, label: "Passing", icon: Target },
  { key: "explosive" as const, label: "Big Plays", icon: Flame },
  { key: "efficiency" as const, label: "Efficiency", icon: TrendingUp },
  { key: "fantasy" as const, label: "Fantasy", icon: Trophy },
  { key: "redzone" as const, label: "Red Zone", icon: Gauge },
  { key: "advanced" as const, label: "Advanced", icon: Brain },
];

function formatStatValue(key: string, value: number): string {
  if (["target_share", "catch_rate"].includes(key)) return (value * 100).toFixed(1) + "%";
  if (["rz_comp_pct", "adv_comp_pct"].includes(key)) return value.toFixed(1) + "%";
  if (["adv_wr_tgt_share", "adv_te_tgt_share"].includes(key)) return value.toFixed(1) + "%";
  if (["yards_per_carry", "wopr", "ppg_ppr", "rz_fpts_per_game", "adv_air_per_att", "adv_ya", "adv_pkt_time", "rz_rb_ya", "rz_wr_fpts_per_game", "rz_rb_fpts_per_game", "rz_te_fpts_per_game", "adv_wr_yac_per_r", "adv_wr_air_per_r", "adv_rb_ypc", "adv_rb_yacon_per_att", "adv_te_yac_per_r"].includes(key)) return value.toFixed(1);
  if (["receiving_yards", "rushing_yards", "passing_yards", "fantasy_points_ppr", "adv_passing_yds", "adv_air_yds", "rz_fpts", "rz_wr_fpts", "rz_rb_fpts", "rz_te_fpts", "adv_wr_yds", "adv_wr_yac", "adv_wr_air", "adv_rb_yds", "adv_rb_yacon", "adv_te_yds", "adv_te_yac"].includes(key)) return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return String(Math.round(value));
}

function getPositionKeyFilter(categoryKey: string, position: string): (key: string) => boolean {
  if (position === "All") return () => true;
  if (categoryKey === "redzone") {
    if (position === "QB") return (k: string) => k.startsWith("rz_") && !k.startsWith("rz_wr_") && !k.startsWith("rz_rb_") && !k.startsWith("rz_te_");
    if (position === "WR") return (k: string) => k.startsWith("rz_wr_");
    if (position === "RB") return (k: string) => k.startsWith("rz_rb_");
    if (position === "TE") return (k: string) => k.startsWith("rz_te_");
  }
  if (categoryKey === "advanced") {
    if (position === "QB") return (k: string) => k.startsWith("adv_") && !k.startsWith("adv_wr_") && !k.startsWith("adv_rb_") && !k.startsWith("adv_te_");
    if (position === "WR") return (k: string) => k.startsWith("adv_wr_");
    if (position === "RB") return (k: string) => k.startsWith("adv_rb_");
    if (position === "TE") return (k: string) => k.startsWith("adv_te_");
  }
  return () => true;
}

function getDynastyImpact(dynastyValue: number, ufasScore: number, trajectory: string): { label: string; color: string; icon: typeof ArrowUpRight } {
  if (trajectory === "ascending" || (ufasScore >= 75 && dynastyValue >= 5000)) {
    return { label: "High", color: "text-green-500", icon: ArrowUpRight };
  }
  if (trajectory === "declining" || ufasScore < 40 || dynastyValue < 2000) {
    return { label: "Low", color: "text-red-400", icon: ArrowDownRight };
  }
  return { label: "Mid", color: "text-yellow-500", icon: Minus };
}

function DynastyImpactBadge({ player, dynastyMap }: { player: StatLeader; dynastyMap: Map<string, DynastyPlayer> }) {
  const dynPlayer = dynastyMap.get(player.player_id) || findDynastyByName(player.player_name, dynastyMap);
  if (!dynPlayer) return <span className="text-[10px] text-muted-foreground">--</span>;

  const impact = getDynastyImpact(dynPlayer.dynastyValue, dynPlayer.ufasScore, dynPlayer.trajectory);
  const ImpactIcon = impact.icon;

  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${impact.color}`} data-testid={`dynasty-impact-${player.player_id}`}>
      <ImpactIcon className="h-3 w-3" />
      {impact.label}
    </span>
  );
}

function findDynastyByName(name: string, dynastyMap: Map<string, DynastyPlayer>): DynastyPlayer | undefined {
  const normalized = name.toLowerCase().trim();
  const values = Array.from(dynastyMap.values());
  for (let i = 0; i < values.length; i++) {
    if (values[i].name.toLowerCase().trim() === normalized) return values[i];
  }
  return undefined;
}

function LeaderboardTable({
  statKey,
  leaders,
  searchQuery,
  perGame,
  dynastyMap,
  ageRange,
}: {
  statKey: string;
  leaders: StatLeader[];
  searchQuery: string;
  perGame: boolean;
  dynastyMap: Map<string, DynastyPlayer>;
  ageRange: [number, number];
}) {
  const processed = useMemo(() => {
    let list = leaders.slice(0, 15);

    if (ageRange[0] > 18 || ageRange[1] < 45) {
      list = list.filter(p => {
        const dp = dynastyMap.get(p.player_id) || findDynastyByName(p.player_name, dynastyMap);
        if (!dp) return true;
        return dp.age >= ageRange[0] && dp.age <= ageRange[1];
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.player_name.toLowerCase().includes(q));
    }

    const isTotalStat = TOTAL_STATS.has(statKey);
    if (perGame && isTotalStat) {
      list = list.map(p => ({
        ...p,
        value: p.games_played && p.games_played > 0 ? p.value / p.games_played : p.value,
      }));
      list.sort((a, b) => b.value - a.value);
    }

    return list.slice(0, 10);
  }, [leaders, searchQuery, perGame, statKey, dynastyMap, ageRange]);

  if (processed.length === 0) return null;

  const displayLabel = perGame && TOTAL_STATS.has(statKey)
    ? `${STAT_LABELS[statKey] || statKey} /G`
    : STAT_LABELS[statKey] || statKey;

  return (
    <Card data-testid={`leaderboard-card-${statKey}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
          <span>{displayLabel}</span>
          {perGame && TOTAL_STATS.has(statKey) && (
            <Badge variant="secondary" className="text-[10px]">Per Game</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1" data-testid={`leaderboard-${statKey}`}>
          {processed.map((player, idx) => (
            <div
              key={player.player_id || idx}
              className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/30 text-xs"
              data-testid={`leader-${statKey}-${idx}`}
            >
              <span className="w-5 text-muted-foreground font-medium text-right">{idx + 1}</span>
              <span className={`w-8 font-medium ${POSITION_COLORS[player.position] || "text-muted-foreground"}`}>
                {player.position || "--"}
              </span>
              <span className="flex-1 truncate font-medium">{player.player_name}</span>
              <DynastyImpactBadge player={player} dynastyMap={dynastyMap} />
              <span className="text-muted-foreground text-[11px] shrink-0">{player.team}</span>
              <span className="font-bold text-[hsl(var(--accent))] w-16 text-right shrink-0">
                {formatStatValue(statKey, player.value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PositionFilteredLeaderboards({
  categoryKey,
  categoryData,
  searchQuery,
  perGame,
  dynastyMap,
  ageRange,
}: {
  categoryKey: string;
  categoryData: Record<string, StatLeader[]>;
  searchQuery: string;
  perGame: boolean;
  dynastyMap: Map<string, DynastyPlayer>;
  ageRange: [number, number];
}) {
  const [activePosition, setActivePosition] = useState("All");
  const filterFn = getPositionKeyFilter(categoryKey, activePosition);
  const filteredKeys = Object.keys(categoryData).filter(filterFn);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap" data-testid={`position-filters-${categoryKey}`}>
        {POSITION_FILTERS.map(pos => (
          <Button
            key={pos}
            size="sm"
            variant={activePosition === pos ? "default" : "outline"}
            onClick={() => setActivePosition(pos)}
            data-testid={`filter-${categoryKey}-${pos.toLowerCase()}`}
          >
            {pos}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredKeys.map(statKey => {
          const statLeaders = categoryData[statKey];
          if (!statLeaders || statLeaders.length === 0) return null;
          return (
            <LeaderboardTable
              key={statKey}
              statKey={statKey}
              leaders={statLeaders}
              searchQuery={searchQuery}
              perGame={perGame}
              dynastyMap={dynastyMap}
              ageRange={ageRange}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function StatLeadersPage() {
  usePageTitle("NFL Stat Leaders");
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const defaultSeason = currentMonth < 8 ? String(currentYear - 1) : String(currentYear);
  const [selectedSeason, setSelectedSeason] = useState(defaultSeason);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("receiving");
  const [perGame, setPerGame] = useState(false);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 45]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: leaders, isLoading, error } = useQuery<StatLeadersResponse>({
    queryKey: ["/api/nfl/stat-leaders", selectedSeason],
    queryFn: async () => {
      const res = await fetch(`/api/nfl/stat-leaders?season=${selectedSeason}`);
      if (!res.ok) throw new Error("Failed to fetch stat leaders");
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const { data: dynastyData } = useQuery<DynastyPlayersResponse>({
    queryKey: ["/api/engine/v3/players-dynasty", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/engine/v3/players-dynasty?limit=500&sort=dynastyValue&order=desc`);
      if (!res.ok) throw new Error("Failed to fetch dynasty data");
      return res.json();
    },
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const dynastyMap = useMemo(() => {
    const map = new Map<string, DynastyPlayer>();
    if (dynastyData?.players) {
      for (const p of dynastyData.players) {
        map.set(p.playerId, p);
      }
    }
    return map;
  }, [dynastyData]);

  const handleAgeChange = useCallback((values: number[]) => {
    setAgeRange([values[0], values[1]]);
  }, []);

  const exportData = useMemo(() => {
    if (!leaders) return [];
    const categoryData = leaders.categories[activeTab as keyof typeof leaders.categories];
    if (!categoryData) return [];
    const rows: Record<string, any>[] = [];
    Object.entries(categoryData).forEach(([statKey, playerList]) => {
      (playerList as StatLeader[]).slice(0, 10).forEach((player, idx) => {
        const dp = dynastyMap.get(player.player_id) || findDynastyByName(player.player_name, dynastyMap);
        rows.push({
          Rank: idx + 1,
          Player: player.player_name,
          Position: player.position,
          Team: player.team,
          Stat: STAT_LABELS[statKey] || statKey,
          Value: formatStatValue(statKey, player.value),
          "Dynasty Value": dp?.dynastyValue ?? "N/A",
          "Dynasty Impact": dp ? getDynastyImpact(dp.dynastyValue, dp.ufasScore, dp.trajectory).label : "N/A",
        });
      });
    });
    return rows;
  }, [leaders, activeTab, dynastyMap]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto" data-testid="stat-leaders-loading">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold">NFL Stat Leaders</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !leaders) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto" data-testid="stat-leaders-error">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold">NFL Stat Leaders</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              Unable to load NFL stats at this time. Try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto" data-testid="stat-leaders-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">NFL Stat Leaders</h1>
          <Badge variant="outline" data-testid="badge-season">{leaders.season} Season</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-48"
              data-testid="input-search-players"
            />
          </div>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger className="w-28" data-testid="select-season">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025" data-testid="select-season-2025">2025</SelectItem>
              <SelectItem value="2024" data-testid="select-season-2024">2024</SelectItem>
              <SelectItem value="2023" data-testid="select-season-2023">2023</SelectItem>
              <SelectItem value="2022" data-testid="select-season-2022">2022</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
          </Button>
          <ExportButton
            data={exportData}
            filename={`nfl-stat-leaders-${activeTab}-${selectedSeason}`}
          />
        </div>
      </div>

      {showFilters && (
        <Card data-testid="filter-panel">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Label htmlFor="per-game-toggle" className="text-sm text-muted-foreground whitespace-nowrap">
                  Per Game
                </Label>
                <Switch
                  id="per-game-toggle"
                  checked={perGame}
                  onCheckedChange={setPerGame}
                  data-testid="switch-per-game"
                />
                <span className="text-xs text-muted-foreground">
                  {perGame ? "Per Game" : "Total"}
                </span>
              </div>

              <div className="flex-1 min-w-[200px] max-w-xs">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Age Range: {ageRange[0]} - {ageRange[1]}
                </Label>
                <Slider
                  min={18}
                  max={45}
                  step={1}
                  value={ageRange}
                  onValueChange={handleAgeChange}
                  data-testid="slider-age-range"
                />
              </div>

              {(perGame || ageRange[0] > 18 || ageRange[1] < 45) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPerGame(false);
                    setAgeRange([18, 45]);
                  }}
                  data-testid="button-reset-filters"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 py-1" data-testid="tabs-categories">
          {CATEGORY_CONFIG.map(cat => (
            <TabsTrigger
              key={cat.key}
              value={cat.key}
              className="text-xs gap-1"
              data-testid={`tab-leaders-${cat.key}`}
            >
              <cat.icon className="h-3 w-3" />
              <span className="hidden sm:inline">{cat.label}</span>
              <span className="sm:hidden">{cat.label.slice(0, 4)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORY_CONFIG.map(cat => {
          const categoryData = leaders.categories[cat.key];
          if (!categoryData) return null;
          const hasPositionGroups = cat.key === "redzone" || cat.key === "advanced";

          if (hasPositionGroups) {
            return (
              <TabsContent key={cat.key} value={cat.key} className="mt-4" data-testid={`tab-content-${cat.key}`}>
                <PositionFilteredLeaderboards
                  categoryKey={cat.key}
                  categoryData={categoryData}
                  searchQuery={searchQuery}
                  perGame={perGame}
                  dynastyMap={dynastyMap}
                  ageRange={ageRange}
                />
              </TabsContent>
            );
          }

          const statKeys = Object.keys(categoryData);
          return (
            <TabsContent key={cat.key} value={cat.key} className="mt-4" data-testid={`tab-content-${cat.key}`}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {statKeys.map(statKey => {
                  const statLeaders = categoryData[statKey];
                  if (!statLeaders || statLeaders.length === 0) return null;
                  return (
                    <LeaderboardTable
                      key={statKey}
                      statKey={statKey}
                      leaders={statLeaders}
                      searchQuery={searchQuery}
                      perGame={perGame}
                      dynastyMap={dynastyMap}
                      ageRange={ageRange}
                    />
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
