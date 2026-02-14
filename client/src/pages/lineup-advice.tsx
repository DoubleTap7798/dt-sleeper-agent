import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Users, 
  ThumbsUp, 
  ThumbsDown, 
  AlertCircle, 
  TrendingUp, 
  Shield, 
  Target,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface Matchup {
  opponent: string;
  opponentRank: number;
  projected: number;
  ceiling: number;
  floor: number;
}

interface LineupPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  matchup: Matchup;
  recommendation: "start" | "sit" | "flex";
  confidence: number;
  reasoning: string;
  gameScript: string;
  weatherImpact?: string;
  injuryStatus?: string;
}

interface LineupAdvice {
  week: number;
  rosterId: number;
  teamName: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  suggestions: {
    type: "swap" | "warning" | "opportunity";
    message: string;
    players: string[];
  }[];
  overallAnalysis: string;
}

interface MatchupGame {
  season: string;
  week: number;
  date: string;
  homeAway: "home" | "away";
  result: string;
  score: string;
  fantasyPoints: number;
  keyStats: Record<string, number>;
}

interface MatchupHistoryData {
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  gamesFound: number;
  games: MatchupGame[];
  avgFantasyPts: number;
  verdict: "strong_start" | "average" | "tough_matchup" | "no_data";
  scoringType: string;
}

function MatchupHistoryPanel({ playerId, opponent, leagueId }: { playerId: string; opponent: string; leagueId: string }) {
  const cleanOpponent = opponent.replace(/^(vs\.?\s*|@\s*)/i, "").replace(/\(.*\)/, "").trim();

  const { data, isLoading, error } = useQuery<MatchupHistoryData>({
    queryKey: [`/api/fantasy/matchup-history/${playerId}?opponent=${encodeURIComponent(cleanOpponent)}&leagueId=${leagueId}`],
    enabled: !!playerId && !!cleanOpponent && !!leagueId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading matchup history...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Could not load matchup history.
      </div>
    );
  }

  if (data.gamesFound === 0) {
    return (
      <div className="py-4 text-center">
        <History className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No games found vs {data.opponent} in recent seasons.</p>
      </div>
    );
  }

  const verdictConfig = {
    strong_start: { label: "Strong Start", color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/30" },
    average: { label: "Average Matchup", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
    tough_matchup: { label: "Tough Matchup", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" },
    no_data: { label: "No Data", color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
  };

  const vc = verdictConfig[data.verdict];
  const pos = data.position;

  const getStatColumns = () => {
    if (pos === "QB") return ["passYds", "passTds", "ints", "rushYds", "rushTds"];
    if (pos === "RB") return ["rushYds", "rushTds", "carries", "receptions", "recYds"];
    if (pos === "WR" || pos === "TE") return ["receptions", "recYds", "recTds", "targets", "rushYds"];
    return [];
  };

  const statLabels: Record<string, string> = {
    passYds: "Pass Yds",
    passTds: "Pass TD",
    ints: "INT",
    rushYds: "Rush Yds",
    rushTds: "Rush TD",
    carries: "CAR",
    receptions: "REC",
    recYds: "Rec Yds",
    recTds: "Rec TD",
    targets: "TAR",
  };

  const statCols = getStatColumns();

  return (
    <div className="space-y-3" data-testid={`matchup-history-${playerId}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Last {data.gamesFound} vs {data.opponent}</span>
          <span className="text-xs text-muted-foreground">({data.scoringType})</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${vc.color} ${vc.bg} ${vc.border}`} data-testid={`verdict-${playerId}`}>
            {vc.label}
          </Badge>
          <span className="text-sm font-semibold" data-testid={`avg-pts-${playerId}`}>
            Avg: {data.avgFantasyPts} pts
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 px-1 text-muted-foreground font-medium">Game</th>
              <th className="text-left py-1.5 px-1 text-muted-foreground font-medium">Result</th>
              {statCols.map(col => (
                <th key={col} className="text-right py-1.5 px-1 text-muted-foreground font-medium">
                  {statLabels[col] || col}
                </th>
              ))}
              <th className="text-right py-1.5 px-1 text-muted-foreground font-semibold">FPts</th>
            </tr>
          </thead>
          <tbody>
            {data.games.map((game, idx) => (
              <tr key={idx} className="border-b border-border/50" data-testid={`matchup-game-row-${idx}`}>
                <td className="py-1.5 px-1 whitespace-nowrap">
                  <span className="text-muted-foreground">{game.season} W{game.week}</span>
                </td>
                <td className="py-1.5 px-1 whitespace-nowrap">
                  <span className={game.result?.startsWith("W") ? "text-green-400" : game.result?.startsWith("L") ? "text-red-400" : "text-muted-foreground"}>
                    {game.result} {game.score}
                  </span>
                </td>
                {statCols.map(col => (
                  <td key={col} className="text-right py-1.5 px-1">
                    {game.keyStats[col] != null ? Math.round(game.keyStats[col]) : "-"}
                  </td>
                ))}
                <td className="text-right py-1.5 px-1 font-semibold">
                  {game.fantasyPoints}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LineupAdvicePage() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [activeTab, setActiveTab] = useState("starters");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  usePageTitle("Lineup Advice");

  const { data, isLoading, error, refetch, isFetching } = useQuery<LineupAdvice>({
    queryKey: [`/api/fantasy/lineup-advice${leagueId ? `?leagueId=${leagueId}` : ""}`],
  });

  const getRecommendationBadge = (rec: string, confidence: number, playerId: string) => {
    switch (rec) {
      case "start":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border" data-testid={`badge-rec-${playerId}`}>
            <ThumbsUp className="h-3 w-3 mr-1" />
            Start ({confidence}%)
          </Badge>
        );
      case "sit":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border" data-testid={`badge-rec-${playerId}`}>
            <ThumbsDown className="h-3 w-3 mr-1" />
            Sit ({confidence}%)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border" data-testid={`badge-rec-${playerId}`}>
            <AlertCircle className="h-3 w-3 mr-1" />
            Flex ({confidence}%)
          </Badge>
        );
    }
  };

  const getMatchupLabel = (rank: number) => {
    if (rank <= 8) return "Great";
    if (rank <= 16) return "Good";
    if (rank <= 24) return "Fair";
    return "Tough";
  };

  const toggleExpanded = (playerId: string) => {
    setExpandedPlayer(prev => prev === playerId ? null : playerId);
  };

  const renderPlayerCard = (player: LineupPlayer) => {
    const isExpanded = expandedPlayer === player.playerId;
    const opponentText = player.matchup.opponent || "";
    const hasOpponent = opponentText && opponentText !== "TBD" && opponentText !== "BYE";

    return (
      <Card key={player.playerId} data-testid={`player-card-${player.playerId}`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid={`badge-position-${player.playerId}`}>
                  {player.position}
                </Badge>
                <span className="font-semibold" data-testid={`text-player-name-${player.playerId}`}>
                  <span className="sm:hidden">{abbreviateName(player.name)}</span>
                  <span className="hidden sm:inline">{player.name}</span>
                </span>
                <span className="text-sm text-muted-foreground" data-testid={`text-player-team-${player.playerId}`}>{player.team}</span>
              </div>
              {getRecommendationBadge(player.recommendation, player.confidence, player.playerId)}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground block">vs.</span>
                <span className="font-medium" data-testid={`stat-matchup-${player.playerId}`}>
                  {player.matchup.opponent} (#{player.matchup.opponentRank} - {getMatchupLabel(player.matchup.opponentRank)})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Projected</span>
                <span className="font-medium" data-testid={`stat-projected-${player.playerId}`}>{player.matchup.projected.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Ceiling</span>
                <span className="font-medium" data-testid={`stat-ceiling-${player.playerId}`}>{player.matchup.ceiling.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Floor</span>
                <span className="font-medium" data-testid={`stat-floor-${player.playerId}`}>{player.matchup.floor.toFixed(1)}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-muted-foreground" data-testid={`text-reasoning-${player.playerId}`}>{player.reasoning}</p>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-muted-foreground" data-testid={`text-gamescript-${player.playerId}`}>{player.gameScript}</p>
              </div>
              {player.injuryStatus && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-muted-foreground" data-testid={`text-injury-${player.playerId}`}>{player.injuryStatus}</p>
                </div>
              )}
            </div>

            {hasOpponent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpanded(player.playerId)}
                className="w-full justify-center gap-1 text-xs"
                data-testid={`button-matchup-history-${player.playerId}`}
              >
                <History className="h-3.5 w-3.5" />
                {isExpanded ? "Hide" : "View"} Matchup History vs {opponentText.replace(/^(vs\.?\s*|@\s*)/i, "").replace(/\s*\(.*\)/, "").trim()}
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}

            {isExpanded && hasOpponent && leagueId && (
              <div className="border-t border-border pt-3 mt-1">
                <MatchupHistoryPanel
                  playerId={player.playerId}
                  opponent={opponentText}
                  leagueId={leagueId}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Lineup Advice">
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Lineup Advice</h1>
            {data && (
              <p className="text-sm text-muted-foreground" data-testid="text-week-team">Week {data.week} - {data.teamName}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Failed to load lineup advice. Please try again.</p>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-empty-message">No lineup advice available</p>
            <p className="text-sm text-muted-foreground mt-2">Make sure you have connected your Sleeper account and selected a league.</p>
          </CardContent>
        </Card>
      ) : data.starters?.length === 0 && data.bench?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-roster">Could not find your roster for this league.</p>
            <p className="text-sm text-muted-foreground mt-2">Make sure your Sleeper username is linked to your account and you are a member of this league.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.suggestions && data.suggestions.length > 0 && (
            <Card className="border-border bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm" data-testid={`suggestion-${idx}`}>
                      {suggestion.type === "swap" && <RefreshCw className="h-4 w-4 mt-0.5" />}
                      {suggestion.type === "warning" && <AlertCircle className="h-4 w-4 mt-0.5" />}
                      {suggestion.type === "opportunity" && <TrendingUp className="h-4 w-4 mt-0.5" />}
                      <p>{suggestion.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.overallAnalysis && (
            <Card data-testid="card-overall-analysis">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Overall Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-overall-analysis">{data.overallAnalysis}</p>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="starters" data-testid="tab-starters">
                Starters ({data.starters?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="bench" data-testid="tab-bench">
                Bench ({data.bench?.length || 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="starters" className="space-y-4 mt-4">
              {data.starters?.map(renderPlayerCard)}
            </TabsContent>
            <TabsContent value="bench" className="space-y-4 mt-4">
              {data.bench?.map(renderPlayerCard)}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
    </PremiumGate>
  );
}
