import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { getPositionColorClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ShieldAlert, Heart, AlertTriangle, CheckCircle, UserPlus, ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface WaiverOption {
  name: string;
  position: string;
  team: string;
  playerId: string;
}

interface RosterReplacement {
  name: string;
  position: string;
  playerId: string;
}

interface InjuredPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  injuryStatus: string;
  injuryBodyPart: string | null;
  injuryNotes: string | null;
  injuryStartDate: string | null;
  severity: "minor" | "moderate" | "severe";
  rosterReplacement: RosterReplacement | null;
  waiverOptions: WaiverOption[];
}

interface InjuryReportResponse {
  injuries: InjuredPlayer[];
  healthyCount: number;
  injuredCount: number;
  irCount: number;
  leagueName: string;
}

const severityConfig: Record<string, { label: string; className: string }> = {
  minor: { label: "Minor", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  moderate: { label: "Moderate", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  severe: { label: "Severe", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function InjuryTrackerPage() {
  const { league, isLoading: isLoadingLeagues } = useSelectedLeague();
  const leagueId = league?.league_id;
  usePageTitle("Injury Tracker");

  if (isLoadingLeagues) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Injury Tracker</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!leagueId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Injury Tracker</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-league">
              Please select a league to view injury reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <InjuryTrackerContent leagueId={leagueId} />;
}

function InjuryTrackerContent({ leagueId }: { leagueId: string }) {
  const { data, isLoading, error } = useQuery<InjuryReportResponse>({
    queryKey: ["/api/fantasy/injury-report", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/injury-report/${leagueId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    enabled: !!leagueId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Injury Tracker</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Injury Tracker</h1>
        </div>
        <Card data-testid="error-state">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-error-message">
              Failed to load injury report. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRoster = (data?.healthyCount || 0) + (data?.injuredCount || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-6 w-6" />
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Injury Tracker</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="summary-cards">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Roster Size</span>
            </div>
            <span className="text-2xl font-bold" data-testid="stat-roster-size">{totalRoster}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-muted-foreground">Injured</span>
            </div>
            <span className="text-2xl font-bold text-yellow-400" data-testid="stat-injured-count">{data?.injuredCount || 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              <span className="text-xs text-muted-foreground">IR/PUP</span>
            </div>
            <span className="text-2xl font-bold text-red-400" data-testid="stat-ir-count">{data?.irCount || 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Healthy</span>
            </div>
            <span className="text-2xl font-bold text-green-400" data-testid="stat-healthy-count">{data?.healthyCount || 0}</span>
          </CardContent>
        </Card>
      </div>

      {data?.injuries && data.injuries.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Injured Players ({data.injuries.length})
          </h2>
          {data.injuries.map(player => {
            const config = severityConfig[player.severity] || severityConfig.moderate;
            return (
              <Card key={player.playerId} data-testid={`injury-card-${player.playerId}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0" data-testid={`avatar-${player.playerId}`}>
                      <AvatarFallback className="text-xs bg-muted">
                        {(player.team || "FA").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm sm:text-base" data-testid={`text-name-${player.playerId}`}>
                          {player.name}
                        </span>
                        <Badge variant="outline" className={`${getPositionColorClass(player.position)} text-xs shrink-0`} data-testid={`badge-pos-${player.playerId}`}>
                          {player.position}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground" data-testid={`text-team-${player.playerId}`}>
                        {player.team || "Free Agent"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <Badge variant="outline" className={`${config.className} text-xs`} data-testid={`badge-severity-${player.playerId}`}>
                      {config.label}
                    </Badge>
                    <Badge variant="outline" className={`${config.className} text-xs`} data-testid={`badge-status-${player.playerId}`}>
                      {player.injuryStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(player.injuryBodyPart || player.injuryNotes) && (
                    <div className="text-sm space-y-1" data-testid={`injury-details-${player.playerId}`}>
                      {player.injuryBodyPart && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Body Part:</span> {player.injuryBodyPart}
                        </p>
                      )}
                      {player.injuryNotes && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Notes:</span> {player.injuryNotes}
                        </p>
                      )}
                      {player.injuryStartDate && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Since:</span> {player.injuryStartDate}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div data-testid={`replacement-section-${player.playerId}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowRight className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Roster Replacement</span>
                      </div>
                      {player.rosterReplacement ? (
                        <Card className="border-primary/20">
                          <CardContent className="p-3 flex items-center gap-2">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                {player.rosterReplacement.position.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <span className="text-sm font-medium block truncate" data-testid={`text-replacement-name-${player.playerId}`}>
                                {player.rosterReplacement.name}
                              </span>
                              <Badge variant="outline" className={`${getPositionColorClass(player.rosterReplacement.position)} text-[10px]`}>
                                {player.rosterReplacement.position}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <p className="text-xs text-muted-foreground italic" data-testid={`text-no-replacement-${player.playerId}`}>
                          No healthy backup on roster
                        </p>
                      )}
                    </div>

                    <div data-testid={`waiver-section-${player.playerId}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <UserPlus className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Waiver Options</span>
                      </div>
                      {player.waiverOptions.length > 0 ? (
                        <div className="space-y-2">
                          {player.waiverOptions.map(wo => (
                            <div key={wo.playerId} className="flex items-center gap-2 text-sm" data-testid={`waiver-option-${wo.playerId}`}>
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className="text-[10px] bg-muted">
                                  {wo.team.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{wo.name}</span>
                              <Badge variant="outline" className={`${getPositionColorClass(wo.position)} text-[10px] shrink-0`}>
                                {wo.position}
                              </Badge>
                              <span className="text-xs text-muted-foreground shrink-0">{wo.team}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic" data-testid={`text-no-waivers-${player.playerId}`}>
                          No free agents available
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card data-testid="empty-state">
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 mx-auto text-green-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">All Clear!</h3>
            <p className="text-muted-foreground" data-testid="text-empty-message">
              No injured players on your roster. Your team is fully healthy!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
