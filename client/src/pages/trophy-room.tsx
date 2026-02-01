import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Crown, TrendingUp, Award, Star, Target, Zap } from "lucide-react";
import type { LeagueChampion, AllTimeRecord, SeasonRecord } from "@/lib/sleeper-types";

interface TrophyRoomData {
  champions: LeagueChampion[];
  allTimeRecords: AllTimeRecord[];
  topPointsFor: AllTimeRecord | null;
  topWinPercentage: AllTimeRecord | null;
  bestSeasonRecord: SeasonRecord | null;
  bestSeasonPoints: SeasonRecord | null;
  bestSeasonMaxPoints: SeasonRecord | null;
  leagueName: string;
  leagueAge: number;
  seasons: string[];
}

export default function TrophyRoomPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading, error } = useQuery<TrophyRoomData>({
    queryKey: ["/api/sleeper/trophies", leagueId],
    enabled: !!leagueId,
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <TrophyRoomSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load trophy room</p>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Trophy Room">
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-trophy-title">
          Trophy Room
        </h2>
        <p className="text-muted-foreground">
          {data.leagueAge} season{data.leagueAge > 1 ? "s" : ""} of league history
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.bestSeasonRecord && (
          <Card className="border-2" data-testid="card-best-record">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <Award className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Best Season Record</p>
                  <p className="text-lg font-bold">{data.bestSeasonRecord.ownerName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {data.bestSeasonRecord.record}
                    </span>
                    <Badge variant="secondary">{data.bestSeasonRecord.season}</Badge>
                  </div>
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={data.bestSeasonRecord.avatar || undefined} />
                  <AvatarFallback className="text-sm">
                    {data.bestSeasonRecord.ownerName?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        )}

        {data.bestSeasonPoints && (
          <Card className="border-2" data-testid="card-best-season-pts">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Top Season Points</p>
                  <p className="text-lg font-bold">{data.bestSeasonPoints.ownerName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {data.bestSeasonPoints.value.toLocaleString()}
                    </span>
                    <Badge variant="secondary">{data.bestSeasonPoints.season}</Badge>
                  </div>
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={data.bestSeasonPoints.avatar || undefined} />
                  <AvatarFallback className="text-sm">
                    {data.bestSeasonPoints.ownerName?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        )}

        {data.bestSeasonMaxPoints && (
          <Card className="border-2" data-testid="card-best-max-pts">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <Target className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Top Season Max Points</p>
                  <p className="text-lg font-bold">{data.bestSeasonMaxPoints.ownerName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {data.bestSeasonMaxPoints.value.toLocaleString()}
                    </span>
                    <Badge variant="secondary">{data.bestSeasonMaxPoints.season}</Badge>
                  </div>
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={data.bestSeasonMaxPoints.avatar || undefined} />
                  <AvatarFallback className="text-sm">
                    {data.bestSeasonMaxPoints.ownerName?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-muted-foreground" />
              Hall of Champions
            </CardTitle>
            <CardDescription>
              League winners for all {data.leagueAge} seasons
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.champions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No champions recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {data.champions.map((champion, index) => (
                  <div
                    key={champion.season}
                    className="flex items-center gap-3 p-3 rounded-lg bg-accent/30"
                    data-testid={`champion-${champion.season}`}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10 ring-2 ring-border">
                        <AvatarImage src={champion.avatar || undefined} />
                        <AvatarFallback className="text-sm">
                          {champion.ownerName?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {index === 0 && (
                        <div className="absolute -top-1 -right-1">
                          <Star className="h-4 w-4 text-muted-foreground fill-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{champion.ownerName}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {champion.season}
                        </Badge>
                      </div>
                    </div>
                    <Trophy className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              All-Time Standings
            </CardTitle>
            <CardDescription>
              Total wins and losses across all {data.leagueAge} seasons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-center">Record</TableHead>
                  <TableHead className="text-right">Titles</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Points</TableHead>
                  <TableHead className="w-32 hidden lg:table-cell">Win Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.allTimeRecords.map((record, index) => (
                  <TableRow
                    key={record.ownerId}
                    data-testid={`alltime-record-${record.ownerId}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        {index + 1}
                        {index === 0 && <Crown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={record.avatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {record.ownerName?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate max-w-[100px]">
                          {record.ownerName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {record.totalWins}-{record.totalLosses}
                      {record.totalTies > 0 && `-${record.totalTies}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.championships > 0 && (
                        <div className="flex items-center justify-end gap-1">
                          <Trophy className="h-4 w-4 text-muted-foreground" />
                          <span className="font-bold">{record.championships}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">
                      {record.totalPointsFor.toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={record.winPercentage * 100}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs font-mono w-10 text-right">
                          {(record.winPercentage * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.topPointsFor && (
          <Card data-testid="card-top-points">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">All-Time Points Leader</p>
                  <p className="text-lg font-bold">{data.topPointsFor.ownerName}</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {data.topPointsFor.totalPointsFor.toLocaleString()} pts
                  </p>
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={data.topPointsFor.avatar || undefined} />
                  <AvatarFallback className="text-sm">
                    {data.topPointsFor.ownerName?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        )}

        {data.topWinPercentage && (
          <Card data-testid="card-top-win-pct">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <Award className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">All-Time Win Percentage</p>
                  <p className="text-lg font-bold">{data.topWinPercentage.ownerName}</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {(data.topWinPercentage.winPercentage * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.topWinPercentage.totalWins}-{data.topWinPercentage.totalLosses}
                    {data.topWinPercentage.totalTies > 0 && `-${data.topWinPercentage.totalTies}`}
                  </p>
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={data.topWinPercentage.avatar || undefined} />
                  <AvatarFallback className="text-sm">
                    {data.topWinPercentage.ownerName?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </PremiumGate>
  );
}

function TrophyRoomSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
