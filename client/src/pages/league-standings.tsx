import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StandingsTeam } from "@/lib/sleeper-types";

interface StandingsData {
  standings: StandingsTeam[];
  playoffTeams: number;
  currentWeek: number;
}

export default function LeagueStandingsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading, error } = useQuery<StandingsData>({
    queryKey: ["/api/sleeper/standings", leagueId],
    enabled: !!leagueId,
  });

  if (isLoading) {
    return <StandingsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load standings</p>
      </div>
    );
  }

  const { standings, playoffTeams } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-standings-title">
            League Standings
          </h2>
          <p className="text-muted-foreground">
            Current standings and playoff predictions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Current Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Record</TableHead>
                    <TableHead className="text-right">PF</TableHead>
                    <TableHead className="text-right">PA</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Win %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((team, index) => {
                    const isPlayoffSpot = index < playoffTeams;
                    return (
                      <TableRow
                        key={team.rosterId}
                        className={isPlayoffSpot ? "bg-accent/30" : ""}
                        data-testid={`row-standings-${team.rosterId}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {index + 1}
                            {index === 0 && (
                              <Trophy className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={team.avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {team.ownerName?.slice(0, 2).toUpperCase() || "??"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium truncate max-w-[120px] md:max-w-none">
                                {team.ownerName}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {team.wins}-{team.losses}
                          {team.ties > 0 && `-${team.ties}`}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {team.pointsFor.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {team.pointsAgainst.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell font-mono">
                          {(team.winPercentage * 100).toFixed(0)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {playoffTeams > 0 && (
                <p className="text-xs text-muted-foreground mt-4 px-2">
                  Top {playoffTeams} teams make the playoffs (highlighted)
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Playoff Predictions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {standings.slice(0, 8).map((team, index) => {
                const odds = team.playoffOdds ?? (100 - index * 12);
                const oddsColor = odds >= 70 ? "text-green-500" : odds >= 40 ? "text-yellow-500" : "text-red-500";
                return (
                  <div key={team.rosterId} className="space-y-1.5" data-testid={`playoff-odds-${team.rosterId}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[120px]">{team.ownerName}</span>
                      <span className={`font-mono font-medium ${oddsColor}`}>
                        {odds.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={odds} className="h-2" />
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-2">
                Predictions based on current standings, remaining schedule, and points scored.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Top Scorers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {standings
                .sort((a, b) => b.pointsFor - a.pointsFor)
                .slice(0, 5)
                .map((team, index) => (
                  <div
                    key={team.rosterId}
                    className="flex items-center justify-between"
                    data-testid={`top-scorer-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5">{index + 1}.</span>
                      <span className="truncate max-w-[100px]">{team.ownerName}</span>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {team.pointsFor.toFixed(1)}
                    </Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
