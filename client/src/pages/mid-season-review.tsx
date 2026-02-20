import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, CheckCircle, Lightbulb } from "lucide-react";

interface MidSeasonReview {
  overallGrade: string;
  playoffOutlook: string;
  playoffProbability: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  strategy: string;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400", "A": "text-emerald-400", "A-": "text-emerald-400",
  "B+": "text-green-400", "B": "text-green-400", "B-": "text-green-400",
  "C+": "text-amber-400", "C": "text-amber-400", "C-": "text-amber-400",
  "D+": "text-orange-400", "D": "text-orange-400", "D-": "text-orange-400",
  "F": "text-red-400",
};

const OUTLOOK_CONFIG: Record<string, { color: string; bg: string }> = {
  Contender: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  Bubble: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  Longshot: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  Eliminated: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

export default function MidSeasonReviewPage() {
  usePageTitle("Mid-Season Review");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const { data, isLoading } = useQuery<{
    review: MidSeasonReview;
    teamInfo: { name: string; record: string; rank: number; totalTeams: number; points: string };
    week: number;
  }>({
    queryKey: ["/api/ai/mid-season-review", leagueId],
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view your mid-season review</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const review = data?.review;
  const team = data?.teamInfo;
  if (!review || !team) return null;

  const outlookConfig = OUTLOOK_CONFIG[review.playoffOutlook] || OUTLOOK_CONFIG.Bubble;
  const isRebuild = review.strategy?.includes("REBUILD");

  return (
    <PremiumGate featureName="Mid-Season Review">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Mid-Season Review</h1>
            <p className="text-sm text-muted-foreground">Week {data?.week} — {team.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Overall Grade</p>
              <p className={`text-5xl font-bold ${GRADE_COLORS[review.overallGrade] || "text-muted-foreground"}`} data-testid="text-overall-grade">{review.overallGrade}</p>
              <p className="text-sm text-muted-foreground">{team.record} ({team.points} pts)</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Playoff Outlook</p>
              <Badge className={`text-lg px-3 py-1 ${outlookConfig.bg}`}>
                <span className={outlookConfig.color}>{review.playoffOutlook}</span>
              </Badge>
              <p className="text-sm text-muted-foreground">Rank {team.rank}/{team.totalTeams}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Playoff Probability</p>
              <div className="relative h-20 flex items-center justify-center">
                <p className={`text-4xl font-bold ${review.playoffProbability >= 60 ? "text-emerald-400" : review.playoffProbability >= 30 ? "text-amber-400" : "text-red-400"}`} data-testid="text-playoff-probability">
                  {review.playoffProbability}%
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${review.playoffProbability >= 60 ? "bg-emerald-500" : review.playoffProbability >= 30 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${review.playoffProbability}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm leading-relaxed" data-testid="text-summary">{review.summary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Badge variant={isRebuild ? "destructive" : "default"} className="text-xs">
              {isRebuild ? "REBUILD MODE" : "WIN NOW"}
            </Badge>
            <CardTitle className="text-base">Strategy Recommendation</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">
              {typeof review.strategy === "string" && review.strategy.includes(" ")
                ? review.strategy
                : isRebuild
                  ? "Focus on acquiring young assets and draft picks. Sell aging veterans at peak value."
                  : "Maximize your championship window. Target proven producers and consolidate depth."}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {(review.strengths || []).map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{s}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Weaknesses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {(review.weaknesses || []).map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <TrendingDown className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Recommended Moves
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {(review.recommendations || []).map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
