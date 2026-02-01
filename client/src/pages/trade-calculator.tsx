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
import { ArrowLeftRight, Plus, X, Loader2, Sparkles, Scale, Info, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TradeAsset, TradeAnalysisResult } from "@/lib/sleeper-types";

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
}

export default function TradeCalculatorPage() {
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
                  <strong>Dynasty values are on a 0-100 scale</strong> — the higher the number, the more valuable the player or pick.
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
                  <strong>Draft picks</strong> start with base values (1st round = 80, 2nd = 55, 3rd = 35, 4th = 18) and decrease slightly for future years since there's more uncertainty.
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

      {analysis && (
        <Card className="border-2" data-testid="card-trade-analysis">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Trade Analysis
              </CardTitle>
              <Badge className={`text-2xl px-4 py-1 ${getGradeColor(analysis.grade)}`}>
                {analysis.grade}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-card border space-y-3">
                <p className="text-lg font-semibold text-center border-b pb-2">
                  {teamA?.ownerName || "Team A"}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trading Away (Raw):</span>
                    <span className="font-mono text-muted-foreground">-{analysis.teamA.totalValue.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trading Away (Adj):</span>
                    <span className="font-mono text-muted-foreground">-{(analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Receiving (Adj):</span>
                    <span className="font-mono font-semibold">+{(analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue).toFixed(1)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Net Adjusted:</span>
                    <span className="font-mono font-bold">
                      {(analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue) - (analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue) >= 0 ? '+' : ''}{((analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue) - (analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue)).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-card border space-y-3">
                <p className="text-lg font-semibold text-center border-b pb-2">
                  {teamB?.ownerName || "Team B"}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trading Away (Raw):</span>
                    <span className="font-mono text-muted-foreground">-{analysis.teamB.totalValue.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trading Away (Adj):</span>
                    <span className="font-mono text-muted-foreground">-{(analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Receiving (Adj):</span>
                    <span className="font-mono font-semibold">+{(analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue).toFixed(1)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Net Adjusted:</span>
                    <span className="font-mono font-bold">
                      {(analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue) - (analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue) >= 0 ? '+' : ''}{((analysis.teamA.adjustedTotal ?? analysis.teamA.totalValue) - (analysis.teamB.adjustedTotal ?? analysis.teamB.totalValue)).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fairness Bar */}
            <div className="space-y-3" data-testid="container-fairness-bar">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium" data-testid="text-fairness-team-a">{teamA?.ownerName || "Team A"}</span>
                <span className="text-muted-foreground">Fairness</span>
                <span className="font-medium" data-testid="text-fairness-team-b">{teamB?.ownerName || "Team B"}</span>
              </div>
              
              {/* Visual Fairness Bar */}
              <div className="relative h-8 bg-muted rounded-md overflow-hidden" data-testid="bar-fairness-track">
                {/* Fair zone indicator (5% each side = 10% total in center) */}
                <div className="absolute inset-y-0 left-[45%] right-[45%] bg-muted-foreground/20" />
                
                {/* Center line */}
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-muted-foreground/40 -translate-x-0.5" />
                
                {/* Fairness indicator */}
                {(() => {
                  const fairnessPercent = analysis.fairnessPercent ?? 0;
                  // Clamp to -50 to +50 for display, map to 0-100% position
                  const clampedPercent = Math.max(-50, Math.min(50, fairnessPercent));
                  // Positive = Team B wins (slider goes right), Negative = Team A wins (slider goes left)
                  // Center is 50%, each 1% of fairness = 1% position change
                  const position = 50 + clampedPercent;
                  const isFair = analysis.isFair ?? Math.abs(fairnessPercent) <= 5;
                  
                  return (
                    <div 
                      className={`absolute top-1 bottom-1 w-3 rounded-sm transition-all duration-300 ${
                        isFair ? "bg-muted-foreground" : "bg-muted-foreground/80"
                      }`}
                      style={{ left: `calc(${position}% - 6px)` }}
                    />
                  );
                })()}
              </div>
              
              {/* Fairness labels */}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span data-testid="text-favors-team-a">← Favors {teamA?.ownerName?.split(' ')[0] || "A"}</span>
                <span className="px-2 py-0.5 rounded bg-muted-foreground/10" data-testid="badge-fair-zone">±5% Fair Zone</span>
                <span data-testid="text-favors-team-b">Favors {teamB?.ownerName?.split(' ')[0] || "B"} →</span>
              </div>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/30 border">
              <p className="text-lg">
                {analysis.isFair || analysis.winner === "even" ? (
                  <span className="text-muted-foreground">This trade is fairly even!</span>
                ) : (
                  <>
                    <span className="font-semibold">
                      {analysis.winner === "A" ? teamA?.ownerName : teamB?.ownerName}
                    </span>
                    <span className="text-muted-foreground"> gets the better deal by </span>
                    <span className="font-bold">
                      {Math.abs(analysis.fairnessPercent ?? analysis.percentageDiff).toFixed(1)}%
                    </span>
                  </>
                )}
              </p>
            </div>

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
          </CardContent>
        </Card>
      )}
    </div>
    </PremiumGate>
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
                    ({asset.value.toFixed(1)})
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
              <span className="text-sm font-medium">Total Value:</span>
              <span className="font-bold font-mono text-primary">{totalValue.toFixed(1)}</span>
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
                          {player.value.toFixed(1)}
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
                  <p className="text-sm text-muted-foreground mb-2">Draft Picks:</p>
                  <ScrollArea className="h-[120px]">
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
                              {pick.value.toFixed(1)}
                            </span>
                          </button>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
