import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Swords,
  LayoutList,
  ArrowRightLeft,
  DollarSign,
  CalendarRange,
  ShieldAlert,
  Trophy,
  Play,
  Loader2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Target,
  AlertTriangle,
  XCircle,
  Search,
  X,
} from "lucide-react";

type TabId = "matchup" | "lineup" | "trade" | "faab" | "season" | "portfolio" | "championship" | "exploit" | "regression" | "equity";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "matchup", label: "Matchup Sim", icon: Swords },
  { id: "lineup", label: "Lineup Optimizer", icon: LayoutList },
  { id: "trade", label: "Trade Evaluator", icon: ArrowRightLeft },
  { id: "faab", label: "FAAB Optimizer", icon: DollarSign },
  { id: "season", label: "Season Outlook", icon: CalendarRange },
  { id: "portfolio", label: "Portfolio Risk", icon: ShieldAlert },
  { id: "championship", label: "Championship Path", icon: Trophy },
  { id: "exploit", label: "Exploit Report", icon: Target },
  { id: "regression", label: "Regression Alerts", icon: TrendingDown },
  { id: "equity", label: "Title Equity", icon: Sparkles },
];

const REC_CONFIG: Record<string, { label: string; className: string }> = {
  strong_yes: { label: "STRONG YES", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  lean_yes: { label: "LEAN YES", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  neutral: { label: "NEUTRAL", className: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
  lean_no: { label: "LEAN NO", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  strong_no: { label: "STRONG NO", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function colorForValue(val: number, neutral = 0): string {
  if (val > neutral) return "text-emerald-400";
  if (val < neutral) return "text-red-400";
  return "text-amber-400";
}

function pctStr(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

function GaugeBar({ value, max = 1, label }: { value: number; max?: number; label: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct > 70 ? "bg-emerald-500" : pct > 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(2)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScoreRange({ floor, median, ceiling, label }: { floor: number; median: number; ceiling: number; label: string }) {
  const maxVal = Math.max(ceiling, 200);
  const floorPct = (floor / maxVal) * 100;
  const medPct = (median / maxVal) * 100;
  const ceilPct = (ceiling / maxVal) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-amber-400">{median.toFixed(1)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-red-500/50 via-amber-500/50 to-emerald-500/50 rounded-full"
          style={{ left: `${floorPct}%`, width: `${ceilPct - floorPct}%` }}
        />
        <div
          className="absolute top-0 h-full w-1 bg-white rounded-full"
          style={{ left: `${medPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-red-400">{floor.toFixed(1)}</span>
        <span className="text-emerald-400">{ceiling.toFixed(1)}</span>
      </div>
    </div>
  );
}

function RecommendationBadge({ rec }: { rec: string }) {
  const config = REC_CONFIG[rec] || REC_CONFIG.neutral;
  return (
    <Badge variant="outline" className={config.className} data-testid="badge-recommendation">
      {config.label}
    </Badge>
  );
}

function ErrorCard({ error }: { error: Error | null }) {
  if (!error) return null;
  const msg = error.message || "An unexpected error occurred";
  const cleanMsg = msg.replace(/^\d+:\s*/, "").replace(/^"(.*)"$/, "$1");

  let parsed: string;
  try {
    const obj = JSON.parse(cleanMsg);
    parsed = obj.error || obj.message || cleanMsg;
  } catch {
    parsed = cleanMsg;
  }

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardContent className="p-4 flex items-start gap-3">
        <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-400">Something went wrong</p>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-error-message">{parsed}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionCard({ decision }: { decision: any }) {
  if (!decision) return null;
  return (
    <Card className="border-amber-500/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-semibold text-amber-400">Decision</span>
          <RecommendationBadge rec={decision.recommendation} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">EV Delta</p>
            <p className={`font-bold ${colorForValue(decision.evDelta)}`} data-testid="text-ev-delta">
              {decision.evDelta > 0 ? "+" : ""}{decision.evDelta.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Win Prob Shift</p>
            <p className={`font-bold ${colorForValue(decision.winProbabilityShift)}`}>
              {decision.winProbabilityShift > 0 ? "+" : ""}{pctStr(decision.winProbabilityShift)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Playoff Shift</p>
            <p className={`font-bold ${colorForValue(decision.playoffProbabilityShift)}`}>
              {decision.playoffProbabilityShift > 0 ? "+" : ""}{pctStr(decision.playoffProbabilityShift)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Confidence</p>
            <Progress value={decision.confidence * 100} className="mt-1" />
            <p className="text-xs font-mono mt-0.5">{pctStr(decision.confidence)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AiAnalysisCard({ explanation }: { explanation: string | undefined | null }) {
  if (!explanation) return null;
  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-amber-400">AI Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-ai-analysis">{explanation}</p>
      </CardContent>
    </Card>
  );
}

function RunButton({ onClick, isPending, label = "Run Analysis" }: { onClick: () => void; isPending: boolean; label?: string }) {
  return (
    <Button
      onClick={onClick}
      disabled={isPending}
      variant="outline"
      className="bg-amber-500/20 text-amber-400 border-amber-500/30"
      data-testid="button-run-analysis"
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Running simulations...
        </>
      ) : (
        <>
          <Play className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}

interface SelectedPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
}

function PlayerSearchInput({
  label,
  selectedPlayers,
  onAdd,
  onRemove,
  labelColor = "text-amber-400",
  testIdPrefix,
}: {
  label: string;
  selectedPlayers: SelectedPlayer[];
  onAdd: (player: SelectedPlayer) => void;
  onRemove: (id: string) => void;
  labelColor?: string;
  testIdPrefix: string;
}) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: searchResults, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: [`/api/fantasy/players?search=${encodeURIComponent(search)}&limit=10`],
    enabled: search.length >= 2,
    staleTime: 30000,
  });

  const players = (searchResults as any)?.players || [];
  const selectedIds = new Set(selectedPlayers.map(p => p.id));

  return (
    <div className="space-y-2">
      <label className={`text-sm font-medium ${labelColor}`}>{label}</label>
      <div className="relative">
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 flex-wrap min-h-[40px]">
          {selectedPlayers.map(p => (
            <Badge
              key={p.id}
              variant="outline"
              className="text-xs border-amber-500/30 text-amber-400 gap-1 shrink-0"
              data-testid={`badge-player-${p.id}`}
            >
              {p.name} ({p.position})
              <button onClick={() => onRemove(p.id)} className="ml-0.5" data-testid={`button-remove-player-${p.id}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <div className="flex-1 min-w-[120px] relative">
            <Input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search players..."
              className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 text-sm"
              data-testid={`${testIdPrefix}-search`}
            />
          </div>
        </div>
        {showDropdown && search.length >= 2 && (
          <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-lg max-h-48 overflow-y-auto" data-testid={`${testIdPrefix}-dropdown`}>
            {searchLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching...
              </div>
            )}
            {searchError && (
              <div className="px-3 py-2 text-sm text-red-400">Search failed. Try again.</div>
            )}
            {!searchLoading && !searchError && players.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground" data-testid={`${testIdPrefix}-no-results`}>No players found</div>
            )}
            {players
              .filter((p: any) => !selectedIds.has(p.id))
              .map((p: any) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-800 flex items-center justify-between text-sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAdd({ id: p.id, name: p.name, position: p.position, team: p.team });
                    setSearch("");
                    setShowDropdown(false);
                  }}
                  data-testid={`${testIdPrefix}-option-${p.id}`}
                >
                  <span>{p.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{p.position}</Badge>
                    <span className="text-xs text-muted-foreground">{p.team}</span>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchupTab({ leagueId }: { leagueId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/engine/matchup-sim/${leagueId}`);
      return await res.json();
    },
  });

  const data = mutation.data;
  const isOffseason = data && (!data.simulation?.opponentScoreDistribution || data.opponentLineup?.length === 0);

  return (
    <div className="space-y-4">
      <RunButton onClick={() => mutation.mutate()} isPending={mutation.isPending} />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          {isOffseason && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                <p className="text-sm text-amber-300">Offseason mode - showing your roster projections based on last season's data. Opponent data unavailable.</p>
              </CardContent>
            </Card>
          )}

          {data.simulation && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-amber-500/20 md:col-span-1">
                <CardContent className="p-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground uppercase">Win Probability</p>
                  <div className="relative mx-auto w-28 h-28">
                    <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgb(63 63 70)"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={data.simulation.winProbability > 0.55 ? "rgb(52 211 153)" : data.simulation.winProbability > 0.45 ? "rgb(251 191 36)" : "rgb(248 113 113)"}
                        strokeWidth="3"
                        strokeDasharray={`${data.simulation.winProbability * 100}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold" data-testid="text-win-probability">
                        {pctStr(data.simulation.winProbability)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Expected Margin: <span className={`font-bold ${colorForValue(data.simulation.expectedMargin)}`} data-testid="text-expected-margin">{data.simulation.expectedMargin > 0 ? "+" : ""}{data.simulation.expectedMargin.toFixed(1)}</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-amber-500/20 md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-400">Score Distributions</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {data.simulation.userScoreDistribution && (
                    <ScoreRange
                      floor={data.simulation.userScoreDistribution.p25}
                      median={data.simulation.userScoreDistribution.p50}
                      ceiling={data.simulation.userScoreDistribution.p75}
                      label="Your Team"
                    />
                  )}
                  {data.simulation.opponentScoreDistribution && (
                    <ScoreRange
                      floor={data.simulation.opponentScoreDistribution.p25}
                      median={data.simulation.opponentScoreDistribution.p50}
                      ceiling={data.simulation.opponentScoreDistribution.p75}
                      label="Opponent"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {data.userLineup && data.userLineup.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Your Roster Projections</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-1">
                  {data.userLineup.map((p: any) => (
                    <div key={p.playerId} className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] w-8 justify-center">{p.position}</Badge>
                        <span>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-red-400">{p.floor.toFixed(1)}</span>
                        <span className="text-amber-400 font-bold">{p.median.toFixed(1)}</span>
                        <span className="text-emerald-400">{p.ceiling.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.keyMatchups && data.keyMatchups.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Key Positional Matchups</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.keyMatchups.map((m: any) => (
                    <div key={m.description} className="p-3 rounded-md bg-zinc-900 border border-zinc-800 text-center" data-testid={`card-matchup-${m.description}`}>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                      <p className={`text-lg font-bold ${m.advantage === "user" ? "text-emerald-400" : m.advantage === "opponent" ? "text-red-400" : "text-amber-400"}`}>
                        {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}
                      </p>
                      <Badge variant="outline" className={`text-[10px] ${m.advantage === "user" ? "text-emerald-400 border-emerald-500/30" : m.advantage === "opponent" ? "text-red-400 border-red-500/30" : "text-amber-400 border-amber-500/30"}`}>
                        {m.advantage === "user" ? "Advantage" : m.advantage === "opponent" ? "Disadvantage" : "Even"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.simulation && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-md bg-zinc-900 border border-amber-500/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Upset Prob</p>
                <p className="text-xl font-bold text-amber-400" data-testid="text-upset-prob">{pctStr(data.simulation.upsetProbability || 0)}</p>
              </div>
              <div className="p-3 rounded-md bg-zinc-900 border border-amber-500/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Volatility</p>
                <p className="text-xl font-bold text-amber-400" data-testid="text-volatility">{((data.simulation.volatilityScore || 0) * 100).toFixed(0)}%</p>
              </div>
              <div className="p-3 rounded-md bg-zinc-900 border border-amber-500/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Confidence</p>
                <p className="text-xl font-bold text-emerald-400" data-testid="text-confidence">{pctStr(data.simulation.confidenceScore || 0)}</p>
              </div>
              <div className="p-3 rounded-md bg-zinc-900 border border-amber-500/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Iterations</p>
                <p className="text-xl font-bold text-zinc-300" data-testid="text-iterations">{((data.simulation.iterations || 10000) / 1000).toFixed(0)}K</p>
              </div>
            </div>
          )}

          {data.riskAssessment && (
            <Card className="border-amber-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Risk Assessment</p>
                  <p className="text-sm font-medium" data-testid="text-risk-assessment">{data.riskAssessment}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <AiAnalysisCard explanation={data.explanation} />
        </>
      )}
    </div>
  );
}

function LineupTab({ leagueId }: { leagueId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/engine/lineup-optimize/${leagueId}`);
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <RunButton onClick={() => mutation.mutate()} isPending={mutation.isPending} />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Current Lineup</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-1">
                  {(data.currentLineup || []).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] w-8 justify-center">{p.position}</Badge>
                        <span>{p.name}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">{p.projected.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-400">Optimized Lineup</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-1">
                  {(data.optimizedLineup || []).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] w-8 justify-center">{p.position}</Badge>
                        <span>{p.name}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">{p.projected.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {data.swaps && data.swaps.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Recommended Swaps</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {data.swaps.map((sw: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-zinc-900 border border-zinc-800" data-testid={`card-swap-${i}`}>
                    <span className="text-red-400 text-sm">{sw.out}</span>
                    <ArrowRightLeft className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-emerald-400 text-sm">{sw.in}</span>
                    <Badge variant="outline" className="ml-auto text-emerald-400 border-emerald-500/30">
                      +{sw.evDelta.toFixed(1)} EV
                    </Badge>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 text-sm">
                  <span className="text-muted-foreground">Total EV Gain</span>
                  <span className="font-bold text-emerald-400" data-testid="text-total-ev-gain">+{data.totalEvGain?.toFixed(1) || "0.0"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Win Prob Change</span>
                  <span className={`font-bold ${colorForValue(data.winProbabilityChange || 0)}`}>
                    {(data.winProbabilityChange || 0) > 0 ? "+" : ""}{pctStr(data.winProbabilityChange || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {data.swaps && data.swaps.length === 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Target className="h-5 w-5 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-300">Your current lineup is already optimal!</p>
              </CardContent>
            </Card>
          )}

          <AiAnalysisCard explanation={data.explanation} />
        </>
      )}
    </div>
  );
}

function TradeTab({ leagueId }: { leagueId: string }) {
  const [givePlayers, setGivePlayers] = useState<SelectedPlayer[]>([]);
  const [getPlayers, setGetPlayers] = useState<SelectedPlayer[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const givePlayerIds = givePlayers.map(p => p.id);
      const getPlayerIds = getPlayers.map(p => p.id);
      if (givePlayerIds.length === 0 || getPlayerIds.length === 0) {
        throw new Error("Please select at least one player on each side of the trade");
      }
      const res = await apiRequest("POST", `/api/engine/trade-eval/${leagueId}`, { givePlayerIds, getPlayerIds });
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayerSearchInput
          label="You Give"
          selectedPlayers={givePlayers}
          onAdd={(p) => setGivePlayers(prev => [...prev, p])}
          onRemove={(id) => setGivePlayers(prev => prev.filter(p => p.id !== id))}
          labelColor="text-red-400"
          testIdPrefix="input-give"
        />
        <PlayerSearchInput
          label="You Get"
          selectedPlayers={getPlayers}
          onAdd={(p) => setGetPlayers(prev => [...prev, p])}
          onRemove={(id) => setGetPlayers(prev => prev.filter(p => p.id !== id))}
          labelColor="text-emerald-400"
          testIdPrefix="input-get"
        />
      </div>
      <RunButton
        onClick={() => mutation.mutate()}
        isPending={mutation.isPending}
        label="Evaluate Trade"
      />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          {data.decision && <DecisionCard decision={data.decision} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-400">You Give</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                {(data.tradeEval?.givePlayers || []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800 last:border-0">
                    <span>{p.name}</span>
                    <span className="font-mono text-muted-foreground">{p.projectedROS.toFixed(1)} ROS</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-400">You Get</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                {(data.tradeEval?.getPlayers || []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800 last:border-0">
                    <span>{p.name}</span>
                    <span className="font-mono text-muted-foreground">{p.projectedROS.toFixed(1)} ROS</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400">Trade Impact</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">ROS Point Delta</p>
                  <p className={`font-bold ${colorForValue(data.tradeEval?.rosPointDelta || 0)}`} data-testid="text-ros-delta">
                    {(data.tradeEval?.rosPointDelta || 0) > 0 ? "+" : ""}{(data.tradeEval?.rosPointDelta || 0).toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Champ Odds Change</p>
                  <p className={`font-bold ${colorForValue(data.championshipDelta?.delta || 0)}`}>
                    {(data.championshipDelta?.delta || 0) > 0 ? "+" : ""}{pctStr(data.championshipDelta?.delta || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Risk Change</p>
                  <p className={`font-bold ${colorForValue(-(data.tradeEval?.riskChangeScore || 0))}`}>
                    {(data.tradeEval?.riskChangeScore || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Scarcity Impact</p>
                  <p className={`font-bold ${colorForValue(data.tradeEval?.positionalScarcityDelta || 0)}`}>
                    {(data.tradeEval?.positionalScarcityDelta || 0) > 0 ? "+" : ""}{(data.tradeEval?.positionalScarcityDelta || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <AiAnalysisCard explanation={data.explanation} />
        </>
      )}
    </div>
  );
}

function FaabTab({ leagueId }: { leagueId: string }) {
  const [targetPlayer, setTargetPlayer] = useState<SelectedPlayer | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!targetPlayer) throw new Error("Please search and select a player first");
      const res = await apiRequest("POST", `/api/engine/waiver-eval/${leagueId}`, { targetPlayerId: targetPlayer.id });
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <PlayerSearchInput
        label="Target Player"
        selectedPlayers={targetPlayer ? [targetPlayer] : []}
        onAdd={(p) => setTargetPlayer(p)}
        onRemove={() => setTargetPlayer(null)}
        labelColor="text-amber-400"
        testIdPrefix="input-faab"
      />
      <RunButton
        onClick={() => mutation.mutate()}
        isPending={mutation.isPending}
        label="Optimize FAAB Bid"
      />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          {data.decision && <DecisionCard decision={data.decision} />}

          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400">FAAB Recommendation</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-md bg-zinc-900 border border-amber-500/20">
                  <p className="text-[10px] text-muted-foreground uppercase">Optimal Bid</p>
                  <p className="text-2xl font-bold text-amber-400" data-testid="text-optimal-bid">${data.faabResult?.optimalBid || 0}</p>
                </div>
                <div className="text-center p-3 rounded-md bg-zinc-900 border border-zinc-800">
                  <p className="text-[10px] text-muted-foreground uppercase">Min Viable Bid</p>
                  <p className="text-2xl font-bold text-muted-foreground" data-testid="text-min-bid">${data.faabResult?.minimumViableBid || 0}</p>
                </div>
                <div className="text-center p-3 rounded-md bg-zinc-900 border border-zinc-800">
                  <p className="text-[10px] text-muted-foreground uppercase">Win Probability</p>
                  <p className="text-2xl font-bold text-emerald-400" data-testid="text-win-prob">{pctStr(data.faabResult?.probabilityToWin || 0)}</p>
                </div>
                <div className="text-center p-3 rounded-md bg-zinc-900 border border-zinc-800">
                  <p className="text-[10px] text-muted-foreground uppercase">Value Gain</p>
                  <p className={`text-2xl font-bold ${colorForValue(data.faabResult?.expectedSeasonalValueGain || 0)}`} data-testid="text-value-gain">
                    +{(data.faabResult?.expectedSeasonalValueGain || 0).toFixed(1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {data.rosterImpact && (
            <Card className="border-amber-500/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Position Filled</p>
                    <p className="font-medium">{data.rosterImpact.positionFilled}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Player Dropped</p>
                    <p className="font-medium text-red-400">{data.rosterImpact.playerDropped || "None"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Net EV Gain</p>
                    <p className={`font-bold ${colorForValue(data.rosterImpact.netEvGain)}`}>
                      +{data.rosterImpact.netEvGain.toFixed(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <AiAnalysisCard explanation={data.explanation} />
        </>
      )}
    </div>
  );
}

function SeasonTab({ leagueId }: { leagueId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/engine/season-outlook/${leagueId}`);
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <RunButton onClick={() => mutation.mutate()} isPending={mutation.isPending} />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Playoff Prob</p>
                <p className="text-3xl font-bold text-amber-400" data-testid="text-playoff-prob">{pctStr(data.seasonSim?.playoffProbability || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Championship Prob</p>
                <p className="text-3xl font-bold text-emerald-400" data-testid="text-champ-prob">{pctStr(data.seasonSim?.championshipProbability || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Expected Wins</p>
                <p className="text-3xl font-bold">{(data.seasonSim?.expectedWins || 0).toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Expected Finish</p>
                <p className="text-3xl font-bold">#{data.seasonSim?.expectedFinish || "-"}</p>
              </CardContent>
            </Card>
          </div>

          {data.championshipPath?.weekByWeekOutlook && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Week-by-Week Outlook</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 text-muted-foreground text-xs">Week</th>
                      <th className="text-right py-2 text-muted-foreground text-xs">Win Prob</th>
                      <th className="text-right py-2 text-muted-foreground text-xs">Playoff Odds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.championshipPath.weekByWeekOutlook.map((w: any) => (
                      <tr key={w.week} className="border-b border-zinc-800/50" data-testid={`row-week-${w.week}`}>
                        <td className="py-1.5">Wk {w.week}</td>
                        <td className={`text-right font-mono ${colorForValue(w.winProbability, 0.5)}`}>{pctStr(w.winProbability)}</td>
                        <td className={`text-right font-mono ${colorForValue(w.cumulativePlayoffOdds, 0.5)}`}>{pctStr(w.cumulativePlayoffOdds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {data.portfolio && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Portfolio Analysis</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <GaugeBar value={data.portfolio.diversificationScore} label="Diversification" />
                <GaugeBar value={data.portfolio.fragilityScore} label="Fragility" />
                <GaugeBar value={data.portfolio.volatilityScore} label="Volatility" />
                <GaugeBar value={data.portfolio.playoffLeverageScore} label="Playoff Leverage" />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.strengths && data.strengths.length > 0 && (
              <Card className="border-emerald-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-1">
                  {data.strengths.map((s: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-emerald-300" data-testid={`text-strength-${i}`}>
                      <Target className="h-3 w-3 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {data.weaknesses && data.weaknesses.length > 0 && (
              <Card className="border-red-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Weaknesses
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-1">
                  {data.weaknesses.map((w: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-red-300" data-testid={`text-weakness-${i}`}>
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <AiAnalysisCard explanation={data.explanation} />
        </>
      )}
    </div>
  );
}

function PortfolioTab({ leagueId }: { leagueId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/engine/portfolio/${leagueId}`);
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <RunButton onClick={() => mutation.mutate()} isPending={mutation.isPending} />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400">Portfolio Scores</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <GaugeBar value={data.diversificationScore ?? 0} label="Diversification" />
              <GaugeBar value={data.fragilityScore ?? 0} label="Fragility" />
              <GaugeBar value={data.volatilityScore ?? 0} label="Volatility" />
              <GaugeBar value={data.playoffLeverageScore ?? 0} label="Playoff Leverage" />
            </CardContent>
          </Card>

          {data.teamConcentration && Object.keys(data.teamConcentration).length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Team Concentration</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {Object.entries(data.teamConcentration)
                  .sort(([, a]: any, [, b]: any) => b - a)
                  .slice(0, 8)
                  .map(([team, val]: [string, any]) => (
                    <GaugeBar key={team} value={val} label={team} />
                  ))}
              </CardContent>
            </Card>
          )}

          {data.recommendation && (
            <Card className="border-amber-500/20">
              <CardContent className="p-4">
                <p className="text-sm" data-testid="text-portfolio-recommendation">{data.recommendation}</p>
              </CardContent>
            </Card>
          )}

          <AiAnalysisCard explanation={data.explanation} />
        </>
      )}
    </div>
  );
}

function ChampionshipTab({ leagueId }: { leagueId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/engine/championship-path/${leagueId}`);
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <RunButton onClick={() => mutation.mutate()} isPending={mutation.isPending} />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Current Champ Odds</p>
                <p className="text-3xl font-bold text-amber-400" data-testid="text-current-champ-odds">{pctStr(data.currentChampionshipOdds || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Projected Champ Odds</p>
                <p className="text-3xl font-bold text-emerald-400" data-testid="text-projected-champ-odds">{pctStr(data.projectedChampionshipOdds || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Delta</p>
                <p className={`text-3xl font-bold ${colorForValue(data.delta || 0)}`} data-testid="text-champ-delta">
                  {(data.delta || 0) > 0 ? "+" : ""}{pctStr(data.delta || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {data.keyMoves && data.keyMoves.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Key Weeks Impact</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {data.keyMoves.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-zinc-900 border border-zinc-800" data-testid={`card-key-move-${i}`}>
                    <span className="text-sm">{m.description}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-mono ${colorForValue(m.oddsChange)}`}>
                        {m.oddsChange > 0 ? "+" : ""}{pctStr(m.oddsChange)}
                      </span>
                      <Progress value={m.confidence * 100} className="w-16" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.weekByWeekOutlook && data.weekByWeekOutlook.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400">Week-by-Week Playoff Odds</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 text-muted-foreground text-xs">Week</th>
                      <th className="text-right py-2 text-muted-foreground text-xs">Win Prob</th>
                      <th className="text-right py-2 text-muted-foreground text-xs">Cumulative Playoff Odds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weekByWeekOutlook.map((w: any) => (
                      <tr key={w.week} className="border-b border-zinc-800/50" data-testid={`row-champ-week-${w.week}`}>
                        <td className="py-1.5">Wk {w.week}</td>
                        <td className={`text-right font-mono ${colorForValue(w.winProbability, 0.5)}`}>{pctStr(w.winProbability)}</td>
                        <td className={`text-right font-mono ${colorForValue(w.cumulativePlayoffOdds, 0.5)}`}>{pctStr(w.cumulativePlayoffOdds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <AiAnalysisCard explanation={data.explanation} />
        </>
      )}
    </div>
  );
}

export default function DecisionEnginePage() {
  usePageTitle("Decision Engine");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [activeTab, setActiveTab] = useState<TabId>("matchup");

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to use the Decision Engine</p>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Decision Engine">
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Decision Engine</h1>
            <p className="text-sm text-muted-foreground">Monte Carlo simulations & AI-powered analysis</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : ""}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {activeTab === "matchup" && <MatchupTab leagueId={leagueId} />}
        {activeTab === "lineup" && <LineupTab leagueId={leagueId} />}
        {activeTab === "trade" && <TradeTab leagueId={leagueId} />}
        {activeTab === "faab" && <FaabTab leagueId={leagueId} />}
        {activeTab === "season" && <SeasonTab leagueId={leagueId} />}
        {activeTab === "portfolio" && <PortfolioTab leagueId={leagueId} />}
        {activeTab === "championship" && <ChampionshipTab leagueId={leagueId} />}
        {activeTab === "exploit" && <ExploitTab leagueId={leagueId} />}
        {activeTab === "regression" && <RegressionTab leagueId={leagueId} />}
        {activeTab === "equity" && <TitleEquityTab leagueId={leagueId} />}
      </div>
    </PremiumGate>
  );
}

function ExploitTab({ leagueId }: { leagueId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/engine/exploit-report/${leagueId}`);
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <RunButton onClick={() => mutation.mutate()} isPending={mutation.isPending} label="Scan League" />
      <ErrorCard error={mutation.error as Error | null} />

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.mostDesperateTeam && (
              <Card className="border-red-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Most Desperate Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="font-bold text-lg" data-testid="text-desperate-team">{data.mostDesperateTeam.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">{data.mostDesperateTeam.reason}</p>
                  <div className="mt-2">
                    <GaugeBar value={data.mostDesperateTeam.desperationScore} label="Desperation Level" />
                  </div>
                </CardContent>
              </Card>
            )}

            {data.mostOverconfidentTeam && (
              <Card className="border-amber-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Most Overconfident Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="font-bold text-lg" data-testid="text-overconfident-team">{data.mostOverconfidentTeam.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">{data.mostOverconfidentTeam.reason}</p>
                  <div className="mt-2">
                    <GaugeBar value={data.mostOverconfidentTeam.overconfidenceScore} label="Overconfidence Level" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {data.byeWeekCrunchTeams && data.byeWeekCrunchTeams.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" /> Bye Week Crunch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {data.byeWeekCrunchTeams.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-zinc-900 border border-zinc-800" data-testid={`card-bye-crunch-${i}`}>
                    <span className="text-sm font-medium">{t.username}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-red-400 border-red-500/30 text-xs">{t.byeCount} starters on bye</Badge>
                      <span className="text-xs text-muted-foreground">Week {t.week}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.lowFaabVulnerability && data.lowFaabVulnerability.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Low FAAB Vulnerability
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {data.lowFaabVulnerability.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-zinc-900 border border-zinc-800" data-testid={`card-low-faab-${i}`}>
                    <span className="text-sm font-medium">{t.username}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-red-400">${t.faabRemaining}</span>
                      <span className="text-xs text-muted-foreground">({Math.round(t.faabPct * 100)}% left)</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.overexposedOffenses && data.overexposedOffenses.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Overexposed Offenses
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {data.overexposedOffenses.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-zinc-900 border border-zinc-800" data-testid={`card-overexposed-${i}`}>
                    <div>
                      <span className="text-sm font-bold text-amber-400">{t.team}</span>
                      <span className="text-xs text-muted-foreground ml-2">({t.playerCount} starters)</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.owners.join(", ")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.weeklyExploits && data.weeklyExploits.length > 0 && (
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Exploit Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {data.weeklyExploits.map((e: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-md bg-zinc-900 border border-emerald-500/10" data-testid={`text-exploit-${i}`}>
                    <Target className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-emerald-200">{e}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const ALERT_TYPE_CONFIG: Record<string, { label: string; color: string; borderColor: string }> = {
  td_overperformance: { label: "TD Overperformance", color: "text-red-400", borderColor: "border-red-500/20" },
  td_underperformance: { label: "TD Underperformance", color: "text-emerald-400", borderColor: "border-emerald-500/20" },
  usage_spike: { label: "Usage Spike", color: "text-emerald-400", borderColor: "border-emerald-500/20" },
  usage_decline: { label: "Usage Decline", color: "text-red-400", borderColor: "border-red-500/20" },
  breakout_candidate: { label: "Breakout Candidate", color: "text-amber-400", borderColor: "border-amber-500/20" },
  regression_candidate: { label: "Regression Risk", color: "text-red-400", borderColor: "border-red-500/20" },
};

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  high: { label: "HIGH", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  medium: { label: "MED", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  low: { label: "LOW", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

function RegressionTab({ leagueId }: { leagueId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/engine/regression-alerts/${leagueId}`);
      return await res.json();
    },
  });

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <RunButton onClick={() => mutation.mutate()} isPending={mutation.isPending} label="Scan Players" />
      <ErrorCard error={mutation.error as Error | null} />

      {data?.alerts && data.alerts.length === 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-300">No significant regression or breakout alerts detected.</p>
          </CardContent>
        </Card>
      )}

      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map((alert: any, i: number) => {
            const typeConfig = ALERT_TYPE_CONFIG[alert.alertType] || { label: alert.alertType, color: "text-zinc-400", borderColor: "border-zinc-500/20" };
            const sevConfig = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
            return (
              <Card key={i} className={typeConfig.borderColor} data-testid={`card-alert-${i}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">{alert.playerName}</span>
                        <Badge variant="outline" className="text-[10px]">{alert.position}</Badge>
                        <span className="text-xs text-muted-foreground">{alert.team}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={`text-[10px] ${typeConfig.color}`}>{typeConfig.label}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${sevConfig.className}`}>{sevConfig.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase">{alert.metric}</p>
                      <p className={`font-bold font-mono ${typeConfig.color}`}>
                        {alert.currentValue.toFixed(1)} <span className="text-xs text-muted-foreground">vs</span> {alert.expectedValue.toFixed(1)}
                      </p>
                      <p className={`text-xs font-mono ${colorForValue(alert.delta)}`}>
                        {alert.delta > 0 ? "+" : ""}{alert.delta.toFixed(1)}
                      </p>
                    </div>
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

function TitleEquityTab({ leagueId }: { leagueId: string }) {
  const { data, isLoading } = useQuery<{ snapshots: any[] }>({
    queryKey: ["/api/engine/title-equity", leagueId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/engine/title-equity/${leagueId}`);
      return await res.json();
    },
  });

  const snapshots = data?.snapshots || [];
  const maxChamp = Math.max(0.01, ...snapshots.map(s => s.championshipOdds || 0));
  const maxPlayoff = Math.max(0.01, ...snapshots.map(s => s.playoffOdds || 0));

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      )}

      {!isLoading && snapshots.length === 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm text-amber-300">No title equity data yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Run the Season Outlook analysis each week to start tracking your championship odds over time.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {snapshots.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Latest Champ Odds</p>
                <p className="text-3xl font-bold text-amber-400" data-testid="text-latest-champ-odds">
                  {pctStr(snapshots[snapshots.length - 1]?.championshipOdds || 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Latest Playoff Odds</p>
                <p className="text-3xl font-bold text-emerald-400" data-testid="text-latest-playoff-odds">
                  {pctStr(snapshots[snapshots.length - 1]?.playoffOdds || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400">Championship Odds Over Time</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="h-40 flex items-end gap-1">
                {snapshots.map((s: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" data-testid={`bar-equity-${i}`}>
                    <div
                      className="w-full bg-amber-500/60 rounded-t-sm transition-all"
                      style={{ height: `${Math.max(4, (s.championshipOdds / maxChamp) * 120)}px` }}
                      title={`Wk ${s.week}: ${pctStr(s.championshipOdds)}`}
                    />
                    <span className="text-[9px] text-muted-foreground">{s.week}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">Week</p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400">Playoff Odds Over Time</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="h-40 flex items-end gap-1">
                {snapshots.map((s: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-emerald-500/60 rounded-t-sm transition-all"
                      style={{ height: `${Math.max(4, (s.playoffOdds / maxPlayoff) * 120)}px` }}
                      title={`Wk ${s.week}: ${pctStr(s.playoffOdds)}`}
                    />
                    <span className="text-[9px] text-muted-foreground">{s.week}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">Week</p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400">History</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 text-muted-foreground text-xs">Week</th>
                    <th className="text-right py-2 text-muted-foreground text-xs">Champ Odds</th>
                    <th className="text-right py-2 text-muted-foreground text-xs">Playoff Odds</th>
                    <th className="text-right py-2 text-muted-foreground text-xs">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s: any, i: number) => {
                    const prevChamp = i > 0 ? snapshots[i - 1].championshipOdds : s.championshipOdds;
                    const delta = s.championshipOdds - prevChamp;
                    return (
                      <tr key={i} className="border-b border-zinc-800/50" data-testid={`row-equity-${i}`}>
                        <td className="py-1.5">Wk {s.week}</td>
                        <td className="text-right font-mono text-amber-400">{pctStr(s.championshipOdds)}</td>
                        <td className="text-right font-mono text-emerald-400">{pctStr(s.playoffOdds)}</td>
                        <td className={`text-right font-mono ${colorForValue(delta)}`}>
                          {i > 0 ? `${delta > 0 ? "+" : ""}${pctStr(delta)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
