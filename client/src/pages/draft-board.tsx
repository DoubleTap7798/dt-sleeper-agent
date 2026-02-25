import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GraduationCap,
  Filter,
  Search,
  Shield,
  Sword,
  ArrowUpDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Target,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { DraftProfileModal } from "@/components/draft-profile-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { InfoTooltip } from "@/components/metric-tooltip";
import { ExportButton } from "@/components/export-button";
import { formatDraftBoardForShare } from "@/lib/export-utils";

interface CombineData {
  fortyYard: number | null;
  benchPress: number | null;
  vertical: number | null;
  broadJump: number | null;
  threeCone: number | null;
  shuttle: number | null;
  armLength: number | null;
  handSize: number | null;
}

interface DraftScoutingReport {
  strengths: string[];
  weaknesses: string[];
  nflComparison: string;
  draftProjection: string;
  fantasyOutlook: string;
}

interface Draft2026Player {
  id: string;
  rank: number;
  name: string;
  college: string;
  position: string;
  height: string;
  weight: number;
  side: "offense" | "defense";
  positionGroup: string;
  stockStatus: "rising" | "falling" | "steady";
  stockChange: number;
  combine: CombineData | null;
  intangibles: string[];
  scoutingNotes: string | null;
  scouting: DraftScoutingReport | null;
  projectedPickRange: string;
  projectedPickSlot: string;
  elitePct: number;
  starterPct: number;
  bustPct: number;
  evScore: number;
  riskTier: string;
  liquidityScore: number;
  historicalAvgPPG: number;
  positionEliteRate: number | null;
  positionStarterRate: number | null;
  positionBustRate: number | null;
  ktcValue: number | null;
  tier: string | null;
}

interface TierCliff {
  afterRank: number;
  eliteDropFrom: number;
  eliteDropTo: number;
  severity: string;
}

interface DraftStats {
  total: number;
  offense: number;
  defense: number;
  byPosition: Record<string, number>;
}

interface DraftData {
  players: Draft2026Player[];
  stats: DraftStats;
  positionGroups: string[];
  stockMovers: { rising: Draft2026Player[]; falling: Draft2026Player[] };
  tierCliffs: TierCliff[];
  draftYear: number;
}

type SortField = "rank" | "name" | "position" | "college" | "height" | "weight" | "stock" | "evScore" | "elitePct" | "bustPct";
type SortDirection = "asc" | "desc";

function StockIndicator({ status, change }: { status: string; change: number }) {
  if (status === "rising") {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 font-medium" data-testid="stock-rising">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="text-xs">{change}</span>
      </span>
    );
  }
  if (status === "falling") {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 font-medium" data-testid="stock-falling">
        <TrendingDown className="h-3.5 w-3.5" />
        <span className="text-xs">{Math.abs(change)}</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground text-xs" data-testid="stock-steady">&mdash;</span>
  );
}

function StockBadge({ status, change }: { status: string; change: number }) {
  if (status === "rising") {
    return (
      <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-[10px] leading-none no-default-hover-elevate no-default-active-elevate">
        <TrendingUp className="h-2.5 w-2.5 mr-0.5" />{change}
      </Badge>
    );
  }
  if (status === "falling") {
    return (
      <Badge variant="outline" className="text-red-400 border-red-400/30 text-[10px] leading-none no-default-hover-elevate no-default-active-elevate">
        <TrendingDown className="h-2.5 w-2.5 mr-0.5" />{Math.abs(change)}
      </Badge>
    );
  }
  return null;
}

function RiskTierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    Low: "text-emerald-400 border-emerald-400/30",
    Medium: "text-amber-400 border-amber-400/30",
    High: "text-orange-400 border-orange-400/30",
    Extreme: "text-red-400 border-red-400/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] leading-none no-default-hover-elevate no-default-active-elevate ${colors[tier] || ""}`} data-testid={`badge-risk-${tier.toLowerCase()}`}>
      {tier}
    </Badge>
  );
}

function EVScoreBadge({ score }: { score: number }) {
  let color = "text-muted-foreground";
  if (score >= 60) color = "text-emerald-400";
  else if (score >= 40) color = "text-amber-400";
  else if (score >= 20) color = "text-orange-400";
  else color = "text-red-400";
  return (
    <span className={`font-bold text-sm ${color}`} data-testid="text-ev-score">
      {score}
    </span>
  );
}

function TierCliffMarker({ cliff }: { cliff: TierCliff }) {
  return (
    <tr data-testid={`tier-cliff-${cliff.afterRank}`}>
      <td colSpan={10} className="px-3 py-1.5">
        <div className={`flex items-center gap-2 text-xs ${cliff.severity === "major" ? "text-red-400" : "text-amber-400"}`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <div className="flex-1 border-t border-dashed border-current" />
          <span className="font-medium whitespace-nowrap">
            Tier Drop: Elite {cliff.eliteDropFrom}% → {cliff.eliteDropTo}%
          </span>
          <div className="flex-1 border-t border-dashed border-current" />
        </div>
      </td>
    </tr>
  );
}

export default function DraftBoardPage() {
  usePageTitle("2026 Draft Board");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlSearch = urlParams.get("search");

  const [sideFilter, setSideFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>(urlSearch || "");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedPlayer, setSelectedPlayer] = useState<Draft2026Player | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("board");

  useEffect(() => {
    if (urlSearch) setSearchQuery(urlSearch);
  }, [urlSearch]);

  const { data, isLoading, error } = useQuery<DraftData>({
    queryKey: ["/api/draft/2026"],
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <DraftBoardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-draft">
        <p className="text-muted-foreground" data-testid="text-error-draft">Failed to load draft board</p>
      </div>
    );
  }

  const { players, stats, positionGroups, stockMovers, tierCliffs } = data;

  const tierCliffRanks = new Set((tierCliffs || []).map(c => c.afterRank));

  const filteredPlayers = players.filter((player) => {
    if (sideFilter !== "all" && player.side !== sideFilter) return false;
    if (positionFilter !== "all" && player.positionGroup !== positionFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!player.name.toLowerCase().includes(query) && !player.college.toLowerCase().includes(query)) {
        return false;
      }
    }
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
      case "college":
        comparison = a.college.localeCompare(b.college);
        break;
      case "height":
        comparison = a.height.localeCompare(b.height);
        break;
      case "weight":
        comparison = a.weight - b.weight;
        break;
      case "stock":
        comparison = a.stockChange - b.stockChange;
        break;
      case "evScore":
        comparison = a.evScore - b.evScore;
        break;
      case "elitePct":
        comparison = a.elitePct - b.elitePct;
        break;
      case "bustPct":
        comparison = a.bustPct - b.bustPct;
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "stock" || field === "evScore" || field === "elitePct" ? "desc" : field === "bustPct" ? "asc" : "asc");
    }
  };

  const handlePlayerClick = (player: Draft2026Player) => {
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

  const risingPlayers = stockMovers?.rising || [];
  const fallingPlayers = stockMovers?.falling || [];

  return (
    <PremiumGate featureName="2026 Draft Board">
    <div className="space-y-6" data-testid="draft-board-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-draft-title">
              2026 NFL Draft Board
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-draft-subtitle">
              Complete prospect rankings, probability data & scouting for the 2026 draft class
            </p>
          </div>
        </div>
        <ExportButton
          data={sortedPlayers.map((p) => ({
            Rank: p.rank,
            Name: p.name,
            Position: p.position,
            College: p.college,
            Height: p.height,
            Weight: p.weight,
            Stock: p.stockStatus,
            "EV Score": p.evScore,
            "Elite%": p.elitePct,
            "Bust%": p.bustPct,
            "Risk Tier": p.riskTier,
            "Pick Range": p.projectedPickRange,
          }))}
          filename="draft-board-2026"
          shareText={formatDraftBoardForShare(sortedPlayers)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card data-testid="stat-total">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Target className="h-4 w-4 text-amber-400" />
              <span className="text-2xl font-bold" data-testid="text-total-count">{stats.total}</span>
            </div>
            <div className="text-sm text-muted-foreground">Total Prospects</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-offense">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Sword className="h-4 w-4 text-amber-400" />
              <span className="text-2xl font-bold" data-testid="text-offense-count">{stats.offense}</span>
            </div>
            <div className="text-sm text-muted-foreground">Offense</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-defense">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Shield className="h-4 w-4 text-amber-400" />
              <span className="text-2xl font-bold" data-testid="text-defense-count">{stats.defense}</span>
            </div>
            <div className="text-sm text-muted-foreground">Defense</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-draft">
        <TabsList data-testid="tabs-list-draft">
          <TabsTrigger value="board" data-testid="tab-full-board">Full Board</TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock-watch">Stock Watch</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap" data-testid="draft-filters">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or college..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[180px]"
                data-testid="input-search"
              />
            </div>

            <Select value={sideFilter} onValueChange={setSideFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-side-filter">
                <SelectValue placeholder="Side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-side-all">All Sides</SelectItem>
                <SelectItem value="offense" data-testid="option-side-offense">
                  <span className="flex items-center gap-1.5"><Sword className="h-3 w-3" />Offense</span>
                </SelectItem>
                <SelectItem value="defense" data-testid="option-side-defense">
                  <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" />Defense</span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-position-filter">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-position-all">All Positions</SelectItem>
                {positionGroups.map((group) => (
                  <SelectItem key={group} value={group} data-testid={`option-position-${group}`}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortField} onValueChange={(val) => { setSortField(val as SortField); setSortDirection(val === "evScore" || val === "elitePct" || val === "stock" ? "desc" : val === "bustPct" ? "asc" : "asc"); }}>
              <SelectTrigger className="w-[140px]" data-testid="select-sort-field">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank" data-testid="option-sort-rank">Sort: Rank</SelectItem>
                <SelectItem value="evScore" data-testid="option-sort-ev">Sort: EV Score</SelectItem>
                <SelectItem value="elitePct" data-testid="option-sort-elite">Sort: Elite%</SelectItem>
                <SelectItem value="bustPct" data-testid="option-sort-bust">Sort: Bust%</SelectItem>
                <SelectItem value="stock" data-testid="option-sort-stock">Sort: Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card data-testid="card-draft-table">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-lg" data-testid="text-showing-count">
                  Showing {sortedPlayers.length} of {players.length} prospects
                </CardTitle>
                <span className="text-sm text-muted-foreground">Click a player for profile</span>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full" data-testid="table-draft">
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
                      <th className="p-3 w-24">
                        <span className="text-xs font-medium">Pick Range</span>
                      </th>
                      <th className="p-3 w-16">
                        <span className="flex items-center gap-1">
                          <SortButton field="evScore" label="EV" />
                          <InfoTooltip title="Expected Value Score" description="Composite score (0-100) combining elite upside, starter probability, and bust risk. Higher is better. EV = (Elite% x 95) + (Starter% x 60) - (Bust% x 30)" />
                        </span>
                      </th>
                      <th className="p-3 w-16">
                        <SortButton field="elitePct" label="Elite%" />
                      </th>
                      <th className="p-3 w-16">
                        <SortButton field="bustPct" label="Bust%" />
                      </th>
                      <th className="p-3 w-16">
                        <span className="text-xs font-medium">Risk</span>
                      </th>
                      <th className="p-3">
                        <SortButton field="college" label="College" />
                      </th>
                      <th className="p-3 w-20">
                        <span className="flex items-center gap-1">
                          <SortButton field="stock" label="Stock" />
                          <InfoTooltip title="Stock Movement" description="How a prospect's draft stock has changed recently. Rising means they're gaining buzz, falling means concerns are growing." />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
                          No prospects match the selected filters
                        </td>
                      </tr>
                    ) : (
                      sortedPlayers.map((player, index) => {
                        const showCliff = sortField === "rank" && tierCliffRanks.has(player.rank);
                        const cliff = showCliff ? (tierCliffs || []).find(c => c.afterRank === player.rank) : null;
                        return (
                          <>
                            <tr
                              key={player.id}
                              className={`cursor-pointer hover-elevate ${index % 2 === 0 ? "bg-muted/30" : ""}`}
                              onClick={() => handlePlayerClick(player)}
                              data-testid={`row-player-${player.id}`}
                            >
                              <td className="p-3 font-medium" data-testid={`text-rank-${player.id}`}>
                                {player.rank}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium" data-testid={`text-name-${player.id}`}>
                                      {player.name}
                                    </span>
                                    <StockBadge status={player.stockStatus} change={player.stockChange} />
                                    {player.intangibles && player.intangibles.length > 0 && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex" data-testid={`icon-intangibles-${player.id}`}>
                                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" data-testid={`tooltip-intangibles-${player.id}`}>
                                          <div className="space-y-0.5 text-xs">
                                            {player.intangibles.map((trait, i) => (
                                              <div key={i}>{trait}</div>
                                            ))}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid={`badge-position-${player.id}`}>
                                  {player.position}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Link href={`/league/draft-pick-values?position=${player.positionGroup}`} data-testid={`link-pick-range-${player.id}`}>
                                  <span className="text-xs text-primary/80 hover:text-primary underline underline-offset-2 cursor-pointer">
                                    {player.projectedPickRange}
                                  </span>
                                </Link>
                              </td>
                              <td className="p-3" data-testid={`text-ev-${player.id}`}>
                                <EVScoreBadge score={player.evScore} />
                              </td>
                              <td className="p-3">
                                <span className="text-sm font-medium text-amber-400" data-testid={`text-elite-${player.id}`}>
                                  {player.elitePct}%
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-sm font-medium text-red-400" data-testid={`text-bust-${player.id}`}>
                                  {player.bustPct}%
                                </span>
                              </td>
                              <td className="p-3" data-testid={`text-risk-${player.id}`}>
                                <RiskTierBadge tier={player.riskTier} />
                              </td>
                              <td className="p-3 text-muted-foreground text-sm" data-testid={`text-college-${player.id}`}>
                                {player.college}
                              </td>
                              <td className="p-3" data-testid={`text-stock-${player.id}`}>
                                <StockIndicator status={player.stockStatus} change={player.stockChange} />
                              </td>
                            </tr>
                            {cliff && <TierCliffMarker key={`cliff-${cliff.afterRank}`} cliff={cliff} />}
                          </>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden p-3 space-y-2" data-testid="mobile-draft-list">
                {sortedPlayers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground" data-testid="text-no-players-mobile">
                    No prospects match the selected filters
                  </div>
                ) : (
                  sortedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="p-3 rounded-md bg-muted/30 hover-elevate cursor-pointer"
                      onClick={() => handlePlayerClick(player)}
                      data-testid={`card-player-${player.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg font-bold shrink-0 w-8">#{player.rank}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold truncate" data-testid={`text-mobile-name-${player.id}`}>
                                {player.name}
                              </span>
                              <StockBadge status={player.stockStatus} change={player.stockChange} />
                              {player.intangibles && player.intangibles.length > 0 && (
                                <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                              <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                                {player.position}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{player.college}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-amber-400" />
                                <span className="text-xs font-semibold">EV: </span>
                                <EVScoreBadge score={player.evScore} />
                              </div>
                              <span className="text-xs text-amber-400">Elite {player.elitePct}%</span>
                              <span className="text-xs text-red-400">Bust {player.bustPct}%</span>
                              <RiskTierBadge tier={player.riskTier} />
                            </div>
                            <Link href={`/league/draft-pick-values?position=${player.positionGroup}`} onClick={(e: any) => e.stopPropagation()}>
                              <span className="text-xs text-primary/80 hover:text-primary underline underline-offset-2 cursor-pointer mt-0.5 inline-block">
                                {player.projectedPickRange}
                              </span>
                            </Link>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StockIndicator status={player.stockStatus} change={player.stockChange} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="stock-watch-grid">
            <div className="space-y-3" data-testid="section-rising">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold" data-testid="text-rising-title">Rising</h2>
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 no-default-hover-elevate no-default-active-elevate">
                  {risingPlayers.length}
                </Badge>
              </div>
              {risingPlayers.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground text-sm" data-testid="text-no-rising">
                    No rising prospects
                  </CardContent>
                </Card>
              ) : (
                risingPlayers.map((player) => (
                  <Card
                    key={player.id}
                    className="hover-elevate cursor-pointer border-emerald-400/20"
                    onClick={() => handlePlayerClick(player)}
                    data-testid={`card-rising-${player.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-muted-foreground">#{player.rank}</span>
                            <span className="font-semibold" data-testid={`text-rising-name-${player.id}`}>{player.name}</span>
                            <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`} data-testid={`badge-rising-position-${player.id}`}>
                              {player.position}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1" data-testid={`text-rising-college-${player.id}`}>
                            {player.college}
                          </div>
                          {player.scoutingNotes && (
                            <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2" data-testid={`text-rising-notes-${player.id}`}>
                              {player.scoutingNotes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-emerald-400 font-bold shrink-0" data-testid={`text-rising-change-${player.id}`}>
                          <TrendingUp className="h-4 w-4" />
                          <span>+{player.stockChange}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <div className="space-y-3" data-testid="section-falling">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-400" />
                <h2 className="text-lg font-semibold" data-testid="text-falling-title">Falling</h2>
                <Badge variant="outline" className="text-red-400 border-red-400/30 no-default-hover-elevate no-default-active-elevate">
                  {fallingPlayers.length}
                </Badge>
              </div>
              {fallingPlayers.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground text-sm" data-testid="text-no-falling">
                    No falling prospects
                  </CardContent>
                </Card>
              ) : (
                fallingPlayers.map((player) => (
                  <Card
                    key={player.id}
                    className="hover-elevate cursor-pointer border-red-400/20"
                    onClick={() => handlePlayerClick(player)}
                    data-testid={`card-falling-${player.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-muted-foreground">#{player.rank}</span>
                            <span className="font-semibold" data-testid={`text-falling-name-${player.id}`}>{player.name}</span>
                            <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`} data-testid={`badge-falling-position-${player.id}`}>
                              {player.position}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1" data-testid={`text-falling-college-${player.id}`}>
                            {player.college}
                          </div>
                          {player.scoutingNotes && (
                            <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2" data-testid={`text-falling-notes-${player.id}`}>
                              {player.scoutingNotes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-red-400 font-bold shrink-0" data-testid={`text-falling-change-${player.id}`}>
                          <TrendingDown className="h-4 w-4" />
                          <span>{player.stockChange}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DraftProfileModal
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

function DraftBoardSkeleton() {
  return (
    <div className="space-y-6" data-testid="draft-board-skeleton">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72 mt-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[120px]" />
          <Skeleton className="h-9 w-[130px]" />
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
    </div>
  );
}
