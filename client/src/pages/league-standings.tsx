import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, TrendingUp, Users, ChevronRight, Star, Zap } from "lucide-react";
import type { StandingsTeam } from "@/lib/sleeper-types";

interface StandingsData {
  standings: StandingsTeam[];
  playoffTeams: number;
  currentWeek: number;
}

interface PlayerInfo {
  id: string;
  name: string;
  fullName: string;
  position: string;
  team: string;
  age: number | null;
  value: number;
}

interface PickInfo {
  id: string;
  name: string;
  season: string;
  round: number;
  isOwn: boolean;
  originalOwner?: string;
  value: number;
}

interface TeamDetail {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  record: {
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
  };
  starters: PlayerInfo[];
  bench: PlayerInfo[];
  taxi: PlayerInfo[];
  ir: PlayerInfo[];
  picks: PickInfo[];
  totalPlayerValue: number;
  totalPickValue: number;
  totalValue: number;
}

export default function LeagueStandingsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [selectedTeam, setSelectedTeam] = useState<{ rosterId: number; ownerName: string } | null>(null);

  const { data, isLoading, error } = useQuery<StandingsData>({
    queryKey: ["/api/sleeper/standings", leagueId],
    enabled: !!leagueId,
  });

  const teamDetailUrl = selectedTeam ? `/api/sleeper/team/${leagueId}/${selectedTeam.rosterId}` : null;
  const { data: teamDetail, isLoading: teamLoading } = useQuery<TeamDetail>({
    queryKey: [teamDetailUrl],
    enabled: !!leagueId && !!selectedTeam && !!teamDetailUrl,
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
            Click a team to view their roster and picks
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
                    <TableHead className="text-right hidden md:table-cell">Win %</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((team, index) => {
                    const isPlayoffSpot = index < playoffTeams;
                    return (
                      <TableRow
                        key={team.rosterId}
                        className={`cursor-pointer transition-colors hover-elevate ${isPlayoffSpot ? "bg-white/5" : ""}`}
                        onClick={() => setSelectedTeam({ rosterId: team.rosterId, ownerName: team.ownerName })}
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
                        <TableCell className="text-right hidden md:table-cell font-mono">
                          {(team.winPercentage * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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

      <Sheet open={!!selectedTeam} onOpenChange={(open) => !open && setSelectedTeam(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-team-detail">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3" data-testid="text-team-name">
              {teamDetail && (
                <>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={teamDetail.avatar || undefined} />
                    <AvatarFallback>
                      {teamDetail.ownerName?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p data-testid="text-owner-name">{teamDetail.ownerName}</p>
                    <p className="text-sm font-normal text-muted-foreground" data-testid="text-team-record">
                      {teamDetail.record.wins}-{teamDetail.record.losses}
                      {teamDetail.record.ties > 0 && `-${teamDetail.record.ties}`}
                      {" | "}
                      {teamDetail.record.pointsFor.toFixed(1)} pts
                    </p>
                  </div>
                </>
              )}
              {!teamDetail && selectedTeam && (
                <span>{selectedTeam.ownerName}</span>
              )}
            </SheetTitle>
          </SheetHeader>

          {teamLoading ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : teamDetail ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center" data-testid="card-player-value">
                  <p className="text-xs text-muted-foreground">Players</p>
                  <p className="text-lg font-bold font-mono" data-testid="text-player-value">{teamDetail.totalPlayerValue.toLocaleString()}</p>
                </Card>
                <Card className="p-3 text-center" data-testid="card-pick-value">
                  <p className="text-xs text-muted-foreground">Picks</p>
                  <p className="text-lg font-bold font-mono" data-testid="text-pick-value">{teamDetail.totalPickValue.toLocaleString()}</p>
                </Card>
                <Card className="p-3 text-center" data-testid="card-total-value">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold font-mono" data-testid="text-total-value">{teamDetail.totalValue.toLocaleString()}</p>
                </Card>
              </div>

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4" />
                  Starters ({teamDetail.starters.length})
                </h3>
                <div className="space-y-2">
                  {teamDetail.starters.map((player) => (
                    <PlayerRow key={player.id} player={player} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  Bench ({teamDetail.bench.length})
                </h3>
                <div className="space-y-2">
                  {teamDetail.bench.map((player) => (
                    <PlayerRow key={player.id} player={player} />
                  ))}
                </div>
              </div>

              {teamDetail.taxi.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    Taxi Squad ({teamDetail.taxi.length})
                  </h3>
                  <div className="space-y-2">
                    {teamDetail.taxi.map((player) => (
                      <PlayerRow key={player.id} player={player} />
                    ))}
                  </div>
                </div>
              )}

              {teamDetail.ir.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    IR ({teamDetail.ir.length})
                  </h3>
                  <div className="space-y-2">
                    {teamDetail.ir.map((player) => (
                      <PlayerRow key={player.id} player={player} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4" />
                  Draft Picks ({teamDetail.picks.length})
                </h3>
                <div className="space-y-2">
                  {teamDetail.picks.map((pick) => (
                    <div
                      key={pick.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-accent/30"
                      data-testid={`pick-row-${pick.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs" data-testid={`badge-round-${pick.id}`}>
                          R{pick.round}
                        </Badge>
                        <span className="text-sm" data-testid={`text-pick-name-${pick.id}`}>{pick.name}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs" data-testid={`badge-pick-value-${pick.id}`}>
                        {pick.value.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PlayerRow({ player }: { player: PlayerInfo }) {
  const positionColors: Record<string, string> = {
    QB: "bg-red-500/20 dark:bg-red-500/30 text-red-700 dark:text-red-300",
    RB: "bg-green-500/20 dark:bg-green-500/30 text-green-700 dark:text-green-300",
    WR: "bg-blue-500/20 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300",
    TE: "bg-orange-500/20 dark:bg-orange-500/30 text-orange-700 dark:text-orange-300",
    K: "bg-purple-500/20 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300",
    DEF: "bg-yellow-500/20 dark:bg-yellow-500/30 text-yellow-700 dark:text-yellow-300",
  };

  return (
    <div 
      className="flex items-center justify-between p-2 rounded-lg bg-accent/30"
      data-testid={`player-row-${player.id}`}
    >
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={`text-xs w-9 justify-center ${positionColors[player.position] || ""}`}
          data-testid={`badge-position-${player.id}`}
        >
          {player.position}
        </Badge>
        <div>
          <p className="text-sm font-medium" data-testid={`text-player-name-${player.id}`}>{player.name}</p>
          <p className="text-xs text-muted-foreground">
            {player.team}{player.age ? ` | ${player.age} yrs` : ""}
          </p>
        </div>
      </div>
      <Badge variant="secondary" className="font-mono text-xs" data-testid={`badge-value-${player.id}`}>
        {player.value.toLocaleString()}
      </Badge>
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
