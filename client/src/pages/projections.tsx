import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Calendar,
  Activity,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface RosProjection {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  projectedPoints: number;
  projectedPpg: number;
  confidence: number;
  upside: number;
  downside: number;
  trend: "up" | "down" | "stable";
  outlook: string;
  keyFactors: string[];
  scheduleStrength: number;
  injuryRisk: "low" | "medium" | "high";
  byeWeek: number;
}

interface ProjectionsResponse {
  players: RosProjection[];
  lastUpdated: string;
}

export default function ProjectionsPage() {
  const league = useSelectedLeague();
  const leagueId = league?.league_id;
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("projected");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ProjectionsResponse>({
    queryKey: [`/api/fantasy/projections${leagueId ? `?leagueId=${leagueId}` : ""}`],
  });

  const getPositionColor = () => {
    return "bg-muted text-muted-foreground border-border";
  };

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

  const getInjuryRiskLabel = (risk: string) => {
    switch (risk) {
      case "low":
        return "Low Risk";
      case "medium":
        return "Medium Risk";
      case "high":
        return "High Risk";
      default:
        return risk;
    }
  };

  const getScheduleLabel = (strength: number) => {
    if (strength <= 3) return "Easy";
    if (strength <= 6) return "Medium";
    return "Hard";
  };

  const filteredPlayers = (data?.players || [])
    .filter((player) => {
      const matchesSearch = searchTerm === "" || 
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPosition = positionFilter === "all" || player.position === positionFilter;
      return matchesSearch && matchesPosition;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "projected":
          return b.projectedPoints - a.projectedPoints;
        case "ppg":
          return b.projectedPpg - a.projectedPpg;
        case "upside":
          return b.upside - a.upside;
        case "confidence":
          return b.confidence - a.confidence;
        default:
          return 0;
      }
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">ROS Projections</h1>
        </div>
        {data?.lastUpdated && (
          <span className="text-sm text-muted-foreground" data-testid="text-last-updated">
            Updated {new Date(data.lastUpdated).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
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
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="projected">Projected Pts</SelectItem>
            <SelectItem value="ppg">PPG</SelectItem>
            <SelectItem value="upside">Upside</SelectItem>
            <SelectItem value="confidence">Confidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Card data-testid="error-state">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-error-message">Failed to load projections. Please try again.</p>
          </CardContent>
        </Card>
      ) : filteredPlayers.length === 0 ? (
        <Card data-testid="empty-state">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-empty-message">
              {searchTerm || positionFilter !== "all" 
                ? "No players matching your filters" 
                : "No projection data available"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPlayers.map((player, index) => (
            <Card 
              key={player.playerId}
              className="hover-elevate transition-all cursor-pointer"
              onClick={() => setExpandedPlayer(expandedPlayer === player.playerId ? null : player.playerId)}
              data-testid={`projection-card-${player.playerId}`}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-8">#{index + 1}</span>
                      <Badge variant="outline" className={getPositionColor()}>
                        {player.position}
                      </Badge>
                      <div>
                        <span className="font-semibold" data-testid={`text-player-name-${player.playerId}`}>{player.name}</span>
                        <span className="text-sm text-muted-foreground ml-2" data-testid={`text-player-team-${player.playerId}`}>{player.team}</span>
                      </div>
                      <span data-testid={`icon-trend-${player.playerId}`}>{getTrendIcon(player.trend)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-lg font-bold" data-testid={`text-projected-${player.playerId}`}>{player.projectedPoints.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground ml-1">pts</span>
                      </div>
                      {expandedPlayer === player.playerId ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" data-testid={`icon-collapse-${player.playerId}`} />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" data-testid={`icon-expand-${player.playerId}`} />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">PPG</span>
                      <span className="font-medium" data-testid={`stat-ppg-${player.playerId}`}>{player.projectedPpg.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Upside</span>
                      <span className="font-medium" data-testid={`stat-upside-${player.playerId}`}>{player.upside.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Floor</span>
                      <span className="font-medium" data-testid={`stat-floor-${player.playerId}`}>{player.downside.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Schedule</span>
                      <span className="font-medium" data-testid={`stat-schedule-${player.playerId}`}>
                        {getScheduleLabel(player.scheduleStrength)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Confidence</span>
                      <div className="flex items-center gap-2">
                        <Progress value={player.confidence} className="h-2 w-16" data-testid={`progress-confidence-${player.playerId}`} />
                        <span className="font-medium" data-testid={`stat-confidence-${player.playerId}`}>{player.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  {expandedPlayer === player.playerId && (
                    <div className="pt-3 border-t border-border space-y-3" data-testid={`expanded-details-${player.playerId}`}>
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground" data-testid={`text-outlook-${player.playerId}`}>{player.outlook}</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block">Age</span>
                          <span className="font-medium" data-testid={`stat-age-${player.playerId}`}>{player.age}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Bye Week</span>
                          <span className="font-medium" data-testid={`stat-bye-${player.playerId}`}>Week {player.byeWeek}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Injury Risk</span>
                          <span className="font-medium capitalize" data-testid={`stat-injury-${player.playerId}`}>
                            {getInjuryRiskLabel(player.injuryRisk)}
                          </span>
                        </div>
                      </div>

                      {player.keyFactors.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase">Key Factors</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {player.keyFactors.map((factor, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs" data-testid={`badge-factor-${player.playerId}-${idx}`}>
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
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
