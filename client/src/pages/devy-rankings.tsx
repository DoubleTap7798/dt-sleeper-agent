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
import { GraduationCap, Filter, ArrowUpDown, ChevronRight, Database, RefreshCw, CheckCircle, AlertCircle, Layers, BarChart3, Brain, Target } from "lucide-react";
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
  consensusRank: number;
  marketRank: number;
  modelRank: number;
  rankDelta: number;
  dviScore: number;
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
  injuryRisk: number;
  transferRisk: number;
  competitionRisk: number;
  conferenceAdjustment: number;
  nflCompConfidence: number;
  breakoutProbability: number;
  ageAdjustedDominator: number;
  devyPickEquivalent: string;
  rookiePickEquivalent: string;
  roundProbabilities: {
    r1: number; r2: number; r3: number; r4: number;
    r5: number; r6: number; r7: number; udfa: number;
  };
}

interface DevyData {
  players: DevyPlayer[];
  positions: string[];
  years: number[];
  totalCount: number;
  source: string;
}

type SortField = "rank" | "name" | "position" | "year" | "college" | "value" | "tier" | "dvi" | "expectedRound" | "round1Pct" | "day2Pct" | "bustPct" | "breakoutProbability" | "ageAdjustedDominator" | "nflCompConfidence" | "transferRisk" | "injuryRisk";
type SortDirection = "asc" | "desc";
type RankingMode = "market" | "model" | "delta";

function getExpectedRound(rp: DevyPlayer["roundProbabilities"]): number {
  return (rp.r1 * 1 + rp.r2 * 2 + rp.r3 * 3 + rp.r4 * 4 + rp.r5 * 5 + rp.r6 * 6 + rp.r7 * 7 + rp.udfa * 8) / 100;
}

function formatExpectedRound(val: number): string {
  if (val <= 1.5) return "Rd 1";
  if (val <= 2.5) return "Rd 2";
  if (val <= 3.5) return "Rd 3";
  if (val <= 4.5) return "Day 3";
  if (val <= 6.5) return "Late";
  return "UDFA";
}

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
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [rankingMode, setRankingMode] = useState<RankingMode>("market");

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
    if (tierFilter !== null && player.tier !== tierFilter) return false;
    return true;
  });

  const getRankValue = (p: DevyPlayer) => {
    if (rankingMode === "market") return p.marketRank;
    if (rankingMode === "model") return p.modelRank;
    return p.rankDelta;
  };

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "rank": comparison = getRankValue(a) - getRankValue(b); break;
      case "name": comparison = a.name.localeCompare(b.name); break;
      case "position": comparison = a.position.localeCompare(b.position); break;
      case "year": comparison = a.draftEligibleYear - b.draftEligibleYear; break;
      case "college": comparison = a.college.localeCompare(b.college); break;
      case "value": comparison = a.value - b.value; break;
      case "tier": comparison = a.tier - b.tier; break;
      case "dvi": comparison = calculateDVI(a) - calculateDVI(b); break;
      case "expectedRound": comparison = getExpectedRound(a.roundProbabilities) - getExpectedRound(b.roundProbabilities); break;
      case "round1Pct": comparison = a.round1Pct - b.round1Pct; break;
      case "day2Pct": comparison = (a.roundProbabilities.r2 + a.roundProbabilities.r3) - (b.roundProbabilities.r2 + b.roundProbabilities.r3); break;
      case "bustPct": comparison = a.bustPct - b.bustPct; break;
      case "breakoutProbability": comparison = a.breakoutProbability - b.breakoutProbability; break;
      case "ageAdjustedDominator": comparison = a.ageAdjustedDominator - b.ageAdjustedDominator; break;
      case "nflCompConfidence": comparison = a.nflCompConfidence - b.nflCompConfidence; break;
      case "transferRisk": comparison = a.transferRisk - b.transferRisk; break;
      case "injuryRisk": comparison = a.injuryRisk - b.injuryRisk; break;
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

  const allTierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const posYearFiltered = players.filter(p => {
    if (positionFilter !== "all" && p.position !== positionFilter) return false;
    if (yearFilter !== "all" && p.draftEligibleYear !== parseInt(yearFilter)) return false;
    return true;
  });
  posYearFiltered.forEach(p => {
    if (p.tier >= 1 && p.tier <= 5) allTierCounts[p.tier]++;
  });
  const total = posYearFiltered.length || 1;

  return (
    <PremiumGate featureName="Devy Rankings">
    <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-rankings-page">
      <div className="relative overflow-hidden rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/40 via-stone-950/80 to-stone-950/60 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-700/10 via-transparent to-transparent" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-amber-700/20 border border-amber-700/30 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-amber-100" data-testid="text-rankings-title">
                Prospect Rankings
              </h1>
              <p className="text-sm text-amber-200/60">
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

        <div className="flex items-center gap-1 ml-auto border rounded-md p-0.5" data-testid="ranking-toggle">
          <Button
            variant={rankingMode === "market" ? "default" : "ghost"}
            size="sm"
            onClick={() => setRankingMode("market")}
            className="gap-1"
            data-testid="button-rank-market"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Market
          </Button>
          <Button
            variant={rankingMode === "model" ? "default" : "ghost"}
            size="sm"
            onClick={() => setRankingMode("model")}
            className="gap-1"
            data-testid="button-rank-model"
          >
            <Brain className="h-3.5 w-3.5" />
            Model
          </Button>
          <Button
            variant={rankingMode === "delta" ? "default" : "ghost"}
            size="sm"
            onClick={() => setRankingMode("delta")}
            className="gap-1"
            data-testid="button-rank-delta"
          >
            <Target className="h-3.5 w-3.5" />
            Delta
          </Button>
        </div>
      </div>

      <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-tier-distribution">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-100">Tier Distribution</span>
            </div>
            {tierFilter !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTierFilter(null)}
                className="text-xs text-amber-200/70 gap-1"
                data-testid="button-clear-tier-filter"
              >
                Clear Filter
              </Button>
            )}
          </div>
          <div className="flex h-4 rounded-full overflow-hidden cursor-pointer" data-testid="bar-tier-distribution">
            {(() => {
              const MIN_PCT = 3;
              const activeTiers = tierConfig.filter(tc => allTierCounts[tc.tier] > 0);
              const rawPcts = activeTiers.map(tc => (allTierCounts[tc.tier] / total) * 100);
              const belowMin = rawPcts.filter(p => p < MIN_PCT).length;
              const aboveMinSum = rawPcts.filter(p => p >= MIN_PCT).reduce((s, p) => s + p, 0);
              const scale = aboveMinSum > 0 ? (100 - belowMin * MIN_PCT) / aboveMinSum : 1;
              return activeTiers.map((tc, i) => {
                const pct = rawPcts[i] < MIN_PCT ? MIN_PCT : rawPcts[i] * scale;
                const isActive = tierFilter === null || tierFilter === tc.tier;
                return (
                  <div
                    key={tc.tier}
                    role="button"
                    tabIndex={0}
                    className={`${tc.bgClass} transition-opacity ${isActive ? "opacity-100" : "opacity-30"}`}
                    style={{ width: `${pct}%` }}
                    onClick={() => setTierFilter(tierFilter === tc.tier ? null : tc.tier)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTierFilter(tierFilter === tc.tier ? null : tc.tier); }}
                    title={`${tc.label}: ${allTierCounts[tc.tier]} players`}
                    data-testid={`bar-segment-tier-${tc.tier}`}
                  />
                );
              });
            })()}
          </div>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
            {tierConfig.map(tc => (
              <button
                key={tc.tier}
                className={`flex items-center gap-1 text-xs cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${
                  tierFilter === tc.tier
                    ? "bg-amber-700/30 ring-1 ring-amber-500/50"
                    : tierFilter !== null
                    ? "opacity-40"
                    : ""
                }`}
                onClick={() => setTierFilter(tierFilter === tc.tier ? null : tc.tier)}
                data-testid={`label-tier-${tc.tier}`}
              >
                <div className={`h-2.5 w-2.5 rounded-full ${tc.bgClass}`} />
                <span className="text-amber-200/50">{tc.label}</span>
                <span className="font-medium">{allTierCounts[tc.tier]}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-devy-table">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg text-amber-100" data-testid="text-showing-count">
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
          <div className="border-b border-amber-800/20 px-6 py-4 bg-amber-900/5" data-testid="panel-data-sources">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-amber-100">
                <Database className="h-4 w-4 text-amber-500" />
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
              <thead className="border-b border-amber-800/20">
                <tr className="text-left text-sm text-amber-200/50">
                  <th className="p-3 w-12">
                    <SortButton field="rank" label={rankingMode === "delta" ? "Δ" : "#"} />
                  </th>
                  <th className="p-3"><SortButton field="name" label="Player" /></th>
                  <th className="p-3 w-16"><SortButton field="position" label="Pos" /></th>
                  <th className="p-3 w-20"><SortButton field="year" label="Draft" /></th>
                  <th className="p-3 w-20 text-center">
                    <SortButton field="dvi" label="DVI" />
                  </th>
                  <th className="p-3 w-20 text-center">
                    <SortButton field="expectedRound" label="Exp Rd" />
                  </th>
                  <th className="p-3 w-16 text-center">
                    <SortButton field="round1Pct" label="R1%" />
                  </th>
                  <th className="p-3 w-16 text-center">
                    <Tooltip><TooltipTrigger asChild><div><SortButton field="day2Pct" label="D2%" /></div></TooltipTrigger><TooltipContent>Day 2 Probability (Rounds 2-3)</TooltipContent></Tooltip>
                  </th>
                  <th className="p-3 w-16 text-center">
                    <SortButton field="bustPct" label="Bust%" />
                  </th>
                  <th className="p-3 w-20 text-center">
                    <Tooltip><TooltipTrigger asChild><div><SortButton field="breakoutProbability" label="Brk%" /></div></TooltipTrigger><TooltipContent>Breakout Probability</TooltipContent></Tooltip>
                  </th>
                  <th className="p-3 w-16 text-center">
                    <Tooltip><TooltipTrigger asChild><div><SortButton field="ageAdjustedDominator" label="aDOM" /></div></TooltipTrigger><TooltipContent>Age-Adjusted Dominator Percentile</TooltipContent></Tooltip>
                  </th>
                  <th className="p-3 w-16 text-center">
                    <Tooltip><TooltipTrigger asChild><div><SortButton field="nflCompConfidence" label="Comp" /></div></TooltipTrigger><TooltipContent>NFL Comp Confidence Score (0-100)</TooltipContent></Tooltip>
                  </th>
                  <th className="p-3 w-16 text-center">
                    <Tooltip><TooltipTrigger asChild><div><SortButton field="transferRisk" label="Xfer" /></div></TooltipTrigger><TooltipContent>NIL/Transfer Risk Score (0-100)</TooltipContent></Tooltip>
                  </th>
                  <th className="p-3 w-16 text-center">
                    <Tooltip><TooltipTrigger asChild><div><SortButton field="injuryRisk" label="Inj" /></div></TooltipTrigger><TooltipContent>Injury Risk Score (0-100)</TooltipContent></Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
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
                            <td colSpan={14} className={`p-3 border-l-4 ${tierColors[player.tier] || "bg-muted/30"}`}>
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
                      const expRd = getExpectedRound(player.roundProbabilities);
                      const day2Pct = player.roundProbabilities.r2 + player.roundProbabilities.r3;
                      const displayRank = rankingMode === "market" ? player.marketRank : rankingMode === "model" ? player.modelRank : player.rankDelta;
                      rows.push(
                        <tr
                          key={player.playerId}
                          className={`cursor-pointer hover-elevate ${index % 2 === 0 ? "bg-amber-900/5" : ""}`}
                          onClick={() => handlePlayerClick(player)}
                          data-testid={`row-player-${player.playerId}`}
                        >
                          <td className="p-3 font-medium">
                            {rankingMode === "delta" ? (
                              <span className={`text-sm font-bold ${displayRank > 0 ? "text-green-500" : displayRank < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                {displayRank > 0 ? `+${displayRank}` : displayRank}
                              </span>
                            ) : (
                              <span>{displayRank}</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                <span className="sm:hidden">{abbreviateName(player.name)}</span>
                                <span className="hidden sm:inline">{player.name}</span>
                              </span>
                              <span className="text-xs text-muted-foreground">{player.college}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={getPositionColorClass(player.position)}>
                              {player.position}{player.positionRank}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{player.draftEligibleYear}</Badge>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-base font-bold ${
                              calculateDVI(player) >= 80 ? "text-green-500" :
                              calculateDVI(player) >= 60 ? "text-amber-400" :
                              calculateDVI(player) >= 40 ? "text-yellow-500" :
                              "text-red-500"
                            }`} data-testid={`text-dvi-${player.playerId}`}>{calculateDVI(player)}</span>
                          </td>
                          <td className="p-3 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs font-medium" data-testid={`text-exprd-${player.playerId}`}>{formatExpectedRound(expRd)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-0.5 text-xs">
                                  <p>Expected Round: {expRd.toFixed(1)}</p>
                                  <p>R1: {player.roundProbabilities.r1}% | R2: {player.roundProbabilities.r2}% | R3: {player.roundProbabilities.r3}%</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs font-medium ${player.round1Pct >= 50 ? "text-green-500" : player.round1Pct >= 25 ? "text-amber-400" : "text-muted-foreground"}`} data-testid={`text-r1pct-${player.playerId}`}>
                              {player.round1Pct}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-xs font-medium text-muted-foreground" data-testid={`text-d2pct-${player.playerId}`}>
                              {day2Pct}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs font-medium ${player.bustPct >= 30 ? "text-red-500" : player.bustPct >= 15 ? "text-amber-400" : "text-green-500"}`} data-testid={`text-bust-${player.playerId}`}>
                              {player.bustPct}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs font-medium ${player.breakoutProbability >= 50 ? "text-green-500" : player.breakoutProbability >= 25 ? "text-amber-400" : "text-muted-foreground"}`} data-testid={`text-brk-${player.playerId}`}>
                              {player.breakoutProbability}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs font-medium ${player.ageAdjustedDominator >= 80 ? "text-green-500" : player.ageAdjustedDominator >= 50 ? "text-amber-400" : "text-muted-foreground"}`} data-testid={`text-adom-${player.playerId}`}>
                              {player.ageAdjustedDominator}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-xs font-medium text-muted-foreground" data-testid={`text-comp-${player.playerId}`}>
                              {player.nflCompConfidence}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs font-medium ${player.transferRisk >= 50 ? "text-red-500" : player.transferRisk >= 25 ? "text-amber-400" : "text-green-500"}`} data-testid={`text-xfer-${player.playerId}`}>
                              {player.transferRisk}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs font-medium ${player.injuryRisk >= 50 ? "text-red-500" : player.injuryRisk >= 25 ? "text-amber-400" : "text-green-500"}`} data-testid={`text-inj-${player.playerId}`}>
                              {player.injuryRisk}
                            </span>
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
                  className="p-3 rounded-lg bg-amber-900/10 border border-amber-800/15 hover-elevate cursor-pointer"
                  onClick={() => handlePlayerClick(player)}
                  data-testid={`card-player-${player.playerId}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-1.5">
                          {abbreviateName(player.name)}
                          <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                            {player.position}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <span className={`text-lg font-bold ${
                          calculateDVI(player) >= 80 ? "text-green-500" :
                          calculateDVI(player) >= 60 ? "text-amber-400" :
                          calculateDVI(player) >= 40 ? "text-yellow-500" :
                          "text-red-500"
                        }`}>{calculateDVI(player)}</span>
                        <div className="text-[10px] text-amber-200/50">DVI</div>
                      </div>
                      <div className="text-center">
                        <span className={`text-sm font-bold ${player.round1Pct >= 50 ? "text-green-500" : player.round1Pct >= 25 ? "text-amber-400" : "text-muted-foreground"}`}>{player.round1Pct}%</span>
                        <div className="text-[10px] text-amber-200/50">R1</div>
                      </div>
                      <div className="text-center">
                        <span className={`text-sm font-bold ${player.bustPct >= 30 ? "text-red-500" : player.bustPct >= 15 ? "text-amber-400" : "text-green-500"}`}>{player.bustPct}%</span>
                        <div className="text-[10px] text-amber-200/50">Bust</div>
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
