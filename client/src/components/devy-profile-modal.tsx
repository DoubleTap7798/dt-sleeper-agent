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
} from "lucide-react";

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

interface DevyComp {
  name: string;
  matchPct: number;
  wasSuccess: boolean;
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
    queryKey: [`/api/sleeper/devy/${player?.playerId}/profile`],
    enabled: !!player?.playerId && open && !isUnmatched,
    staleTime: 1000 * 60 * 10,
  });

  if (!effectivePlayer) return null;

  if (isUnmatched) {
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

  const p = player!;

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
                      <Badge variant="outline" data-testid="badge-draft-year">
                        {p.draftEligibleYear} Draft
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
              </>
            ) : null}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
