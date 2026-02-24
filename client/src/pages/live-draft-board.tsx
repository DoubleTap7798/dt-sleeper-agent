import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Button } from "@/components/ui/button";
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
  ArrowRight,
  Crown,
  Shield,
  Sparkles,
  Users,
  Baby,
  UserCheck,
  AlertTriangle,
  Crosshair,
  Anchor,
  Gem,
  BarChart3,
  Layers,
  Flame,
  ChevronDown,
  ChevronUp,
  Info,
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
  compositeScore?: number;
  reason: string;
  college?: string;
  tier?: string;
  badge?: string;
  badgeColor?: string;
  strategicReason?: string;
  rosterImpact?: string;
  dynastyFit?: string;
  riskProfile?: string;
  alternativePath?: string | null;
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

type PlayerPoolType = "all" | "veterans" | "rookies";

interface DraftCommandData {
  status: "none" | "pre_draft" | "in_progress" | "complete";
  draftType: string;
  isRookieDraft?: boolean;
  playerPool?: PlayerPoolType;
  autoDetectedPool?: PlayerPoolType;
  effectiveLeagueId?: string;
  activeDraftLeagueName?: string;
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
    dynastyWindow?: string;
    dynastyWindowLabel?: string;
    currentRound?: number;
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

const POS_BG: Record<string, string> = {
  QB: "bg-red-500/20",
  RB: "bg-emerald-500/20",
  WR: "bg-blue-500/20",
  TE: "bg-amber-500/20",
  K: "bg-purple-500/20",
  DEF: "bg-gray-500/20",
  LB: "bg-orange-500/20",
  DL: "bg-rose-500/20",
  CB: "bg-cyan-500/20",
  S: "bg-violet-500/20",
  EDGE: "bg-pink-500/20",
};

const NEED_COLORS: Record<string, string> = {
  Critical: "text-red-400",
  High: "text-amber-400",
  Moderate: "text-emerald-400",
  Low: "text-muted-foreground",
};

const NEED_BG: Record<string, string> = {
  Critical: "bg-red-500/10 border-red-500/20",
  High: "bg-amber-500/10 border-amber-500/20",
  Moderate: "bg-emerald-500/10 border-emerald-500/20",
  Low: "bg-muted/30 border-border",
};

const TIER_COLORS: Record<string, string> = {
  Elite: "text-yellow-400",
  Premium: "text-amber-400",
  Solid: "text-green-400",
  Upside: "text-blue-400",
  Depth: "text-muted-foreground",
  Flier: "text-zinc-500",
};

const TIER_ICONS: Record<string, typeof Crown> = {
  Elite: Crown,
  Premium: Sparkles,
  Solid: Shield,
};

const BADGE_STYLES: Record<string, { className: string; icon: typeof Crown }> = {
  "Win Now Anchor": { className: "text-amber-400 bg-amber-400/10 border-amber-400/30", icon: Anchor },
  "Rebuild Cornerstone": { className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: Gem },
  "Scarcity Play": { className: "text-red-400 bg-red-400/10 border-red-400/30", icon: Crosshair },
  "Tier Break Risk": { className: "text-red-400 bg-red-400/10 border-red-400/30", icon: AlertTriangle },
  "Value vs ADP": { className: "text-blue-400 bg-blue-400/10 border-blue-400/30", icon: BarChart3 },
  "Depth Stabilizer": { className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: Layers },
  "High Variance Bet": { className: "text-violet-400 bg-violet-400/10 border-violet-400/30", icon: Flame },
};

const RISK_STYLES: Record<string, string> = {
  Low: "text-emerald-400",
  Medium: "text-amber-400",
  High: "text-red-400",
};

const WINDOW_STYLES: Record<string, { className: string; icon: typeof Crown }> = {
  win_now: { className: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: Crown },
  balanced: { className: "text-blue-400 border-blue-400/30 bg-blue-400/10", icon: BarChart3 },
  productive_struggle: { className: "text-violet-400 border-violet-400/30 bg-violet-400/10", icon: TrendingUp },
  rebuild: { className: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", icon: Gem },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pre_draft: { label: "Pre-Draft", className: "text-muted-foreground border-muted-foreground/30" },
  in_progress: { label: "LIVE", className: "text-emerald-400 border-emerald-400/50 bg-emerald-400/10 shadow-[0_0_12px_rgba(52,211,153,0.15)]" },
  complete: { label: "Complete", className: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  none: { label: "No Draft", className: "text-muted-foreground" },
};

const POOL_OPTIONS: Array<{ value: PlayerPoolType; label: string; icon: typeof Users; description: string }> = [
  { value: "all", label: "All Players", icon: Users, description: "Veterans + Rookies" },
  { value: "veterans", label: "Veterans Only", icon: UserCheck, description: "No rookies in pool" },
  { value: "rookies", label: "Rookies Only", icon: Baby, description: "No veterans in pool" },
];

function RecommendationCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const badgeStyle = BADGE_STYLES[rec.badge || ""] || BADGE_STYLES["Value vs ADP"];
  const BadgeIcon = badgeStyle.icon;
  const TierIcon = TIER_ICONS[rec.tier || ""] || null;

  return (
    <div
      className="rounded-xl border border-border/40 bg-muted/5 hover-elevate overflow-hidden"
      data-testid={`row-recommendation-${rec.playerId}`}
    >
      <div
        className="flex items-start gap-3 p-3.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`btn-expand-rec-${rec.playerId}`}
      >
        <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
          rank === 1 ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground"
        }`}>
          {rank}
        </div>
        <Badge variant="outline" className={`text-xs shrink-0 font-semibold ${POS_COLORS[rec.position] || ""}`}>
          {rec.position}
        </Badge>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold">{rec.name}</p>
            {rec.badge && (
              <Badge variant="outline" className={`text-[10px] font-semibold gap-1 ${badgeStyle.className}`}>
                <BadgeIcon className="h-2.5 w-2.5" />
                {rec.badge}
              </Badge>
            )}
          </div>
          {rec.college && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <GraduationCap className="h-3 w-3 shrink-0" />
              <span>{rec.college}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground/80 leading-relaxed">{rec.strategicReason || rec.reason}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-sm font-mono font-bold text-primary tabular-nums">{rec.value?.toLocaleString()}</p>
          {rec.tier && (
            <div className={`flex items-center gap-0.5 justify-end ${TIER_COLORS[rec.tier] || "text-muted-foreground"}`}>
              {TierIcon && <TierIcon className="h-3 w-3" />}
              <span className="text-[10px] font-semibold">{rec.tier}</span>
            </div>
          )}
          {rec.riskProfile && (
            <div className={`text-[10px] font-semibold ${RISK_STYLES[rec.riskProfile] || "text-muted-foreground"}`}>
              {rec.riskProfile} Risk
            </div>
          )}
          <div className="flex items-center justify-end mt-0.5">
            {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 px-3.5 pb-3.5 pt-2.5 space-y-2 bg-muted/10" data-testid={`rec-details-${rec.playerId}`}>
          {rec.rosterImpact && (
            <div className="flex items-start gap-2">
              <Target className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Roster Impact</span>
                <p className="text-xs text-foreground/80">{rec.rosterImpact}</p>
              </div>
            </div>
          )}
          {rec.dynastyFit && (
            <div className="flex items-start gap-2">
              <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dynasty Fit</span>
                <p className="text-xs text-foreground/80">{rec.dynastyFit}</p>
              </div>
            </div>
          )}
          {rec.alternativePath && (
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 text-amber-400/70 shrink-0" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-semibold">Alternative</span>
                <p className="text-xs text-amber-400/60">{rec.alternativePath}</p>
              </div>
            </div>
          )}
          {rec.compositeScore !== undefined && (
            <div className="flex items-center justify-end gap-1 pt-1">
              <span className="text-[10px] text-muted-foreground">Composite Score:</span>
              <span className="text-xs font-mono font-bold text-primary">{rec.compositeScore}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LiveDraftBoardPage() {
  usePageTitle("Draft Command Center");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [activeTab, setActiveTab] = useState("board");
  const [playerPool, setPlayerPool] = useState<PlayerPoolType | null>(null);

  const draftUrl = playerPool
    ? `/api/fantasy/draft-command/${leagueId}?playerPool=${playerPool}`
    : `/api/fantasy/draft-command/${leagueId}`;

  const { data, isLoading } = useQuery<DraftCommandData>({
    queryKey: [draftUrl],
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
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
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

  const totalPicks = board.totalRounds * board.totalTeams;
  const madeCount = board.picks.length;
  const progressPct = totalPicks > 0 ? Math.round((madeCount / totalPicks) * 100) : 0;

  return (
    <PremiumGate featureName="Draft Command Center">
      <div className="p-4 md:p-6 space-y-5 max-w-full mx-auto">
        <PageHeader
          title="Draft Command Center"
          subtitle={`${board.totalRounds} rounds \u00b7 ${board.totalTeams} teams \u00b7 ${data.draftType} draft`}
          icon={<LayoutGrid className="h-6 w-6 text-primary" />}
          actions={
            <div className="flex items-center gap-3">
              {data.status === "in_progress" && (
                <div className="flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium hidden sm:inline">Live</span>
                </div>
              )}
              <Badge variant="outline" className={`text-xs font-semibold ${statusConfig.className}`} data-testid="badge-draft-status">
                {data.status === "in_progress" && <Zap className="h-3 w-3 mr-1" />}
                {statusConfig.label}
              </Badge>
            </div>
          }
        />

        {data.activeDraftLeagueName && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20" data-testid="banner-cross-league-draft">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-primary">
              Showing active draft from <span className="font-semibold">{data.activeDraftLeagueName}</span>
            </span>
          </div>
        )}

        {(data.status === "in_progress" || data.status === "complete") && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">
              {madeCount}/{totalPicks} picks
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap" data-testid="player-pool-toggle">
          <span className="text-xs text-muted-foreground font-medium mr-1">Player Pool:</span>
          {POOL_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const activePool = data.playerPool || data.autoDetectedPool || "all";
            const isActive = playerPool === opt.value || (!playerPool && activePool === opt.value);
            return (
              <Button
                key={opt.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setPlayerPool(opt.value)}
                className={`text-xs gap-1.5 ${isActive ? "" : "text-muted-foreground"}`}
                data-testid={`btn-pool-${opt.value}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.value === "all" ? "All" : opt.value === "veterans" ? "Vets" : "Rooks"}</span>
              </Button>
            );
          })}
          {playerPool && playerPool !== (data.autoDetectedPool || "all") && (
            <span className="text-[10px] text-muted-foreground/60 ml-1">(auto: {data.autoDetectedPool})</span>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/40 backdrop-blur-sm" data-testid="draft-tabs">
            <TabsTrigger value="board" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-board">
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </TabsTrigger>
            <TabsTrigger value="assistant" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-assistant">
              <Brain className="h-3.5 w-3.5" />
              Assistant
            </TabsTrigger>
            <TabsTrigger value="predictions" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-predictions">
              <Target className="h-3.5 w-3.5" />
              My Picks
            </TabsTrigger>
          </TabsList>

          {/* BOARD TAB */}
          <TabsContent value="board" className="mt-4">
            {teams.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">
                <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Draft board data not yet available.</p>
                <p className="text-xs mt-1 opacity-70">Waiting for rosters to be set.</p>
              </CardContent></Card>
            ) : (<>
            <p className="text-xs text-muted-foreground md:hidden mb-2 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Scroll horizontally to see all teams
            </p>
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="pt-4 pb-2 overflow-x-auto -mx-2 px-2">
                <div className="min-w-max">
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `48px repeat(${teams.length}, minmax(120px, 1fr))` }}
                  >
                    <div className="p-2 text-xs font-medium text-muted-foreground sticky left-0 bg-card z-10" />
                    {teams.map((team, idx) => (
                      <div
                        key={idx}
                        className="p-2 text-center border-b border-border/40"
                        data-testid={`header-team-${idx}`}
                      >
                        <Avatar className="h-7 w-7 mx-auto mb-1 ring-1 ring-border/30">
                          <AvatarImage src={team.avatar || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted">{team.name[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-[11px] font-medium truncate max-w-[110px] mx-auto leading-tight">{team.name}</p>
                      </div>
                    ))}

                    {Array.from({ length: board.totalRounds }).map((_, roundIdx) => {
                      const round = roundIdx + 1;
                      return (
                        <div key={round} className="contents">
                          <div className="p-2 flex items-center justify-center text-xs font-mono text-muted-foreground border-r border-border/30 sticky left-0 bg-card z-10">
                            R{round}
                          </div>
                          {teams.map((team) => {
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
                                className={`p-1 border border-border/20 min-h-[60px] flex flex-col items-center justify-center relative transition-all duration-200 ${
                                  isCurrent
                                    ? "ring-2 ring-primary/70 bg-primary/10"
                                    : pick
                                      ? `${POS_BG[pick.position] || "bg-muted/10"}`
                                      : ""
                                }`}
                                data-testid={`cell-pick-${round}-${slot}`}
                              >
                                {traded && (
                                  <div className="absolute top-0 left-0 right-0 bg-primary/20 text-primary text-[8px] font-semibold truncate px-1 py-px text-center backdrop-blur-sm" data-testid={`traded-${round}-${slot}`}>
                                    <ArrowRight className="h-2 w-2 inline mr-0.5" />{traded.newOwnerName}
                                  </div>
                                )}
                                {pick ? (
                                  <div className={`text-center w-full ${traded ? "mt-2.5" : ""}`}>
                                    <p className="text-[10px] font-semibold truncate leading-tight">{pick.playerName}</p>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] mt-0.5 px-1.5 ${POS_COLORS[pick.position] || ""}`}
                                      data-testid={`badge-position-${round}-${slot}`}
                                    >
                                      {pick.position}
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className={`text-[10px] text-muted-foreground/30 font-mono ${traded ? "mt-2.5" : ""}`}>{overall}</span>
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
          <TabsContent value="assistant" className="mt-4 space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              {assistant.dynastyWindow && (
                <div className="flex items-center gap-2" data-testid="dynasty-window-badge">
                  {(() => {
                    const ws = WINDOW_STYLES[assistant.dynastyWindow] || WINDOW_STYLES.balanced;
                    const WIcon = ws.icon;
                    return (
                      <Badge variant="outline" className={`text-xs font-semibold gap-1 ${ws.className}`}>
                        <WIcon className="h-3 w-3" />
                        {assistant.dynastyWindowLabel || assistant.dynastyWindow}
                      </Badge>
                    );
                  })()}
                  {assistant.currentRound && (
                    <span className="text-xs text-muted-foreground font-mono">Round {assistant.currentRound}</span>
                  )}
                </div>
              )}
              {assistant.myPicks.length > 0 && (
                <Badge variant="secondary" className="text-[10px] font-mono ml-auto">
                  Next: R{assistant.myPicks[0].round}.{assistant.myPicks[0].pick}
                </Badge>
              )}
            </div>

            <Card data-testid="card-roster-needs" className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 tracking-wide uppercase text-muted-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Roster Needs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.entries(assistant.rosterNeeds).map(([pos, need]) => (
                    <div
                      key={pos}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${NEED_BG[need] || "bg-muted/20 border-border"}`}
                      data-testid={`roster-need-${pos}`}
                    >
                      <Badge variant="outline" className={`text-xs font-semibold ${POS_COLORS[pos] || ""}`}>
                        {pos}
                      </Badge>
                      <span className={`text-xs font-bold ${NEED_COLORS[need] || "text-muted-foreground"}`}>
                        {need}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-recommendations" className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 tracking-wide uppercase text-muted-foreground">
                  <Brain className="h-4 w-4 text-primary" />
                  Strategic Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assistant.recommendations.length === 0 ? (
                  <div className="py-6 text-center">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-muted-foreground">No recommendations available yet.</p>
                  </div>
                ) : (
                  assistant.recommendations.map((rec, idx) => (
                    <RecommendationCard key={rec.playerId} rec={rec} rank={idx + 1} />
                  ))
                )}
              </CardContent>
            </Card>

            {assistant.myPicks.length > 0 && (
              <Card data-testid="card-upcoming-picks" className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm tracking-wide uppercase text-muted-foreground">Remaining Picks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {assistant.myPicks.map((pick, idx) => (
                      <Badge
                        key={pick.overall}
                        variant="outline"
                        className={`text-xs font-mono tabular-nums ${
                          idx === 0 ? "border-primary/40 text-primary bg-primary/5" : ""
                        }`}
                        data-testid={`badge-pick-${pick.overall}`}
                      >
                        R{pick.round}.{pick.pick}
                        <span className="text-muted-foreground/60 ml-1">#{pick.overall}</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PREDICTIONS TAB */}
          <TabsContent value="predictions" className="mt-4 space-y-5">
            {assistant.myPicks.length === 0 && (assistant.mySelections?.length || 0) === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Target className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No picks assigned to you for this draft.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {assistant.mySelections && assistant.mySelections.length > 0 && (
                  <Card data-testid="card-completed-picks" className="border-emerald-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 tracking-wide uppercase text-emerald-400">
                        <CheckCircle className="h-4 w-4" />
                        Completed Picks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {assistant.mySelections.map((sel) => (
                        <div
                          key={sel.playerId}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-emerald-500/15 bg-emerald-500/5"
                          data-testid={`completed-pick-${sel.playerId}`}
                        >
                          <span className="text-xs text-muted-foreground font-mono tabular-nums w-12">
                            R{sel.round}.{sel.pick}
                          </span>
                          <Badge variant="outline" className={`text-xs font-semibold ${POS_COLORS[sel.position] || ""}`}>
                            {sel.position}
                          </Badge>
                          <span className="text-sm font-bold">{sel.playerName}</span>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 ml-auto shrink-0" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {assistant.predictions && assistant.predictions.map((pred) => (
                  <Card key={`${pred.round}-${pred.pick}`} className="border-border/60 overflow-hidden" data-testid={`card-prediction-${pred.round}-${pred.pick}`}>
                    <CardHeader className="pb-2 bg-muted/5">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold">
                          Round {pred.round}, Pick {pred.pick}
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-mono tabular-nums">
                          #{pred.overall}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-3">
                      {pred.likelyAvailable.length === 0 ? (
                        <div className="py-4 text-center">
                          <p className="text-xs text-muted-foreground">Projected available players will appear as the draft progresses.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Projected Available</p>
                          {pred.likelyAvailable.map((prospect, pIdx) => {
                            const TierIcon = TIER_ICONS[prospect.tier] || null;
                            return (
                              <div
                                key={prospect.id}
                                className="group flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-muted/5 hover-elevate"
                                data-testid={`row-prospect-${prospect.id}`}
                              >
                                <div className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0 ${
                                  pIdx === 0 ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground"
                                }`}>
                                  {prospect.rank}
                                </div>
                                <Badge variant="outline" className={`text-[10px] font-semibold ${POS_COLORS[prospect.position] || ""}`}>
                                  {prospect.position}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate">{prospect.name}</p>
                                  {prospect.college && (
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <GraduationCap className="h-3 w-3 shrink-0" />
                                      <span>{prospect.college}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-mono font-bold tabular-nums">{prospect.value?.toLocaleString()}</p>
                                  {prospect.tier && (
                                    <div className={`flex items-center gap-0.5 justify-end ${TIER_COLORS[prospect.tier] || "text-muted-foreground"}`}>
                                      {TierIcon && <TierIcon className="h-2.5 w-2.5" />}
                                      <span className="text-[9px] font-semibold">{prospect.tier}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
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
