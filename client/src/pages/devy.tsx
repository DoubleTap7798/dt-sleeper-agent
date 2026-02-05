import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES, apiRequest, queryClient } from "@/lib/queryClient";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap, Filter, ArrowUpDown, TrendingUp, TrendingDown, ChevronRight, Sparkles, Target, Zap, AlertTriangle, Database, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { useMutation } from "@tanstack/react-query";

interface DataSourceStatus {
  sourceId: string;
  sourceName: string;
  lastUpdated: string;
  playerCount: number;
  status: 'active' | 'stale' | 'error';
}

interface DevyComp {
  name: string;
  matchPct: number;
  wasSuccess: boolean;
}

interface DevyPlayer {
  playerId: string;
  name: string;
  position: string;
  positionRank: number;
  college: string;
  draftEligibleYear: number;
  tier: number;
  trend7Day: number;
  trend30Day: number;
  seasonChange: number;
  value: number;
  rank: number;
  // Breakout/Bust probability
  starterPct: number;
  elitePct: number;
  bustPct: number;
  // Draft capital confidence
  top10Pct: number;
  round1Pct: number;
  round2PlusPct: number;
  // Trade value equivalent
  pickEquivalent: string;
  pickMultiplier: number;
  // Market share metrics
  dominatorRating: number;
  yardShare: number;
  tdShare: number;
  breakoutAge: number | null;
  // Historical comps
  comps: DevyComp[];
  // Path to production
  depthRole: string;
  pathContext: string;
  // Age vs Class indicator
  ageClass: "young-breakout" | "normal" | "old-producer";
}

interface DevyData {
  players: DevyPlayer[];
  positions: string[];
  years: number[];
  totalCount: number;
  source: string;
}

type SortField = "rank" | "name" | "position" | "year" | "college" | "value" | "tier";
type SortDirection = "asc" | "desc";

export default function DevyPage() {
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const { data, isLoading, error } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: sourcesData } = useQuery<{ sources: DataSourceStatus[] }>({
    queryKey: ["/api/sleeper/devy/sources"],
    ...CACHE_TIMES.STABLE,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sleeper/devy/refresh-sources");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sleeper/devy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sleeper/devy/sources"] });
    },
  });

  if (isLoading) {
    return <DevySkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-devy">
        <p className="text-muted-foreground" data-testid="text-error-devy">Failed to load devy players</p>
      </div>
    );
  }

  const { players, positions, years } = data;

  const filteredPlayers = players.filter((player) => {
    if (positionFilter !== "all" && player.position !== positionFilter) return false;
    if (yearFilter !== "all" && player.draftEligibleYear !== parseInt(yearFilter)) return false;
    return true;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "rank":
        comparison = a.rank - b.rank;
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "position":
        comparison = a.position.localeCompare(b.position);
        break;
      case "year":
        comparison = a.draftEligibleYear - b.draftEligibleYear;
        break;
      case "college":
        comparison = a.college.localeCompare(b.college);
        break;
      case "value":
        comparison = a.value - b.value;
        break;
      case "tier":
        comparison = a.tier - b.tier;
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handlePlayerClick = (player: DevyPlayer) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-1 font-medium"
      data-testid={`button-sort-${field}`}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-6" data-testid="devy-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-devy-title">
              Devy Rankings
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-devy-subtitle">
              College players eligible for future NFL drafts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" data-testid="devy-filters">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-position-filter">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-position-all">All Positions</SelectItem>
              {positions.map((pos) => (
                <SelectItem key={pos} value={pos} data-testid={`option-position-${pos}`}>
                  {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-year-filter">
              <SelectValue placeholder="Draft Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-year-all">All Years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()} data-testid={`option-year-${year}`}>
                  {year} Draft
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card data-testid="card-devy-table">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg" data-testid="text-showing-count">
              Showing {sortedPlayers.length} of {players.length} players
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Click a player for details</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowSources(!showSources)}
                    data-testid="button-toggle-sources"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>{sourcesData?.sources?.length || 1} Sources</span>
                    {sourcesData?.sources?.every(s => s.status === 'active') ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-yellow-500" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to view data sources</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        
        {showSources && sourcesData?.sources && (
          <div className="border-b px-6 py-4 bg-muted/30" data-testid="panel-data-sources">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Sources
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="gap-1.5"
                data-testid="button-refresh-sources"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sourcesData.sources.map((source) => (
                <div
                  key={source.sourceId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background"
                  data-testid={`source-${source.sourceId}`}
                >
                  <div className="flex items-center gap-2">
                    {source.status === 'active' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : source.status === 'stale' ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{source.sourceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.playerCount} players • Updated {source.lastUpdated}
                      </p>
                    </div>
                  </div>
                  <Badge variant={source.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {source.status}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Rankings are aggregated from multiple sources for more accurate consensus values. 
              Data is refreshed automatically from external sources when available.
            </p>
          </div>
        )}

        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full" data-testid="table-devy">
              <thead className="border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-12">
                    <SortButton field="rank" label="#" />
                  </th>
                  <th className="p-3">
                    <SortButton field="name" label="Player" />
                  </th>
                  <th className="p-3 w-20">
                    <SortButton field="position" label="Pos" />
                  </th>
                  <th className="p-3">
                    <SortButton field="college" label="College" />
                  </th>
                  <th className="p-3 w-20">
                    <SortButton field="year" label="Draft" />
                  </th>
                  <th className="p-3 w-28 text-center">
                    <span className="font-medium">Pick Value</span>
                  </th>
                  <th className="p-3 w-32 text-center">
                    <span className="font-medium">Hit Rate</span>
                  </th>
                  <th className="p-3 w-28 text-center">
                    <span className="font-medium">Draft Capital</span>
                  </th>
                  <th className="p-3 w-20 text-center">
                    <span className="font-medium">Trend</span>
                  </th>
                  <th className="p-3 w-16 text-center">
                    <span className="font-medium">Age</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
                      No players match the selected filters
                    </td>
                  </tr>
                ) : (
                  sortedPlayers.map((player, index) => (
                    <tr
                      key={player.playerId}
                      className={`cursor-pointer hover-elevate ${index % 2 === 0 ? "bg-muted/30" : ""}`}
                      onClick={() => handlePlayerClick(player)}
                      data-testid={`row-player-${player.playerId}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-rank-${player.playerId}`}>
                        {player.rank}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-medium" data-testid={`text-name-${player.playerId}`}>
                            <span className="sm:hidden">{abbreviateName(player.name)}</span>
                            <span className="hidden sm:inline">{player.name}</span>
                          </span>
                          {player.comps && player.comps.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Comp: {player.comps[0].name} ({player.comps[0].matchPct}%)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid={`badge-position-${player.playerId}`}>
                          {player.position}{player.positionRank}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-sm" data-testid={`text-college-${player.playerId}`}>
                        <div className="flex flex-col">
                          <span>{player.college}</span>
                          <span className="text-xs">{player.depthRole}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" data-testid={`badge-year-${player.playerId}`}>
                          {player.draftEligibleYear}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs">
                              <span className="font-medium text-primary">{player.pickMultiplier.toFixed(1)}x</span>
                              <div className="text-muted-foreground truncate max-w-[100px]">{player.pickEquivalent.split(" ").slice(0, 2).join(" ")}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{player.pickEquivalent}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 justify-center text-xs">
                              <Sparkles className="h-3 w-3 text-yellow-500" />
                              <span className="text-green-500 font-medium">{player.elitePct}%</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-red-500">{player.bustPct}%</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <p>Fantasy Starter: {player.starterPct}%</p>
                              <p className="text-green-400">Elite Producer: {player.elitePct}%</p>
                              <p className="text-red-400">Bust Risk: {player.bustPct}%</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-center text-xs">
                              <span className="font-medium">Rd1: {player.round1Pct}%</span>
                              <span className="text-muted-foreground">Top 10: {player.top10Pct}%</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <p>Top 10 Pick: {player.top10Pct}%</p>
                              <p>Round 1: {player.round1Pct}%</p>
                              <p>Round 2+: {player.round2PlusPct}%</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-center gap-0.5" data-testid={`trend-${player.playerId}`}>
                              <div className="flex items-center gap-1">
                                {player.trend30Day > 0 ? (
                                  <TrendingUp className="h-3 w-3 text-green-500" />
                                ) : player.trend30Day < 0 ? (
                                  <TrendingDown className="h-3 w-3 text-red-500" />
                                ) : null}
                                <span className={`text-xs font-medium ${player.trend30Day > 0 ? "text-green-500" : player.trend30Day < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                  {player.trend30Day > 0 ? `+${player.trend30Day}` : player.trend30Day || "-"}
                                </span>
                              </div>
                              <span className={`text-[10px] ${player.seasonChange > 10 ? "text-green-500" : player.seasonChange < -10 ? "text-red-500" : "text-muted-foreground"}`}>
                                Szn: {player.seasonChange > 0 ? "+" : ""}{player.seasonChange}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <p>7-Day: {player.trend7Day > 0 ? "+" : ""}{player.trend7Day}</p>
                              <p>30-Day: {player.trend30Day > 0 ? "+" : ""}{player.trend30Day}</p>
                              <p>Season: {player.seasonChange > 0 ? "+" : ""}{player.seasonChange}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-3 text-center">
                        {player.ageClass === "young-breakout" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50 text-xs">
                                <Zap className="h-3 w-3 mr-0.5" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Young Breakout - Elite age curve</TooltipContent>
                          </Tooltip>
                        ) : player.ageClass === "old-producer" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 text-xs">
                                <AlertTriangle className="h-3 w-3" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Older Producer - Age curve concern</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden p-3 space-y-2" data-testid="mobile-devy-list">
            {sortedPlayers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground" data-testid="text-no-players-mobile">
                No players match the selected filters
              </div>
            ) : (
              sortedPlayers.map((player) => (
                <div
                  key={player.playerId}
                  className="p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer"
                  onClick={() => handlePlayerClick(player)}
                  data-testid={`card-player-${player.playerId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg font-bold shrink-0 w-8">#{player.rank}</span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-1">
                          <span className="sm:hidden">{abbreviateName(player.name)}</span>
                          <span className="hidden sm:inline">{player.name}</span>
                          {player.ageClass === "young-breakout" && (
                            <Zap className="h-3 w-3 text-green-500" />
                          )}
                          {player.ageClass === "old-producer" && (
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                            {player.position}{player.positionRank}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{player.college}</span>
                          <span className="text-xs text-muted-foreground">• {player.draftEligibleYear}</span>
                        </div>
                        {player.comps && player.comps.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Comp: {player.comps[0].name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-medium text-sm text-primary">{player.pickMultiplier.toFixed(1)}x</div>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-green-500">{player.elitePct}%</span>
                          <span className="mx-0.5">/</span>
                          <span className="text-red-500">{player.bustPct}%</span>
                        </div>
                        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                          {player.trend30Day > 0 ? (
                            <>
                              <TrendingUp className="h-3 w-3 text-green-500" />
                              <span className="text-green-500">+{player.trend30Day}</span>
                            </>
                          ) : player.trend30Day < 0 ? (
                            <>
                              <TrendingDown className="h-3 w-3 text-red-500" />
                              <span className="text-red-500">{player.trend30Day}</span>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <DevyProfileModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedPlayer(null);
        }}
        player={selectedPlayer}
      />
    </div>
  );
}

function DevySkeleton() {
  return (
    <div className="space-y-6" data-testid="devy-skeleton">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-10 w-[130px]" />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
