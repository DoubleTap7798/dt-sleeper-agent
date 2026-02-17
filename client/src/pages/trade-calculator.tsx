import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeftRight, Plus, X, Loader2, Sparkles, Scale, Info, ChevronDown, ChevronUp, BarChart3, TrendingUp, TrendingDown, Minus, Shield, Sprout, Brain, Clock, Check, AlertTriangle, Target } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TradeAsset, TradeAnalysisResult, TradeContext, TradeContextTeam, MarketGap } from "@/lib/sleeper-types";
import { usePageTitle } from "@/hooks/use-page-title";
import { InfoTooltip } from "@/components/metric-tooltip";
import { ExportButton } from "@/components/export-button";
import { formatTradeAnalysisForShare } from "@/lib/export-utils";

interface RosterWithOwner {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  players: TradeAsset[];
  picks: TradeAsset[];
}

interface TradeData {
  rosters: RosterWithOwner[];
  availablePicks: TradeAsset[];
  isStartup?: boolean;
  startupRounds?: number;
  draftType?: string;
  reversalRound?: number;
}

interface ECRPlayer {
  player: string;
  pos: string;
  team: string;
  age: number;
  ecr: number;
  value: number;
  fantasypros_id: string;
}

interface ECRData {
  rankings: ECRPlayer[];
  format: string;
  count: number;
  source: string;
}

export default function TradeCalculatorPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  const { toast } = useToast();

  usePageTitle("Trade Calculator");
  const [teamAId, setTeamAId] = useState<string>("");
  const [teamBId, setTeamBId] = useState<string>("");
  const [teamAAssets, setTeamAAssets] = useState<TradeAsset[]>([]);
  const [teamBAssets, setTeamBAssets] = useState<TradeAsset[]>([]);
  const [analysis, setAnalysis] = useState<TradeAnalysisResult | null>(null);
  const [showValueInfo, setShowValueInfo] = useState(false);

  const { data, isLoading: dataLoading } = useQuery<TradeData>({
    queryKey: ["/api/sleeper/rosters", leagueId],
    enabled: !!leagueId,
  });

  const { data: ecrData } = useQuery<ECRData>({
    queryKey: ["/api/sleeper/dynasty-process/ecr"],
    staleTime: 1000 * 60 * 60,
  });

  const { data: leagueSettingsData } = useQuery<{ devyEnabled: boolean }>({
    queryKey: ["/api/league-settings", leagueId],
    enabled: !!leagueId,
  });
  const devyEnabled = leagueSettingsData?.devyEnabled !== false;

  const { data: devyData } = useQuery<{ players: Array<{ playerId: string; name: string; position: string; school: string; rank: number; value: number; pickEquivalent: string; pickMultiplier: number }> }>({
    queryKey: ["/api/sleeper/devy"],
    staleTime: 1000 * 60 * 60,
    enabled: devyEnabled,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/trade/analyze", {
        leagueId,
        teamAId,
        teamBId,
        teamAName: teamA?.ownerName || "Team A",
        teamBName: teamB?.ownerName || "Team B",
        teamAAssets,
        teamBAssets,
      });
      return await response.json() as TradeAnalysisResult;
    },
    onSuccess: (result) => {
      setAnalysis(result);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze the trade",
        variant: "destructive",
      });
    },
  });

  const teamA = data?.rosters.find((r) => r.ownerId === teamAId);
  const teamB = data?.rosters.find((r) => r.ownerId === teamBId);

  const addAsset = (side: "A" | "B", asset: TradeAsset) => {
    if (side === "A") {
      if (!teamAAssets.find((a) => a.id === asset.id)) {
        setTeamAAssets([...teamAAssets, asset]);
        setAnalysis(null);
      }
    } else {
      if (!teamBAssets.find((a) => a.id === asset.id)) {
        setTeamBAssets([...teamBAssets, asset]);
        setAnalysis(null);
      }
    }
  };

  const removeAsset = (side: "A" | "B", assetId: string) => {
    if (side === "A") {
      setTeamAAssets(teamAAssets.filter((a) => a.id !== assetId));
    } else {
      setTeamBAssets(teamBAssets.filter((a) => a.id !== assetId));
    }
    setAnalysis(null);
  };

  const handleTeamChange = (side: "A" | "B", ownerId: string) => {
    if (side === "A") {
      setTeamAId(ownerId);
      setTeamAAssets([]);
    } else {
      setTeamBId(ownerId);
      setTeamBAssets([]);
    }
    setAnalysis(null);
  };

  const canAnalyze = teamAId && teamBId && (teamAAssets.length > 0 || teamBAssets.length > 0);

  const getGradeColor = (grade: string) => {
    return "text-muted-foreground bg-muted";
  };

  if (dataLoading) {
    return <TradeCalculatorSkeleton />;
  }

  return (
    <PremiumGate featureName="Trade Calculator">
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-trade-title">
            Trade Calculator
          </h2>
          <p className="text-muted-foreground">
            Calculate trade values using dynasty rankings
          </p>
        </div>

        <Collapsible open={showValueInfo} onOpenChange={setShowValueInfo}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" data-testid="button-toggle-value-info">
              <Info className="h-4 w-4" />
              <span>How are values calculated?</span>
              {showValueInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 bg-muted/50" data-testid="card-value-explanation">
              <CardContent className="pt-4 text-sm space-y-3">
                <p>
                  <strong>Dynasty values are on a 0-10,000 scale</strong> — the higher the number, the more valuable the player or pick.
                </p>
                <p>
                  Each value combines <strong>two sources</strong>: your league's specific settings (roster size, scoring, QB slots) and industry-wide consensus rankings from dynasty experts.
                </p>
                <p>
                  <strong>What affects a player's value:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Position — QBs are worth more in Superflex/2QB leagues</li>
                  <li>Age — younger players at their peak have higher long-term value</li>
                  <li>Recent performance — points scored and consistency</li>
                  <li>Injury status — injured players have temporarily reduced values</li>
                </ul>
                <p>
                  <strong>Rookie draft picks</strong> start with base values (1st round = 8,000, 2nd = 5,500, 3rd = 3,500, 4th = 1,800) and decrease slightly for future years since there's more uncertainty.
                </p>
                <p>
                  <strong>Startup draft picks</strong> are valued differently — early startup picks are worth significantly more (1st round up to 9,800) since you're drafting proven NFL players, not just rookies. Values taper off through all roster rounds.
                </p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TradeSide
          side="A"
          roster={teamA}
          rosters={data?.rosters || []}
          selectedAssets={teamAAssets}
          otherTeamId={teamBId}
          onTeamChange={(id) => handleTeamChange("A", id)}
          onAddAsset={(asset) => addAsset("A", asset)}
          onRemoveAsset={(id) => removeAsset("A", id)}
          isStartup={data?.isStartup}
          draftType={data?.draftType}
          reversalRound={data?.reversalRound}
          devyPlayers={devyEnabled ? devyData?.players : undefined}
        />

        <TradeSide
          side="B"
          roster={teamB}
          rosters={data?.rosters || []}
          selectedAssets={teamBAssets}
          otherTeamId={teamAId}
          onTeamChange={(id) => handleTeamChange("B", id)}
          onAddAsset={(asset) => addAsset("B", asset)}
          onRemoveAsset={(id) => removeAsset("B", id)}
          isStartup={data?.isStartup}
          draftType={data?.draftType}
          reversalRound={data?.reversalRound}
          devyPlayers={devyEnabled ? devyData?.players : undefined}
        />
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => analyzeMutation.mutate()}
          disabled={!canAnalyze || analyzeMutation.isPending}
          className="min-w-[200px]"
          data-testid="button-analyze-trade"
        >
          {analyzeMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Scale className="mr-2 h-4 w-4" />
              Analyze Trade
            </>
          )}
        </Button>
      </div>

      {analysis && (() => {
        const teamAName = teamA?.ownerName || "Team A";
        const teamBName = teamB?.ownerName || "Team B";
        const teamAAdj = Math.round(analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue);
        const teamBAdj = Math.round(analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue);
        const fairnessPercent = analysis.fairnessPercent ?? analysis.percentageDiff;
        const isFair = analysis.isFair || analysis.winner === "even";

        const getTradeSnapshotBullets = () => {
          const bullets: { team: string; gains: string[]; risks: string[] }[] = [];

          for (const [side, name, receives, gives] of [
            ["A", teamAName, teamBAssets, teamAAssets] as const,
            ["B", teamBName, teamAAssets, teamBAssets] as const,
          ]) {
            const gains: string[] = [];
            const risks: string[] = [];
            const receivedPlayers = receives.filter(a => a.type === "player");
            const givenPlayers = gives.filter(a => a.type === "player");
            const receivedPicks = receives.filter(a => a.type === "pick");

            if (receivedPicks.length > 0) gains.push("Adds future draft capital");
            if (receivedPlayers.some(p => (p.value || 0) >= 7000)) gains.push("Acquires a cornerstone piece");
            if (receivedPlayers.length > givenPlayers.length + 1) gains.push("Adds roster depth");
            if (receivedPlayers.length < givenPlayers.length - 1) gains.push("Consolidates into elite talent");
            const adjGet = side === "A" ? teamBAdj : teamAAdj;
            const adjGive = side === "A" ? teamAAdj : teamBAdj;
            if (adjGet > adjGive) gains.push("Net value gain");

            if (givenPlayers.some(p => (p.value || 0) >= 7000) && givenPlayers.length <= 2) risks.push("Loses a cornerstone player");
            if (side === "A" && !isFair && analysis.winner === "B") risks.push("Slight long-term upside loss");
            if (side === "B" && !isFair && analysis.winner === "A") risks.push("Slight long-term upside loss");

            if (gains.length === 0) gains.push("No major strategic shifts");
            bullets.push({ team: name, gains: gains.slice(0, 2), risks: risks.slice(0, 1) });
          }
          return bullets;
        };

        const snapshotBullets = getTradeSnapshotBullets();

        const getMarketSentence = () => {
          const gaps = analysis.tradeContext?.marketGaps;
          if (!gaps || gaps.length === 0) return null;
          const undervalued = [...gaps.filter(g => g.label === "Undervalued by league")];
          const overvalued = [...gaps.filter(g => g.label === "Overvalued by league")];
          if (undervalued.length > 0) {
            undervalued.sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));
            return `${undervalued[0].playerName} is undervalued vs consensus`;
          }
          if (overvalued.length > 0) {
            overvalued.sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));
            return `${overvalued[0].playerName} may be overvalued vs consensus`;
          }
          return null;
        };

        const filteredPsychology = (() => {
          const insights = analysis.tradeContext?.psychologyInsights || [];
          const fragilityInsights = insights.filter(i => i.toLowerCase().includes("fragility"));
          const concentrationInsights = insights.filter(i => i.toLowerCase().includes("concentration"));
          const otherInsights = insights.filter(i => !i.toLowerCase().includes("fragility") && !i.toLowerCase().includes("concentration"));

          const result: string[] = [...otherInsights];
          if (fragilityInsights.length === 1) result.push(fragilityInsights[0]);
          else if (fragilityInsights.length > 1) result.push("Both sides increase roster fragility in this trade");
          if (concentrationInsights.length === 1) result.push(concentrationInsights[0]);
          else if (concentrationInsights.length > 1) result.push("Both sides increase position concentration");
          return result;
        })();

        return (
        <Card className="border-2" data-testid="card-trade-analysis">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Trade Analysis
              </CardTitle>
              <div className="flex items-center gap-2">
                <ExportButton
                  data={[
                    ...teamAAssets.map(a => ({
                      side: teamAName,
                      direction: "Trading Away",
                      name: a.name,
                      type: a.type,
                      position: a.position || "",
                      value: Math.round(a.value),
                    })),
                    ...teamBAssets.map(a => ({
                      side: teamBName,
                      direction: "Trading Away",
                      name: a.name,
                      type: a.type,
                      position: a.position || "",
                      value: Math.round(a.value),
                    })),
                  ]}
                  filename="trade-analysis"
                  shareText={formatTradeAnalysisForShare(
                    analysis,
                    teamAName,
                    teamBName,
                    teamAAssets,
                    teamBAssets
                  )}
                />
                <InfoTooltip
                  title="Trade Grade"
                  description="Overall letter grade (A+ to F) based on fairness, value balance, and positional impact. A+ means both sides benefit roughly equally."
                />
                <Badge className={`text-2xl px-4 py-1 ${getGradeColor(analysis.grade)}`}>
                  {analysis.grade}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trade Snapshot */}
            <div className="p-4 rounded-lg bg-muted/30 border space-y-4" data-testid="container-trade-snapshot">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Scale className="h-4 w-4" />
                Trade Snapshot
              </div>
              <div className="text-center">
                <p className="text-lg" data-testid="text-fairness-verdict">
                  {isFair ? (
                    <span className="text-muted-foreground">This trade is fairly even</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Slightly Favors </span>
                      <span className="font-semibold">
                        {analysis.winner === "A" ? teamAName : teamBName}
                      </span>
                      <span className="text-muted-foreground"> (+{Math.round(Math.abs(fairnessPercent))}%)</span>
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {snapshotBullets.map((b, idx) => (
                  <div key={idx} className="space-y-1.5" data-testid={`snapshot-team-${idx}`}>
                    <p className="text-sm font-medium">{b.team}</p>
                    {b.gains.map((g, i) => (
                      <div key={`g-${i}`} className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid={`snapshot-gain-${idx}-${i}`}>
                        <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                        <span>{g}</span>
                      </div>
                    ))}
                    {b.risks.map((r, i) => (
                      <div key={`r-${i}`} className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid={`snapshot-risk-${idx}-${i}`}>
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {getMarketSentence() && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50" data-testid="text-market-sentence">
                  <BarChart3 className="h-3 w-3 shrink-0" />
                  <span>Market View: {getMarketSentence()}</span>
                </div>
              )}
            </div>

            {/* Simplified Value Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: teamAName, give: teamAAdj, get: teamBAdj, side: "a" },
                { name: teamBName, give: teamBAdj, get: teamAAdj, side: "b" },
              ].map(({ name, give, get, side }) => {
                const diff = get - give;
                return (
                  <div key={side} className="p-4 rounded-lg bg-card border space-y-2" data-testid={`value-summary-${side}`}>
                    <p className="text-sm font-semibold text-center border-b pb-2">{name}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">You Give</span>
                      <span className="font-mono">{give.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">You Get</span>
                      <span className="font-mono font-semibold">{get.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium flex items-center gap-1">
                        Difference
                        <InfoTooltip
                          title="Value Difference"
                          description="Net dynasty value after applying the consolidation premium. When trading fewer elite pieces for multiple assets, the elite side gets a value boost because star players are harder to acquire."
                        />
                      </span>
                      <span className={`font-mono font-bold ${diff > 0 ? "text-green-500" : diff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {diff >= 0 ? "+" : ""}{diff.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fairness Bar */}
            <div className="space-y-3" data-testid="container-fairness-bar">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium" data-testid="text-fairness-team-a">{teamAName}</span>
                <span className="text-muted-foreground flex items-center gap-1.5">
                  Fairness
                  <InfoTooltip
                    title="Fairness Score"
                    description="Compares the adjusted dynasty value of both sides. Trades within ±5% are considered fair. The bar shows which side gets more value."
                  />
                </span>
                <span className="font-medium" data-testid="text-fairness-team-b">{teamBName}</span>
              </div>
              <div className="relative h-8 bg-muted rounded-md overflow-hidden" data-testid="bar-fairness-track">
                <div className="absolute inset-y-0 left-[45%] right-[45%] bg-muted-foreground/20" />
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-muted-foreground/40 -translate-x-0.5" />
                {(() => {
                  const fp = analysis.fairnessPercent ?? 0;
                  const clamped = Math.max(-50, Math.min(50, fp));
                  const position = 50 + clamped;
                  return (
                    <div 
                      className="absolute top-1 bottom-1 w-3 rounded-sm transition-all duration-300 bg-muted-foreground"
                      style={{ left: `calc(${position}% - 6px)` }}
                    />
                  );
                })()}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span data-testid="text-favors-team-a">Favors {teamAName.split(' ')[0]}</span>
                <span className="px-2 py-0.5 rounded bg-muted-foreground/10" data-testid="badge-fair-zone">±5% Fair Zone</span>
                <span data-testid="text-favors-team-b">Favors {teamBName.split(' ')[0]}</span>
              </div>
            </div>

            {/* AI Analysis */}
            {analysis.aiAnalysis && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Analysis
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {analysis.aiAnalysis}
                </p>
              </div>
            )}

            {/* Psychology Insights - filtered for meaningful asymmetry */}
            {filteredPsychology.length > 0 && (
              <div className="space-y-2" data-testid="container-psychology-insights">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Trade Psychology
                </p>
                <div className="grid gap-1.5">
                  {filteredPsychology.map((insight, i) => {
                    const isWarning = insight.toLowerCase().includes("fragility") || insight.toLowerCase().includes("concentration");
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        data-testid={`insight-${i}`}
                      >
                        {isWarning
                          ? <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                          : <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        }
                        <span>{insight}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trade Context */}
            {analysis.tradeContext && (
              <TradeContextSection
                tradeContext={analysis.tradeContext}
                teamAName={teamAName}
                teamBName={teamBName}
              />
            )}

            {/* Market Inefficiency */}
            {analysis.tradeContext?.marketGaps && analysis.tradeContext.marketGaps.length > 0 && (
              <MarketGapsSection
                marketGaps={analysis.tradeContext.marketGaps}
                teamAName={teamAName}
                teamBName={teamBName}
              />
            )}

            {/* ECR Comparison */}
            {ecrData?.rankings && ecrData.rankings.length > 0 && (
              <MarketComparison
                teamAAssets={teamAAssets}
                teamBAssets={teamBAssets}
                teamAName={teamAName}
                teamBName={teamBName}
                ecrRankings={ecrData.rankings}
              />
            )}
          </CardContent>
        </Card>
        );
      })()}
    </div>
    </PremiumGate>
  );
}

function MarketComparison({
  teamAAssets,
  teamBAssets,
  teamAName,
  teamBName,
  ecrRankings,
}: {
  teamAAssets: TradeAsset[];
  teamBAssets: TradeAsset[];
  teamAName: string;
  teamBName: string;
  ecrRankings: ECRPlayer[];
}) {
  const findECR = (assetName: string): ECRPlayer | undefined => {
    const normalized = assetName.toLowerCase().trim();
    return ecrRankings.find(p => p.player.toLowerCase().trim() === normalized);
  };

  const teamAWithECR = teamAAssets
    .filter(a => a.type === 'player')
    .map(a => ({ asset: a, ecr: findECR(a.name) }))
    .filter(a => a.ecr);

  const teamBWithECR = teamBAssets
    .filter(a => a.type === 'player')
    .map(a => ({ asset: a, ecr: findECR(a.name) }))
    .filter(a => a.ecr);

  if (teamAWithECR.length === 0 && teamBWithECR.length === 0) return null;

  const totalDPValueA = teamAWithECR.reduce((s, a) => s + (a.ecr?.value || 0), 0);
  const totalDPValueB = teamBWithECR.reduce((s, a) => s + (a.ecr?.value || 0), 0);
  const dpDiff = totalDPValueB - totalDPValueA;

  const renderPlayerRow = (item: { asset: TradeAsset; ecr: ECRPlayer | undefined }) => {
    if (!item.ecr) return null;

    return (
      <div key={item.asset.id} className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(item.asset.position)}`}>
            {item.asset.position}
          </Badge>
          <span className="text-sm truncate">{item.asset.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            ECR #{Math.round(item.ecr.ecr)}
          </span>
          <span className="text-xs text-muted-foreground">
            DT: {Math.round(item.asset.value).toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" data-testid="button-toggle-market-comparison">
          <BarChart3 className="h-4 w-4" />
          <span>Market Comparison (Dynasty Process ECR)</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 rounded-lg bg-muted/30 border mt-2 space-y-4" data-testid="container-market-comparison">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            How your league values compare to industry consensus.
            <InfoTooltip
              title="Market Comparison"
              description="Dynasty Process uses industry-wide consensus data from FantasyPros. Sentiment labels show whether your league values a player higher or lower than the broader market."
            />
          </p>

          {teamAWithECR.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">{teamAName} trades away:</p>
              <div className="divide-y divide-border/50">
                {teamAWithECR.map(renderPlayerRow)}
              </div>
            </div>
          )}

          {teamBWithECR.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">{teamBName} trades away:</p>
              <div className="divide-y divide-border/50">
                {teamBWithECR.map(renderPlayerRow)}
              </div>
            </div>
          )}

          {(totalDPValueA > 0 || totalDPValueB > 0) && (
            <div className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Dynasty Process Market View:
              </span>
              <span className="font-medium flex items-center gap-1">
                {dpDiff > 500 ? (
                  <><TrendingUp className="h-3.5 w-3.5 text-green-500" /> Favors {teamAName}</>
                ) : dpDiff < -500 ? (
                  <><TrendingDown className="h-3.5 w-3.5 text-red-500" /> Favors {teamBName}</>
                ) : (
                  <><Minus className="h-3.5 w-3.5 text-muted-foreground" /> Roughly Even</>
                )}
              </span>
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">
            Source: dynastyprocess.com
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TradeContextSection({
  tradeContext,
  teamAName,
  teamBName,
}: {
  tradeContext: TradeContext;
  teamAName: string;
  teamBName: string;
}) {
  const renderTeamCard = (team: TradeContextTeam, name: string, side: "A" | "B") => {
    const ProfileIcon = team.profile === "contender" ? Shield : team.profile === "rebuilder" ? Sprout : Scale;
    const profileLabel = team.profile.charAt(0).toUpperCase() + team.profile.slice(1);
    const profileColor = team.profile === "contender"
      ? "text-amber-600 dark:text-amber-400"
      : team.profile === "rebuilder"
        ? "text-green-600 dark:text-green-400"
        : "text-muted-foreground";

    const windowColor = team.windowStrength === "Strong"
      ? "text-green-600 dark:text-green-400"
      : team.windowStrength === "Closing"
        ? "text-red-500 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

    return (
      <div className="flex-1 min-w-0 p-4 rounded-lg bg-muted/30 border space-y-3" data-testid={`trade-context-team-${side.toLowerCase()}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <ProfileIcon className={`h-4 w-4 shrink-0 ${profileColor}`} />
          <span className="text-sm font-medium truncate">{name}</span>
          <Badge variant="outline" className={`text-xs ${profileColor}`} data-testid={`badge-profile-${side.toLowerCase()}`}>
            {profileLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-2" data-testid={`text-window-${side.toLowerCase()}`}>
          <Clock className={`h-3.5 w-3.5 shrink-0 ${windowColor}`} />
          <span className="text-xs">
            Window: <span className={`font-medium ${windowColor}`}>{team.windowYears}yr ({team.windowStrength})</span>
          </span>
          <InfoTooltip
            title="Championship Window"
            description={`Estimated years before core players decline past their peak, weighted by player value. Based on position-specific age curves. Avg starter age: ${team.avgStarterAge}.`}
          />
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium">Contender</span>
              <Badge variant="secondary" className="text-xs" data-testid={`badge-contender-grade-${side.toLowerCase()}`}>
                {team.contenderGrade}
              </Badge>
            </div>
            <div className="space-y-1">
              {team.contenderReasons.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Sprout className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium">Rebuilder</span>
              <Badge variant="secondary" className="text-xs" data-testid={`badge-rebuilder-grade-${side.toLowerCase()}`}>
                {team.rebuilderGrade}
              </Badge>
            </div>
            <div className="space-y-1">
              {team.rebuilderReasons.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" data-testid="button-toggle-trade-context">
          <Shield className="h-4 w-4" />
          <span>Trade Context Analysis</span>
          <InfoTooltip
            title="Trade Context"
            description="Analyzes each team's competitive profile, championship window, and how this trade grades for contenders vs rebuilders."
          />
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col sm:flex-row gap-4 mt-2" data-testid="container-trade-context">
          {renderTeamCard(tradeContext.teamA, teamAName, "A")}
          {renderTeamCard(tradeContext.teamB, teamBName, "B")}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MarketGapsSection({
  marketGaps,
  teamAName,
  teamBName,
}: {
  marketGaps: MarketGap[];
  teamAName: string;
  teamBName: string;
}) {
  const teamAGaps = marketGaps.filter(g => g.side === "A");
  const teamBGaps = marketGaps.filter(g => g.side === "B");

  const renderGapRow = (gap: MarketGap, i: number) => {
    const isUndervalued = gap.label === "Undervalued by league";
    const isOvervalued = gap.label === "Overvalued by league";

    const sentimentLabel = isUndervalued ? "Undervalued" : isOvervalued ? "Overvalued" : "Fair Value";
    const sentimentColor = isUndervalued ? "text-green-500" : isOvervalued ? "text-amber-500" : "text-muted-foreground";

    return (
      <div key={`${gap.playerName}-${i}`} className="flex items-center justify-between gap-2 py-1.5" data-testid={`market-gap-${gap.playerName.replace(/\s+/g, '-').toLowerCase()}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(gap.position)}`}>
            {gap.position}
          </Badge>
          <span className="text-sm truncate">{gap.playerName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${sentimentColor}`}>
            {sentimentLabel}
          </span>
          <span className={`text-xs font-mono ${sentimentColor}`}>
            {gap.gapPercent > 0 ? "+" : ""}{Math.round(gap.gapPercent)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" data-testid="button-toggle-market-gaps">
          <TrendingUp className="h-4 w-4" />
          <span>Market Inefficiency Detector</span>
          <InfoTooltip
            title="Market Gaps"
            description="Compares your league's dynasty values against Dynasty Process consensus to find over/undervalued players in this trade."
          />
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 rounded-lg bg-muted/30 border mt-2 space-y-3" data-testid="container-market-gaps">
          <p className="text-xs text-muted-foreground">
            How your league values each player vs Dynasty Process consensus.
          </p>

          {teamAGaps.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">{teamAName} trades away:</p>
              <div className="divide-y divide-border/50">
                {teamAGaps.map((g, i) => renderGapRow(g, i))}
              </div>
            </div>
          )}

          {teamBGaps.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">{teamBName} trades away:</p>
              <div className="divide-y divide-border/50">
                {teamBGaps.map((g, i) => renderGapRow(g, i))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface TradeSideProps {
  side: "A" | "B";
  roster: RosterWithOwner | undefined;
  rosters: RosterWithOwner[];
  selectedAssets: TradeAsset[];
  otherTeamId: string;
  onTeamChange: (id: string) => void;
  onAddAsset: (asset: TradeAsset) => void;
  onRemoveAsset: (id: string) => void;
  isStartup?: boolean;
  draftType?: string;
  reversalRound?: number;
  devyPlayers?: Array<{ playerId: string; name: string; position: string; school: string; rank: number; value: number; pickEquivalent: string; pickMultiplier: number }>;
}

function TradeSide({
  side,
  roster,
  rosters,
  selectedAssets,
  otherTeamId,
  onTeamChange,
  onAddAsset,
  onRemoveAsset,
  isStartup,
  draftType,
  reversalRound,
  devyPlayers,
}: TradeSideProps) {
  const availableRosters = rosters.filter((r) => r.ownerId !== otherTeamId);
  const totalValue = selectedAssets.reduce((sum, a) => sum + a.value, 0);


  return (
    <Card data-testid={`card-trade-side-${side.toLowerCase()}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Team {side}</CardTitle>
        <Select
          value={roster?.ownerId || ""}
          onValueChange={onTeamChange}
        >
          <SelectTrigger data-testid={`select-team-${side.toLowerCase()}`}>
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {availableRosters.map((r) => (
              <SelectItem key={r.ownerId} value={r.ownerId}>
                {r.ownerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedAssets.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Trading away:</p>
            <div className="flex flex-wrap gap-2">
              {selectedAssets.map((asset) => (
                <Badge
                  key={asset.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  <span>{asset.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({asset.value.toLocaleString()})
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1"
                    onClick={() => onRemoveAsset(asset.id)}
                    data-testid={`button-remove-asset-${asset.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-medium flex items-center gap-1">
                Total Value
                <InfoTooltip
                  title="Total Dynasty Value"
                  description="Sum of all dynasty values for players and picks being traded. Values are on a 0-10,000 scale based on production, age, role security, and market consensus."
                />
              </span>
              <span className="font-bold font-mono text-primary">{totalValue.toLocaleString()}</span>
            </div>
          </div>
        )}

        {roster && (
          <>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Players:</p>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {roster.players
                    .filter((p) => !selectedAssets.find((a) => a.id === p.id))
                    .map((player) => (
                      <button
                        key={player.id}
                        onClick={() => onAddAsset(player)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover-elevate text-left"
                        data-testid={`button-add-player-${player.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                            {player.position}
                          </Badge>
                          <span className="text-sm">
                            <span className="sm:hidden">{abbreviateName(player.name)}</span>
                            <span className="hidden sm:inline">{player.name}</span>
                          </span>
                        </div>
                        <span className="text-xs font-mono text-primary">
                          {player.value.toLocaleString()}
                        </span>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </div>

            {roster.picks.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm text-muted-foreground">
                      {isStartup ? "Startup & Future Picks:" : "Draft Picks:"}
                    </p>
                    {isStartup && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                        {draftType === "snake" ? (reversalRound && reversalRound > 1 ? `Snake (R${reversalRound} reversal)` : "Snake") : draftType === "linear" ? "Linear" : "Startup"}
                      </Badge>
                    )}
                  </div>
                  <ScrollArea className={isStartup ? "h-[240px]" : "h-[120px]"}>
                    <div className="space-y-1">
                      {roster.picks
                        .filter((p) => !selectedAssets.find((a) => a.id === p.id))
                        .map((pick) => (
                          <button
                            key={pick.id}
                            onClick={() => onAddAsset(pick)}
                            className="w-full flex items-center justify-between p-2 rounded-md hover-elevate text-left"
                            data-testid={`button-add-pick-${pick.id}`}
                          >
                            <span className="text-sm">{pick.name}</span>
                            <span className="text-xs font-mono text-primary">
                              {pick.value.toLocaleString()}
                            </span>
                          </button>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {devyPlayers && devyPlayers.length > 0 && (
              <>
                <Separator />
                <DevyPlayerSearch 
                  devyPlayers={devyPlayers}
                  selectedAssets={selectedAssets}
                  onAddAsset={onAddAsset}
                  side={side}
                />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DevyPlayerSearch({
  devyPlayers,
  selectedAssets,
  onAddAsset,
  side,
}: {
  devyPlayers: Array<{ playerId: string; name: string; position: string; school: string; rank: number; value: number; pickEquivalent: string; pickMultiplier: number }>;
  selectedAssets: TradeAsset[];
  onAddAsset: (asset: TradeAsset) => void;
  side: "A" | "B";
}) {
  const [devySearch, setDevySearch] = useState("");
  const [showDevy, setShowDevy] = useState(false);

  const filteredDevy = devyPlayers
    .filter(p => !selectedAssets.find(a => a.id === `devy-${p.playerId}`))
    .filter(p => {
      if (!devySearch) return true;
      const search = devySearch.toLowerCase();
      return p.name.toLowerCase().includes(search) || p.school.toLowerCase().includes(search) || p.position.toLowerCase().includes(search);
    })
    .slice(0, 20);

  const addDevyPlayer = (player: typeof devyPlayers[0]) => {
    const devyAsset: TradeAsset = {
      id: `devy-${player.playerId}`,
      name: `${player.name} (Devy)`,
      type: "player",
      value: Math.round(player.value * 0.7),
      position: player.position,
    };
    onAddAsset(devyAsset);
  };

  return (
    <div>
      <Collapsible open={showDevy} onOpenChange={setShowDevy}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground justify-start" data-testid={`button-toggle-devy-${side.toLowerCase()}`}>
            <Plus className="h-3.5 w-3.5" />
            <span>Add Devy Prospect</span>
            {showDevy ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 mt-2">
            <input
              type="text"
              placeholder="Search devy players..."
              value={devySearch}
              onChange={(e) => setDevySearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              data-testid={`input-devy-search-${side.toLowerCase()}`}
            />
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {filteredDevy.map((player) => (
                  <button
                    key={player.playerId}
                    onClick={() => addDevyPlayer(player)}
                    className="w-full flex items-center justify-between p-2 rounded-md hover-elevate text-left"
                    data-testid={`button-add-devy-${player.playerId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                        {player.position}
                      </Badge>
                      <div>
                        <span className="text-sm font-medium">{player.name}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{player.school}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-primary">
                        {Math.round(player.value * 0.7).toLocaleString()}
                      </span>
                      <div className="text-[10px] text-muted-foreground">{player.pickEquivalent}</div>
                    </div>
                  </button>
                ))}
                {filteredDevy.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No devy players found</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function TradeCalculatorSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
