import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, TrendingUp, TrendingDown, Minus, Trash2, Plus, Search, StickyNote } from "lucide-react";
import { MetricTooltip } from "@/components/metric-tooltip";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";
import { formatWatchlistForShare } from "@/lib/export-utils";

interface WatchlistItem {
  id: string;
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  valueAtAdd: number;
  currentValue: number;
  valueChange: number;
  notes: string | null;
  createdAt: string;
}

interface WatchlistData {
  watchlist: WatchlistItem[];
}

export default function WatchlistPage() {
  const { toast } = useToast();
  usePageTitle("Watchlist");
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading, error: watchlistError } = useQuery<WatchlistData>({
    queryKey: ["/api/watchlist"],
  });

  const addMutation = useMutation({
    mutationFn: async ({ playerId, notes }: { playerId: string; notes?: string }) => {
      return apiRequest("POST", "/api/watchlist", { playerId, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setAddDialogOpen(false);
      setPlayerSearch("");
      setSelectedPlayer(null);
      setNotes("");
      toast({ title: "Player added to watchlist" });
    },
    onError: (err: any) => {
      toast({ 
        title: "Failed to add player", 
        description: err.message || "Player may already be in watchlist",
        variant: "destructive" 
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (playerId: string) => {
      return apiRequest("DELETE", `/api/watchlist/${playerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Player removed from watchlist" });
    },
    onError: () => {
      toast({ title: "Failed to remove player", variant: "destructive" });
    },
  });

  const { data: playersData, isLoading: playersLoading } = useQuery<{ players: any[] }>({
    queryKey: ["/api/fantasy/players-search", playerSearch],
    queryFn: async () => {
      if (!playerSearch || playerSearch.length < 2) return { players: [] };
      const res = await fetch(`/api/fantasy/players?search=${encodeURIComponent(playerSearch)}&limit=10`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to search players");
      return res.json();
    },
    enabled: playerSearch.length >= 2,
  });

  const filteredWatchlist = data?.watchlist?.filter(item =>
    item.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.team?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getValueChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getValueChangeColor = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (watchlistError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Failed to load watchlist. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Watchlist">
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-watchlist-title">
            <Eye className="h-6 w-6" />
            Watchlist
          </h2>
          <p className="text-muted-foreground">
            Track player values and monitor targets
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredWatchlist.length > 0 && (
            <ExportButton
              data={filteredWatchlist.map((item) => ({
                Name: item.playerName,
                Position: item.position,
                Team: item.team || "FA",
                "Dynasty Value": item.currentValue,
                Notes: item.notes || "",
              }))}
              filename="watchlist"
              shareText={formatWatchlistForShare(filteredWatchlist)}
            />
          )}
          <Button onClick={() => setAddDialogOpen(true)} data-testid="btn-add-player">
            <Plus className="h-4 w-4 mr-2" />
            Add Player
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {filteredWatchlist.length > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Players</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredWatchlist.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Rising</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {filteredWatchlist.filter(p => p.valueChange > 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Falling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {filteredWatchlist.filter(p => p.valueChange < 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Avg Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredWatchlist.length > 0 
                  ? Math.round(filteredWatchlist.reduce((sum, p) => sum + p.currentValue, 0) / filteredWatchlist.length)
                  : 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-watchlist"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredWatchlist.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No players in watchlist</h3>
              <p className="text-muted-foreground mb-4">
                Add players to track their dynasty value over time
              </p>
              <Button onClick={() => setAddDialogOpen(true)} data-testid="btn-add-first-player">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Player
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">Pos</TableHead>
                    <TableHead className="text-center">Team</TableHead>
                    <TableHead className="text-right">
                      <MetricTooltip metric="dynastyValue">Added Value</MetricTooltip>
                    </TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">
                      <MetricTooltip metric="valueChange">Change</MetricTooltip>
                    </TableHead>
                    <TableHead className="text-center">Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWatchlist.map((item) => (
                    <TableRow key={item.id} data-testid={`row-watchlist-${item.playerId}`}>
                      <TableCell className="font-medium">{item.playerName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getPositionColorClass(item.position)}>
                          {item.position}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {item.team || "FA"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.valueAtAdd}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {item.currentValue}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`flex items-center justify-end gap-1 ${getValueChangeColor(item.valueChange)}`}>
                          {getValueChangeIcon(item.valueChange)}
                          <span className="font-mono">
                            {item.valueChange > 0 ? "+" : ""}{item.valueChange}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.notes ? (
                          <div className="flex items-center justify-center" title={item.notes}>
                            <StickyNote className="h-4 w-4 text-muted-foreground cursor-help" />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMutation.mutate(item.playerId)}
                          disabled={removeMutation.isPending}
                          data-testid={`btn-remove-${item.playerId}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Player Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Player to Watchlist</DialogTitle>
            <DialogDescription>
              Search for a player to track their dynasty value
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-add-player"
              />
            </div>

            {playerSearch.length >= 2 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {playersLoading ? (
                  <div className="p-4">
                    <Skeleton className="h-8" />
                  </div>
                ) : playersData?.players?.length ? (
                  <div className="divide-y">
                    {playersData.players.map((player: any) => (
                      <button
                        key={player.id}
                        className={`w-full p-3 text-left hover:bg-muted/50 flex items-center justify-between ${
                          selectedPlayer?.id === player.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => setSelectedPlayer(player)}
                        data-testid={`btn-select-${player.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getPositionColorClass(player.position)}>
                            {player.position}
                          </Badge>
                          <span className="font-medium">{player.name}</span>
                          <span className="text-muted-foreground text-sm">{player.team}</span>
                        </div>
                        <span className="text-sm font-mono">{player.dynastyValue.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No players found
                  </div>
                )}
              </div>
            )}

            {selectedPlayer && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={getPositionColorClass(selectedPlayer.position)}>
                    {selectedPlayer.position}
                  </Badge>
                  <span className="font-medium">{selectedPlayer.name}</span>
                  <span className="text-muted-foreground">{selectedPlayer.team}</span>
                </div>
                <Input
                  placeholder="Add notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-notes"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedPlayer && addMutation.mutate({ playerId: selectedPlayer.id, notes })}
              disabled={!selectedPlayer || addMutation.isPending}
              data-testid="btn-confirm-add"
            >
              {addMutation.isPending ? "Adding..." : "Add to Watchlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PremiumGate>
  );
}