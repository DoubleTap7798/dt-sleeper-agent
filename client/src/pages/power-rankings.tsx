import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown,
  Shield,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Trophy,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  Info,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";
import { formatPowerRankingsForShare } from "@/lib/export-utils";

type RankingMode = "dynasty" | "in-season" | "hybrid";

interface DynastyRankedTeam {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  teamName: string;
  dds: number;
  championshipOdds: number;
  playoffOdds: number;
  rosterEV: number;
  pickEV: number;
  depth: number;
  liquidity: number;
  riskScore: number;
  riskLevel: string;
  ageGrade: string;
  coreAge: number;
  starterAge: number;
  ageVolatility: string;
  concentrationRatio: number;
  isTopHeavy: boolean;
  tier: string;
  strategy: string;
  weeklyDelta: number | null;
  oddsDelta: number | null;
  rank: number;
  topPlayers: Array<{ name: string; position: string; value: number }>;
  starterCount: number;
  totalPlayers: number;
  draftPickCount: number;
  future1st2ndCount: number;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  projectionWindow: string;
  mode: string;
  inSeasonScore?: number;
  starterPPG?: number;
  nStarterPPG?: number;
  winPct?: number;
  nWinPct?: number;
  pointsAboveMedian?: number;
  nPointsAboveMedian?: number;
  allPlayPct?: number;
  nAllPlayPct?: number;
  momentum?: number;
  nMomentum?: number;
  injuryDepth?: number;
  nInjuryDepth?: number;
  hybridScore?: number;
  dynastyScore?: number;
}

interface InSeasonResponse {
  offseason?: boolean;
  rankings?: never;
  mode?: string;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  "Elite Contender": {
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/40",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  },
  Elite: {
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
  Strong: {
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
  Average: {
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
  "Below Average": {
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
  Weak: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    glow: "",
  },
};

const STRATEGY_CONFIG: Record<string, { color: string }> = {
  "Elite Contender": { color: "text-amber-400 border-amber-400/30" },
  "Ascending Builder": { color: "text-green-400 border-green-400/30" },
  "Fragile Contender": { color: "text-orange-400 border-orange-400/30" },
  "Liquid Rebuilder": { color: "text-sky-400 border-sky-400/30" },
  "Balanced": { color: "text-muted-foreground border-border" },
  "Full Rebuild": { color: "text-red-400 border-red-400/30" },
  "Hot Streak": { color: "text-amber-400 border-amber-400/30" },
  "Consistent Contender": { color: "text-green-400 border-green-400/30" },
  "Underperformer": { color: "text-orange-400 border-orange-400/30" },
  "Overachiever": { color: "text-sky-400 border-sky-400/30" },
  "Surging": { color: "text-green-400 border-green-400/30" },
  "Rebuilding": { color: "text-red-400 border-red-400/30" },
  "Elite": { color: "text-amber-400 border-amber-400/30" },
  "Strong": { color: "text-green-400 border-green-400/30" },
  "Average": { color: "text-muted-foreground border-border" },
  "Below Average": { color: "text-orange-400 border-orange-400/30" },
  "Weak": { color: "text-red-400 border-red-400/30" },
};

const RISK_CONFIG: Record<string, { color: string; icon: typeof Shield }> = {
  Low: { color: "text-green-400", icon: Shield },
  Moderate: { color: "text-amber-400", icon: Shield },
  High: { color: "text-red-400", icon: AlertTriangle },
};

function NormalizedBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-muted-foreground/70 text-[10px] uppercase tracking-wider font-medium">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-7 text-right font-mono text-muted-foreground text-[11px]">{Math.round(value)}</span>
    </div>
  );
}

function DeltaIndicator({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
      {isPositive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}
    </span>
  );
}

function MomentumIndicator({ value }: { value: number | undefined }) {
  if (value === undefined || value === null) return null;
  if (value > 2) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (value < -2) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
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

function DynastyMetrics({ team }: { team: DynastyRankedTeam }) {
  const riskCfg = RISK_CONFIG[team.riskLevel] || RISK_CONFIG.Moderate;
  const RiskIcon = riskCfg.icon;

  return (
    <>
      <div className="space-y-1">
        <NormalizedBar label="Roster" value={team.rosterEV} color="bg-amber-400" />
        <NormalizedBar label="Picks" value={team.pickEV} color="bg-sky-400" />
        <NormalizedBar label="Depth" value={team.depth} color="bg-green-400" />
        <NormalizedBar label="Liquid" value={team.liquidity} color="bg-violet-400" />
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-muted-foreground/70 text-[10px] uppercase tracking-wider font-medium">Risk</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-red-400"
              style={{ width: `${Math.min(team.riskScore, 100)}%` }}
            />
          </div>
          <span className={`w-14 text-right text-[11px] font-semibold ${riskCfg.color} flex items-center justify-end gap-0.5`}>
            <RiskIcon className="h-3 w-3" />
            {team.riskLevel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
        <span>Age: <span className="text-foreground font-semibold">{team.ageGrade}</span> <span className="text-muted-foreground/60">Core {team.coreAge} / Starters {team.starterAge}</span></span>
        <span className="text-border">|</span>
        <span>Concentration: <span className={`font-semibold ${team.isTopHeavy ? "text-orange-400" : "text-foreground"}`}>{team.concentrationRatio}%</span></span>
        <span className="text-border">|</span>
        <span>Picks: <span className="text-foreground font-semibold">{team.draftPickCount}</span> <span className="text-muted-foreground/60">({team.future1st2ndCount} early)</span></span>
      </div>
    </>
  );
}

function InSeasonMetrics({ team }: { team: DynastyRankedTeam }) {
  return (
    <>
      <div className="space-y-1">
        <NormalizedBar label="PPG" value={team.nStarterPPG ?? 0} color="bg-amber-400" />
        <NormalizedBar label="Win%" value={team.nWinPct ?? 0} color="bg-green-400" />
        <NormalizedBar label="Median" value={team.nPointsAboveMedian ?? 0} color="bg-sky-400" />
        <NormalizedBar label="All-Play" value={team.nAllPlayPct ?? 0} color="bg-violet-400" />
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-muted-foreground/70 text-[10px] uppercase tracking-wider font-medium">Trend</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-emerald-400"
              style={{ width: `${Math.min(team.nMomentum ?? 0, 100)}%` }}
            />
          </div>
          <span className="w-7 flex items-center justify-end">
            <MomentumIndicator value={team.momentum} />
          </span>
        </div>
        <NormalizedBar label="Health" value={team.nInjuryDepth ?? 0} color="bg-rose-400" />
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
        <span>PPG: <span className="text-foreground font-semibold">{team.starterPPG?.toFixed(1)}</span></span>
        <span className="text-border">|</span>
        <span>Win%: <span className="text-foreground font-semibold">{team.winPct?.toFixed(0)}%</span></span>
        <span className="text-border">|</span>
        <span>All-Play: <span className="text-foreground font-semibold">{team.allPlayPct?.toFixed(0)}%</span></span>
        <span className="text-border">|</span>
        <span>Pts vs Med: <span className={`font-semibold ${(team.pointsAboveMedian ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{(team.pointsAboveMedian ?? 0) >= 0 ? "+" : ""}{team.pointsAboveMedian?.toFixed(0)}</span></span>
      </div>
    </>
  );
}

function HybridMetrics({ team }: { team: DynastyRankedTeam }) {
  return (
    <>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
        <span className="text-amber-400 font-semibold">60% In-Season ({team.inSeasonScore?.toFixed(1)})</span>
        <span>+</span>
        <span className="text-sky-400 font-semibold">40% Dynasty ({team.dynastyScore?.toFixed(1)})</span>
      </div>
      <div className="space-y-1">
        <NormalizedBar label="PPG" value={team.nStarterPPG ?? 0} color="bg-amber-400" />
        <NormalizedBar label="Win%" value={team.nWinPct ?? 0} color="bg-green-400" />
        <NormalizedBar label="All-Play" value={team.nAllPlayPct ?? 0} color="bg-violet-400" />
        <NormalizedBar label="Roster" value={team.rosterEV} color="bg-sky-400" />
        <NormalizedBar label="Picks" value={team.pickEV} color="bg-emerald-400" />
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
        <span>Record: <span className="text-foreground font-semibold">{team.record.wins}-{team.record.losses}</span></span>
        <span className="text-border">|</span>
        <span>PPG: <span className="text-foreground font-semibold">{team.starterPPG?.toFixed(1)}</span></span>
        <span className="text-border">|</span>
        <span>Age: <span className="text-foreground font-semibold">{team.ageGrade}</span></span>
      </div>
    </>
  );
}

const MODE_TITLES: Record<RankingMode, string> = {
  dynasty: "Dynasty Dominance Score",
  "in-season": "In-Season Power Score",
  hybrid: "Hybrid Power Score",
};

const MODE_ICONS: Record<RankingMode, typeof Crown> = {
  dynasty: Crown,
  "in-season": Activity,
  hybrid: Zap,
};

export default function PowerRankingsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [rankingMode, setRankingMode] = useState<RankingMode>("dynasty");
  const [projectionWindow, setProjectionWindow] = useState("3");

  usePageTitle(MODE_TITLES[rankingMode]);

  const getScoreField = (team: DynastyRankedTeam) => {
    if (rankingMode === "in-season") return team.inSeasonScore ?? team.dds;
    if (rankingMode === "hybrid") return team.hybridScore ?? team.dds;
    return team.dds;
  };

  const queryParams = new URLSearchParams();
  queryParams.set("mode", rankingMode);
  if (rankingMode === "dynasty") queryParams.set("window", projectionWindow);

  const { data: rawData, isLoading, error } = useQuery<DynastyRankedTeam[] | InSeasonResponse>({
    queryKey: ["/api/sleeper/power-rankings", leagueId, rankingMode, projectionWindow],
    queryFn: async () => {
      const res = await fetch(`/api/sleeper/power-rankings/${leagueId}?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!leagueId,
  });

  const isOffseasonResponse = rawData && !Array.isArray(rawData) && (rawData as any).offseason === true;
  const data: DynastyRankedTeam[] | null = Array.isArray(rawData) ? rawData : null;

  if (isLoading) {
    return <RankingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground" data-testid="text-power-rankings-error">Failed to load power rankings</p>
      </div>
    );
  }

  const isOffseason = isOffseasonResponse || (data && data.every(
    (t) => t.record.wins === 0 && t.record.losses === 0 && t.record.ties === 0
  ));

  const ModeIcon = MODE_ICONS[rankingMode];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <ModeIcon className="h-5 w-5 text-amber-400" />
        <h2 className="text-xl font-semibold" data-testid="text-power-rankings-title">
          {MODE_TITLES[rankingMode]}
        </h2>
        {isOffseason && rankingMode === "dynasty" && (
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider border-amber-400/30 text-amber-400 no-default-hover-elevate no-default-active-elevate"
            data-testid="badge-dynasty-mode"
          >
            Dynasty Projection Mode
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {(["dynasty", "in-season", "hybrid"] as RankingMode[]).map((m) => (
              <Button
                key={m}
                variant={rankingMode === m ? "default" : "ghost"}
                size="sm"
                className={`h-7 px-2.5 text-xs rounded-none ${rankingMode === m ? "bg-amber-400/20 text-amber-400" : ""}`}
                onClick={() => setRankingMode(m)}
                data-testid={`button-mode-${m}`}
              >
                {m === "dynasty" ? "Dynasty" : m === "in-season" ? "In-Season" : "Hybrid"}
              </Button>
            ))}
          </div>

          {rankingMode === "dynasty" && (
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {["1", "3", "5"].map((w) => (
                <Button
                  key={w}
                  variant={projectionWindow === w ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 px-2.5 text-xs rounded-none ${projectionWindow === w ? "bg-amber-400/20 text-amber-400" : ""}`}
                  onClick={() => setProjectionWindow(w)}
                  data-testid={`button-window-${w}`}
                >
                  {w}Y
                </Button>
              ))}
            </div>
          )}

          {data && data.length > 0 && (
            <ExportButton
              data={data.map((team) => ({
                rank: team.rank,
                teamName: team.teamName,
                score: getScoreField(team).toFixed(1),
                championshipOdds: `${team.championshipOdds}%`,
                tier: team.tier,
                strategy: team.strategy,
                ...(rankingMode === "dynasty" ? {
                  rosterEV: team.rosterEV.toFixed(1),
                  pickEV: team.pickEV.toFixed(1),
                  depth: team.depth.toFixed(1),
                  liquidity: team.liquidity.toFixed(1),
                  risk: team.riskScore.toFixed(1),
                  ageGrade: team.ageGrade,
                } : {}),
                ...(rankingMode !== "dynasty" ? {
                  starterPPG: team.starterPPG?.toFixed(1) ?? "-",
                  winPct: team.winPct?.toFixed(0) ?? "-",
                  allPlayPct: team.allPlayPct?.toFixed(0) ?? "-",
                } : {}),
              }))}
              filename={`${rankingMode}-power-rankings`}
              shareText={formatPowerRankingsForShare(
                data.map(t => ({ ...t, compositeScore: getScoreField(t) }))
              )}
            />
          )}
        </div>
      </div>

      {isOffseasonResponse && rankingMode !== "dynasty" && (
        <Card className="border-amber-400/20 bg-amber-950/10" data-testid="card-offseason-inseason">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {rankingMode === "in-season" ? "In-Season" : "Hybrid"} rankings are available once the season starts.
              </p>
              <p className="text-xs text-muted-foreground">
                Switch to Dynasty Mode for offseason analysis based on asset quality, draft capital, and roster construction.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isOffseason && rankingMode === "dynasty" && (
        <Card className="border-amber-400/20 bg-amber-950/10" data-testid="card-offseason-note">
          <CardContent className="p-3 flex items-start gap-3">
            <Briefcase className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Dynasty Projection Mode — rankings reflect asset quality, draft capital, age sustainability, and roster construction.
              All metrics normalized 0-100 across your league.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((team) => {
            const tierCfg = TIER_CONFIG[team.tier] || TIER_CONFIG.Competitive || TIER_CONFIG.Average;
            const strategyCfg = STRATEGY_CONFIG[team.strategy] || STRATEGY_CONFIG.Balanced || STRATEGY_CONFIG.Average;
            const score = getScoreField(team);

            return (
              <Card
                key={team.rosterId}
                className={`${tierCfg?.glow || ""} ${team.rank === 1 ? "border-amber-400/30" : ""}`}
                data-testid={`card-power-ranking-${team.rosterId}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${tierCfg?.bg || "bg-muted"} ${tierCfg?.color || "text-foreground"}`}
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
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 h-4 ${strategyCfg?.color || "text-muted-foreground border-border"} no-default-hover-elevate no-default-active-elevate`}
                            data-testid={`badge-strategy-${team.rosterId}`}
                          >
                            {team.strategy}
                          </Badge>
                          {rankingMode === "dynasty" && team.isTopHeavy && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-4 text-orange-400 border-orange-400/30 no-default-hover-elevate no-default-active-elevate"
                              data-testid={`badge-top-heavy-${team.rosterId}`}
                            >
                              Top Heavy
                            </Badge>
                          )}
                          {rankingMode === "in-season" && (team.momentum ?? 0) > 5 && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-4 text-green-400 border-green-400/30 no-default-hover-elevate no-default-active-elevate"
                            >
                              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                              Hot
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-baseline gap-1">
                          <p
                            className="text-3xl font-bold tabular-nums leading-none"
                            data-testid={`text-dds-${team.rosterId}`}
                          >
                            {score.toFixed(1)}
                          </p>
                          <DeltaIndicator value={team.weeklyDelta} />
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <Trophy className="h-3 w-3 text-amber-400" />
                          <span
                            className="text-xs font-semibold text-amber-400 tabular-nums"
                            data-testid={`text-champ-odds-${team.rosterId}`}
                          >
                            {team.championshipOdds}%
                          </span>
                          <DeltaIndicator value={team.oddsDelta} />
                        </div>
                      </div>
                    </div>

                    {rankingMode === "dynasty" && <DynastyMetrics team={team} />}
                    {rankingMode === "in-season" && <InSeasonMetrics team={team} />}
                    {rankingMode === "hybrid" && <HybridMetrics team={team} />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
