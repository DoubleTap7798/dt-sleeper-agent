import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Table2, Info, Users, Lightbulb, ArrowUp, ArrowDown, Target, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";

interface PickData {
  pick: number;
  displayName: string;
  value: number;
  hitRate: number;
  eliteRate: number;
  starterRate: number;
  bustRate: number;
  avgPPG: number;
  notablePicks: string[];
}

interface RoundData {
  round: number;
  picks: PickData[];
}

interface ProspectData {
  name: string;
  position: string;
  college: string;
  rank: number;
  elitePct: number;
  bustPct: number;
}

interface StrategyData {
  strategy: string;
  tradeAdvice: string;
  positionTip: string;
}

interface TradeEvDelta {
  tradeUpValue: number;
  tradeDownValue: number;
  tradeUpSlot: string;
  tradeDownSlot: string;
  evDelta: number;
}

interface DraftPickValues {
  rounds: RoundData[];
  methodology: string;
  lastUpdated: string;
  prospectsPerPick: Record<string, ProspectData[]>;
  strategyPerPick: Record<string, StrategyData>;
  tradeEvDelta: Record<string, TradeEvDelta>;
  positionFilter: string | null;
}

const POSITION_TABS = ["All", "QB", "RB", "WR", "TE"] as const;

function getValueColor(value: number): string {
  if (value >= 80) return "hsl(187, 100%, 50%)";
  if (value >= 60) return "hsl(187, 80%, 45%)";
  if (value >= 40) return "hsl(187, 60%, 40%)";
  if (value >= 20) return "hsl(187, 40%, 35%)";
  return "hsl(187, 25%, 30%)";
}

function getRoundAvgHitRate(round: RoundData): number {
  const total = round.picks.reduce((sum, p) => sum + p.hitRate, 0);
  return Math.round(total / round.picks.length);
}

function ProspectsPanel({ prospects, slot }: { prospects: ProspectData[]; slot: string }) {
  if (!prospects || prospects.length === 0) return null;
  return (
    <div className="mt-2 p-3 rounded-md bg-muted/50 space-y-1.5" data-testid={`panel-prospects-${slot}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">2026 Prospects In This Range</span>
      </div>
      {prospects.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs" data-testid={`prospect-${p.name}`}>
          <Link href={`/league/draft-board?search=${encodeURIComponent(p.name)}`}>
            <span className="font-medium hover:underline cursor-pointer">{p.name}</span>
          </Link>
          <Badge variant="secondary" className="text-[10px]">{p.position}</Badge>
          <span className="text-muted-foreground">{p.college}</span>
          {p.elitePct > 0 && (
            <span style={{ color: "hsl(45, 93%, 47%)" }} className="ml-auto">{p.elitePct}% elite</span>
          )}
          {p.bustPct > 0 && (
            <span style={{ color: "hsl(0, 72%, 51%)" }}>{p.bustPct}% bust</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StrategyPanel({ strategy, slot }: { strategy: StrategyData; slot: string }) {
  if (!strategy) return null;
  return (
    <div className="mt-2 p-3 rounded-md bg-muted/50 space-y-1.5" data-testid={`panel-strategy-${slot}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Best Strategy</span>
      </div>
      <p className="text-xs">{strategy.strategy}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <Target className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{strategy.tradeAdvice}</span>
      </div>
      {strategy.positionTip && (
        <p className="text-xs text-muted-foreground italic mt-1">{strategy.positionTip}</p>
      )}
    </div>
  );
}

function TradeEvPanel({ tradeEv, slot }: { tradeEv: TradeEvDelta; slot: string }) {
  if (!tradeEv) return null;
  return (
    <div className="mt-2 p-3 rounded-md bg-muted/50" data-testid={`panel-trade-ev-${slot}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Trade EV Delta</span>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {tradeEv.tradeUpSlot && (
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUp className="h-3 w-3" style={{ color: "hsl(142, 71%, 45%)" }} />
            <span>Trade up to <span className="font-mono font-medium">{tradeEv.tradeUpSlot}</span>:</span>
            <span className="font-medium" style={{ color: tradeEv.tradeUpValue > 5 ? "hsl(142, 71%, 45%)" : undefined }}>
              +{tradeEv.tradeUpValue} value
            </span>
          </div>
        )}
        {tradeEv.tradeDownSlot && (
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowDown className="h-3 w-3" style={{ color: "hsl(0, 72%, 51%)" }} />
            <span>Trade down to <span className="font-mono font-medium">{tradeEv.tradeDownSlot}</span>:</span>
            <span className="font-medium" style={{ color: tradeEv.tradeDownValue > 5 ? "hsl(0, 72%, 51%)" : undefined }}>
              -{tradeEv.tradeDownValue} value
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandablePickRow({
  pick,
  prospects,
  strategy,
  tradeEv,
}: {
  pick: PickData;
  prospects: ProspectData[];
  strategy: StrategyData;
  tradeEv: TradeEvDelta;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = (prospects && prospects.length > 0) || strategy || tradeEv;

  return (
    <div data-testid={`row-pick-value-${pick.displayName}`}>
      <div
        className={`flex items-center gap-3 ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <span className="w-10 text-sm font-mono font-medium shrink-0">{pick.displayName}</span>
        <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
          <div
            className="h-full rounded-md transition-all duration-300"
            style={{
              width: `${Math.min(pick.value, 100)}%`,
              backgroundColor: getValueColor(pick.value),
            }}
          />
          <span className="absolute inset-0 flex items-center px-2 text-xs font-medium" style={{ color: pick.value > 50 ? "hsl(0, 0%, 10%)" : undefined }}>
            {pick.value.toLocaleString()}
          </span>
        </div>
        <span className="w-12 text-xs text-muted-foreground text-right shrink-0">{pick.avgPPG} PPG</span>
        {hasDetails && (
          <span className="w-5 shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>
      {expanded && (
        <div className="ml-12 mr-5">
          <ProspectsPanel prospects={prospects} slot={pick.displayName} />
          <StrategyPanel strategy={strategy} slot={pick.displayName} />
          <TradeEvPanel tradeEv={tradeEv} slot={pick.displayName} />
        </div>
      )}
    </div>
  );
}

function ValueChartView({ rounds, prospectsPerPick, strategyPerPick, tradeEvDelta }: {
  rounds: RoundData[];
  prospectsPerPick: Record<string, ProspectData[]>;
  strategyPerPick: Record<string, StrategyData>;
  tradeEvDelta: Record<string, TradeEvDelta>;
}) {
  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <Card key={round.round} data-testid={`card-round-${round.round}-value`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-base">Round {round.round}</CardTitle>
            <Badge variant="secondary">Avg Value: {Math.round(round.picks.reduce((s, p) => s + p.value, 0) / round.picks.length).toLocaleString()}</Badge>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {round.picks.map((pick) => (
              <ExpandablePickRow
                key={pick.displayName}
                pick={pick}
                prospects={prospectsPerPick[pick.displayName] || []}
                strategy={strategyPerPick[pick.displayName]}
                tradeEv={tradeEvDelta[pick.displayName]}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HitRatesView({ rounds }: { rounds: RoundData[] }) {
  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <Card key={round.round} data-testid={`card-round-${round.round}-hitrates`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-base">Round {round.round}</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(45, 93%, 47%)" }} />
                <span className="text-xs text-muted-foreground">Elite</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142, 71%, 45%)" }} />
                <span className="text-xs text-muted-foreground">Starter</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />
                <span className="text-xs text-muted-foreground">Bust</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {round.picks.map((pick) => {
              const otherRate = 100 - pick.eliteRate - pick.starterRate - pick.bustRate;
              return (
                <div key={pick.displayName} className="flex items-center gap-3" data-testid={`row-pick-hitrate-${pick.displayName}`}>
                  <span className="w-10 text-sm font-mono font-medium shrink-0">{pick.displayName}</span>
                  <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden flex">
                    {pick.eliteRate > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-xs font-medium"
                        style={{ width: `${pick.eliteRate}%`, backgroundColor: "hsl(45, 93%, 47%)", color: "hsl(0, 0%, 10%)", minWidth: pick.eliteRate > 3 ? undefined : "0" }}
                      >
                        {pick.eliteRate >= 8 ? `${pick.eliteRate}%` : ""}
                      </div>
                    )}
                    {pick.starterRate > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-xs font-medium"
                        style={{ width: `${pick.starterRate}%`, backgroundColor: "hsl(142, 71%, 45%)", color: "white" }}
                      >
                        {pick.starterRate >= 8 ? `${pick.starterRate}%` : ""}
                      </div>
                    )}
                    {otherRate > 0 && (
                      <div
                        className="h-full"
                        style={{ width: `${otherRate}%`, backgroundColor: "hsl(0, 0%, 60%)", opacity: 0.3 }}
                      />
                    )}
                    <div
                      className="h-full flex items-center justify-center text-xs font-medium"
                      style={{ width: `${pick.bustRate}%`, backgroundColor: "hsl(0, 72%, 51%)", color: "white" }}
                    >
                      {pick.bustRate >= 12 ? `${pick.bustRate}%` : ""}
                    </div>
                  </div>
                  <span className="w-12 text-xs text-muted-foreground text-right shrink-0">{pick.hitRate}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DetailsView({ rounds, prospectsPerPick, strategyPerPick, tradeEvDelta }: {
  rounds: RoundData[];
  prospectsPerPick: Record<string, ProspectData[]>;
  strategyPerPick: Record<string, StrategyData>;
  tradeEvDelta: Record<string, TradeEvDelta>;
}) {
  const [expandedPick, setExpandedPick] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <Card key={round.round} data-testid={`card-round-${round.round}-details`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Round {round.round}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Pick</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Value</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Hit%</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Elite%</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Starter%</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Bust%</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Avg PPG</th>
                    <th className="pb-2 font-medium text-muted-foreground">Notable Picks</th>
                    <th className="pb-2 font-medium text-muted-foreground w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {round.picks.map((pick) => {
                    const isExpanded = expandedPick === pick.displayName;
                    const prospects = prospectsPerPick[pick.displayName] || [];
                    const strategy = strategyPerPick[pick.displayName];
                    const tradeEv = tradeEvDelta[pick.displayName];
                    const hasDetails = prospects.length > 0 || strategy || tradeEv;

                    return (
                      <>
                        <tr
                          key={pick.displayName}
                          className={`border-b last:border-b-0 ${hasDetails ? "cursor-pointer" : ""}`}
                          onClick={() => hasDetails && setExpandedPick(isExpanded ? null : pick.displayName)}
                          data-testid={`row-pick-detail-${pick.displayName}`}
                        >
                          <td className="py-2 pr-3 font-mono font-medium">{pick.displayName}</td>
                          <td className="py-2 pr-3 text-right">
                            <Badge variant="secondary" className="font-mono">{pick.value}</Badge>
                          </td>
                          <td className="py-2 pr-3 text-right">{pick.hitRate}%</td>
                          <td className="py-2 pr-3 text-right" style={{ color: pick.eliteRate > 0 ? "hsl(45, 93%, 47%)" : undefined }}>{pick.eliteRate}%</td>
                          <td className="py-2 pr-3 text-right" style={{ color: pick.starterRate > 0 ? "hsl(142, 71%, 45%)" : undefined }}>{pick.starterRate}%</td>
                          <td className="py-2 pr-3 text-right" style={{ color: pick.bustRate >= 50 ? "hsl(0, 72%, 51%)" : undefined }}>{pick.bustRate}%</td>
                          <td className="py-2 pr-3 text-right font-mono">{pick.avgPPG}</td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {pick.notablePicks.length > 0 ? pick.notablePicks.join(", ") : "-"}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {hasDetails && (isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${pick.displayName}-details`}>
                            <td colSpan={9} className="pb-3">
                              <ProspectsPanel prospects={prospects} slot={pick.displayName} />
                              <StrategyPanel strategy={strategy} slot={pick.displayName} />
                              <TradeEvPanel tradeEv={tradeEv} slot={pick.displayName} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="skeleton-draft-pick-values">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-48" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-96" />
    </div>
  );
}

export default function DraftPickValuePage() {
  usePageTitle("Draft Pick Values");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlPosition = urlParams.get("position");

  const [positionFilter, setPositionFilter] = useState<string>(urlPosition || "All");

  useEffect(() => {
    if (urlPosition && ["QB", "RB", "WR", "TE"].includes(urlPosition)) {
      setPositionFilter(urlPosition);
    }
  }, [urlPosition]);

  const queryPosition = positionFilter === "All" ? undefined : positionFilter;

  const { data, isLoading, error } = useQuery<DraftPickValues>({
    queryKey: ["/api/draft-pick-values", queryPosition],
    queryFn: async () => {
      const url = queryPosition
        ? `/api/draft-pick-values?position=${queryPosition}`
        : "/api/draft-pick-values";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground" data-testid="text-error">Failed to load draft pick values</p>
      </div>
    );
  }

  const { rounds, prospectsPerPick, strategyPerPick, tradeEvDelta } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold" data-testid="text-page-title">Draft Pick Values</h2>
        <Badge variant="secondary">2018-2024 Data</Badge>
        {positionFilter !== "All" && (
          <Badge variant="outline" data-testid="badge-position-filter">{positionFilter}-Specific</Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap" data-testid="tabs-position-filter">
        {POSITION_TABS.map((pos) => (
          <Button
            key={pos}
            variant={positionFilter === pos ? "default" : "outline"}
            size="sm"
            onClick={() => setPositionFilter(pos)}
            data-testid={`button-position-${pos.toLowerCase()}`}
          >
            {pos}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rounds.map((round) => (
          <Card key={round.round} data-testid={`card-round-summary-${round.round}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Round {round.round} Avg Hit Rate</p>
              <p className="text-2xl font-bold">{getRoundAvgHitRate(round)}%</p>
              <p className="text-xs text-muted-foreground mt-1">{round.picks.length} picks</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground" data-testid="text-methodology">
            {data.methodology}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="value" className="w-full">
        <TabsList data-testid="tabs-view-selector">
          <TabsTrigger value="value" data-testid="tab-value-chart">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Value Chart
          </TabsTrigger>
          <TabsTrigger value="hitrates" data-testid="tab-hit-rates">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Hit Rates
          </TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">
            <Table2 className="h-4 w-4 mr-1.5" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="value" className="mt-4">
          <ValueChartView
            rounds={rounds}
            prospectsPerPick={prospectsPerPick}
            strategyPerPick={strategyPerPick}
            tradeEvDelta={tradeEvDelta}
          />
        </TabsContent>

        <TabsContent value="hitrates" className="mt-4">
          <HitRatesView rounds={rounds} />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <DetailsView
            rounds={rounds}
            prospectsPerPick={prospectsPerPick}
            strategyPerPick={strategyPerPick}
            tradeEvDelta={tradeEvDelta}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
