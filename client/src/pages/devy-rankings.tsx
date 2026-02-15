import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
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
import { GraduationCap, Filter, ArrowUpDown, TrendingUp, TrendingDown, ChevronRight, Sparkles, Zap, AlertTriangle, Database, RefreshCw, CheckCircle, AlertCircle, Layers } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { InfoTooltip } from "@/components/metric-tooltip";
import { ExportButton } from "@/components/export-button";
import { formatDevyForShare } from "@/lib/export-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  starterPct: number;
  elitePct: number;
  bustPct: number;
  top10Pct: number;
  round1Pct: number;
  round2PlusPct: number;
  pickEquivalent: string;
  pickMultiplier: number;
  dominatorRating: number;
  yardShare: number;
  tdShare: number;
  breakoutAge: number | null;
  comps: DevyComp[];
  depthRole: string;
  pathContext: string;
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

export { calculateDVI };
export type { DevyPlayer, DevyData, DevyComp };

export default function DevyRankingsPage() {
  usePageTitle("Devy Rankings");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [groupByTier, setGroupByTier] = useState<boolean>(false);

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
    return <RankingsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-rankings">
        <p className="text-muted-foreground">Failed to load devy rankings</p>
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
      case "rank": comparison = a.rank - b.rank; break;
      case "name": comparison = a.name.localeCompare(b.name); break;
      case "position": comparison = a.position.localeCompare(b.position); break;
      case "year": comparison = a.draftEligibleYear - b.draftEligibleYear; break;
      case "college": comparison = a.college.localeCompare(b.college); break;
      case "value": comparison = a.value - b.value; break;
      case "tier": comparison = a.tier - b.tier; break;
      case "dvi": comparison = calculateDVI(a) - calculateDVI(b); break;
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

  const tierConfig = [
    { tier: 1, label: "Elite", color: "rgb(34, 197, 94)", bgClass: "bg-green-500" },
    { tier: 2, label: "Blue Chip", color: "rgb(59, 130, 246)", bgClass: "bg-blue-500" },
    { tier: 3, label: "Solid", color: "rgb(234, 179, 8)", bgClass: "bg-yellow-500" },
    { tier: 4, label: "Developmental", color: "rgb(249, 115, 22)", bgClass: "bg-orange-500" },
    { tier: 5, label: "Lottery", color: "rgb(239, 68, 68)", bgClass: "bg-red-500" },
  ];

  const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  filteredPlayers.forEach(p => {
    if (p.tier >= 1 && p.tier <= 5) tierCounts[p.tier]++;
  });
  const total = filteredPlayers.length || 1;

  return (
    <PremiumGate featureName="Devy Rankings">
    <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-rankings-page">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-green-500/10 via-background to-blue-500/10 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-500/5 via-transparent to-transparent" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-rankings-title">
                Prospect Rankings
              </h1>
              <p className="text-sm text-muted-foreground">
                {filteredPlayers.length} prospects across {positions.length} positions
              </p>
            </div>
          </div>
          <ExportButton
            data={sortedPlayers.map((p) => ({
              Rank: p.rank,
              Name: p.name,
              Position: p.position,
              School: p.college,
              Class: p.draftEligibleYear,
              Value: p.value,
              DVI: calculateDVI(p),
            }))}
            filename="devy-rankings"
            shareText={formatDevyForShare(sortedPlayers)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap" data-testid="devy-filters">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[120px]" data-testid="select-position-filter">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-position-all">All Positions</SelectItem>
            {positions.map((pos) => (
              <SelectItem key={pos} value={pos} data-testid={`option-position-${pos}`}>{pos}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[120px]" data-testid="select-year-filter">
            <SelectValue placeholder="Draft Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-year-all">All Years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()} data-testid={`option-year-${year}`}>{year} Draft</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={groupByTier ? "default" : "outline"}
          size="sm"
          onClick={() => setGroupByTier(!groupByTier)}
          className="gap-1.5 toggle-elevate"
          data-testid="button-toggle-tiers"
        >
          <Layers className="h-3.5 w-3.5" />
          Tiers
        </Button>
      </div>

      <Card data-testid="card-tier-distribution">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Tier Distribution</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden" data-testid="bar-tier-distribution">
            {tierConfig.map(tc => (
              <div
                key={tc.tier}
                className={tc.bgClass}
                style={{ width: `${(tierCounts[tc.tier] / total) * 100}%` }}
                data-testid={`bar-segment-tier-${tc.tier}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
            {tierConfig.map(tc => (
              <div key={tc.tier} className="flex items-center gap-1 text-xs" data-testid={`label-tier-${tc.tier}`}>
                <div className={`h-2.5 w-2.5 rounded-full ${tc.bgClass}`} />
                <span className="text-muted-foreground">{tc.label}</span>
                <span className="font-medium">{tierCounts[tc.tier]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-devy-table">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg" data-testid="text-showing-count">
              {sortedPlayers.length} of {players.length} prospects
            </CardTitle>
            <div className="flex items-center gap-2">
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
                <TooltipContent>View data sources</TooltipContent>
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
                        {source.playerCount} players
                      </p>
                    </div>
                  </div>
                  <Badge variant={source.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {source.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full" data-testid="table-devy">
              <thead className="border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-12"><SortButton field="rank" label="#" /></th>
                  <th className="p-3 w-14 text-center">
                    <Tooltip><TooltipTrigger asChild><span className="font-medium text-sm cursor-help">DT</span></TooltipTrigger><TooltipContent>DT Dynasty Rank</TooltipContent></Tooltip>
                  </th>
                  <th className="p-3 w-14 text-center">
                    <Tooltip><TooltipTrigger asChild><span className="font-medium text-sm cursor-help">FP</span></TooltipTrigger><TooltipContent>FantasyPros Devy Rank</TooltipContent></Tooltip>
                  </th>
                  <th className="p-3"><SortButton field="name" label="Player" /></th>
                  <th className="p-3 w-20"><SortButton field="position" label="Pos" /></th>
                  <th className="p-3"><SortButton field="college" label="College" /></th>
                  <th className="p-3 w-20"><SortButton field="year" label="Draft" /></th>
                  <th className="p-3 w-28 text-center">
                    <span className="font-medium flex items-center justify-center gap-1">
                      DVI
                      <InfoTooltip title="Devy Value Index" description="Composite score (0-100) factoring production trend, class year, NFL draft projection, positional scarcity, hit rates, and depth chart opportunities." />
                    </span>
                  </th>
                  <th className="p-3 w-32 text-center">
                    <span className="font-medium flex items-center justify-center gap-1">
                      Hit Rate
                      <InfoTooltip title="Hit Rate" description="Elite % shows chances of becoming a fantasy star. Bust % shows risk of being a non-contributor." />
                    </span>
                  </th>
                  <th className="p-3 w-28 text-center">
                    <span className="font-medium flex items-center justify-center gap-1">
                      Draft Capital
                      <InfoTooltip title="Draft Capital" description="Projected NFL draft position probability." />
                    </span>
                  </th>
                  <th className="p-3 w-20 text-center">
                    <span className="font-medium flex items-center justify-center gap-1">
                      Trend
                      <InfoTooltip title="Value Trend" description="Recent dynasty value changes." />
                    </span>
                  </th>
                  <th className="p-3 w-16 text-center"><span className="font-medium">Age</span></th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
                      No players match the selected filters
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const tierNames: Record<number, string> = { 1: "Elite Prospects", 2: "Blue Chip", 3: "Solid Contributors", 4: "Developmental", 5: "Lottery Tickets" };
                    const tierColors: Record<number, string> = { 1: "border-l-green-500 bg-green-500/5", 2: "border-l-blue-500 bg-blue-500/5", 3: "border-l-yellow-500 bg-yellow-500/5", 4: "border-l-orange-500 bg-orange-500/5", 5: "border-l-red-500 bg-red-500/5" };
                    const tierArchetypes: Record<number, string> = { 1: "Elite", 2: "Blue Chip", 3: "Solid", 4: "Developmental", 5: "Lottery" };
                    const showTierHeaders = groupByTier && sortField === "rank";
                    let lastTier = 0;
                    const rows: JSX.Element[] = [];
                    sortedPlayers.forEach((player, index) => {
                      if (showTierHeaders && player.tier !== lastTier) {
                        const tierCount = sortedPlayers.filter(p => p.tier === player.tier).length;
                        rows.push(
                          <tr key={`tier-header-${player.tier}`} data-testid={`row-tier-header-${player.tier}`}>
                            <td colSpan={12} className={`p-3 border-l-4 ${tierColors[player.tier] || "bg-muted/30"}`}>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{tierNames[player.tier] || `Tier ${player.tier}`}</span>
                                <Badge variant="secondary" className="text-[10px]">{tierArchetypes[player.tier] || "Other"}</Badge>
                                <span className="text-xs text-muted-foreground">{tierCount} players</span>
                              </div>
                            </td>
                          </tr>
                        );
                        lastTier = player.tier;
                      }
                      rows.push(
                        <tr
                          key={player.playerId}
                          className={`cursor-pointer hover-elevate ${index % 2 === 0 ? "bg-muted/30" : ""}`}
                          onClick={() => handlePlayerClick(player)}
                          data-testid={`row-player-${player.playerId}`}
                        >
                          <td className="p-3 font-medium">{player.rank}</td>
                          <td className="p-3 text-center"><span className="text-xs text-muted-foreground">{player.dtRank}</span></td>
                          <td className="p-3 text-center">
                            {player.fantasyProsRank ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`text-xs font-medium ${
                                    player.fantasyProsRank < player.dtRank ? "text-green-500" :
                                    player.fantasyProsRank > player.dtRank ? "text-red-500" :
                                    "text-muted-foreground"
                                  }`}>{player.fantasyProsRank}</span>
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
                              <span className="font-medium">
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
                            <Badge variant="outline" className={getPositionColorClass(player.position)}>
                              {player.position}{player.positionRank}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground text-sm">
                            <div className="flex flex-col">
                              <span>{player.college}</span>
                              <span className="text-xs">{player.depthRole}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{player.draftEligibleYear}</Badge>
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
                                  }`}>{calculateDVI(player)}</span>
                                  <div className="text-muted-foreground text-[10px]">
                                    {player.trend30Day > 0 ? "+" : ""}{player.trend30Day} last 30d
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1 text-xs">
                                  <p className="font-medium">DVI: {calculateDVI(player)}/100</p>
                                  <p>Pick Value: {player.pickMultiplier.toFixed(1)}x ({player.pickEquivalent})</p>
                                  <p>Elite: {player.elitePct}% | Bust: {player.bustPct}%</p>
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
                                  <p className="text-green-400">Elite: {player.elitePct}%</p>
                                  <p className="text-red-400">Bust: {player.bustPct}%</p>
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
                                  <p>Top 10: {player.top10Pct}%</p>
                                  <p>Round 1: {player.round1Pct}%</p>
                                  <p>Round 2+: {player.round2PlusPct}%</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-center gap-0.5">
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
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {player.ageClass === "young-breakout" ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50 text-xs">
                                    <Zap className="h-3 w-3 mr-0.5" />
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Young Breakout</TooltipContent>
                              </Tooltip>
                            ) : player.ageClass === "old-producer" ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 text-xs">
                                    <AlertTriangle className="h-3 w-3" />
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Older Producer</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  })()
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden p-3 space-y-2" data-testid="mobile-devy-list">
            {sortedPlayers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No players match filters</div>
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
                          {player.ageClass === "young-breakout" && <Zap className="h-3 w-3 text-green-500" />}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                            {player.position}{player.positionRank}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{player.college}</span>
                          <span className="text-xs text-muted-foreground">{player.draftEligibleYear}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className={`text-lg font-bold ${
                          calculateDVI(player) >= 80 ? "text-green-500" :
                          calculateDVI(player) >= 60 ? "text-primary" :
                          calculateDVI(player) >= 40 ? "text-yellow-500" :
                          "text-red-500"
                        }`}>{calculateDVI(player)}</span>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-green-500">{player.elitePct}%</span>
                          <span className="mx-0.5">/</span>
                          <span className="text-red-500">{player.bustPct}%</span>
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
    </PremiumGate>
  );
}

function RankingsSkeleton() {
  return (
    <div className="space-y-6" data-testid="devy-rankings-skeleton">
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
