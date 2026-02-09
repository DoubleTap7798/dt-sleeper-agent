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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  GraduationCap,
  Ruler,
  User,
  Activity,
  BarChart3,
  MapPin,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Timer,
  Dumbbell,
  Star,
  X,
  Target,
  Newspaper,
} from "lucide-react";

interface CombineData {
  fortyYard: number | null;
  benchPress: number | null;
  vertical: number | null;
  broadJump: number | null;
  threeCone: number | null;
  shuttle: number | null;
  armLength: number | null;
  handSize: number | null;
}

interface DraftScoutingReport {
  strengths: string[];
  weaknesses: string[];
  nflComparison: string;
  draftProjection: string;
  fantasyOutlook: string;
}

interface Draft2026Player {
  id: string;
  rank: number;
  name: string;
  college: string;
  position: string;
  height: string;
  weight: number;
  side: "offense" | "defense";
  positionGroup: string;
  stockStatus: "rising" | "falling" | "steady";
  stockChange: number;
  combine: CombineData | null;
  intangibles: string[];
  scoutingNotes: string | null;
  scouting: DraftScoutingReport | null;
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
    tackles?: number;
    soloTackles?: number;
    astTackles?: number;
    sacks?: number;
    tfl?: number;
    passDeflect?: number;
    passInt?: number;
    defInt?: number;
    ff?: number;
    fr?: number;
    defTd?: number;
    qbHurries?: number;
    [key: string]: number | undefined;
  };
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
  };
  totalPPA: {
    all: number;
    pass: number;
    rush: number;
  };
}

interface CFBDAdvanced {
  seasonStats: Record<string, Record<string, number>>;
  usage: CFBDUsage | null;
  ppa: CFBDPPA | null;
}

interface Bio {
  height: string;
  weight: string;
  hometown: string;
  highSchoolRank: string;
  class: string;
  conference: string;
}

interface DraftProfileData {
  player: Draft2026Player & { headshot?: string | null };
  bio: Bio | null;
  collegeStats: {
    seasons: SeasonStats[];
    careerTotals: Record<string, number>;
  };
  cfbdAdvanced: CFBDAdvanced | null;
  espnId: string | null;
  generatedAt: string;
}

interface DraftProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Draft2026Player | null;
}

function getDraftProjectionColor(projection: string): string {
  if (projection.includes("Top 5")) return "text-green-500";
  if (projection.includes("Top 10")) return "text-green-400";
  if (projection.includes("Top 15")) return "text-emerald-400";
  if (projection.includes("Round 1")) return "text-blue-400";
  if (projection.includes("Round 2")) return "text-yellow-400";
  return "text-muted-foreground";
}

export function DraftProfileModal({
  open,
  onOpenChange,
  player,
}: DraftProfileModalProps) {
  const { data, isLoading } = useQuery<DraftProfileData>({
    queryKey: ["/api/draft/2026", encodeURIComponent(player?.name || ""), "profile"],
    enabled: !!player?.name && open,
    staleTime: 1000 * 60 * 10,
  });

  if (!player) return null;

  const profilePlayer = data?.player || player;
  const scouting = profilePlayer.scouting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden [&>button]:hidden"
        data-testid="modal-draft-profile"
      >
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-start justify-between gap-2 flex-wrap pr-2">
            <div className="flex items-start gap-3">
              <Avatar
                className="h-14 w-14 shrink-0"
                data-testid="avatar-draft-player"
              >
                <AvatarImage
                  src={data?.player?.headshot || undefined}
                  alt={player.name}
                />
                <AvatarFallback className="text-lg bg-muted">
                  {player.college.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle
                  className="text-xl"
                  data-testid="text-draft-player-name"
                >
                  {player.name}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1.5 mt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={getPositionColorClass(player.position)}
                        data-testid="badge-draft-position"
                      >
                        {player.position}
                      </Badge>
                      <Badge variant="outline" data-testid="badge-draft-college">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {player.college}
                      </Badge>
                      {player.stockStatus === "rising" && (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-600/30 bg-green-500/10"
                          data-testid="badge-stock-rising"
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Rising +{player.stockChange}
                        </Badge>
                      )}
                      {player.stockStatus === "falling" && (
                        <Badge
                          variant="outline"
                          className="text-red-600 border-red-600/30 bg-red-500/10"
                          data-testid="badge-stock-falling"
                        >
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Falling -{Math.abs(player.stockChange)}
                        </Badge>
                      )}
                    </div>
                    {player.intangibles && player.intangibles.length > 0 && (
                      <div
                        className="flex items-center gap-1.5 flex-wrap"
                        data-testid="intangibles-list"
                      >
                        {player.intangibles.map((trait, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs"
                            data-testid={`badge-intangible-${i}`}
                          >
                            <Sparkles className="h-2.5 w-2.5 mr-1" />
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-right shrink-0">
                <div className="text-lg font-bold" data-testid="text-draft-rank">
                  #{player.rank}
                </div>
                <div className="text-xs text-muted-foreground">Overall</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-draft-modal"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {scouting && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-draft-projection">
                <div className={`text-sm font-bold ${getDraftProjectionColor(scouting.draftProjection)}`}>
                  {scouting.draftProjection}
                </div>
                <div className="text-xs text-muted-foreground">Draft Projection</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-nfl-comp">
                <div className="text-sm font-bold">{scouting.nflComparison}</div>
                <div className="text-xs text-muted-foreground">NFL Comp</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-stock-movement">
                <div className="text-sm font-bold flex items-center justify-center gap-1">
                  {player.stockStatus === "rising" ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">+{player.stockChange}</span>
                    </>
                  ) : player.stockStatus === "falling" ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">-{Math.abs(player.stockChange)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Steady</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Stock Movement</div>
              </div>
            </div>
          )}

          {!scouting && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-sm font-bold">{player.height} / {player.weight} lbs</div>
                <div className="text-xs text-muted-foreground">Size</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-sm font-bold flex items-center justify-center gap-1">
                  {player.stockStatus === "rising" ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">+{player.stockChange}</span>
                    </>
                  ) : player.stockStatus === "falling" ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">-{Math.abs(player.stockChange)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Steady</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Stock Movement</div>
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
            <TabsTrigger value="advanced" className="text-xs sm:text-sm" data-testid="tab-advanced">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="combine" className="text-xs sm:text-sm" data-testid="tab-combine">
              <Timer className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Combine
            </TabsTrigger>
            {scouting && (
              <TabsTrigger value="scouting" className="text-xs sm:text-sm" data-testid="tab-scouting">
                <Newspaper className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Scouting
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
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
                              <span className="font-medium">{profilePlayer.height || "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Weight:</span>
                              <span className="font-medium">{profilePlayer.weight ? `${profilePlayer.weight} lbs` : "N/A"}</span>
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

                      {scouting && (
                        <Card data-testid="card-scouting-report">
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-3">Scouting Report</h3>
                            <div className="space-y-3 text-sm">
                              {scouting.strengths?.length > 0 && (
                                <div>
                                  <span className="font-medium">Strengths:</span>
                                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                    {scouting.strengths.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {scouting.weaknesses?.length > 0 && (
                                <div>
                                  <span className="font-medium">Areas to Develop:</span>
                                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                    {scouting.weaknesses.map((w, i) => (
                                      <li key={i}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div>
                                <span className="font-medium">NFL Comparison:</span>
                                <span className="ml-2 text-muted-foreground">{scouting.nflComparison}</span>
                              </div>
                              <div>
                                <span className="font-medium">Draft Projection:</span>
                                <span className={`ml-2 font-medium ${getDraftProjectionColor(scouting.draftProjection)}`}>
                                  {scouting.draftProjection}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {!scouting && profilePlayer.scoutingNotes && (
                        <Card data-testid="card-scouting-notes">
                          <CardContent className="p-4">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                              <Activity className="h-4 w-4 text-muted-foreground" />
                              Scouting Report
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-scouting-notes">
                              {profilePlayer.scoutingNotes}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="stats" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-stats">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
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
                              {(data.collegeStats.careerTotals.tackles ?? 0) > 0 && (
                                <>
                                  <div className="text-center p-2 bg-muted/50 rounded">
                                    <div className="text-lg font-bold">{data.collegeStats.careerTotals.tackles}</div>
                                    <div className="text-[10px] text-muted-foreground">Tackles</div>
                                  </div>
                                  {(data.collegeStats.careerTotals.soloTackles ?? 0) > 0 && (
                                    <div className="text-center p-2 bg-muted/50 rounded">
                                      <div className="text-lg font-bold">{data.collegeStats.careerTotals.soloTackles}</div>
                                      <div className="text-[10px] text-muted-foreground">Solo Tkl</div>
                                    </div>
                                  )}
                                </>
                              )}
                              {(data.collegeStats.careerTotals.sacks ?? 0) > 0 && (
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">{data.collegeStats.careerTotals.sacks}</div>
                                  <div className="text-[10px] text-muted-foreground">Sacks</div>
                                </div>
                              )}
                              {(data.collegeStats.careerTotals.tfl ?? 0) > 0 && (
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">{data.collegeStats.careerTotals.tfl}</div>
                                  <div className="text-[10px] text-muted-foreground">TFL</div>
                                </div>
                              )}
                              {(data.collegeStats.careerTotals.passInt ?? 0) > 0 && (
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">{data.collegeStats.careerTotals.passInt}</div>
                                  <div className="text-[10px] text-muted-foreground">INT</div>
                                </div>
                              )}
                              {(data.collegeStats.careerTotals.passDeflect ?? 0) > 0 && (
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">{data.collegeStats.careerTotals.passDeflect}</div>
                                  <div className="text-[10px] text-muted-foreground">PD</div>
                                </div>
                              )}
                              {(data.collegeStats.careerTotals.ff ?? 0) > 0 && (
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">{data.collegeStats.careerTotals.ff}</div>
                                  <div className="text-[10px] text-muted-foreground">FF</div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {data.collegeStats.seasons.length > 0 ? (
                        <Card>
                          <CardContent className="p-3">
                            <h3 className="font-semibold mb-2 text-sm">Season History</h3>
                            <div className="overflow-x-auto">
                              {(() => {
                                const hasPass = data.collegeStats.seasons.some(s => s.stats.passYds !== undefined);
                                const hasRush = data.collegeStats.seasons.some(s => s.stats.rushYds !== undefined);
                                const hasRec = data.collegeStats.seasons.some(s => s.stats.recYds !== undefined);
                                const hasTackles = data.collegeStats.seasons.some(s => s.stats.tackles !== undefined || s.stats.soloTackles !== undefined);
                                const hasSacks = data.collegeStats.seasons.some(s => s.stats.sacks !== undefined);
                                const hasTfl = data.collegeStats.seasons.some(s => s.stats.tfl !== undefined);
                                const hasPD = data.collegeStats.seasons.some(s => s.stats.passDeflect !== undefined);
                                const hasINT = data.collegeStats.seasons.some(s => s.stats.passInt !== undefined && data.player.side === "defense");
                                const hasFF = data.collegeStats.seasons.some(s => s.stats.ff !== undefined);

                                return (
                                  <table className="w-full text-[11px]" data-testid="table-college-stats">
                                    <thead className="border-b">
                                      <tr className="text-left text-muted-foreground">
                                        <th className="px-1 py-1 sticky left-0 bg-card z-10">Yr</th>
                                        <th className="px-1 py-1">G</th>
                                        {hasPass && <><th className="px-1 py-1">PaY</th><th className="px-1 py-1">PaT</th></>}
                                        {hasRush && <><th className="px-1 py-1">RuY</th><th className="px-1 py-1">RuT</th></>}
                                        {hasRec && <><th className="px-1 py-1">Rec</th><th className="px-1 py-1">ReY</th><th className="px-1 py-1">ReT</th></>}
                                        {hasTackles && <><th className="px-1 py-1">Tkl</th><th className="px-1 py-1">Solo</th></>}
                                        {hasSacks && <th className="px-1 py-1">Sack</th>}
                                        {hasTfl && <th className="px-1 py-1">TFL</th>}
                                        {hasPD && <th className="px-1 py-1">PD</th>}
                                        {hasINT && <th className="px-1 py-1">INT</th>}
                                        {hasFF && <th className="px-1 py-1">FF</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {data.collegeStats.seasons.map((season, i) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                                          <td className="px-1 py-1 font-medium sticky left-0 bg-inherit z-10">{season.year}</td>
                                          <td className="px-1 py-1">{season.games}</td>
                                          {hasPass && <><td className="px-1 py-1">{season.stats.passYds ?? "-"}</td><td className="px-1 py-1">{season.stats.passTd ?? "-"}</td></>}
                                          {hasRush && <><td className="px-1 py-1">{season.stats.rushYds ?? "-"}</td><td className="px-1 py-1">{season.stats.rushTd ?? "-"}</td></>}
                                          {hasRec && <><td className="px-1 py-1">{season.stats.receptions ?? "-"}</td><td className="px-1 py-1">{season.stats.recYds ?? "-"}</td><td className="px-1 py-1">{season.stats.recTd ?? "-"}</td></>}
                                          {hasTackles && <><td className="px-1 py-1">{season.stats.tackles ?? "-"}</td><td className="px-1 py-1">{season.stats.soloTackles ?? "-"}</td></>}
                                          {hasSacks && <td className="px-1 py-1">{season.stats.sacks ?? "-"}</td>}
                                          {hasTfl && <td className="px-1 py-1">{season.stats.tfl ?? "-"}</td>}
                                          {hasPD && <td className="px-1 py-1">{season.stats.passDeflect ?? "-"}</td>}
                                          {hasINT && <td className="px-1 py-1">{season.stats.passInt ?? "-"}</td>}
                                          {hasFF && <td className="px-1 py-1">{season.stats.ff ?? "-"}</td>}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <h3 className="font-semibold mb-2">Stats Not Available</h3>
                            <p className="text-sm text-muted-foreground">
                              College statistics for {player.name} are not yet available.
                              This may be because ESPN hasn't updated their data.
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
                      {data.cfbdAdvanced?.usage && (
                        <Card>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-2 text-sm">Usage Rates</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Overall</span>
                                <span className="font-medium">{(data.cfbdAdvanced.usage.overall * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Pass</span>
                                <span className="font-medium">{(data.cfbdAdvanced.usage.pass * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Rush</span>
                                <span className="font-medium">{(data.cfbdAdvanced.usage.rush * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">1st Down</span>
                                <span className="font-medium">{(data.cfbdAdvanced.usage.firstDown * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">3rd Down</span>
                                <span className="font-medium">{(data.cfbdAdvanced.usage.thirdDown * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Passing Downs</span>
                                <span className="font-medium">{(data.cfbdAdvanced.usage.passingDowns * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {data.cfbdAdvanced?.ppa && (
                        <Card>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-2 text-sm">PPA (Predicted Points Added)</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Avg PPA</span>
                                <span className="font-medium">{data.cfbdAdvanced.ppa.averagePPA.all.toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Total PPA</span>
                                <span className="font-medium">{data.cfbdAdvanced.ppa.totalPPA.all.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Pass PPA</span>
                                <span className="font-medium">{data.cfbdAdvanced.ppa.averagePPA.pass.toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Rush PPA</span>
                                <span className="font-medium">{data.cfbdAdvanced.ppa.averagePPA.rush.toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Plays</span>
                                <span className="font-medium">{data.cfbdAdvanced.ppa.countablePlays}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {!data.cfbdAdvanced?.usage && !data.cfbdAdvanced?.ppa && data.collegeStats && (() => {
                        const ct = data.collegeStats.careerTotals;
                        const numSeasons = data.collegeStats.seasons.length || 1;
                        const hasDefStats = ct.tackles || ct.sacks || ct.soloTackles || ct.tfl || ct.passInt || ct.passDeflect || ct.ff || ct.qbHurries;
                        if (!hasDefStats) return (
                          <div className="text-sm text-muted-foreground text-center p-4" data-testid="text-no-advanced">
                            No advanced metrics available for this player
                          </div>
                        );

                        const statItems: Array<{ label: string; value: string; perSeason?: string }> = [];
                        if (ct.tackles) statItems.push({ label: "Total Tackles", value: String(ct.tackles), perSeason: (ct.tackles / numSeasons).toFixed(1) });
                        if (ct.soloTackles) statItems.push({ label: "Solo Tackles", value: String(ct.soloTackles), perSeason: (ct.soloTackles / numSeasons).toFixed(1) });
                        if (ct.sacks) statItems.push({ label: "Sacks", value: String(ct.sacks), perSeason: (ct.sacks / numSeasons).toFixed(1) });
                        if (ct.tfl) statItems.push({ label: "Tackles for Loss", value: String(ct.tfl), perSeason: (ct.tfl / numSeasons).toFixed(1) });
                        if (ct.qbHurries) statItems.push({ label: "QB Hurries", value: String(ct.qbHurries), perSeason: (ct.qbHurries / numSeasons).toFixed(1) });
                        if (ct.passDeflect) statItems.push({ label: "Pass Deflections", value: String(ct.passDeflect), perSeason: (ct.passDeflect / numSeasons).toFixed(1) });
                        if (ct.passInt) statItems.push({ label: "Interceptions", value: String(ct.passInt), perSeason: (ct.passInt / numSeasons).toFixed(1) });
                        if (ct.ff) statItems.push({ label: "Forced Fumbles", value: String(ct.ff), perSeason: (ct.ff / numSeasons).toFixed(1) });
                        if (ct.fr) statItems.push({ label: "Fumble Recoveries", value: String(ct.fr) });
                        if (ct.defTd) statItems.push({ label: "Defensive TDs", value: String(ct.defTd) });

                        const tackleEff = ct.tackles && ct.soloTackles ? ((ct.soloTackles / ct.tackles) * 100).toFixed(1) : null;
                        const sackToTflRatio = ct.sacks && ct.tfl ? ((ct.sacks / ct.tfl) * 100).toFixed(1) : null;

                        return (
                          <>
                            <Card>
                              <CardContent className="p-4">
                                <h4 className="font-semibold mb-2 text-sm" data-testid="heading-def-career">
                                  Career Defensive Totals ({numSeasons} season{numSeasons !== 1 ? "s" : ""})
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {statItems.map((item) => (
                                    <div key={item.label} className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">{item.label}</span>
                                      <span className="font-medium" data-testid={`stat-def-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                                        {item.value}
                                        {item.perSeason && (
                                          <span className="text-muted-foreground text-xs ml-1">({item.perSeason}/szn)</span>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                            {(tackleEff || sackToTflRatio) && (
                              <Card>
                                <CardContent className="p-4">
                                  <h4 className="font-semibold mb-2 text-sm" data-testid="heading-def-efficiency">
                                    Efficiency Metrics
                                  </h4>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    {tackleEff && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Solo Tackle Rate</span>
                                        <span className="font-medium" data-testid="stat-solo-tackle-rate">{tackleEff}%</span>
                                      </div>
                                    )}
                                    {sackToTflRatio && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Sack/TFL Rate</span>
                                        <span className="font-medium" data-testid="stat-sack-tfl-rate">{sackToTflRatio}%</span>
                                      </div>
                                    )}
                                    {ct.tackles && ct.sacks && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Tackles/Sack Ratio</span>
                                        <span className="font-medium" data-testid="stat-tkl-sack-ratio">{(ct.tackles / ct.sacks).toFixed(1)}</span>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="combine" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-combine">
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      {profilePlayer.combine ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="combine-metrics-grid">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-forty-yard">
                                <CardContent className="p-3 text-center">
                                  <Timer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.fortyYard != null ? `${profilePlayer.combine.fortyYard}s` : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">40-Yard Dash</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>40-Yard Dash Time</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-bench-press">
                                <CardContent className="p-3 text-center">
                                  <Dumbbell className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.benchPress != null ? profilePlayer.combine.benchPress : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Bench Press</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>Bench Press Reps</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-vertical">
                                <CardContent className="p-3 text-center">
                                  <Ruler className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.vertical != null ? `${profilePlayer.combine.vertical}"` : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Vertical Jump</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>Vertical Jump Height</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-broad-jump">
                                <CardContent className="p-3 text-center">
                                  <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.broadJump != null ? `${profilePlayer.combine.broadJump}"` : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Broad Jump</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>Broad Jump Distance</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-three-cone">
                                <CardContent className="p-3 text-center">
                                  <BarChart3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.threeCone != null ? `${profilePlayer.combine.threeCone}s` : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">3-Cone Drill</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>3-Cone Drill Time</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-shuttle">
                                <CardContent className="p-3 text-center">
                                  <Timer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.shuttle != null ? `${profilePlayer.combine.shuttle}s` : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">20-Yard Shuttle</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>20-Yard Shuttle Time</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-arm-length">
                                <CardContent className="p-3 text-center">
                                  <Ruler className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.armLength != null ? `${profilePlayer.combine.armLength}"` : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Arm Length</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>Arm Length</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card data-testid="combine-hand-size">
                                <CardContent className="p-3 text-center">
                                  <User className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    {profilePlayer.combine.handSize != null ? `${profilePlayer.combine.handSize}"` : "N/A"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Hand Size</div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent>Hand Size</TooltipContent>
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3" data-testid="combine-coming-soon">
                          <Timer className="h-10 w-10 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">NFL Combine data will be available after the combine</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Check back for 40-yard dash, bench press, vertical, broad jump, 3-cone, and shuttle times
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {scouting && (
                  <TabsContent value="scouting" className="m-0 h-full data-[state=active]:flex flex-col" data-testid="content-scouting">
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                        <Card>
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              Fantasy Outlook
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {scouting.fantasyOutlook}
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-3">Detailed Scouting</h3>
                            <div className="space-y-3 text-sm">
                              {scouting.strengths?.length > 0 && (
                                <div>
                                  <span className="font-medium text-green-500">Strengths:</span>
                                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                    {scouting.strengths.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {scouting.weaknesses?.length > 0 && (
                                <div>
                                  <span className="font-medium text-red-400">Areas to Develop:</span>
                                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                    {scouting.weaknesses.map((w, i) => (
                                      <li key={i}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-3">Draft Intelligence</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="p-3 bg-muted/50 rounded">
                                <div className="text-xs text-muted-foreground mb-1">NFL Comparison</div>
                                <div className="font-medium">{scouting.nflComparison}</div>
                              </div>
                              <div className="p-3 bg-muted/50 rounded">
                                <div className="text-xs text-muted-foreground mb-1">Draft Projection</div>
                                <div className={`font-medium ${getDraftProjectionColor(scouting.draftProjection)}`}>
                                  {scouting.draftProjection}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}
              </>
            ) : (
              <div className="p-4 text-center text-muted-foreground" data-testid="text-no-profile-data">
                No additional profile data available
              </div>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
