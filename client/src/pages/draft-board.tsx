import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { getPositionColorClass } from "@/lib/utils";
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
import { GraduationCap, Filter, Search, Shield, Sword, ArrowUpDown, ChevronRight } from "lucide-react";
import { DraftProfileModal } from "@/components/draft-profile-modal";

interface Draft2026Player {
  id: string;
  rank: number;
  name: string;
  college: string;
  position: string;
  height: string;
  weight: number;
  side: 'offense' | 'defense';
  positionGroup: string;
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
  draftYear: number;
}

type SortField = "rank" | "name" | "position" | "college" | "height" | "weight";
type SortDirection = "asc" | "desc";

export default function DraftBoardPage() {
  const [sideFilter, setSideFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedPlayer, setSelectedPlayer] = useState<Draft2026Player | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery<DraftData>({
    queryKey: ['/api/draft/2026'],
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

  const { players, stats, positionGroups } = data;

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

  return (
    <div className="space-y-6" data-testid="draft-board-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-draft-title">
              2026 NFL Draft Board
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-draft-subtitle">
              Complete prospect rankings for the 2026 draft class
            </p>
          </div>
        </div>

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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card data-testid="stat-total">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" data-testid="text-total-count">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Prospects</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-offense">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Sword className="h-4 w-4 text-cyan-400" />
              <span className="text-2xl font-bold" data-testid="text-offense-count">{stats.offense}</span>
            </div>
            <div className="text-sm text-muted-foreground">Offense</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-defense">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span className="text-2xl font-bold" data-testid="text-defense-count">{stats.defense}</span>
            </div>
            <div className="text-sm text-muted-foreground">Defense</div>
          </CardContent>
        </Card>
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
                  <th className="p-3">
                    <SortButton field="college" label="College" />
                  </th>
                  <th className="p-3 w-24">
                    <SortButton field="height" label="Height" />
                  </th>
                  <th className="p-3 w-24">
                    <SortButton field="weight" label="Weight" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
                      No prospects match the selected filters
                    </td>
                  </tr>
                ) : (
                  sortedPlayers.map((player, index) => (
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
                        <span className="font-medium" data-testid={`text-name-${player.id}`}>
                          {player.name}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid={`badge-position-${player.id}`}>
                          {player.position}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-sm" data-testid={`text-college-${player.id}`}>
                        {player.college}
                      </td>
                      <td className="p-3 text-sm" data-testid={`text-height-${player.id}`}>
                        {player.height}
                      </td>
                      <td className="p-3 text-sm" data-testid={`text-weight-${player.id}`}>
                        {player.weight} lbs
                      </td>
                    </tr>
                  ))
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
                  className="p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer"
                  onClick={() => handlePlayerClick(player)}
                  data-testid={`card-player-${player.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg font-bold shrink-0 w-8">#{player.rank}</span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate" data-testid={`text-mobile-name-${player.id}`}>
                          {player.name}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                            {player.position}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{player.college}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {player.height} / {player.weight} lbs
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <DraftProfileModal
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
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-10 w-[130px]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
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
