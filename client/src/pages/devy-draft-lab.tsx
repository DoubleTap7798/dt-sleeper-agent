import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Beaker, BarChart3, TrendingUp, Layers, ArrowLeftRight } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { calculateDVI } from "./devy-rankings";
import type { DevyPlayer, DevyData } from "./devy-rankings";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell
} from "recharts";

const DRAFT_YEARS = [2026, 2027, 2028, 2029];

const POS_COLORS: Record<string, string> = {
  QB: "#ef4444",
  RB: "#3b82f6",
  WR: "#22c55e",
  TE: "#f59e0b",
};

function getClassStrength(players: DevyPlayer[], year: number): number {
  const classPlayers = players.filter(p => p.draftEligibleYear === year);
  if (classPlayers.length === 0) return 0;
  const avgDvi = classPlayers.reduce((sum, p) => sum + calculateDVI(p), 0) / classPlayers.length;
  const topCount = classPlayers.filter(p => p.tier <= 2).length;
  const depthBonus = Math.min(20, classPlayers.length * 0.5);
  const topBonus = Math.min(30, topCount * 5);
  return Math.round(Math.min(100, avgDvi * 0.5 + depthBonus + topBonus));
}

function getPositionDepth(players: DevyPlayer[], year: number) {
  const classPlayers = players.filter(p => p.draftEligibleYear === year);
  const positions = ["QB", "RB", "WR", "TE"];
  return positions.map(pos => {
    const posPlayers = classPlayers.filter(p => p.position === pos);
    const quality = posPlayers.filter(p => p.tier <= 3).length;
    const total = posPlayers.length;
    return { position: pos, quality, total, avgDvi: total > 0 ? Math.round(posPlayers.reduce((s, p) => s + calculateDVI(p), 0) / total) : 0 };
  });
}

function getRound1Density(players: DevyPlayer[], year: number) {
  const classPlayers = players.filter(p => p.draftEligibleYear === year);
  const ranges = [
    { label: "90-100%", min: 90, max: 100 },
    { label: "70-89%", min: 70, max: 89 },
    { label: "50-69%", min: 50, max: 69 },
    { label: "30-49%", min: 30, max: 49 },
    { label: "10-29%", min: 10, max: 29 },
    { label: "0-9%", min: 0, max: 9 },
  ];
  return ranges.map(r => ({
    range: r.label,
    count: classPlayers.filter(p => p.round1Pct >= r.min && p.round1Pct <= r.max).length,
  }));
}

function getRookiePickValue(players: DevyPlayer[], year: number) {
  const classPlayers = players.filter(p => p.draftEligibleYear === year)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 12);
  return classPlayers.map((p, i) => ({
    name: p.name.split(" ").pop() || p.name,
    fullName: p.name,
    position: p.position,
    pickValue: Math.round(p.pickMultiplier * 100),
    dvi: calculateDVI(p),
    rank: i + 1,
  }));
}

export default function DevyDraftLabPage() {
  usePageTitle("Draft Value Lab");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [compareYear, setCompareYear] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <DraftLabSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-draft-lab">
        <p className="text-muted-foreground">Failed to load draft lab data</p>
      </div>
    );
  }

  const { players } = data;
  const classStrengths = DRAFT_YEARS.map(y => ({
    year: y,
    score: getClassStrength(players, y),
    count: players.filter(p => p.draftEligibleYear === y).length,
  }));

  const positionDepth = getPositionDepth(players, selectedYear);
  const round1Density = getRound1Density(players, selectedYear);
  const rookiePickValues = getRookiePickValue(players, selectedYear);

  const comparePositionDepth = compareYear ? getPositionDepth(players, compareYear) : null;

  const comparisonData = compareYear ? ["QB", "RB", "WR", "TE"].map(pos => {
    const primary = positionDepth.find(p => p.position === pos);
    const compare = comparePositionDepth?.find(p => p.position === pos);
    return {
      position: pos,
      [selectedYear]: primary?.quality || 0,
      [compareYear]: compare?.quality || 0,
    };
  }) : null;

  return (
    <PremiumGate featureName="Draft Value Lab">
    <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-draft-lab-page">
      <div className="relative overflow-hidden rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/40 via-stone-950/80 to-stone-950/60 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-700/10 via-transparent to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-amber-700/20 border border-amber-700/30 flex items-center justify-center">
            <Beaker className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-amber-100" data-testid="text-draft-lab-title">
              Draft Value Lab
            </h1>
            <p className="text-sm text-amber-200/60">
              Analyze draft class strength, position depth, and pick value curves
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap" data-testid="draft-lab-year-tabs">
        {DRAFT_YEARS.map(year => (
          <Button
            key={year}
            variant={selectedYear === year ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedYear(year)}
            className="toggle-elevate"
            data-testid={`button-year-${year}`}
          >
            {year}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Compare:</span>
          {DRAFT_YEARS.filter(y => y !== selectedYear).map(year => (
            <Button
              key={year}
              variant={compareYear === year ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCompareYear(compareYear === year ? null : year)}
              className="toggle-elevate"
              data-testid={`button-compare-${year}`}
            >
              {year}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="class-strength-cards">
        {classStrengths.map(cs => (
          <Card
            key={cs.year}
            className={`border-amber-800/20 bg-stone-950/60 cursor-pointer hover-elevate ${
              selectedYear === cs.year ? "ring-1 ring-amber-500/50" : ""
            }`}
            onClick={() => setSelectedYear(cs.year)}
            data-testid={`card-class-strength-${cs.year}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-amber-200/70">{cs.year} Class</span>
                <Badge variant="secondary" className="text-[10px]">{cs.count} players</Badge>
              </div>
              <div className="flex items-end gap-2">
                <span className={`text-2xl font-bold ${
                  cs.score >= 70 ? "text-green-400" :
                  cs.score >= 50 ? "text-amber-400" :
                  cs.score >= 30 ? "text-yellow-500" :
                  "text-red-400"
                }`} data-testid={`text-strength-score-${cs.year}`}>{cs.score}</span>
                <span className="text-xs text-muted-foreground mb-1">/100</span>
              </div>
              <div className="mt-2 h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    cs.score >= 70 ? "bg-green-500" :
                    cs.score >= 50 ? "bg-amber-500" :
                    cs.score >= 30 ? "bg-yellow-500" :
                    "bg-red-500"
                  }`}
                  style={{ width: `${cs.score}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {compareYear && comparisonData ? (
        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-class-comparison">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <ArrowLeftRight className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-100">
                Class Comparison: {selectedYear} vs {compareYear}
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#44403c" />
                  <XAxis dataKey="position" stroke="#a8a29e" fontSize={12} />
                  <YAxis stroke="#a8a29e" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#1c1917", border: "1px solid #44403c", borderRadius: 8 }}
                    labelStyle={{ color: "#fde68a" }}
                  />
                  <Legend />
                  <Bar dataKey={selectedYear} fill="#f59e0b" radius={[4, 4, 0, 0]} name={`${selectedYear} Quality`} />
                  <Bar dataKey={compareYear} fill="#6366f1" radius={[4, 4, 0, 0]} name={`${compareYear} Quality`} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-position-depth">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-100">
                Position Depth Index — {selectedYear}
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positionDepth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#44403c" />
                  <XAxis dataKey="position" stroke="#a8a29e" fontSize={12} />
                  <YAxis stroke="#a8a29e" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#1c1917", border: "1px solid #44403c", borderRadius: 8 }}
                    labelStyle={{ color: "#fde68a" }}
                    formatter={(value: number, name: string) => [value, name === "quality" ? "Quality Prospects" : "Total"]}
                  />
                  <Bar dataKey="quality" name="Quality (T1-T3)" radius={[4, 4, 0, 0]}>
                    {positionDepth.map((entry) => (
                      <Cell key={entry.position} fill={POS_COLORS[entry.position] || "#a8a29e"} />
                    ))}
                  </Bar>
                  <Bar dataKey="total" name="Total" fill="#44403c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {positionDepth.map(pd => (
                <div key={pd.position} className="text-center" data-testid={`text-depth-${pd.position}`}>
                  <Badge variant="outline" className={`text-[10px] mb-1 ${getPositionColorClass(pd.position)}`}>
                    {pd.position}
                  </Badge>
                  <div className="text-xs text-muted-foreground">{pd.quality}/{pd.total}</div>
                  <div className="text-xs font-medium">{pd.avgDvi} DVI</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-round1-density">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-100">
                Round 1 Probability Density — {selectedYear}
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={round1Density}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#44403c" />
                  <XAxis dataKey="range" stroke="#a8a29e" fontSize={10} />
                  <YAxis stroke="#a8a29e" fontSize={12} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#1c1917", border: "1px solid #44403c", borderRadius: 8 }}
                    labelStyle={{ color: "#fde68a" }}
                    formatter={(value: number) => [value, "Prospects"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-rookie-pick-value">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-100">
              Rookie Pick Value Curve — {selectedYear} (Top 12)
            </span>
          </div>
          {rookiePickValues.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rookiePickValues}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#44403c" />
                  <XAxis dataKey="name" stroke="#a8a29e" fontSize={10} angle={-30} textAnchor="end" height={50} />
                  <YAxis stroke="#a8a29e" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#1c1917", border: "1px solid #44403c", borderRadius: 8 }}
                    labelStyle={{ color: "#fde68a" }}
                    formatter={(value: number, name: string) => [value, name === "pickValue" ? "Pick Value" : "DVI"]}
                    labelFormatter={(label: string, payload: any[]) => {
                      if (payload?.[0]?.payload?.fullName) return payload[0].payload.fullName;
                      return label;
                    }}
                  />
                  <Bar dataKey="pickValue" name="Pick Value" radius={[4, 4, 0, 0]}>
                    {rookiePickValues.map((entry) => (
                      <Cell key={entry.rank} fill={POS_COLORS[entry.position] || "#a8a29e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No prospects available for {selectedYear}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PremiumGate>
  );
}

function DraftLabSkeleton() {
  return (
    <div className="space-y-6" data-testid="devy-draft-lab-skeleton">
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-16" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-56 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
