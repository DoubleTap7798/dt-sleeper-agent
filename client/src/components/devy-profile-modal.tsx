import { useQuery } from "@tanstack/react-query";
import { getPositionColorClass } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BarChart3,
  Calendar,
  Newspaper,
  TrendingUp,
  TrendingDown,
  GraduationCap,
  MapPin,
  Ruler,
  Target,
  Star,
  User,
  X,
  Zap,
  Activity,
  Eye,
  Shield,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  AlertTriangle,
  DollarSign,
  Brain,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface DevyComp {
  name: string;
  matchPct: number;
  wasSuccess: boolean;
}

interface DevyPlayer {
  id: string;
  name: string;
  position: string;
  positionRank: number;
  college: string;
  draftEligibleYear: number;
  tier: number;
  value: number;
  trend30Day: number;
  rank: number;
  headshot?: string | null;
  teamLogo?: string | null;
  starterPct?: number;
  elitePct?: number;
  bustPct?: number;
  top10Pct?: number;
  round1Pct?: number;
  round2PlusPct?: number;
  pickEquivalent?: string;
  pickMultiplier?: number;
  dominatorRating?: number;
  yardShare?: number;
  tdShare?: number;
  breakoutAge?: number | null;
  comps?: DevyComp[];
  depthRole?: string;
  pathContext?: string;
  ageClass?: "young-breakout" | "normal" | "old-producer";
  injuryRisk?: number;
  transferRisk?: number;
  competitionRisk?: number;
  conferenceAdjustment?: number;
  nflCompConfidence?: number;
  breakoutProbability?: number;
  ageAdjustedDominator?: number;
  devyPickEquivalent?: string;
  rookiePickEquivalent?: string;
  modelRank?: number;
  marketRank?: number;
  dviScore?: number;
  rankDelta?: number;
  roundProbabilities?: {
    r1: number; r2: number; r3: number; r4: number;
    r5: number; r6: number; r7: number; udfa: number;
  };
}

interface Bio {
  height: string;
  weight: string;
  hometown: string;
  highSchoolRank: string;
  class: string;
  conference: string;
}

interface SeasonStats {
  year: string;
  games: number;
  stats: {
    passYds?: number;
    passTd?: number;
    rushYds?: number;
    rushTd?: number;
    recYds?: number;
    recTd?: number;
    receptions?: number;
  };
}

interface GameLog {
  week: number;
  opponent: string;
  result: string;
  stats: string;
}

interface AnalysisNote {
  title: string;
  insight: string;
  category: string;
}

interface ScoutingReport {
  strengths: string[];
  weaknesses: string[];
  nflComparison: string;
  draftProjection: string;
  fantasyOutlook: string;
}

interface CFBDUsage {
  overall: number;
  pass: number;
  rush: number;
  firstDown: number;
  secondDown: number;
  thirdDown: number;
  standardDowns: number;
  passingDowns: number;
}

interface CFBDPPA {
  countablePlays: number;
  averagePPA: {
    all: number;
    pass: number;
    rush: number;
    firstDown: number;
    secondDown: number;
    thirdDown: number;
    standardDowns: number;
    passingDowns: number;
  };
  totalPPA: {
    all: number;
    pass: number;
    rush: number;
    firstDown: number;
    secondDown: number;
    thirdDown: number;
    standardDowns: number;
    passingDowns: number;
  };
}

interface CFBDAdvanced {
  seasonStats: Record<string, Record<string, number>>;
  usage: CFBDUsage | null;
  ppa: CFBDPPA | null;
}

interface DevyProfileData {
  player: DevyPlayer;
  bio: Bio;
  collegeStats: {
    seasons: SeasonStats[];
    careerTotals: Record<string, number>;
  };
  gameLogs: GameLog[];
  cfbdAdvanced: CFBDAdvanced | null;
  analysisNotes: AnalysisNote[];
  scoutingReport: ScoutingReport;
  generatedAt: string;
}

interface DevyProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: {
    playerId: string;
    name: string;
    position: string;
    positionRank?: number;
    college: string;
    draftEligibleYear?: number | string;
    tier?: number | string;
    value?: number;
    trend7Day?: number;
    trend30Day?: number;
    seasonChange?: number;
    rank?: number;
    starterPct?: number;
    elitePct?: number;
    bustPct?: number;
    top10Pct?: number;
    round1Pct?: number;
    round2PlusPct?: number;
    pickEquivalent?: string;
    pickMultiplier?: number;
    dominatorRating?: number;
    yardShare?: number;
    tdShare?: number;
    breakoutAge?: number | null;
    comps?: DevyComp[];
    depthRole?: string;
    pathContext?: string;
    ageClass?: "young-breakout" | "normal" | "old-producer";
    isUnmatched?: boolean;
    injuryRisk?: number;
    transferRisk?: number;
    competitionRisk?: number;
    conferenceAdjustment?: number;
    nflCompConfidence?: number;
    breakoutProbability?: number;
    ageAdjustedDominator?: number;
    devyPickEquivalent?: string;
    rookiePickEquivalent?: string;
    modelRank?: number;
    marketRank?: number;
    dviScore?: number;
    rankDelta?: number;
    roundProbabilities?: {
      r1: number; r2: number; r3: number; r4: number;
      r5: number; r6: number; r7: number; udfa: number;
    };
  } | null;
  unmatchedPlayer?: { name: string; position: string; school: string } | null;
}

export function DevyProfileModal({ open, onOpenChange, player, unmatchedPlayer }: DevyProfileModalProps) {
  const effectivePlayer = player || (unmatchedPlayer ? {
    playerId: `unmatched-${unmatchedPlayer.name.toLowerCase().trim()}`,
    name: unmatchedPlayer.name,
    position: unmatchedPlayer.position,
    college: unmatchedPlayer.school || "Unknown",
    isUnmatched: true,
  } : null);
  const isUnmatched = effectivePlayer?.isUnmatched === true;
  const { data, isLoading, error } = useQuery<DevyProfileData>({
    queryKey: [`/api/sleeper/devy/${player?.playerId || 'lookup'}/profile`, effectivePlayer?.name],
    queryFn: async () => {
      const url = player?.playerId 
        ? `/api/sleeper/devy/${player.playerId}/profile`
        : `/api/sleeper/devy/lookup/profile?playerName=${encodeURIComponent(effectivePlayer?.name || '')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch devy profile");
      return res.json();
    },
    enabled: !!(player?.playerId || (isUnmatched && effectivePlayer?.name)) && open,
    staleTime: 1000 * 60 * 10,
  });

  if (!effectivePlayer) return null;

  if (isUnmatched && !data && !isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-[95vw] flex flex-col p-0 overflow-hidden [&>button]:hidden" data-testid="modal-devy-profile-unmatched">
          <DialogHeader className="p-4 pb-3 border-b shrink-0">
            <div className="flex items-start justify-between gap-2 pr-8">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarFallback className="text-lg bg-purple-500/20 text-purple-400">
                    {effectivePlayer.college && effectivePlayer.college !== "Unknown" ? effectivePlayer.college.slice(0, 2) : "DV"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl" data-testid="text-player-name">
                    {effectivePlayer.name}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {effectivePlayer.position && effectivePlayer.position !== "?" && (
                        <Badge variant="outline" className={getPositionColorClass(effectivePlayer.position)} data-testid="badge-position">
                          {effectivePlayer.position}
                        </Badge>
                      )}
                      {effectivePlayer.college && effectivePlayer.college !== "Unknown" && (
                        <Badge variant="outline" data-testid="badge-college">
                          <GraduationCap className="h-3 w-3 mr-1" />
                          {effectivePlayer.college}
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        DEVY
                      </Badge>
                    </div>
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-modal"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>
          <div className="p-6 text-center text-muted-foreground space-y-3">
            <User className="h-12 w-12 mx-auto opacity-40" />
            <p className="text-sm">
              This prospect is not yet in our curated devy database. Detailed analytics, scouting notes, and projections will be available once they are added to the system.
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-xs">
              {effectivePlayer.position && effectivePlayer.position !== "?" && (
                <span>Position: <span className="font-medium text-foreground">{effectivePlayer.position}</span></span>
              )}
              {effectivePlayer.college && effectivePlayer.college !== "Unknown" && (
                <span>School: <span className="font-medium text-foreground">{effectivePlayer.college}</span></span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const apiPlayer = data?.player;
  const p = player || {
    playerId: effectivePlayer!.playerId,
    name: effectivePlayer!.name,
    position: effectivePlayer!.position,
    positionRank: apiPlayer?.positionRank ?? 0,
    college: effectivePlayer!.college || "Unknown",
    draftEligibleYear: apiPlayer?.draftEligibleYear ?? 2026,
    tier: apiPlayer?.tier ?? 0,
    value: apiPlayer?.value ?? 0,
    trend7Day: (apiPlayer as any)?.trend7Day ?? 0,
    trend30Day: apiPlayer?.trend30Day ?? 0,
    seasonChange: (apiPlayer as any)?.seasonChange ?? 0,
    rank: apiPlayer?.rank ?? 0,
    headshot: apiPlayer?.headshot ?? null,
    teamLogo: apiPlayer?.teamLogo ?? null,
    starterPct: apiPlayer?.starterPct,
    elitePct: apiPlayer?.elitePct,
    bustPct: apiPlayer?.bustPct,
    top10Pct: apiPlayer?.top10Pct,
    round1Pct: apiPlayer?.round1Pct,
    round2PlusPct: apiPlayer?.round2PlusPct,
    pickEquivalent: apiPlayer?.pickEquivalent,
    pickMultiplier: apiPlayer?.pickMultiplier,
    dominatorRating: apiPlayer?.dominatorRating,
    yardShare: apiPlayer?.yardShare,
    tdShare: apiPlayer?.tdShare,
    breakoutAge: apiPlayer?.breakoutAge,
    comps: apiPlayer?.comps,
    depthRole: apiPlayer?.depthRole,
    pathContext: apiPlayer?.pathContext,
    ageClass: apiPlayer?.ageClass,
    injuryRisk: apiPlayer?.injuryRisk,
    transferRisk: apiPlayer?.transferRisk,
    competitionRisk: apiPlayer?.competitionRisk,
    conferenceAdjustment: apiPlayer?.conferenceAdjustment,
    nflCompConfidence: apiPlayer?.nflCompConfidence,
    breakoutProbability: apiPlayer?.breakoutProbability,
    ageAdjustedDominator: apiPlayer?.ageAdjustedDominator,
    devyPickEquivalent: apiPlayer?.devyPickEquivalent,
    rookiePickEquivalent: apiPlayer?.rookiePickEquivalent,
    modelRank: apiPlayer?.modelRank,
    marketRank: apiPlayer?.marketRank,
    dviScore: apiPlayer?.dviScore,
    rankDelta: apiPlayer?.rankDelta,
    roundProbabilities: apiPlayer?.roundProbabilities,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden [&>button]:hidden" data-testid="modal-devy-profile">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="flex items-start gap-3">
              <Avatar className="h-14 w-14 shrink-0" data-testid="avatar-player">
                <AvatarImage 
                  src={data?.player?.teamLogo || undefined} 
                  alt={p.college}
                />
                <AvatarFallback className="text-lg bg-muted">
                  {p.college.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl" data-testid="text-player-name">
                  {p.name}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className={getPositionColorClass(p.position)} data-testid="badge-position">
                      {p.position}{p.positionRank ?? ""}
                    </Badge>
                    <Badge variant="outline" data-testid="badge-college">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {p.college}
                    </Badge>
                    {p.draftEligibleYear && (
                      <Badge variant="outline" className={Number(p.draftEligibleYear) === new Date().getFullYear() ? "border-blue-500/40 text-blue-400" : "border-purple-500/40 text-purple-400"} data-testid="badge-draft-year">
                        {Number(p.draftEligibleYear) === new Date().getFullYear() ? `${p.draftEligibleYear} Draft` : `${p.draftEligibleYear} Devy`}
                      </Badge>
                    )}
                  </div>
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-start gap-3">
              {p.rank != null && p.rank > 0 && (
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold" data-testid="text-rank">
                    #{p.rank}
                  </div>
                  <div className="text-xs text-muted-foreground">Overall</div>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-modal"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-3">
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-pick-value">
              <div className="text-lg font-bold text-primary">{(p.pickMultiplier ?? 0).toFixed(1)}x</div>
              <div className="text-xs text-muted-foreground">Pick Value</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-elite">
              <div className="text-lg font-bold text-green-500">{p.elitePct ?? 0}%</div>
              <div className="text-xs text-muted-foreground">Elite %</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-bust">
              <div className="text-lg font-bold text-red-500">{p.bustPct ?? 0}%</div>
              <div className="text-xs text-muted-foreground">Bust %</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-round1">
              <div className="text-lg font-bold">{p.round1Pct ?? 0}%</div>
              <div className="text-xs text-muted-foreground">Round 1</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-trend">
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                {(p.trend30Day ?? 0) > 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">+{p.trend30Day}</span>
                  </>
                ) : (p.trend30Day ?? 0) < 0 ? (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">{p.trend30Day}</span>
                  </>
                ) : (
                  "-"
                )}
              </div>
              <div className="text-xs text-muted-foreground">30-Day</div>
            </div>
          </div>
          
          {/* Market Share & Path to Production */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 bg-primary/10 border border-primary/30 rounded">
              <div className="text-xs text-muted-foreground mb-1">Market Share</div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div>
                  <span className="font-medium">{p.dominatorRating ?? 0}%</span>
                  <span className="text-muted-foreground ml-0.5">Dom</span>
                </div>
                <div>
                  <span className="font-medium">{p.yardShare ?? 0}%</span>
                  <span className="text-muted-foreground ml-0.5">Yds</span>
                </div>
                <div>
                  <span className="font-medium">{p.tdShare ?? 0}%</span>
                  <span className="text-muted-foreground ml-0.5">TDs</span>
                </div>
              </div>
              {p.breakoutAge && (
                <div className="text-xs mt-1">
                  <span className="text-muted-foreground">Breakout Age:</span>{" "}
                  <span className={`font-medium ${p.breakoutAge <= 19 ? "text-green-500" : p.breakoutAge >= 21 ? "text-yellow-500" : ""}`}>
                    {p.breakoutAge}
                  </span>
                </div>
              )}
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground mb-1">Path to Production</div>
              <div className="text-sm font-medium">{p.depthRole ?? "Unknown"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{p.pathContext ?? ""}</div>
            </div>
          </div>

          {/* Historical Comps */}
          {p.comps && p.comps.length > 0 && (
            <div className="mt-2 p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground mb-1">Historical Comparisons</div>
              <div className="flex flex-wrap gap-2">
                {p.comps.map((comp, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${comp.wasSuccess ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="font-medium">{comp.name}</span>
                    <span className="text-muted-foreground">({comp.matchPct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        <Tabs defaultValue="bio" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b px-4 h-auto flex-wrap gap-1 py-2 shrink-0">
            <TabsTrigger value="bio" className="text-xs sm:text-sm" data-testid="tab-bio">
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Bio
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs sm:text-sm" data-testid="tab-stats">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="games" className="text-xs sm:text-sm" data-testid="tab-games">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Games
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs sm:text-sm" data-testid="tab-advanced">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="outlook" className="text-xs sm:text-sm" data-testid="tab-outlook">
              <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Outlook
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs sm:text-sm" data-testid="tab-analysis">
              <Newspaper className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="projections" className="text-xs sm:text-sm" data-testid="tab-projections">
              <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Projections
            </TabsTrigger>
            <TabsTrigger value="tradevalue" className="text-xs sm:text-sm" data-testid="tab-tradevalue">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Trade Value
            </TabsTrigger>
            <TabsTrigger value="draftcapital" className="text-xs sm:text-sm" data-testid="tab-draftcapital">
              <Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Draft Capital
            </TabsTrigger>
            <TabsTrigger value="trajectory" className="text-xs sm:text-sm" data-testid="tab-trajectory">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Trajectory
            </TabsTrigger>
            <TabsTrigger value="valuation" className="text-xs sm:text-sm" data-testid="tab-valuation">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Valuation
            </TabsTrigger>
            <TabsTrigger value="riskbreakdown" className="text-xs sm:text-sm" data-testid="tab-riskbreakdown">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Risk
            </TabsTrigger>
            <TabsTrigger value="longterm" className="text-xs sm:text-sm" data-testid="tab-longterm">
              <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Outlook AI
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <div className="p-4 text-center text-muted-foreground" data-testid="text-error">
                Failed to load player profile
              </div>
            ) : data ? (
              <>
                <TabsContent value="bio" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-bio">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-3">Player Info</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Ruler className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Height:</span>
                          <span className="font-medium">{data.bio?.height || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Weight:</span>
                          <span className="font-medium">{data.bio?.weight || "N/A"} lbs</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">From:</span>
                          <span className="font-medium">{data.bio?.hometown || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Class:</span>
                          <span className="font-medium">{data.bio?.class || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">HS Rank:</span>
                          <span className="font-medium">{data.bio?.highSchoolRank || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Conference:</span>
                          <span className="font-medium">{data.bio?.conference || "N/A"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {data.scoutingReport && (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">Scouting Report</h3>
                        <div className="space-y-3 text-sm">
                          {data.scoutingReport.strengths?.length > 0 && (
                            <div>
                              <span className="font-medium">Strengths:</span>
                              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                {data.scoutingReport.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {data.scoutingReport.weaknesses?.length > 0 && (
                            <div>
                              <span className="font-medium">Areas to Develop:</span>
                              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                {data.scoutingReport.weaknesses.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div>
                            <span className="font-medium">NFL Comparison:</span>
                            <span className="ml-2 text-muted-foreground">{data.scoutingReport.nflComparison}</span>
                          </div>
                          <div>
                            <span className="font-medium">Draft Projection:</span>
                            <span className="ml-2 text-muted-foreground">{data.scoutingReport.draftProjection}</span>
                          </div>
                          <div>
                            <span className="font-medium">Fantasy Outlook:</span>
                            <p className="mt-1 text-muted-foreground">{data.scoutingReport.fantasyOutlook}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="stats" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-stats">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                  {(!data.collegeStats?.seasons?.length && (!data.collegeStats?.careerTotals || Object.keys(data.collegeStats.careerTotals).length === 0)) ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="font-semibold mb-2">Stats Not Available</h3>
                        <p className="text-sm text-muted-foreground">
                          College statistics for {p.name} are not yet available from ESPN. 
                          This may be because the player is an incoming freshman or ESPN hasn't updated their data.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                  {data.collegeStats?.careerTotals && Object.keys(data.collegeStats.careerTotals).length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">Career Totals</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {data.collegeStats.careerTotals.games > 0 && (
                            <div className="text-center p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{data.collegeStats.careerTotals.games}</div>
                              <div className="text-[10px] text-muted-foreground">Games</div>
                            </div>
                          )}
                          {(data.collegeStats.careerTotals.passYds ?? 0) > 0 && (
                            <>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{data.collegeStats.careerTotals.passYds?.toLocaleString()}</div>
                                <div className="text-[10px] text-muted-foreground">Pass Yds</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{data.collegeStats.careerTotals.passTd}</div>
                                <div className="text-[10px] text-muted-foreground">Pass TD</div>
                              </div>
                            </>
                          )}
                          {(data.collegeStats.careerTotals.rushYds ?? 0) > 0 && (
                            <>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{data.collegeStats.careerTotals.rushYds?.toLocaleString()}</div>
                                <div className="text-[10px] text-muted-foreground">Rush Yds</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{data.collegeStats.careerTotals.rushTd}</div>
                                <div className="text-[10px] text-muted-foreground">Rush TD</div>
                              </div>
                            </>
                          )}
                          {(data.collegeStats.careerTotals.recYds ?? 0) > 0 && (
                            <>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{data.collegeStats.careerTotals.receptions}</div>
                                <div className="text-[10px] text-muted-foreground">Rec</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{data.collegeStats.careerTotals.recYds?.toLocaleString()}</div>
                                <div className="text-[10px] text-muted-foreground">Rec Yds</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{data.collegeStats.careerTotals.recTd}</div>
                                <div className="text-[10px] text-muted-foreground">Rec TD</div>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {data.collegeStats?.seasons?.length > 0 && (
                    <Card>
                      <CardContent className="p-3">
                        <h3 className="font-semibold mb-2 text-sm">Season History</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead className="border-b">
                              <tr className="text-left text-muted-foreground">
                                <th className="px-1.5 py-1">Yr</th>
                                <th className="px-1.5 py-1">G</th>
                                {p.position === "QB" ? (
                                  <>
                                    <th className="px-1.5 py-1">PaY</th>
                                    <th className="px-1.5 py-1">PaT</th>
                                    <th className="px-1.5 py-1">RuY</th>
                                  </>
                                ) : p.position === "RB" ? (
                                  <>
                                    <th className="px-1.5 py-1">RuY</th>
                                    <th className="px-1.5 py-1">RuT</th>
                                    <th className="px-1.5 py-1">Rec</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="px-1.5 py-1">Rec</th>
                                    <th className="px-1.5 py-1">ReY</th>
                                    <th className="px-1.5 py-1">ReT</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {data.collegeStats.seasons.map((season, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                                  <td className="px-1.5 py-1 font-medium">{season.year}</td>
                                  <td className="px-1.5 py-1">{season.games}</td>
                                  {p.position === "QB" ? (
                                    <>
                                      <td className="px-1.5 py-1">{season.stats.passYds?.toLocaleString() || 0}</td>
                                      <td className="px-1.5 py-1">{season.stats.passTd || 0}</td>
                                      <td className="px-1.5 py-1">{season.stats.rushYds?.toLocaleString() || 0}</td>
                                    </>
                                  ) : p.position === "RB" ? (
                                    <>
                                      <td className="px-1.5 py-1">{season.stats.rushYds?.toLocaleString() || 0}</td>
                                      <td className="px-1.5 py-1">{season.stats.rushTd || 0}</td>
                                      <td className="px-1.5 py-1">{season.stats.receptions || 0}</td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-1.5 py-1">{season.stats.receptions || 0}</td>
                                      <td className="px-1.5 py-1">{season.stats.recYds?.toLocaleString() || 0}</td>
                                      <td className="px-1.5 py-1">{season.stats.recTd || 0}</td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                            {p.position === "QB" ? (
                              <>
                                <span><span className="font-medium">PaY</span>=Pass Yds</span>
                                <span><span className="font-medium">PaT</span>=Pass TD</span>
                                <span><span className="font-medium">RuY</span>=Rush Yds</span>
                              </>
                            ) : p.position === "RB" ? (
                              <>
                                <span><span className="font-medium">RuY</span>=Rush Yds</span>
                                <span><span className="font-medium">RuT</span>=Rush TD</span>
                                <span><span className="font-medium">Rec</span>=Receptions</span>
                              </>
                            ) : (
                              <>
                                <span><span className="font-medium">ReY</span>=Rec Yds</span>
                                <span><span className="font-medium">ReT</span>=Rec TD</span>
                              </>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="games" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-games">
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                  {data.gameLogs?.length > 0 ? (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">Recent Games</h3>
                        <div className="space-y-2">
                          {data.gameLogs.map((game, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded ${idx % 2 === 0 ? "bg-muted/30" : ""}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">Wk {game.week}</Badge>
                                  <span className="font-medium">{game.opponent}</span>
                                </div>
                                <Badge
                                  variant={game.result.startsWith("W") ? "secondary" : "outline"}
                                  className="text-xs"
                                >
                                  {game.result}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{game.stats}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="font-semibold mb-2">Game Logs Not Available</h3>
                        <p className="text-sm text-muted-foreground">
                          Game-by-game statistics for {p.name} are not yet available from ESPN.
                          This may be because the player is an incoming freshman or ESPN hasn't updated their data.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="advanced" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-advanced">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {data.cfbdAdvanced ? (
                        <>
                          {data.cfbdAdvanced.ppa && (
                            <Card>
                              <CardContent className="p-4">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                  <Zap className="h-4 w-4" />
                                  Predicted Points Added (PPA)
                                </h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                  PPA measures how much each play contributes to scoring. Higher is better.
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-ppa-overall">
                                    <div className={`text-xl font-bold ${data.cfbdAdvanced.ppa.averagePPA.all > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {data.cfbdAdvanced.ppa.averagePPA.all.toFixed(3)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Avg PPA</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-ppa-total">
                                    <div className={`text-xl font-bold ${data.cfbdAdvanced.ppa.totalPPA.all > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {data.cfbdAdvanced.ppa.totalPPA.all.toFixed(1)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Total PPA</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-ppa-pass">
                                    <div className="text-xl font-bold">
                                      {data.cfbdAdvanced.ppa.averagePPA.pass.toFixed(3)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Pass PPA</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-ppa-rush">
                                    <div className="text-xl font-bold">
                                      {data.cfbdAdvanced.ppa.averagePPA.rush.toFixed(3)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Rush PPA</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-sm font-bold">{data.cfbdAdvanced.ppa.countablePlays}</div>
                                    <div className="text-xs text-muted-foreground">Plays</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-sm font-bold">{data.cfbdAdvanced.ppa.averagePPA.standardDowns.toFixed(3)}</div>
                                    <div className="text-xs text-muted-foreground">Std Downs</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-sm font-bold">{data.cfbdAdvanced.ppa.averagePPA.passingDowns.toFixed(3)}</div>
                                    <div className="text-xs text-muted-foreground">Pass Downs</div>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 italic">Source: College Football Data API</p>
                              </CardContent>
                            </Card>
                          )}

                          {data.cfbdAdvanced.usage && (
                            <Card>
                              <CardContent className="p-4">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                  <Target className="h-4 w-4" />
                                  Usage Rate
                                </h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                  How often the player is involved in plays. Higher usage = bigger role.
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-usage-overall">
                                    <div className="text-xl font-bold">{(data.cfbdAdvanced.usage.overall * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">Overall</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-usage-pass">
                                    <div className="text-xl font-bold">{(data.cfbdAdvanced.usage.pass * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">Pass Plays</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-usage-rush">
                                    <div className="text-xl font-bold">{(data.cfbdAdvanced.usage.rush * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">Rush Plays</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-xl font-bold">{(data.cfbdAdvanced.usage.firstDown * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">1st Down</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-sm font-bold">{(data.cfbdAdvanced.usage.secondDown * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">2nd Down</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-sm font-bold">{(data.cfbdAdvanced.usage.thirdDown * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">3rd Down</div>
                                  </div>
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-sm font-bold">{(data.cfbdAdvanced.usage.passingDowns * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">Pass Downs</div>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 italic">Source: College Football Data API</p>
                              </CardContent>
                            </Card>
                          )}

                          {data.cfbdAdvanced.seasonStats && Object.keys(data.cfbdAdvanced.seasonStats).length > 0 && (
                            <Card>
                              <CardContent className="p-4">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4" />
                                  CFBD Season Stats
                                </h3>
                                <div className="space-y-3">
                                  {Object.entries(data.cfbdAdvanced.seasonStats).map(([category, stats]) => (
                                    <div key={category}>
                                      <h4 className="text-sm font-medium capitalize mb-2">{category}</h4>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {Object.entries(stats).map(([stat, value]) => (
                                          <div key={stat} className="text-center p-1.5 bg-muted/50 rounded">
                                            <div className="text-sm font-bold">{typeof value === 'number' ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)) : value}</div>
                                            <div className="text-[10px] text-muted-foreground capitalize">{stat.replace(/_/g, ' ')}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 italic">Source: College Football Data API</p>
                              </CardContent>
                            </Card>
                          )}

                          {!data.cfbdAdvanced.ppa && !data.cfbdAdvanced.usage && Object.keys(data.cfbdAdvanced.seasonStats || {}).length === 0 && (
                            <Card>
                              <CardContent className="p-6 text-center">
                                <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                                <h3 className="font-semibold mb-2">Advanced Data Not Available</h3>
                                <p className="text-sm text-muted-foreground">
                                  Advanced metrics for {p.name} from the College Football Data API are not available.
                                  This may be because the player hasn't logged enough snaps yet.
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </>
                      ) : (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <h3 className="font-semibold mb-2">Advanced Analytics</h3>
                            <p className="text-sm text-muted-foreground">
                              College Football Data API metrics are not available for {p.name} at this time.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="outlook" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-outlook">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card data-testid="card-dynasty-recommendation">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Gauge className="h-4 w-4" />
                            Dynasty Recommendation
                          </h3>
                          {(() => {
                            const elite = p.elitePct ?? 0;
                            const bust = p.bustPct ?? 0;
                            const trend = p.trend30Day ?? 0;
                            const pickMult = p.pickMultiplier ?? 0;
                            let verdict = "";
                            let verdictColor = "";
                            let verdictDesc = "";
                            if (elite >= 30 && bust < 25 && pickMult >= 1.5) {
                              verdict = "Must Own";
                              verdictColor = "text-green-500";
                              verdictDesc = "Elite upside with manageable risk. Prioritize acquiring in all dynasty formats.";
                            } else if (elite >= 20 && bust < 35) {
                              verdict = "Strong Hold";
                              verdictColor = "text-blue-500";
                              verdictDesc = "Quality prospect with solid trajectory. Hold unless offered premium value.";
                            } else if (trend > 5 && bust >= 35) {
                              verdict = "Sell High";
                              verdictColor = "text-yellow-500";
                              verdictDesc = "Rising value but significant bust risk. Consider selling at peak for safer assets.";
                            } else if (trend < -5 && elite >= 20) {
                              verdict = "Buy Low";
                              verdictColor = "text-green-500";
                              verdictDesc = "Talent still present despite dropping value. Potential buy-low window.";
                            } else if (bust >= 40) {
                              verdict = "Caution";
                              verdictColor = "text-red-500";
                              verdictDesc = "High bust probability. Only hold if you can absorb the risk in deeper leagues.";
                            } else {
                              verdict = "Monitor";
                              verdictColor = "text-muted-foreground";
                              verdictDesc = "Standard prospect. Watch development and draft capital before committing.";
                            }
                            return (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30" data-testid="panel-dynasty-verdict">
                                  <div className={`text-2xl font-bold ${verdictColor}`} data-testid="text-dynasty-verdict">{verdict}</div>
                                </div>
                                <p className="text-sm text-muted-foreground">{verdictDesc}</p>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      <Card data-testid="card-value-drivers">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                            Value Drivers
                          </h3>
                          <div className="space-y-2">
                            {(p.elitePct ?? 0) >= 20 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm" data-testid="driver-elite-upside">
                                <Shield className="h-4 w-4 text-green-500 shrink-0" />
                                <span>High elite ceiling ({p.elitePct}% chance of top-tier production)</span>
                              </div>
                            )}
                            {(p.round1Pct ?? 0) >= 50 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm" data-testid="driver-draft-capital">
                                <Star className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Premium draft capital expected ({p.round1Pct}% Round 1 probability)</span>
                              </div>
                            )}
                            {(p.dominatorRating ?? 0) >= 30 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm" data-testid="driver-dominator">
                                <Zap className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Strong dominator rating ({p.dominatorRating}%) indicates alpha role</span>
                              </div>
                            )}
                            {p.ageClass === "young-breakout" && (
                              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm" data-testid="driver-age-curve">
                                <Zap className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Young breakout profile - elite age curve for position</span>
                              </div>
                            )}
                            {(p.trend30Day ?? 0) > 5 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm" data-testid="driver-momentum">
                                <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Strong upward momentum (+{p.trend30Day} in 30 days)</span>
                              </div>
                            )}
                            {p.breakoutAge && p.breakoutAge <= 19 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm" data-testid="driver-breakout-age">
                                <Star className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Early breakout age ({p.breakoutAge}) - historically elite indicator</span>
                              </div>
                            )}
                            {(p.elitePct ?? 0) < 20 && (p.round1Pct ?? 0) < 50 && (p.dominatorRating ?? 0) < 30 && p.ageClass !== "young-breakout" && (p.trend30Day ?? 0) <= 5 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm text-muted-foreground" data-testid="driver-none">
                                <span>No standout value drivers identified yet. Monitor development closely.</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card data-testid="card-risk-factors">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <ArrowDownRight className="h-4 w-4 text-red-500" />
                            Risk Factors
                          </h3>
                          <div className="space-y-2">
                            {(p.bustPct ?? 0) >= 30 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-sm" data-testid="risk-bust-rate">
                                <Shield className="h-4 w-4 text-red-500 shrink-0" />
                                <span>Elevated bust risk ({p.bustPct}% non-contributor probability)</span>
                              </div>
                            )}
                            {p.ageClass === "old-producer" && (
                              <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-sm" data-testid="risk-age-concern">
                                <Activity className="h-4 w-4 text-red-500 shrink-0" />
                                <span>Older producer age profile - potential age curve concern</span>
                              </div>
                            )}
                            {(p.trend30Day ?? 0) < -5 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-sm" data-testid="risk-declining-value">
                                <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
                                <span>Declining market value ({p.trend30Day} in 30 days)</span>
                              </div>
                            )}
                            {(p.round2PlusPct ?? 0) >= 60 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-sm" data-testid="risk-draft-capital">
                                <Star className="h-4 w-4 text-yellow-500 shrink-0" />
                                <span>Likely Day 2+ draft capital ({p.round2PlusPct}% Round 2+ probability)</span>
                              </div>
                            )}
                            {(p.dominatorRating ?? 0) < 15 && (p.dominatorRating ?? 0) > 0 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-sm" data-testid="risk-low-dominator">
                                <Gauge className="h-4 w-4 text-yellow-500 shrink-0" />
                                <span>Low dominator rating ({p.dominatorRating}%) suggests shared role</span>
                              </div>
                            )}
                            {(p.bustPct ?? 0) < 30 && p.ageClass !== "old-producer" && (p.trend30Day ?? 0) >= -5 && (p.round2PlusPct ?? 0) < 60 && (
                              <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm text-muted-foreground" data-testid="risk-none">
                                <span>No major red flags identified. Standard development risk applies.</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="analysis" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-analysis">
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                  {data.analysisNotes?.length > 0 ? (
                    <div className="space-y-3">
                      {data.analysisNotes.map((note, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{note.title}</h4>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
                                {note.category}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{note.insight}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No analysis notes available
                    </div>
                  )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="projections" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-projections">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card>
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Breakout Probability
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span>Fantasy Starter</span>
                                <span className="font-medium">{p.starterPct ?? 0}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${p.starterPct ?? 0}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span>Elite Producer</span>
                                <span className="font-medium text-green-500">{p.elitePct ?? 0}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${p.elitePct ?? 0}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span>Bust Risk</span>
                                <span className="font-medium text-red-500">{p.bustPct ?? 0}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${p.bustPct ?? 0}%` }} />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            NFL Draft Projection
                          </h3>
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="text-center p-3 bg-muted/50 rounded">
                                <div className="text-2xl font-bold text-primary">{p.top10Pct ?? 0}%</div>
                                <div className="text-xs text-muted-foreground">Top 10 Pick</div>
                              </div>
                              <div className="text-center p-3 bg-muted/50 rounded">
                                <div className="text-2xl font-bold">{p.round1Pct ?? 0}%</div>
                                <div className="text-xs text-muted-foreground">Round 1</div>
                              </div>
                              <div className="text-center p-3 bg-muted/50 rounded">
                                <div className="text-2xl font-bold text-muted-foreground">{p.round2PlusPct ?? 0}%</div>
                                <div className="text-xs text-muted-foreground">Round 2+</div>
                              </div>
                            </div>
                            {data?.scoutingReport?.draftProjection && (
                              <div className="p-3 border rounded bg-muted/30">
                                <div className="text-xs text-muted-foreground mb-1">Draft Range</div>
                                <div className="text-sm font-medium">{data.scoutingReport.draftProjection}</div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Projected Role
                          </h3>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <span className="text-sm text-muted-foreground">Depth Chart</span>
                              <span className="text-sm font-medium">{p.depthRole ?? "Unknown"}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <span className="text-sm text-muted-foreground">Path Context</span>
                              <span className="text-sm font-medium">{p.pathContext ?? "N/A"}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <span className="text-sm text-muted-foreground">Age Profile</span>
                              <span className={`text-sm font-medium ${
                                p.ageClass === "young-breakout" ? "text-green-500" :
                                p.ageClass === "old-producer" ? "text-yellow-500" : ""
                              }`}>
                                {p.ageClass === "young-breakout" ? "Young Breakout" :
                                 p.ageClass === "old-producer" ? "Older Producer" : "Normal"}
                              </span>
                            </div>
                            {data?.scoutingReport?.fantasyOutlook && (
                              <div className="p-3 border rounded bg-muted/30 mt-2">
                                <div className="text-xs text-muted-foreground mb-1">Fantasy Outlook</div>
                                <div className="text-sm">{data.scoutingReport.fantasyOutlook}</div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="tradevalue" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-tradevalue">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card>
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Dynasty Trade Value
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-primary/10 border border-primary/30 rounded">
                              <div className="text-3xl font-bold text-primary">{p.pickMultiplier?.toFixed(1) ?? "0.0"}x</div>
                              <div className="text-xs text-muted-foreground mt-1">Pick Multiplier</div>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded">
                              <div className="text-3xl font-bold">{p.value?.toLocaleString() ?? 0}</div>
                              <div className="text-xs text-muted-foreground mt-1">Dynasty Value</div>
                            </div>
                          </div>
                          {p.pickEquivalent && (
                            <div className="mt-3 p-3 border rounded bg-muted/30">
                              <div className="text-xs text-muted-foreground mb-1">Pick Equivalent</div>
                              <div className="text-sm font-medium">{p.pickEquivalent}</div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Value Trend
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <div className={`text-xl font-bold ${(p.trend7Day ?? 0) > 0 ? "text-green-500" : (p.trend7Day ?? 0) < 0 ? "text-red-500" : ""}`}>
                                {(p.trend7Day ?? 0) > 0 ? "+" : ""}{p.trend7Day ?? 0}
                              </div>
                              <div className="text-xs text-muted-foreground">7 Day</div>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <div className={`text-xl font-bold ${(p.trend30Day ?? 0) > 0 ? "text-green-500" : (p.trend30Day ?? 0) < 0 ? "text-red-500" : ""}`}>
                                {(p.trend30Day ?? 0) > 0 ? "+" : ""}{p.trend30Day ?? 0}
                              </div>
                              <div className="text-xs text-muted-foreground">30 Day</div>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <div className={`text-xl font-bold ${(p.seasonChange ?? 0) > 0 ? "text-green-500" : (p.seasonChange ?? 0) < 0 ? "text-red-500" : ""}`}>
                                {(p.seasonChange ?? 0) > 0 ? "+" : ""}{p.seasonChange ?? 0}
                              </div>
                              <div className="text-xs text-muted-foreground">Season</div>
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-muted/30 rounded">
                            <div className="text-xs text-muted-foreground mb-1">Market Direction</div>
                            <div className="flex items-center gap-2">
                              {(p.trend30Day ?? 0) > 5 ? (
                                <>
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                  <span className="text-sm font-medium text-green-500">Rising - Strong upward momentum</span>
                                </>
                              ) : (p.trend30Day ?? 0) > 0 ? (
                                <>
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                  <span className="text-sm font-medium text-green-500">Slightly Rising</span>
                                </>
                              ) : (p.trend30Day ?? 0) < -5 ? (
                                <>
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                  <span className="text-sm font-medium text-red-500">Falling - Significant decline</span>
                                </>
                              ) : (p.trend30Day ?? 0) < 0 ? (
                                <>
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                  <span className="text-sm font-medium text-red-500">Slightly Falling</span>
                                </>
                              ) : (
                                <span className="text-sm font-medium text-muted-foreground">Stable - No significant movement</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3">Trade Tips</h3>
                          <div className="space-y-2 text-sm">
                            {(p.trend30Day ?? 0) > 5 && (
                              <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400">
                                Value is rising fast. Consider holding or selling at peak if you need depth.
                              </div>
                            )}
                            {(p.trend30Day ?? 0) < -5 && (
                              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400">
                                Value is dropping. Buy-low window may be open if you believe in the talent.
                              </div>
                            )}
                            {(p.elitePct ?? 0) >= 30 && (p.pickMultiplier ?? 0) >= 1.5 && (
                              <div className="p-2 bg-primary/10 border border-primary/30 rounded">
                                Premium prospect with high upside. Worth a 1st+ in most dynasty formats.
                              </div>
                            )}
                            {(p.bustPct ?? 0) >= 40 && (
                              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400">
                                High bust risk. Consider trading for more reliable assets if risk-averse.
                              </div>
                            )}
                            {(p.elitePct ?? 0) < 30 && (p.bustPct ?? 0) < 40 && Math.abs(p.trend30Day ?? 0) <= 5 && (
                              <div className="p-2 bg-muted/50 rounded text-muted-foreground">
                                Stable value, moderate upside. Fair trade target at current price.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="draftcapital" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-draftcapital">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card data-testid="card-draft-capital-simulation">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Layers className="h-4 w-4 text-amber-500" />
                            Draft Capital Simulation
                          </h3>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded" data-testid="metric-top10-prob">
                              <div className="text-xl font-bold text-green-500">{p.top10Pct ?? 0}%</div>
                              <div className="text-xs text-muted-foreground">Top 10</div>
                            </div>
                            <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded" data-testid="metric-day2-prob">
                              <div className="text-xl font-bold text-blue-500">
                                {Math.min(100, (p.roundProbabilities?.r2 ?? 0) + (p.roundProbabilities?.r3 ?? 0))}%
                              </div>
                              <div className="text-xs text-muted-foreground">Day 2 (Rd 2-3)</div>
                            </div>
                            <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded" data-testid="metric-udfa-prob">
                              <div className="text-xl font-bold text-red-500">{p.roundProbabilities?.udfa ?? 0}%</div>
                              <div className="text-xs text-muted-foreground">Undrafted</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {[
                              { label: "Round 1", value: p.roundProbabilities?.r1 ?? p.round1Pct ?? 0, color: "bg-green-500" },
                              { label: "Round 2", value: p.roundProbabilities?.r2 ?? 0, color: "bg-emerald-500" },
                              { label: "Round 3", value: p.roundProbabilities?.r3 ?? 0, color: "bg-blue-500" },
                              { label: "Round 4", value: p.roundProbabilities?.r4 ?? 0, color: "bg-sky-500" },
                              { label: "Round 5", value: p.roundProbabilities?.r5 ?? 0, color: "bg-yellow-500" },
                              { label: "Round 6", value: p.roundProbabilities?.r6 ?? 0, color: "bg-orange-500" },
                              { label: "Round 7", value: p.roundProbabilities?.r7 ?? 0, color: "bg-red-400" },
                              { label: "UDFA", value: p.roundProbabilities?.udfa ?? 0, color: "bg-red-600" },
                            ].map((round) => (
                              <div key={round.label} data-testid={`bar-round-${round.label.replace(/\s/g, "-").toLowerCase()}`}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className="text-muted-foreground">{round.label}</span>
                                  <span className="font-medium">{round.value}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2.5">
                                  <div
                                    className={`${round.color} h-2.5 rounded-full transition-all`}
                                    style={{ width: `${Math.min(100, round.value)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      {(() => {
                        const rp = p.roundProbabilities;
                        if (!rp) return null;
                        const expectedRound =
                          (rp.r1 * 1 + rp.r2 * 2 + rp.r3 * 3 + rp.r4 * 4 + rp.r5 * 5 + rp.r6 * 6 + rp.r7 * 7 + rp.udfa * 8) / 100;
                        const roundLabel = expectedRound <= 1.5 ? "Early Round 1" : expectedRound <= 2.5 ? "Late Round 1 / Early Round 2" : expectedRound <= 3.5 ? "Day 2 (Rounds 2-3)" : expectedRound <= 5 ? "Mid Rounds (4-5)" : expectedRound <= 7 ? "Late Rounds (6-7)" : "Likely Undrafted";
                        return (
                          <Card data-testid="card-expected-draft-position">
                            <CardContent className="p-4">
                              <h3 className="font-semibold mb-2">Expected Draft Position</h3>
                              <div className="flex items-center gap-3">
                                <div className="text-2xl font-bold text-primary" data-testid="text-expected-round">
                                  {expectedRound.toFixed(1)}
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{roundLabel}</div>
                                  <div className="text-xs text-muted-foreground">Weighted average round</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="trajectory" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-trajectory">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card data-testid="card-production-trajectory">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-blue-500" />
                            Production Trajectory
                          </h3>
                          {(() => {
                            const baseDom = p.dominatorRating ?? 15;
                            const isYoung = p.ageClass === "young-breakout";
                            const isOld = p.ageClass === "old-producer";
                            const growthRate = isYoung ? 1.35 : isOld ? 1.05 : 1.2;
                            const peakRate = isYoung ? 1.15 : isOld ? 0.95 : 1.05;
                            const trajectoryData = [
                              { year: "Year 1", dominator: Math.round(baseDom * 0.7), label: "Freshman" },
                              { year: "Year 2", dominator: Math.round(baseDom * growthRate * 0.85), label: "Sophomore" },
                              { year: "Year 3", dominator: Math.round(Math.min(baseDom * growthRate * peakRate, 55)), label: "Junior" },
                            ];
                            const breakoutPercentile = p.breakoutAge
                              ? p.breakoutAge <= 18 ? 99 : p.breakoutAge <= 19 ? 90 : p.breakoutAge <= 20 ? 70 : p.breakoutAge <= 21 ? 40 : 20
                              : null;
                            return (
                              <div>
                                <div className="h-48 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trajectoryData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                      <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                                      <YAxis tick={{ fontSize: 12 }} domain={[0, 60]} />
                                      <RechartsTooltip
                                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                                        labelStyle={{ color: "hsl(var(--foreground))" }}
                                        formatter={(value: number) => [`${value}%`, "Dominator"]}
                                      />
                                      <Line type="monotone" dataKey="dominator" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                                {breakoutPercentile !== null && (
                                  <div className="mt-3 p-3 bg-muted/30 rounded border" data-testid="panel-breakout-percentile">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-muted-foreground">Breakout Age Percentile</span>
                                      <Badge variant={breakoutPercentile >= 80 ? "default" : "secondary"} data-testid="badge-breakout-percentile">
                                        {breakoutPercentile}th percentile
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Breakout at age {p.breakoutAge} {breakoutPercentile >= 80 ? "- Elite early breakout" : breakoutPercentile >= 50 ? "- Above average timeline" : "- Standard development"}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                      <Card data-testid="card-dominator-context">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3">Dominator Context</h3>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <div className="text-xl font-bold">{p.dominatorRating ?? 0}%</div>
                              <div className="text-xs text-muted-foreground">Raw Dominator</div>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded" data-testid="metric-age-adj-dominator">
                              <div className="text-xl font-bold text-primary">{p.ageAdjustedDominator ?? 0}%</div>
                              <div className="text-xs text-muted-foreground">Age-Adjusted</div>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <div className="text-xl font-bold">{p.breakoutAge ?? "N/A"}</div>
                              <div className="text-xs text-muted-foreground">Breakout Age</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="valuation" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-valuation">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card data-testid="card-market-valuation">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            Market Valuation
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded" data-testid="metric-devy-pick-eq">
                              <div className="text-xs text-muted-foreground mb-1">Devy Pick Equivalent</div>
                              <div className="text-lg font-bold text-primary">{p.devyPickEquivalent || p.pickEquivalent || "N/A"}</div>
                            </div>
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded" data-testid="metric-rookie-pick-eq">
                              <div className="text-xs text-muted-foreground mb-1">Rookie Pick Equivalent</div>
                              <div className="text-lg font-bold text-blue-500">{p.rookiePickEquivalent || "N/A"}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="p-3 bg-muted/50 rounded" data-testid="metric-30day-change">
                              <div className="text-xs text-muted-foreground mb-1">30-Day Value Change</div>
                              <div className={`text-lg font-bold flex items-center gap-1 ${(p.trend30Day ?? 0) > 0 ? "text-green-500" : (p.trend30Day ?? 0) < 0 ? "text-red-500" : ""}`}>
                                {(p.trend30Day ?? 0) > 0 ? <TrendingUp className="h-4 w-4" /> : (p.trend30Day ?? 0) < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                                {(p.trend30Day ?? 0) > 0 ? "+" : ""}{p.trend30Day ?? 0}
                              </div>
                            </div>
                            <div className="p-3 bg-muted/50 rounded" data-testid="metric-season-change">
                              <div className="text-xs text-muted-foreground mb-1">Season Value Change</div>
                              <div className={`text-lg font-bold flex items-center gap-1 ${(p.seasonChange ?? 0) > 0 ? "text-green-500" : (p.seasonChange ?? 0) < 0 ? "text-red-500" : ""}`}>
                                {(p.seasonChange ?? 0) > 0 ? <TrendingUp className="h-4 w-4" /> : (p.seasonChange ?? 0) < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                                {(p.seasonChange ?? 0) > 0 ? "+" : ""}{p.seasonChange ?? 0}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card data-testid="card-rank-comparison">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3">Rank Comparison</h3>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-muted/50 rounded" data-testid="metric-market-rank">
                              <div className="text-xl font-bold">#{p.marketRank ?? p.rank ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">Market Rank</div>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded" data-testid="metric-model-rank">
                              <div className="text-xl font-bold text-primary">#{p.modelRank ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">Model Rank</div>
                            </div>
                            <div className="text-center p-3 rounded" data-testid="metric-rank-delta"
                              style={{ backgroundColor: (p.rankDelta ?? 0) > 0 ? "rgba(34,197,94,0.1)" : (p.rankDelta ?? 0) < 0 ? "rgba(239,68,68,0.1)" : "rgba(128,128,128,0.1)" }}
                            >
                              <div className={`text-xl font-bold ${(p.rankDelta ?? 0) > 0 ? "text-green-500" : (p.rankDelta ?? 0) < 0 ? "text-red-500" : ""}`}>
                                {(p.rankDelta ?? 0) > 0 ? "+" : ""}{p.rankDelta ?? 0}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(p.rankDelta ?? 0) > 3 ? "Undervalued" : (p.rankDelta ?? 0) < -3 ? "Overvalued" : "Fair Value"}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="riskbreakdown" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-riskbreakdown">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card data-testid="card-risk-breakdown">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Risk Breakdown
                          </h3>
                          {(() => {
                            const risks = [
                              { label: "Bust Risk", value: p.bustPct ?? 0, color: "bg-red-500" },
                              { label: "Transfer Risk", value: p.transferRisk ?? 0, color: "bg-orange-500" },
                              { label: "Competition Risk", value: p.competitionRisk ?? 0, color: "bg-yellow-500" },
                              { label: "Injury Risk", value: p.injuryRisk ?? 0, color: "bg-purple-500" },
                              { label: "Conference Adj.", value: 100 - (p.conferenceAdjustment ?? 80), color: "bg-blue-500" },
                            ];
                            const totalRisk = risks.reduce((sum, r) => sum + r.value, 0);
                            return (
                              <div className="space-y-4">
                                <div className="flex h-6 rounded-full overflow-hidden" data-testid="bar-risk-stacked">
                                  {risks.map((risk) => {
                                    const pct = totalRisk > 0 ? (risk.value / totalRisk) * 100 : 20;
                                    return pct > 0 ? (
                                      <div
                                        key={risk.label}
                                        className={`${risk.color} transition-all relative group`}
                                        style={{ width: `${pct}%` }}
                                        title={`${risk.label}: ${risk.value}%`}
                                      />
                                    ) : null;
                                  })}
                                </div>
                                <div className="space-y-2">
                                  {risks.map((risk) => (
                                    <div key={risk.label} className="flex items-center justify-between" data-testid={`risk-item-${risk.label.replace(/\s/g, "-").toLowerCase()}`}>
                                      <div className="flex items-center gap-2">
                                        <div className={`h-3 w-3 rounded-full ${risk.color}`} />
                                        <span className="text-sm">{risk.label}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-24 bg-muted rounded-full h-2">
                                          <div className={`${risk.color} h-2 rounded-full`} style={{ width: `${Math.min(100, risk.value)}%` }} />
                                        </div>
                                        <span className="text-sm font-medium w-10 text-right">{risk.value}%</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                      <Card data-testid="card-comp-confidence">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3">NFL Comp Confidence</h3>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">Comparison Confidence</span>
                                <span className="font-medium">{p.nflCompConfidence ?? 0}/100</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full ${(p.nflCompConfidence ?? 0) >= 70 ? "bg-green-500" : (p.nflCompConfidence ?? 0) >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                                  style={{ width: `${p.nflCompConfidence ?? 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {(p.nflCompConfidence ?? 0) >= 70
                              ? "Strong historical match to NFL comparison. Profile is well-defined."
                              : (p.nflCompConfidence ?? 0) >= 40
                              ? "Moderate match confidence. Some uncertainty in projection path."
                              : "Low comparison confidence. Prospect profile is unique or underdeveloped."}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="longterm" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-longterm">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card data-testid="card-long-term-outlook">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Brain className="h-4 w-4 text-purple-500" />
                            Long-Term Outlook
                          </h3>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded" data-testid="outcome-ceiling">
                              <div className="text-xs text-muted-foreground mb-1">Ceiling</div>
                              <div className="text-2xl font-bold text-green-500">{p.elitePct ?? 0}%</div>
                              <div className="text-xs text-green-400">Elite Producer</div>
                            </div>
                            <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded" data-testid="outcome-median">
                              <div className="text-xs text-muted-foreground mb-1">Median</div>
                              <div className="text-2xl font-bold text-blue-500">{p.starterPct ?? 0}%</div>
                              <div className="text-xs text-blue-400">Starter</div>
                            </div>
                            <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded" data-testid="outcome-floor">
                              <div className="text-xs text-muted-foreground mb-1">Floor</div>
                              <div className="text-2xl font-bold text-red-500">{p.bustPct ?? 0}%</div>
                              <div className="text-xs text-red-400">Bust</div>
                            </div>
                          </div>
                          {(() => {
                            const elitePct = p.elitePct ?? 0;
                            const starterPct = p.starterPct ?? 0;
                            const bustPct = p.bustPct ?? 0;
                            let projectedTier = "Role Player";
                            let tierColor = "text-muted-foreground";
                            let tierBg = "bg-muted/50";
                            if (elitePct >= 30 && bustPct < 25) {
                              projectedTier = "Elite";
                              tierColor = "text-green-500";
                              tierBg = "bg-green-500/10 border border-green-500/20";
                            } else if (starterPct >= 60 && bustPct < 30) {
                              projectedTier = "Starter";
                              tierColor = "text-blue-500";
                              tierBg = "bg-blue-500/10 border border-blue-500/20";
                            } else if (bustPct >= 40) {
                              projectedTier = "Bust Risk";
                              tierColor = "text-red-500";
                              tierBg = "bg-red-500/10 border border-red-500/20";
                            } else if (starterPct >= 40) {
                              projectedTier = "Starter";
                              tierColor = "text-blue-500";
                              tierBg = "bg-blue-500/10 border border-blue-500/20";
                            }
                            return (
                              <div className={`p-4 rounded ${tierBg}`} data-testid="panel-projected-tier">
                                <div className="text-xs text-muted-foreground mb-1">Projected NFL Tier</div>
                                <div className={`text-2xl font-bold ${tierColor}`} data-testid="text-projected-tier">
                                  {projectedTier}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {projectedTier === "Elite" && "Top-tier fantasy asset. Projected to be a league winner at the position."}
                                  {projectedTier === "Starter" && "Consistent fantasy contributor. Projects as a reliable weekly starter."}
                                  {projectedTier === "Role Player" && "Likely a depth piece or streaming option. Limited standalone fantasy value."}
                                  {projectedTier === "Bust Risk" && "High probability of failing to produce meaningful fantasy value."}
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                      <Card data-testid="card-breakout-probability">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            Breakout Probability
                          </h3>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="text-3xl font-bold text-primary" data-testid="text-breakout-prob">
                              {p.breakoutProbability ?? 0}%
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Chance of exceeding expectations based on age, production, and draft capital trajectory
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                (p.breakoutProbability ?? 0) >= 60 ? "bg-green-500" :
                                (p.breakoutProbability ?? 0) >= 35 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${p.breakoutProbability ?? 0}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>Low</span>
                            <span>High</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card data-testid="card-dvi-score">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3">Devy Value Index</h3>
                          <div className="flex items-center gap-3">
                            <div className="text-3xl font-bold text-primary" data-testid="text-dvi-score">
                              {p.dviScore ?? 0}
                            </div>
                            <div className="flex-1">
                              <div className="w-full bg-muted rounded-full h-3">
                                <div
                                  className="bg-primary h-3 rounded-full transition-all"
                                  style={{ width: `${p.dviScore ?? 0}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                <span>0</span>
                                <span>100</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </>
            ) : null}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
