import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CACHE_TIMES, apiRequest, queryClient } from "@/lib/queryClient";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Briefcase, Plus, ChevronRight, TrendingUp, TrendingDown, Sparkles, Zap, AlertTriangle, Trash2, UserPlus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { calculateDVI } from "./devy-rankings";
import type { DevyPlayer, DevyData, DevyComp } from "./devy-rankings";

interface ManualEntry {
  id: string;
  userId: string;
  playerName: string;
  position: string;
  school: string | null;
  leagueName: string | null;
  notes: string | null;
  createdAt: string;
}

export default function DevyPortfolioPage() {
  usePageTitle("My Devy Portfolio");
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ playerName: "", position: "QB", school: "", leagueName: "", notes: "" });

  const { data: devyData, isLoading: devyLoading } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: myDevyData, isLoading: myDevyLoading } = useQuery<{
    ownedDevy: Array<{ devyPlayerId: string; devyName: string; devyPosition: string; devySchool: string; leagueId: string; leagueName: string; matched: boolean }>;
    leagues: Array<{ id: string; name: string }>;
    manualEntries: ManualEntry[];
  }>({
    queryKey: ["/api/sleeper/devy/my-players"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: watchlistData } = useQuery<{ watchlist: Array<{ playerId: string }> }>({
    queryKey: ["/api/watchlist"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof newPlayer) => {
      return apiRequest("POST", "/api/sleeper/devy/my-players", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sleeper/devy/my-players"] });
      setAddDialogOpen(false);
      setNewPlayer({ playerName: "", position: "QB", school: "", leagueName: "", notes: "" });
      toast({ title: "Player added to your devy portfolio" });
    },
    onError: () => {
      toast({ title: "Failed to add player", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/sleeper/devy/my-players/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sleeper/devy/my-players"] });
      toast({ title: "Player removed from portfolio" });
    },
  });

  if (devyLoading || myDevyLoading) {
    return <PortfolioSkeleton />;
  }

  const players = devyData?.players || [];

  const fuzzyNameMatch = (name1: string, name2: string): boolean => {
    const a = name1.toLowerCase().trim();
    const b = name2.toLowerCase().trim();
    if (a === b) return true;
    const aParts = a.split(' ');
    const bParts = b.split(' ');
    const aLast = aParts[aParts.length - 1];
    const bLast = bParts[bParts.length - 1];
    if (aLast !== bLast) return false;
    const aFirst = aParts[0];
    const bFirst = bParts[0];
    if (aFirst.replace('.', '') === bFirst.replace('.', '')) return true;
    if (aFirst.length <= 2 && bFirst.startsWith(aFirst.replace('.', ''))) return true;
    if (bFirst.length <= 2 && aFirst.startsWith(bFirst.replace('.', ''))) return true;
    return false;
  };

  const ownedIds = new Set(myDevyData?.ownedDevy?.map(d => d.devyPlayerId) || []);
  const watchlistIds = new Set(watchlistData?.watchlist?.map(w => w.playerId) || []);

  const matchedPlayers = players.filter(p => {
    return ownedIds.has(p.playerId) || watchlistIds.has(p.playerId) ||
      (myDevyData?.ownedDevy || []).some(d => fuzzyNameMatch(d.devyName, p.name));
  });

  const unmatchedDevy = (myDevyData?.ownedDevy || []).filter(d => {
    if (d.matched) return false;
    return !players.some(p => p.playerId === d.devyPlayerId || fuzzyNameMatch(d.devyName, p.name));
  });

  const getOwnedLeagues = (playerId: string, playerName: string): string[] => {
    if (!myDevyData?.ownedDevy) return [];
    return myDevyData.ownedDevy
      .filter(d => d.devyPlayerId === playerId || fuzzyNameMatch(d.devyName, playerName))
      .map(d => d.leagueName);
  };

  const totalValue = matchedPlayers.reduce((sum, p) => sum + p.value, 0);
  const avgDvi = matchedPlayers.length > 0 ? Math.round(matchedPlayers.reduce((sum, p) => sum + calculateDVI(p), 0) / matchedPlayers.length) : 0;
  const posCounts: Record<string, number> = {};
  matchedPlayers.forEach(p => { posCounts[p.position] = (posCounts[p.position] || 0) + 1; });
  const avgElite = matchedPlayers.length > 0 ? matchedPlayers.reduce((sum, p) => sum + p.elitePct, 0) / matchedPlayers.length : 0;
  const avgBust = matchedPlayers.length > 0 ? matchedPlayers.reduce((sum, p) => sum + p.bustPct, 0) / matchedPlayers.length : 0;
  const portfolioHealth = Math.round(Math.min(100, Math.max(0, avgElite - avgBust)));

  const totalCount = matchedPlayers.length + unmatchedDevy.length;
  const manualEntries = myDevyData?.manualEntries || [];

  const handlePlayerClick = (player: DevyPlayer) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  return (
    <PremiumGate featureName="Devy Portfolio">
    <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-portfolio-page">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/10 via-background to-purple-500/10 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-portfolio-title">
                My Devy Portfolio
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalCount} prospect{totalCount !== 1 ? "s" : ""} in your dynasty pipeline
              </p>
            </div>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-devy">
                <UserPlus className="h-4 w-4" />
                Add Player
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-devy">
              <DialogHeader>
                <DialogTitle>Add Devy Player</DialogTitle>
                <DialogDescription>
                  Manually add a prospect to your portfolio that the system didn't pick up.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="playerName">Player Name *</Label>
                  <Input
                    id="playerName"
                    value={newPlayer.playerName}
                    onChange={(e) => setNewPlayer(prev => ({ ...prev, playerName: e.target.value }))}
                    placeholder="e.g. Arch Manning"
                    data-testid="input-player-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Select value={newPlayer.position} onValueChange={(v) => setNewPlayer(prev => ({ ...prev, position: v }))}>
                    <SelectTrigger data-testid="select-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["QB", "RB", "WR", "TE"].map(pos => (
                        <SelectItem key={pos} value={pos} data-testid={`option-pos-${pos}`}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school">School</Label>
                  <Input
                    id="school"
                    value={newPlayer.school}
                    onChange={(e) => setNewPlayer(prev => ({ ...prev, school: e.target.value }))}
                    placeholder="e.g. Texas"
                    data-testid="input-school"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leagueName">League</Label>
                  <Input
                    id="leagueName"
                    value={newPlayer.leagueName}
                    onChange={(e) => setNewPlayer(prev => ({ ...prev, leagueName: e.target.value }))}
                    placeholder="e.g. Devy Degenerates"
                    data-testid="input-league-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newPlayer.notes}
                    onChange={(e) => setNewPlayer(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any notes about this prospect..."
                    className="resize-none"
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" data-testid="button-cancel-add">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={() => addMutation.mutate(newPlayer)}
                  disabled={!newPlayer.playerName.trim() || addMutation.isPending}
                  data-testid="button-confirm-add"
                >
                  {addMutation.isPending ? "Adding..." : "Add to Portfolio"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="stat-total-value">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Portfolio Value</p>
              <p className="text-2xl font-bold">{totalValue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-avg-dvi">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Avg DVI Score</p>
              <p className={`text-2xl font-bold ${avgDvi >= 70 ? "text-green-500" : avgDvi >= 50 ? "text-yellow-500" : "text-red-500"}`}>{avgDvi}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-position-balance">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Position Balance</p>
              <div className="flex items-center gap-1 flex-wrap mt-1">
                {["QB", "RB", "WR", "TE"].map(pos => (
                  <Badge key={pos} variant="outline" className={`text-[10px] ${getPositionColorClass(pos)}`} data-testid={`badge-pos-count-${pos}`}>
                    {pos} {posCounts[pos] || 0}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-portfolio-health">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Portfolio Health</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${portfolioHealth >= 50 ? "text-green-500" : portfolioHealth >= 25 ? "text-yellow-500" : "text-red-500"}`}>{portfolioHealth}</p>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${portfolioHealth >= 50 ? "bg-green-500" : portfolioHealth >= 25 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${portfolioHealth}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {matchedPlayers.length > 0 && (
        <Card data-testid="card-matched-portfolio">
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Ranked Prospects ({matchedPlayers.length})
              </h3>
            </div>
            <div className="divide-y">
              {matchedPlayers.sort((a, b) => a.rank - b.rank).map((player) => {
                const leagues = getOwnedLeagues(player.playerId, player.name);
                return (
                  <div
                    key={player.playerId}
                    className="p-4 hover-elevate cursor-pointer flex items-center justify-between gap-3"
                    onClick={() => handlePlayerClick(player)}
                    data-testid={`row-portfolio-${player.playerId}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg font-bold text-muted-foreground w-8 shrink-0">#{player.rank}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{player.name}</span>
                          <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                            {player.position}{player.positionRank}
                          </Badge>
                          {player.ageClass === "young-breakout" && <Zap className="h-3 w-3 text-green-500" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{player.college}</span>
                          <span className="text-xs text-muted-foreground">{player.draftEligibleYear}</span>
                          {leagues.map((league, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">{league}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className={`text-xl font-bold ${
                            calculateDVI(player) >= 80 ? "text-green-500" :
                            calculateDVI(player) >= 60 ? "text-primary" :
                            calculateDVI(player) >= 40 ? "text-yellow-500" :
                            "text-red-500"
                          }`}>{calculateDVI(player)}</span>
                          <span className="text-[10px] text-muted-foreground">DVI</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs justify-end">
                          <span className="text-green-500">{player.elitePct}%</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-500">{player.bustPct}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {player.trend30Day > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : player.trend30Day < 0 ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : null}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {unmatchedDevy.length > 0 && (
        <Card data-testid="card-unmatched-portfolio">
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Unranked Prospects ({unmatchedDevy.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-1">These players are on your rosters but not in the rankings database</p>
            </div>
            <div className="divide-y">
              {unmatchedDevy.map((d, i) => (
                <div key={`unmatched-${i}`} className="p-4 flex items-center justify-between gap-3" data-testid={`row-unmatched-${i}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(d.devyPosition)}`}>
                      {d.devyPosition}
                    </Badge>
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{d.devyName}</span>
                      {d.devySchool && <span className="text-xs text-muted-foreground ml-2">{d.devySchool}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{d.leagueName}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {manualEntries.length > 0 && (
        <Card data-testid="card-manual-entries">
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                Manually Added ({manualEntries.length})
              </h3>
            </div>
            <div className="divide-y">
              {manualEntries.map((entry) => (
                <div key={entry.id} className="p-4 flex items-center justify-between gap-3" data-testid={`row-manual-${entry.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(entry.position)}`}>
                      {entry.position}
                    </Badge>
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{entry.playerName}</span>
                      {entry.school && <span className="text-xs text-muted-foreground ml-2">{entry.school}</span>}
                      {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.leagueName && <Badge variant="secondary" className="text-[10px]">{entry.leagueName}</Badge>}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMutation.mutate(entry.id)}
                          disabled={removeMutation.isPending}
                          data-testid={`button-remove-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove from portfolio</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {totalCount === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Devy Players Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your owned devy prospects will appear here automatically from your Sleeper leagues.
              You can also manually add players that the system doesn't pick up.
            </p>
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2" data-testid="button-add-first-devy">
              <Plus className="h-4 w-4" />
              Add Your First Prospect
            </Button>
          </CardContent>
        </Card>
      )}

      <DevyProfileModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedPlayer(null);
        }}
        player={selectedPlayer}
      />
    </div>
    </PremiumGate>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-6" data-testid="devy-portfolio-skeleton">
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
