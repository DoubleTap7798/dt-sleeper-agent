import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
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
import { Trophy, Crown, TrendingUp, Award, Star } from "lucide-react";
import type { LeagueChampion, AllTimeRecord } from "@/lib/sleeper-types";

interface TrophyRoomData {
  champions: LeagueChampion[];
  allTimeRecords: AllTimeRecord[];
  topPointsFor: AllTimeRecord | null;
  topWinPercentage: AllTimeRecord | null;
  leagueName: string;
  leagueAge: number;
}

export default function TrophyRoomPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading, error } = useQuery<TrophyRoomData>({
    queryKey: ["/api/sleeper/trophies", leagueId],
    enabled: !!leagueId,
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

  const maxWins = Math.max(...data.allTimeRecords.map((r) => r.totalWins), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-trophy-title">
          Trophy Room
        </h2>
        <p className="text-muted-foreground">
          League history and all-time records
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.topPointsFor && (
          <Card className="border-2" data-testid="card-top-points">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Top Points All-Time</p>
                  <p className="text-xl font-bold">{data.topPointsFor.ownerName}</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {data.topPointsFor.totalPointsFor.toLocaleString()} pts
                  </p>
                </div>
                <Avatar className="h-12 w-12">
                  <AvatarImage src={data.topPointsFor.avatar || undefined} />
                  <AvatarFallback>
                    {data.topPointsFor.ownerName?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        )}

        {data.topWinPercentage && (
          <Card className="border-2" data-testid="card-top-win-pct">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <Award className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Best Win Percentage</p>
                  <p className="text-xl font-bold">{data.topWinPercentage.ownerName}</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {(data.topWinPercentage.winPercentage * 100).toFixed(1)}%
                  </p>
                </div>
                <Avatar className="h-12 w-12">
                  <AvatarImage src={data.topWinPercentage.avatar || undefined} />
                  <AvatarFallback>
                    {data.topWinPercentage.ownerName?.slice(0, 2).toUpperCase()}
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
              <Crown className="h-5 w-5 text-yellow-500" />
              Hall of Champions
            </CardTitle>
            <CardDescription>
              {data.leagueAge} seasons of glory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.champions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No champions recorded yet
              </p>
            ) : (
              <div className="space-y-4">
                {data.champions.map((champion, index) => (
                  <div
                    key={champion.season}
                    className="flex items-center gap-4 p-3 rounded-lg bg-accent/30"
                    data-testid={`champion-${champion.season}`}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 ring-2 ring-yellow-500/50">
                        <AvatarImage src={champion.avatar || undefined} />
                        <AvatarFallback>
                          {champion.ownerName?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {index === 0 && (
                        <div className="absolute -top-1 -right-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{champion.ownerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {champion.season} Champion
                      </p>
                    </div>
                    <Trophy className="h-5 w-5 text-yellow-500" />
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
                        {index === 0 && <Crown className="h-4 w-4 text-yellow-500" />}
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
                          <Trophy className="h-4 w-4 text-yellow-500" />
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
    </div>
  );
}

function TrophyRoomSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
