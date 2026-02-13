import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart3, Search, Crosshair, Zap, Target, Flame, TrendingUp, Trophy, Gauge, Brain } from "lucide-react";
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

function LeaderboardTable({ statKey, leaders, searchQuery }: { statKey: string; leaders: StatLeader[]; searchQuery: string }) {
  const filtered = useMemo(() => {
    const top10 = leaders.slice(0, 10);
    if (!searchQuery) return top10;
    const q = searchQuery.toLowerCase();
    return top10.filter(p => p.player_name.toLowerCase().includes(q));
  }, [leaders, searchQuery]);

  if (filtered.length === 0) return null;

  return (
    <Card data-testid={`leaderboard-card-${statKey}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {STAT_LABELS[statKey] || statKey}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1" data-testid={`leaderboard-${statKey}`}>
          {filtered.map((player, idx) => {
            const originalIdx = leaders.indexOf(player);
            return (
              <div
                key={player.player_id || idx}
                className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/30 text-xs"
                data-testid={`leader-${statKey}-${originalIdx}`}
              >
                <span className="w-5 text-muted-foreground font-medium text-right">{originalIdx + 1}</span>
                <span className={`w-8 font-medium ${POSITION_COLORS[player.position] || "text-muted-foreground"}`}>
                  {player.position || "--"}
                </span>
                <span className="flex-1 truncate font-medium">{player.player_name}</span>
                <span className="text-muted-foreground text-[11px] shrink-0">{player.team}</span>
                <span className="font-bold text-[hsl(var(--accent))] w-16 text-right shrink-0">
                  {formatStatValue(statKey, player.value)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PositionFilteredLeaderboards({ categoryKey, categoryData, searchQuery }: { categoryKey: string; categoryData: Record<string, StatLeader[]>; searchQuery: string }) {
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
          return <LeaderboardTable key={statKey} statKey={statKey} leaders={statLeaders} searchQuery={searchQuery} />;
        })}
      </div>
    </div>
  );
}

export default function StatLeadersPage() {
  usePageTitle("NFL Stat Leaders");
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("receiving");

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

  const exportData = useMemo(() => {
    if (!leaders) return [];
    const categoryData = leaders.categories[activeTab as keyof typeof leaders.categories];
    if (!categoryData) return [];
    const rows: Record<string, any>[] = [];
    Object.entries(categoryData).forEach(([statKey, playerList]) => {
      (playerList as StatLeader[]).slice(0, 10).forEach((player, idx) => {
        rows.push({
          Rank: idx + 1,
          Player: player.player_name,
          Position: player.position,
          Team: player.team,
          Stat: STAT_LABELS[statKey] || statKey,
          Value: formatStatValue(statKey, player.value),
        });
      });
    });
    return rows;
  }, [leaders, activeTab]);

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
        <div className="flex items-center gap-3">
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
              <SelectItem value="2024" data-testid="select-season-2024">2024</SelectItem>
              <SelectItem value="2023" data-testid="select-season-2023">2023</SelectItem>
              <SelectItem value="2022" data-testid="select-season-2022">2022</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            data={exportData}
            filename={`nfl-stat-leaders-${activeTab}-${selectedSeason}`}
          />
        </div>
      </div>

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
                <PositionFilteredLeaderboards categoryKey={cat.key} categoryData={categoryData} searchQuery={searchQuery} />
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
                  return <LeaderboardTable key={statKey} statKey={statKey} leaders={statLeaders} searchQuery={searchQuery} />;
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
