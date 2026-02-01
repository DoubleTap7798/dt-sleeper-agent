import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { getPositionColorClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Trophy, TrendingUp, Users, ChevronRight, Star, Zap, Crown } from "lucide-react";
import type { StandingsTeam } from "@/lib/sleeper-types";

interface StandingsData {
  standings: StandingsTeam[];
  playoffTeams: number;
  currentWeek: number;
}

interface UserProfile {
  sleeperUserId: string | null;
}

interface PlayerInfo {
  id: string;
  name: string;
  fullName: string;
  position: string;
  slotPosition?: string;
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
    pointsAgainst: number;
    maxPoints: number;
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

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

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
  const currentUserSleeperId = profile?.sleeperUserId;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-xl font-semibold" data-testid="text-standings-title">
          Standings
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-1">
          <div className="flex items-center text-xs text-muted-foreground uppercase tracking-wider px-2 py-2 border-b">
            <span className="w-8 text-center">RANK</span>
            <span className="flex-1 ml-2">NAME</span>
            <span className="w-20 text-center hidden sm:block">WAIVER</span>
            <span className="w-12 text-center hidden sm:block">PF</span>
            <span className="w-12 text-center hidden sm:block">PA</span>
            <span className="w-6"></span>
          </div>
          
          {standings.map((team, index) => {
            const isPlayoffSpot = index < playoffTeams;
            const isLastPlayoffSpot = index === playoffTeams - 1;
            const isTopTeam = index === 0;
            const isCurrentUser = currentUserSleeperId && team.ownerId === currentUserSleeperId;
            
            return (
              <div key={team.rosterId}>
                <div
                  className={`flex items-center px-2 py-3 cursor-pointer transition-colors hover-elevate rounded-md ${
                    isCurrentUser 
                      ? "bg-primary/20 border border-primary/30" 
                      : isPlayoffSpot 
                        ? "bg-primary/15 border-l-2 border-l-primary" 
                        : ""
                  }`}
                  onClick={() => setSelectedTeam({ rosterId: team.rosterId, ownerName: team.ownerName })}
                  data-testid={`row-standings-${team.rosterId}`}
                >
                <div className="w-8 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="font-medium text-sm">{index + 1}</span>
                    {isTopTeam && (
                      <Crown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 flex-1 ml-2 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={team.avatar || undefined} />
                    <AvatarFallback className="text-sm">
                      {team.ownerName?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`text-team-name-${team.rosterId}`}>
                      {team.ownerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ""}
                    </p>
                  </div>
                </div>
                
                <div className="w-20 text-center hidden sm:block">
                  <span className="text-xs text-muted-foreground">
                    ${team.waiverBudget ?? 100} ({team.waiverPosition || index + 1})
                  </span>
                </div>
                
                <div className="w-12 text-center hidden sm:block">
                  <span className="text-xs font-mono">{team.pointsFor?.toFixed(0) || 0}</span>
                </div>
                
                <div className="w-12 text-center hidden sm:block">
                  <span className="text-xs font-mono">{team.pointsAgainst?.toFixed(0) || 0}</span>
                </div>
                
                <div className="w-6">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                </div>
                {isLastPlayoffSpot && playoffTeams > 0 && (
                  <div className="my-2 border-b-2 border-primary shadow-[0_2px_8px_rgba(0,212,255,0.4)]" />
                )}
              </div>
            );
          })}
          
          {playoffTeams > 0 && (
            <p className="text-xs text-muted-foreground mt-3 px-2">
              Top {playoffTeams} teams make the playoffs (highlighted)
            </p>
          )}
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
                const oddsColor = "text-muted-foreground";
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
                <Card className="p-3 text-center" data-testid="card-points-for">
                  <p className="text-xs text-muted-foreground">Points For</p>
                  <p className="text-lg font-bold font-mono" data-testid="text-points-for">{teamDetail.record.pointsFor.toFixed(1)}</p>
                </Card>
                <Card className="p-3 text-center" data-testid="card-points-against">
                  <p className="text-xs text-muted-foreground">Pts Against</p>
                  <p className="text-lg font-bold font-mono" data-testid="text-points-against">{teamDetail.record.pointsAgainst.toFixed(1)}</p>
                </Card>
                <Card className="p-3 text-center" data-testid="card-max-points">
                  <p className="text-xs text-muted-foreground">Max Points</p>
                  <p className="text-lg font-bold font-mono" data-testid="text-max-points">{teamDetail.record.maxPoints.toFixed(1)}</p>
                </Card>
              </div>

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4" />
                  Starters ({teamDetail.starters.length})
                </h3>
                <div className="space-y-2">
                  {teamDetail.starters.map((player) => (
                    <PlayerRow key={player.id} player={player} showSlot />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  Bench ({teamDetail.bench.length})
                </h3>
                <BenchByPosition players={teamDetail.bench} />
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
                        {pick.value.toFixed(1)}
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

function PlayerRow({ player, showSlot = false }: { player: PlayerInfo; showSlot?: boolean }) {
  const displayPosition = showSlot && player.slotPosition ? player.slotPosition : player.position;

  return (
    <div 
      className="flex items-center justify-between p-2 rounded-lg bg-accent/30"
      data-testid={`player-row-${player.id}`}
    >
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={`text-xs min-w-[3rem] justify-center ${getPositionColorClass(player.position)}`}
          data-testid={`badge-position-${player.id}`}
        >
          {displayPosition}
        </Badge>
        <div>
          <p className="text-sm font-medium" data-testid={`text-player-name-${player.id}`}>{player.name}</p>
          <p className="text-xs text-muted-foreground">
            {player.team}{player.age ? ` | ${player.age} yrs` : ""}
          </p>
        </div>
      </div>
      <Badge variant="secondary" className="font-mono text-xs" data-testid={`badge-value-${player.id}`}>
        {player.value.toFixed(1)}
      </Badge>
    </div>
  );
}

function BenchByPosition({ players }: { players: PlayerInfo[] }) {
  const positionOrder = ["QB", "RB", "WR", "TE", "K", "DEF"];
  
  const grouped = players.reduce((acc, player) => {
    const pos = player.position;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(player);
    return acc;
  }, {} as Record<string, PlayerInfo[]>);

  const sortedPositions = Object.keys(grouped).sort((a, b) => {
    const aIdx = positionOrder.indexOf(a);
    const bIdx = positionOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  return (
    <div className="space-y-3">
      {sortedPositions.map((pos) => (
        <div key={pos} className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium pl-1">{pos}</p>
          <div className="space-y-1">
            {grouped[pos].map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </div>
        </div>
      ))}
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
