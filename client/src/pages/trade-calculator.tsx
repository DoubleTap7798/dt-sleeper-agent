import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
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
import { ArrowLeftRight, Plus, X, Loader2, Sparkles, Scale } from "lucide-react";
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
    if (grade.startsWith("A")) return "text-green-500 bg-green-500/10";
    if (grade.startsWith("B")) return "text-blue-500 bg-blue-500/10";
    if (grade.startsWith("C")) return "text-yellow-500 bg-yellow-500/10";
    if (grade.startsWith("D")) return "text-orange-500 bg-orange-500/10";
    return "text-red-500 bg-red-500/10";
  };

  if (dataLoading) {
    return <TradeCalculatorSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-trade-title">
          Trade Calculator
        </h2>
        <p className="text-muted-foreground">
          Calculate trade values using dynasty rankings
        </p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-card border">
                <p className="text-sm text-muted-foreground mb-1">
                  {teamA?.ownerName || "Team A"}
                </p>
                <p className="text-2xl font-bold font-mono">
                  {analysis.teamA.totalValue.toLocaleString()}
                </p>
              </div>
              <div className="p-4 flex items-center justify-center">
                <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="p-4 rounded-lg bg-card border">
                <p className="text-sm text-muted-foreground mb-1">
                  {teamB?.ownerName || "Team B"}
                </p>
                <p className="text-2xl font-bold font-mono">
                  {analysis.teamB.totalValue.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-lg">
                {analysis.winner === "even" ? (
                  <span className="text-muted-foreground">This trade is fairly even!</span>
                ) : (
                  <>
                    <span className="font-semibold">
                      {analysis.winner === "A" ? teamA?.ownerName : teamB?.ownerName}
                    </span>
                    <span className="text-muted-foreground"> wins by </span>
                    <span className="font-bold text-foreground">
                      {Math.abs(analysis.difference).toLocaleString()} ({analysis.percentageDiff.toFixed(1)}%)
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

  const getPositionColor = (position?: string) => {
    switch (position) {
      case "QB": return "bg-red-500/10 text-red-500";
      case "RB": return "bg-green-500/10 text-green-500";
      case "WR": return "bg-blue-500/10 text-blue-500";
      case "TE": return "bg-orange-500/10 text-orange-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

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
              <span className="text-sm font-medium">Total Value:</span>
              <span className="font-bold font-mono">{totalValue.toLocaleString()}</span>
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
                          <Badge variant="outline" className={`text-xs ${getPositionColor(player.position)}`}>
                            {player.position}
                          </Badge>
                          <span className="text-sm">{player.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
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
                            <span className="text-xs text-muted-foreground font-mono">
                              {pick.value.toLocaleString()}
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
