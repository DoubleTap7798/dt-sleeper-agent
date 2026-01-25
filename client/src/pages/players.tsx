import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Users, Search, TrendingUp, AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";

interface Player {
  id: string;
  name: string;
  fullName: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number;
  fantasyPoints: number;
  pointsPerGame: number;
  gamesPlayed: number;
  dynastyValue: number;
  overallRank: number;
  positionRank: number;
  injuryStatus: string | null;
  number: number | null;
  college: string | null;
  height: string | null;
  weight: string | null;
  snapPct: number | null;
  stats: {
    passYd: number;
    passTd: number;
    passInt: number;
    passAtt: number;
    passCmp: number;
    passFd: number;
    rushYd: number;
    rushTd: number;
    rushAtt: number;
    rushFd: number;
    rec: number;
    recYd: number;
    recTd: number;
    recTgt: number;
    recFd: number;
  };
}

interface PlayersData {
  players: Player[];
  totalCount: number;
  season: string;
  scoringType: string;
  isCustomScoring?: boolean;
  lastUpdated: string;
}

interface PlayerInsights {
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
    age: number | null;
    yearsExp: number;
    value: number;
    injuryStatus: string | null;
    number: number | null;
    college: string | null;
    height: string | null;
    weight: string | null;
  };
  insights: string;
  generatedAt: string;
}

const positionStyles: Record<string, string> = {
  QB: "bg-muted text-foreground",
  RB: "bg-muted text-foreground",
  WR: "bg-muted text-foreground",
  TE: "bg-muted text-foreground",
};

export default function PlayersPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);

  const playersUrl = leagueId ? `/api/sleeper/players?leagueId=${leagueId}` : "/api/sleeper/players";
  const { data, isLoading, error } = useQuery<PlayersData>({
    queryKey: [playersUrl],
  });

  const insightsUrl = selectedPlayer ? `/api/sleeper/players/${selectedPlayer.id}/insights` : null;
  const { data: insightsData, isLoading: insightsLoading } = useQuery<PlayerInsights>({
    queryKey: [insightsUrl],
    enabled: !!selectedPlayer && !!insightsUrl,
  });

  if (isLoading) {
    return <PlayersSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load players</p>
      </div>
    );
  }

  const filteredPlayers = data.players.filter((player) => {
    const matchesSearch = 
      player.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === "all" || player.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-players">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            NFL Players
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.totalCount.toLocaleString()} players ranked by {data.season} fantasy production ({data.scoringType})
            {data.isCustomScoring && (
              <span className="ml-2 text-xs" title="Your league has custom scoring settings. Rankings are approximate.">
                (approximate)
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players or teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-players"
          />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[120px]" data-testid="select-position-filter">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="QB">QB</SelectItem>
            <SelectItem value="RB">RB</SelectItem>
            <SelectItem value="WR">WR</SelectItem>
            <SelectItem value="TE">TE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-2">#</TableHead>
              <TableHead className="px-2">Player</TableHead>
              <TableHead className="w-12 px-2">Pos</TableHead>
              <TableHead className="w-12 px-2 hidden sm:table-cell">Tm</TableHead>
              <TableHead className="w-14 text-right px-2">Pts</TableHead>
              <TableHead className="w-12 text-right px-2">PPG</TableHead>
              <TableHead className="w-10 text-right px-2 hidden md:table-cell">GP</TableHead>
              <TableHead className="w-12 text-right px-2 hidden md:table-cell">Snap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlayers.slice(0, 200).map((player) => (
              <TableRow
                key={player.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedPlayer(player)}
                data-testid={`player-row-${player.id}`}
              >
                <TableCell className="font-mono text-muted-foreground text-xs px-2">
                  {player.overallRank}
                </TableCell>
                <TableCell className="px-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate max-w-[140px] sm:max-w-none">{player.fullName}</span>
                    {player.injuryStatus && (
                      <Badge variant="destructive" className="text-[10px] px-1">
                        {player.injuryStatus}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${positionStyles[player.position] || ""}`}
                  >
                    {player.position}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs px-2 hidden sm:table-cell">
                  {player.team}
                </TableCell>
                <TableCell className="text-right font-mono font-medium text-sm px-2">
                  {player.fantasyPoints.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-xs px-2">
                  {player.pointsPerGame.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-xs px-2 hidden md:table-cell">
                  {player.gamesPlayed}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-xs px-2 hidden md:table-cell">
                  {player.snapPct !== null ? `${player.snapPct}%` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {filteredPlayers.length > 200 && (
          <div className="p-4 text-center text-sm text-muted-foreground border-t">
            Showing first 200 of {filteredPlayers.length} players. Use search to find specific players.
          </div>
        )}
      </Card>

      <Sheet open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedPlayer && (
                <>
                  <Badge
                    variant="outline"
                    className={`${positionStyles[selectedPlayer.position] || ""}`}
                  >
                    {selectedPlayer.position}
                  </Badge>
                  <span>{selectedPlayer.fullName}</span>
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          {selectedPlayer && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Total Points</p>
                  <p className="text-lg font-bold font-mono">{selectedPlayer.fantasyPoints.toFixed(1)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Points/Game</p>
                  <p className="text-lg font-bold font-mono">{selectedPlayer.pointsPerGame.toFixed(1)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Games Played</p>
                  <p className="text-lg font-bold">{selectedPlayer.gamesPlayed}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Dynasty Value</p>
                  <p className="text-lg font-bold font-mono">{selectedPlayer.dynastyValue.toLocaleString()}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Overall Rank</p>
                  <p className="text-lg font-bold">#{selectedPlayer.overallRank}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Position Rank</p>
                  <p className="text-lg font-bold">{selectedPlayer.position}{selectedPlayer.positionRank}</p>
                </Card>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Season Stats</h4>
                {selectedPlayer.position === "QB" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Pass Att</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.passAtt}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Comp</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.passCmp}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Pass Yds</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.passYd.toLocaleString()}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Pass TDs</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.passTd}</p>
                      </Card>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">INTs</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.passInt}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">1st Downs</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.passFd}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush Att</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushAtt}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush Yds</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushYd}</p>
                      </Card>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush TDs</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushTd}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush 1st</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushFd}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Snap %</p>
                        <p className="font-mono font-medium">{selectedPlayer.snapPct !== null ? `${selectedPlayer.snapPct}%` : "-"}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Games</p>
                        <p className="font-mono font-medium">{selectedPlayer.gamesPlayed}</p>
                      </Card>
                    </div>
                  </div>
                ) : selectedPlayer.position === "RB" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush Att</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushAtt}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush Yds</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushYd.toLocaleString()}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush TDs</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushTd}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush 1st</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushFd}</p>
                      </Card>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Targets</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recTgt}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rec}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec Yds</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recYd.toLocaleString()}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec TDs</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recTd}</p>
                      </Card>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec 1st</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recFd}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Total 1st</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushFd + selectedPlayer.stats.recFd}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Snap %</p>
                        <p className="font-mono font-medium">{selectedPlayer.snapPct !== null ? `${selectedPlayer.snapPct}%` : "-"}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Games</p>
                        <p className="font-mono font-medium">{selectedPlayer.gamesPlayed}</p>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Targets</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recTgt}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rec}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec Yds</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recYd.toLocaleString()}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec TDs</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recTd}</p>
                      </Card>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rec 1st</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.recFd}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Snap %</p>
                        <p className="font-mono font-medium">{selectedPlayer.snapPct !== null ? `${selectedPlayer.snapPct}%` : "-"}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Games</p>
                        <p className="font-mono font-medium">{selectedPlayer.gamesPlayed}</p>
                      </Card>
                      <Card className="p-2">
                        <p className="text-xs text-muted-foreground">Rush Yds</p>
                        <p className="font-mono font-medium">{selectedPlayer.stats.rushYd}</p>
                      </Card>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span>{selectedPlayer.team}</span>
                {selectedPlayer.age && <span>Age: {selectedPlayer.age}</span>}
                {selectedPlayer.college && <span>College: {selectedPlayer.college}</span>}
                <span>Exp: {selectedPlayer.yearsExp} yr{selectedPlayer.yearsExp !== 1 ? "s" : ""}</span>
              </div>

              {selectedPlayer.injuryStatus && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">Injury Status: {selectedPlayer.injuryStatus}</span>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setProfilePlayer(selectedPlayer)}
                data-testid="button-view-full-stats"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Full Stats & Game Logs
              </Button>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Player Insights
                </h3>
                
                {insightsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Generating insights...</span>
                  </div>
                ) : insightsData ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {insightsData.insights}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Generated {new Date(insightsData.generatedAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Click on a player to load insights.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {profilePlayer && (
        <PlayerProfileModal
          open={!!profilePlayer}
          onOpenChange={(open) => !open && setProfilePlayer(null)}
          playerId={profilePlayer.id}
          playerName={profilePlayer.fullName}
          position={profilePlayer.position}
          team={profilePlayer.team}
        />
      )}
    </div>
  );
}

function PlayersSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <div className="p-4 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
