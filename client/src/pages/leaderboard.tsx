import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, CACHE_TIMES } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, TrendingUp, Crown, Medal, Star, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface LeaderboardEntry {
  id: string;
  userId: string;
  sleeperUserId: string | null;
  sleeperUsername: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  championships: number;
  runnerUps: number;
  playoffAppearances: number;
  bestFinish: number | null;
  totalLeagues: number;
  activeLeagues: number;
  totalPointsFor: number;
  dynastyValueRank: number | null;
  computedAt: string | null;
}

const SORT_OPTIONS = [
  { value: "championships", label: "Championships" },
  { value: "wins", label: "Total Wins" },
  { value: "winpct", label: "Win %" },
  { value: "points", label: "Total Points" },
  { value: "leagues", label: "Total Leagues" },
];

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-primary" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm text-muted-foreground font-mono w-5 text-center inline-block">{rank}</span>;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState("championships");

  usePageTitle("Leaderboard");

  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", sortBy],
    ...CACHE_TIMES.STABLE,
  });

  const refreshStats = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leaderboard/refresh"),
    onSuccess: () => {
      toast({ title: "Your stats have been refreshed!" });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: () => toast({ title: "Failed to refresh stats", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const myEntry = leaderboard?.find(e => e.userId === user?.id);
  const myRank = leaderboard ? leaderboard.findIndex(e => e.userId === user?.id) + 1 : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-leaderboard-title">
            <Trophy className="h-6 w-6 text-primary" /> Community Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm">Global rankings across all DT Sleeper Agent users</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshStats.mutate()}
            disabled={refreshStats.isPending}
            data-testid="button-refresh-my-stats"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshStats.isPending ? "animate-spin" : ""}`} />
            {refreshStats.isPending ? "Refreshing..." : "Update My Stats"}
          </Button>
        </div>
      </div>

      {myEntry && myRank > 0 && (
        <Card className="border-primary/30" data-testid="card-my-rank">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                {getRankIcon(myRank)}
                <span className="font-bold text-lg">#{myRank}</span>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarImage src={myEntry.avatarUrl || ""} />
                <AvatarFallback>{(myEntry.displayName || "?")[0]}</AvatarFallback>
              </Avatar>
              <span className="font-medium">Your Ranking</span>
              <div className="flex gap-3 ml-auto flex-wrap">
                <Badge variant="secondary"><Trophy className="h-3 w-3 mr-1" />{myEntry.championships} titles</Badge>
                <Badge variant="secondary">{myEntry.totalWins}W-{myEntry.totalLosses}L</Badge>
                <Badge variant="secondary">{myEntry.totalPointsFor.toLocaleString()} pts</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!myEntry && (
        <Card data-testid="card-no-stats">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-3">You haven't computed your stats yet. Click below to join the leaderboard!</p>
            <Button onClick={() => refreshStats.mutate()} disabled={refreshStats.isPending} data-testid="button-join-leaderboard">
              <TrendingUp className="h-4 w-4 mr-1" />
              {refreshStats.isPending ? "Computing..." : "Join Leaderboard"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-leaderboard-table">
        <CardContent className="pt-0 px-0">
          {leaderboard && leaderboard.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center">Record</TableHead>
                  <TableHead className="text-center">Win %</TableHead>
                  <TableHead className="text-center">Titles</TableHead>
                  <TableHead className="text-center">Playoffs</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-center">Leagues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const winPct = (entry.totalWins + entry.totalLosses) > 0
                    ? ((entry.totalWins / (entry.totalWins + entry.totalLosses)) * 100).toFixed(1)
                    : "0.0";
                  const isMe = entry.userId === user?.id;

                  return (
                    <TableRow key={entry.id} className={isMe ? "bg-primary/5" : ""} data-testid={`row-leaderboard-${rank}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {getRankIcon(rank)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/profile/${entry.userId}`}>
                          <div className="flex items-center gap-2 cursor-pointer hover:underline">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={entry.avatarUrl || ""} />
                              <AvatarFallback className="text-xs">{(entry.displayName || "?")[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium text-sm">{entry.displayName || entry.sleeperUsername || "Unknown"}</span>
                              {entry.sleeperUsername && entry.displayName !== entry.sleeperUsername && (
                                <p className="text-xs text-muted-foreground">@{entry.sleeperUsername}</p>
                              )}
                            </div>
                            {isMe && <Badge variant="outline" className="ml-1 text-xs">You</Badge>}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {entry.totalWins}-{entry.totalLosses}{entry.totalTies > 0 ? `-${entry.totalTies}` : ""}
                      </TableCell>
                      <TableCell className="text-center text-sm">{winPct}%</TableCell>
                      <TableCell className="text-center">
                        {entry.championships > 0 ? (
                          <span className="font-bold text-primary">{entry.championships}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{entry.playoffAppearances}</TableCell>
                      <TableCell className="text-center text-sm">{entry.totalPointsFor.toLocaleString()}</TableCell>
                      <TableCell className="text-center text-sm">{entry.totalLeagues}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No users on the leaderboard yet. Be the first to join!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
