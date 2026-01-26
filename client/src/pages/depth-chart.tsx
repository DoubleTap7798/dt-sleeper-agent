import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Shield, Users } from "lucide-react";
import { getNFLTeamLogo } from "@/lib/team-logos";
import { PlayerProfileModal } from "@/components/player-profile-modal";

interface DepthChartPlayer {
  id: string;
  name: string;
  fullName: string;
  position: string;
  team: string;
  depthOrder: number;
  age: number | null;
  yearsExp: number;
  injuryStatus: string | null;
  dynastyValue: number;
}

interface TeamDepthChart {
  team: string;
  teamName: string;
  positions: Record<string, DepthChartPlayer[]>;
}

interface DepthChartData {
  teams: TeamDepthChart[];
  lastUpdated: string;
}

const POSITION_GROUPS = [
  { id: "offense", label: "Offense", positions: ["QB", "RB", "WR", "TE"] },
  { id: "defense", label: "Defense", positions: ["DL", "LB", "DB"] },
];

const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS"
];

const TEAM_NAMES: Record<string, string> = {
  ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills", CAR: "Carolina Panthers", CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals", CLE: "Cleveland Browns", DAL: "Dallas Cowboys",
  DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
  HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs", LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders", MIA: "Miami Dolphins", MIN: "Minnesota Vikings",
  NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
  NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks", SF: "San Francisco 49ers", TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans", WAS: "Washington Commanders"
};

export default function DepthChartPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [positionGroup, setPositionGroup] = useState<string>("offense");
  const [selectedPlayer, setSelectedPlayer] = useState<DepthChartPlayer | null>(null);

  const depthChartUrl = leagueId 
    ? `/api/sleeper/depth-chart?leagueId=${leagueId}` 
    : "/api/sleeper/depth-chart";
  const { data, isLoading, error } = useQuery<DepthChartData>({
    queryKey: ["/api/sleeper/depth-chart", leagueId],
    queryFn: async () => {
      const res = await fetch(depthChartUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load depth chart");
      return res.json();
    },
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <DepthChartSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Depth Charts</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Failed to load depth charts</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPositions = POSITION_GROUPS.find(g => g.id === positionGroup)?.positions || [];
  const filteredTeams = selectedTeam === "all" 
    ? data.teams 
    : data.teams.filter(t => t.team === selectedTeam);

  return (
    <div className="p-6 space-y-6" data-testid="page-depth-chart">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Depth Charts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            NFL team depth charts by position
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Tabs value={positionGroup} onValueChange={setPositionGroup}>
          <TabsList>
            <TabsTrigger value="offense" data-testid="tab-offense" className="gap-1">
              <Users className="h-4 w-4" />
              Offense
            </TabsTrigger>
            <TabsTrigger value="defense" data-testid="tab-defense" className="gap-1">
              <Shield className="h-4 w-4" />
              Defense
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-[200px]" data-testid="select-team">
            <SelectValue placeholder="Select Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {NFL_TEAMS.map(team => (
              <SelectItem key={team} value={team}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={getNFLTeamLogo(team) || undefined} alt={team} />
                    <AvatarFallback className="text-[8px]">{team}</AvatarFallback>
                  </Avatar>
                  {TEAM_NAMES[team]}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredTeams.map(teamData => (
          <Card key={teamData.team} data-testid={`team-card-${teamData.team}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getNFLTeamLogo(teamData.team) || undefined} alt={teamData.team} />
                  <AvatarFallback>{teamData.team}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold">{teamData.teamName}</div>
                  <div className="text-sm text-muted-foreground font-normal">{teamData.team}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentPositions.map(pos => {
                  const players = teamData.positions[pos] || [];
                  return (
                    <div key={pos} className="space-y-2" data-testid={`position-group-${teamData.team}-${pos}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {pos}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({players.length})
                        </span>
                      </div>
                      <div className="space-y-1">
                        {players.length > 0 ? (
                          players.slice(0, 5).map((player, idx) => (
                            <div
                              key={player.id}
                              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                              onClick={() => setSelectedPlayer(player)}
                              data-testid={`player-${player.id}`}
                            >
                              <span className="text-xs text-muted-foreground w-4 font-mono">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium truncate">
                                    {player.name}
                                  </span>
                                  {player.injuryStatus && (
                                    <Badge variant="destructive" className="text-[10px] px-1">
                                      {player.injuryStatus}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Age {player.age || "?"} | {player.yearsExp}yr
                                </div>
                              </div>
                              {leagueId && (
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-mono">
                                    {player.dynastyValue.toFixed(1)}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground p-2">
                            No players
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPlayer && (
        <PlayerProfileModal
          open={!!selectedPlayer}
          onOpenChange={(open) => !open && setSelectedPlayer(null)}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.fullName}
          position={selectedPlayer.position}
          team={selectedPlayer.team}
        />
      )}
    </div>
  );
}

function DepthChartSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="h-6 w-6" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-10 w-64" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-6 w-16" />
                    {[1, 2, 3].map(k => (
                      <Skeleton key={k} className="h-12 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
