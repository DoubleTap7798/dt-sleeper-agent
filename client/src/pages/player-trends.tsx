import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { getPositionColorClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Minus, Search, BarChart3, Activity, UserPlus, UserMinus } from "lucide-react";
import { getNFLTeamLogo } from "@/lib/team-logos";

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

interface TrendingPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number;
  count: number;
  rank: number;
  number: number | null;
  headshot: string | null;
}

interface TrendingResponse {
  players: TrendingPlayer[];
  type: string;
  lastUpdated: string;
}

type TabType = "added" | "dropped" | "career";

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function PlayerTrendsPage() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [activeTab, setActiveTab] = useState<TabType>("added");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerTrend | null>(null);

  const { data: addedData, isLoading: addedLoading } = useQuery<TrendingResponse>({
    queryKey: ["/api/sleeper/trending?type=add&limit=50"],
    enabled: activeTab === "added",
  });

  const { data: droppedData, isLoading: droppedLoading } = useQuery<TrendingResponse>({
    queryKey: ["/api/sleeper/trending?type=drop&limit=50"],
    enabled: activeTab === "dropped",
  });

  const { data: careerData, isLoading: careerLoading } = useQuery<TrendsResponse>({
    queryKey: [`/api/fantasy/trends${leagueId ? `?leagueId=${leagueId}` : ""}`],
    enabled: activeTab === "career",
  });

  const isLoading = 
    (activeTab === "added" && addedLoading) ||
    (activeTab === "dropped" && droppedLoading) ||
    (activeTab === "career" && careerLoading);

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

  const filteredCareerPlayers = (careerData?.players || []).filter((player) => {
    const matchesSearch = searchTerm === "" || 
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredTrendingPlayers = (activeTab === "added" ? addedData?.players : droppedData?.players || [])?.filter((player) => {
    const matchesSearch = searchTerm === "" || 
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5" />
        <h1 className="text-xl font-bold" data-testid="text-page-title">Player Trends</h1>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          variant={activeTab === "added" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("added")}
          className={`shrink-0 glass ${activeTab === "added" ? "glass-active" : ""}`}
          data-testid="tab-most-added"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Most Added
        </Button>
        <Button
          variant={activeTab === "dropped" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("dropped")}
          className={`shrink-0 glass ${activeTab === "dropped" ? "glass-active" : ""}`}
          data-testid="tab-most-dropped"
        >
          <UserMinus className="h-4 w-4 mr-1" />
          Most Dropped
        </Button>
        <Button
          variant={activeTab === "career" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("career")}
          className={`shrink-0 glass ${activeTab === "career" ? "glass-active" : ""}`}
          data-testid="tab-career-trends"
        >
          <BarChart3 className="h-4 w-4 mr-1" />
          Career Trends
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-players"
        />
      </div>

      {activeTab !== "career" && (
        <p className="text-xs text-muted-foreground">
          {activeTab === "added" ? "Most added players across Sleeper leagues (last 24 hours)" : "Most dropped players across Sleeper leagues (last 24 hours)"}
        </p>
      )}

      {activeTab === "career" ? (
        filteredCareerPlayers.length === 0 ? (
          <Card data-testid="empty-state">
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-empty-message">
                {searchTerm ? "No players matching your search" : "No trend data available"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCareerPlayers.map((player) => (
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
                      <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid={`badge-position-${player.playerId}`}>
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
        )
      ) : (
        filteredTrendingPlayers.length === 0 ? (
          <Card data-testid="empty-state">
            <CardContent className="py-12 text-center">
              {activeTab === "added" ? (
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              ) : (
                <UserMinus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              )}
              <p className="text-muted-foreground" data-testid="text-empty-message">
                {searchTerm ? "No players matching your search" : "No trending data available"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTrendingPlayers.map((player, index) => (
              <Card 
                key={player.id}
                className="hover-elevate"
                data-testid={`trending-card-${player.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                      {player.rank}
                    </div>
                    
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getNFLTeamLogo(player.team) || undefined} alt={player.team} />
                      <AvatarFallback className="text-xs">{player.team}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate" data-testid={`text-player-name-${player.id}`}>
                          {player.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={getPositionColorClass(player.position)}>
                          {player.position}
                        </Badge>
                        <span>{player.team}</span>
                        {player.age && <span>Age {player.age}</span>}
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1">
                        {activeTab === "added" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span className="font-bold text-lg" data-testid={`count-${player.id}`}>
                          {player.count.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {activeTab === "added" ? "adds" : "drops"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
