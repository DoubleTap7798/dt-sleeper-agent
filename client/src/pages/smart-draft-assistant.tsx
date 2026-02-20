import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Target, AlertCircle, Zap, TrendingUp } from "lucide-react";

interface MyPick {
  round: number;
  pick: number;
  overall: number;
}

interface Recommendation {
  playerId: string;
  name: string;
  position: string;
  value: number;
  reason: string;
}

interface DraftAssistantData {
  myPicks: MyPick[];
  rosterNeeds: Record<string, number>;
  recommendations: Recommendation[];
  draftStatus: "pre_draft" | "drafting" | "complete";
}

const POS_COLORS: Record<string, string> = {
  QB: "text-red-400 bg-red-400/10 border-red-400/30",
  RB: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  WR: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  TE: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  K: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  DEF: "text-gray-400 bg-gray-400/10 border-gray-400/30",
};

const NEED_COLORS: Record<number, string> = {
  3: "text-red-400",
  2: "text-amber-400",
  1: "text-emerald-400",
  0: "text-muted-foreground",
};

function getNeedLabel(level: number): string {
  if (level >= 3) return "Critical";
  if (level === 2) return "High";
  if (level === 1) return "Moderate";
  return "Filled";
}

export default function SmartDraftAssistantPage() {
  usePageTitle("Smart Draft Assistant");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const { data, isLoading } = useQuery<DraftAssistantData>({
    queryKey: ["/api/fantasy/draft-assistant", leagueId],
    enabled: !!leagueId,
    refetchInterval: (query) => {
      const d = query.state.data as DraftAssistantData | undefined;
      return d?.draftStatus === "drafting" ? 15000 : false;
    },
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to use the draft assistant</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium" data-testid="text-no-draft">No active draft found</p>
        <p className="text-sm mt-1">The draft assistant is available during active or upcoming drafts.</p>
      </div>
    );
  }

  const statusLabel = data.draftStatus === "drafting" ? "LIVE" : data.draftStatus === "complete" ? "Complete" : "Pre-Draft";

  return (
    <PremiumGate featureName="Smart Draft Assistant">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Smart Draft Assistant</h1>
              <p className="text-sm text-muted-foreground">AI-powered recommendations for your draft picks</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={data.draftStatus === "drafting" ? "text-emerald-400 border-emerald-400/30" : ""}
            data-testid="badge-draft-status"
          >
            {data.draftStatus === "drafting" && <Zap className="h-3 w-3 mr-1" />}
            {statusLabel}
          </Badge>
        </div>

        <Card data-testid="card-roster-needs">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Roster Needs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(data.rosterNeeds).map(([pos, need]) => (
                <div
                  key={pos}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                  data-testid={`roster-need-${pos}`}
                >
                  <Badge variant="outline" className={`text-xs ${POS_COLORS[pos] || ""}`}>
                    {pos}
                  </Badge>
                  <span className={`text-sm font-medium ${NEED_COLORS[Math.min(need, 3)] || NEED_COLORS[3]}`}>
                    {getNeedLabel(need)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-my-picks">
          <CardHeader>
            <CardTitle className="text-base">Your Upcoming Picks</CardTitle>
          </CardHeader>
          <CardContent>
            {data.myPicks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming picks found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.myPicks.map((pick) => (
                  <Badge
                    key={pick.overall}
                    variant="outline"
                    className="text-sm"
                    data-testid={`badge-pick-${pick.overall}`}
                  >
                    Rd {pick.round}, Pick {pick.pick} (#{pick.overall})
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-recommendations">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommendations available at this time.</p>
            ) : (
              data.recommendations.map((rec, idx) => (
                <div
                  key={rec.playerId}
                  className="flex items-start gap-3 p-3 rounded-md border border-border hover-elevate"
                  data-testid={`row-recommendation-${rec.playerId}`}
                >
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-mono shrink-0">
                    {idx + 1}
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${POS_COLORS[rec.position] || ""}`}>
                    {rec.position}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{rec.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-primary">{rec.value?.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Value</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
