import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dices, Play, Loader2, Search, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DraftPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  dynastyValue: number;
}

interface DraftPick {
  round: number;
  pick: number;
  overall: number;
  rosterId: number;
  teamName: string;
  player: DraftPlayer | null;
  isUser: boolean;
}

interface MockDraftState {
  picks: DraftPick[];
  availablePlayers: DraftPlayer[];
  currentPick: number;
  totalPicks: number;
  userRosterId: number;
  rounds: number;
  teamsCount: number;
  isComplete: boolean;
}

const POS_COLORS: Record<string, string> = {
  QB: "text-red-400 bg-red-400/10 border-red-400/30",
  RB: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  WR: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  TE: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

export default function MockDraftPage() {
  usePageTitle("Mock Draft Simulator");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const { toast } = useToast();

  const [draftState, setDraftState] = useState<MockDraftState | null>(null);
  const [posFilter, setPosFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const startDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/fantasy/mock-draft/start/${leagueId}`);
      return res.json();
    },
    onSuccess: (data: MockDraftState) => {
      setDraftState(data);
      toast({ title: "Mock draft started!" });
    },
    onError: (err: any) => toast({ title: "Failed to start draft", description: err.message, variant: "destructive" }),
  });

  const makePick = useMutation({
    mutationFn: async (playerId: string) => {
      const res = await apiRequest("POST", `/api/fantasy/mock-draft/pick/${leagueId}`, { playerId });
      return res.json();
    },
    onSuccess: (data: MockDraftState) => {
      setDraftState(data);
    },
    onError: (err: any) => toast({ title: "Failed to make pick", description: err.message, variant: "destructive" }),
  });

  const isUserTurn = useCallback(() => {
    if (!draftState || draftState.isComplete) return false;
    const currentPick = draftState.picks[draftState.currentPick];
    return currentPick?.rosterId === draftState.userRosterId && !currentPick?.player;
  }, [draftState]);

  useEffect(() => {
    if (!draftState || draftState.isComplete || isUserTurn() || isSimulating) return;

    const currentPick = draftState.picks[draftState.currentPick];
    if (currentPick?.player) return;

    setIsSimulating(true);
    const timeout = setTimeout(() => {
      const topPlayer = draftState.availablePlayers[0];
      if (topPlayer) {
        const newPicks = [...draftState.picks];
        newPicks[draftState.currentPick] = { ...currentPick, player: topPlayer };
        const newAvailable = draftState.availablePlayers.filter((p) => p.id !== topPlayer.id);
        const nextPick = draftState.currentPick + 1;
        setDraftState({
          ...draftState,
          picks: newPicks,
          availablePlayers: newAvailable,
          currentPick: nextPick,
          isComplete: nextPick >= draftState.totalPicks,
        });
      }
      setIsSimulating(false);
    }, 800);

    return () => clearTimeout(timeout);
  }, [draftState, isUserTurn, isSimulating]);

  const handleUserPick = (playerId: string) => {
    if (!draftState || !isUserTurn()) return;

    const player = draftState.availablePlayers.find((p) => p.id === playerId);
    if (!player) return;

    const currentPick = draftState.picks[draftState.currentPick];
    const newPicks = [...draftState.picks];
    newPicks[draftState.currentPick] = { ...currentPick, player };
    const newAvailable = draftState.availablePlayers.filter((p) => p.id !== playerId);
    const nextPick = draftState.currentPick + 1;

    setDraftState({
      ...draftState,
      picks: newPicks,
      availablePlayers: newAvailable,
      currentPick: nextPick,
      isComplete: nextPick >= draftState.totalPicks,
    });

    makePick.mutate(playerId);
  };

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Dices className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to run a mock draft</p>
      </div>
    );
  }

  if (!draftState) {
    return (
      <PremiumGate featureName="Mock Draft Simulator">
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Dices className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Mock Draft Simulator</h1>
              <p className="text-sm text-muted-foreground">Practice drafts against AI opponents</p>
            </div>
          </div>
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <Dices className="h-16 w-16 mx-auto text-primary/30" />
              <p className="text-muted-foreground">Start a mock draft to practice your strategy against AI-powered opponents.</p>
              <Button
                onClick={() => startDraft.mutate()}
                disabled={startDraft.isPending}
                data-testid="button-start-draft"
              >
                {startDraft.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up draft...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Mock Draft
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PremiumGate>
    );
  }

  const filteredPlayers = draftState.availablePlayers.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const rounds: DraftPick[][] = [];
  for (let i = 0; i < draftState.rounds; i++) {
    rounds.push(
      draftState.picks.slice(i * draftState.teamsCount, (i + 1) * draftState.teamsCount)
    );
  }

  return (
    <PremiumGate featureName="Mock Draft Simulator">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Dices className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Mock Draft</h1>
              <p className="text-sm text-muted-foreground">
                {draftState.isComplete
                  ? "Draft complete!"
                  : `Pick ${draftState.currentPick + 1} of ${draftState.totalPicks}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUserTurn() && (
              <Badge variant="default" className="animate-pulse" data-testid="badge-your-turn">
                <User className="h-3 w-3 mr-1" />
                Your Pick!
              </Badge>
            )}
            {isSimulating && (
              <Badge variant="secondary" data-testid="badge-simulating">
                <Clock className="h-3 w-3 mr-1" />
                AI Picking...
              </Badge>
            )}
            {draftState.isComplete && (
              <Button
                variant="outline"
                onClick={() => {
                  setDraftState(null);
                  setPosFilter("ALL");
                  setSearchText("");
                }}
                data-testid="button-new-draft"
              >
                New Draft
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Draft Board</h2>
            {rounds.map((roundPicks, roundIdx) => (
              <Card key={roundIdx} data-testid={`card-round-${roundIdx + 1}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Round {roundIdx + 1}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {roundPicks.map((pick) => {
                      const isCurrent = pick.overall - 1 === draftState.currentPick;
                      const isUserPick = pick.isUser;
                      return (
                        <div
                          key={pick.overall}
                          className={`p-2 rounded-md border text-xs ${
                            isCurrent
                              ? "border-primary bg-primary/10"
                              : isUserPick && pick.player
                              ? "border-amber-400/30 bg-amber-400/5"
                              : "border-border"
                          }`}
                          data-testid={`pick-${pick.overall}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-muted-foreground">#{pick.overall}</span>
                            {isUserPick && (
                              <Badge variant="outline" className="text-[10px] px-1">You</Badge>
                            )}
                          </div>
                          {pick.player ? (
                            <div>
                              <p className="font-medium truncate">{pick.player.name}</p>
                              <Badge
                                variant="outline"
                                className={`text-[10px] mt-0.5 ${POS_COLORS[pick.player.position] || ""}`}
                              >
                                {pick.player.position}
                              </Badge>
                            </div>
                          ) : (
                            <p className="text-muted-foreground truncate">{pick.teamName}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Available Players</h2>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-players"
                />
              </div>
              <Select value={posFilter} onValueChange={setPosFilter}>
                <SelectTrigger data-testid="select-pos-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Positions</SelectItem>
                  <SelectItem value="QB">QB</SelectItem>
                  <SelectItem value="RB">RB</SelectItem>
                  <SelectItem value="WR">WR</SelectItem>
                  <SelectItem value="TE">TE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="max-h-[600px] overflow-y-auto">
              <CardContent className="p-0">
                {filteredPlayers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No players available
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredPlayers.slice(0, 50).map((player) => (
                      <button
                        key={player.id}
                        className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                          isUserTurn() ? "hover-elevate cursor-pointer" : "opacity-60 cursor-not-allowed"
                        }`}
                        onClick={() => isUserTurn() && handleUserPick(player.id)}
                        disabled={!isUserTurn()}
                        data-testid={`button-player-${player.id}`}
                      >
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${POS_COLORS[player.position] || ""}`}
                        >
                          {player.position}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.team}</p>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {player.dynastyValue}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PremiumGate>
  );
}
