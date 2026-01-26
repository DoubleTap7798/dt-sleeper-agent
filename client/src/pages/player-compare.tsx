import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { abbreviateName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GitCompare, Search, Plus, X, ArrowRight, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";

interface PlayerStats {
  games: number;
  points: number;
  ppg: number;
  passYds?: number;
  passTds?: number;
  rushYds?: number;
  rushTds?: number;
  recYds?: number;
  recTds?: number;
  receptions?: number;
  targets?: number;
}

interface ComparePlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  dynastyValue: number;
  leagueValue?: number;
  consensusValue?: number | null;
  blended?: boolean;
  stats: PlayerStats;
  projectedPoints: number;
  upside: number;
  floor: number;
}

interface ScoringSettings {
  applied: boolean;
  ppr?: number;
  passTd?: number;
  tePremium?: number;
  bonus100Rush?: number;
  bonus100Rec?: number;
  bonus300Pass?: number;
  rushFd?: number;
  recFd?: number;
  leagueId?: string;
  scoringType: string;
  sampleRbDelta?: number;
  consensusPlayers?: number;
  consensusAvailable?: boolean;
  consensusMatchRate?: number;
}

interface PlayersResponse {
  players: ComparePlayer[];
  scoringSettings?: ScoringSettings;
}

export default function PlayerComparePage() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [selectedPlayers, setSelectedPlayers] = useState<ComparePlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState<ComparePlayer | null>(null);

  const { data, isLoading } = useQuery<PlayersResponse>({
    queryKey: [`/api/fantasy/compare/players${leagueId ? `?leagueId=${leagueId}` : ""}`],
  });

  const getPositionColor = () => {
    return "bg-muted text-muted-foreground border-border";
  };

  const addPlayer = (player: ComparePlayer) => {
    if (selectedPlayers.length < 4 && !selectedPlayers.find(p => p.playerId === player.playerId)) {
      setSelectedPlayers([...selectedPlayers, player]);
    }
    setIsDialogOpen(false);
    setSearchTerm("");
  };

  const removePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.playerId !== playerId));
  };

  const getStatComparison = (statName: string, getValue: (p: ComparePlayer) => number | undefined) => {
    const values = selectedPlayers.map(p => ({ player: p, value: getValue(p) })).filter(v => v.value !== undefined);
    if (values.length === 0) return null;
    
    const max = Math.max(...values.map(v => v.value!));
    const min = Math.min(...values.map(v => v.value!));
    
    return {
      statName,
      values: selectedPlayers.map(p => {
        const val = getValue(p);
        const isMax = val === max && max !== min;
        const isMin = val === min && max !== min;
        return { value: val, isMax, isMin };
      })
    };
  };

  const filteredPlayers = (data?.players || []).filter(player => 
    searchTerm === "" || 
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(player => !selectedPlayers.find(p => p.playerId === player.playerId));

  const statRows = [
    // Only show dynasty value when a league is selected
    leagueId ? getStatComparison("Dynasty Value", p => p.dynastyValue) : null,
    getStatComparison("Age", p => p.age),
    getStatComparison("Games", p => p.stats.games),
    // Only show fantasy points when a league is selected
    leagueId ? getStatComparison("Total Points", p => p.stats.points) : null,
    leagueId ? getStatComparison("PPG", p => p.stats.ppg) : null,
    leagueId ? getStatComparison("Projected Pts", p => p.projectedPoints) : null,
    leagueId ? getStatComparison("Upside", p => p.upside) : null,
    leagueId ? getStatComparison("Floor", p => p.floor) : null,
    getStatComparison("Pass Yards", p => p.stats.passYds),
    getStatComparison("Pass TDs", p => p.stats.passTds),
    getStatComparison("Rush Yards", p => p.stats.rushYds),
    getStatComparison("Rush TDs", p => p.stats.rushTds),
    getStatComparison("Rec Yards", p => p.stats.recYds),
    getStatComparison("Rec TDs", p => p.stats.recTds),
    getStatComparison("Receptions", p => p.stats.receptions),
    getStatComparison("Targets", p => p.stats.targets),
  ].filter(Boolean);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const scoringSettings = data?.scoringSettings;
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <GitCompare className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Player Comparison</h1>
          {scoringSettings && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="text-xs cursor-help"
                  data-testid="badge-scoring-type"
                >
                  {scoringSettings.scoringType}
                  {scoringSettings.applied && scoringSettings.tePremium && scoringSettings.tePremium > 0 && " + TEP"}
                  {scoringSettings.sampleRbDelta !== undefined && scoringSettings.sampleRbDelta !== 0 && (
                    <span className="ml-1 text-muted-foreground">
                      ({scoringSettings.sampleRbDelta > 0 ? "+" : ""}{scoringSettings.sampleRbDelta})
                    </span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p className="font-medium">Dynasty Value = (League + KTC) / 2</p>
                  {scoringSettings.applied ? (
                    <>
                      <p>PPR: {scoringSettings.ppr ?? 0} pts/rec</p>
                      <p>Pass TD: {scoringSettings.passTd ?? 4} pts</p>
                      {scoringSettings.tePremium && scoringSettings.tePremium > 0 && (
                        <p>TE Premium: +{scoringSettings.tePremium} pts/rec</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No league selected - using default values</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              disabled={selectedPlayers.length >= 4}
              data-testid="button-add-player"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Player ({selectedPlayers.length}/4)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Player to Compare</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-compare"
                />
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {filteredPlayers.slice(0, 20).map((player) => (
                    <div
                      key={player.playerId}
                      className="flex items-center justify-between p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => addPlayer(player)}
                      data-testid={`player-option-${player.playerId}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getPositionColor()} data-testid={`badge-pos-${player.playerId}`}>
                          {player.position}
                        </Badge>
                        <span className="font-medium" data-testid={`option-name-${player.playerId}`}>
                          <span className="sm:hidden">{abbreviateName(player.name)}</span>
                          <span className="hidden sm:inline">{player.name}</span>
                        </span>
                        <span className="text-xs text-muted-foreground" data-testid={`option-team-${player.playerId}`}>{player.team}</span>
                      </div>
                      {leagueId && (
                        <span className="text-sm text-muted-foreground" data-testid={`option-value-${player.playerId}`}>{player.dynastyValue.toFixed(1)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selectedPlayers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Add players to compare their stats side by side</p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first">
              <Plus className="h-4 w-4 mr-2" />
              Add First Player
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className={`grid gap-4 grid-cols-${selectedPlayers.length}`} style={{
            gridTemplateColumns: `repeat(${selectedPlayers.length}, minmax(0, 1fr))`
          }}>
            {selectedPlayers.map((player) => (
              <Card key={player.playerId} data-testid={`compare-card-${player.playerId}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getPositionColor()}>
                      {player.position}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removePlayer(player.playerId)}
                      data-testid={`button-remove-${player.playerId}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-lg" data-testid={`text-player-name-${player.playerId}`}>
                    <span className="sm:hidden">{abbreviateName(player.name)}</span>
                    <span className="hidden sm:inline">{player.name}</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground" data-testid={`text-player-team-${player.playerId}`}>{player.team}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setProfilePlayer(player)}
                    data-testid={`button-view-stats-${player.playerId}`}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Stats
                  </Button>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {statRows.map((row, idx) => row && (
                  <div 
                    key={idx} 
                    className="grid items-center py-2 px-4"
                    style={{
                      gridTemplateColumns: `120px repeat(${selectedPlayers.length}, minmax(0, 1fr))`
                    }}
                  >
                    <span className="text-sm text-muted-foreground" data-testid={`stat-label-${idx}`}>{row.statName}</span>
                    {row.values.map((v, i) => (
                      <div 
                        key={i} 
                        className={`text-center font-medium ${
                          v.isMax ? "underline" : v.isMin ? "text-muted-foreground" : ""
                        }`}
                        data-testid={`stat-value-${idx}-${i}`}
                      >
                        {v.value !== undefined ? (
                          typeof v.value === "number" && !Number.isInteger(v.value) 
                            ? v.value.toFixed(1) 
                            : v.value
                        ) : "-"}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {profilePlayer && (
        <PlayerProfileModal
          open={!!profilePlayer}
          onOpenChange={(open) => !open && setProfilePlayer(null)}
          playerId={profilePlayer.playerId}
          playerName={profilePlayer.name}
          position={profilePlayer.position}
          team={profilePlayer.team}
        />
      )}
    </div>
  );
}
