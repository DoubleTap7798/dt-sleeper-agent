import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, GraduationCap, AlertCircle } from "lucide-react";

interface DraftPick {
  round: number;
  pick: number;
  overall: number;
  likelyAvailable: Array<{
    id: string;
    name: string;
    position: string;
    college: string;
    value: number;
    tier: string;
    rank: number;
  }>;
}

const POS_COLORS: Record<string, string> = {
  QB: "text-red-400 bg-red-400/10 border-red-400/30",
  RB: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  WR: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  TE: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

const TIER_COLORS: Record<string, string> = {
  "Elite": "text-yellow-400",
  "Premium": "text-amber-400",
  "Solid": "text-green-400",
  "Upside": "text-blue-400",
  "Depth": "text-muted-foreground",
};

export default function DraftPredictionsPage() {
  usePageTitle("Draft Pick Predictions");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const { data, isLoading } = useQuery<{
    predictions: DraftPick[];
    myDraftSlot: number;
    totalRounds: number;
    draftType: string;
    leagueSize: number;
    draftStatus: string;
    message?: string;
  }>({
    queryKey: ["/api/fantasy/draft-predictions", leagueId],
    enabled: !!leagueId,
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view draft predictions</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (!data?.predictions || data.predictions.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No Upcoming Draft</p>
        <p className="text-sm mt-1">{data?.message || "No active or upcoming draft found for this league."}</p>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Draft Pick Predictions">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Draft Pick Predictions</h1>
            <p className="text-sm text-muted-foreground">
              Slot #{data.myDraftSlot} | {data.draftType} draft | {data.totalRounds} rounds | {data.leagueSize} teams
            </p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {data.draftStatus === "drafting" ? "LIVE" : "Pre-Draft"}
          </Badge>
        </div>

        <div className="space-y-4">
          {data.predictions.map(pick => (
            <Card key={`${pick.round}-${pick.pick}`} data-testid={`card-pick-round-${pick.round}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    Round {pick.round}, Pick {pick.pick}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Overall #{pick.overall}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Projected available players at this pick:</p>
                {pick.likelyAvailable.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prospect data available for this pick range.</p>
                ) : (
                  pick.likelyAvailable.map((prospect, idx) => (
                    <div
                      key={prospect.id}
                      className="flex items-center gap-3 p-2 rounded-md border border-border hover-elevate"
                      data-testid={`row-prospect-${prospect.id}`}
                    >
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-mono shrink-0">
                        {prospect.rank || idx + 1}
                      </div>
                      <Badge variant="outline" className={`text-xs ${POS_COLORS[prospect.position] || ""}`}>
                        {prospect.position}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{prospect.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          <span>{prospect.college}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono">{prospect.value?.toLocaleString()}</p>
                        <p className={`text-xs ${TIER_COLORS[prospect.tier] || "text-muted-foreground"}`}>{prospect.tier}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PremiumGate>
  );
}
