import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Target, Activity, Zap } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface WeeklyData {
  week: number;
  targets: number;
  receptions: number;
  carries: number;
  rushingYards: number;
  receivingYards: number;
  fantasyPoints: number;
  targetShare: number;
  airYardsShare: number;
}

interface PlayerUsage {
  playerId: string;
  name: string;
  position: string;
  team: string;
  weeklyData: WeeklyData[];
  trends: {
    targetShareTrend: "rising" | "falling" | "steady";
    usageTrend: "rising" | "falling" | "steady";
    pointsTrend: "rising" | "falling" | "steady";
  };
  seasonAvg: {
    targets: number;
    carries: number;
    fantasyPoints: number;
    targetShare: number;
  };
  last3Avg: {
    targets: number;
    carries: number;
    fantasyPoints: number;
    targetShare: number;
  };
}

interface UsageTrendsResponse {
  players: PlayerUsage[];
}

type PositionFilter = "All" | "QB" | "RB" | "WR" | "TE";
type SortOption = "fantasyPoints" | "targetShare" | "carries";

function TrendIcon({ trend }: { trend: "rising" | "falling" | "steady" }) {
  if (trend === "rising") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (trend === "falling") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function MiniBarChart({ weeklyData }: { weeklyData: WeeklyData[] }) {
  const maxPoints = Math.max(...weeklyData.map(w => w.fantasyPoints), 1);
  return (
    <div className="flex items-end gap-0.5 h-12" data-testid="chart-weekly-points">
      {weeklyData.map(w => (
        <div
          key={w.week}
          className="flex-1 bg-primary/60 rounded-t-sm min-w-[3px]"
          style={{ height: `${Math.max(4, (w.fantasyPoints / maxPoints) * 100)}%` }}
          title={`Week ${w.week}: ${w.fantasyPoints.toFixed(1)} pts`}
          data-testid={`bar-week-${w.week}`}
        />
      ))}
    </div>
  );
}

export default function UsageTrendsPage() {
  const { league } = useSelectedLeague();
  usePageTitle("Usage Trends");

  const [positionFilter, setPositionFilter] = useState<PositionFilter>("All");
  const [sortBy, setSortBy] = useState<SortOption>("fantasyPoints");

  const { data, isLoading, error } = useQuery<UsageTrendsResponse>({
    queryKey: ["/api/fantasy/usage-trends", league?.league_id],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/usage-trends/${league?.league_id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch usage trends");
      return res.json();
    },
    enabled: !!league?.league_id,
  });

  const filteredPlayers = (data?.players || [])
    .filter(p => positionFilter === "All" || p.position === positionFilter)
    .sort((a, b) => {
      if (sortBy === "fantasyPoints") return b.seasonAvg.fantasyPoints - a.seasonAvg.fantasyPoints;
      if (sortBy === "targetShare") return b.seasonAvg.targetShare - a.seasonAvg.targetShare;
      return b.seasonAvg.carries - a.seasonAvg.carries;
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-16" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Usage Trends">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h1 className="text-xl font-bold" data-testid="text-page-title">Usage Trends</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={positionFilter} onValueChange={(v) => setPositionFilter(v as PositionFilter)}>
            <TabsList data-testid="tabs-position-filter">
              {(["All", "QB", "RB", "WR", "TE"] as const).map(pos => (
                <TabsTrigger key={pos} value={pos} data-testid={`tab-${pos.toLowerCase()}`}>
                  {pos}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1 ml-auto">
            {([
              { key: "fantasyPoints", label: "Points", icon: Zap },
              { key: "targetShare", label: "Targets", icon: Target },
              { key: "carries", label: "Carries", icon: Activity },
            ] as const).map(opt => (
              <Button
                key={opt.key}
                variant={sortBy === opt.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setSortBy(opt.key)}
                data-testid={`sort-${opt.key}`}
              >
                <opt.icon className="h-3.5 w-3.5 mr-1" />
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {error ? (
          <Card data-testid="error-state">
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-error-message">
                Failed to load usage trends. Please try again later.
              </p>
            </CardContent>
          </Card>
        ) : filteredPlayers.length === 0 ? (
          <Card data-testid="empty-state">
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-empty-message">
                {!league ? "Select a league to view usage trends" : "No usage data available for your roster players"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlayers.map(player => (
              <Card key={player.playerId} data-testid={`usage-card-${player.playerId}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid={`badge-position-${player.playerId}`}>
                        {player.position}
                      </Badge>
                      <CardTitle className="text-base truncate" data-testid={`text-player-name-${player.playerId}`}>
                        {player.name}
                      </CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0" data-testid={`text-team-${player.playerId}`}>
                      {player.team}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-1" title="Target Share Trend" data-testid={`trend-targetshare-${player.playerId}`}>
                      <Target className="h-3 w-3 text-muted-foreground" />
                      <TrendIcon trend={player.trends.targetShareTrend} />
                    </div>
                    <div className="flex items-center gap-1" title="Usage Trend" data-testid={`trend-usage-${player.playerId}`}>
                      <Activity className="h-3 w-3 text-muted-foreground" />
                      <TrendIcon trend={player.trends.usageTrend} />
                    </div>
                    <div className="flex items-center gap-1" title="Points Trend" data-testid={`trend-points-${player.playerId}`}>
                      <Zap className="h-3 w-3 text-muted-foreground" />
                      <TrendIcon trend={player.trends.pointsTrend} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MiniBarChart weeklyData={player.weeklyData} />

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground font-medium col-span-1">Metric</div>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground font-medium">
                      <span>Season</span>
                      <span>Last 3</span>
                    </div>

                    <div className="text-muted-foreground">Targets</div>
                    <div className="grid grid-cols-2 gap-2">
                      <span data-testid={`stat-season-targets-${player.playerId}`}>{player.seasonAvg.targets.toFixed(1)}</span>
                      <span data-testid={`stat-last3-targets-${player.playerId}`}>{player.last3Avg.targets.toFixed(1)}</span>
                    </div>

                    <div className="text-muted-foreground">Carries</div>
                    <div className="grid grid-cols-2 gap-2">
                      <span data-testid={`stat-season-carries-${player.playerId}`}>{player.seasonAvg.carries.toFixed(1)}</span>
                      <span data-testid={`stat-last3-carries-${player.playerId}`}>{player.last3Avg.carries.toFixed(1)}</span>
                    </div>

                    <div className="text-muted-foreground">PPR Pts</div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium" data-testid={`stat-season-points-${player.playerId}`}>{player.seasonAvg.fantasyPoints.toFixed(1)}</span>
                      <span className="font-medium" data-testid={`stat-last3-points-${player.playerId}`}>{player.last3Avg.fantasyPoints.toFixed(1)}</span>
                    </div>

                    <div className="text-muted-foreground">Tgt Share</div>
                    <div className="grid grid-cols-2 gap-2">
                      <span data-testid={`stat-season-tgtshare-${player.playerId}`}>{(player.seasonAvg.targetShare * 100).toFixed(1)}%</span>
                      <span data-testid={`stat-last3-tgtshare-${player.playerId}`}>{(player.last3Avg.targetShare * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PremiumGate>
  );
}
