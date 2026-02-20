import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
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
import { Target, Check, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";

interface MatchupTeam {
  rosterId: number;
  ownerId: string;
  name: string;
  avatar: string | null;
  points: number;
}

interface Matchup {
  matchupId: number;
  teamA: MatchupTeam;
  teamB: MatchupTeam;
}

interface PredictionRecord {
  id: string;
  matchupId: number;
  predictedWinnerId: string;
}

interface PredictionsData {
  matchups: Matchup[];
  predictions: PredictionRecord[];
  week: number;
}

interface LeaderboardEntry {
  userId: string;
  correct: number;
  total: number;
}

export default function WeeklyPredictionsPage() {
  usePageTitle("Weekly Predictions");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const { toast } = useToast();
  const [week, setWeek] = useState<number>(1);

  const { data, isLoading } = useQuery<PredictionsData>({
    queryKey: [`/api/fantasy/predictions/${leagueId}?week=${week}`],
    enabled: !!leagueId,
  });

  const { data: leaderboard, isLoading: lbLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/fantasy/predictions-leaderboard/${leagueId}`],
    enabled: !!leagueId,
  });

  const submitPrediction = useMutation({
    mutationFn: async ({ matchupId, predictedWinnerId }: { matchupId: number; predictedWinnerId: string }) => {
      const res = await apiRequest("POST", `/api/fantasy/predictions/${leagueId}`, {
        week,
        matchupId,
        predictedWinnerId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Prediction submitted!" });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith(`/api/fantasy/predictions/${leagueId}`) });
      queryClient.invalidateQueries({ queryKey: [`/api/fantasy/predictions-leaderboard/${leagueId}`] });
    },
    onError: (err: any) => toast({ title: "Failed to submit", description: err.message, variant: "destructive" }),
  });

  // Helper function to get the user's prediction for a matchup
  const getPredictionForMatchup = (matchupId: number): string | null => {
    const prediction = data?.predictions?.find(p => p.matchupId === matchupId);
    return prediction?.predictedWinnerId || null;
  };

  // Helper function to get avatar URL
  const getAvatarUrl = (avatar: string | null): string | undefined => {
    return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : undefined;
  };

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to make predictions</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const MAX_WEEK = 18;
  const currentWeek = data?.week || week;
  const matchups = data?.matchups || [];

  return (
    <PremiumGate featureName="Weekly Predictions">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Weekly Predictions"
          subtitle="Pick the winners for each matchup"
          icon={<Target className="h-6 w-6 text-primary" />}
          backTo="/league"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeek(Math.max(1, week - 1))} disabled={week <= 1} data-testid="button-prev-week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(week)} onValueChange={(v) => setWeek(Number(v))}>
                <SelectTrigger className="w-[120px]" data-testid="select-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_WEEK }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>Week {i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setWeek(Math.min(MAX_WEEK, week + 1))} disabled={week >= MAX_WEEK} data-testid="button-next-week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Week {currentWeek} Matchups</h2>
          {matchups.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No matchups available for this week.</p>
              </CardContent>
            </Card>
          ) : (
            matchups.map((matchup) => {
              const userPrediction = getPredictionForMatchup(matchup.matchupId);
              return (
                <Card key={matchup.matchupId} data-testid={`card-matchup-${matchup.matchupId}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <button
                        className={`flex-1 flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                          userPrediction === matchup.teamA.ownerId
                            ? "border-primary bg-primary/10"
                            : "border-border hover-elevate"
                        }`}
                        onClick={() =>
                          submitPrediction.mutate({
                            matchupId: matchup.matchupId,
                            predictedWinnerId: matchup.teamA.ownerId,
                          })
                        }
                        disabled={submitPrediction.isPending}
                        data-testid={`button-pick-teamA-${matchup.matchupId}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={getAvatarUrl(matchup.teamA.avatar)} />
                          <AvatarFallback className="text-xs">{matchup.teamA.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{matchup.teamA.name}</p>
                          <p className="text-xs text-muted-foreground">{matchup.teamA.points.toFixed(1)} pts</p>
                        </div>
                        {userPrediction === matchup.teamA.ownerId && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>

                      <Badge variant="outline" className="shrink-0">vs</Badge>

                      <button
                        className={`flex-1 flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                          userPrediction === matchup.teamB.ownerId
                            ? "border-primary bg-primary/10"
                            : "border-border hover-elevate"
                        }`}
                        onClick={() =>
                          submitPrediction.mutate({
                            matchupId: matchup.matchupId,
                            predictedWinnerId: matchup.teamB.ownerId,
                          })
                        }
                        disabled={submitPrediction.isPending}
                        data-testid={`button-pick-teamB-${matchup.matchupId}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={getAvatarUrl(matchup.teamB.avatar)} />
                          <AvatarFallback className="text-xs">{matchup.teamB.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{matchup.teamB.name}</p>
                          <p className="text-xs text-muted-foreground">{matchup.teamB.points.toFixed(1)} pts</p>
                        </div>
                        {userPrediction === matchup.teamB.ownerId && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card data-testid="card-leaderboard">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Prediction Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {lbLoading ? (
              <div className="space-y-2 px-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead className="text-center">Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, idx) => (
                    <TableRow key={entry.userId} data-testid={`row-lb-${idx}`}>
                      <TableCell className="font-mono text-sm">
                        {idx === 0 ? <Crown className="h-4 w-4 text-primary" /> : `#${idx + 1}`}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{entry.userId}</TableCell>
                      <TableCell className="text-center text-sm">
                        {entry.correct}-{entry.total - entry.correct}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No predictions made yet. Be the first!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
