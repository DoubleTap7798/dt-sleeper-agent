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

export function DraftProfileModal({
  open,
  onOpenChange,
  player,
}: DraftProfileModalProps) {
  const { data, isLoading } = useQuery<DraftProfileData>({
    queryKey: [
      `/api/draft/2026/${encodeURIComponent(player?.name || "")}/profile`,
    ],
    enabled: !!player?.name && open,
    staleTime: 1000 * 60 * 10,
  });

  if (!player) return null;

  const profilePlayer = data?.player || player;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden [&>button]:hidden"
        data-testid="modal-draft-profile"
      >
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-start justify-between gap-2 flex-wrap pr-8">
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
                      <Badge variant="outline" data-testid="badge-draft-rank">
                        #{player.rank}
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
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3" data-testid="loading-profile">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : data ? (
              <Tabs defaultValue="bio" className="w-full">
                <TabsList className="w-full" data-testid="tabs-profile">
                  <TabsTrigger
                    value="bio"
                    className="flex-1"
                    data-testid="tab-bio"
                  >
                    Bio
                  </TabsTrigger>
                  <TabsTrigger
                    value="stats"
                    className="flex-1"
                    data-testid="tab-stats"
                  >
                    Stats
                  </TabsTrigger>
                  {(data.cfbdAdvanced || (data.collegeStats?.careerTotals && (data.collegeStats.careerTotals.tackles || data.collegeStats.careerTotals.sacks || data.collegeStats.careerTotals.passInt || data.collegeStats.careerTotals.passDeflect || data.collegeStats.careerTotals.ff || data.collegeStats.careerTotals.qbHurries || data.collegeStats.careerTotals.tfl))) && (
                    <TabsTrigger
                      value="advanced"
                      className="flex-1"
                      data-testid="tab-advanced"
                    >
                      Advanced
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="combine"
                    className="flex-1"
                    data-testid="tab-combine"
                  >
                    Combine
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="bio" className="space-y-3 mt-3">
                  {data.bio ? (
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        {data.bio.hometown && (
                          <div
                            className="flex items-center gap-2 text-sm"
                            data-testid="text-bio-hometown"
                          >
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{data.bio.hometown}</span>
                          </div>
                        )}
                        {data.bio.conference && (
                          <div
                            className="flex items-center gap-2 text-sm"
                            data-testid="text-bio-conference"
                          >
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            <span>{data.bio.conference}</span>
                          </div>
                        )}
                        {data.bio.class && (
                          <div
                            className="text-sm text-muted-foreground"
                            data-testid="text-bio-class"
                          >
                            Class: {data.bio.class}
                          </div>
                        )}
                        {data.bio.highSchoolRank && (
                          <div
                            className="text-sm text-muted-foreground"
                            data-testid="text-bio-hs-rank"
                          >
                            HS Rank: {data.bio.highSchoolRank}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div
                      className="text-sm text-muted-foreground text-center p-4"
                      data-testid="text-no-bio"
                    >
                      Bio data loading from ESPN. Some prospects may not have
                      ESPN profiles yet.
                    </div>
                  )}

                  {profilePlayer.scoutingNotes && (
                    <Card data-testid="card-scouting-report">
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          Scouting Report
                        </h4>
                        <p
                          className="text-sm text-muted-foreground leading-relaxed"
                          data-testid="text-scouting-notes"
                        >
                          {profilePlayer.scoutingNotes}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="stats" className="space-y-3 mt-3">
                  {data.collegeStats.seasons.length > 0 ? (
                    <Card>
                      <CardContent className="p-0">
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
                            const isDefensive = hasTackles || hasSacks;

                            return (
                              <table className="w-full text-sm" data-testid="table-college-stats">
                                <thead className="border-b">
                                  <tr className="text-left text-muted-foreground">
                                    <th className="p-2">Year</th>
                                    <th className="p-2">G</th>
                                    {hasPass && <><th className="p-2">Pass Yds</th><th className="p-2">Pass TD</th></>}
                                    {hasRush && <><th className="p-2">Rush Yds</th><th className="p-2">Rush TD</th></>}
                                    {hasRec && <><th className="p-2">Rec</th><th className="p-2">Rec Yds</th><th className="p-2">Rec TD</th></>}
                                    {hasTackles && <><th className="p-2">Tkl</th><th className="p-2">Solo</th></>}
                                    {hasSacks && <th className="p-2">Sack</th>}
                                    {hasTfl && <th className="p-2">TFL</th>}
                                    {hasPD && <th className="p-2">PD</th>}
                                    {hasINT && <th className="p-2">INT</th>}
                                    {hasFF && <th className="p-2">FF</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.collegeStats.seasons.map((season, i) => (
                                    <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                                      <td className="p-2 font-medium">{season.year}</td>
                                      <td className="p-2">{season.games}</td>
                                      {hasPass && <><td className="p-2">{season.stats.passYds ?? "-"}</td><td className="p-2">{season.stats.passTd ?? "-"}</td></>}
                                      {hasRush && <><td className="p-2">{season.stats.rushYds ?? "-"}</td><td className="p-2">{season.stats.rushTd ?? "-"}</td></>}
                                      {hasRec && <><td className="p-2">{season.stats.receptions ?? "-"}</td><td className="p-2">{season.stats.recYds ?? "-"}</td><td className="p-2">{season.stats.recTd ?? "-"}</td></>}
                                      {hasTackles && <><td className="p-2">{season.stats.tackles ?? "-"}</td><td className="p-2">{season.stats.soloTackles ?? "-"}</td></>}
                                      {hasSacks && <td className="p-2">{season.stats.sacks ?? "-"}</td>}
                                      {hasTfl && <td className="p-2">{season.stats.tfl ?? "-"}</td>}
                                      {hasPD && <td className="p-2">{season.stats.passDeflect ?? "-"}</td>}
                                      {hasINT && <td className="p-2">{season.stats.passInt ?? "-"}</td>}
                                      {hasFF && <td className="p-2">{season.stats.ff ?? "-"}</td>}
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
                    <div
                      className="text-sm text-muted-foreground text-center p-4"
                      data-testid="text-no-stats"
                    >
                      No college stats available
                    </div>
                  )}
                </TabsContent>

                {(data.cfbdAdvanced || (data.collegeStats?.careerTotals && (data.collegeStats.careerTotals.tackles || data.collegeStats.careerTotals.sacks || data.collegeStats.careerTotals.passInt || data.collegeStats.careerTotals.passDeflect || data.collegeStats.careerTotals.ff || data.collegeStats.careerTotals.qbHurries || data.collegeStats.careerTotals.tfl))) && (
                  <TabsContent value="advanced" className="space-y-3 mt-3">
                    {data.cfbdAdvanced?.usage && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2 text-sm">
                            Usage Rates
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">
                                Overall
                              </span>
                              <span className="font-medium">
                                {(
                                  data.cfbdAdvanced.usage.overall * 100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">
                                Pass
                              </span>
                              <span className="font-medium">
                                {(data.cfbdAdvanced.usage.pass * 100).toFixed(
                                  1
                                )}
                                %
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">
                                Rush
                              </span>
                              <span className="font-medium">
                                {(data.cfbdAdvanced.usage.rush * 100).toFixed(
                                  1
                                )}
                                %
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {data.cfbdAdvanced?.ppa && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2 text-sm">
                            PPA (Predicted Points Added)
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">
                                Avg PPA
                              </span>
                              <span className="font-medium">
                                {data.cfbdAdvanced.ppa.averagePPA.all.toFixed(
                                  3
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">
                                Total PPA
                              </span>
                              <span className="font-medium">
                                {data.cfbdAdvanced.ppa.totalPPA.all.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">
                                Plays
                              </span>
                              <span className="font-medium">
                                {data.cfbdAdvanced.ppa.countablePlays}
                              </span>
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
                  </TabsContent>
                )}

                <TabsContent value="combine" className="space-y-3 mt-3">
                  {profilePlayer.combine ? (
                    <div
                      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                      data-testid="combine-metrics-grid"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Card data-testid="combine-forty-yard">
                            <CardContent className="p-3 text-center">
                              <Timer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <div className="text-sm font-medium">
                                {profilePlayer.combine.fortyYard != null
                                  ? `${profilePlayer.combine.fortyYard}s`
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                40-Yard Dash
                              </div>
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
                                {profilePlayer.combine.benchPress != null
                                  ? profilePlayer.combine.benchPress
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Bench Press
                              </div>
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
                                {profilePlayer.combine.vertical != null
                                  ? `${profilePlayer.combine.vertical}"`
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Vertical Jump
                              </div>
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
                                {profilePlayer.combine.broadJump != null
                                  ? `${profilePlayer.combine.broadJump}"`
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Broad Jump
                              </div>
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
                                {profilePlayer.combine.threeCone != null
                                  ? `${profilePlayer.combine.threeCone}s`
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                3-Cone Drill
                              </div>
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
                                {profilePlayer.combine.shuttle != null
                                  ? `${profilePlayer.combine.shuttle}s`
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                20-Yard Shuttle
                              </div>
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
                                {profilePlayer.combine.armLength != null
                                  ? `${profilePlayer.combine.armLength}"`
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Arm Length
                              </div>
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
                                {profilePlayer.combine.handSize != null
                                  ? `${profilePlayer.combine.handSize}"`
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Hand Size
                              </div>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent>Hand Size</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center py-8 text-center space-y-3"
                      data-testid="combine-coming-soon"
                    >
                      <Timer className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          NFL Combine data will be available after the combine
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Check back for 40-yard dash, bench press, vertical,
                          broad jump, 3-cone, and shuttle times
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div
                className="text-sm text-muted-foreground text-center p-4"
                data-testid="text-no-profile-data"
              >
                No additional profile data available
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
