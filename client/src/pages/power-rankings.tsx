import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, TrendingUp, Trophy, Target, BarChart3 } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";
import { formatPowerRankingsForShare } from "@/lib/export-utils";

interface PowerRankedTeam {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  teamName: string;
  powerScore: number;
  rosterStrengthScore: number;
  performanceScore: number;
  recordScore: number;
  efficiencyScore: number;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  tier: string;
  rank: number;
  previousRank: number | null;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  Elite: { color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
  Contender: { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" },
  Playoff: { color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/30" },
  Average: { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-muted" },
  Rebuild: { color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" },
};

function ScoreBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className={`h-3 w-3 shrink-0 ${color}`} />
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color.replace("text-", "bg-")}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-muted-foreground">{Math.round(value)}</span>
    </div>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardContent className="p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
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

export default function PowerRankingsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  usePageTitle("Power Rankings");

  const { data, isLoading, error } = useQuery<PowerRankedTeam[]>({
    queryKey: ["/api/sleeper/power-rankings", leagueId],
    enabled: !!leagueId,
  });

  if (isLoading) {
    return <RankingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground" data-testid="text-power-rankings-error">Failed to load power rankings</p>
      </div>
    );
  }

  const isOffseason = data.every(t => t.record.wins === 0 && t.record.losses === 0 && t.record.ties === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Zap className="h-5 w-5 text-amber-400" />
        <h2 className="text-xl font-semibold" data-testid="text-power-rankings-title">
          Power Rankings
        </h2>
        <div className="ml-auto">
          <ExportButton
            data={data.map((team) => ({
              rank: team.rank,
              teamName: team.teamName,
              powerScore: team.powerScore.toFixed(1),
              rosterStrength: team.rosterStrengthScore.toFixed(1),
              performance: team.performanceScore.toFixed(1),
              record: `${team.record.wins}-${team.record.losses}${team.record.ties > 0 ? `-${team.record.ties}` : ""}`,
              efficiency: team.efficiencyScore.toFixed(1),
              tier: team.tier,
              wins: team.record.wins,
              losses: team.record.losses,
              pointsFor: team.pointsFor.toFixed(1),
            }))}
            filename="power-rankings"
            shareText={formatPowerRankingsForShare(data)}
          />
        </div>
      </div>

      {isOffseason && (
        <Card className="border-amber-400/20 dark:border-amber-800/20 bg-amber-50 dark:bg-amber-950/20" data-testid="card-offseason-note">
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-200">Offseason Rankings</p>
              <p className="text-xs text-muted-foreground mt-1">
                No games have been played yet this season. Power scores are based solely on roster strength right now. Points, record, and efficiency scores will update once the season begins.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-2 flex-wrap">
            Composite score based on roster strength, performance, record, and efficiency
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {data.map((team) => {
              const tierCfg = TIER_CONFIG[team.tier] || TIER_CONFIG.Average;

              return (
                <div
                  key={team.rosterId}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4"
                  data-testid={`card-power-ranking-${team.rosterId}`}
                >
                  <div className="flex items-center gap-3 sm:w-64 shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${tierCfg.bg} ${tierCfg.color}`}
                      data-testid={`text-rank-${team.rosterId}`}
                    >
                      {team.rank}
                    </div>

                    <Avatar className="h-9 w-9">
                      <AvatarImage src={team.avatar || undefined} alt={team.ownerName} />
                      <AvatarFallback>{team.ownerName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-team-name-${team.rosterId}`}>
                        {team.teamName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {team.record.wins}-{team.record.losses}
                        {team.record.ties > 0 ? `-${team.record.ties}` : ""} · {team.pointsFor.toFixed(1)} pts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:ml-auto shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums" data-testid={`text-power-score-${team.rosterId}`}>
                        {team.powerScore.toFixed(1)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${tierCfg.color} ${tierCfg.border} no-default-hover-elevate no-default-active-elevate`}
                      data-testid={`badge-tier-${team.rosterId}`}
                    >
                      {team.tier}
                    </Badge>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1 sm:max-w-xs">
                    <ScoreBar label="Roster" value={team.rosterStrengthScore} icon={Trophy} color="text-yellow-400" />
                    <ScoreBar label="Points" value={team.performanceScore} icon={TrendingUp} color="text-amber-400" />
                    <ScoreBar label="Record" value={team.recordScore} icon={BarChart3} color="text-green-400" />
                    <ScoreBar label="Efficiency" value={team.efficiencyScore} icon={Target} color="text-purple-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
