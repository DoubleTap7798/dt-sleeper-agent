import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Zap, 
  Clock, 
  Trophy,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ArrowDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-500/20 text-red-400 border-red-500/30",
  RB: "bg-green-500/20 text-green-400 border-green-500/30",
  WR: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  TE: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

interface PlayerRecommendation {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  value: number;
  needFit: string;
  ppg: number;
}

interface DraftBoardPick {
  pickNo: number;
  round: number;
  slot: number;
  rosterId: number;
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
  };
}

interface ValueDrop extends PlayerRecommendation {
  expectedPick: number;
  spotsFallen: number;
}

interface MyDraftPick {
  playerId: string;
  name: string;
  position: string;
  team: string;
  round: number;
  slot: number;
  pickNo: number;
}

interface DraftRecommendationsResponse {
  recommendations: {
    bestValue: PlayerRecommendation[];
    bestForNeeds: PlayerRecommendation[];
    bestUpside: PlayerRecommendation[];
  };
  valueDrops: ValueDrop[];
  rosterAnalysis: {
    positionCounts: Record<string, number>;
    needs: string[];
    avgAge: number;
    profile: string;
  };
  positionalRuns: { position: string; count: number }[];
  draft: {
    id: string;
    status: string;
    type: string;
    rounds: number;
    picksMade: number;
    totalPicks: number;
  } | null;
  draftBoard: DraftBoardPick[];
  myPicks: MyDraftPick[];
  mode: string;
}

function PlayerRecommendationCard({ 
  player, 
  rank, 
  showReason 
}: { 
  player: PlayerRecommendation; 
  rank: number;
  showReason?: string;
}) {
  return (
    <div 
      className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover-elevate"
      data-testid={`recommendation-player-${player.playerId}`}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium truncate">{player.name}</span>
          <Badge variant="outline" className={POSITION_COLORS[player.position] || ""}>
            {player.position}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span>{player.team}</span>
          {player.age && <span>Age {player.age}</span>}
          <span>{player.ppg} PPG</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-primary">{Math.round(player.value)}</div>
        <div className="text-xs text-muted-foreground">Value</div>
      </div>
      {player.needFit === "High" && (
        <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
          Fits Need
        </Badge>
      )}
    </div>
  );
}

function PositionRunAlert({ position, count }: { position: string; count: number }) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
      data-testid={`alert-position-run-${position}`}
    >
      <AlertTriangle className="w-5 h-5 text-yellow-400" />
      <div>
        <span className="font-medium text-yellow-400">{position} Run Detected!</span>
        <span className="text-muted-foreground ml-2">{count} {position}s taken in last 6 picks</span>
      </div>
    </div>
  );
}

function ValueDropAlert({ player }: { player: ValueDrop }) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
      data-testid={`alert-value-drop-${player.playerId}`}
    >
      <TrendingDown className="w-5 h-5 text-green-400" />
      <div className="flex-1">
        <span className="font-medium text-green-400">{player.name}</span>
        <span className="text-muted-foreground ml-2">
          fallen {player.spotsFallen} spots - grab at {player.value.toFixed(1)} value!
        </span>
      </div>
      <Badge className={POSITION_COLORS[player.position] || ""}>{player.position}</Badge>
    </div>
  );
}

function RosterBuildVisual({ analysis }: { analysis: DraftRecommendationsResponse["rosterAnalysis"] }) {
  const positions = ["QB", "RB", "WR", "TE"];
  const targets = { QB: 2, RB: 6, WR: 8, TE: 2 };
  
  return (
    <Card data-testid="card-roster-build">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4" />
          Roster Build
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {positions.map(pos => {
          const count = analysis.positionCounts[pos] || 0;
          const target = targets[pos as keyof typeof targets];
          const pct = Math.min(100, (count / target) * 100);
          const isNeed = analysis.needs.includes(pos);
          
          return (
            <div key={pos} className="space-y-1" data-testid={`roster-position-${pos}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={`font-medium ${isNeed ? "text-yellow-400" : ""}`}>
                  {pos} {isNeed && "(Need)"}
                </span>
                <span className="text-muted-foreground">{count}/{target}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    isNeed ? "bg-yellow-500" : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        
        <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Avg Age</div>
            <div className="font-medium" data-testid="text-avg-age">{analysis.avgAge}</div>
          </div>
          <Badge 
            variant="outline" 
            data-testid={`badge-team-profile-${analysis.profile.toLowerCase()}`}
            className={
              analysis.profile === "Contender" 
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : analysis.profile === "Rebuild"
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
            }
          >
            {analysis.profile}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DraftBoard({ picks, currentPick }: { 
  picks: DraftBoardPick[]; 
  currentPick?: number;
}) {
  const currentPickRef = useRef<HTMLTableRowElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to current pick when it changes
  useEffect(() => {
    if (currentPickRef.current) {
      currentPickRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentPick]);

  const handleScrollToCurrent = () => {
    if (currentPickRef.current) {
      currentPickRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (picks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-draft-board">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No picks have been made yet</p>
        <p className="text-sm">The draft board will populate as picks are made</p>
      </div>
    );
  }

  // Sort picks by pickNo in descending order (most recent first)
  const sortedPicks = [...picks].sort((a, b) => b.pickNo - a.pickNo);

  return (
    <div className="space-y-2">
      {currentPick && (
        <div className="flex items-center justify-between px-2">
          <Badge variant="outline" className="text-primary border-primary">
            <Zap className="w-3 h-3 mr-1" />
            On the clock: Pick {currentPick}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleScrollToCurrent}
            className="text-xs"
            data-testid="button-scroll-to-current"
          >
            <ArrowDown className="w-3 h-3 mr-1" />
            Jump to current
          </Button>
        </div>
      )}
      <div className="overflow-x-auto max-h-80 overflow-y-auto" ref={scrollContainerRef}>
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-16 text-xs">Pick #</TableHead>
              <TableHead className="w-16 text-xs">Rd/Slot</TableHead>
              <TableHead className="text-xs">Player</TableHead>
              <TableHead className="w-12 text-xs text-center">Pos</TableHead>
              <TableHead className="w-12 text-xs text-center">Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPicks.map((pick) => {
              const isCurrent = currentPick === pick.pickNo;
              return (
                <TableRow 
                  key={pick.pickNo} 
                  ref={isCurrent ? currentPickRef : undefined}
                  className={isCurrent ? "bg-primary/20" : ""}
                  data-testid={`draft-pick-${pick.pickNo}`}
                >
                  <TableCell className="font-mono text-xs font-semibold text-primary">
                    #{pick.pickNo}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {pick.round}.{String(pick.slot).padStart(2, "0")}
                  </TableCell>
                  <TableCell className="font-medium">{pick.player.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-xs ${POSITION_COLORS[pick.player.position] || ""}`}>
                      {pick.player.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {pick.player.team}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function DraftWarRoomPage() {
  const { league } = useSelectedLeague();
  const [mode, setMode] = useState<"rookie" | "startup">("rookie");

  const { data, isLoading, error, refetch } = useQuery<DraftRecommendationsResponse>({
    queryKey: [`/api/fantasy/draft-recommendations/${league?.league_id}?mode=${mode}`],
    enabled: !!league?.league_id,
  });

  if (!league) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a league to view the Draft War Room
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as any)?.message || "Failed to load draft data";
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-red-400">{errorMessage}</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          data-testid="button-retry-draft"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const { recommendations, valueDrops, rosterAnalysis, positionalRuns, draft, draftBoard, myPicks } = data || {
    recommendations: { bestValue: [], bestForNeeds: [], bestUpside: [] },
    valueDrops: [],
    rosterAnalysis: { positionCounts: {}, needs: [], avgAge: 0, profile: "Balanced" },
    positionalRuns: [],
    draft: null,
    draftBoard: [],
    myPicks: [],
  };

  return (
    <PremiumGate featureName="Draft War Room">
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Draft War Room
          </h1>
          <p className="text-muted-foreground text-sm">
            AI-powered draft assistance for {league.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={mode === "rookie" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("rookie")}
            data-testid="button-mode-rookie"
          >
            Rookie Draft
          </Button>
          <Button
            variant={mode === "startup" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("startup")}
            data-testid="button-mode-startup"
          >
            Startup Draft
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-draft"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {(positionalRuns.length > 0 || valueDrops.length > 0) && (
        <div className="space-y-2" data-testid="alerts-container">
          {positionalRuns.map(run => (
            <PositionRunAlert key={run.position} position={run.position} count={run.count} />
          ))}
          {valueDrops.map(player => (
            <ValueDropAlert key={player.playerId} player={player} />
          ))}
        </div>
      )}

      {draft && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-draft-status">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <Badge 
                  variant={draft.status === "drafting" ? "default" : "outline"}
                  data-testid={`badge-draft-status-${draft.status}`}
                >
                  {draft.status === "drafting" ? "LIVE" : draft.status.toUpperCase()}
                </Badge>
                <span className="text-sm">
                  {draft.type.charAt(0).toUpperCase() + draft.type.slice(1)} Draft
                </span>
                <span className="text-sm text-muted-foreground">
                  {draft.rounds} Rounds
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">{draft.picksMade}</span>
                <span className="text-muted-foreground">/{draft.totalPicks} picks made</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card data-testid="card-smart-recommendations">
            <CardHeader>
              <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Smart Pick Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="value" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="value" data-testid="tab-best-value">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Best Value
                  </TabsTrigger>
                  <TabsTrigger value="needs" data-testid="tab-best-needs">
                    <Target className="w-4 h-4 mr-1" />
                    Roster Fit
                  </TabsTrigger>
                  <TabsTrigger value="upside" data-testid="tab-best-upside">
                    <Zap className="w-4 h-4 mr-1" />
                    High Upside
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="value" className="space-y-2">
                  {recommendations.bestValue.length > 0 ? (
                    recommendations.bestValue.map((player, i) => (
                      <PlayerRecommendationCard key={player.playerId} player={player} rank={i + 1} />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4" data-testid="empty-state-best-value">
                      No recommendations available
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="needs" className="space-y-2">
                  {recommendations.bestForNeeds.length > 0 ? (
                    recommendations.bestForNeeds.map((player, i) => (
                      <PlayerRecommendationCard key={player.playerId} player={player} rank={i + 1} />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4" data-testid="empty-state-best-needs">
                      Your roster is well balanced!
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="upside" className="space-y-2">
                  {recommendations.bestUpside.length > 0 ? (
                    recommendations.bestUpside.map((player, i) => (
                      <PlayerRecommendationCard key={player.playerId} player={player} rank={i + 1} />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4" data-testid="empty-state-best-upside">
                      No young upside players available
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card data-testid="card-draft-board">
            <CardHeader>
              <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                <Clock className="w-5 h-5" />
                Draft Board
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DraftBoard 
                picks={draftBoard} 
                currentPick={draft?.status === "drafting" ? draftBoard.length + 1 : undefined}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <RosterBuildVisual analysis={rosterAnalysis} />

          {rosterAnalysis.needs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Priority Needs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {rosterAnalysis.needs.map(pos => (
                    <Badge 
                      key={pos} 
                      variant="outline" 
                      className={POSITION_COLORS[pos] || ""}
                    >
                      {pos}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-my-picks">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                My Picks ({myPicks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myPicks.length > 0 ? (
                <div className="space-y-2">
                  {myPicks.map(pick => (
                    <div 
                      key={pick.playerId} 
                      className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-card/50 border border-border/30"
                      data-testid={`my-pick-${pick.playerId}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {pick.round}.{String(pick.slot).padStart(2, "0")}
                        </span>
                        <span className="font-medium text-sm">{pick.name}</span>
                      </div>
                      <Badge variant="outline" className={POSITION_COLORS[pick.position] || ""}>
                        {pick.position}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2" data-testid="empty-state-my-picks">
                  No picks made yet
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Draft Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                {mode === "rookie" 
                  ? "Focus on talent over landing spot for dynasty value"
                  : "Balance youth and production for long-term success"
                }
              </p>
              <p className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                Watch for positional runs and react accordingly
              </p>
              <p className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                Don't reach - let value come to you
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </PremiumGate>
  );
}
