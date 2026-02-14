import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES, apiRequest, queryClient } from "@/lib/queryClient";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
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
import { GraduationCap, Filter, ArrowUpDown, TrendingUp, TrendingDown, ChevronRight, Sparkles, Target, Zap, AlertTriangle, Database, RefreshCw, CheckCircle, AlertCircle, Bookmark, Flame } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { InfoTooltip } from "@/components/metric-tooltip";
import { ExportButton } from "@/components/export-button";
import { formatDevyForShare } from "@/lib/export-utils";

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
  dtRank: number;
  fantasyProsRank: number | null;
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

type SortField = "rank" | "name" | "position" | "year" | "college" | "value" | "tier" | "dvi";
type SortDirection = "asc" | "desc";

function calculateDVI(player: DevyPlayer): number {
  let score = 0;
  const rankScore = Math.max(0, 40 - (player.rank - 1) * 0.5);
  score += rankScore;
  
  score += (player.round1Pct / 100) * 15;
  score += (player.top10Pct / 100) * 5;
  
  score += (player.elitePct / 100) * 15;
  score -= (player.bustPct / 100) * 5;
  
  const trendBonus = Math.min(10, Math.max(-5, player.trend30Day * 0.5));
  score += 5 + trendBonus;
  
  if (player.ageClass === "young-breakout") score += 10;
  else if (player.ageClass === "normal") score += 6;
  else score += 3;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

export default function DevyPage() {
  usePageTitle("Devy Rankings");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "mydevy">("all");

  const { data, isLoading, error } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: sourcesData } = useQuery<{ sources: DataSourceStatus[] }>({
    queryKey: ["/api/sleeper/devy/sources"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: myDevyData } = useQuery<{ ownedDevy: Array<{ devyPlayerId: string; devyName: string; devyPosition: string; devySchool: string; leagueId: string; leagueName: string; matched: boolean }>; leagues: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/sleeper/devy/my-players"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: watchlistData } = useQuery<{ watchlist: Array<{ playerId: string }> }>({
    queryKey: ["/api/watchlist"],
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

  const fuzzyNameMatch = (name1: string, name2: string): boolean => {
    const a = name1.toLowerCase().trim();
    const b = name2.toLowerCase().trim();
    if (a === b) return true;
    const aParts = a.split(' ');
    const bParts = b.split(' ');
    const aLast = aParts[aParts.length - 1];
    const bLast = bParts[bParts.length - 1];
    if (aLast !== bLast) return false;
    const aFirst = aParts[0];
    const bFirst = bParts[0];
    if (aFirst.replace('.', '') === bFirst.replace('.', '')) return true;
    if (aFirst.length <= 2 && bFirst.startsWith(aFirst.replace('.', ''))) return true;
    if (bFirst.length <= 2 && aFirst.startsWith(bFirst.replace('.', ''))) return true;
    return false;
  };

  const filteredPlayers = players.filter((player) => {
    if (positionFilter !== "all" && player.position !== positionFilter) return false;
    if (yearFilter !== "all" && player.draftEligibleYear !== parseInt(yearFilter)) return false;
    if (viewMode === "mydevy") {
      const ownedIds = new Set(myDevyData?.ownedDevy?.map(d => d.devyPlayerId) || []);
      const watchlistIds = new Set(watchlistData?.watchlist?.map(w => w.playerId) || []);
      const isOwned = ownedIds.has(player.playerId) || watchlistIds.has(player.playerId) ||
        (myDevyData?.ownedDevy || []).some(d => fuzzyNameMatch(d.devyName, player.name));
      if (!isOwned) return false;
    }
    return true;
  });

  const unmatchedDevy = viewMode === "mydevy" ? (myDevyData?.ownedDevy || []).filter(d => {
    if (d.matched) return false;
    return !players.some(p => p.playerId === d.devyPlayerId || fuzzyNameMatch(d.devyName, p.name));
  }) : [];

  const getOwnedLeagues = (playerId: string, playerName: string): string[] => {
    if (!myDevyData?.ownedDevy) return [];
    return myDevyData.ownedDevy
      .filter(d => d.devyPlayerId === playerId || fuzzyNameMatch(d.devyName, playerName))
      .map(d => d.leagueName);
  };

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
      case "dvi":
        comparison = calculateDVI(a) - calculateDVI(b);
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
    <PremiumGate featureName="Devy Rankings">
    <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-page">
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

        <div className="flex items-center gap-2">
          <ExportButton
            data={sortedPlayers.map((p) => ({
              Rank: p.rank,
              Name: p.name,
              Position: p.position,
              School: p.college,
              Class: p.draftEligibleYear,
              Value: p.value,
            }))}
            filename="devy-rankings"
            shareText={formatDevyForShare(sortedPlayers)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap" data-testid="devy-filters">
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button 
              variant={viewMode === "all" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("all")}
              data-testid="button-view-all"
            >
              All Rankings
            </Button>
            <Button 
              variant={viewMode === "mydevy" ? "default" : "ghost"}
              size="sm" 
              onClick={() => setViewMode("mydevy")}
              className="gap-1"
              data-testid="button-view-mydevy"
            >
              <Bookmark className="h-3.5 w-3.5" />
              My Devy
              {myDevyData?.ownedDevy && myDevyData.ownedDevy.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{myDevyData.ownedDevy.length}</Badge>
              )}
            </Button>
          </div>

          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-[100px]" data-testid="select-position-filter">
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
            <SelectTrigger className="w-[110px]" data-testid="select-year-filter">
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

      {data && (() => {
        const risers = players.filter(p => p.trend30Day >= 5).sort((a, b) => b.trend30Day - a.trend30Day).slice(0, 5);
        const fallers = players.filter(p => p.trend30Day <= -5).sort((a, b) => a.trend30Day - b.trend30Day).slice(0, 5);
        const breakouts = players.filter(p => p.ageClass === "young-breakout" && p.trend30Day > 0).slice(0, 3);
        
        if (risers.length === 0 && fallers.length === 0) return null;
        
        return (
          <Card data-testid="card-devy-alerts">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Devy Alerts</h3>
                <span className="text-xs text-muted-foreground">Last 30 days</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {risers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-xs font-medium text-green-500">Rising</span>
                    </div>
                    <div className="space-y-1.5">
                      {risers.map(p => (
                        <div key={p.playerId} className="flex items-center justify-between gap-2 text-xs cursor-pointer hover-elevate p-1.5 rounded" onClick={() => handlePlayerClick(p)} data-testid={`alert-riser-${p.playerId}`}>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                            <span className="font-medium">{abbreviateName(p.name)}</span>
                          </div>
                          <span className="text-green-500 font-medium">+{p.trend30Day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {fallers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-500">Falling</span>
                    </div>
                    <div className="space-y-1.5">
                      {fallers.map(p => (
                        <div key={p.playerId} className="flex items-center justify-between gap-2 text-xs cursor-pointer hover-elevate p-1.5 rounded" onClick={() => handlePlayerClick(p)} data-testid={`alert-faller-${p.playerId}`}>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                            <span className="font-medium">{abbreviateName(p.name)}</span>
                          </div>
                          <span className="text-red-500 font-medium">{p.trend30Day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {breakouts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <Zap className="h-3.5 w-3.5 text-yellow-500" />
                      <span className="text-xs font-medium text-yellow-500">Young Breakouts</span>
                    </div>
                    <div className="space-y-1.5">
                      {breakouts.map(p => (
                        <div key={p.playerId} className="flex items-center justify-between gap-2 text-xs cursor-pointer hover-elevate p-1.5 rounded" onClick={() => handlePlayerClick(p)} data-testid={`alert-breakout-${p.playerId}`}>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                            <span className="font-medium">{abbreviateName(p.name)}</span>
                          </div>
                          <span className="text-yellow-500 font-medium">DVI {calculateDVI(p)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card data-testid="card-devy-table">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg" data-testid="text-showing-count">
              Showing {sortedPlayers.length + unmatchedDevy.length} of {viewMode === "mydevy" ? `${(myDevyData?.ownedDevy?.length || 0)} owned` : `${players.length} players`}
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
              Devy rankings are curated by DT Dynasty with values, tiers, draft projections, and player comparisons.
              FantasyPros provides expert consensus devy rankings (top 100) for cross-reference.
              Dynasty Process provides NFL player values and ECR for the trade calculator. 
              nflverse powers advanced analytics (target share, WOPR, air yards) in player profiles.
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
                  <th className="p-3 w-14 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium text-sm cursor-help">DT</span>
                      </TooltipTrigger>
                      <TooltipContent>DT Dynasty Rank</TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="p-3 w-14 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium text-sm cursor-help">FP</span>
                      </TooltipTrigger>
                      <TooltipContent>FantasyPros Devy Rank</TooltipContent>
                    </Tooltip>
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
                    <span className="font-medium flex items-center justify-center gap-1">
                      DVI
                      <InfoTooltip title="Devy Value Index" description="Composite score (0-100) factoring production trend, class year, NFL draft projection, positional scarcity, hit rates, and depth chart opportunities. Higher = more valuable prospect." />
                    </span>
                  </th>
                  <th className="p-3 w-32 text-center">
                    <span className="font-medium flex items-center justify-center gap-1">
                      Hit Rate
                      <InfoTooltip title="Hit Rate" description="Elite % shows chances of becoming a fantasy star. Bust % shows risk of being a non-contributor. Based on historical data for similar prospects." />
                    </span>
                  </th>
                  <th className="p-3 w-28 text-center">
                    <span className="font-medium flex items-center justify-center gap-1">
                      Draft Capital
                      <InfoTooltip title="Draft Capital" description="Projected NFL draft position. Shows probability of being a top-10 pick, 1st rounder, or later. Higher draft capital usually means more opportunity." />
                    </span>
                  </th>
                  <th className="p-3 w-20 text-center">
                    <span className="font-medium flex items-center justify-center gap-1">
                      Trend
                      <InfoTooltip title="Value Trend" description="How this prospect's dynasty value has changed recently. Green arrow = rising stock, Red arrow = falling stock." />
                    </span>
                  </th>
                  <th className="p-3 w-16 text-center">
                    <span className="font-medium">Age</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
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
                      <td className="p-3 text-center" data-testid={`text-dt-rank-${player.playerId}`}>
                        <span className="text-xs text-muted-foreground">{player.dtRank}</span>
                      </td>
                      <td className="p-3 text-center" data-testid={`text-fp-rank-${player.playerId}`}>
                        {player.fantasyProsRank ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`text-xs font-medium ${
                                player.fantasyProsRank < player.dtRank ? "text-green-500" :
                                player.fantasyProsRank > player.dtRank ? "text-red-500" :
                                "text-muted-foreground"
                              }`}>
                                {player.fantasyProsRank}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                FantasyPros: #{player.fantasyProsRank}
                                {player.fantasyProsRank !== player.dtRank && (
                                  <span className={player.fantasyProsRank < player.dtRank ? " text-green-400" : " text-red-400"}>
                                    {" "}({player.fantasyProsRank < player.dtRank ? "+" : ""}{player.dtRank - player.fantasyProsRank} vs DT)
                                  </span>
                                )}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
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
                          {viewMode === "mydevy" && (() => {
                            const leagues = getOwnedLeagues(player.playerId, player.name);
                            if (leagues.length === 0) return null;
                            return (
                              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                {leagues.map((league, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">{league}</Badge>
                                ))}
                              </div>
                            );
                          })()}
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
                              <span className={`text-lg font-bold ${
                                calculateDVI(player) >= 80 ? "text-green-500" :
                                calculateDVI(player) >= 60 ? "text-primary" :
                                calculateDVI(player) >= 40 ? "text-yellow-500" :
                                "text-red-500"
                              }`}>
                                {calculateDVI(player)}
                              </span>
                              <div className="text-muted-foreground text-[10px]">
                                {player.trend30Day > 0 ? "+" : ""}{player.trend30Day} last 30d
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <p className="font-medium">Devy Value Index: {calculateDVI(player)}/100</p>
                              <p>Pick Value: {player.pickMultiplier.toFixed(1)}x ({player.pickEquivalent})</p>
                              <p>Elite: {player.elitePct}% | Bust: {player.bustPct}%</p>
                              <p>Round 1: {player.round1Pct}% | Top 10: {player.top10Pct}%</p>
                            </div>
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
                          <span className="text-xs text-muted-foreground">• DT #{player.dtRank}</span>
                          {player.fantasyProsRank && (
                            <span className={`text-xs font-medium ${
                              player.fantasyProsRank < player.dtRank ? "text-green-500" :
                              player.fantasyProsRank > player.dtRank ? "text-red-500" :
                              "text-muted-foreground"
                            }`}>
                              • FP #{player.fantasyProsRank}
                            </span>
                          )}
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
                        <div className="font-medium text-sm">
                          <span className={`${
                            calculateDVI(player) >= 80 ? "text-green-500" :
                            calculateDVI(player) >= 60 ? "text-primary" :
                            calculateDVI(player) >= 40 ? "text-yellow-500" :
                            "text-red-500"
                          }`}>{calculateDVI(player)}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">DVI</span>
                        </div>
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

          {unmatchedDevy.length > 0 && (
            <div className="border-t p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Additional Owned Devy ({unmatchedDevy.length} not in rankings)
              </h3>
              <div className="space-y-2">
                {unmatchedDevy.map((d, i) => (
                  <div key={`unmatched-${i}`} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30" data-testid={`card-unmatched-devy-${i}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(d.devyPosition)}`}>
                        {d.devyPosition}
                      </Badge>
                      <div className="min-w-0">
                        <span className="font-medium text-sm truncate block">{d.devyName}</span>
                        <span className="text-xs text-muted-foreground">{d.devySchool}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{d.leagueName}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
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
    </PremiumGate>
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
