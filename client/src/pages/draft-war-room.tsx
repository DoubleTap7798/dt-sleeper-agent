import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedLeague } from "./league-layout";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerProfileModal } from "@/components/player-profile-modal";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Zap, 
  Clock, 
  Trophy,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ArrowDown,
  Shield,
  Flame,
  Info,
  Gauge,
  Layers,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-600 text-white border-red-700",
  RB: "bg-green-600 text-white border-green-700",
  WR: "bg-blue-600 text-white border-blue-700",
  WRS: "bg-blue-500 text-white border-blue-600",
  TE: "bg-orange-500 text-white border-orange-600",
  K: "bg-yellow-600 text-white border-yellow-700",
  EDGE: "bg-rose-700 text-white border-rose-800",
  DL: "bg-amber-800 text-white border-amber-900",
  DL1T: "bg-amber-800 text-white border-amber-900",
  DL3T: "bg-amber-800 text-white border-amber-900",
  DL5T: "bg-amber-800 text-white border-amber-900",
  ILB: "bg-teal-600 text-white border-teal-700",
  LB: "bg-teal-600 text-white border-teal-700",
  CB: "bg-purple-600 text-white border-purple-700",
  S: "bg-indigo-600 text-white border-indigo-700",
};

const TAG_STYLES: Record<string, string> = {
  "High Upside": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Injury-Away Value": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Handcuff": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Scarcity Play": "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "Roster Stabilizer": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Boom/Bust Dart": "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "Elite Prospect": "bg-primary/15 text-primary border-primary/30",
};

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Impact", color: "text-primary" },
  2: { label: "Strong Role", color: "text-emerald-400" },
  3: { label: "High Upside", color: "text-cyan-400" },
  4: { label: "Lottery Ticket", color: "text-muted-foreground" },
};

const PHASE_INFO: Record<string, { label: string; strategy: string; color: string }> = {
  early: { label: "Early Rounds", strategy: "Talent Maximization", color: "text-primary" },
  mid: { label: "Mid Rounds", strategy: "Value + Structure", color: "text-emerald-400" },
  late: { label: "Late Rounds", strategy: "Leverage + Upside + Scarcity", color: "text-amber-400" },
  deep: { label: "Deep Rounds", strategy: "Pure Ceiling Plays", color: "text-rose-400" },
};

interface PlayerRecommendation {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  value: number;
  recScore?: number;
  needFit: string;
  ppg: number;
  draftRank?: number;
  college?: string;
  stockStatus?: 'rising' | 'falling' | 'steady';
  stockChange?: number;
  intangibles?: string[];
  tags?: string[];
  tier?: number;
  upsideScore?: number;
  roleProbability?: number;
  scarcity?: number;
  leverageScore?: number | null;
  explanation?: string | null;
  depthChartOrder?: number | null;
}

interface DraftBoardPick {
  pickNo: number;
  round: number;
  slot: number;
  rosterId: number;
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
  };
  isDevy?: boolean;
  originalPlayer?: string;
}

interface ValueDrop extends PlayerRecommendation {
  expectedPick: number;
  spotsFallen: number;
}

interface MyDraftPick {
  playerId: string;
  name: string;
  position: string;
  team: string;
  round: number;
  slot: number;
  pickNo: number;
}

interface TierCliff {
  position: string;
  message: string;
}

interface DraftRecommendationsResponse {
  recommendations: {
    bestValue: PlayerRecommendation[];
    bestForNeeds: PlayerRecommendation[];
    bestUpside: PlayerRecommendation[];
  };
  valueDrops: ValueDrop[];
  rosterAnalysis: {
    positionCounts: Record<string, number>;
    needs: string[];
    avgAge: number;
    profile: string;
    hasIDP?: boolean;
    idpSlotTargets?: Record<string, number>;
  };
  positionalRuns: { position: string; count: number }[];
  tierCliffs?: TierCliff[];
  currentRound?: number;
  draftPhase?: string;
  draft: {
    id: string;
    status: string;
    type: string;
    rounds: number;
    picksMade: number;
    totalPicks: number;
  } | null;
  draftBoard: DraftBoardPick[];
  myPicks: MyDraftPick[];
  mode: string;
}

function DraftPhaseIndicator({ phase, round }: { phase?: string; round?: number }) {
  if (!phase || !round) return null;
  const info = PHASE_INFO[phase] || PHASE_INFO.early;

  return (
    <Card className="border-primary/20" data-testid="card-draft-phase">
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Round {round}</div>
              <div className={`font-semibold ${info.color}`}>{info.label}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Strategy</div>
            <div className={`text-sm font-medium ${info.color}`}>{info.strategy}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeverageMeter({ player }: { player: PlayerRecommendation }) {
  const score = player.recScore || player.value;
  const maxScore = 1200;
  const pct = Math.min(100, (score / maxScore) * 100);

  const reasons: string[] = [];
  if (player.needFit === "High") reasons.push("Fills roster gap");
  if (player.upsideScore && player.upsideScore >= 80) reasons.push("Elite ceiling");
  if (player.leverageScore) reasons.push("Injury-away leverage");
  if (player.scarcity && player.scarcity >= 70) reasons.push("Scarce position");
  if (player.roleProbability && player.roleProbability >= 70) reasons.push("Locked-in role");

  const leverageLevel = pct >= 70 ? "HIGH" : pct >= 40 ? "MED" : "LOW";
  const leverageColor = pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-muted-foreground";
  const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-muted-foreground/50";

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Leverage</span>
        <span className={`text-xs font-bold ${leverageColor}`}>{leverageLevel}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reasons.map((r, i) => (
            <span key={i} className="text-[9px] text-muted-foreground/80">{i > 0 ? " | " : ""}{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerRecommendationCard({ 
  player, 
  rank, 
  isRookieMode,
  showLeverage,
  onPlayerClick,
}: { 
  player: PlayerRecommendation; 
  rank: number;
  isRookieMode?: boolean;
  showLeverage?: boolean;
  onPlayerClick?: (player: PlayerRecommendation) => void;
}) {
  const tierInfo = player.tier ? TIER_LABELS[player.tier] : null;
  const displayScore = player.recScore || Math.round(player.value);

  return (
    <div 
      className="p-3 rounded-lg bg-card/50 border border-border/50 hover-elevate space-y-2 cursor-pointer"
      data-testid={`recommendation-player-${player.playerId}`}
      onClick={() => onPlayerClick?.(player)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex-shrink-0">
          {isRookieMode && player.draftRank ? player.draftRank : rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate">{player.name}</span>
            <Badge variant="outline" className={POSITION_COLORS[player.position] || ""}>
              {player.position}
            </Badge>
            {tierInfo && (
              <span className={`text-[10px] font-semibold ${tierInfo.color}`}>T{player.tier}</span>
            )}
            {isRookieMode && player.stockStatus === 'rising' && (
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +{player.stockChange}
              </Badge>
            )}
            {isRookieMode && player.stockStatus === 'falling' && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">
                <TrendingDown className="w-3 h-3 mr-0.5" />
                -{player.stockChange}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {isRookieMode && player.college ? (
              <span>{player.college}</span>
            ) : (
              <>
                <span>{player.team}</span>
                {player.age && <span>Age {player.age}</span>}
                {player.ppg > 0 && <span>{player.ppg} PPG</span>}
              </>
            )}
            {isRookieMode && player.draftRank && (
              <span className="text-primary/70">Board #{player.draftRank}</span>
            )}
            {!isRookieMode && player.roleProbability !== undefined && (
              <span className="text-muted-foreground/70">{player.roleProbability}% Role</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-primary">{displayScore}</div>
          <div className="text-[10px] text-muted-foreground">Score</div>
        </div>
      </div>

      {player.tags && player.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {player.tags.map(tag => (
            <Badge 
              key={tag} 
              variant="outline" 
              className={`text-[10px] px-1.5 py-0 ${TAG_STYLES[tag] || "bg-muted/20 text-muted-foreground border-border/50"}`}
              data-testid={`tag-${tag.toLowerCase().replace(/[\s\/]/g, '-')}`}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {player.explanation && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80" data-testid={`text-explanation-${player.playerId}`}>
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/50" />
          <span>{player.explanation}</span>
        </div>
      )}

      {showLeverage && <LeverageMeter player={player} />}
    </div>
  );
}

function PositionRunAlert({ position, count }: { position: string; count: number }) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
      data-testid={`alert-position-run-${position}`}
    >
      <Flame className="w-5 h-5 text-yellow-400" />
      <div>
        <span className="font-medium text-yellow-400">{position} Run Detected!</span>
        <span className="text-muted-foreground ml-2">{count} {position}s taken in last 6 picks</span>
      </div>
    </div>
  );
}

function TierCliffAlert({ cliff }: { cliff: TierCliff }) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30"
      data-testid={`alert-tier-cliff-${cliff.position}`}
    >
      <Layers className="w-5 h-5 text-rose-400" />
      <div>
        <span className="font-medium text-rose-400">{cliff.message}</span>
      </div>
    </div>
  );
}

function ValueDropAlert({ player }: { player: ValueDrop }) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
      data-testid={`alert-value-drop-${player.playerId}`}
    >
      <TrendingDown className="w-5 h-5 text-green-400" />
      <div className="flex-1">
        <span className="font-medium text-green-400">{player.name}</span>
        <span className="text-muted-foreground ml-2">
          fallen {player.spotsFallen} spots - grab at {(player.recScore || player.value).toLocaleString()} value!
        </span>
      </div>
      <Badge className={POSITION_COLORS[player.position] || ""}>{player.position}</Badge>
    </div>
  );
}

function RosterBuildVisual({ analysis }: { analysis: DraftRecommendationsResponse["rosterAnalysis"] }) {
  const offensivePositions = ["QB", "RB", "WR", "TE"];
  const offensiveTargets: Record<string, number> = { QB: 2, RB: 6, WR: 8, TE: 2 };
  
  const idpPositions = analysis.hasIDP 
    ? Object.keys(analysis.idpSlotTargets || {}).filter(pos => !offensivePositions.includes(pos))
    : [];
  
  const getTarget = (pos: string): number => {
    if (offensiveTargets[pos]) return offensiveTargets[pos];
    if (analysis.idpSlotTargets?.[pos]) {
      return Math.ceil(analysis.idpSlotTargets[pos] * 1.5);
    }
    return 2;
  };
  
  const allPositions = [...offensivePositions, ...idpPositions];
  
  return (
    <Card data-testid="card-roster-build">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4" />
          Roster Build
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allPositions.map(pos => {
          const count = analysis.positionCounts[pos] || 0;
          const target = getTarget(pos);
          const pct = Math.min(100, (count / target) * 100);
          const isNeed = analysis.needs.includes(pos);
          const isIDP = idpPositions.includes(pos);
          
          return (
            <div key={pos} className="space-y-1" data-testid={`roster-position-${pos}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={`font-medium ${isNeed ? "text-yellow-400" : ""}`}>
                  {pos} {isNeed && "(Need)"}
                  {isIDP && <span className="text-muted-foreground font-normal ml-1">IDP</span>}
                </span>
                <span className="text-muted-foreground">{count}/{target}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    isNeed ? "bg-yellow-500" : isIDP ? "bg-purple-500" : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        
        <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Avg Age</div>
            <div className="font-medium" data-testid="text-avg-age">{analysis.avgAge}</div>
          </div>
          <Badge 
            variant="outline" 
            data-testid={`badge-team-profile-${analysis.profile.toLowerCase()}`}
            className={
              analysis.profile === "Contender" 
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : analysis.profile === "Rebuild"
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
            }
          >
            {analysis.profile}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DraftBoard({ picks, currentPick, onPlayerClick }: { 
  picks: DraftBoardPick[]; 
  currentPick?: number;
  onPlayerClick?: (playerId: string, name: string, position: string, team: string) => void;
}) {
  const currentPickRef = useRef<HTMLTableRowElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentPickRef.current) {
      currentPickRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentPick]);

  const handleScrollToCurrent = () => {
    if (currentPickRef.current) {
      currentPickRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (picks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-draft-board">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No picks have been made yet</p>
        <p className="text-sm">The draft board will populate as picks are made</p>
      </div>
    );
  }

  const sortedPicks = [...picks].sort((a, b) => b.pickNo - a.pickNo);

  return (
    <div className="space-y-2">
      {currentPick && (
        <div className="flex items-center justify-between px-2">
          <Badge variant="outline" className="text-primary border-primary">
            <Zap className="w-3 h-3 mr-1" />
            On the clock: Pick {currentPick}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleScrollToCurrent}
            className="text-xs"
            data-testid="button-scroll-to-current"
          >
            <ArrowDown className="w-3 h-3 mr-1" />
            Jump to current
          </Button>
        </div>
      )}
      <div className="overflow-x-auto max-h-80 overflow-y-auto" ref={scrollContainerRef}>
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-16 text-xs">Pick #</TableHead>
              <TableHead className="w-16 text-xs">Rd/Slot</TableHead>
              <TableHead className="text-xs">Player</TableHead>
              <TableHead className="w-12 text-xs text-center">Pos</TableHead>
              <TableHead className="w-12 text-xs text-center">Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPicks.map((pick) => {
              const isCurrent = currentPick === pick.pickNo;
              return (
                <TableRow 
                  key={pick.pickNo} 
                  ref={isCurrent ? currentPickRef : undefined}
                  className={isCurrent ? "bg-primary/20" : ""}
                  data-testid={`draft-pick-${pick.pickNo}`}
                >
                  <TableCell className="font-mono text-xs font-semibold text-primary">
                    #{pick.pickNo}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {pick.round}.{String(pick.slot).padStart(2, "0")}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span 
                      className="flex items-center gap-1.5 flex-wrap cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onPlayerClick?.(pick.player.id, pick.player.name, pick.player.position, pick.player.team)}
                      data-testid={`button-view-player-${pick.player.id}`}
                    >
                      {pick.player.name}
                      {pick.isDevy && (
                        <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[9px] px-1 py-0">
                          DEVY
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-xs ${POSITION_COLORS[pick.player.position] || ""}`}>
                      {pick.player.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {pick.player.team}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function DraftWarRoomPage() {
  const { league } = useSelectedLeague();
  const [modeOverride, setModeOverride] = useState<"rookie" | "startup" | null>(null);
  const [showLeverage, setShowLeverage] = useState(true);
  const [devyEnabled, setDevyEnabled] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string; position: string; team: string; isRookie?: boolean; college?: string } | null>(null);

  const { data: leagueSettings } = useQuery<{ devyEnabled: boolean }>({
    queryKey: [`/api/league-settings/${league?.league_id}`],
    enabled: !!league?.league_id,
  });

  useEffect(() => {
    if (leagueSettings) {
      setDevyEnabled(leagueSettings.devyEnabled);
    }
  }, [leagueSettings]);

  const devyToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("PUT", `/api/league-settings/${league?.league_id}`, { devyEnabled: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/league-settings/${league?.league_id}`] });
    },
  });

  const handleDevyToggle = () => {
    const newValue = !devyEnabled;
    setDevyEnabled(newValue);
    devyToggleMutation.mutate(newValue);
  };

  const handlePlayerClick = (player: PlayerRecommendation) => {
    const isRookie = player.playerId.startsWith('draft2026-');
    setSelectedPlayer({ id: player.playerId, name: player.name, position: player.position, team: player.team, isRookie, college: isRookie ? player.college || player.team : undefined });
  };

  const handleBoardPlayerClick = (playerId: string, name: string, position: string, team: string) => {
    setSelectedPlayer({ id: playerId, name, position, team });
  };

  const queryMode = modeOverride ? `&mode=${modeOverride}` : "";
  const { data, isLoading, error, refetch } = useQuery<DraftRecommendationsResponse>({
    queryKey: [`/api/fantasy/draft-recommendations/${league?.league_id}?auto=1${queryMode}`],
    enabled: !!league?.league_id,
  });

  const detectedMode = data?.mode === "startup" ? "startup" : "rookie";
  const activeMode = modeOverride || detectedMode;

  if (!league) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a league to view the Draft War Room
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as any)?.message || "Failed to load draft data";
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-red-400">{errorMessage}</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          data-testid="button-retry-draft"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const { recommendations, valueDrops, rosterAnalysis, positionalRuns, draft, draftBoard, myPicks } = data || {
    recommendations: { bestValue: [], bestForNeeds: [], bestUpside: [] },
    valueDrops: [],
    rosterAnalysis: { positionCounts: {}, needs: [], avgAge: 0, profile: "Balanced" },
    positionalRuns: [],
    mode: "rookie" as const,
    draft: null,
    draftBoard: [],
    myPicks: [],
  };

  const tierCliffs = (data as any)?.tierCliffs || [];
  const currentRound = (data as any)?.currentRound;
  const draftPhase = (data as any)?.draftPhase;

  const hasAlerts = positionalRuns.length > 0 || valueDrops.length > 0 || tierCliffs.length > 0;

  return (
    <PremiumGate featureName="Draft War Room">
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Draft War Room
          </h1>
          <p className="text-muted-foreground text-sm">
            AI-powered draft intelligence for {league.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeMode === "rookie" ? "default" : "outline"}
            size="sm"
            onClick={() => setModeOverride("rookie")}
            data-testid="button-mode-rookie"
          >
            Rookie Draft
          </Button>
          <Button
            variant={activeMode === "startup" ? "default" : "outline"}
            size="sm"
            onClick={() => setModeOverride("startup")}
            data-testid="button-mode-startup"
          >
            Startup Draft
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDevyToggle}
            data-testid="button-toggle-devy"
            className={devyEnabled ? "border-purple-500/50 text-purple-400" : ""}
          >
            <Flame className="w-4 h-4 mr-1" />
            {devyEnabled ? "Devy On" : "Devy Off"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLeverage(!showLeverage)}
            data-testid="button-toggle-leverage"
            className={showLeverage ? "border-primary/50" : ""}
          >
            <Gauge className="w-4 h-4 mr-1" />
            {showLeverage ? "Leverage On" : "Leverage Off"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-draft"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <DraftPhaseIndicator phase={draftPhase} round={currentRound} />

      {hasAlerts && (
        <div className="space-y-2" data-testid="alerts-container">
          {tierCliffs.map((cliff: TierCliff) => (
            <TierCliffAlert key={cliff.position} cliff={cliff} />
          ))}
          {positionalRuns.map(run => (
            <PositionRunAlert key={run.position} position={run.position} count={run.count} />
          ))}
          {valueDrops.map(player => (
            <ValueDropAlert key={player.playerId} player={player} />
          ))}
        </div>
      )}

      {draft && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-draft-status">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <Badge 
                  variant={draft.status === "drafting" ? "default" : "outline"}
                  data-testid={`badge-draft-status-${draft.status}`}
                >
                  {draft.status === "drafting" ? "LIVE" : draft.status.toUpperCase()}
                </Badge>
                <span className="text-sm">
                  {draft.type.charAt(0).toUpperCase() + draft.type.slice(1)} Draft
                </span>
                <span className="text-sm text-muted-foreground">
                  {draft.rounds} Rounds
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">{draft.picksMade}</span>
                <span className="text-muted-foreground">/{draft.totalPicks} picks made</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card data-testid="card-smart-recommendations">
            <CardHeader>
              <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Smart Pick Recommendations
                {draftPhase && (
                  <Badge variant="outline" className="text-xs ml-2">
                    <Shield className="w-3 h-3 mr-1" />
                    Phase-Aware
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="value" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="value" data-testid="tab-best-value">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Best Picks
                  </TabsTrigger>
                  <TabsTrigger value="needs" data-testid="tab-best-needs">
                    <Target className="w-4 h-4 mr-1" />
                    Roster Fit
                  </TabsTrigger>
                  <TabsTrigger value="upside" data-testid="tab-best-upside">
                    <Zap className="w-4 h-4 mr-1" />
                    High Upside
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="value" className="space-y-2">
                  {recommendations.bestValue.length > 0 ? (
                    recommendations.bestValue.map((player, i) => (
                      <PlayerRecommendationCard 
                        key={player.playerId} 
                        player={player} 
                        rank={i + 1} 
                        isRookieMode={activeMode === "rookie"} 
                        showLeverage={showLeverage}
                        onPlayerClick={handlePlayerClick}
                      />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4" data-testid="empty-state-best-value">
                      No recommendations available
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="needs" className="space-y-2">
                  {recommendations.bestForNeeds.length > 0 ? (
                    recommendations.bestForNeeds.map((player, i) => (
                      <PlayerRecommendationCard 
                        key={player.playerId} 
                        player={player} 
                        rank={i + 1} 
                        isRookieMode={activeMode === "rookie"} 
                        showLeverage={showLeverage}
                        onPlayerClick={handlePlayerClick}
                      />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4" data-testid="empty-state-best-needs">
                      Your roster is well balanced!
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="upside" className="space-y-2">
                  {recommendations.bestUpside.length > 0 ? (
                    recommendations.bestUpside.map((player, i) => (
                      <PlayerRecommendationCard 
                        key={player.playerId} 
                        player={player} 
                        rank={i + 1} 
                        isRookieMode={activeMode === "rookie"} 
                        showLeverage={showLeverage}
                        onPlayerClick={handlePlayerClick}
                      />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4" data-testid="empty-state-best-upside">
                      {activeMode === "rookie" ? "No rising stock prospects available" : "No young upside players available"}
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card data-testid="card-draft-board">
            <CardHeader>
              <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                <Clock className="w-5 h-5" />
                Draft Board
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DraftBoard 
                picks={devyEnabled ? draftBoard : draftBoard.filter(p => !p.isDevy)} 
                currentPick={draft?.status === "drafting" ? draftBoard.length + 1 : undefined}
                onPlayerClick={handleBoardPlayerClick}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <RosterBuildVisual analysis={rosterAnalysis} />

          {rosterAnalysis.needs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Priority Needs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {rosterAnalysis.needs.map(pos => (
                    <Badge 
                      key={pos} 
                      variant="outline" 
                      className={POSITION_COLORS[pos] || ""}
                    >
                      {pos}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-my-picks">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                My Picks ({myPicks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myPicks.length > 0 ? (
                <div className="space-y-2">
                  {myPicks.map(pick => (
                    <div 
                      key={pick.playerId} 
                      className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-card/50 border border-border/30 cursor-pointer hover-elevate"
                      data-testid={`my-pick-${pick.playerId}`}
                      onClick={() => handleBoardPlayerClick(pick.playerId, pick.name, pick.position, pick.team)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {pick.round}.{String(pick.slot).padStart(2, "0")}
                        </span>
                        <span className="font-medium text-sm">{pick.name}</span>
                      </div>
                      <Badge variant="outline" className={POSITION_COLORS[pick.position] || ""}>
                        {pick.position}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2" data-testid="empty-state-my-picks">
                  No picks made yet
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Draft Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              {draftPhase === "early" && (
                <>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                    Prioritize elite production and stable starters
                  </p>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                    Don't reach - let value come to you
                  </p>
                </>
              )}
              {draftPhase === "mid" && (
                <>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                    Balance value with roster construction
                  </p>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                    Fill starting lineup gaps before depth
                  </p>
                </>
              )}
              {draftPhase === "late" && (
                <>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400" />
                    Target upside and leverage plays
                  </p>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400" />
                    Handcuffs and backup RBs become gold
                  </p>
                </>
              )}
              {draftPhase === "deep" && (
                <>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-rose-400" />
                    Pure ceiling plays - ignore floor/PPG
                  </p>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-rose-400" />
                    Lottery tickets with path to role
                  </p>
                </>
              )}
              {!draftPhase && (
                <>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                    {activeMode === "rookie" 
                      ? "Focus on talent over landing spot for dynasty value"
                      : "Balance youth and production for long-term success"
                    }
                  </p>
                  <p className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                    Watch for positional runs and react accordingly
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {selectedPlayer && selectedPlayer.isRookie ? (
        <DevyProfileModal
          open={!!selectedPlayer}
          onOpenChange={(open) => !open && setSelectedPlayer(null)}
          player={null}
          unmatchedPlayer={{ 
            name: selectedPlayer.name, 
            position: selectedPlayer.position, 
            school: selectedPlayer.college || selectedPlayer.team 
          }}
        />
      ) : selectedPlayer ? (
        <PlayerProfileModal
          open={!!selectedPlayer}
          onOpenChange={(open) => !open && setSelectedPlayer(null)}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          position={selectedPlayer.position}
          team={selectedPlayer.team}
        />
      ) : null}
    </div>
    </PremiumGate>
  );
}
