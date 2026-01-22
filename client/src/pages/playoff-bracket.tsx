import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";

interface Team {
  rosterId: number;
  ownerName: string;
  avatar: string | null;
}

interface BracketMatchup {
  round: number;
  matchId: number;
  team1: Team | null;
  team2: Team | null;
  winner: number | null;
  loser: number | null;
  team1From?: { w?: number; l?: number };
  team2From?: { w?: number; l?: number };
}

interface BracketData {
  leagueId: string;
  leagueName: string;
  season: string;
  playoffWeekStart: number;
  playoffTeams: number;
  currentWeek: number;
  numRounds: number;
  rounds: Record<number, BracketMatchup[]>;
  matchups: BracketMatchup[];
  thirdPlaceGame: BracketMatchup | null;
  isPlayoffsStarted: boolean;
  isComplete: boolean;
}

function MatchupCard({ matchup, roundName, isChampionship }: { matchup: BracketMatchup; roundName: string; isChampionship: boolean }) {
  const isComplete = matchup.winner !== null;
  
  const TeamRow = ({ team, isWinner, isTop }: { team: Team | null; isWinner: boolean; isTop: boolean }) => {
    if (!team) {
      return (
        <div className={`flex items-center gap-2 p-2 ${isTop ? "border-b border-border/50" : ""}`}>
          <div className="h-6 w-6 rounded-full bg-muted" />
          <span className="text-sm text-muted-foreground">TBD</span>
        </div>
      );
    }

    return (
      <div 
        className={`flex items-center gap-2 p-2 ${isTop ? "border-b border-border/50" : ""} ${isWinner ? "bg-white/5" : ""}`}
        data-testid={`bracket-team-${team.rosterId}`}
      >
        <Avatar className="h-6 w-6">
          <AvatarImage src={team.avatar || undefined} alt={team.ownerName} />
          <AvatarFallback className="text-xs">
            {team.ownerName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={`text-sm flex-1 truncate ${isWinner ? "font-semibold" : ""}`}>
          {team.ownerName}
        </span>
        {isWinner && isChampionship && (
          <Crown className="h-4 w-4 text-foreground" />
        )}
        {isWinner && !isChampionship && (
          <Badge variant="outline" className="text-xs px-1 py-0">W</Badge>
        )}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden" data-testid={`bracket-matchup-${matchup.matchId}`}>
      <TeamRow 
        team={matchup.team1} 
        isWinner={matchup.winner === matchup.team1?.rosterId} 
        isTop={true}
      />
      <TeamRow 
        team={matchup.team2} 
        isWinner={matchup.winner === matchup.team2?.rosterId} 
        isTop={false}
      />
    </Card>
  );
}

export default function PlayoffBracketPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data: bracket, isLoading, error } = useQuery<BracketData>({
    queryKey: [`/api/sleeper/bracket/${leagueId}`],
    enabled: !!leagueId,
  });

  if (!leagueId) {
    return (
      <div className="p-6" data-testid="page-playoff-bracket">
        <p className="text-muted-foreground">Please select a league to view the playoff bracket.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="page-playoff-bracket">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4 flex-1">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !bracket) {
    return (
      <div className="p-6" data-testid="page-playoff-bracket">
        <p className="text-destructive">Failed to load playoff bracket.</p>
      </div>
    );
  }

  const getRoundName = (round: number, numRounds: number, playoffTeams: number): string => {
    // For 6-team playoffs: Round 1 = Wildcard, Round 2 = Semifinals, Round 3 = Championship
    // For 4-team playoffs: Round 1 = Semifinals, Round 2 = Championship
    // For 8-team playoffs: Round 1 = Quarterfinals, Round 2 = Semifinals, Round 3 = Championship
    if (round === numRounds) return "Championship";
    if (round === numRounds - 1) return "Semifinals";
    if (playoffTeams === 6 && round === 1) return "Wildcard";
    if (playoffTeams === 8 && round === 1) return "Quarterfinals";
    return `Round ${round}`;
  };

  const rounds = Object.keys(bracket.rounds)
    .map(Number)
    .sort((a, b) => a - b);

  const champion = bracket.matchups.find(
    (m) => m.round === bracket.numRounds && m.winner !== null
  );
  const championTeam = champion?.winner === champion?.team1?.rosterId 
    ? champion?.team1 
    : champion?.team2;

  return (
    <div className="p-6 space-y-6" data-testid="page-playoff-bracket">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Playoff Bracket
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {bracket.season} Season {bracket.isComplete ? "(Complete)" : bracket.isPlayoffsStarted ? "(In Progress)" : `(Starts Week ${bracket.playoffWeekStart})`}
          </p>
        </div>
        {championTeam && (
          <Card className="p-3 flex items-center gap-3" data-testid="champion-card">
            <Crown className="h-6 w-6 text-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Champion</p>
              <p className="font-bold">{championTeam.ownerName}</p>
            </div>
            <Avatar className="h-10 w-10">
              <AvatarImage src={championTeam.avatar || undefined} alt={championTeam.ownerName} />
              <AvatarFallback>{championTeam.ownerName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Card>
        )}
      </div>

      {!bracket.isPlayoffsStarted && (
        <Card className="p-4 border-dashed" data-testid="playoffs-not-started">
          <p className="text-center text-muted-foreground">
            Playoffs begin in Week {bracket.playoffWeekStart}. 
            {bracket.currentWeek < bracket.playoffWeekStart && (
              <span> ({bracket.playoffWeekStart - bracket.currentWeek} weeks away)</span>
            )}
          </p>
        </Card>
      )}

      <div className="flex gap-6 overflow-x-auto pb-4">
        {rounds.map((round) => {
          const roundMatchups = bracket.rounds[round] || [];
          const roundName = getRoundName(round, bracket.numRounds, bracket.playoffTeams);
          const isChampionship = round === bracket.numRounds;

          return (
            <div 
              key={round} 
              className="flex-shrink-0 min-w-[200px]"
              data-testid={`bracket-round-${round}`}
            >
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
                {roundName}
              </h3>
              <div className="space-y-4 flex flex-col justify-around h-full">
                {roundMatchups.map((matchup) => (
                  <MatchupCard 
                    key={matchup.matchId} 
                    matchup={matchup} 
                    roundName={roundName}
                    isChampionship={isChampionship}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {bracket.thirdPlaceGame && (
        <div className="mt-6 pt-6 border-t border-border" data-testid="third-place-section">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            3rd Place Game
          </h3>
          <div className="max-w-[200px]">
            <MatchupCard 
              matchup={bracket.thirdPlaceGame} 
              roundName="3rd Place"
              isChampionship={false}
            />
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-4">
        <p>{bracket.playoffTeams} team playoff bracket</p>
      </div>
    </div>
  );
}
