import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, AlertCircle, Radio } from "lucide-react";

interface DraftPick {
  round: number;
  pick: number;
  playerId: string;
  playerName: string;
  position: string;
  teamName: string;
  teamAvatar: string | null;
}

interface LiveDraftData {
  status: "pre_draft" | "in_progress" | "complete" | "none";
  picks: DraftPick[];
  totalRounds: number;
  totalTeams: number;
  currentPick: number;
}

const POS_COLORS: Record<string, string> = {
  QB: "text-red-400 bg-red-400/10 border-red-400/30",
  RB: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  WR: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  TE: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  K: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  DEF: "text-gray-400 bg-gray-400/10 border-gray-400/30",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pre_draft: { label: "Pre-Draft", className: "text-muted-foreground" },
  in_progress: { label: "In Progress", className: "text-emerald-400" },
  complete: { label: "Complete", className: "text-amber-400" },
  none: { label: "No Draft", className: "text-muted-foreground" },
};

export default function LiveDraftBoardPage() {
  usePageTitle("Live Draft Board");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const { data, isLoading } = useQuery<LiveDraftData>({
    queryKey: ["/api/fantasy/live-draft", leagueId],
    enabled: !!leagueId,
    refetchInterval: 10000,
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view the live draft board</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-full mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!data || (!data.picks.length && data.status === "pre_draft")) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium" data-testid="text-no-draft">No active draft found for this league</p>
        <p className="text-sm mt-1">The draft hasn't started yet or no draft is scheduled.</p>
      </div>
    );
  }

  const statusConfig = STATUS_LABELS[data.status] || STATUS_LABELS.pre_draft;

  const teamNames: string[] = [];
  const teamAvatars: Record<string, string | null> = {};
  for (const pick of data.picks) {
    if (!teamNames.includes(pick.teamName)) {
      teamNames.push(pick.teamName);
      teamAvatars[pick.teamName] = pick.teamAvatar;
    }
  }
  while (teamNames.length < data.totalTeams) {
    teamNames.push(`Team ${teamNames.length + 1}`);
  }

  const pickGrid: Record<string, DraftPick | undefined> = {};
  for (const pick of data.picks) {
    pickGrid[`${pick.round}-${pick.pick}`] = pick;
  }

  return (
    <PremiumGate featureName="Live Draft Board">
      <div className="p-4 md:p-6 space-y-6 max-w-full mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Live Draft Board</h1>
              <p className="text-sm text-muted-foreground">
                {data.totalRounds} rounds | {data.totalTeams} teams | Auto-refreshing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.status === "in_progress" && (
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            )}
            <Badge variant="outline" className={statusConfig.className} data-testid="badge-draft-status">
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <div className="min-w-max">
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(${teamNames.length}, minmax(120px, 1fr))` }}>
                <div className="p-2 text-xs font-medium text-muted-foreground sticky left-0 bg-card z-10" />
                {teamNames.map((name, idx) => (
                  <div key={idx} className="p-2 text-center border-b border-border" data-testid={`header-team-${idx}`}>
                    <Avatar className="h-6 w-6 mx-auto mb-1">
                      <AvatarImage src={teamAvatars[name] || undefined} />
                      <AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback>
                    </Avatar>
                    <p className="text-xs font-medium truncate">{name}</p>
                  </div>
                ))}

                {Array.from({ length: data.totalRounds }).map((_, roundIdx) => {
                  const round = roundIdx + 1;
                  return (
                    <div key={round} className="contents">
                      <div className="p-2 flex items-center justify-center text-xs font-mono text-muted-foreground border-r border-border sticky left-0 bg-card z-10">
                        R{round}
                      </div>
                      {teamNames.map((_, teamIdx) => {
                        const pickNum = teamIdx + 1;
                        const overall = (round - 1) * data.totalTeams + pickNum;
                        const pick = pickGrid[`${round}-${pickNum}`];
                        const isCurrent = data.currentPick === overall;

                        return (
                          <div
                            key={`${round}-${pickNum}`}
                            className={`p-1.5 border border-border/50 min-h-[52px] flex items-center justify-center ${
                              isCurrent ? "ring-2 ring-primary animate-pulse" : ""
                            }`}
                            data-testid={`cell-pick-${round}-${pickNum}`}
                          >
                            {pick ? (
                              <div className="text-center w-full">
                                <p className="text-xs font-medium truncate leading-tight">{pick.playerName}</p>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] mt-0.5 ${POS_COLORS[pick.position] || ""}`}
                                  data-testid={`badge-position-${round}-${pickNum}`}
                                >
                                  {pick.position}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/40">{overall}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
