import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Search, BarChart3, Activity } from "lucide-react";

interface SeasonStats {
  season: string;
  games: number;
  points: number;
  ppg: number;
  rank: number;
  positionRank: number;
}

interface PlayerTrend {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  seasons: SeasonStats[];
  trend: "up" | "down" | "stable";
  careerHigh: number;
  careerLow: number;
  avgPpg: number;
  trajectory: string;
}

interface TrendsResponse {
  players: PlayerTrend[];
}

export default function PlayerTrendsPage() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerTrend | null>(null);

  const { data, isLoading, error } = useQuery<TrendsResponse>({
    queryKey: [`/api/fantasy/trends${leagueId ? `?leagueId=${leagueId}` : ""}`],
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4" />;
      case "down":
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case "up":
        return "Rising";
      case "down":
        return "Declining";
      default:
        return "Stable";
    }
  };

  const getPositionColor = () => {
    return "bg-muted text-muted-foreground border-border";
  };

  const filteredPlayers = (data?.players || []).filter((player) => {
    const matchesSearch = searchTerm === "" || 
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === "all" || player.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Player Trends</h1>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-players"
          />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-32" data-testid="select-position">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="QB">QB</SelectItem>
            <SelectItem value="RB">RB</SelectItem>
            <SelectItem value="WR">WR</SelectItem>
            <SelectItem value="TE">TE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Card data-testid="error-state">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-error-message">Failed to load player trends. Please try again.</p>
          </CardContent>
        </Card>
      ) : filteredPlayers.length === 0 ? (
        <Card data-testid="empty-state">
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-empty-message">
              {searchTerm || positionFilter !== "all" 
                ? "No players matching your filters" 
                : "No trend data available"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPlayers.map((player) => (
            <Card 
              key={player.playerId}
              className={`hover-elevate transition-all cursor-pointer ${
                selectedPlayer?.playerId === player.playerId ? "ring-2 ring-border" : ""
              }`}
              onClick={() => setSelectedPlayer(selectedPlayer?.playerId === player.playerId ? null : player)}
              data-testid={`trend-card-${player.playerId}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getPositionColor()} data-testid={`badge-position-${player.playerId}`}>
                      {player.position}
                    </Badge>
                    <span className="text-xs text-muted-foreground" data-testid={`text-team-${player.playerId}`}>{player.team}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(player.trend)}
                    <span className="text-xs font-medium text-muted-foreground" data-testid={`text-trend-${player.playerId}`}>
                      {getTrendLabel(player.trend)}
                    </span>
                  </div>
                </div>
                <CardTitle className="text-lg" data-testid={`text-player-name-${player.playerId}`}>{player.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Age</span>
                    <span className="font-medium" data-testid={`stat-age-${player.playerId}`}>{player.age}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Avg PPG</span>
                    <span className="font-medium" data-testid={`stat-ppg-${player.playerId}`}>{player.avgPpg.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Career High</span>
                    <span className="font-medium" data-testid={`stat-high-${player.playerId}`}>{player.careerHigh.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Career Low</span>
                    <span className="font-medium" data-testid={`stat-low-${player.playerId}`}>{player.careerLow.toFixed(1)}</span>
                  </div>
                  
                  {selectedPlayer?.playerId === player.playerId && (
                    <div className="pt-3 border-t border-border space-y-3" data-testid={`expanded-details-${player.playerId}`}>
                      <p className="text-sm text-muted-foreground" data-testid={`text-trajectory-${player.playerId}`}>{player.trajectory}</p>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Season History</p>
                        {player.seasons.map((season, sIdx) => (
                          <div key={season.season} className="flex items-center justify-between text-xs" data-testid={`season-row-${player.playerId}-${sIdx}`}>
                            <span data-testid={`season-year-${player.playerId}-${sIdx}`}>{season.season}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground" data-testid={`season-games-${player.playerId}-${sIdx}`}>{season.games}G</span>
                              <span className="font-medium" data-testid={`season-ppg-${player.playerId}-${sIdx}`}>{season.ppg.toFixed(1)} PPG</span>
                              <Badge variant="secondary" className="text-xs" data-testid={`season-rank-${player.playerId}-${sIdx}`}>
                                #{season.positionRank}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
