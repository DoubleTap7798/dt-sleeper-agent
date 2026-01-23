import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, TrendingUp, Users } from "lucide-react";

interface WaiverPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  status: string;
  injuryStatus: string | null;
  seasonPoints: number;
  avgPoints: number;
  lastWeekPoints: number;
  projectedPoints: number;
  percentRostered: number;
}

interface WaiverData {
  players: WaiverPlayer[];
  week: number;
}

const positions = ["All", "QB", "RB", "WR", "TE", "K", "DEF"];

export default function WaiverWirePage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"avgPoints" | "seasonPoints" | "projectedPoints">("avgPoints");

  const { data, isLoading, error } = useQuery<WaiverData>({
    queryKey: ["/api/sleeper/waivers", leagueId],
    enabled: !!leagueId,
  });

  const filteredPlayers = data?.players
    ?.filter((player) => {
      const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.team?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPosition = positionFilter === "All" || player.position === positionFilter;
      return matchesSearch && matchesPosition;
    })
    .sort((a, b) => b[sortBy] - a[sortBy]) || [];

  if (isLoading) {
    return <WaiverSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load waiver wire</p>
      </div>
    );
  }

  const getPositionColor = (position: string) => {
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-waiver-title">
            Waiver Wire
          </h2>
          <p className="text-muted-foreground">
            Available players in your league
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-players"
              />
            </div>
            <div className="flex gap-2">
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-position-filter">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avgPoints">Avg Points</SelectItem>
                  <SelectItem value="seasonPoints">Season Total</SelectItem>
                  <SelectItem value="projectedPoints">Projected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">Pos</TableHead>
                  <TableHead className="text-center">Team</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">Season</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Last Wk</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Proj</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">% Rostered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No players found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlayers.slice(0, 50).map((player) => (
                    <TableRow key={player.playerId} data-testid={`row-player-${player.playerId}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{player.name}</span>
                          {player.injuryStatus && (
                            <Badge variant="destructive" className="w-fit text-xs mt-0.5">
                              {player.injuryStatus}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getPositionColor(player.position)}>
                          {player.position}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {player.team || "FA"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {player.avgPoints.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {player.seasonPoints.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell">
                        {player.lastWeekPoints.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell">
                        {player.projectedPoints.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{player.percentRostered}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredPlayers.length > 50 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Showing top 50 of {filteredPlayers.length} players
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WaiverSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[140px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
