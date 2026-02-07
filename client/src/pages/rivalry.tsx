import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Swords, Calendar, ChevronRight } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface OpponentRecord {
  opponentRosterId: number;
  opponentName: string;
  opponentAvatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  totalGames: number;
  winPct: number;
}

interface TeamRecord {
  rosterId: number;
  ownerName: string;
  avatar: string | null;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalGames: number;
  opponents: OpponentRecord[];
}

interface RivalryData {
  teamRecords: TeamRecord[];
  leagueName: string;
  totalSeasons: number;
  seasons: string[];
}

export default function RivalryPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading } = useQuery<RivalryData>({
    queryKey: [`/api/sleeper/rivalries/${leagueId}`],
    enabled: !!leagueId,
    ...CACHE_TIMES.STABLE,
  });

  usePageTitle("Rivalries");

  if (isLoading) {
    return <RivalrySkeleton />;
  }

  if (!data || !data.teamRecords || data.teamRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="empty-state-rivalry">
        <Swords className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2" data-testid="text-empty-title">No Rivalry Data</h2>
        <p className="text-muted-foreground" data-testid="text-empty-description">
          Head-to-head matchup data will appear here once games are played.
        </p>
      </div>
    );
  }

  const totalMatchups = data.teamRecords.reduce((sum, t) => sum + t.totalGames, 0) / 2;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Swords className="h-6 w-6" />
          Rivalries
        </h1>
        <p className="text-muted-foreground" data-testid="text-page-subtitle">
          Head-to-head records across {data.totalSeasons} season{data.totalSeasons !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-matchups">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Swords className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-matchups">
                  {Math.round(totalMatchups)}
                </p>
                <p className="text-sm text-muted-foreground">Total Matchups</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-teams-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <ChevronRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-teams-count">
                  {data.teamRecords.length}
                </p>
                <p className="text-sm text-muted-foreground">Teams</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-seasons-tracked">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-seasons-tracked">
                  {data.totalSeasons}
                </p>
                <p className="text-sm text-muted-foreground">Seasons Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Team Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {data.teamRecords.map((team, teamIndex) => {
              const overallWinPct = team.totalGames > 0 
                ? ((team.totalWins / team.totalGames) * 100).toFixed(0)
                : "0";
              
              return (
                <AccordionItem 
                  key={team.rosterId} 
                  value={`team-${team.rosterId}`}
                  data-testid={`accordion-team-${teamIndex}`}
                >
                  <AccordionTrigger className="hover:no-underline" data-testid={`accordion-trigger-${teamIndex}`}>
                    <div className="flex items-center gap-3 w-full pr-4">
                      <Avatar className="h-10 w-10 border-2 border-background">
                        <AvatarImage src={team.avatar || undefined} />
                        <AvatarFallback className="text-sm">
                          {team.ownerName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate" data-testid={`text-team-name-${teamIndex}`}>
                          {team.ownerName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {team.totalWins}-{team.totalLosses}
                          {team.totalTies > 0 && `-${team.totalTies}`}
                          {" "}({overallWinPct}%)
                        </p>
                      </div>
                      <Badge variant="outline" className="font-mono ml-auto" data-testid={`badge-team-games-${teamIndex}`}>
                        {team.totalGames} games
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {team.opponents.map((opponent, oppIndex) => {
                        const winPctDisplay = (opponent.winPct * 100).toFixed(0);
                        const isWinning = opponent.wins > opponent.losses;
                        const isLosing = opponent.losses > opponent.wins;
                        
                        return (
                          <div
                            key={opponent.opponentRosterId}
                            className="flex items-center gap-3 p-3 rounded-lg bg-accent/30"
                            data-testid={`opponent-row-${teamIndex}-${oppIndex}`}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={opponent.opponentAvatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {opponent.opponentName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate" data-testid={`text-opponent-name-${teamIndex}-${oppIndex}`}>
                                vs {opponent.opponentName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {opponent.totalGames} game{opponent.totalGames !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Badge 
                                  variant={isWinning ? "default" : "secondary"}
                                  className="font-mono text-xs"
                                  data-testid={`badge-wins-${teamIndex}-${oppIndex}`}
                                >
                                  {opponent.wins}
                                </Badge>
                                <span className="text-muted-foreground text-xs">-</span>
                                <Badge 
                                  variant={isLosing ? "default" : "secondary"}
                                  className="font-mono text-xs"
                                  data-testid={`badge-losses-${teamIndex}-${oppIndex}`}
                                >
                                  {opponent.losses}
                                </Badge>
                                {opponent.ties > 0 && (
                                  <>
                                    <span className="text-muted-foreground text-xs">-</span>
                                    <Badge variant="outline" className="font-mono text-xs" data-testid={`badge-ties-${teamIndex}-${oppIndex}`}>
                                      {opponent.ties}
                                    </Badge>
                                  </>
                                )}
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`font-mono text-xs ${
                                  isWinning ? 'font-bold' : 
                                  isLosing ? 'text-muted-foreground' : ''
                                }`}
                                data-testid={`badge-winpct-${teamIndex}-${oppIndex}`}
                              >
                                {winPctDisplay}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function RivalrySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
