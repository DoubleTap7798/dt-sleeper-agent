import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutGrid,
  AlertCircle,
  Radio,
  Brain,
  Target,
  TrendingUp,
  Zap,
  GraduationCap,
  CheckCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface BoardPick {
  round: number;
  pick: number;
  draftSlot: number;
  playerId: string;
  playerName: string;
  position: string;
  teamName: string;
  teamAvatar: string | null;
  pickedBy: string;
}

interface TeamOrderEntry {
  slot: number;
  name: string;
  avatar: string | null;
  rosterId: number;
}

interface MyPick {
  round: number;
  pick: number;
  overall: number;
  slot: number;
}

interface Recommendation {
  playerId: string;
  name: string;
  position: string;
  value: number;
  reason: string;
  college?: string;
  tier?: string;
}

interface Prediction {
  round: number;
  pick: number;
  overall: number;
  likelyAvailable: Array<{
    id: string;
    name: string;
    position: string;
    college: string;
    value: number;
    tier: string;
    rank: number;
  }>;
}

interface MySelection {
  round: number;
  pick: number;
  playerName: string;
  position: string;
  playerId: string;
}

interface TradedPick {
  originalOwnerName: string;
  newOwnerName: string;
  newOwnerAvatar: string | null;
}

interface DraftCommandData {
  status: "none" | "pre_draft" | "in_progress" | "complete";
  draftType: string;
  isRookieDraft?: boolean;
  board: {
    picks: BoardPick[];
    teamOrder: TeamOrderEntry[];
    totalRounds: number;
    totalTeams: number;
    currentPick: number;
    tradedPicks?: Record<string, TradedPick>;
  };
  assistant: {
    myPicks: MyPick[];
    myDraftSlot: number;
    rosterNeeds: Record<string, string>;
    recommendations: Recommendation[];
    predictions: Prediction[];
    mySelections: MySelection[];
    posCount: Record<string, number>;
  };
}

const POS_COLORS: Record<string, string> = {
  QB: "text-red-400 bg-red-400/10 border-red-400/30",
  RB: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  WR: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  TE: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  K: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  DEF: "text-gray-400 bg-gray-400/10 border-gray-400/30",
  LB: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  DL: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  CB: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  S: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  EDGE: "text-pink-400 bg-pink-400/10 border-pink-400/30",
};

const NEED_COLORS: Record<string, string> = {
  Critical: "text-red-400",
  High: "text-amber-400",
  Moderate: "text-emerald-400",
  Low: "text-muted-foreground",
};

const TIER_COLORS: Record<string, string> = {
  Elite: "text-yellow-400",
  Premium: "text-amber-400",
  Solid: "text-green-400",
  Upside: "text-blue-400",
  Depth: "text-muted-foreground",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pre_draft: { label: "Pre-Draft", className: "text-muted-foreground" },
  in_progress: { label: "LIVE", className: "text-emerald-400 border-emerald-400/30" },
  complete: { label: "Complete", className: "text-amber-400 border-amber-400/30" },
  none: { label: "No Draft", className: "text-muted-foreground" },
};

export default function LiveDraftBoardPage() {
  usePageTitle("Draft Command Center");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [activeTab, setActiveTab] = useState("board");

  const { data, isLoading } = useQuery<DraftCommandData>({
    queryKey: ["/api/fantasy/draft-command", leagueId],
    enabled: !!leagueId,
    refetchInterval: (query) => {
      const d = query.state.data as DraftCommandData | undefined;
      return d?.status === "in_progress" ? 10000 : false;
    },
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view the draft</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-full mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!data || data.status === "none") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium" data-testid="text-no-draft">No Draft Found</p>
        <p className="text-sm mt-1">No active or upcoming draft found for this league.</p>
      </div>
    );
  }

  const statusConfig = STATUS_LABELS[data.status] || STATUS_LABELS.none;
  const { board, assistant } = data;
  const teams = board.teamOrder;

  const pickGrid: Record<string, BoardPick | undefined> = {};
  for (const pick of board.picks) {
    pickGrid[`${pick.round}-${pick.draftSlot}`] = pick;
  }

  let currentPickKey: string | null = null;
  if (data.status === "in_progress") {
    for (let r = 1; r <= board.totalRounds && !currentPickKey; r++) {
      const isReverse = data.draftType === "snake" && r % 2 === 0;
      const slots = teams.map(t => t.slot);
      const ordered = isReverse ? [...slots].reverse() : slots;
      for (const s of ordered) {
        if (!pickGrid[`${r}-${s}`]) {
          currentPickKey = `${r}-${s}`;
          break;
        }
      }
    }
  }

  return (
    <PremiumGate featureName="Draft Command Center">
      <div className="p-4 md:p-6 space-y-4 max-w-full mx-auto">
        <PageHeader
          title="Draft Command Center"
          subtitle={`${board.totalRounds} rounds | ${board.totalTeams} teams | ${data.draftType}${data.isRookieDraft ? " rookie" : ""} draft`}
          icon={<LayoutGrid className="h-6 w-6 text-primary" />}
          actions={
            <div className="flex items-center gap-2">
              {data.status === "in_progress" && (
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
              )}
              <Badge variant="outline" className={statusConfig.className} data-testid="badge-draft-status">
                {data.status === "in_progress" && <Zap className="h-3 w-3 mr-1" />}
                {statusConfig.label}
              </Badge>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3" data-testid="draft-tabs">
            <TabsTrigger value="board" className="text-xs sm:text-sm" data-testid="tab-board">
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Board
            </TabsTrigger>
            <TabsTrigger value="assistant" className="text-xs sm:text-sm" data-testid="tab-assistant">
              <Brain className="h-3.5 w-3.5 mr-1" />
              Assistant
            </TabsTrigger>
            <TabsTrigger value="predictions" className="text-xs sm:text-sm" data-testid="tab-predictions">
              <Target className="h-3.5 w-3.5 mr-1" />
              My Picks
            </TabsTrigger>
          </TabsList>

          {/* BOARD TAB */}
          <TabsContent value="board" className="mt-4">
            {teams.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                <p>Draft board data not yet available. Waiting for rosters to be set.</p>
              </CardContent></Card>
            ) : (<>
            <p className="text-xs text-muted-foreground md:hidden mb-2">Scroll horizontally to see all teams</p>
            <Card>
              <CardContent className="pt-4 overflow-x-auto -mx-2 px-2">
                <div className="min-w-max">
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `48px repeat(${teams.length}, minmax(120px, 1fr))` }}
                  >
                    <div className="p-2 text-xs font-medium text-muted-foreground sticky left-0 bg-card z-10" />
                    {teams.map((team, idx) => (
                      <div
                        key={idx}
                        className="p-2 text-center border-b border-border"
                        data-testid={`header-team-${idx}`}
                      >
                        <Avatar className="h-7 w-7 mx-auto mb-1">
                          <AvatarImage src={team.avatar || undefined} />
                          <AvatarFallback className="text-[10px]">{team.name[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-medium truncate max-w-[110px] mx-auto">{team.name}</p>
                      </div>
                    ))}

                    {Array.from({ length: board.totalRounds }).map((_, roundIdx) => {
                      const round = roundIdx + 1;
                      return (
                        <div key={round} className="contents">
                          <div className="p-2 flex items-center justify-center text-xs font-mono text-muted-foreground border-r border-border sticky left-0 bg-card z-10">
                            R{round}
                          </div>
                          {teams.map((team, teamIdx) => {
                            const slot = team.slot;
                            const pick = pickGrid[`${round}-${slot}`];
                            const traded = board.tradedPicks?.[`${round}-${slot}`];
                            const isSnake = data.draftType === "snake";
                            const displaySlot = isSnake && round % 2 === 0 ? board.totalTeams - slot + 1 : slot;
                            const overall = (round - 1) * board.totalTeams + displaySlot;
                            const isCurrent = currentPickKey === `${round}-${slot}`;

                            return (
                              <div
                                key={`${round}-${slot}`}
                                className={`p-1 border border-border/50 min-h-[60px] flex flex-col items-center justify-center relative ${
                                  isCurrent ? "ring-2 ring-primary bg-primary/5" : ""
                                }`}
                                data-testid={`cell-pick-${round}-${slot}`}
                              >
                                {traded && (
                                  <div className="absolute top-0 left-0 right-0 bg-primary/15 text-primary text-[8px] font-medium truncate px-1 py-px text-center" data-testid={`traded-${round}-${slot}`}>
                                    &rarr;{traded.newOwnerName}
                                  </div>
                                )}
                                {pick ? (
                                  <div className={`text-center w-full ${traded ? "mt-2" : ""}`}>
                                    <p className="text-[10px] font-medium truncate leading-tight">{pick.playerName}</p>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] mt-0.5 ${POS_COLORS[pick.position] || ""}`}
                                      data-testid={`badge-position-${round}-${slot}`}
                                    >
                                      {pick.position}
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className={`text-[10px] text-muted-foreground/40 font-mono ${traded ? "mt-2" : ""}`}>{overall}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
            </>)}
          </TabsContent>

          {/* ASSISTANT TAB */}
          <TabsContent value="assistant" className="mt-4 space-y-4">
            {/* My Selections So Far */}
            {assistant.mySelections && assistant.mySelections.length > 0 && (
              <Card data-testid="card-my-selections">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    My Selections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {assistant.mySelections.map((sel) => (
                      <div
                        key={sel.playerId}
                        className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
                        data-testid={`selection-${sel.playerId}`}
                      >
                        <span className="text-[10px] text-muted-foreground font-mono">
                          R{sel.round}.{sel.pick}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${POS_COLORS[sel.position] || ""}`}>
                          {sel.position}
                        </Badge>
                        <span className="text-xs font-medium">{sel.playerName}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Roster Needs */}
            <Card data-testid="card-roster-needs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Roster Needs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(assistant.rosterNeeds).map(([pos, need]) => (
                    <div
                      key={pos}
                      className="flex items-center justify-between p-3 rounded-md border border-border"
                      data-testid={`roster-need-${pos}`}
                    >
                      <Badge variant="outline" className={`text-xs ${POS_COLORS[pos] || ""}`}>
                        {pos}
                      </Badge>
                      <span className={`text-sm font-medium ${NEED_COLORS[need] || "text-muted-foreground"}`}>
                        {need}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card data-testid="card-recommendations">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Recommendations
                  {assistant.myPicks.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal ml-auto">
                      Next: R{assistant.myPicks[0].round}, Pick {assistant.myPicks[0].pick}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assistant.recommendations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recommendations available yet.</p>
                ) : (
                  assistant.recommendations.map((rec, idx) => (
                    <div
                      key={rec.playerId}
                      className="flex items-start gap-3 p-3 rounded-md border border-border hover-elevate"
                      data-testid={`row-recommendation-${rec.playerId}`}
                    >
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-mono shrink-0">
                        {idx + 1}
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${POS_COLORS[rec.position] || ""}`}>
                        {rec.position}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{rec.name}</p>
                        {rec.college && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <GraduationCap className="h-3 w-3" />
                            <span>{rec.college}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono text-primary">{rec.value?.toLocaleString()}</p>
                        {rec.tier && (
                          <p className={`text-[10px] ${TIER_COLORS[rec.tier] || "text-muted-foreground"}`}>{rec.tier}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Upcoming Picks */}
            {assistant.myPicks.length > 0 && (
              <Card data-testid="card-upcoming-picks">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Remaining Picks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {assistant.myPicks.map((pick) => (
                      <Badge
                        key={pick.overall}
                        variant="outline"
                        className="text-sm"
                        data-testid={`badge-pick-${pick.overall}`}
                      >
                        R{pick.round}, Pick {pick.pick} (#{pick.overall})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PREDICTIONS TAB */}
          <TabsContent value="predictions" className="mt-4 space-y-4">
            {assistant.myPicks.length === 0 && (assistant.mySelections?.length || 0) === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No picks assigned to you for this draft.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Already drafted */}
                {assistant.mySelections && assistant.mySelections.length > 0 && (
                  <Card data-testid="card-completed-picks">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        Completed Picks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {assistant.mySelections.map((sel) => (
                        <div
                          key={sel.playerId}
                          className="flex items-center gap-3 p-2 rounded-md border border-emerald-500/20 bg-emerald-500/5"
                          data-testid={`completed-pick-${sel.playerId}`}
                        >
                          <span className="text-xs text-muted-foreground font-mono w-12">
                            R{sel.round}.{sel.pick}
                          </span>
                          <Badge variant="outline" className={`text-xs ${POS_COLORS[sel.position] || ""}`}>
                            {sel.position}
                          </Badge>
                          <span className="text-sm font-medium">{sel.playerName}</span>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 ml-auto" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Predictions for remaining picks */}
                {assistant.predictions && assistant.predictions.map((pred) => (
                  <Card key={`${pred.round}-${pred.pick}`} data-testid={`card-prediction-${pred.round}-${pred.pick}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          Round {pred.round}, Pick {pred.pick}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs font-mono">
                          #{pred.overall}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {pred.likelyAvailable.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Projected available players will appear as the draft progresses.</p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground mb-2">Projected available at this pick:</p>
                          {pred.likelyAvailable.map((prospect) => (
                            <div
                              key={prospect.id}
                              className="flex items-center gap-3 p-2 rounded-md border border-border hover-elevate"
                              data-testid={`row-prospect-${prospect.id}`}
                            >
                              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-mono shrink-0">
                                {prospect.rank}
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${POS_COLORS[prospect.position] || ""}`}>
                                {prospect.position}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{prospect.name}</p>
                                {prospect.college && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <GraduationCap className="h-3 w-3" />
                                    <span>{prospect.college}</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-mono">{prospect.value?.toLocaleString()}</p>
                                {prospect.tier && (
                                  <p className={`text-[10px] ${TIER_COLORS[prospect.tier] || "text-muted-foreground"}`}>
                                    {prospect.tier}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PremiumGate>
  );
}
