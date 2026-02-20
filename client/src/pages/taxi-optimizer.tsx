import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Train, Star, TrendingUp, AlertCircle } from "lucide-react";

interface TaxiPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  yearsExp: number;
  dynastyValue: number;
  upside?: string;
  taxiScore?: number;
  reason?: string;
}

const POS_COLORS: Record<string, string> = {
  QB: "text-red-400",
  RB: "text-emerald-400",
  WR: "text-blue-400",
  TE: "text-amber-400",
};

const UPSIDE_CONFIG: Record<string, { color: string; bg: string }> = {
  High: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  Medium: { color: "text-amber-400", bg: "bg-amber-500/10" },
  Low: { color: "text-muted-foreground", bg: "bg-muted/30" },
};

export default function TaxiOptimizerPage() {
  usePageTitle("Taxi Squad Optimizer");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const { data, isLoading } = useQuery<{
    taxiSlots: number;
    currentTaxi: TaxiPlayer[];
    recommendations: TaxiPlayer[];
    message?: string;
  }>({
    queryKey: ["/api/fantasy/taxi-optimizer", leagueId],
    enabled: !!leagueId,
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Train className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to optimize your taxi squad</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (data?.taxiSlots === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No Taxi Squad</p>
        <p className="text-sm mt-1">{data.message || "This league doesn't have taxi squad slots."}</p>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Taxi Squad Optimizer">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Train className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Taxi Squad Optimizer</h1>
            <p className="text-sm text-muted-foreground">{data?.taxiSlots} taxi slots available</p>
          </div>
        </div>

        {(data?.currentTaxi || []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Taxi Squad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data!.currentTaxi.map(p => (
                <div key={p.playerId} className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border" data-testid={`row-current-taxi-${p.playerId}`}>
                  <Badge variant="outline" className="text-xs">
                    <span className={POS_COLORS[p.position] || ""}>{p.position}</span>
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.team} | Age {p.age} | Yr {p.yearsExp}</p>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{p.dynastyValue.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Recommended Stash Candidates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recommendations || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No eligible taxi candidates found on your bench.</p>
            ) : (
              data!.recommendations.map((p, idx) => {
                const upsideConfig = UPSIDE_CONFIG[p.upside || "Low"] || UPSIDE_CONFIG.Low;
                return (
                  <div key={p.playerId} className="flex items-center gap-3 p-3 rounded-md border border-border" data-testid={`row-recommendation-${p.playerId}`}>
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <span className={POS_COLORS[p.position] || ""}>{p.position}</span>
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.team} | Age {p.age} | Yr {p.yearsExp}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.reason}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge className={`text-xs ${upsideConfig.bg}`}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        <span className={upsideConfig.color}>{p.upside} Upside</span>
                      </Badge>
                      <p className="text-xs font-mono text-muted-foreground">{p.dynastyValue.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
