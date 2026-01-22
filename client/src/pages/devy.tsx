import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { GraduationCap, Filter, ArrowUpDown } from "lucide-react";

interface DevyPlayer {
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  college: string;
  draftEligibleYear: number;
  height: string | null;
  weight: number | null;
  age: number | null;
  rank: number;
  searchRank: number;
}

interface DevyData {
  players: DevyPlayer[];
  positions: string[];
  years: number[];
  totalCount: number;
}

type SortField = "rank" | "name" | "position" | "year" | "college";
type SortDirection = "asc" | "desc";

export default function DevyPage() {
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data, isLoading, error } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
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
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg" data-testid="text-showing-count">
              Showing {sortedPlayers.length} of {players.length} players
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-devy">
              <thead className="border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-16">
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
                  <th className="p-3 w-28">
                    <SortButton field="year" label="Draft Year" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground" data-testid="text-no-players">
                      No players match the selected filters
                    </td>
                  </tr>
                ) : (
                  sortedPlayers.map((player, index) => (
                    <tr
                      key={player.playerId}
                      className={index % 2 === 0 ? "bg-muted/30" : ""}
                      data-testid={`row-player-${player.playerId}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-rank-${player.playerId}`}>
                        {player.rank}
                      </td>
                      <td className="p-3">
                        <span className="font-medium" data-testid={`text-name-${player.playerId}`}>
                          {player.name}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" data-testid={`badge-position-${player.playerId}`}>
                          {player.position}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
          <div className="p-3 border-b">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`p-3 flex gap-4 ${i % 2 === 0 ? "bg-muted/30" : ""}`}>
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
