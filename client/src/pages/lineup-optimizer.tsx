import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, ArrowUp, CheckCircle, AlertTriangle } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface LineupPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  slot: string;
  projectedPoints: number;
  isOptimal?: boolean;
  isDevyPlaceholder?: boolean;
}

interface BenchPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
}

interface LineupOptimizerData {
  currentLineup: LineupPlayer[];
  optimalLineup: LineupPlayer[];
  benchPlayers: BenchPlayer[];
  currentProjectedTotal: number;
  optimalProjectedTotal: number;
  pointsGained: number;
  week: number;
  teamName: string;
  ownerName: string;
}

function getSlotLabel(slot: string, slotCounts: Map<string, number>): string {
  const count = slotCounts.get(slot) || 0;
  slotCounts.set(slot, count + 1);

  const labels: Record<string, string> = {
    SUPER_FLEX: "SF",
    REC_FLEX: "RF",
    IDP_FLEX: "IDP",
  };
  const base = labels[slot] || slot;
  if (count > 0) return `${base}${count + 1}`;
  return base;
}

export default function LineupOptimizerPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  usePageTitle("Lineup Optimizer");

  const { data, isLoading, error } = useQuery<LineupOptimizerData>({
    queryKey: ["/api/sleeper/lineup-optimizer", leagueId],
    enabled: !!leagueId,
  });

  const { data: leagueSettings } = useQuery<{ devyEnabled: boolean }>({
    queryKey: [`/api/league-settings/${leagueId}`],
    enabled: !!leagueId,
  });

  const devyEnabled = leagueSettings?.devyEnabled ?? true;

  const filteredData = data && !devyEnabled ? {
    ...data,
    currentLineup: data.currentLineup.filter(p => !p.isDevyPlaceholder),
    optimalLineup: data.optimalLineup.filter(p => !p.isDevyPlaceholder),
  } : data;

  return (
    <PremiumGate featureName="Lineup Optimizer">
      <LineupOptimizerContent data={filteredData} isLoading={isLoading} error={error} />
    </PremiumGate>
  );
}

function LineupOptimizerContent({
  data,
  isLoading,
  error,
}: {
  data: LineupOptimizerData | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) {
    return <OptimizerSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="error-lineup-optimizer">
        <p className="text-muted-foreground">Failed to load lineup optimizer</p>
      </div>
    );
  }

  const optimalPlayerIds = new Set(data.optimalLineup.map((p) => p.playerId));
  const currentStarterIds = new Set(data.currentLineup.map((p) => p.playerId));
  const benchToStarters = data.benchPlayers.filter((p) => optimalPlayerIds.has(p.playerId));

  const currentSlotCounts = new Map<string, number>();
  const optimalSlotCounts = new Map<string, number>();

  return (
    <div className="space-y-4" data-testid="lineup-optimizer-page">
      <div className="flex items-center gap-3 flex-wrap">
        <Target className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold" data-testid="text-optimizer-title">
          Week {data.week} Lineup Optimizer
        </h2>
        <span className="text-sm text-muted-foreground" data-testid="text-team-name">
          {data.teamName}
        </span>
      </div>

      <Card data-testid="card-summary">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Projected</p>
              <p className="text-2xl font-bold" data-testid="text-current-total">
                {data.currentProjectedTotal.toFixed(1)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Optimal Projected</p>
              <p className="text-2xl font-bold" data-testid="text-optimal-total">
                {data.optimalProjectedTotal.toFixed(1)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Points Gained</p>
              <p
                className={`text-2xl font-bold ${data.pointsGained > 0 ? "text-green-500" : "text-muted-foreground"}`}
                data-testid="text-points-gained"
              >
                {data.pointsGained > 0 ? "+" : ""}
                {data.pointsGained.toFixed(1)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-current-lineup">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Your Current Lineup
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.currentLineup.map((player, index) => {
                const slotLabel = getSlotLabel(player.slot, currentSlotCounts);
                return (
                  <div
                    key={`current-${index}`}
                    className={`flex items-center gap-2 px-4 py-2 ${
                      player.isDevyPlaceholder
                        ? "bg-purple-500/5 opacity-60"
                        : player.isOptimal
                          ? "bg-green-500/5"
                          : "bg-destructive/5"
                    }`}
                    data-testid={`row-current-${index}`}
                  >
                    <span className="w-10 text-xs font-medium text-muted-foreground shrink-0">
                      {slotLabel}
                    </span>
                    {player.isDevyPlaceholder ? (
                      <Badge variant="outline" className="shrink-0 border-purple-500/50 text-purple-400 text-[10px]">
                        DEV
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={`shrink-0 ${getPositionColorClass(player.position)}`}>
                        {player.position}
                      </Badge>
                    )}
                    <span className={`font-medium text-sm truncate flex-1 ${player.isDevyPlaceholder ? "italic text-purple-300" : ""}`} data-testid={`text-current-player-${index}`}>
                      <span className="sm:hidden">{abbreviateName(player.name)}</span>
                      <span className="hidden sm:inline">{player.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{player.isDevyPlaceholder ? "" : player.team}</span>
                    <span className="text-sm font-semibold w-12 text-right shrink-0" data-testid={`text-current-pts-${index}`}>
                      {player.isDevyPlaceholder ? "--" : player.projectedPoints.toFixed(1)}
                    </span>
                    <span className="w-5 shrink-0 flex justify-center">
                      {player.isDevyPlaceholder ? (
                        <span className="text-[10px] text-purple-400">DEVY</span>
                      ) : player.isOptimal ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-optimal-lineup">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Optimal Lineup
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.optimalLineup.map((player, index) => {
                const slotLabel = getSlotLabel(player.slot, optimalSlotCounts);
                const isFromBench = !currentStarterIds.has(player.playerId);
                return (
                  <div
                    key={`optimal-${index}`}
                    className={`flex items-center gap-2 px-4 py-2 ${isFromBench ? "bg-green-500/5" : ""}`}
                    data-testid={`row-optimal-${index}`}
                  >
                    <span className="w-10 text-xs font-medium text-muted-foreground shrink-0">
                      {slotLabel}
                    </span>
                    <Badge variant="outline" className={`shrink-0 ${getPositionColorClass(player.position)}`}>
                      {player.position}
                    </Badge>
                    <span className="font-medium text-sm truncate flex-1" data-testid={`text-optimal-player-${index}`}>
                      <span className="sm:hidden">{abbreviateName(player.name)}</span>
                      <span className="hidden sm:inline">{player.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{player.team}</span>
                    <span className="text-sm font-semibold w-12 text-right shrink-0" data-testid={`text-optimal-pts-${index}`}>
                      {player.projectedPoints.toFixed(1)}
                    </span>
                    {isFromBench && (
                      <span className="w-5 shrink-0 flex justify-center">
                        <ArrowUp className="h-4 w-4 text-green-500" />
                      </span>
                    )}
                    {!isFromBench && <span className="w-5 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-bench">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bench</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.benchPlayers.map((player, index) => {
              const shouldStart = benchToStarters.some((p) => p.playerId === player.playerId);
              return (
                <div
                  key={`bench-${index}`}
                  className={`flex items-center gap-2 px-4 py-2 ${shouldStart ? "bg-green-500/5" : ""}`}
                  data-testid={`row-bench-${index}`}
                >
                  <Badge variant="outline" className={`shrink-0 ${getPositionColorClass(player.position)}`}>
                    {player.position}
                  </Badge>
                  <span className="font-medium text-sm truncate flex-1" data-testid={`text-bench-player-${index}`}>
                    <span className="sm:hidden">{abbreviateName(player.name)}</span>
                    <span className="hidden sm:inline">{player.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{player.team}</span>
                  <span className="text-sm font-semibold w-12 text-right shrink-0" data-testid={`text-bench-pts-${index}`}>
                    {player.projectedPoints.toFixed(1)}
                  </span>
                  {shouldStart && (
                    <span className="w-5 shrink-0 flex justify-center">
                      <ArrowUp className="h-4 w-4 text-green-500" />
                    </span>
                  )}
                  {!shouldStart && <span className="w-5 shrink-0" />}
                </div>
              );
            })}
            {data.benchPlayers.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No bench players
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OptimizerSkeleton() {
  return (
    <div className="space-y-4" data-testid="skeleton-lineup-optimizer">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
