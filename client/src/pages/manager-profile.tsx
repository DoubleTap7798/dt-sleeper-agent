import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, RefreshCw, TrendingUp, Shield, Target, Zap,
  ArrowRightLeft, Clock, Flame, BarChart3, AlertTriangle,
  Sparkles, ChevronRight, Crosshair, Activity, Eye,
  Calendar, Package, Gauge,
} from "lucide-react";
import { useRef, useEffect } from "react";

interface ComputedMetrics {
  primaryFormat: string;
  alsoActiveIn: string[];
  isSuperFlex: boolean;
  isDynasty: boolean;
  tradeCount: number;
  waiverCount: number;
  tradePercentile: number;
  pickExposurePct: number;
  netPicksGainedLost: number;
  futurePicksByYear: Record<number, number>;
  avgAgeAcquired: number | null;
  avgAgeTradedAway: number | null;
  netAgeDelta: number | null;
  ageBiasLabel: string;
  overweightPositions: string[];
  underweightPositions: string[];
  qbWarning: string | null;
  avgRosterAge: number | null;
  rosterByPosition: Record<string, number>;
  leagueAvgByPosition: Record<string, number>;
}

interface RadarChartData {
  riskVariance: number;
  youthBias: number;
  pickAggression: number;
  tradeFrequency: number;
  positionalBalance: number;
  contenderIndex: number;
}

interface ManagerProfileData {
  managerStyle: string;
  riskVariance: string;
  timeHorizon: string;
  archetypeDescription: string;
  topSummaryLine: string;
  tradeActivity: string;
  agePreference: string;
  draftPickStrategy: string;
  waiverActivity: string;
  positionalBias: { overweight: string[]; underweight: string[] };
  strategicTendencies: string[];
  competitiveAdvantages: string[];
  strategicLeaks: string[];
  radarChart: RadarChartData;
  assetPortfolioOutlook?: {
    rosterAgeCurve: string;
    contenderWindow: string;
    volatilityScore: string;
    liquidityScore: string;
  };
  competitiveTimeline?: {
    year1: string;
    year2: string;
    year3plus: string;
  };
  shortTermCompetitiveIndex?: string;
  rosterStabilityScore?: string;
  _computedMetrics: ComputedMetrics;
  // Legacy v1 fields for backwards compat
  positionPreferences?: { favored: string[]; avoided: string[] };
  riskTolerance?: string;
  tradeFrequency?: string;
  keyPatterns?: string[];
  strengths?: string[];
  blindSpots?: string[];
  summary?: string;
}

interface ProfileResponse {
  profile: ManagerProfileData | null;
  needsAnalysis?: boolean;
  stale?: boolean;
  lastUpdated?: string;
  tradesAnalyzed?: number;
  transactionsAnalyzed?: number;
}

const styleLabels: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  aggressive_trader: { label: "Aggressive Trader", icon: ArrowRightLeft, color: "text-amber-400" },
  patient_builder: { label: "Patient Builder", icon: Clock, color: "text-amber-400" },
  win_now: { label: "Win-Now Mode", icon: Flame, color: "text-amber-400" },
  rebuilder: { label: "Rebuilder", icon: Target, color: "text-amber-400" },
  balanced: { label: "Balanced", icon: BarChart3, color: "text-amber-400" },
  opportunistic: { label: "Opportunistic", icon: Zap, color: "text-amber-400" },
};

const varianceLabels: Record<string, { label: string; color: string }> = {
  high_variance: { label: "High Variance", color: "text-red-400" },
  moderate_variance: { label: "Moderate Variance", color: "text-amber-400" },
  low_variance: { label: "Low Variance", color: "text-green-400" },
};

const horizonLabels: Record<string, { label: string; color: string }> = {
  win_now: { label: "Win-Now", color: "text-red-400" },
  balanced: { label: "Balanced", color: "text-amber-400" },
  long_term_growth: { label: "Long-Term Growth", color: "text-green-400" },
};

const activityLabels: Record<string, string> = {
  very_active: "Very Active",
  active: "Active",
  passive: "Passive",
};

const timelineLabels: Record<string, { label: string; color: string }> = {
  rebuild: { label: "Rebuild", color: "text-red-400" },
  fringe: { label: "Fringe", color: "text-amber-400" },
  contender: { label: "Contender", color: "text-green-400" },
  strong_contender: { label: "Strong Contender", color: "text-green-400" },
  window_closing: { label: "Window Closing", color: "text-red-400" },
  sustainable: { label: "Sustainable", color: "text-green-400" },
  dependent_on_draft_conversion: { label: "Draft Dependent", color: "text-amber-400" },
};

const outlookLabels: Record<string, { label: string; color: string }> = {
  below_avg: { label: "Below Avg", color: "text-green-400" },
  avg: { label: "Average", color: "text-amber-400" },
  above_avg: { label: "Above Avg", color: "text-red-400" },
  low: { label: "Low", color: "text-green-400" },
  medium: { label: "Medium", color: "text-amber-400" },
  high: { label: "High", color: "text-red-400" },
  "1-2 years": { label: "1-2 Years", color: "text-red-400" },
  "2-4 years": { label: "2-4 Years", color: "text-green-400" },
  rebuild: { label: "Rebuild", color: "text-amber-400" },
};

function RadarChart({ data, size = 220 }: { data: RadarChartData; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.36;

    const axes = [
      { key: "riskVariance", label: "Variance" },
      { key: "youthBias", label: "Youth" },
      { key: "pickAggression", label: "Picks" },
      { key: "tradeFrequency", label: "Trades" },
      { key: "positionalBalance", label: "Balance" },
      { key: "contenderIndex", label: "Contend" },
    ];

    const angleStep = (Math.PI * 2) / axes.length;
    const startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, size, size);

    for (let ring = 1; ring <= 4; ring++) {
      const rr = (r * ring) / 4;
      ctx.beginPath();
      for (let i = 0; i <= axes.length; i++) {
        const angle = startAngle + i * angleStep;
        const x = cx + rr * Math.cos(angle);
        const y = cy + rr * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let i = 0; i < axes.length; i++) {
      const angle = startAngle + i * angleStep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const labelR = r + 16;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(axes[i].label, lx, ly);
    }

    ctx.beginPath();
    for (let i = 0; i <= axes.length; i++) {
      const idx = i % axes.length;
      const val = (data[axes[idx].key as keyof RadarChartData] || 0) / 100;
      const angle = startAngle + idx * angleStep;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(217, 171, 66, 0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(217, 171, 66, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < axes.length; i++) {
      const val = (data[axes[i].key as keyof RadarChartData] || 0) / 100;
      const angle = startAngle + i * angleStep;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(217, 171, 66)";
      ctx.fill();
    }
  }, [data, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} data-testid="radar-chart" />;
}

function isV2Profile(profile: any): boolean {
  return !!profile?.archetypeDescription || !!profile?.topSummaryLine || !!profile?._computedMetrics;
}

export default function ManagerProfilePage() {
  const { league, isLoading: leagueLoading } = useSelectedLeague();
  const leagueId = league?.league_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  usePageTitle("Manager Profile");

  const { data, isLoading, error } = useQuery<ProfileResponse>({
    queryKey: ["/api/manager-profile", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/manager-profile/${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!leagueId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/manager-profile/${leagueId}/analyze`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager-profile", leagueId] });
      toast({ title: "Profile Updated", description: "Your manager profile has been analyzed and updated." });
    },
    onError: (err: any) => {
      toast({ title: "Analysis Failed", description: err.message || "Could not analyze your transaction history.", variant: "destructive" });
    },
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="no-league-selected">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view your manager profile.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-60" />
      </div>
    );
  }

  const profile = data?.profile;
  const needsAnalysis = !profile || data?.needsAnalysis;

  if (needsAnalysis) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
            <Brain className="h-20 w-20 text-amber-400 relative" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-gold" data-testid="title-analyze-profile">AI Manager Profile</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            The AI will analyze your trade history, waiver moves, and transaction patterns to build a professional portfolio-style manager profile.
          </p>
          <Button
            size="lg"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="premium-shine bg-gradient-to-r from-amber-600 to-amber-500 text-black font-semibold px-8"
            data-testid="button-analyze-profile"
          >
            {analyzeMutation.isPending ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Analyzing Transactions...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Analyze My History
              </>
            )}
          </Button>
          {analyzeMutation.isPending && (
            <p className="text-sm text-muted-foreground animate-pulse">
              Scanning up to 3 seasons of transactions... This may take a moment.
            </p>
          )}
        </div>
      </div>
    );
  }

  const v2 = isV2Profile(profile);
  const metrics = profile._computedMetrics;
  const style = styleLabels[profile.managerStyle] || styleLabels.balanced;
  const StyleIcon = style.icon;
  const variance = varianceLabels[profile.riskVariance] || varianceLabels.moderate_variance;
  const horizon = horizonLabels[profile.timeHorizon] || horizonLabels.balanced;
  const isDynasty = metrics?.isDynasty ?? true;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold flex items-center gap-3" data-testid="title-manager-profile">
            <Brain className="h-7 w-7 text-amber-400" />
            AI Manager Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Based on {data?.tradesAnalyzed || 0} trades and {data?.transactionsAnalyzed || 0} waiver moves
            {data?.lastUpdated && ` \u00B7 Updated ${new Date(data.lastUpdated).toLocaleDateString()}`}
          </p>
          {v2 && metrics && (
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 text-xs" data-testid="badge-format">
                {metrics.primaryFormat}
              </Badge>
              {metrics.alsoActiveIn?.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Also active in: {metrics.alsoActiveIn.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="border-amber-500/30"
          data-testid="button-refresh-profile"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
          {v2 ? "Re-Analyze" : "Upgrade Profile"}
        </Button>
      </div>

      {data?.stale && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
          <AlertTriangle className="h-4 w-4" />
          Your profile may be outdated. Click re-analyze to scan your latest transactions.
        </div>
      )}

      {!v2 && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
          <Sparkles className="h-4 w-4" />
          This is a v1 profile. Click "Upgrade Profile" to unlock the full v2 analysis with quantified metrics, radar chart, and portfolio outlook.
        </div>
      )}

      {/* TOP SUMMARY LINE */}
      {v2 && profile.topSummaryLine && (
        <div className="text-lg font-medium text-amber-400/90 italic border-l-2 border-amber-500/40 pl-4" data-testid="text-top-summary">
          "{profile.topSummaryLine}"
        </div>
      )}

      {/* CORE ARCHETYPE CARD */}
      <Card className="border-amber-500/20 bg-gradient-to-br from-card to-amber-950/10 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <StyleIcon className={`h-8 w-8 ${style.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-xl font-bold text-amber-400" data-testid="text-manager-style">{style.label}</h2>
                {v2 ? (
                  <>
                    <Badge variant="outline" className={`${variance.color} border-current/30`} data-testid="badge-variance">
                      {variance.label}
                    </Badge>
                    <Badge variant="outline" className={`${horizon.color} border-current/30`} data-testid="badge-horizon">
                      {horizon.label}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline" className="text-amber-400 border-amber-500/30" data-testid="badge-risk">
                    {profile.riskTolerance?.replace(/_/g, " ") || "Moderate"}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground leading-relaxed text-sm" data-testid="text-archetype-description">
                {v2 ? profile.archetypeDescription : profile.summary}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BEHAVIOR METRICS */}
      {v2 && metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Trade Activity */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Trade Activity
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400" data-testid="text-trade-activity">{activityLabels[profile.tradeActivity] || profile.tradeActivity}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Percentile Rank</span>
                <span className="font-semibold text-amber-400" data-testid="text-trade-percentile">{metrics.tradePercentile}th</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-amber-500/70 h-1.5 rounded-full" style={{ width: `${metrics.tradePercentile}%` }} />
              </div>
            </CardContent>
          </Card>

          {/* Draft Pick Exposure */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <Target className="h-3.5 w-3.5" />
                Draft Pick Exposure
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400" data-testid="text-pick-exposure">{metrics.pickExposurePct}%</span>
                <span className="text-xs text-muted-foreground">of trades include picks</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Net Capital</span>
                <span className={`font-semibold ${metrics.netPicksGainedLost > 0 ? "text-green-400" : metrics.netPicksGainedLost < 0 ? "text-red-400" : "text-amber-400"}`} data-testid="text-net-picks">
                  {metrics.netPicksGainedLost > 0 ? "+" : ""}{metrics.netPicksGainedLost} picks
                </span>
              </div>
              {Object.keys(metrics.futurePicksByYear || {}).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {Object.entries(metrics.futurePicksByYear).map(([yr, net]) => (
                    <Badge key={yr} variant="outline" className={`text-xs ${Number(net) > 0 ? "border-green-500/30 text-green-400" : Number(net) < 0 ? "border-red-500/30 text-red-400" : "border-amber-500/30 text-amber-400"}`}>
                      {yr}: {Number(net) > 0 ? "+" : ""}{net}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Age Curve Bias */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" />
                Age Curve Bias
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${metrics.ageBiasLabel === "Youth-Leaning" ? "text-green-400" : metrics.ageBiasLabel === "Veteran-Leaning" ? "text-red-400" : "text-amber-400"}`} data-testid="text-age-bias">
                  {metrics.ageBiasLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Avg Acquired</span>
                  <div className="font-semibold" data-testid="text-avg-age-acquired">{metrics.avgAgeAcquired ?? "N/A"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Traded Away</span>
                  <div className="font-semibold" data-testid="text-avg-age-traded">{metrics.avgAgeTradedAway ?? "N/A"}</div>
                </div>
              </div>
              {metrics.netAgeDelta !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Net Delta</span>
                  <span className={`font-semibold ${metrics.netAgeDelta < 0 ? "text-green-400" : metrics.netAgeDelta > 0 ? "text-red-400" : "text-amber-400"}`}>
                    {metrics.netAgeDelta > 0 ? "+" : ""}{metrics.netAgeDelta} years
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRightLeft className="h-4 w-4" />
                Trade Frequency
              </div>
              <div className="font-semibold" data-testid="text-trade-frequency">{profile.tradeFrequency?.replace(/_/g, " ") || "Unknown"}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Age Preference
              </div>
              <div className="font-semibold" data-testid="text-age-preference">{profile.agePreference?.replace(/_/g, " ") || "Balanced"}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Draft Picks
              </div>
              <div className="font-semibold" data-testid="text-pick-strategy">{profile.draftPickStrategy?.replace(/_/g, " ") || "Balanced"}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4" />
                Waiver Activity
              </div>
              <div className="font-semibold" data-testid="text-waiver-activity">{profile.waiverActivity?.replace(/_/g, " ") || "Moderate"}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* POSITIONAL INVESTMENT BIAS + RADAR CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Positional Investment Bias */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Positional Investment Bias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {v2 ? (
              <>
                {(profile.positionalBias?.overweight?.length > 0 || metrics?.overweightPositions?.length > 0) && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Overweight</div>
                    <div className="flex flex-wrap gap-1.5" data-testid="badges-overweight">
                      {(profile.positionalBias?.overweight || metrics?.overweightPositions || []).map((pos, i) => (
                        <Badge key={i} variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">{pos}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(profile.positionalBias?.underweight?.length > 0 || metrics?.underweightPositions?.length > 0) && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Underweight</div>
                    <div className="flex flex-wrap gap-1.5" data-testid="badges-underweight">
                      {(profile.positionalBias?.underweight || metrics?.underweightPositions || []).map((pos, i) => (
                        <Badge key={i} variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10">{pos}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {metrics?.qbWarning && (
                  <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{metrics.qbWarning}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {(profile.positionPreferences?.favored?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Favored</div>
                    <div className="flex flex-wrap gap-1.5" data-testid="badges-favored-positions">
                      {profile.positionPreferences!.favored!.map((pos, i) => (
                        <Badge key={i} variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">{pos}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(profile.positionPreferences?.avoided?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Less Targeted</div>
                    <div className="flex flex-wrap gap-1.5" data-testid="badges-avoided-positions">
                      {profile.positionPreferences!.avoided!.map((pos, i) => (
                        <Badge key={i} variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10">{pos}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Radar Chart */}
        {v2 && profile.radarChart ? (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Manager Profile Radar
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <RadarChart data={profile.radarChart} />
            </CardContent>
          </Card>
        ) : (
          profile.keyPatterns && profile.keyPatterns.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Key Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2" data-testid="list-key-patterns">
                  {profile.keyPatterns.map((pattern, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* STRATEGIC TENDENCIES */}
      {v2 && profile.strategicTendencies?.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Crosshair className="h-4 w-4" />
              Strategic Tendencies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2" data-testid="list-strategic-tendencies">
              {profile.strategicTendencies.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* COMPETITIVE ADVANTAGES + STRATEGIC LEAKS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {v2 ? (
          <>
            {profile.competitiveAdvantages?.length > 0 && (
              <Card className="border-green-500/20 bg-gradient-to-br from-card to-green-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Competitive Advantages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2" data-testid="list-advantages">
                    {profile.competitiveAdvantages.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-green-400 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {profile.strategicLeaks?.length > 0 && (
              <Card className="border-red-500/20 bg-gradient-to-br from-card to-red-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Strategic Leaks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2" data-testid="list-leaks">
                    {profile.strategicLeaks.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-red-400 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            {profile.strengths && profile.strengths.length > 0 && (
              <Card className="border-green-500/20 bg-gradient-to-br from-card to-green-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2" data-testid="list-strengths">
                    {profile.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-green-400 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {profile.blindSpots && profile.blindSpots.length > 0 && (
              <Card className="border-amber-500/20 bg-gradient-to-br from-card to-amber-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2" data-testid="list-blind-spots">
                    {profile.blindSpots.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* DYNASTY-ONLY: Asset Portfolio Outlook */}
      {v2 && isDynasty && profile.assetPortfolioOutlook && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Asset Portfolio Outlook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="portfolio-outlook">
              {[
                { label: "Roster Age Curve", value: profile.assetPortfolioOutlook.rosterAgeCurve },
                { label: "Contender Window", value: profile.assetPortfolioOutlook.contenderWindow },
                { label: "Volatility Score", value: profile.assetPortfolioOutlook.volatilityScore },
                { label: "Liquidity Score", value: profile.assetPortfolioOutlook.liquidityScore },
              ].map((item) => {
                const ol = outlookLabels[item.value] || { label: item.value?.replace(/_/g, " ") || "N/A", color: "text-amber-400" };
                return (
                  <div key={item.label} className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className={`text-sm font-bold ${ol.color}`}>{ol.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DYNASTY-ONLY: Competitive Timeline Projection */}
      {v2 && isDynasty && profile.competitiveTimeline && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Competitive Timeline Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4" data-testid="competitive-timeline">
              {[
                { label: "Year 1", value: profile.competitiveTimeline.year1 },
                { label: "Year 2", value: profile.competitiveTimeline.year2 },
                { label: "Year 3+", value: profile.competitiveTimeline.year3plus },
              ].map((item) => {
                const tl = timelineLabels[item.value] || { label: item.value?.replace(/_/g, " ") || "N/A", color: "text-amber-400" };
                return (
                  <div key={item.label} className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-muted-foreground mb-1.5">{item.label}</div>
                    <div className={`text-sm font-bold ${tl.color}`}>{tl.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* REDRAFT-ONLY: Short-Term Competitive Index + Roster Stability */}
      {v2 && !isDynasty && (profile.shortTermCompetitiveIndex || profile.rosterStabilityScore) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.shortTermCompetitiveIndex && (
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  <Gauge className="h-3.5 w-3.5" />
                  Short-Term Competitive Index
                </div>
                <div className={`text-lg font-bold ${
                  profile.shortTermCompetitiveIndex === "strong_contender" ? "text-green-400" :
                  profile.shortTermCompetitiveIndex === "competitive" ? "text-amber-400" : "text-red-400"
                }`} data-testid="text-competitive-index">
                  {profile.shortTermCompetitiveIndex.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              </CardContent>
            </Card>
          )}
          {profile.rosterStabilityScore && (
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  <Shield className="h-3.5 w-3.5" />
                  Roster Stability Score
                </div>
                <div className={`text-lg font-bold ${
                  profile.rosterStabilityScore === "high" ? "text-green-400" :
                  profile.rosterStabilityScore === "moderate" ? "text-amber-400" : "text-red-400"
                }`} data-testid="text-stability-score">
                  {profile.rosterStabilityScore.replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* HOW THIS WORKS */}
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">How this works:</span> Your manager profile is built by analyzing your trade history, waiver moves, and transaction patterns across up to 3 seasons. Quantified metrics are computed from raw data, then AI generates strategic analysis. This profile personalizes all AI recommendations.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
