import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { getPositionColorClass } from "@/lib/utils";
import { copyToClipboard } from "@/lib/export-utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Copy,
  Share2,
  Trophy,
  Star,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Users,
  Calendar,
} from "lucide-react";

interface TopPlayer {
  name: string;
  position: string;
  points: number;
  value: number;
}

interface TeamReportData {
  teamName: string;
  leagueName: string;
  avatar: string | null;
  record: string;
  rank: number;
  totalTeams: number;
  totalPoints: number;
  pointsPerGame: number;
  dynastyValue: number;
  dynastyRank: number;
  profile: "Contender" | "Rebuild" | "Balanced";
  avgAge: number;
  topPlayers: TopPlayer[];
  positionBreakdown: { QB: number; RB: number; WR: number; TE: number };
  positionRanks: Record<string, { rank: number; total: number }>;
  strengths: string[];
  weaknesses: string[];
  shareText: string;
}

const PROFILE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  Contender: { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" },
  Rebuild: { color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" },
  Balanced: { color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
};

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamReportPage() {
  const { league, isLoading: isLoadingLeagues } = useSelectedLeague();
  const leagueId = league?.league_id;
  usePageTitle("Team Report");

  if (isLoadingLeagues) {
    return <ReportSkeleton />;
  }

  if (!leagueId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Share2 className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Team Report</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-league">
              Please select a league to generate your team report.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Team Report">
      <TeamReportContent leagueId={leagueId} />
    </PremiumGate>
  );
}

function TeamReportContent({ leagueId }: { leagueId: string }) {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<TeamReportData>({
    queryKey: ["/api/fantasy/team-report", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/team-report/${leagueId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    enabled: !!leagueId,
  });

  const handleCopy = async () => {
    if (!data?.shareText) return;
    const success = await copyToClipboard(data.shareText);
    toast({
      title: success ? "Copied to clipboard" : "Failed to copy",
      variant: success ? "default" : "destructive",
    });
  };

  const handleShare = async () => {
    if (!data?.shareText) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data.teamName} - Team Report`, text: data.shareText });
      } catch {
        await handleCopy();
      }
    } else {
      await handleCopy();
    }
  };

  if (isLoading) {
    return <ReportSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Share2 className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Team Report</h1>
        </div>
        <Card data-testid="error-state">
          <CardContent className="py-12 text-center">
            <X className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-error-message">
              Failed to generate team report. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileCfg = PROFILE_CONFIG[data.profile] || PROFILE_CONFIG.Balanced;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Team Report</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-report">
            <Copy className="h-4 w-4" />
            Copy Report
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} data-testid="button-share-report">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      <Card className="border-primary/20" data-testid="card-team-report">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar className="h-16 w-16" data-testid="avatar-team">
              <AvatarImage src={data.avatar || undefined} alt={data.teamName} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {data.teamName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-team-name">
                {data.teamName}
              </h2>
              <p className="text-sm text-muted-foreground truncate" data-testid="text-league-name">
                {data.leagueName}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-sm ${profileCfg.color} ${profileCfg.border} ${profileCfg.bg} no-default-hover-elevate no-default-active-elevate`}
              data-testid="badge-profile"
            >
              {data.profile}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="stat-record">
              <Trophy className="h-4 w-4 mx-auto mb-1 text-yellow-400" />
              <p className="text-lg sm:text-xl font-bold">{data.record}</p>
              <p className="text-xs text-muted-foreground">Record</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="stat-rank">
              <Star className="h-4 w-4 mx-auto mb-1 text-amber-400" />
              <p className="text-lg sm:text-xl font-bold">#{data.rank}</p>
              <p className="text-xs text-muted-foreground">of {data.totalTeams} teams</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="stat-dynasty-value">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-400" />
              <p className="text-lg sm:text-xl font-bold">{data.dynastyValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Dynasty Value (#{data.dynastyRank})</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="stat-ppg">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-purple-400" />
              <p className="text-lg sm:text-xl font-bold">{data.pointsPerGame}</p>
              <p className="text-xs text-muted-foreground">PPG ({data.totalPoints.toLocaleString()} total)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="stat-avg-age">
            <Calendar className="h-4 w-4" />
            <span>Average Age: <span className="font-medium text-foreground">{data.avgAge}</span></span>
          </div>

          {data.topPlayers.length > 0 && (
            <div data-testid="section-top-players">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-400" />
                Top Performers
              </h3>
              <div className="space-y-2">
                {data.topPlayers.map((player, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/20"
                    data-testid={`top-player-${idx}`}
                  >
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${getPositionColorClass(player.position)} text-xs shrink-0`}
                    >
                      {player.position}
                    </Badge>
                    <span className="text-sm font-medium truncate flex-1">{player.name}</span>
                    <span className="text-sm font-semibold text-primary shrink-0">{player.points} pts</span>
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                      Val: {player.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div data-testid="section-position-breakdown">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Position Breakdown
            </h3>
            <div className="space-y-2">
              {(["QB", "RB", "WR", "TE"] as const).map((pos) => {
                const rankInfo = data.positionRanks?.[pos];
                const rank = rankInfo?.rank || 0;
                const total = rankInfo?.total || 1;
                const pct = total > 0 ? ((total - rank + 1) / total) * 100 : 0;
                return (
                  <div key={pos} className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`${getPositionColorClass(pos)} text-xs w-10 justify-center shrink-0`}
                    >
                      {pos}
                    </Badge>
                    <div className="flex-1">
                      <Progress
                        value={pct}
                        className="h-2"
                      />
                    </div>
                    <span className="text-sm font-medium text-right shrink-0" data-testid={`pos-rank-${pos.toLowerCase()}`}>
                      #{rank} of {total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {(data.strengths.length > 0 || data.weaknesses.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="section-strengths-weaknesses">
              {data.strengths.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    Strengths
                  </h3>
                  <ul className="space-y-1">
                    {data.strengths.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" data-testid={`strength-${i}`}>
                        <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.weaknesses.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-400" />
                    Weaknesses
                  </h3>
                  <ul className="space-y-1">
                    {data.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" data-testid={`weakness-${i}`}>
                        <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground" data-testid="text-footer-branding">
              Powered by DT Sleeper Agent
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
