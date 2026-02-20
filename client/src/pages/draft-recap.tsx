import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface TeamGrade {
  teamName: string;
  avatar: string | null;
  grade: string;
  bestPick: string;
  worstPick: string;
  summary: string;
}

interface DraftRecapData {
  teams: TeamGrade[];
  overallSummary: string;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  "A": "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  "A-": "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  "B+": "text-blue-400 bg-blue-400/10 border-blue-400/30",
  "B": "text-blue-400 bg-blue-400/10 border-blue-400/30",
  "B-": "text-blue-400 bg-blue-400/10 border-blue-400/30",
  "C+": "text-amber-400 bg-amber-400/10 border-amber-400/30",
  "C": "text-amber-400 bg-amber-400/10 border-amber-400/30",
  "C-": "text-amber-400 bg-amber-400/10 border-amber-400/30",
  "D+": "text-orange-400 bg-orange-400/10 border-orange-400/30",
  "D": "text-orange-400 bg-orange-400/10 border-orange-400/30",
  "D-": "text-orange-400 bg-orange-400/10 border-orange-400/30",
  "F": "text-red-400 bg-red-400/10 border-red-400/30",
};

export default function DraftRecapPage() {
  usePageTitle("Draft Recap & Grades");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const { data, isLoading } = useQuery<DraftRecapData>({
    queryKey: ["/api/ai/draft-recap", leagueId],
    enabled: !!leagueId,
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view draft recap</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (!data || !data.teams || data.teams.length === 0) {
    return (
      <PremiumGate featureName="Draft Recap & Grades">
        <div className="p-6 text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Draft Data Available</p>
          <p className="text-sm mt-1">Draft recap will be available after the draft is completed.</p>
        </div>
      </PremiumGate>
    );
  }

  return (
    <PremiumGate featureName="Draft Recap & Grades">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Draft Recap & Grades"
          subtitle="AI-powered post-draft analysis"
          icon={<ScrollText className="h-6 w-6 text-primary" />}
          backTo="/league"
        />

        {data.overallSummary && (
          <Card data-testid="card-overall-summary">
            <CardHeader>
              <CardTitle className="text-base">Overall Draft Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed" data-testid="text-overall-summary">
                {data.overallSummary}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {data.teams.map((team, idx) => {
            const gradeColor = GRADE_COLORS[team.grade] || "text-muted-foreground bg-muted/50 border-border";
            return (
              <Card key={idx} data-testid={`card-team-grade-${idx}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={team.avatar || undefined} />
                      <AvatarFallback>{team.teamName?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold" data-testid={`text-team-name-${idx}`}>
                          {team.teamName}
                        </h3>
                        <Badge variant="outline" className={`text-lg font-bold px-3 ${gradeColor}`} data-testid={`badge-grade-${idx}`}>
                          {team.grade}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3" data-testid={`text-summary-${idx}`}>
                        {team.summary}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs text-muted-foreground">Best Pick:</span>
                          <span className="text-sm font-medium" data-testid={`text-best-pick-${idx}`}>{team.bestPick}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-400" />
                          <span className="text-xs text-muted-foreground">Worst Pick:</span>
                          <span className="text-sm font-medium" data-testid={`text-worst-pick-${idx}`}>{team.worstPick}</span>
                        </div>
                      </div>
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
