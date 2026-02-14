import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Trophy, BarChart3, Calendar } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSelectedLeague } from "./league-layout";
import { PremiumGate } from "@/components/premium-gate";
import { ExportButton } from "@/components/export-button";

interface TeamProjection {
  rosterId: number;
  ownerName: string;
  avatar: string | null;
  currentRecord: string;
  projectedWins: number;
  projectedLosses: number;
  playoffOdds: number;
  bestCase: string;
  worstCase: string;
  currentRank: number;
  projectedRank: number;
  powerScore: number;
  trend: "rising" | "falling" | "steady";
}

interface ProjectionsData {
  projections: TeamProjection[];
  simulationCount: number;
  playoffSpots: number;
  remainingWeeks: number;
  totalWeeks: number;
  message?: string;
}

function getOddsColor(odds: number) {
  if (odds > 70) return "text-green-400";
  if (odds >= 30) return "text-yellow-400";
  return "text-red-400";
}

function getOddsBarColor(odds: number) {
  if (odds > 70) return "bg-green-400";
  if (odds >= 30) return "bg-yellow-400";
  return "bg-red-400";
}

function TrendIcon({ trend }: { trend: "rising" | "falling" | "steady" }) {
  if (trend === "rising") return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (trend === "falling") return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function ProjectionsSkeleton() {
  return (
    <div className="space-y-4" data-testid="season-projections-skeleton">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SeasonProjectionsPage() {
  const { league } = useSelectedLeague();
  usePageTitle("Season Projections");

  const { data, isLoading, error } = useQuery<ProjectionsData>({
    queryKey: ["/api/fantasy/season-projections", league?.league_id],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/season-projections/${league?.league_id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch season projections");
      return res.json();
    },
    enabled: !!league?.league_id,
  });

  if (isLoading) {
    return <ProjectionsSkeleton />;
  }

  return (
    <PremiumGate featureName="Season Projections">
      <SeasonProjectionsContent data={data} error={error} />
    </PremiumGate>
  );
}

function SeasonProjectionsContent({ data, error }: { data: ProjectionsData | undefined; error: Error | null }) {
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-projections">
        <p className="text-muted-foreground" data-testid="text-error-projections">Failed to load season projections</p>
      </div>
    );
  }

  if (data.message) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3" data-testid="status-preseason">
        <Calendar className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center" data-testid="text-preseason-message">{data.message}</p>
      </div>
    );
  }

  const projections = data.projections;

  return (
    <div className="space-y-4" data-testid="season-projections-page">
      <div className="flex items-center gap-3 flex-wrap">
        <BarChart3 className="h-5 w-5 text-cyan-400" />
        <h2 className="text-xl font-semibold" data-testid="text-projections-title">
          Season Projections
        </h2>
        <div className="ml-auto">
          <ExportButton
            data={projections.map((t) => ({
              Rank: t.projectedRank,
              Team: t.ownerName,
              "Current Record": t.currentRecord,
              "Projected Wins": t.projectedWins,
              "Projected Losses": t.projectedLosses,
              "Playoff Odds": `${t.playoffOdds}%`,
              "Best Case": t.bestCase,
              "Worst Case": t.worstCase,
              "Power Score": t.powerScore,
              Trend: t.trend,
            }))}
            filename="season-projections"
            shareText={projections.map((t, i) => `${i + 1}. ${t.ownerName} - ${t.playoffOdds}% playoff odds (${t.projectedWins}-${t.projectedLosses})`).join("\n")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Simulations</p>
            <p className="text-2xl font-bold tabular-nums" data-testid="text-sim-count">{data.simulationCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Remaining Weeks</p>
            <p className="text-2xl font-bold tabular-nums" data-testid="text-remaining-weeks">{data.remainingWeeks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Playoff Spots</p>
            <p className="text-2xl font-bold tabular-nums" data-testid="text-playoff-spots">{data.playoffSpots}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-2 flex-wrap">
            <Trophy className="h-4 w-4" />
            Projected final records and playoff odds based on {data.simulationCount} Monte Carlo simulations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {projections.map((team) => (
              <div
                key={team.rosterId}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4"
                data-testid={`card-projection-${team.rosterId}`}
              >
                <div className="flex items-center gap-3 sm:w-56 shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-muted"
                    data-testid={`text-projected-rank-${team.rosterId}`}
                  >
                    {team.projectedRank}
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={team.avatar || undefined} alt={team.ownerName} />
                    <AvatarFallback>{team.ownerName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-team-name-${team.rosterId}`}>
                      {team.ownerName}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-current-record-${team.rosterId}`}>
                      {team.currentRecord}
                    </p>
                  </div>
                  <TrendIcon trend={team.trend} />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Playoff</span>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getOddsBarColor(team.playoffOdds)}`}
                        style={{ width: `${Math.min(team.playoffOdds, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold tabular-nums w-14 text-right ${getOddsColor(team.playoffOdds)}`} data-testid={`text-playoff-odds-${team.rosterId}`}>
                      {team.playoffOdds}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Projected</p>
                    <p className="text-sm font-bold tabular-nums" data-testid={`text-projected-record-${team.rosterId}`}>
                      {team.projectedWins}-{team.projectedLosses}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Best</p>
                    <p className="text-xs tabular-nums text-green-400" data-testid={`text-best-case-${team.rosterId}`}>
                      {team.bestCase}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Worst</p>
                    <p className="text-xs tabular-nums text-red-400" data-testid={`text-worst-case-${team.rosterId}`}>
                      {team.worstCase}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs no-default-hover-elevate no-default-active-elevate"
                    data-testid={`badge-power-score-${team.rosterId}`}
                  >
                    PWR {team.powerScore}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}