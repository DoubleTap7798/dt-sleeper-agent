import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, BarChart3, Table2, Info } from "lucide-react";

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

interface DraftPickValues {
  rounds: RoundData[];
  methodology: string;
  lastUpdated: string;
}

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

function ValueChartView({ rounds }: { rounds: RoundData[] }) {
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
              <div key={pick.displayName} className="flex items-center gap-3" data-testid={`row-pick-value-${pick.displayName}`}>
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
              </div>
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

function DetailsView({ rounds }: { rounds: RoundData[] }) {
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
                  </tr>
                </thead>
                <tbody>
                  {round.picks.map((pick) => (
                    <tr key={pick.displayName} className="border-b last:border-b-0" data-testid={`row-pick-detail-${pick.displayName}`}>
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
                    </tr>
                  ))}
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

  const { data, isLoading, error } = useQuery<DraftPickValues>({
    queryKey: ["/api/draft-pick-values"],
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

  const { rounds } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold" data-testid="text-page-title">Draft Pick Values</h2>
        <Badge variant="secondary">2018-2024 Data</Badge>
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
          <ValueChartView rounds={rounds} />
        </TabsContent>

        <TabsContent value="hitrates" className="mt-4">
          <HitRatesView rounds={rounds} />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <DetailsView rounds={rounds} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
