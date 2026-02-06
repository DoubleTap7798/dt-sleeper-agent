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
  GraduationCap,
  Ruler,
  User,
  Activity,
  BarChart3,
  MapPin,
} from "lucide-react";

interface Draft2026Player {
  id: string;
  rank: number;
  name: string;
  college: string;
  position: string;
  height: string;
  weight: number;
  side: 'offense' | 'defense';
  positionGroup: string;
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

export function DraftProfileModal({ open, onOpenChange, player }: DraftProfileModalProps) {
  const { data, isLoading } = useQuery<DraftProfileData>({
    queryKey: [`/api/draft/2026/${encodeURIComponent(player?.name || '')}/profile`],
    enabled: !!player?.name && open,
    staleTime: 1000 * 60 * 10,
  });

  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden [&>button]:hidden" data-testid="modal-draft-profile">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="flex items-start gap-3">
              <Avatar className="h-14 w-14 shrink-0" data-testid="avatar-draft-player">
                <AvatarImage
                  src={data?.player?.headshot || undefined}
                  alt={player.name}
                />
                <AvatarFallback className="text-lg bg-muted">
                  {player.college.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl" data-testid="text-draft-player-name">
                  {player.name}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className={getPositionColorClass(player.position)} data-testid="badge-draft-position">
                      {player.position}
                    </Badge>
                    <Badge variant="outline" data-testid="badge-draft-college">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {player.college}
                    </Badge>
                    <Badge variant="outline" data-testid="badge-draft-rank">
                      #{player.rank}
                    </Badge>
                  </div>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card data-testid="stat-height">
                <CardContent className="p-3 text-center">
                  <Ruler className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-medium">{player.height}</div>
                  <div className="text-xs text-muted-foreground">Height</div>
                </CardContent>
              </Card>
              <Card data-testid="stat-weight">
                <CardContent className="p-3 text-center">
                  <User className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-medium">{player.weight} lbs</div>
                  <div className="text-xs text-muted-foreground">Weight</div>
                </CardContent>
              </Card>
              <Card data-testid="stat-side">
                <CardContent className="p-3 text-center">
                  <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-medium capitalize">{player.side}</div>
                  <div className="text-xs text-muted-foreground">Side</div>
                </CardContent>
              </Card>
              <Card data-testid="stat-group">
                <CardContent className="p-3 text-center">
                  <BarChart3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-medium">{player.positionGroup}</div>
                  <div className="text-xs text-muted-foreground">Pos Group</div>
                </CardContent>
              </Card>
            </div>

            {isLoading ? (
              <div className="space-y-3" data-testid="loading-profile">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : data ? (
              <Tabs defaultValue="bio" className="w-full">
                <TabsList className="w-full" data-testid="tabs-profile">
                  <TabsTrigger value="bio" className="flex-1" data-testid="tab-bio">Bio</TabsTrigger>
                  <TabsTrigger value="stats" className="flex-1" data-testid="tab-stats">Stats</TabsTrigger>
                  {data.cfbdAdvanced && (
                    <TabsTrigger value="advanced" className="flex-1" data-testid="tab-advanced">Advanced</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="bio" className="space-y-3 mt-3">
                  {data.bio ? (
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        {data.bio.hometown && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{data.bio.hometown}</span>
                          </div>
                        )}
                        {data.bio.conference && (
                          <div className="flex items-center gap-2 text-sm">
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            <span>{data.bio.conference}</span>
                          </div>
                        )}
                        {data.bio.class && (
                          <div className="text-sm text-muted-foreground">Class: {data.bio.class}</div>
                        )}
                        {data.bio.highSchoolRank && (
                          <div className="text-sm text-muted-foreground">HS Rank: {data.bio.highSchoolRank}</div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center p-4" data-testid="text-no-bio">
                      No bio data available
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="stats" className="space-y-3 mt-3">
                  {data.collegeStats.seasons.length > 0 ? (
                    <Card>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid="table-college-stats">
                            <thead className="border-b">
                              <tr className="text-left text-muted-foreground">
                                <th className="p-2">Year</th>
                                <th className="p-2">G</th>
                                {data.collegeStats.seasons.some(s => s.stats.passYds !== undefined) && (
                                  <>
                                    <th className="p-2">Pass Yds</th>
                                    <th className="p-2">Pass TD</th>
                                  </>
                                )}
                                {data.collegeStats.seasons.some(s => s.stats.rushYds !== undefined) && (
                                  <>
                                    <th className="p-2">Rush Yds</th>
                                    <th className="p-2">Rush TD</th>
                                  </>
                                )}
                                {data.collegeStats.seasons.some(s => s.stats.recYds !== undefined) && (
                                  <>
                                    <th className="p-2">Rec</th>
                                    <th className="p-2">Rec Yds</th>
                                    <th className="p-2">Rec TD</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {data.collegeStats.seasons.map((season, i) => (
                                <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                                  <td className="p-2 font-medium">{season.year}</td>
                                  <td className="p-2">{season.games}</td>
                                  {data.collegeStats.seasons.some(s => s.stats.passYds !== undefined) && (
                                    <>
                                      <td className="p-2">{season.stats.passYds ?? '-'}</td>
                                      <td className="p-2">{season.stats.passTd ?? '-'}</td>
                                    </>
                                  )}
                                  {data.collegeStats.seasons.some(s => s.stats.rushYds !== undefined) && (
                                    <>
                                      <td className="p-2">{season.stats.rushYds ?? '-'}</td>
                                      <td className="p-2">{season.stats.rushTd ?? '-'}</td>
                                    </>
                                  )}
                                  {data.collegeStats.seasons.some(s => s.stats.recYds !== undefined) && (
                                    <>
                                      <td className="p-2">{season.stats.receptions ?? '-'}</td>
                                      <td className="p-2">{season.stats.recYds ?? '-'}</td>
                                      <td className="p-2">{season.stats.recTd ?? '-'}</td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center p-4" data-testid="text-no-stats">
                      No college stats available
                    </div>
                  )}
                </TabsContent>

                {data.cfbdAdvanced && (
                  <TabsContent value="advanced" className="space-y-3 mt-3">
                    {data.cfbdAdvanced.usage && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2 text-sm">Usage Rates</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Overall</span>
                              <span className="font-medium">{(data.cfbdAdvanced.usage.overall * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pass</span>
                              <span className="font-medium">{(data.cfbdAdvanced.usage.pass * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Rush</span>
                              <span className="font-medium">{(data.cfbdAdvanced.usage.rush * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {data.cfbdAdvanced.ppa && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2 text-sm">PPA (Predicted Points Added)</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Avg PPA</span>
                              <span className="font-medium">{data.cfbdAdvanced.ppa.averagePPA.all.toFixed(3)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total PPA</span>
                              <span className="font-medium">{data.cfbdAdvanced.ppa.totalPPA.all.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Plays</span>
                              <span className="font-medium">{data.cfbdAdvanced.ppa.countablePlays}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            ) : (
              <div className="text-sm text-muted-foreground text-center p-4" data-testid="text-no-profile-data">
                No additional profile data available
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
