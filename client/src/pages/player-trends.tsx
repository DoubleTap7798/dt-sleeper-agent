import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp, TrendingDown, Minus, Search, BarChart3, Activity,
  UserPlus, UserMinus, Zap, ChevronRight, Users, Globe, Filter, AlertCircle,
} from "lucide-react";
import { getNFLTeamLogo } from "@/lib/team-logos";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SeasonStats {
  season: number;
  games: number;
  points: number;
  ppg: number;
  rank: number;
  positionRank: number;
}

interface PlayerTrend {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  seasons: SeasonStats[];
  trend: "up" | "down" | "stable" | "breakout";
  careerHigh: number;
  careerLow: number;
  avgPpg: number;
  trajectory: string;
  peakSeason: number;
  miniSeries: number[];
  yearsExp: number;
}

interface TrendsResponse {
  players: PlayerTrend[];
  availableSeasons: number[];
}

interface TrendingPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number;
  count: number;
  rank: number;
  number: number | null;
  headshot: string | null;
}

interface TrendingResponse {
  players: TrendingPlayer[];
  type: string;
  lastUpdated: string;
}

type TabType = "added" | "dropped" | "career";
type CareerMode = "browse" | "roster";

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function MiniTrendLine({ series, seasons }: { series: number[]; seasons: number[] }) {
  const maxVal = Math.max(...series.filter(v => v > 0), 1);
  const activePoints = series.map((v, i) => ({ v, season: seasons[i], active: v > 0 }));
  const width = 120;
  const height = 40;
  const padding = 4;

  const getX = (i: number) => padding + (i / (series.length - 1)) * (width - padding * 2);
  const getY = (v: number) => height - padding - (v / maxVal) * (height - padding * 2);

  const pathParts: string[] = [];
  let started = false;
  activePoints.forEach((pt, i) => {
    if (!pt.active) { started = false; return; }
    if (!started) {
      pathParts.push(`M ${getX(i)} ${getY(pt.v)}`);
      started = true;
    } else {
      pathParts.push(`L ${getX(i)} ${getY(pt.v)}`);
    }
  });

  return (
    <svg width={width} height={height} className="shrink-0" data-testid="chart-mini-trend">
      <path d={pathParts.join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {activePoints.map((pt, i) => pt.active ? (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <circle
              cx={getX(i)}
              cy={getY(pt.v)}
              r="3"
              fill="hsl(var(--primary))"
              className="cursor-pointer"
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {pt.season}: {pt.v} PPG
          </TooltipContent>
        </Tooltip>
      ) : null)}
    </svg>
  );
}

function TrendBadge({ trend }: { trend: "up" | "down" | "stable" | "breakout" }) {
  switch (trend) {
    case "breakout":
      return (
        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 text-xs" data-testid="badge-trend-breakout">
          <Zap className="h-3 w-3 mr-0.5" /> Breakout
        </Badge>
      );
    case "up":
      return (
        <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50 text-xs" data-testid="badge-trend-up">
          <TrendingUp className="h-3 w-3 mr-0.5" /> Ascending
        </Badge>
      );
    case "down":
      return (
        <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/50 text-xs" data-testid="badge-trend-down">
          <TrendingDown className="h-3 w-3 mr-0.5" /> Declining
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs" data-testid="badge-trend-stable">
          <Minus className="h-3 w-3 mr-0.5" /> Steady
        </Badge>
      );
  }
}

export default function PlayerTrendsPage() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  usePageTitle("Player Trends");
  const [activeTab, setActiveTab] = useState<TabType>("career");
  const [careerMode, setCareerMode] = useState<CareerMode>("browse");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"avgPpg" | "careerHigh" | "trend">("avgPpg");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  const { data: addedData, isLoading: addedLoading } = useQuery<TrendingResponse>({
    queryKey: ["/api/sleeper/trending?type=add&limit=50"],
    enabled: activeTab === "added",
  });

  const { data: droppedData, isLoading: droppedLoading } = useQuery<TrendingResponse>({
    queryKey: ["/api/sleeper/trending?type=drop&limit=50"],
    enabled: activeTab === "dropped",
  });

  const careerQueryKey = activeTab === "career"
    ? [`/api/fantasy/trends?mode=${careerMode}${careerMode === "roster" && leagueId ? `&leagueId=${leagueId}` : ""}&position=${positionFilter}&search=${debouncedSearch}`]
    : ["disabled-career"];

  const { data: careerData, isLoading: careerLoading, error: careerError } = useQuery<TrendsResponse>({
    queryKey: careerQueryKey,
    enabled: activeTab === "career",
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    (activeTab === "added" && addedLoading) ||
    (activeTab === "dropped" && droppedLoading) ||
    (activeTab === "career" && careerLoading);

  const sortedCareerPlayers = [...(careerData?.players || [])].sort((a, b) => {
    if (sortBy === "avgPpg") return b.avgPpg - a.avgPpg;
    if (sortBy === "careerHigh") return b.careerHigh - a.careerHigh;
    const trendOrder: Record<string, number> = { breakout: 0, up: 1, stable: 2, down: 3 };
    return (trendOrder[a.trend] || 2) - (trendOrder[b.trend] || 2);
  });

  const filteredTrendingPlayers = (activeTab === "added" ? addedData?.players : droppedData?.players || [])?.filter((player) => {
    return searchTerm === "" ||
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Player Trends">
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5" />
        <h1 className="text-xl font-bold" data-testid="text-page-title">Player Trends</h1>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          variant={activeTab === "career" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("career")}
          className={`shrink-0 glass ${activeTab === "career" ? "glass-active" : ""}`}
          data-testid="tab-career-trends"
        >
          <BarChart3 className="h-4 w-4 mr-1" />
          Multi-Season
        </Button>
        <Button
          variant={activeTab === "added" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("added")}
          className={`shrink-0 glass ${activeTab === "added" ? "glass-active" : ""}`}
          data-testid="tab-most-added"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Most Added
        </Button>
        <Button
          variant={activeTab === "dropped" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("dropped")}
          className={`shrink-0 glass ${activeTab === "dropped" ? "glass-active" : ""}`}
          data-testid="tab-most-dropped"
        >
          <UserMinus className="h-4 w-4 mr-1" />
          Most Dropped
        </Button>
      </div>

      {activeTab === "career" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant={careerMode === "browse" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCareerMode("browse")}
              data-testid="btn-mode-browse"
            >
              <Globe className="h-3.5 w-3.5 mr-1" />
              Browse
            </Button>
            <Button
              variant={careerMode === "roster" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCareerMode("roster")}
              disabled={!leagueId}
              data-testid="btn-mode-roster"
            >
              <Users className="h-3.5 w-3.5 mr-1" />
              My Roster
            </Button>
          </div>

          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-[100px]" data-testid="select-position-filter">
              <Filter className="h-3.5 w-3.5 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pos</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[120px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avgPpg">Avg PPG</SelectItem>
              <SelectItem value="careerHigh">Career High</SelectItem>
              <SelectItem value="trend">Trend</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={activeTab === "career" ? "Search by name or team..." : "Search players..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-players"
        />
      </div>

      {activeTab !== "career" && (
        <p className="text-xs text-muted-foreground">
          {activeTab === "added" ? "Most added players across Sleeper leagues (last 24 hours)" : "Most dropped players across Sleeper leagues (last 24 hours)"}
        </p>
      )}

      {activeTab === "career" ? (
        careerError ? (
          <Card data-testid="error-state">
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <p className="text-muted-foreground" data-testid="text-error-message">
                Failed to load multi-season trends. Please try again later.
              </p>
            </CardContent>
          </Card>
        ) : sortedCareerPlayers.length === 0 ? (
          <Card data-testid="empty-state">
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-empty-message">
                {careerMode === "roster" && !leagueId
                  ? "Select a league to view your roster's trends"
                  : careerMode === "roster"
                  ? "Connect your Sleeper account and select a league to see your roster's performance trends"
                  : debouncedSearch
                  ? `No players found matching "${debouncedSearch}"`
                  : "No multi-season trend data available"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {sortedCareerPlayers.length} players | {careerData?.availableSeasons?.[0]}–{careerData?.availableSeasons?.[careerData.availableSeasons.length - 1]} seasons | Real PPR stats from Sleeper
            </p>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Breakouts", count: sortedCareerPlayers.filter(p => p.trend === "breakout").length, color: "text-yellow-500" },
                { label: "Ascending", count: sortedCareerPlayers.filter(p => p.trend === "up").length, color: "text-green-500" },
                { label: "Steady", count: sortedCareerPlayers.filter(p => p.trend === "stable").length, color: "text-muted-foreground" },
                { label: "Declining", count: sortedCareerPlayers.filter(p => p.trend === "down").length, color: "text-red-500" },
              ].map(cat => (
                <Card key={cat.label}>
                  <CardContent className="p-3 text-center">
                    <div className={`text-2xl font-bold ${cat.color}`} data-testid={`stat-${cat.label.toLowerCase()}-count`}>{cat.count}</div>
                    <div className="text-xs text-muted-foreground">{cat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Player List */}
            <div className="space-y-2">
              {sortedCareerPlayers.map((player) => {
                const isExpanded = expandedPlayer === player.playerId;
                return (
                  <Card
                    key={player.playerId}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setExpandedPlayer(isExpanded ? null : player.playerId)}
                    data-testid={`trend-card-${player.playerId}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={getNFLTeamLogo(player.team) || undefined} alt={player.team} />
                          <AvatarFallback className="text-xs">{getInitials(player.name)}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate" data-testid={`text-player-name-${player.playerId}`}>{player.name}</span>
                            <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`} data-testid={`badge-position-${player.playerId}`}>
                              {player.position}
                            </Badge>
                            <span className="text-xs text-muted-foreground" data-testid={`text-team-${player.playerId}`}>{player.team}</span>
                            <span className="text-xs text-muted-foreground">Age {player.age}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <TrendBadge trend={player.trend} />
                            <span className="text-xs text-muted-foreground">
                              Avg <span className="font-medium text-foreground">{player.avgPpg}</span> PPG
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Peak <span className="font-medium text-foreground">{player.careerHigh}</span> ({player.peakSeason})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <MiniTrendLine
                            series={player.miniSeries}
                            seasons={careerData?.availableSeasons || []}
                          />
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-border space-y-3" data-testid={`expanded-details-${player.playerId}`}>
                          <p className="text-sm text-muted-foreground" data-testid={`text-trajectory-${player.playerId}`}>
                            {player.trajectory}
                          </p>

                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <div className="text-lg font-bold" data-testid={`stat-avg-ppg-${player.playerId}`}>{player.avgPpg}</div>
                              <div className="text-xs text-muted-foreground">Avg PPG</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-green-500" data-testid={`stat-career-high-${player.playerId}`}>{player.careerHigh}</div>
                              <div className="text-xs text-muted-foreground">Career High</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-red-500" data-testid={`stat-career-low-${player.playerId}`}>{player.careerLow}</div>
                              <div className="text-xs text-muted-foreground">Career Low</div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-2 pb-1">
                              <span>Season</span>
                              <div className="flex items-center gap-4">
                                <span className="w-10 text-center">GP</span>
                                <span className="w-14 text-center">Points</span>
                                <span className="w-12 text-center">PPG</span>
                                <span className="w-14 text-center">Pos Rank</span>
                              </div>
                            </div>
                            {player.seasons.map((season, sIdx) => {
                              const prevSeason = sIdx > 0 ? player.seasons[sIdx - 1] : null;
                              const ppgDelta = prevSeason ? season.ppg - prevSeason.ppg : 0;
                              return (
                                <div
                                  key={season.season}
                                  className="flex items-center justify-between text-sm px-2 py-1.5 rounded bg-muted/30"
                                  data-testid={`season-row-${player.playerId}-${sIdx}`}
                                >
                                  <span className="font-medium" data-testid={`season-year-${player.playerId}-${sIdx}`}>
                                    {season.season}
                                  </span>
                                  <div className="flex items-center gap-4">
                                    <span className="w-10 text-center text-muted-foreground" data-testid={`season-games-${player.playerId}-${sIdx}`}>
                                      {season.games}
                                    </span>
                                    <span className="w-14 text-center" data-testid={`season-points-${player.playerId}-${sIdx}`}>
                                      {season.points.toFixed(0)}
                                    </span>
                                    <span className="w-12 text-center font-medium flex items-center justify-center gap-1" data-testid={`season-ppg-${player.playerId}-${sIdx}`}>
                                      {season.ppg}
                                      {sIdx > 0 && (
                                        <span className={`text-[10px] ${ppgDelta > 0 ? "text-green-500" : ppgDelta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                          {ppgDelta > 0 ? "+" : ""}{ppgDelta.toFixed(1)}
                                        </span>
                                      )}
                                    </span>
                                    <Badge variant="secondary" className="w-14 justify-center text-xs" data-testid={`season-rank-${player.playerId}-${sIdx}`}>
                                      {season.positionRank > 0 && season.positionRank < 999 ? `#${season.positionRank}` : "-"}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      ) : (
        filteredTrendingPlayers.length === 0 ? (
          <Card data-testid="empty-state">
            <CardContent className="py-12 text-center">
              {activeTab === "added" ? (
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              ) : (
                <UserMinus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              )}
              <p className="text-muted-foreground" data-testid="text-empty-message">
                {searchTerm ? "No players matching your search" : "No trending data available"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTrendingPlayers.map((player) => (
              <Card
                key={player.id}
                className="hover-elevate"
                data-testid={`trending-card-${player.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                      {player.rank}
                    </div>

                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getNFLTeamLogo(player.team) || undefined} alt={player.team} />
                      <AvatarFallback className="text-xs">{player.team}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate" data-testid={`text-player-name-${player.id}`}>
                          {player.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={getPositionColorClass(player.position)}>
                          {player.position}
                        </Badge>
                        <span>{player.team}</span>
                        {player.age && <span>Age {player.age}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1">
                        {activeTab === "added" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span className="font-bold text-lg" data-testid={`count-${player.id}`}>
                          {player.count.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {activeTab === "added" ? "adds" : "drops"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
    </PremiumGate>
  );
}
