import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague, useLeagues } from "./league-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, TrendingUp, TrendingDown, Calendar, Target, Crown, Medal } from "lucide-react";

interface LeagueSummary {
  totalLeagues: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  championships: number;
  runnerUps: number;
  playoffAppearances: number;
  bestFinish: string;
  currentSeason: string;
  leagueStats: {
    leagueId: string;
    leagueName: string;
    season: string;
    wins: number;
    losses: number;
    ties: number;
    rank: number;
    totalTeams: number;
    isChampion: boolean;
    isPlayoffs: boolean;
  }[];
}

export default function HomePage() {
  const selectedLeague = useSelectedLeague();
  const leagues = useLeagues();
  const leagueIds = leagues?.map((l: { league_id: string }) => l.league_id).join(",") || "";

  const { data, isLoading, error } = useQuery<LeagueSummary>({
    queryKey: [`/api/fantasy/summary?leagueIds=${leagueIds}`],
    enabled: !!leagueIds,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const winRate = data && (data.totalWins + data.totalLosses) > 0
    ? ((data.totalWins / (data.totalWins + data.totalLosses)) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
          Your fantasy football overview across all leagues
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-leagues">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Leagues</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-total-leagues">
              {data?.totalLeagues || leagues?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active leagues</p>
          </CardContent>
        </Card>

        <Card data-testid="card-record">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Overall Record</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-record">
              {data?.totalWins || 0}-{data?.totalLosses || 0}
              {data?.totalTies ? `-${data.totalTies}` : ""}
            </div>
            <p className="text-xs text-muted-foreground">{winRate}% win rate</p>
          </CardContent>
        </Card>

        <Card data-testid="card-championships">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Championships</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-championships">
              {data?.championships || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.runnerUps ? `${data.runnerUps} runner-ups` : "Titles won"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-playoffs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Playoff Apps</CardTitle>
            <Medal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-playoffs">
              {data?.playoffAppearances || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total appearances</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-league-breakdown">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">League Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.leagueStats && data.leagueStats.length > 0 ? (
            <div className="space-y-3">
              {data.leagueStats.map((league, idx) => (
                <div 
                  key={league.leagueId} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/50 gap-2"
                  data-testid={`league-row-${idx}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {league.isChampion && <Crown className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base" data-testid={`league-name-${idx}`}>
                        {league.leagueName}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`league-season-${idx}`}>
                        {league.season}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs" data-testid={`league-record-${idx}`}>
                      {league.wins}-{league.losses}{league.ties ? `-${league.ties}` : ""}
                    </Badge>
                    <Badge variant="secondary" className="text-xs" data-testid={`league-rank-${idx}`}>
                      #{league.rank} of {league.totalTeams}
                    </Badge>
                    {league.isPlayoffs && (
                      <Badge variant="outline" className="text-xs" data-testid={`league-playoffs-${idx}`}>
                        Playoffs
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : leagues && leagues.length > 0 ? (
            <div className="space-y-3">
              {leagues.map((league: any, idx: number) => (
                <div 
                  key={league.league_id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/50 gap-2"
                  data-testid={`league-row-${idx}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm sm:text-base" data-testid={`league-name-${idx}`}>
                      {league.name}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`league-season-${idx}`}>
                      {league.season} Season
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs self-start sm:self-center" data-testid={`league-teams-${idx}`}>
                    {league.total_rosters} Teams
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-leagues">
                No leagues connected. Connect your Sleeper account to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLeague && (
        <Card data-testid="card-current-league">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Current League: {selectedLeague.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Season</p>
                <p className="font-medium text-sm sm:text-base" data-testid="current-season">{selectedLeague.season}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teams</p>
                <p className="font-medium text-sm sm:text-base" data-testid="current-teams">{selectedLeague.total_rosters}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium text-sm sm:text-base capitalize" data-testid="current-status">{selectedLeague.status || "Active"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium text-sm sm:text-base capitalize" data-testid="current-type">
                  {selectedLeague.settings?.type === 2 ? "Dynasty" : "Redraft"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
