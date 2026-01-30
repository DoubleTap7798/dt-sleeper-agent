import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { abbreviateName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  Target,
  Home,
  Plane,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield
} from "lucide-react";
import { getNFLTeamLogo } from "@/lib/team-logos";

interface MatchupProjection {
  playerId: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  isHome: boolean;
  gameScript: string;
  projectedPoints: number;
  floor: number;
  ceiling: number;
  confidence: number;
  keyMatchup: string;
  startSitAdvice: string;
}

interface ProjectionsResponse {
  projections: MatchupProjection[];
  week: number;
  season: string;
  scoringType: string;
  opponent: string;
  lastUpdated: string;
}

const POSITION_TABS = ["ALL", "QB", "RB", "WR", "TE"];

export default function ProjectionsPage() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("projected");

  const { data, isLoading, error } = useQuery<ProjectionsResponse>({
    queryKey: [`/api/fantasy/matchup-projections?leagueId=${leagueId}`],
    enabled: !!leagueId,
  });

  const getAdviceColor = (advice: string) => {
    if (advice.toLowerCase().includes("start")) return "bg-muted text-foreground";
    if (advice.toLowerCase().includes("sit")) return "bg-muted/50 text-muted-foreground";
    return "bg-muted text-muted-foreground";
  };

  const filteredProjections = (data?.projections || [])
    .filter((p) => positionFilter === "ALL" || p.position === positionFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case "projected":
          return b.projectedPoints - a.projectedPoints;
        case "ceiling":
          return b.ceiling - a.ceiling;
        case "floor":
          return b.floor - a.floor;
        case "confidence":
          return b.confidence - a.confidence;
        default:
          return 0;
      }
    });

  if (!leagueId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h1 className="text-xl font-bold" data-testid="text-page-title">Projections</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-select-league">
              Select a specific league to view matchup-based projections
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-2">
          {POSITION_TABS.map((tab) => (
            <Skeleton key={tab} className="h-9 w-16" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h1 className="text-xl font-bold">Projections</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Failed to load projections. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h1 className="text-xl font-bold" data-testid="text-page-title">
            Week {data?.week} Projections
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="glass" data-testid="badge-scoring-type">
            {data?.scoringType}
          </Badge>
          <span>vs {data?.opponent}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {POSITION_TABS.map((tab) => (
          <Button
            key={tab}
            variant={positionFilter === tab ? "default" : "ghost"}
            size="sm"
            onClick={() => setPositionFilter(tab)}
            className={`shrink-0 glass ${positionFilter === tab ? "glass-active" : ""}`}
            data-testid={`tab-position-${tab.toLowerCase()}`}
          >
            {tab}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Sort:</span>
        {["projected", "ceiling", "floor", "confidence"].map((sort) => (
          <Button
            key={sort}
            variant={sortBy === sort ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSortBy(sort)}
            className={`h-7 px-2 text-xs glass ${sortBy === sort ? "glass-active" : ""}`}
            data-testid={`sort-${sort}`}
          >
            {sort.charAt(0).toUpperCase() + sort.slice(1)}
          </Button>
        ))}
      </div>

      {filteredProjections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No projections available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredProjections.map((player) => {
            const isExpanded = expandedPlayer === player.playerId;
            const range = player.ceiling - player.floor;
            const projectedInRange = ((player.projectedPoints - player.floor) / range) * 100;
            
            return (
              <Card 
                key={player.playerId}
                className="hover-elevate transition-all cursor-pointer"
                onClick={() => setExpandedPlayer(isExpanded ? null : player.playerId)}
                data-testid={`projection-card-${player.playerId}`}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage 
                        src={getNFLTeamLogo(player.team) || undefined} 
                        alt={player.team}
                      />
                      <AvatarFallback className="text-xs bg-muted">
                        {player.team}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-muted text-xs">
                          {player.position}
                        </Badge>
                        <span className="font-semibold text-sm truncate" data-testid={`text-name-${player.playerId}`}>
                          <span className="sm:hidden">{abbreviateName(player.name)}</span>
                          <span className="hidden sm:inline">{player.name}</span>
                        </span>
                        <Badge className={`text-xs ${getAdviceColor(player.startSitAdvice)}`} data-testid={`badge-advice-${player.playerId}`}>
                          {player.startSitAdvice.split(" ")[0]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {player.isHome ? (
                          <span className="flex items-center gap-0.5">
                            <Home className="h-3 w-3" />
                            vs
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <Plane className="h-3 w-3" />
                            @
                          </span>
                        )}
                        <span data-testid={`text-opponent-${player.playerId}`}>{player.opponent.replace(/^(vs |@ )/, "")}</span>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold" data-testid={`text-projected-${player.playerId}`}>
                        {player.projectedPoints.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {player.floor.toFixed(1)} - {player.ceiling.toFixed(1)}
                      </div>
                    </div>
                    
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-border space-y-3" data-testid={`expanded-${player.playerId}`}>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Floor</span>
                          <span className="text-muted-foreground">Ceiling</span>
                        </div>
                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="absolute h-full bg-foreground/30 rounded-full"
                            style={{ width: "100%" }}
                          />
                          <div 
                            className="absolute h-3 w-3 bg-foreground rounded-full -top-0.5 transform -translate-x-1/2"
                            style={{ left: `${projectedInRange}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="font-medium">{player.floor.toFixed(1)}</span>
                          <span className="font-bold text-sm">{player.projectedPoints.toFixed(1)}</span>
                          <span className="font-medium">{player.ceiling.toFixed(1)}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Game Script
                          </span>
                          <p className="text-xs mt-0.5" data-testid={`text-gamescript-${player.playerId}`}>
                            {player.gameScript}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Key Matchup
                          </span>
                          <p className="text-xs mt-0.5" data-testid={`text-matchup-${player.playerId}`}>
                            {player.keyMatchup}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Confidence</span>
                          <Progress value={player.confidence} className="w-20 h-1.5" />
                          <span className="text-xs font-medium">{player.confidence}%</span>
                        </div>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-advice-full-${player.playerId}`}>
                          {player.startSitAdvice}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
