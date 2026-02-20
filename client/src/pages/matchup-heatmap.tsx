import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid3X3, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface HeatmapPosition {
  position: string;
  myValue: number;
  oppValue: number;
  difference: number;
  advantage: string;
  myPlayers: Array<{ name: string; value: number }>;
  oppPlayers: Array<{ name: string; value: number }>;
}

const POS_LABELS: Record<string, string> = {
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
};

const getAdvantageColor = (advantage: string) => {
  if (advantage === "Strong") return "bg-emerald-500/20 border-emerald-500/40 text-emerald-400";
  if (advantage === "Slight") return "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
  if (advantage === "Slight Disadvantage") return "bg-red-500/10 border-red-500/20 text-red-300";
  return "bg-red-500/20 border-red-500/40 text-red-400";
};

const getAdvantageIcon = (advantage: string) => {
  if (advantage.includes("Disadvantage")) return TrendingDown;
  if (advantage === "Strong" || advantage === "Slight") return TrendingUp;
  return Minus;
};

export default function MatchupHeatmapPage() {
  usePageTitle("Matchup Heat Map");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const { data, isLoading } = useQuery<{
    heatmap: HeatmapPosition[] | null;
    week: number;
    myTeam: string;
    opponent: string;
    myPoints: number;
    oppPoints: number;
    message?: string;
  }>({
    queryKey: ["/api/fantasy/matchup-heatmap", leagueId],
    enabled: !!leagueId,
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view matchup heat maps</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.heatmap) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{data?.message || "No matchup data available this week"}</p>
      </div>
    );
  }

  const totalMyValue = data.heatmap.reduce((sum, h) => sum + h.myValue, 0);
  const totalOppValue = data.heatmap.reduce((sum, h) => sum + h.oppValue, 0);
  const overallAdvantage = totalMyValue > totalOppValue ? "Advantage" : totalMyValue < totalOppValue ? "Disadvantage" : "Even";

  return (
    <PremiumGate featureName="Matchup Heat Maps">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Grid3X3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Matchup Heat Map</h1>
            <p className="text-sm text-muted-foreground">Week {data.week} positional breakdown</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-center">
                <p className="text-sm font-semibold" data-testid="text-my-team">{data.myTeam}</p>
                <p className="text-2xl font-bold text-emerald-400">{data.myPoints > 0 ? data.myPoints.toFixed(1) : totalMyValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{data.myPoints > 0 ? "Points" : "Total Value"}</p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-1">VS</Badge>
              <div className="text-center">
                <p className="text-sm font-semibold" data-testid="text-opponent">{data.opponent}</p>
                <p className="text-2xl font-bold text-red-400">{data.oppPoints > 0 ? data.oppPoints.toFixed(1) : totalOppValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{data.oppPoints > 0 ? "Points" : "Total Value"}</p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <Badge className={overallAdvantage === "Advantage" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : overallAdvantage === "Disadvantage" ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-muted text-muted-foreground"}>
                Overall: {overallAdvantage}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.heatmap.map(pos => {
            const advColor = getAdvantageColor(pos.advantage);
            const AdvIcon = getAdvantageIcon(pos.advantage);
            const maxVal = Math.max(pos.myValue, pos.oppValue, 1);

            return (
              <Card key={pos.position} className={`border ${advColor.split(" ")[1]}`} data-testid={`card-position-${pos.position}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{POS_LABELS[pos.position] || pos.position}</CardTitle>
                    <Badge className={`text-xs ${advColor}`}>
                      <AdvIcon className="h-3 w-3 mr-1" />
                      {pos.advantage}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-14 text-emerald-400 shrink-0">You</span>
                      <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/50"
                          style={{ width: `${(pos.myValue / maxVal) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-16 text-right">{pos.myValue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-14 text-red-400 shrink-0">Opp</span>
                      <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500/50"
                          style={{ width: `${(pos.oppValue / maxVal) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-16 text-right">{pos.oppValue.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-1">Your {pos.position}s</p>
                      {pos.myPlayers.map((p, i) => (
                        <p key={i} className="truncate">{p.name}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Opp {pos.position}s</p>
                      {pos.oppPlayers.map((p, i) => (
                        <p key={i} className="truncate">{p.name}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PremiumGate>
  );
}
