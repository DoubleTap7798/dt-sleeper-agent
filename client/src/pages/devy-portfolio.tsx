import { useState, useMemo } from "react";
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
import { Briefcase, Plus, ChevronRight, TrendingUp, TrendingDown, Sparkles, Zap, AlertTriangle, Trash2, UserPlus, Pencil, Target, Shield, BarChart3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { useSelectedLeague } from "./league-layout";
import { calculateDVI } from "./devy-rankings";
import type { DevyPlayer, DevyData, DevyComp } from "./devy-rankings";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";

interface ManualEntry {
  id: string;
  userId: string;
  playerName: string;
  position: string;
  school: string | null;
  leagueId: string | null;
  leagueName: string | null;
  notes: string | null;
  createdAt: string;
}

export default function DevyPortfolioPage() {
  usePageTitle("My Devy Portfolio");
  const { toast } = useToast();
  const { league: selectedLeague, isLoading: leagueLoading } = useSelectedLeague();
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [selectedUnmatched, setSelectedUnmatched] = useState<{ name: string; position: string; school: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ playerName: "", position: "QB", school: "", notes: "" });

  const { data: devyData, isLoading: devyLoading } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: myDevyData, isLoading: myDevyLoading } = useQuery<{
    ownedDevy: Array<{ devyPlayerId: string; devyName: string; devyPosition: string; devySchool: string; leagueId: string | null; leagueName: string | null; matched: boolean; manualEntryId: string }>;
    leagues: Array<{ id: string; name: string }>;
    manualEntries: ManualEntry[];
  }>({
    queryKey: ["/api/sleeper/devy/my-players"],
    ...CACHE_TIMES.STABLE,
  });

  const addMutation = useMutation({
    mutationFn: async (data: { playerName: string; position: string; school: string; notes: string; leagueId: string; leagueName: string }) => {
      return apiRequest("POST", "/api/sleeper/devy/my-players", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sleeper/devy/my-players"] });
      setAddDialogOpen(false);
      setNewPlayer({ playerName: "", position: "QB", school: "", notes: "" });
      toast({ title: "Player added to your devy portfolio" });
    },
    onError: (error: any) => {
      let message = "Failed to add player";
      try {
        const errorText = error?.message || "";
        const jsonStart = errorText.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(errorText.substring(jsonStart));
          message = parsed.message || message;
        }
      } catch {}
      toast({ title: message, variant: "destructive" });
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

  if (devyLoading || myDevyLoading || leagueLoading) {
    return <PortfolioSkeleton />;
  }

  const players = devyData?.players || [];
  const isAllLeagues = !selectedLeague;
  const activeLeagueId = selectedLeague?.league_id || null;
  const activeLeagueName = selectedLeague?.name || "All Leagues";

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

  const allOwnedDevy = myDevyData?.ownedDevy || [];
  const filteredOwnedDevy = isAllLeagues
    ? allOwnedDevy
    : allOwnedDevy.filter(d => d.leagueId === activeLeagueId);

  const ownedIds = new Set(filteredOwnedDevy.map(d => d.devyPlayerId));

  const matchedPlayers = players.filter(p => {
    return ownedIds.has(p.playerId) ||
      filteredOwnedDevy.some(d => fuzzyNameMatch(d.devyName, p.name));
  });

  const unmatchedDevy = filteredOwnedDevy.filter(d => {
    if (d.matched) return false;
    return !players.some(p => p.playerId === d.devyPlayerId || fuzzyNameMatch(d.devyName, p.name));
  });

  const getOwnedLeagues = (playerId: string, playerName: string): string[] => {
    const source = isAllLeagues ? allOwnedDevy : filteredOwnedDevy;
    const seen = new Set<string>();
    const results: string[] = [];
    for (const d of source) {
      if (d.devyPlayerId === playerId || fuzzyNameMatch(d.devyName, playerName)) {
        if (d.leagueName && !seen.has(d.leagueName)) {
          seen.add(d.leagueName);
          results.push(d.leagueName);
        }
      }
    }
    return results;
  };

  const allManualEntries = myDevyData?.manualEntries || [];
  const manualEntries = isAllLeagues
    ? allManualEntries
    : allManualEntries.filter(e => e.leagueId === activeLeagueId);

  const totalValue = matchedPlayers.reduce((sum, p) => sum + (p.value || 0), 0);
  const avgDvi = matchedPlayers.length > 0 ? Math.round(matchedPlayers.reduce((sum, p) => sum + (calculateDVI(p) || 0), 0) / matchedPlayers.length) : 0;
  const posCounts: Record<string, number> = {};
  matchedPlayers.forEach(p => { posCounts[p.position] = (posCounts[p.position] || 0) + 1; });
  unmatchedDevy.forEach(d => { posCounts[d.devyPosition] = (posCounts[d.devyPosition] || 0) + 1; });
  const avgElite = matchedPlayers.length > 0 ? matchedPlayers.reduce((sum, p) => sum + (p.elitePct || 0), 0) / matchedPlayers.length : 0;
  const avgBust = matchedPlayers.length > 0 ? matchedPlayers.reduce((sum, p) => sum + (p.bustPct || 0), 0) / matchedPlayers.length : 0;
  const portfolioHealth = Math.round(Math.min(100, Math.max(0, avgElite - avgBust)));

  const totalCount = matchedPlayers.length + unmatchedDevy.length;

  const totalDevyEV = useMemo(() => {
    return matchedPlayers.reduce((sum, p) => {
      const val = p.value || 0;
      const ev = ((p.elitePct || 0) / 100) * val * 1.5 + ((p.starterPct || 0) / 100) * val + ((p.bustPct || 0) / 100) * val * 0.2;
      return sum + ev;
    }, 0);
  }, [matchedPlayers]);

  const posExposureData = useMemo(() => {
    const positions = ["QB", "RB", "WR", "TE"];
    return positions.map(pos => ({
      position: pos,
      count: posCounts[pos] || 0,
      pct: totalCount > 0 ? Math.round(((posCounts[pos] || 0) / totalCount) * 100) : 0,
    }));
  }, [posCounts, totalCount]);

  const currentYear = new Date().getFullYear();
  const yearExposureData = useMemo(() => {
    const yearCounts: Record<number, number> = {};
    matchedPlayers.forEach(p => { yearCounts[p.draftEligibleYear] = (yearCounts[p.draftEligibleYear] || 0) + 1; });
    return Object.entries(yearCounts)
      .map(([yr, count]) => ({
        year: Number(yr) === currentYear ? `${yr} Draft` : `${yr} Devy`,
        count,
        pct: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      }))
      .sort((a, b) => Number(a.year.slice(0, 4)) - Number(b.year.slice(0, 4)));
  }, [matchedPlayers, totalCount]);

  const avgDraftCapital = useMemo(() => {
    if (matchedPlayers.length === 0) return "N/A";
    const avgR1 = matchedPlayers.reduce((s, p) => s + (p.roundProbabilities?.r1 || p.round1Pct || 0), 0) / matchedPlayers.length;
    if (avgR1 >= 50) return "Round 1";
    const avgDay2 = matchedPlayers.reduce((s, p) => s + (p.roundProbabilities?.r2 || 0) + (p.roundProbabilities?.r3 || 0), 0) / matchedPlayers.length;
    if (avgR1 + avgDay2 >= 50) return "Day 2";
    return "Day 3";
  }, [matchedPlayers]);

  const bustExposure = useMemo(() => {
    if (matchedPlayers.length === 0) return 0;
    return Math.round(matchedPlayers.reduce((s, p) => s + p.bustPct, 0) / matchedPlayers.length);
  }, [matchedPlayers]);

  const volatilityScore = useMemo(() => {
    if (matchedPlayers.length === 0) return 0;
    const dviValues = matchedPlayers.map(p => calculateDVI(p) || 0);
    const mean = dviValues.reduce((s, v) => s + v, 0) / dviValues.length;
    const variance = dviValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dviValues.length;
    const result = Math.round(Math.min(100, Math.sqrt(variance) * 3));
    return isNaN(result) ? 0 : result;
  }, [matchedPlayers]);

  const radarData = useMemo(() => {
    if (matchedPlayers.length === 0) return [];
    const posBalance = (() => {
      const counts = posExposureData.map(p => p.count);
      const ideal = totalCount / 4;
      if (ideal <= 0) return 50;
      const deviation = counts.reduce((s, c) => s + Math.abs(c - ideal), 0) / (4 * ideal);
      const result = Math.round(Math.max(0, Math.min(100, (1 - deviation) * 100)));
      return isNaN(result) ? 50 : result;
    })();
    const draftCapitalScore = Math.round(matchedPlayers.reduce((s, p) => s + (p.roundProbabilities?.r1 || p.round1Pct || 0), 0) / matchedPlayers.length) || 0;
    const breakoutScore = Math.round(matchedPlayers.reduce((s, p) => s + (p.breakoutProbability || p.elitePct || 0), 0) / matchedPlayers.length) || 0;
    const riskScore = Math.round(100 - bustExposure) || 0;
    const classDiv = (() => {
      const uniqueYears = new Set(matchedPlayers.map(p => p.draftEligibleYear)).size;
      return Math.round(Math.min(100, uniqueYears * 30));
    })();
    return [
      { axis: "Position Balance", value: posBalance },
      { axis: "Draft Capital", value: draftCapitalScore },
      { axis: "Breakout Potential", value: breakoutScore },
      { axis: "Risk Mgmt", value: riskScore },
      { axis: "Class Diversity", value: classDiv },
    ];
  }, [matchedPlayers, posExposureData, totalCount, bustExposure]);

  const posBarColors = { QB: "#ef4444", RB: "#3b82f6", WR: "#22c55e", TE: "#f59e0b" };

  const handlePlayerClick = (player: DevyPlayer) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  const handleAddPlayer = () => {
    if (!selectedLeague) return;
    addMutation.mutate({
      ...newPlayer,
      leagueId: selectedLeague.league_id,
      leagueName: selectedLeague.name,
    });
  };

  return (
    <PremiumGate featureName="Devy Portfolio">
    <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-portfolio-page">
      <div className="relative overflow-hidden rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/40 via-stone-950/80 to-stone-950/60 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-700/10 via-transparent to-transparent" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-amber-700/20 border border-amber-700/30 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-amber-100" data-testid="text-portfolio-title">
                My Devy Portfolio
              </h1>
              <p className="text-sm text-amber-200/60">
                {totalCount} prospect{totalCount !== 1 ? "s" : ""} {isAllLeagues ? "across all leagues" : `in ${activeLeagueName}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {manualEntries.length > 0 && (
              <Button variant="outline" className="gap-2" onClick={() => setManageDialogOpen(true)} data-testid="button-manage-manual">
                <Pencil className="h-4 w-4" />
                Manage ({manualEntries.length})
              </Button>
            )}
            {selectedLeague ? (
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
                      Add a prospect to your portfolio in <span className="font-semibold text-amber-400">{selectedLeague.name}</span>
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
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50">
                      <span className="text-xs text-muted-foreground">League:</span>
                      <span className="text-sm font-medium">{selectedLeague.name}</span>
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
                      onClick={handleAddPlayer}
                      disabled={!newPlayer.playerName.trim() || addMutation.isPending}
                      data-testid="button-confirm-add"
                    >
                      {addMutation.isPending ? "Adding..." : "Add to Portfolio"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button className="gap-2" disabled data-testid="button-add-devy-disabled">
                      <UserPlus className="h-4 w-4" />
                      Add Player
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Select a specific league to add devy players</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {totalCount > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="stat-total-ev">
              <CardContent className="p-4">
                <p className="text-xs text-amber-200/50 mb-1">Total Devy EV</p>
                <p className="text-2xl font-bold text-amber-100">{Math.round(totalDevyEV).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="stat-avg-dvi">
              <CardContent className="p-4">
                <p className="text-xs text-amber-200/50 mb-1">Avg DVI Score</p>
                <p className={`text-2xl font-bold ${avgDvi >= 70 ? "text-green-400" : avgDvi >= 50 ? "text-amber-400" : "text-red-400"}`}>{avgDvi}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="stat-avg-draft-capital">
              <CardContent className="p-4">
                <p className="text-xs text-amber-200/50 mb-1">Avg Draft Capital</p>
                <p className="text-lg font-bold text-amber-100">{avgDraftCapital}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="stat-bust-exposure">
              <CardContent className="p-4">
                <p className="text-xs text-amber-200/50 mb-1">Bust Exposure</p>
                <p className={`text-2xl font-bold ${bustExposure <= 15 ? "text-green-400" : bustExposure <= 30 ? "text-amber-400" : "text-red-400"}`}>{bustExposure}%</p>
              </CardContent>
            </Card>
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="stat-volatility">
              <CardContent className="p-4">
                <p className="text-xs text-amber-200/50 mb-1">Volatility Score</p>
                <p className={`text-2xl font-bold ${volatilityScore <= 30 ? "text-green-400" : volatilityScore <= 60 ? "text-amber-400" : "text-red-400"}`}>{volatilityScore}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="stat-portfolio-health">
              <CardContent className="p-4">
                <p className="text-xs text-amber-200/50 mb-1">Portfolio Health</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${portfolioHealth >= 50 ? "text-green-400" : portfolioHealth >= 25 ? "text-amber-400" : "text-red-400"}`}>{portfolioHealth}</p>
                  <div className="flex-1 h-2 rounded-full bg-amber-900/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${portfolioHealth >= 50 ? "bg-green-500" : portfolioHealth >= 25 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${portfolioHealth}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-pos-exposure">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-100">Position Exposure</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={posExposureData} barSize={32}>
                    <XAxis dataKey="position" tick={{ fontSize: 12, fill: "#d4a574" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {posExposureData.map((entry) => (
                        <Cell key={entry.position} fill={(posBarColors as any)[entry.position] || "#6b7280"} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                  {posExposureData.map(p => (
                    <span key={p.position} className="text-xs text-amber-200/50">{p.position}: {p.pct}%</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-year-exposure">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-100">Draft Year Exposure</span>
                </div>
                {yearExposureData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={yearExposureData} barSize={28}>
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#d4a574" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Bar dataKey="count" fill="#f59e0b" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">No data</div>
                )}
                <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                  {yearExposureData.map(y => (
                    <span key={y.year} className="text-xs text-amber-200/50">{y.year}: {y.pct}%</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-radar-chart">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-100">Portfolio Profile</span>
                </div>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} outerRadius="70%">
                      <PolarGrid stroke="#78350f" strokeOpacity={0.3} />
                      <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "#d4a574" }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {matchedPlayers.length > 0 && (
        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-matched-portfolio">
          <CardContent className="p-0">
            <div className="p-4 border-b border-amber-800/20">
              <h3 className="font-semibold flex items-center gap-2 text-amber-100">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Ranked Prospects ({matchedPlayers.length})
              </h3>
            </div>
            <div className="divide-y divide-amber-800/10">
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
                          <Badge className="text-[10px] bg-purple-600/80 text-purple-100 border-purple-500/40">DEV</Badge>
                          {player.ageClass === "young-breakout" && <Zap className="h-3 w-3 text-green-500" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{player.college}</span>
                          <Badge variant="outline" className={`text-[10px] ${player.playerClass === "draft" ? "border-blue-500/40 text-blue-400" : "border-purple-500/40 text-purple-400"}`}>
                            {player.playerClass === "draft" ? `${player.draftEligibleYear} Draft` : `${player.draftEligibleYear} Devy`}
                          </Badge>
                          {leagues.map((name, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className={`text-xl font-bold ${
                            calculateDVI(player) >= 80 ? "text-green-500" :
                            calculateDVI(player) >= 60 ? "text-amber-400" :
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
        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-unmatched-portfolio">
          <CardContent className="p-0">
            <div className="p-4 border-b border-amber-800/20">
              <h3 className="font-semibold flex items-center gap-2 text-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Unranked Prospects ({unmatchedDevy.length})
              </h3>
              <p className="text-xs text-amber-200/50 mt-1">These players are not yet in the rankings database</p>
            </div>
            <div className="divide-y divide-amber-800/10">
              {unmatchedDevy.map((d, i) => (
                <div
                  key={`unmatched-${i}`}
                  className="p-4 hover-elevate cursor-pointer flex items-center justify-between gap-3"
                  onClick={() => {
                    setSelectedUnmatched({ name: d.devyName, position: d.devyPosition, school: d.devySchool });
                    setModalOpen(true);
                  }}
                  data-testid={`row-unmatched-${i}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(d.devyPosition)}`}>
                      {d.devyPosition}
                    </Badge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{d.devyName}</span>
                        <Badge className="text-[10px] bg-purple-600/80 text-purple-100 border-purple-500/40">DEV</Badge>
                      </div>
                      {d.devySchool && <span className="text-xs text-muted-foreground">{d.devySchool}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.leagueName && <Badge variant="secondary" className="text-[10px]">{d.leagueName}</Badge>}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-manage-manual">
          <DialogHeader>
            <DialogTitle>Manage Devy Portfolio</DialogTitle>
            <DialogDescription>
              View and remove prospects from your portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {manualEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No entries yet.</p>
            ) : (
              manualEntries.map((entry) => (
                <div key={entry.id} className="py-3 flex items-center justify-between gap-3" data-testid={`manage-row-${entry.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(entry.position)}`}>
                      {entry.position}
                    </Badge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{entry.playerName}</span>
                        <Badge className="text-[10px] bg-purple-600/80 text-purple-100 border-purple-500/40">DEV</Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.school && <span className="text-xs text-muted-foreground">{entry.school}</span>}
                        {entry.leagueName && (
                          <Badge variant="secondary" className="text-[10px]">{entry.leagueName}</Badge>
                        )}
                      </div>
                      {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
                    </div>
                  </div>
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
              ))
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-close-manage">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {totalCount === 0 && (
        <Card className="border-amber-800/20 bg-stone-950/60">
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-amber-700/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-amber-100">No Devy Players Yet</h3>
            <p className="text-sm text-amber-200/50 mb-4">
              {isAllLeagues
                ? "Select a specific league from the sidebar, then add your devy prospects. They'll show up here across all leagues."
                : `Add your devy prospects for ${activeLeagueName}. The system will automatically attach player cards and rankings.`
              }
            </p>
            {selectedLeague ? (
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2" data-testid="button-add-first-devy">
                <Plus className="h-4 w-4" />
                Add Your First Prospect
              </Button>
            ) : (
              <p className="text-xs text-amber-200/40 mt-2">Select a league from the sidebar to get started</p>
            )}
          </CardContent>
        </Card>
      )}

      <DevyProfileModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setSelectedPlayer(null);
            setSelectedUnmatched(null);
          }
        }}
        player={selectedPlayer}
        unmatchedPlayer={selectedUnmatched}
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
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0 divide-y">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
