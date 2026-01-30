import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
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
import { GraduationCap, Filter, ArrowUpDown, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { DevyProfileModal } from "@/components/devy-profile-modal";

interface DevyPlayer {
  playerId: string;
  name: string;
  position: string;
  positionRank: number;
  college: string;
  draftEligibleYear: number;
  tier: number;
  trend30Day: number;
  value: number;
  rank: number;
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

  const { data, isLoading, error } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
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
              <Badge variant="outline" data-testid="badge-source">
                Source: DT Dynasty
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full" data-testid="table-devy">
              <thead className="border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-14">
                    <SortButton field="rank" label="Rank" />
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
                  <th className="p-3 w-24">
                    <SortButton field="year" label="Draft" />
                  </th>
                  <th className="p-3 w-16">
                    <SortButton field="tier" label="Tier" />
                  </th>
                  <th className="p-3 w-20">
                    <SortButton field="value" label="Value" />
                  </th>
                  <th className="p-3 w-16 text-center">
                    <span className="font-medium">Trend</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
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
                        <span className="font-medium" data-testid={`text-name-${player.playerId}`}>
                          <span className="sm:hidden">{abbreviateName(player.name)}</span>
                          <span className="hidden sm:inline">{player.name}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid={`badge-position-${player.playerId}`}>
                          {player.position}{player.positionRank}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-college-${player.playerId}`}>
                        {player.college}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" data-testid={`badge-year-${player.playerId}`}>
                          {player.draftEligibleYear}
                        </Badge>
                      </td>
                      <td className="p-3 text-center" data-testid={`text-tier-${player.playerId}`}>
                        {player.tier}
                      </td>
                      <td className="p-3 font-medium" data-testid={`text-value-${player.playerId}`}>
                        {player.value.toFixed(1)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1" data-testid={`trend-${player.playerId}`}>
                          {player.trend30Day > 0 ? (
                            <>
                              <TrendingUp className="h-3 w-3" />
                              <span className="text-sm">+{player.trend30Day}</span>
                            </>
                          ) : player.trend30Day < 0 ? (
                            <>
                              <TrendingDown className="h-3 w-3" />
                              <span className="text-sm">{player.trend30Day}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
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
                        <div className="font-semibold truncate">
                          <span className="sm:hidden">{abbreviateName(player.name)}</span>
                          <span className="hidden sm:inline">{player.name}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {player.position}{player.positionRank}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{player.college}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-medium text-sm">{player.value.toFixed(1)}</div>
                        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                          {player.trend30Day > 0 ? (
                            <>
                              <TrendingUp className="h-3 w-3" />
                              +{player.trend30Day}
                            </>
                          ) : player.trend30Day < 0 ? (
                            <>
                              <TrendingDown className="h-3 w-3" />
                              {player.trend30Day}
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
