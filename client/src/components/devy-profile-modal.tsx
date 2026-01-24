import { useQuery } from "@tanstack/react-query";
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
import {
  User,
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

interface NewsItem {
  headline: string;
  summary: string;
  date: string;
}

interface ScoutingReport {
  strengths: string[];
  weaknesses: string[];
  nflComparison: string;
  draftProjection: string;
  fantasyOutlook: string;
}

interface DevyProfileData {
  player: DevyPlayer;
  bio: Bio;
  collegeStats: {
    seasons: SeasonStats[];
    careerTotals: Record<string, number>;
  };
  gameLogs: GameLog[];
  news: NewsItem[];
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
    positionRank: number;
    college: string;
    draftEligibleYear: number;
    tier: number;
    value: number;
    trend30Day: number;
    rank: number;
  } | null;
}

export function DevyProfileModal({ open, onOpenChange, player }: DevyProfileModalProps) {
  const { data, isLoading, error } = useQuery<DevyProfileData>({
    queryKey: [`/api/sleeper/devy/${player?.playerId}/profile`],
    enabled: !!player?.playerId && open,
    staleTime: 1000 * 60 * 10,
  });

  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden" data-testid="modal-devy-profile">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-xl" data-testid="text-player-name">
                {player.name}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" data-testid="badge-position">
                    {player.position}{player.positionRank}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-college">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {player.college}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-draft-year">
                    {player.draftEligibleYear} Draft
                  </Badge>
                </div>
              </DialogDescription>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold" data-testid="text-rank">
                #{player.rank}
              </div>
              <div className="text-xs text-muted-foreground">Overall</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-tier">
              <div className="text-lg font-bold">{player.tier}</div>
              <div className="text-xs text-muted-foreground">Tier</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-value">
              <div className="text-lg font-bold">{player.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">KTC</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-pos-rank">
              <div className="text-lg font-bold">{player.position}{player.positionRank}</div>
              <div className="text-xs text-muted-foreground">Pos Rank</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded" data-testid="stat-trend">
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                {player.trend30Day > 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    +{player.trend30Day}
                  </>
                ) : player.trend30Day < 0 ? (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    {player.trend30Day}
                  </>
                ) : (
                  "-"
                )}
              </div>
              <div className="text-xs text-muted-foreground">30-Day</div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="bio" className="flex flex-col flex-1 min-h-0">
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
            <TabsTrigger value="news" className="text-xs sm:text-sm" data-testid="tab-news">
              <Newspaper className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              News
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
                <TabsContent value="bio" className="m-0 h-full overflow-auto" data-testid="content-bio">
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
                </TabsContent>

                <TabsContent value="stats" className="m-0 h-full overflow-auto" data-testid="content-stats">
                  <div className="p-4 space-y-4">
                  {data.collegeStats?.careerTotals && Object.keys(data.collegeStats.careerTotals).length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">Career Totals</h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {data.collegeStats.careerTotals.games > 0 && (
                            <div className="text-center p-2 bg-muted/50 rounded">
                              <div className="text-xl font-bold">{data.collegeStats.careerTotals.games}</div>
                              <div className="text-xs text-muted-foreground">Games</div>
                            </div>
                          )}
                          {(data.collegeStats.careerTotals.passYds ?? 0) > 0 && (
                            <>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-xl font-bold">{data.collegeStats.careerTotals.passYds?.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Pass Yds</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-xl font-bold">{data.collegeStats.careerTotals.passTd}</div>
                                <div className="text-xs text-muted-foreground">Pass TD</div>
                              </div>
                            </>
                          )}
                          {(data.collegeStats.careerTotals.rushYds ?? 0) > 0 && (
                            <>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-xl font-bold">{data.collegeStats.careerTotals.rushYds?.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Rush Yds</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-xl font-bold">{data.collegeStats.careerTotals.rushTd}</div>
                                <div className="text-xs text-muted-foreground">Rush TD</div>
                              </div>
                            </>
                          )}
                          {(data.collegeStats.careerTotals.recYds ?? 0) > 0 && (
                            <>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-xl font-bold">{data.collegeStats.careerTotals.receptions}</div>
                                <div className="text-xs text-muted-foreground">Rec</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-xl font-bold">{data.collegeStats.careerTotals.recYds?.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Rec Yds</div>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <div className="text-xl font-bold">{data.collegeStats.careerTotals.recTd}</div>
                                <div className="text-xs text-muted-foreground">Rec TD</div>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {data.collegeStats?.seasons?.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">Season History</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b">
                              <tr className="text-left text-muted-foreground">
                                <th className="p-2">Year</th>
                                <th className="p-2">G</th>
                                {player.position === "QB" ? (
                                  <>
                                    <th className="p-2">Pass Yds</th>
                                    <th className="p-2">Pass TD</th>
                                    <th className="p-2">Rush Yds</th>
                                  </>
                                ) : player.position === "RB" ? (
                                  <>
                                    <th className="p-2">Rush Yds</th>
                                    <th className="p-2">Rush TD</th>
                                    <th className="p-2">Rec</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="p-2">Rec</th>
                                    <th className="p-2">Rec Yds</th>
                                    <th className="p-2">Rec TD</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {data.collegeStats.seasons.map((season, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                                  <td className="p-2 font-medium">{season.year}</td>
                                  <td className="p-2">{season.games}</td>
                                  {player.position === "QB" ? (
                                    <>
                                      <td className="p-2">{season.stats.passYds?.toLocaleString() || 0}</td>
                                      <td className="p-2">{season.stats.passTd || 0}</td>
                                      <td className="p-2">{season.stats.rushYds?.toLocaleString() || 0}</td>
                                    </>
                                  ) : player.position === "RB" ? (
                                    <>
                                      <td className="p-2">{season.stats.rushYds?.toLocaleString() || 0}</td>
                                      <td className="p-2">{season.stats.rushTd || 0}</td>
                                      <td className="p-2">{season.stats.receptions || 0}</td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="p-2">{season.stats.receptions || 0}</td>
                                      <td className="p-2">{season.stats.recYds?.toLocaleString() || 0}</td>
                                      <td className="p-2">{season.stats.recTd || 0}</td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  </div>
                </TabsContent>

                <TabsContent value="games" className="m-0 h-full overflow-auto" data-testid="content-games">
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
                    <div className="text-center py-8 text-muted-foreground">
                      No game logs available
                    </div>
                  )}
                  </div>
                </TabsContent>

                <TabsContent value="news" className="m-0 h-full overflow-auto" data-testid="content-news">
                  <div className="p-4">
                  {data.news?.length > 0 ? (
                    <div className="space-y-3">
                      {data.news.map((item, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-1">{item.headline}</h4>
                            <p className="text-sm text-muted-foreground mb-2">{item.summary}</p>
                            <span className="text-xs text-muted-foreground">{item.date}</span>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent news available
                    </div>
                  )}
                  </div>
                </TabsContent>
              </>
            ) : null}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
