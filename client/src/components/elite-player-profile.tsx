import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Activity,
  AlertTriangle,
  Zap,
  Crown,
  Clock,
  LineChart,
  Layers,
  Brain,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { InfoTooltip } from "@/components/metric-tooltip";
import { useParams } from "wouter";

interface EliteProfileProps {
  playerId: string;
  leagueId?: string;
}

const ARCHETYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  alpha_producer: { icon: Crown, color: "text-amber-400" },
  ascending_asset: { icon: TrendingUp, color: "text-green-400" },
  prime_window: { icon: Target, color: "text-amber-400" },
  declining_veteran: { icon: TrendingDown, color: "text-red-400" },
  volatile_upside: { icon: Zap, color: "text-amber-400" },
  floor_anchor: { icon: Shield, color: "text-green-400" },
  injury_risk: { icon: AlertTriangle, color: "text-red-400" },
  unknown_commodity: { icon: Activity, color: "text-amber-400/60" },
};

const TIER_COLORS: Record<string, string> = {
  S: "text-amber-400 border-amber-400/40",
  A: "text-green-400 border-green-400/40",
  B: "text-amber-400/70 border-amber-400/30",
  C: "text-red-400/70 border-red-400/30",
  D: "text-red-400 border-red-400/40",
};

function GradeBar({ label, value, tooltip }: { label: string; value: number; tooltip?: string }) {
  const pct = Math.round(value * 100);
  const barColor = pct >= 70 ? "bg-green-500" : pct >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2" data-testid={`grade-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="w-24 text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip title={label} description={tooltip} />}
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right">{pct}</span>
    </div>
  );
}

function HistogramChart({ histogram, mean, floor, ceiling, boomThreshold, bustThreshold }: {
  histogram: { bucket: number; count: number }[];
  mean: number;
  floor: number;
  ceiling: number;
  boomThreshold: number;
  bustThreshold: number;
}) {
  if (!histogram.length) return null;
  const maxCount = Math.max(...histogram.map(h => h.count));
  const chartH = 80;
  const chartW = 280;
  const barW = Math.max(4, chartW / histogram.length - 1);

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH + 16}`} className="w-full h-auto" data-testid="monte-carlo-chart">
      {histogram.map((h, i) => {
        const barH = maxCount > 0 ? (h.count / maxCount) * chartH : 0;
        const x = i * (barW + 1);
        const isBoom = h.bucket >= boomThreshold;
        const isBust = h.bucket <= bustThreshold;
        const fill = isBoom ? "#22c55e" : isBust ? "#ef4444" : "#d4a040";
        return (
          <rect
            key={i}
            x={x}
            y={chartH - barH}
            width={barW}
            height={barH}
            fill={fill}
            opacity={0.7}
            rx={1}
          />
        );
      })}
      <line x1={0} y1={chartH + 1} x2={chartW} y2={chartH + 1} stroke="#555" strokeWidth={0.5} />
      <text x={2} y={chartH + 12} fontSize={8} fill="#888">{floor.toFixed(1)}</text>
      <text x={chartW / 2 - 10} y={chartH + 12} fontSize={8} fill="#d4a040">{mean.toFixed(1)} avg</text>
      <text x={chartW - 30} y={chartH + 12} fontSize={8} fill="#888">{ceiling.toFixed(1)}</text>
    </svg>
  );
}

function AgeCurveChart({ projections, peakWindow }: {
  projections: { age: number; year: number; projectedValue: number; confidence: number; phase: string }[];
  peakWindow: [number, number];
}) {
  if (!projections.length) return null;
  const maxVal = Math.max(...projections.map(p => p.projectedValue));
  const minVal = Math.min(...projections.map(p => p.projectedValue)) * 0.8;
  const range = maxVal - minVal || 1;
  const chartW = 240;
  const chartH = 60;

  const points = projections.map((p, i) => {
    const x = (i / Math.max(projections.length - 1, 1)) * chartW;
    const y = chartH - ((p.projectedValue - minVal) / range) * chartH;
    return { x, y, ...p };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} className="w-full h-auto" data-testid="age-curve-chart">
      <path d={pathD} stroke="#d4a040" strokeWidth={2} fill="none" />
      {points.map((p, i) => {
        const fill = p.phase === 'ascending' ? '#22c55e' : p.phase === 'peak' ? '#d4a040' : '#ef4444';
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={fill} stroke="#000" strokeWidth={1} />
            <text x={p.x} y={chartH + 12} fontSize={8} fill="#888" textAnchor="middle">
              {p.age}
            </text>
            <text x={p.x} y={p.y - 8} fontSize={7} fill="#aaa" textAnchor="middle">
              {(p.projectedValue / 1000).toFixed(1)}k
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ElitePlayerProfileTab({ playerId, leagueId: propLeagueId }: EliteProfileProps) {
  const [showAllStress, setShowAllStress] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const params = useParams<{ leagueId?: string }>();
  const leagueId = propLeagueId || params?.leagueId;

  const { data: profile, isLoading, error } = useQuery<any>({
    queryKey: ["/api/player", playerId, "elite-profile", leagueId],
    queryFn: async () => {
      const qs = leagueId ? `?leagueId=${leagueId}` : '';
      const res = await fetch(`/api/player/${playerId}/elite-profile${qs}`);
      if (!res.ok) throw new Error("Failed to fetch elite profile");
      return res.json();
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });

  const summaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/player/${playerId}/elite-summary`, { leagueId: leagueId || null });
      return res.json();
    },
    onSuccess: (data) => {
      setAiSummary(data.summary);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-2" data-testid="elite-profile-loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="py-6 text-center text-muted-foreground" data-testid="elite-profile-error">
        Unable to load elite profile data.
      </div>
    );
  }

  const archetypeCfg = ARCHETYPE_CONFIG[profile.archetype?.archetype] || ARCHETYPE_CONFIG.unknown_commodity;
  const ArchIcon = archetypeCfg.icon;
  const tierColor = TIER_COLORS[profile.dynastyAssetScore?.tier] || TIER_COLORS.C;

  const stressTests = profile.stressTests || [];
  const visibleStress = showAllStress ? stressTests : stressTests.slice(0, 3);

  return (
    <div className="space-y-3 p-1" data-testid="elite-player-profile">
      <Card className="p-3 border-amber-500/20" data-testid="archetype-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArchIcon className={`h-5 w-5 ${archetypeCfg.color}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{profile.archetype?.label}</span>
                <Badge variant="outline" className={`text-xs ${tierColor}`} data-testid="dynasty-tier">
                  Tier {profile.dynastyAssetScore?.tier}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{profile.archetype?.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-400" data-testid="composite-score">
              {Math.round((profile.dynastyAssetScore?.composite || 0) * 100)}
            </div>
            <div className="text-[10px] text-muted-foreground">Asset Score</div>
          </div>
        </div>
      </Card>

      <Card className="p-3" data-testid="dynasty-asset-score">
        <div className="flex items-center gap-1.5 mb-2">
          <Layers className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Dynasty Asset Breakdown</span>
        </div>
        <div className="space-y-1.5">
          <GradeBar label="Production" value={profile.dynastyAssetScore?.productionGrade || 0} tooltip="Weekly fantasy output relative to elite threshold" />
          <GradeBar label="Age Grade" value={profile.dynastyAssetScore?.ageGrade || 0} tooltip="Position-adjusted age curve value" />
          <GradeBar label="Role Security" value={profile.dynastyAssetScore?.roleSecurityGrade || 0} tooltip="Snap share and depth chart position" />
          <GradeBar label="Volatility" value={profile.dynastyAssetScore?.volatilityGrade || 0} tooltip="Week-to-week consistency (higher = more stable)" />
          <GradeBar label="Injury" value={profile.dynastyAssetScore?.injuryResilienceGrade || 0} tooltip="Games played and injury history" />
          <GradeBar label="Draft Capital" value={profile.dynastyAssetScore?.draftCapitalGrade || 0} tooltip="NFL draft round investment" />
        </div>
      </Card>

      <Card className="p-3" data-testid="monte-carlo-section">
        <div className="flex items-center gap-1.5 mb-2">
          <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Monte Carlo Distribution</span>
          <Badge variant="outline" className="text-[10px] ml-auto">{profile.monteCarlo?.iterations?.toLocaleString()} sims</Badge>
        </div>
        <HistogramChart
          histogram={profile.monteCarlo?.histogram || []}
          mean={profile.monteCarlo?.mean || 0}
          floor={profile.monteCarlo?.floor || 0}
          ceiling={profile.monteCarlo?.ceiling || 0}
          boomThreshold={profile.monteCarlo?.boomThreshold || 0}
          bustThreshold={profile.monteCarlo?.bustThreshold || 0}
        />
        <div className="grid grid-cols-4 gap-2 mt-2">
          <div className="text-center">
            <div className="text-xs font-mono text-red-400" data-testid="mc-floor">{profile.monteCarlo?.floor?.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Floor</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono text-amber-400" data-testid="mc-median">{profile.monteCarlo?.median?.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Median</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono text-green-400" data-testid="mc-ceiling">{profile.monteCarlo?.ceiling?.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Ceiling</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono" data-testid="mc-stddev">{profile.monteCarlo?.stdDev?.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Std Dev</div>
          </div>
        </div>
        <div className="flex justify-between mt-2 px-2">
          <span className="text-[10px]">
            <span className="text-green-400 font-semibold">{Math.round((profile.monteCarlo?.boomProb || 0) * 100)}%</span>
            <span className="text-muted-foreground ml-1">Boom</span>
          </span>
          <span className="text-[10px]">
            <span className="text-red-400 font-semibold">{Math.round((profile.monteCarlo?.bustProb || 0) * 100)}%</span>
            <span className="text-muted-foreground ml-1">Bust</span>
          </span>
        </div>
      </Card>

      <Card className="p-3" data-testid="age-curve-section">
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Age Curve Projection (3-Year)</span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {profile.ageCurve?.depreciationRate}%/yr decay
          </Badge>
        </div>
        <AgeCurveChart
          projections={profile.ageCurve?.projections || []}
          peakWindow={profile.ageCurve?.peakWindow || [25, 30]}
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 px-1">
          <span>Peak: {profile.ageCurve?.peakWindow?.[0]}-{profile.ageCurve?.peakWindow?.[1]}</span>
          <span>
            {profile.ageCurve?.yearsUntilDecline > 0
              ? <span className="text-green-400">{profile.ageCurve.yearsUntilDecline}yr to decline</span>
              : <span className="text-red-400">Past peak window</span>
            }
          </span>
        </div>
      </Card>

      {profile.correlationRisk?.correlatedPlayers?.length > 0 && (
        <Card className="p-3" data-testid="correlation-risk">
          <div className="flex items-center gap-1.5 mb-2">
            <LineChart className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">Correlation & Stack Risk</span>
          </div>
          <div className="space-y-1">
            {profile.correlationRisk.correlatedPlayers.slice(0, 4).map((cp: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs" data-testid={`corr-player-${i}`}>
                <span className="text-muted-foreground truncate max-w-[120px]">{cp.playerName}</span>
                <span className="text-[10px] text-muted-foreground">{cp.correlationType}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${cp.stackRisk === 'high' ? 'text-red-400 border-red-400/30' : cp.stackRisk === 'medium' ? 'text-amber-400 border-amber-400/30' : 'text-green-400 border-green-400/30'}`}
                >
                  {cp.correlationCoeff > 0 ? '+' : ''}{cp.correlationCoeff}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">{profile.correlationRisk.stackRiskSummary}</p>
        </Card>
      )}

      <Card className="p-3" data-testid="market-sentiment">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Market Sentiment</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-sm font-bold text-amber-400" data-testid="dynasty-value">
              {((profile.marketSentiment?.dynastyValue || 0) / 1000).toFixed(1)}k
            </div>
            <div className="text-[10px] text-muted-foreground">Dynasty Value</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1" data-testid="value-trend">
              {profile.marketSentiment?.valueTrend === 'rising' ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              ) : profile.marketSentiment?.valueTrend === 'falling' ? (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={`text-sm font-semibold ${profile.marketSentiment?.valueTrend === 'rising' ? 'text-green-400' : profile.marketSentiment?.valueTrend === 'falling' ? 'text-red-400' : ''}`}>
                {profile.marketSentiment?.valueTrend}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">Trend</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold" data-testid="pos-rank">#{profile.marketSentiment?.positionRank}</div>
            <div className="text-[10px] text-muted-foreground">{profile.position} Rank</div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground px-1">
          <span>Trade Volume: <span className={profile.marketSentiment?.tradeVolume === 'high' ? 'text-green-400' : profile.marketSentiment?.tradeVolume === 'low' ? 'text-red-400' : 'text-amber-400'}>{profile.marketSentiment?.tradeVolume}</span></span>
          <span>Value/Production: <span className={profile.marketSentiment?.valueVsProduction > 1.2 ? 'text-red-400' : profile.marketSentiment?.valueVsProduction < 0.8 ? 'text-green-400' : 'text-amber-400'}>{profile.marketSentiment?.valueVsProduction?.toFixed(2)}x</span></span>
        </div>
      </Card>

      <Card className="p-3" data-testid="stress-tests">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Stress Test Simulator</span>
        </div>
        <div className="space-y-1.5">
          {visibleStress.map((st: any) => (
            <div key={st.id} className="flex items-center justify-between text-xs" data-testid={`stress-${st.id}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{st.label}</div>
                <div className="text-[10px] text-muted-foreground">{Math.round(st.probabilityOfOccurrence * 100)}% prob</div>
              </div>
              <div className="flex items-center gap-3 ml-2">
                <span className={`font-mono text-xs ${st.valueImpactPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {st.valueImpactPct > 0 ? '+' : ''}{Math.round(st.valueImpactPct * 100)}%
                </span>
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${st.sensitivityScore > 0.7 ? 'bg-red-500' : st.sensitivityScore > 0.5 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.round(st.sensitivityScore * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {stressTests.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 text-xs h-6"
            onClick={() => setShowAllStress(!showAllStress)}
            data-testid="toggle-stress-tests"
          >
            {showAllStress ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {showAllStress ? 'Show Less' : `Show All (${stressTests.length})`}
          </Button>
        )}
      </Card>

      {profile.devyProspect?.isDevy && (
        <Card className="p-3 border-purple-500/20" data-testid="devy-prospect">
          <div className="flex items-center gap-1.5 mb-2">
            <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-xs font-semibold">Devy Prospect Intel</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {profile.devyProspect.collegeTeam && (
              <div>
                <span className="text-muted-foreground">College: </span>
                <span className="font-medium">{profile.devyProspect.collegeTeam}</span>
              </div>
            )}
            {profile.devyProspect.class && (
              <div>
                <span className="text-muted-foreground">Class: </span>
                <span className="font-medium">{profile.devyProspect.class}</span>
              </div>
            )}
            {profile.devyProspect.draftProjection && (
              <div>
                <span className="text-muted-foreground">Draft Proj: </span>
                <span className="font-medium">{profile.devyProspect.draftProjection}</span>
              </div>
            )}
            {profile.devyProspect.archetype && (
              <div>
                <span className="text-muted-foreground">Archetype: </span>
                <span className="font-medium">{profile.devyProspect.archetype}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-3" data-testid="ai-executive-summary">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">AI Executive Summary</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={() => summaryMutation.mutate()}
            disabled={summaryMutation.isPending}
            data-testid="generate-ai-summary"
          >
            {summaryMutation.isPending ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing</>
            ) : (
              <><Brain className="h-3 w-3 mr-1" /> Generate</>
            )}
          </Button>
        </div>
        {aiSummary ? (
          <div className="text-xs space-y-1 whitespace-pre-line" data-testid="ai-summary-content">
            {aiSummary}
          </div>
        ) : summaryMutation.isError ? (
          <p className="text-xs text-red-400">Failed to generate summary. Try again.</p>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Click Generate to produce an AI executive brief derived from the structured simulation data above.
          </p>
        )}
      </Card>
    </div>
  );
}
