import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown,
  TrendingUp,
  Shield,
  Package,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Minus,
  Trophy,
  Target,
  Briefcase,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";
import { formatPowerRankingsForShare } from "@/lib/export-utils";

interface DynastyRankedTeam {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  teamName: string;
  compositeScore: number;
  rosterEV: number;
  futurePickEV: number;
  ageCurveAdj: number;
  depthScore: number;
  liquidityScore: number;
  riskPenalty: number;
  avgStarterAge: number;
  ageGrade: string;
  riskLevel: string;
  championshipOdds: number;
  tier: string;
  rank: number;
  previousRank: number | null;
  topPlayers: Array<{ name: string; position: string; value: number }>;
  starterCount: number;
  totalPlayers: number;
  draftPickCount: number;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  mode: string;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  "Elite Contender": {
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/40",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  },
  Contender: {
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/30",
    glow: "",
  },
  Competitive: {
    color: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/30",
    glow: "",
  },
  Retool: {
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
    glow: "",
  },
  Rebuild: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    glow: "",
  },
};

const RISK_CONFIG: Record<string, { color: string; icon: typeof Shield }> = {
  Low: { color: "text-green-400", icon: Shield },
  Moderate: { color: "text-amber-400", icon: Shield },
  Elevated: { color: "text-orange-400", icon: AlertTriangle },
  High: { color: "text-red-400", icon: AlertTriangle },
};

function MetricPill({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-md bg-muted/40 min-w-[70px]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{label}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-12 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function PowerRankingsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  usePageTitle("Dynasty Power Rankings");

  const { data, isLoading, error } = useQuery<DynastyRankedTeam[]>({
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

  const isOffseason = data.every(
    (t) => t.record.wins === 0 && t.record.losses === 0 && t.record.ties === 0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Crown className="h-5 w-5 text-amber-400" />
        <h2 className="text-xl font-semibold" data-testid="text-power-rankings-title">
          Dynasty Power Rankings
        </h2>
        {isOffseason && (
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider border-amber-400/30 text-amber-400 no-default-hover-elevate no-default-active-elevate"
            data-testid="badge-dynasty-mode"
          >
            Dynasty Projection Mode
          </Badge>
        )}
        <div className="ml-auto">
          <ExportButton
            data={data.map((team) => ({
              rank: team.rank,
              teamName: team.teamName,
              compositeScore: team.compositeScore.toFixed(1),
              championshipOdds: `${team.championshipOdds}%`,
              rosterEV: team.rosterEV.toFixed(1),
              futurePickEV: team.futurePickEV.toFixed(1),
              ageGrade: team.ageGrade,
              riskLevel: team.riskLevel,
              tier: team.tier,
            }))}
            filename="dynasty-power-rankings"
            shareText={formatPowerRankingsForShare(data)}
          />
        </div>
      </div>

      {isOffseason && (
        <Card className="border-amber-400/20 bg-amber-950/10" data-testid="card-offseason-note">
          <CardContent className="p-3 flex items-start gap-3">
            <Briefcase className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Rankings reflect dynasty asset quality, draft capital, age curves, and roster construction.
              No season stats required.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data.map((team) => {
          const tierCfg = TIER_CONFIG[team.tier] || TIER_CONFIG.Competitive;
          const riskCfg = RISK_CONFIG[team.riskLevel] || RISK_CONFIG.Moderate;
          const RiskIcon = riskCfg.icon;

          return (
            <Card
              key={team.rosterId}
              className={`${tierCfg.glow} ${team.rank === 1 ? "border-amber-400/30" : ""}`}
              data-testid={`card-power-ranking-${team.rosterId}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${tierCfg.bg} ${tierCfg.color}`}
                      data-testid={`text-rank-${team.rosterId}`}
                    >
                      {team.rank}
                    </div>

                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={team.avatar || undefined} alt={team.ownerName} />
                      <AvatarFallback>{team.ownerName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" data-testid={`text-team-name-${team.rosterId}`}>
                        {team.teamName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${tierCfg.color} ${tierCfg.border} no-default-hover-elevate no-default-active-elevate`}
                          data-testid={`badge-tier-${team.rosterId}`}
                        >
                          {team.tier}
                        </Badge>
                        {!isOffseason && (
                          <span className="text-[10px] text-muted-foreground">
                            {team.record.wins}-{team.record.losses}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className="text-3xl font-bold tabular-nums leading-none"
                        data-testid={`text-composite-score-${team.rosterId}`}
                      >
                        {team.compositeScore.toFixed(1)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <Trophy className="h-3 w-3 text-amber-400" />
                        <span
                          className="text-xs font-semibold text-amber-400 tabular-nums"
                          data-testid={`text-champ-odds-${team.rosterId}`}
                        >
                          {team.championshipOdds}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <MetricPill label="Roster EV" value={team.rosterEV.toFixed(0)} />
                    <MetricPill label="Pick EV" value={team.futurePickEV.toFixed(0)} />
                    <MetricPill label="Age" value={team.ageGrade} sub={`${team.avgStarterAge}y`} />
                    <MetricPill label="Depth" value={team.depthScore} />
                    <MetricPill label="Liquid" value={team.liquidityScore} />
                    <div className="flex flex-col items-center px-3 py-1.5 rounded-md bg-muted/40 min-w-[70px]">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                        Risk
                      </span>
                      <span className={`text-sm font-bold ${riskCfg.color} flex items-center gap-0.5`}>
                        <RiskIcon className="h-3 w-3" />
                        {team.riskLevel}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
