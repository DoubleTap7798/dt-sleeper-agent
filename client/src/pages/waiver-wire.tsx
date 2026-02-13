import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Search, TrendingUp, Users, Sparkles, Target, AlertCircle } from "lucide-react";
import { MetricTooltip, InfoTooltip } from "@/components/metric-tooltip";
import { usePageTitle } from "@/hooks/use-page-title";

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

interface WaiverRecommendation {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  injuryStatus: string | null;
  dynastyValue: number;
  fitScore: number;
  needLevel: "high" | "medium" | "low";
  reason: string;
}

interface PositionNeed {
  position: string;
  level: "high" | "medium" | "low";
  count: number;
}

interface RecommendationsData {
  recommendations: WaiverRecommendation[];
  needs: PositionNeed[];
  week: number;
}

const positions = ["All", "QB", "RB", "WR", "TE", "K", "DEF"];

export default function WaiverWirePage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  const presetPosition = urlParams.get("position");

  usePageTitle("Waiver Wire");
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState(presetPosition || "All");
  const [sortBy, setSortBy] = useState<"avgPoints" | "seasonPoints" | "projectedPoints">("avgPoints");
  const [showRecommendations, setShowRecommendations] = useState(true);

  const { data, isLoading, error } = useQuery<WaiverData>({
    queryKey: ["/api/sleeper/waivers", leagueId],
    enabled: !!leagueId,
  });

  // Fetch personalized recommendations
  const { data: recsData, isLoading: recsLoading, error: recsError } = useQuery<RecommendationsData>({
    queryKey: ["/api/fantasy/waiver-recommendations", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/waiver-recommendations/${leagueId}`, {
        credentials: "include"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch recommendations");
      }
      return res.json();
    },
    enabled: !!leagueId,
    retry: 1,
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


  // Filter recommendations by position if set
  const filteredRecs = recsData?.recommendations?.filter(rec => 
    positionFilter === "All" || rec.position === positionFilter
  ) || [];

  return (
    <PremiumGate featureName="Waiver Wire">
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

      {/* Personalized Recommendations Section */}
      {showRecommendations && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-recommendations">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Recommended for You</CardTitle>
                <InfoTooltip
                  title="Waiver Recommendations"
                  description="AI-analyzed players that fill gaps on your roster. Fit Score combines dynasty value with how much your team needs that position. Higher score = better pickup for your team."
                />
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowRecommendations(false)}
                data-testid="btn-hide-recommendations"
              >
                Hide
              </Button>
            </div>
            <CardDescription>
              Players that best fit your roster needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recsLoading ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : recsError ? (
              <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span>Unable to load recommendations. Connect your Sleeper account to see personalized picks.</span>
              </div>
            ) : filteredRecs.length > 0 ? (
              <>
                {/* Position Needs Badges */}
                {recsData?.needs && recsData.needs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-sm text-muted-foreground">Your needs:</span>
                    {recsData.needs.map((need) => (
                      <Badge 
                        key={need.position}
                        variant={need.level === "high" ? "destructive" : need.level === "medium" ? "default" : "secondary"}
                        className="text-xs"
                        data-testid={`badge-need-${need.position}`}
                      >
                        {need.position} ({need.count})
                        {need.level === "high" && <AlertCircle className="ml-1 h-3 w-3" />}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Recommendation Cards */}
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRecs.slice(0, 6).map((rec) => (
                    <div 
                      key={rec.playerId}
                      className="p-3 rounded-lg border border-border/50 bg-card/80 space-y-2 hover-elevate"
                      data-testid={`rec-player-${rec.playerId}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getPositionColorClass(rec.position)}>
                            {rec.position}
                          </Badge>
                          <span className="font-medium text-sm">{rec.name}</span>
                        </div>
                        <MetricTooltip metric="fitScore" className="flex items-center gap-1 text-sm font-bold text-primary">
                          <Target className="h-3 w-3 text-primary" />
                          {rec.fitScore}
                        </MetricTooltip>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{rec.team} • Age {rec.age || "?"}</span>
                        <span className="text-muted-foreground">Value: {rec.dynastyValue.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No personalized recommendations available
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Toggle to show recommendations if hidden */}
      {!showRecommendations && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowRecommendations(true)}
          className="gap-2"
          data-testid="btn-show-recommendations"
        >
          <Sparkles className="h-4 w-4" />
          Show Recommendations
        </Button>
      )}

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
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      Avg
                      <InfoTooltip title="Average Points" description="Average fantasy points per game this season. Primary indicator of a player's weekly floor." />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Season</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Last Wk</TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    <span className="flex items-center justify-end gap-1">
                      Proj
                      <InfoTooltip title="Projected Points" description="Estimated fantasy points for next week based on matchup, usage trends, and recent performance." />
                    </span>
                  </TableHead>
                  <TableHead className="text-right hidden lg:table-cell">
                    <span className="flex items-center justify-end gap-1">
                      % Rostered
                      <InfoTooltip title="Roster Percentage" description="How many leagues have this player rostered. Low % means they're likely available in your league." />
                    </span>
                  </TableHead>
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
                          <span className="font-medium">
                            <span className="sm:hidden">{abbreviateName(player.name)}</span>
                            <span className="hidden sm:inline">{player.name}</span>
                          </span>
                          {player.injuryStatus && (
                            <Badge variant="destructive" className="w-fit text-xs mt-0.5">
                              {player.injuryStatus}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getPositionColorClass(player.position)}>
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
    </PremiumGate>
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
