import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutList,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  Flame,
  Thermometer,
} from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";
import { getNFLTeamLogo } from "@/lib/team-logos";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  archetypeCluster: string;
  longevityScore: number;
  dnpv: number;
  marketHeatLevel?: string;
}

interface MarketMetricsMap {
  [playerId: string]: { marketHeatLevel: string };
}

const HEAT_DISPLAY: Record<string, { icon: any; label: string; color: string }> = {
  HOT: { icon: Flame, label: "Hot", color: "text-red-500 dark:text-red-400" },
  HEATING: { icon: TrendingUp, label: "Heating", color: "text-amber-500 dark:text-amber-400" },
  NEUTRAL: { icon: Thermometer, label: "Neutral", color: "text-muted-foreground" },
  COLD: { icon: TrendingDown, label: "Cold", color: "text-blue-500 dark:text-blue-400" },
};

function getHeatDisplay(level?: string) {
  const cfg = HEAT_DISPLAY[level || "NEUTRAL"] || HEAT_DISPLAY.NEUTRAL;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-1 ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{cfg.label}</span>
    </div>
  );
}

interface DynastyPlayersResponse {
  players: DynastyPlayer[];
  total: number;
  limit: number;
  offset: number;
}

type SortKey = "dynastyValue" | "threeYearAvgPPG" | "projectedPPG" | "riskScore" | "ufasScore" | "age" | "name" | "positionalRank";
type SortOrder = "asc" | "desc";
type ViewDensity = "compact" | "expanded";

const POSITION_TABS = ["ALL", "QB", "RB", "WR", "TE"] as const;
const PAGE_SIZE = 50;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "dynastyValue", label: "Dynasty Value" },
  { value: "threeYearAvgPPG", label: "3Y Avg PPG" },
  { value: "projectedPPG", label: "Proj PPG" },
  { value: "riskScore", label: "Risk Score" },
  { value: "ufasScore", label: "UFAS Score" },
  { value: "age", label: "Age" },
  { value: "name", label: "Name" },
  { value: "positionalRank", label: "Pos Rank" },
];

function getTrajectoryIcon(trajectory: string) {
  switch (trajectory) {
    case "ascending":
      return <TrendingUp className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />;
    case "declining":
      return <TrendingDown className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />;
    default:
      return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getRiskColor(risk: number) {
  if (risk <= 25) return "text-green-600 dark:text-green-400";
  if (risk <= 50) return "text-yellow-600 dark:text-yellow-400";
  if (risk <= 75) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getTierBadgeVariant(tier: string): "default" | "secondary" | "outline" | "destructive" {
  switch (tier) {
    case "Elite":
    case "Star":
      return "default";
    case "Starter":
    case "Flex":
      return "secondary";
    default:
      return "outline";
  }
}

export default function PlayersPage() {
  usePageTitle("NFL Players");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("dynastyValue");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewDensity, setViewDensity] = useState<ViewDensity>("compact");
  const [page, setPage] = useState(0);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [profilePlayerName, setProfilePlayerName] = useState<string>("");
  const [profilePosition, setProfilePosition] = useState<string>("");
  const [profileTeam, setProfileTeam] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (positionFilter !== "ALL") params.set("position", positionFilter);
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    return params.toString();
  }, [positionFilter, sortKey, sortOrder, debouncedSearch, page]);

  const { data, isLoading, error } = useQuery<DynastyPlayersResponse>({
    queryKey: [`/api/engine/v3/players-dynasty?${queryParams}`],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: marketData } = useQuery<{ metrics: Array<{ playerId: string; marketHeatLevel: string }> }>({
    queryKey: ["/api/market-psychology"],
    queryFn: async () => {
      const res = await fetch("/api/market-psychology?limit=500");
      if (!res.ok) return { metrics: [] };
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const marketHeatMap = useMemo(() => {
    const map: MarketMetricsMap = {};
    if (marketData?.metrics) {
      for (const m of marketData.metrics) {
        map[m.playerId] = { marketHeatLevel: m.marketHeatLevel };
      }
    }
    return map;
  }, [marketData]);

  const playersWithHeat = useMemo(() => {
    if (!data?.players) return [];
    return data.players.map(p => ({
      ...p,
      marketHeatLevel: marketHeatMap[p.playerId]?.marketHeatLevel || p.marketHeatLevel || "NEUTRAL",
    }));
  }, [data, marketHeatMap]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortOrder(key === "name" ? "asc" : "desc");
    }
    setPage(0);
  }, [sortKey]);

  const handlePositionChange = useCallback((pos: string) => {
    setPositionFilter(pos);
    setPage(0);
  }, []);

  const openProfile = useCallback((player: DynastyPlayer) => {
    setProfilePlayerId(player.playerId);
    setProfilePlayerName(player.name);
    setProfilePosition(player.position);
    setProfileTeam(player.team);
  }, []);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const exportData = useMemo(() => {
    if (!data?.players) return [];
    return data.players.map(p => ({
      Name: p.name,
      Position: p.position,
      Team: p.team,
      Age: p.age,
      "Dynasty Value": p.dynastyValue,
      "3Y Avg PPG": p.threeYearAvgPPG,
      "Projected PPG": p.projectedPPG,
      "Risk Score": p.riskScore,
      "UFAS Score": p.ufasScore,
      Tier: p.ufasTier,
    }));
  }, [data]);

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortOrder === "desc"
      ? <ArrowDown className="h-3 w-3" />
      : <ArrowUp className="h-3 w-3" />;
  };

  return (
    <div className="space-y-4" data-testid="page-players">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            NFL Players
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dynasty Rankings & Projections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename="dynasty-players"
            shareText={`Dynasty Player Rankings\n${data?.players.slice(0, 10).map((p, i) => `${i + 1}. ${p.name} (${p.position}) - ${p.dynastyValue}`).join("\n") || ""}`}
          />
          <Button
            size="icon"
            variant={viewDensity === "compact" ? "default" : "ghost"}
            onClick={() => setViewDensity("compact")}
            data-testid="button-view-compact"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={viewDensity === "expanded" ? "default" : "ghost"}
            onClick={() => setViewDensity("expanded")}
            data-testid="button-view-expanded"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players by name or team..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
          data-testid="input-search-players"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {POSITION_TABS.map((tab) => (
          <Button
            key={tab}
            variant={positionFilter === tab ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePositionChange(tab)}
            className={`shrink-0 ${positionFilter === tab ? "" : ""}`}
            data-testid={`tab-position-${tab.toLowerCase()}`}
          >
            {tab}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={sortKey} onValueChange={(v) => { setSortKey(v as SortKey); setPage(0); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} data-testid={`sort-option-${opt.value}`}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
          data-testid="button-toggle-sort-order"
        >
          {sortOrder === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          {sortOrder === "desc" ? "High to Low" : "Low to High"}
        </Button>
        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            {data.total} players
          </span>
        )}
      </div>

      {isLoading ? (
        <PlayersSkeleton density={viewDensity} />
      ) : error || !data ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground" data-testid="text-error">Failed to load players</p>
        </div>
      ) : (
        <>
          {viewDensity === "compact" ? (
            <CompactTable
              players={playersWithHeat}
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={handleSort}
              onPlayerClick={openProfile}
              pageOffset={page * PAGE_SIZE}
            />
          ) : (
            <ExpandedCards
              players={playersWithHeat}
              onPlayerClick={openProfile}
              pageOffset={page * PAGE_SIZE}
            />
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {profilePlayerId && (
        <PlayerProfileModal
          open={!!profilePlayerId}
          onOpenChange={(open) => { if (!open) setProfilePlayerId(null); }}
          playerId={profilePlayerId}
          playerName={profilePlayerName}
          position={profilePosition}
          team={profileTeam}
        />
      )}
    </div>
  );
}

function CompactTable({
  players,
  sortKey,
  sortOrder,
  onSort,
  onPlayerClick,
  pageOffset,
}: {
  players: DynastyPlayer[];
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSort: (key: SortKey) => void;
  onPlayerClick: (player: DynastyPlayer) => void;
  pageOffset: number;
}) {
  const SortHeader = ({ field, label, className = "" }: { field: SortKey; label: string; className?: string }) => (
    <button
      className={`flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none ${className}`}
      onClick={() => onSort(field)}
      data-testid={`sort-header-${field}`}
    >
      {label}
      {sortKey === field ? (
        sortOrder === "desc" ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />
      ) : (
        <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
      )}
    </button>
  );

  return (
    <div className="overflow-x-auto" data-testid="table-dynasty-players">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-2 w-8">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">#</span>
            </th>
            <th className="text-left py-2 pr-2 min-w-[140px]">
              <SortHeader field="name" label="Player" />
            </th>
            <th className="text-right py-2 px-2">
              <SortHeader field="dynastyValue" label="Dynasty Val" className="justify-end" />
            </th>
            <th className="text-right py-2 px-2 hidden sm:table-cell">
              <SortHeader field="threeYearAvgPPG" label="3Y PPG" className="justify-end" />
            </th>
            <th className="text-right py-2 px-2 hidden sm:table-cell">
              <SortHeader field="projectedPPG" label="Proj PPG" className="justify-end" />
            </th>
            <th className="text-right py-2 px-2 hidden md:table-cell">
              <SortHeader field="riskScore" label="Risk" className="justify-end" />
            </th>
            <th className="text-right py-2 px-2 hidden md:table-cell">
              <SortHeader field="ufasScore" label="UFAS" className="justify-end" />
            </th>
            <th className="text-center py-2 px-2 hidden lg:table-cell">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Trend</span>
            </th>
            <th className="text-center py-2 px-2 hidden lg:table-cell">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Heat</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, idx) => (
            <tr
              key={player.playerId}
              className="border-b border-border/50 cursor-pointer hover-elevate"
              onClick={() => onPlayerClick(player)}
              data-testid={`row-player-${player.playerId}`}
            >
              <td className="py-2 pr-2 text-muted-foreground text-xs font-mono">
                {pageOffset + idx + 1}
              </td>
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={getNFLTeamLogo(player.team) || undefined} alt={player.team} />
                    <AvatarFallback className="text-[10px] bg-muted">{player.team}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" data-testid={`text-player-name-${player.playerId}`}>
                      {player.name}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="font-medium">{player.position}{player.positionalRank}</span>
                      <span>{player.team}</span>
                      <span>Age {player.age}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-2 px-2 text-right">
                <span className="font-mono font-semibold text-sm" data-testid={`text-dynasty-value-${player.playerId}`}>
                  {player.dynastyValue.toLocaleString()}
                </span>
              </td>
              <td className="py-2 px-2 text-right hidden sm:table-cell">
                <span className="font-mono text-sm" data-testid={`text-3y-ppg-${player.playerId}`}>
                  {player.threeYearAvgPPG.toFixed(1)}
                </span>
              </td>
              <td className="py-2 px-2 text-right hidden sm:table-cell">
                <span className="font-mono text-sm" data-testid={`text-proj-ppg-${player.playerId}`}>
                  {player.projectedPPG.toFixed(1)}
                </span>
              </td>
              <td className="py-2 px-2 text-right hidden md:table-cell">
                <span className={`font-mono text-sm ${getRiskColor(player.riskScore)}`} data-testid={`text-risk-${player.playerId}`}>
                  {player.riskScore}%
                </span>
              </td>
              <td className="py-2 px-2 text-right hidden md:table-cell">
                <div className="flex items-center justify-end gap-1">
                  <span className="font-mono text-sm" data-testid={`text-ufas-${player.playerId}`}>
                    {player.ufasScore}
                  </span>
                  <Badge variant={getTierBadgeVariant(player.ufasTier)} className="text-[9px] px-1 py-0 leading-tight">
                    {player.ufasTier}
                  </Badge>
                </div>
              </td>
              <td className="py-2 px-2 text-center hidden lg:table-cell">
                {getTrajectoryIcon(player.trajectory)}
              </td>
              <td className="py-2 px-2 text-center hidden lg:table-cell" data-testid={`heat-${player.playerId}`}>
                {getHeatDisplay(player.marketHeatLevel)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {players.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-results">
          No players found
        </div>
      )}
    </div>
  );
}

function ExpandedCards({
  players,
  onPlayerClick,
  pageOffset,
}: {
  players: DynastyPlayer[];
  onPlayerClick: (player: DynastyPlayer) => void;
  pageOffset: number;
}) {
  return (
    <div className="space-y-2" data-testid="grid-dynasty-players">
      {players.map((player, idx) => (
        <Card
          key={player.playerId}
          className="p-3 cursor-pointer hover-elevate"
          onClick={() => onPlayerClick(player)}
          data-testid={`card-player-${player.playerId}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-bold text-muted-foreground w-6 text-center font-mono">
                {pageOffset + idx + 1}
              </span>
              <Avatar className="h-10 w-10">
                <AvatarImage src={getNFLTeamLogo(player.team) || undefined} alt={player.team} />
                <AvatarFallback className="text-xs bg-muted">{player.team}</AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm" data-testid={`text-expanded-name-${player.playerId}`}>
                  {player.name}
                </span>
                <Badge variant={getTierBadgeVariant(player.ufasTier)} className="text-[10px]">
                  {player.ufasTier}
                </Badge>
                <span className="inline-flex items-center gap-0.5">{getTrajectoryIcon(player.trajectory)}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-medium">{player.position}{player.positionalRank}</span>
                <span>{player.team}</span>
                <span>Age {player.age}</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-muted-foreground">Dynasty Value</div>
              <div className="text-lg font-bold font-mono" data-testid={`text-expanded-value-${player.playerId}`}>
                {player.dynastyValue.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 sm:gap-5 overflow-x-auto text-xs">
            <div className="shrink-0 text-center min-w-[50px]">
              <div className="text-[10px] text-muted-foreground">3Y PPG</div>
              <div className="font-mono font-medium">{player.threeYearAvgPPG.toFixed(1)}</div>
            </div>
            <div className="shrink-0 text-center min-w-[50px]">
              <div className="text-[10px] text-muted-foreground">Proj PPG</div>
              <div className="font-mono font-medium">{player.projectedPPG.toFixed(1)}</div>
            </div>
            <div className="shrink-0 text-center min-w-[50px]">
              <div className="text-[10px] text-muted-foreground">UFAS</div>
              <div className="font-mono font-medium">{player.ufasScore}</div>
            </div>
            <div className="shrink-0 text-center min-w-[50px]">
              <div className="text-[10px] text-muted-foreground">Risk</div>
              <div className={`font-mono font-medium ${getRiskColor(player.riskScore)}`}>{player.riskScore}%</div>
            </div>
            <div className="shrink-0 text-center min-w-[50px]">
              <div className="text-[10px] text-muted-foreground">DNPV</div>
              <div className="font-mono font-medium">{player.dnpv.toFixed(0)}</div>
            </div>
            <div className="shrink-0 text-center min-w-[50px]">
              <div className="text-[10px] text-muted-foreground">Longevity</div>
              <div className="font-mono font-medium">{player.longevityScore}</div>
            </div>
            <div className="shrink-0 text-center min-w-[50px]" data-testid={`heat-expanded-${player.playerId}`}>
              <div className="text-[10px] text-muted-foreground">Heat</div>
              <div className="mt-0.5">{getHeatDisplay(player.marketHeatLevel)}</div>
            </div>
          </div>
        </Card>
      ))}
      {players.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-results">
          No players found
        </div>
      )}
    </div>
  );
}

function PlayersSkeleton({ density = "compact" }: { density?: ViewDensity }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-12" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className={density === "compact" ? "h-12 w-full" : "h-24 w-full"} />
        ))}
      </div>
    </div>
  );
}
