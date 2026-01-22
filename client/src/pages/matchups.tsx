import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
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
import { ChevronLeft, ChevronRight, ChevronDown, Zap, Clock, CheckCircle2 } from "lucide-react";

interface PlayerScore {
  playerId: string;
  name: string;
  position: string;
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

export default function MatchupsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [expandedMatchup, setExpandedMatchup] = useState<number | null>(null);

  const matchupsUrl = selectedWeek 
    ? `/api/sleeper/matchups/${leagueId}?week=${selectedWeek}`
    : `/api/sleeper/matchups/${leagueId}`;
  const { data, isLoading, error } = useQuery<MatchupsData>({
    queryKey: ["/api/sleeper/matchups", leagueId, selectedWeek],
    queryFn: async () => {
      const res = await fetch(matchupsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch matchups");
      return res.json();
    },
    enabled: !!leagueId,
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
            <div className="flex items-center justify-between gap-4">
              <TeamDisplay
                team={teamA}
                isWinning={teamAWinning && !isTied}
              />

              <div className="flex flex-col items-center gap-1 min-w-[80px]">
                <div className="text-xl font-bold flex items-center gap-2" data-testid={`score-matchup-${matchup.matchupId}`}>
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

              <TeamDisplay
                team={teamB}
                isWinning={teamBWinning && !isTied}
                reverse
              />

              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
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
      className={`flex items-center gap-3 flex-1 ${reverse ? "flex-row-reverse text-right" : ""}`}
      data-testid={`team-display-${team.rosterId}`}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={team.avatar || undefined} alt={team.ownerName} />
        <AvatarFallback>{team.ownerName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <p className={`font-medium ${isWinning ? "font-bold" : ""}`} data-testid={`text-team-name-${team.rosterId}`}>
          {team.ownerName}
        </p>
      </div>
      {isWinning && (
        <CheckCircle2 className="h-4 w-4 text-foreground" data-testid={`icon-winning-${team.rosterId}`} />
      )}
    </div>
  );
}

interface PlayerListProps {
  team: MatchupTeam;
  isWinning: boolean;
}

function PlayerList({ team, isWinning }: PlayerListProps) {
  const starters = team.players.filter((p) => p.isStarter);
  const bench = team.players.filter((p) => !p.isStarter);

  const positionOrder = ["QB", "RB", "WR", "TE", "K", "DEF", "FLEX", "SUPER_FLEX"];
  starters.sort((a, b) => {
    const aIdx = positionOrder.indexOf(a.position);
    const bIdx = positionOrder.indexOf(b.position);
    return aIdx - bIdx;
  });

  return (
    <div className="p-4" data-testid={`player-list-${team.rosterId}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`font-medium ${isWinning ? "font-bold" : ""}`} data-testid={`text-expanded-team-name-${team.rosterId}`}>{team.ownerName}</p>
        <p className="text-lg font-bold" data-testid={`text-total-points-${team.rosterId}`}>{team.totalPoints.toFixed(1)}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2" data-testid={`label-starters-${team.rosterId}`}>Starters</p>
        {starters.map((player) => (
          <PlayerRow key={player.playerId} player={player} />
        ))}
      </div>

      {bench.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2" data-testid={`label-bench-${team.rosterId}`}>Bench</p>
          {bench.slice(0, 5).map((player) => (
            <PlayerRow key={player.playerId} player={player} isBench />
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

function PlayerRow({ player, isBench }: PlayerRowProps) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${isBench ? "opacity-60" : ""}`}
      data-testid={`player-row-${player.playerId}`}
    >
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs" data-testid={`badge-position-${player.playerId}`}>
          {player.position}
        </Badge>
        <span className="text-sm truncate max-w-[120px]" data-testid={`text-player-name-${player.playerId}`}>{player.name}</span>
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
