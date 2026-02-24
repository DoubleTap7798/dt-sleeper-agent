import { useState, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { apiRequest } from "@/lib/queryClient";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { InfoTooltip } from "@/components/metric-tooltip";
import { ExportButton } from "@/components/export-button";
import { formatTradeAnalysisForShare } from "@/lib/export-utils";
import { useSelectedLeague } from "./league-layout";
import type { TradeAsset, TradeAnalysisResult, TradeContext, TradeContextTeam, MarketGap } from "@/lib/sleeper-types";
import {
  Scale,
  Sparkles,
  Brain,
  Zap,
  ArrowLeftRight,
  Plus,
  X,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Sprout,
  Clock,
  Check,
  AlertTriangle,
  Target,
  Search,
  Play,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  RefreshCw,
} from "lucide-react";

const tabs = [
  { id: "quick-check", label: "Quick Check", icon: Scale },
  { id: "impact", label: "Impact Simulation", icon: Zap },
  { id: "strategy", label: "Strategy AI", icon: Brain },
] as const;

type TabId = typeof tabs[number]["id"];

export default function TradeLabPage() {
  usePageTitle("Trade Lab");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const tabFromUrl = urlParams.get("tab") as TabId | null;
  const validTabs: TabId[] = ["quick-check", "impact", "strategy"];
  const resolvedTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "impact";
  const [activeTab, setActiveTab] = useState<TabId>(resolvedTab);

  const [sharedGivePlayers, setSharedGivePlayers] = useState<SharedPlayer[]>([]);
  const [sharedGetPlayers, setSharedGetPlayers] = useState<SharedPlayer[]>([]);

  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleRunImpactSimulation = useCallback((give: SharedPlayer[], get: SharedPlayer[]) => {
    setSharedGivePlayers(give);
    setSharedGetPlayers(get);
    setActiveTab("impact");
  }, []);

  return (
    <PremiumGate featureName="Trade Lab">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-trade-lab-title">Trade Lab</h1>
          <p className="text-xs text-muted-foreground mt-1">One workflow: value check, impact simulation, and AI strategy</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList className="w-full justify-start h-auto flex-wrap gap-1 py-1 bg-muted/30" data-testid="trade-lab-tabs">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_8px_rgba(217,169,78,0.2)]"
                data-testid={`tab-trade-${tab.id}`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="quick-check" className="mt-4" data-testid="content-quick-check">
            <QuickCheckTab onRunImpact={handleRunImpactSimulation} />
          </TabsContent>
          <TabsContent value="impact" className="mt-4" data-testid="content-impact">
            <ImpactSimulationTab
              preloadedGive={sharedGivePlayers}
              preloadedGet={sharedGetPlayers}
              onConsumePreloaded={() => { setSharedGivePlayers([]); setSharedGetPlayers([]); }}
            />
          </TabsContent>
          <TabsContent value="strategy" className="mt-4" data-testid="content-strategy">
            <StrategyAITab />
          </TabsContent>
        </Tabs>
      </div>
    </PremiumGate>
  );
}

interface SharedPlayer {
  id: string;
  name: string;
  position: string;
  team?: string;
}

// ─── TAB 1: QUICK CHECK (from trade-calculator) ───

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

function QuickCheckTab({ onRunImpact }: { onRunImpact: (give: SharedPlayer[], get: SharedPlayer[]) => void }) {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  const { toast } = useToast();

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

  const handleRunImpact = () => {
    const givePlayers = teamAAssets.filter(a => a.type === "player").map(a => ({
      id: a.id, name: a.name, position: a.position || "?", team: "",
    }));
    const getPlayers = teamBAssets.filter(a => a.type === "player").map(a => ({
      id: a.id, name: a.name, position: a.position || "?", team: "",
    }));
    onRunImpact(givePlayers, getPlayers);
  };

  if (dataLoading) {
    return <QuickCheckSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
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
                  Each value combines <strong>two sources</strong>: your league's specific settings and industry-wide consensus rankings.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Position — QBs are worth more in Superflex/2QB leagues</li>
                  <li>Age — younger players at their peak have higher long-term value</li>
                  <li>Recent performance — points scored and consistency</li>
                  <li>Injury status — injured players have temporarily reduced values</li>
                </ul>
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

      {analysis && <QuickCheckResults
        analysis={analysis}
        teamA={teamA}
        teamB={teamB}
        teamAAssets={teamAAssets}
        teamBAssets={teamBAssets}
      />}

      {analysis && (teamAAssets.some(a => a.type === "player") || teamBAssets.some(a => a.type === "player")) && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-run-impact-prompt">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">Run Full Impact Simulation?</p>
                <p className="text-xs text-muted-foreground">See how this trade changes your title odds, playoff probability, and risk profile</p>
              </div>
            </div>
            <Button
              onClick={handleRunImpact}
              className="shrink-0 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
              data-testid="button-run-impact-sim"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Simulate
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuickCheckResults({
  analysis,
  teamA,
  teamB,
  teamAAssets,
  teamBAssets,
}: {
  analysis: TradeAnalysisResult;
  teamA?: RosterWithOwner;
  teamB?: RosterWithOwner;
  teamAAssets: TradeAsset[];
  teamBAssets: TradeAsset[];
}) {
  const teamAName = teamA?.ownerName || "Team A";
  const teamBName = teamB?.ownerName || "Team B";
  const teamAAdj = Math.round(analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue);
  const teamBAdj = Math.round(analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue);
  const fairnessPercent = analysis.fairnessPercent ?? analysis.percentageDiff;
  const isFair = analysis.isFair || analysis.winner === "even";

  const getGradeColor = (grade: string) => "text-muted-foreground bg-muted";

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
                  side: teamAName, direction: "Trading Away", name: a.name, type: a.type, position: a.position || "", value: Math.round(a.value),
                })),
                ...teamBAssets.map(a => ({
                  side: teamBName, direction: "Trading Away", name: a.name, type: a.type, position: a.position || "", value: Math.round(a.value),
                })),
              ]}
              filename="trade-analysis"
              shareText={formatTradeAnalysisForShare(analysis, teamAName, teamBName, teamAAssets, teamBAssets)}
            />
            <InfoTooltip
              title="Trade Grade"
              description="Overall letter grade (A+ to F) based on fairness, value balance, and positional impact."
            />
            <Badge className={`text-2xl px-4 py-1 ${getGradeColor(analysis.grade)}`}>
              {analysis.grade}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
                      description="Net dynasty value after applying the consolidation premium."
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

        <div className="space-y-3" data-testid="container-fairness-bar">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium" data-testid="text-fairness-team-a">{teamAName}</span>
            <span className="text-muted-foreground flex items-center gap-1.5">
              Fairness
              <InfoTooltip title="Fairness Score" description="Compares the adjusted dynasty value of both sides. Trades within ±5% are considered fair." />
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

        {analysis.aiAnalysis && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Analysis
            </p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.aiAnalysis}</p>
          </div>
        )}

        {filteredPsychology.length > 0 && (
          <div className="space-y-2" data-testid="container-psychology-insights">
            <p className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Psychology Insights
            </p>
            {filteredPsychology.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground" data-testid={`psychology-insight-${i}`}>
                <span className="text-primary/60 mt-0.5 shrink-0">•</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── TAB 2: IMPACT SIMULATION (from decision-engine trade tab) ───

interface SelectedPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
}

function colorForValue(val: number, neutral = 0): string {
  if (val > neutral) return "text-emerald-400";
  if (val < neutral) return "text-red-400";
  return "text-amber-400";
}

function pctStr(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

const REC_CONFIG: Record<string, { label: string; className: string }> = {
  strong_yes: { label: "STRONG YES", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  yes: { label: "YES", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  lean_yes: { label: "LEAN YES", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  neutral: { label: "NEUTRAL", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  lean_no: { label: "LEAN NO", className: "bg-red-500/15 text-red-300 border-red-500/25" },
  no: { label: "NO", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  strong_no: { label: "STRONG NO", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function ImpactSimulationTab({
  preloadedGive,
  preloadedGet,
  onConsumePreloaded,
}: {
  preloadedGive: SharedPlayer[];
  preloadedGet: SharedPlayer[];
  onConsumePreloaded: () => void;
}) {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [givePlayers, setGivePlayers] = useState<SelectedPlayer[]>([]);
  const [getPlayers, setGetPlayers] = useState<SelectedPlayer[]>([]);

  useEffect(() => {
    if (preloadedGive.length > 0 || preloadedGet.length > 0) {
      setGivePlayers(preloadedGive.map(p => ({ ...p, team: p.team || "" })));
      setGetPlayers(preloadedGet.map(p => ({ ...p, team: p.team || "" })));
      onConsumePreloaded();
    }
  }, [preloadedGive, preloadedGet]);

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

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to simulate trade impact</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImpactPlayerSearch
          label="You Give"
          selectedPlayers={givePlayers}
          onAdd={(p) => setGivePlayers(prev => [...prev, p])}
          onRemove={(id) => setGivePlayers(prev => prev.filter(p => p.id !== id))}
          labelColor="text-red-400"
          testIdPrefix="impact-give"
        />
        <ImpactPlayerSearch
          label="You Get"
          selectedPlayers={getPlayers}
          onAdd={(p) => setGetPlayers(prev => [...prev, p])}
          onRemove={(id) => setGetPlayers(prev => prev.filter(p => p.id !== id))}
          labelColor="text-emerald-400"
          testIdPrefix="impact-get"
        />
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={givePlayers.length === 0 || getPlayers.length === 0 || mutation.isPending}
        variant="outline"
        className="bg-amber-500/20 text-amber-400 border-amber-500/30"
        data-testid="button-run-impact"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Running simulations...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Run Impact Simulation
          </>
        )}
      </Button>

      {mutation.error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Something went wrong</p>
              <p className="text-sm text-muted-foreground mt-1">{(mutation.error as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {data.decision && (
            <Card className="border-amber-500/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold text-amber-400">Decision</span>
                  <Badge variant="outline" className={REC_CONFIG[data.decision.recommendation]?.className || REC_CONFIG.neutral.className} data-testid="badge-recommendation">
                    {REC_CONFIG[data.decision.recommendation]?.label || "NEUTRAL"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">EV Delta</p>
                    <p className={`font-bold ${colorForValue(data.decision.evDelta)}`} data-testid="text-ev-delta">
                      {data.decision.evDelta > 0 ? "+" : ""}{data.decision.evDelta.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Win Prob Shift</p>
                    <p className={`font-bold ${colorForValue(data.decision.winProbabilityShift)}`}>
                      {data.decision.winProbabilityShift > 0 ? "+" : ""}{pctStr(data.decision.winProbabilityShift)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Playoff Shift</p>
                    <p className={`font-bold ${colorForValue(data.decision.playoffProbabilityShift)}`}>
                      {data.decision.playoffProbabilityShift > 0 ? "+" : ""}{pctStr(data.decision.playoffProbabilityShift)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Confidence</p>
                    <Progress value={data.decision.confidence * 100} className="mt-1" />
                    <p className="text-xs font-mono mt-0.5">{pctStr(data.decision.confidence)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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

          {data.explanation && (
            <ImpactAiCard explanation={data.explanation} />
          )}
        </>
      )}
    </div>
  );
}

function ImpactAiCard({ explanation }: { explanation: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = explanation.split("\n").filter(l => l.trim());
  const bullets = lines.map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  const preview = bullets.slice(0, 3);
  const hasMore = bullets.length > 3;

  return (
    <Card className="border-amber-500/20">
      <CardContent className="p-4">
        <button className="w-full flex items-center justify-between mb-2" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-impact-analysis">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">AI Analysis</span>
          </div>
          {hasMore && (
            <span className="text-[10px] text-muted-foreground">{expanded ? "Show less" : `+${bullets.length - 3} more`}</span>
          )}
        </button>
        <ul className="space-y-1.5">
          {(expanded ? bullets : preview).map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-amber-500/60 mt-1 shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ImpactPlayerSearch({
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
            <Badge key={p.id} variant="outline" className="text-xs border-amber-500/30 text-amber-400 gap-1 shrink-0" data-testid={`badge-player-${p.id}`}>
              {p.name} ({p.position})
              <button onClick={() => onRemove(p.id)} className="ml-0.5" data-testid={`button-remove-player-${p.id}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <div className="flex-1 min-w-[120px] relative">
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
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
                <Loader2 className="h-3 w-3 animate-spin" />Searching...
              </div>
            )}
            {searchError && <div className="px-3 py-2 text-sm text-red-400">Search failed. Try again.</div>}
            {!searchLoading && !searchError && players.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No players found</div>
            )}
            {players.filter((p: any) => !selectedIds.has(p.id)).map((p: any) => (
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

// ─── TAB 3: STRATEGY AI (from trade-analyzer) ───

interface PlayerOption {
  playerId: string;
  name: string;
  position: string;
  team: string;
}

interface TradeAnalysis {
  verdict: string;
  grade: string;
  summary: string;
  giveSideAnalysis: string;
  getSideAnalysis: string;
  rosterImpact: string;
  counterSuggestion: string | null;
}

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  ACCEPT: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: ThumbsUp },
  REJECT: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: ThumbsDown },
  COUNTER: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: RotateCcw },
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400", "A": "text-emerald-400", "A-": "text-emerald-400",
  "B+": "text-green-400", "B": "text-green-400", "B-": "text-green-400",
  "C+": "text-amber-400", "C": "text-amber-400", "C-": "text-amber-400",
  "D+": "text-orange-400", "D": "text-orange-400", "D-": "text-orange-400",
  "F": "text-red-400",
};

function StrategyAITab() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const [givePlayers, setGivePlayers] = useState<PlayerOption[]>([]);
  const [getPlayers, setGetPlayers] = useState<PlayerOption[]>([]);
  const [giveSearch, setGiveSearch] = useState("");
  const [getSearch, setGetSearch] = useState("");

  const { data: playersData } = useQuery<Record<string, any>>({
    queryKey: ["/api/sleeper/players"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai/trade-analyzer/${leagueId}`, {
        givePlayers: givePlayers.map(p => p.playerId),
        getPlayers: getPlayers.map(p => p.playerId),
      });
      return res.json();
    },
  });

  const searchPlayers = (query: string, exclude: string[]): PlayerOption[] => {
    if (!playersData || query.length < 2) return [];
    const excludeSet = new Set(exclude);
    const q = query.toLowerCase();
    return Object.entries(playersData)
      .filter(([id, p]: [string, any]) => {
        if (excludeSet.has(id)) return false;
        if (!["QB", "RB", "WR", "TE"].includes(p.position)) return false;
        return (p.full_name || "").toLowerCase().includes(q);
      })
      .slice(0, 8)
      .map(([id, p]: [string, any]) => ({
        playerId: id,
        name: p.full_name || id,
        position: p.position || "?",
        team: p.team || "FA",
      }));
  };

  const giveResults = searchPlayers(giveSearch, [...givePlayers, ...getPlayers].map(p => p.playerId));
  const getResults = searchPlayers(getSearch, [...givePlayers, ...getPlayers].map(p => p.playerId));

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to get AI trade strategy</p>
      </div>
    );
  }

  const analysis: TradeAnalysis | null = analyzeMutation.data?.analysis || null;
  const verdictConfig = analysis ? VERDICT_CONFIG[analysis.verdict] || VERDICT_CONFIG.REJECT : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-red-400">You Give</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players to give..."
                value={giveSearch}
                onChange={(e) => setGiveSearch(e.target.value)}
                className="pl-9"
                data-testid="input-strategy-give-search"
              />
            </div>
            {giveSearch.length >= 2 && giveResults.length > 0 && (
              <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                {giveResults.map(p => (
                  <button
                    key={p.playerId}
                    onClick={() => { setGivePlayers(prev => [...prev, p]); setGiveSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2"
                    data-testid={`button-strategy-add-give-${p.playerId}`}
                  >
                    <Badge variant="outline" className="text-xs">{p.position}</Badge>
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{p.team}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {givePlayers.map(p => (
                <div key={p.playerId} className="flex items-center gap-2 p-2 rounded-md bg-red-500/5 border border-red-500/20">
                  <Badge variant="outline" className="text-xs">{p.position}</Badge>
                  <span className="text-sm flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.team}</span>
                  <Button variant="ghost" size="icon" onClick={() => setGivePlayers(prev => prev.filter(x => x.playerId !== p.playerId))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-400">You Get</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players to receive..."
                value={getSearch}
                onChange={(e) => setGetSearch(e.target.value)}
                className="pl-9"
                data-testid="input-strategy-get-search"
              />
            </div>
            {getSearch.length >= 2 && getResults.length > 0 && (
              <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                {getResults.map(p => (
                  <button
                    key={p.playerId}
                    onClick={() => { setGetPlayers(prev => [...prev, p]); setGetSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2"
                    data-testid={`button-strategy-add-get-${p.playerId}`}
                  >
                    <Badge variant="outline" className="text-xs">{p.position}</Badge>
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{p.team}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {getPlayers.map(p => (
                <div key={p.playerId} className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                  <Badge variant="outline" className="text-xs">{p.position}</Badge>
                  <span className="text-sm flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.team}</span>
                  <Button variant="ghost" size="icon" onClick={() => setGetPlayers(prev => prev.filter(x => x.playerId !== p.playerId))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={() => analyzeMutation.mutate()}
        disabled={givePlayers.length === 0 || getPlayers.length === 0 || analyzeMutation.isPending}
        className="w-full"
        data-testid="button-strategy-analyze"
      >
        {analyzeMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing Trade Strategy...
          </>
        ) : (
          <>
            <Brain className="h-4 w-4 mr-2" />
            Get AI Strategy
          </>
        )}
      </Button>

      {analysis && verdictConfig && (
        <Card data-testid="card-strategy-analysis">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className={`flex items-center gap-3 p-3 rounded-md border ${verdictConfig.bg}`}>
                {(() => { const Icon = verdictConfig.icon; return <Icon className={`h-6 w-6 ${verdictConfig.color}`} />; })()}
                <div>
                  <p className={`text-lg font-bold ${verdictConfig.color}`} data-testid="text-verdict">{analysis.verdict}</p>
                  <p className="text-xs text-muted-foreground">AI Recommendation</p>
                </div>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-bold ${GRADE_COLORS[analysis.grade] || "text-muted-foreground"}`} data-testid="text-grade">{analysis.grade}</p>
                <p className="text-xs text-muted-foreground">Trade Grade</p>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                <p>Give: {analyzeMutation.data?.giveTotal?.toLocaleString()}</p>
                <p>Get: {analyzeMutation.data?.getTotal?.toLocaleString()}</p>
                <p className={analyzeMutation.data?.getTotal > analyzeMutation.data?.giveTotal ? "text-emerald-400" : "text-red-400"}>
                  Diff: {((analyzeMutation.data?.getTotal || 0) - (analyzeMutation.data?.giveTotal || 0)).toLocaleString()}
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed" data-testid="text-summary">{analysis.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                <p className="text-xs font-medium text-red-400">Giving Away</p>
                <p className="text-sm">{analysis.giveSideAnalysis}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                <p className="text-xs font-medium text-emerald-400">Receiving</p>
                <p className="text-sm">{analysis.getSideAnalysis}</p>
              </div>
            </div>

            {analysis.rosterImpact && (
              <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                <p className="text-xs font-medium text-primary">Roster Impact</p>
                <p className="text-sm">{analysis.rosterImpact}</p>
              </div>
            )}

            {analysis.counterSuggestion && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-xs font-medium text-amber-400">Counter Suggestion</p>
                </div>
                <p className="text-sm">{analysis.counterSuggestion}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── SHARED COMPONENTS (from trade-calculator) ───

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
}: {
  side: "A" | "B";
  roster?: RosterWithOwner;
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
}) {
  const totalValue = selectedAssets.reduce((sum, a) => sum + a.value, 0);

  return (
    <Card data-testid={`card-trade-side-${side.toLowerCase()}`}>
      <CardContent className="pt-6 space-y-3">
        <Select value={roster?.ownerId || ""} onValueChange={onTeamChange}>
          <SelectTrigger data-testid={`select-team-${side.toLowerCase()}`}>
            <SelectValue placeholder={`Select Team ${side}`} />
          </SelectTrigger>
          <SelectContent>
            {rosters
              .filter((r) => r.ownerId !== otherTeamId)
              .map((r) => (
                <SelectItem key={r.ownerId} value={r.ownerId} data-testid={`option-team-${r.ownerId}`}>
                  {r.ownerName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {selectedAssets.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Selected ({selectedAssets.length})</span>
              <span className="font-mono text-primary font-semibold">{Math.round(totalValue).toLocaleString()}</span>
            </div>
            {selectedAssets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-primary/5 border border-primary/20" data-testid={`selected-asset-${asset.id}`}>
                <div className="flex items-center gap-1.5">
                  {asset.position && (
                    <Badge variant="outline" className={`text-xs ${getPositionColorClass(asset.position)}`}>
                      {asset.position}
                    </Badge>
                  )}
                  <span className="text-xs">
                    <span className="sm:hidden">{abbreviateName(asset.name)}</span>
                    <span className="hidden sm:inline">{asset.name}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-primary">{Math.round(asset.value).toLocaleString()}</span>
                  <button onClick={() => onRemoveAsset(asset.id)} className="text-muted-foreground hover:text-foreground" data-testid={`button-remove-asset-${asset.id}`}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {roster && (
          <>
            <Separator />
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between gap-2 text-muted-foreground group" data-testid={`button-toggle-players-${side.toLowerCase()}`}>
                  <span className="text-xs">Players ({roster.players.filter((p) => !selectedAssets.find((a) => a.id === p.id)).length})</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-0.5">
                    {roster.players
                      .filter((p) => !selectedAssets.find((a) => a.id === p.id))
                      .map((player) => (
                        <button
                          key={player.id}
                          onClick={() => onAddAsset(player)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover-elevate text-left"
                          data-testid={`button-add-player-${player.id}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-xs ${getPositionColorClass(player.position)}`}>
                              {player.position}
                            </Badge>
                            <span className="text-xs">
                              <span className="sm:hidden">{abbreviateName(player.name)}</span>
                              <span className="hidden sm:inline">{player.name}</span>
                            </span>
                          </div>
                          <span className="text-xs font-mono text-primary">{player.value.toLocaleString()}</span>
                        </button>
                      ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>

            {roster.picks.length > 0 && (
              <>
                <Separator />
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between gap-2 text-muted-foreground group" data-testid={`button-toggle-picks-${side.toLowerCase()}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">
                          {isStartup ? "Startup & Future Picks" : "Draft Picks"} ({roster.picks.filter((p) => !selectedAssets.find((a) => a.id === p.id)).length})
                        </span>
                        {isStartup && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                            {draftType === "snake" ? (reversalRound && reversalRound > 1 ? `Snake (R${reversalRound} reversal)` : "Snake") : draftType === "linear" ? "Linear" : "Startup"}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className={isStartup ? "h-[240px]" : "h-[120px]"}>
                      <div className="space-y-0.5">
                        {roster.picks
                          .filter((p) => !selectedAssets.find((a) => a.id === p.id))
                          .map((pick) => (
                            <button
                              key={pick.id}
                              onClick={() => onAddAsset(pick)}
                              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover-elevate text-left"
                              data-testid={`button-add-pick-${pick.id}`}
                            >
                              <span className="text-xs">{pick.name}</span>
                              <span className="text-xs font-mono text-primary">{pick.value.toLocaleString()}</span>
                            </button>
                          ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
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
                      <span className="text-xs font-mono text-primary">{Math.round(player.value * 0.7).toLocaleString()}</span>
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

function QuickCheckSkeleton() {
  return (
    <div className="space-y-6">
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
