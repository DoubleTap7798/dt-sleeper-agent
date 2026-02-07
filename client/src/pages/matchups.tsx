import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { abbreviateName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronLeft, ChevronRight, ChevronDown, Zap, Clock, CheckCircle2, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface PlayerScore {
  playerId: string;
  name: string;
  position: string;
  slotPosition: string; // The lineup slot (QB, RB, FLEX, SUPER_FLEX, etc.)
  team: string;
  points: number;
  isStarter: boolean;
}

interface MatchupTeam {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  totalPoints: number;
  players: PlayerScore[];
}

interface Matchup {
  matchupId: number;
  teamA: MatchupTeam;
  teamB: MatchupTeam | null;
}

interface MatchupsData {
  matchups: Matchup[];
  currentWeek: number;
  selectedWeek: number;
  seasonType: string;
  gamesInProgress: boolean;
}

interface MedianTrackerData {
  isMedianLeague: boolean;
  currentWeek: number;
  gamesInProgress: boolean;
  seasonRecord: {
    wins: number;
    losses: number;
    ties: number;
    percentage: number | null;
  };
  currentWeekData: {
    userScore: number;
    median: number;
    beatingMedian: boolean | null;
    leagueScores: { rosterId: number; ownerName: string; score: number; }[];
  } | null;
  weeklyResults: {
    week: number;
    userScore: number;
    median: number;
    result: 'W' | 'L' | 'T' | null;
    beatingMedian: boolean | null;
  }[];
}

export default function MatchupsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [expandedMatchup, setExpandedMatchup] = useState<number | null>(null);
  const [showMedianDetails, setShowMedianDetails] = useState(false);
  usePageTitle("Matchups");

  const { data, isLoading, error } = useQuery<MatchupsData>({
    queryKey: selectedWeek 
      ? [`/api/sleeper/matchups/${leagueId}?week=${selectedWeek}`]
      : [`/api/sleeper/matchups/${leagueId}`],
    enabled: !!leagueId,
  });

  const { data: medianData, isLoading: medianLoading, error: medianError } = useQuery<MedianTrackerData>({
    queryKey: [`/api/sleeper/median-tracker/${leagueId}`],
    enabled: !!leagueId,
    refetchInterval: (query) => {
      // Use median tracker's own gamesInProgress flag for refresh
      const data = query.state.data as MedianTrackerData | undefined;
      return data?.gamesInProgress ? 30000 : false;
    },
  });

  const currentWeek = data?.currentWeek || 1;
  const displayWeek = selectedWeek ?? currentWeek;

  const handlePrevWeek = () => {
    if (displayWeek > 1) {
      setSelectedWeek(displayWeek - 1);
      setExpandedMatchup(null);
    }
  };

  const handleNextWeek = () => {
    if (displayWeek < 18) {
      setSelectedWeek(displayWeek + 1);
      setExpandedMatchup(null);
    }
  };

  const handleCurrentWeek = () => {
    setSelectedWeek(null);
    setExpandedMatchup(null);
  };

  if (isLoading) {
    return <MatchupsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-matchups">
        <p className="text-muted-foreground" data-testid="text-error-matchups">Failed to load matchups</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="matchups-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-matchups-title">Matchups</h1>
          <p className="text-muted-foreground" data-testid="text-week-status">
            Week {displayWeek} {data.gamesInProgress && "- Live Scoring"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevWeek}
            disabled={displayWeek <= 1}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant={selectedWeek === null ? "default" : "outline"}
            size="sm"
            onClick={handleCurrentWeek}
            data-testid="button-current-week"
          >
            <Clock className="h-4 w-4 mr-1" />
            Week {currentWeek}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextWeek}
            disabled={displayWeek >= 18}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {data.gamesInProgress && (
        <div className="flex items-center gap-2 text-sm" data-testid="banner-live-scoring">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
          </div>
          <span className="text-muted-foreground" data-testid="text-live-status">Live - Scores update automatically</span>
        </div>
      )}

      {medianLoading && (
        <Card className="border-[hsl(var(--accent))]">
          <CardHeader className="py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24 mt-1" />
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
      
      {medianError && (
        <Card className="border-destructive/50">
          <CardHeader className="py-3">
            <p className="text-sm text-muted-foreground" data-testid="text-median-error">
              Unable to load median tracker
            </p>
          </CardHeader>
        </Card>
      )}
      
      {medianData && !medianError && (
        <MedianTrackerCard 
          medianData={medianData}
          showDetails={showMedianDetails}
          onToggleDetails={() => setShowMedianDetails(!showMedianDetails)}
          gamesInProgress={medianData.gamesInProgress}
        />
      )}

      <div className="grid gap-4">
        {data.matchups.map((matchup) => (
          <MatchupCard
            key={matchup.matchupId}
            matchup={matchup}
            isExpanded={expandedMatchup === matchup.matchupId}
            onToggle={() =>
              setExpandedMatchup(
                expandedMatchup === matchup.matchupId ? null : matchup.matchupId
              )
            }
            gamesInProgress={data.gamesInProgress}
          />
        ))}

        {data.matchups.length === 0 && (
          <Card data-testid="card-no-matchups">
            <CardContent className="py-8 text-center text-muted-foreground" data-testid={`text-no-matchups-week-${displayWeek}`}>
              No matchups found for Week {displayWeek}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface MatchupCardProps {
  matchup: Matchup;
  isExpanded: boolean;
  onToggle: () => void;
  gamesInProgress: boolean;
}

function MatchupCard({ matchup, isExpanded, onToggle, gamesInProgress }: MatchupCardProps) {
  const { teamA, teamB } = matchup;

  if (!teamB) {
    return (
      <Card data-testid={`matchup-card-${matchup.matchupId}`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-4">
            <TeamDisplay team={teamA} isWinning={false} />
            <div className="text-muted-foreground font-medium" data-testid={`text-bye-${matchup.matchupId}`}>BYE</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const teamAWinning = teamA.totalPoints > teamB.totalPoints;
  const teamBWinning = teamB.totalPoints > teamA.totalPoints;
  const isTied = teamA.totalPoints === teamB.totalPoints && teamA.totalPoints > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card data-testid={`matchup-card-${matchup.matchupId}`}>
        <CollapsibleTrigger asChild data-testid={`button-toggle-matchup-${matchup.matchupId}`}>
          <CardContent className="py-4 cursor-pointer hover-elevate">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <TeamDisplay
                team={teamA}
                isWinning={teamAWinning && !isTied}
              />

              <div className="flex flex-col items-center gap-1">
                <div className="text-base sm:text-xl font-bold flex items-center gap-1" data-testid={`score-matchup-${matchup.matchupId}`}>
                  <span className={teamAWinning ? "text-foreground" : "text-muted-foreground"} data-testid={`score-team-${teamA.rosterId}`}>
                    {teamA.totalPoints.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">-</span>
                  <span className={teamBWinning ? "text-foreground" : "text-muted-foreground"} data-testid={`score-team-${teamB.rosterId}`}>
                    {teamB.totalPoints.toFixed(1)}
                  </span>
                </div>
                {gamesInProgress && (
                  <Badge variant="outline" className="text-xs" data-testid={`badge-live-${matchup.matchupId}`}>
                    <Zap className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 justify-end min-w-0">
                <TeamDisplay
                  team={teamB}
                  isWinning={teamBWinning && !isTied}
                  reverse
                />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <PlayerList team={teamA} isWinning={teamAWinning} />
              <PlayerList team={teamB} isWinning={teamBWinning} />
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface TeamDisplayProps {
  team: MatchupTeam;
  isWinning: boolean;
  reverse?: boolean;
}

function TeamDisplay({ team, isWinning, reverse }: TeamDisplayProps) {
  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${reverse ? "flex-row-reverse" : ""}`}
      data-testid={`team-display-${team.rosterId}`}
    >
      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
        <AvatarImage src={team.avatar || undefined} alt={team.ownerName} />
        <AvatarFallback className="text-xs sm:text-sm">{team.ownerName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <p className={`font-medium truncate text-sm sm:text-base min-w-0 ${isWinning ? "font-bold" : ""}`} data-testid={`text-team-name-${team.rosterId}`}>
        {team.ownerName}
      </p>
      {isWinning && (
        <CheckCircle2 className="h-4 w-4 text-foreground shrink-0 hidden sm:block" data-testid={`icon-winning-${team.rosterId}`} />
      )}
    </div>
  );
}

interface PlayerListProps {
  team: MatchupTeam;
  isWinning: boolean;
}

function PlayerList({ team, isWinning }: PlayerListProps) {
  // Keep starters in their original order (matches lineup slots)
  const starters = team.players.filter((p) => p.isStarter);
  const bench = team.players.filter((p) => !p.isStarter);

  return (
    <div className="p-4" data-testid={`player-list-${team.rosterId}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`font-medium ${isWinning ? "font-bold" : ""}`} data-testid={`text-expanded-team-name-${team.rosterId}`}>{team.ownerName}</p>
        <p className="text-lg font-bold" data-testid={`text-total-points-${team.rosterId}`}>{team.totalPoints.toFixed(1)}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2" data-testid={`label-starters-${team.rosterId}`}>Starters</p>
        {starters.map((player, idx) => (
          <PlayerRow key={`${player.playerId}-${idx}`} player={player} />
        ))}
      </div>

      {bench.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2" data-testid={`label-bench-${team.rosterId}`}>Bench</p>
          {bench.slice(0, 5).map((player, idx) => (
            <PlayerRow key={`${player.playerId}-bench-${idx}`} player={player} isBench />
          ))}
          {bench.length > 5 && (
            <p className="text-xs text-muted-foreground" data-testid={`text-bench-overflow-${team.rosterId}`}>+{bench.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );
}

interface PlayerRowProps {
  player: PlayerScore;
  isBench?: boolean;
}

// Format slot position for display
function formatSlotPosition(slot: string): string {
  const slotMap: Record<string, string> = {
    "SUPER_FLEX": "SF",
    "FLEX": "FLX",
    "IDP_FLEX": "IDP",
    "BN": "BN",
  };
  return slotMap[slot] || slot;
}

function PlayerRow({ player, isBench }: PlayerRowProps) {
  const displaySlot = formatSlotPosition(player.slotPosition || player.position);
  
  return (
    <div
      className={`flex items-center justify-between py-1 ${isBench ? "opacity-60" : ""}`}
      data-testid={`player-row-${player.playerId}`}
    >
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs w-8 justify-center" data-testid={`badge-slot-${player.playerId}`}>
          {displaySlot}
        </Badge>
        <span className="text-sm truncate max-w-[100px]" data-testid={`text-player-name-${player.playerId}`}>
          <span className="sm:hidden">{abbreviateName(player.name)}</span>
          <span className="hidden sm:inline">{player.name}</span>
        </span>
        <span className="text-xs text-muted-foreground" data-testid={`text-player-position-${player.playerId}`}>
          {player.position}
        </span>
        <span className="text-xs text-muted-foreground" data-testid={`text-player-team-${player.playerId}`}>{player.team}</span>
      </div>
      <span className={`text-sm font-medium ${player.points > 0 ? "" : "text-muted-foreground"}`} data-testid={`text-player-points-${player.playerId}`}>
        {player.points.toFixed(1)}
      </span>
    </div>
  );
}

function MatchupsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24 mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      <div className="grid gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="flex items-center gap-3 flex-1 justify-end">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface MedianTrackerCardProps {
  medianData: MedianTrackerData;
  showDetails: boolean;
  onToggleDetails: () => void;
  gamesInProgress: boolean;
}

function MedianTrackerCard({ medianData, showDetails, onToggleDetails, gamesInProgress }: MedianTrackerCardProps) {
  const { seasonRecord, currentWeekData, isMedianLeague } = medianData;
  
  if (!isMedianLeague && !currentWeekData) {
    return null;
  }

  const totalGames = seasonRecord.wins + seasonRecord.losses + seasonRecord.ties;
  const hasCurrentWeekScore = currentWeekData && currentWeekData.userScore > 0;

  return (
    <Collapsible open={showDetails} onOpenChange={onToggleDetails}>
      <Card className="border-[hsl(var(--accent))]" data-testid="card-median-tracker">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-[hsl(var(--accent))]/10">
                  <BarChart3 className="h-5 w-5 text-[hsl(var(--accent))]" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2" data-testid="text-median-title">
                    Median Tracker
                    {isMedianLeague && (
                      <Badge variant="outline" className="text-xs" data-testid="badge-median-league">
                        Median League
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground" data-testid="text-median-record">
                    Season: {seasonRecord.wins}-{seasonRecord.losses}
                    {seasonRecord.ties > 0 && `-${seasonRecord.ties}`}
                    {seasonRecord.percentage !== null && ` (${seasonRecord.percentage}%)`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {hasCurrentWeekScore && currentWeekData && (
                  <div className="flex items-center gap-2" data-testid="container-current-week-median">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">This Week</p>
                      <div className="flex items-center gap-1">
                        {currentWeekData.beatingMedian === true && (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-green-500" data-testid="text-beating-median">
                              Above
                            </span>
                          </>
                        )}
                        {currentWeekData.beatingMedian === false && (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-500" data-testid="text-below-median">
                              Below
                            </span>
                          </>
                        )}
                        {currentWeekData.beatingMedian === null && (
                          <>
                            <Minus className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground" data-testid="text-at-median">
                              At Median
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right border-l pl-3">
                      <p className="text-xs text-muted-foreground">You / Median</p>
                      <p className="text-sm font-medium" data-testid="text-score-vs-median">
                        {currentWeekData.userScore.toFixed(1)} / {currentWeekData.median.toFixed(1)}
                      </p>
                    </div>
                  </div>
                )}

                {gamesInProgress && hasCurrentWeekScore && (
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--accent))]/40 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--accent))]"></span>
                  </div>
                )}

                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-4">
              {currentWeekData && currentWeekData.leagueScores.length > 0 && (
                <div data-testid="container-league-scores">
                  <p className="text-sm font-medium mb-2">Current Week Scores</p>
                  <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                    {currentWeekData.leagueScores.map((team, index) => {
                      const isAboveMedian = team.score > currentWeekData.median;
                      const isBelowMedian = team.score < currentWeekData.median && team.score > 0;
                      const midIndex = Math.floor(currentWeekData.leagueScores.length / 2);
                      const isMedianLine = index === midIndex - 1;
                      
                      return (
                        <div key={team.rosterId}>
                          <div 
                            className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                              isAboveMedian ? "bg-green-500/10" : isBelowMedian ? "bg-red-500/10" : ""
                            }`}
                            data-testid={`row-team-score-${team.rosterId}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground w-4 text-right">{index + 1}.</span>
                              <span>{team.ownerName}</span>
                            </div>
                            <span className={`font-medium ${isAboveMedian ? "text-green-500" : isBelowMedian ? "text-red-500" : "text-muted-foreground"}`}>
                              {team.score.toFixed(1)}
                            </span>
                          </div>
                          {isMedianLine && (
                            <div className="flex items-center gap-2 py-1 px-2" data-testid="divider-median-line">
                              <div className="flex-1 h-px bg-[hsl(var(--accent))]/50"></div>
                              <span className="text-xs text-[hsl(var(--accent))]">Median: {currentWeekData.median.toFixed(1)}</span>
                              <div className="flex-1 h-px bg-[hsl(var(--accent))]/50"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {totalGames > 0 && (
                <div data-testid="container-weekly-results">
                  <p className="text-sm font-medium mb-2">Weekly Results vs Median</p>
                  <div className="flex flex-wrap gap-1">
                    {medianData.weeklyResults.map((weekResult) => (
                      <div
                        key={weekResult.week}
                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
                          weekResult.result === 'W' ? 'bg-green-500/20 text-green-500' :
                          weekResult.result === 'L' ? 'bg-red-500/20 text-red-500' :
                          'bg-muted text-muted-foreground'
                        }`}
                        title={`Week ${weekResult.week}: ${weekResult.userScore.toFixed(1)} vs ${weekResult.median.toFixed(1)}`}
                        data-testid={`badge-week-result-${weekResult.week}`}
                      >
                        {weekResult.result || '-'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
