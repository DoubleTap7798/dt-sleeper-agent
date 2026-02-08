import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, AlertCircle, User, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";
import { getNFLTeamLogo } from "@/lib/team-logos";
import { MetricTooltip } from "@/components/metric-tooltip";
import { usePageTitle } from "@/hooks/use-page-title";

interface DevyInfo {
  devyName: string;
  devyPosition: string;
  devySchool: string;
}

interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  number: string;
  status: string | null;
  injuryStatus: string | null;
  dynastyValue: number;
  projectedPoints: number;
  isStarter: boolean;
  slotPosition: string;
  starterIndex: number;
  headshot?: string | null;
  devyInfo?: DevyInfo | null;
}

interface PositionRanking {
  rank: number;
  total: number;
  value: number;
}

interface RosterResponse {
  players: RosterPlayer[];
  teamName: string;
  ownerId: string;
  totalValue: number;
  starters: string[];
  positionRankings?: Record<string, PositionRanking>;
  leagueSize?: number;
  isIDPLeague?: boolean;
}

const IDP_POSITION_GROUP: Record<string, string> = {
  DE: "DL", DT: "DL", NT: "DL", EDGE: "DL", ED: "DL", DL: "DL",
  ILB: "LB", OLB: "LB", MLB: "LB", LB: "LB",
  CB: "DB", S: "DB", FS: "DB", SS: "DB", DB: "DB",
};

const positionOrder: Record<string, number> = {
  QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6, DL: 7, LB: 8, DB: 9, FLEX: 10, BN: 11, IR: 12
};

export default function RosterPage() {
  const { league, isLoading: isLoadingLeagues } = useSelectedLeague();
  const leagueId = league?.league_id;
  usePageTitle("My Roster");

  // Show loading while leagues are being fetched
  if (isLoadingLeagues) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">My Roster</h1>
        </div>
        <Card>
          <CardContent className="py-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Early return if no league selected - prevents query from running
  if (!leagueId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">My Roster</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-league">
              Please select a league to view your roster.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <RosterContent leagueId={leagueId} />;
}

function RosterContent({ leagueId }: { leagueId: string }) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);

  const { data, isLoading, error } = useQuery<RosterResponse>({
    queryKey: ["/api/fantasy/roster", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/roster?leagueId=${leagueId}`, {
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


  const getInjuryBadge = (status: string | null) => {
    if (!status) return null;
    return (
      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
        {status}
      </Badge>
    );
  };

  const filteredPlayers = (data?.players || [])
    .filter(p => {
      if (positionFilter === "all") return true;
      if (p.position === positionFilter) return true;
      if (IDP_POSITION_GROUP[p.position] === positionFilter) return true;
      return false;
    });

  // Starters maintain Sleeper's lineup order (already sorted by starterIndex from server)
  // Bench sorted by natural position (already sorted by position then dynasty value from server)
  const starters = filteredPlayers.filter(p => p.isStarter);
  const bench = filteredPlayers.filter(p => !p.isStarter);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold">My Roster</h1>
        </div>
        <Card data-testid="error-state">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-error-message">
              Failed to load roster. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderPlayer = (player: RosterPlayer) => {
    const isDevy = !!player.devyInfo;
    const displayName = isDevy ? player.devyInfo!.devyName : player.name;
    const displayPosition = isDevy ? player.devyInfo!.devyPosition : player.position;
    const displayTeam = isDevy ? player.devyInfo!.devySchool : player.team;
    
    return (
    <Card 
      key={player.playerId}
      className={`hover-elevate transition-all cursor-pointer ${isDevy ? "border-purple-500/30" : ""}`}
      onClick={() => setExpandedPlayer(expandedPlayer === player.playerId ? null : player.playerId)}
      data-testid={`player-card-${player.playerId}`}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0" data-testid={`avatar-${player.playerId}`}>
              {isDevy ? (
                <AvatarFallback className="text-xs bg-purple-500/20 text-purple-400">
                  DEV
                </AvatarFallback>
              ) : (
                <>
                  <AvatarImage 
                    src={getNFLTeamLogo(player.team) || undefined} 
                    alt={player.team}
                  />
                  <AvatarFallback className="text-xs bg-muted">
                    {player.team.slice(0, 2)}
                  </AvatarFallback>
                </>
              )}
            </Avatar>
            <Badge variant="outline" className={`${getPositionColorClass(displayPosition)} text-xs shrink-0`} data-testid={`badge-pos-${player.playerId}`}>
              {player.isStarter ? player.slotPosition : displayPosition}
            </Badge>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm sm:text-base truncate" data-testid={`text-name-${player.playerId}`}>
                  <span className="sm:hidden">{abbreviateName(displayName)}</span>
                  <span className="hidden sm:inline">{displayName}</span>
                </span>
                {isDevy && (
                  <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] shrink-0">
                    DEVY
                  </Badge>
                )}
                {!isDevy && player.injuryStatus && getInjuryBadge(player.injuryStatus)}
              </div>
              <span className="text-xs text-muted-foreground" data-testid={`text-team-${player.playerId}`}>
                {isDevy ? (
                  <>{displayTeam} <span className="text-purple-400/70">(via {abbreviateName(player.name)})</span></>
                ) : (
                  <>{player.team} #{player.number}</>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-sm font-semibold text-primary" data-testid={`stat-value-${player.playerId}`}>
                {player.dynastyValue.toFixed(1)}
              </span>
              <MetricTooltip metric="dynastyValue" className="text-xs text-muted-foreground block" />
            </div>
            <div className="text-right">
              <span className="text-sm font-medium" data-testid={`stat-projected-${player.playerId}`}>
                {player.projectedPoints.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground block">Proj</span>
            </div>
            {expandedPlayer === player.playerId ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        {expandedPlayer === player.playerId && (
          <div className="mt-3 pt-3 border-t border-border" data-testid={`expanded-${player.playerId}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Age</span>
                <span className="font-medium" data-testid={`stat-age-${player.playerId}`}>{player.age}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Slot</span>
                <span className="font-medium" data-testid={`stat-slot-${player.playerId}`}>{player.slotPosition}</span>
              </div>
              <div className="sm:hidden">
                <MetricTooltip metric="dynastyValue" className="text-muted-foreground block text-xs" />
                <span className="font-semibold text-primary">{player.dynastyValue.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Status</span>
                <span className="font-medium capitalize" data-testid={`stat-status-${player.playerId}`}>
                  {player.injuryStatus || "Healthy"}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full sm:w-auto"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayer(player);
              }}
              data-testid={`button-view-stats-${player.playerId}`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Full Stats
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">My Roster</h1>
        </div>
      </div>

      {data?.positionRankings && Object.keys(data.positionRankings).length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="position-rankings">
          {Object.entries(data.positionRankings).map(([pos, ranking]) => {
            if (!ranking || ranking.rank === 0 || ranking.total === 0) return null;
            const isTop = ranking.rank === 1;
            const isBottom = ranking.rank === ranking.total;
            return (
              <Badge
                key={pos}
                variant="outline"
                className="text-xs sm:text-sm"
                data-testid={`badge-${pos.toLowerCase()}-rank`}
              >
                {pos}: #{ranking.rank} of {ranking.total}
                {isTop && " (Best)"}
                {isBottom && " (Last)"}
              </Badge>
            );
          })}
        </div>
      )}

      <Tabs value={positionFilter} onValueChange={setPositionFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" data-testid="tab-all" className="text-xs sm:text-sm">All</TabsTrigger>
          <TabsTrigger value="QB" data-testid="tab-qb" className="text-xs sm:text-sm">QB</TabsTrigger>
          <TabsTrigger value="RB" data-testid="tab-rb" className="text-xs sm:text-sm">RB</TabsTrigger>
          <TabsTrigger value="WR" data-testid="tab-wr" className="text-xs sm:text-sm">WR</TabsTrigger>
          <TabsTrigger value="TE" data-testid="tab-te" className="text-xs sm:text-sm">TE</TabsTrigger>
          {data?.isIDPLeague && (
            <>
              <TabsTrigger value="DL" data-testid="tab-dl" className="text-xs sm:text-sm">DL</TabsTrigger>
              <TabsTrigger value="LB" data-testid="tab-lb" className="text-xs sm:text-sm">LB</TabsTrigger>
              <TabsTrigger value="DB" data-testid="tab-db" className="text-xs sm:text-sm">DB</TabsTrigger>
            </>
          )}
        </TabsList>
      </Tabs>

      {starters.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Starters ({starters.length})
          </h2>
          <div className="space-y-2">
            {starters.map(renderPlayer)}
          </div>
        </div>
      )}

      {bench.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-muted-foreground">
            Bench ({bench.length})
          </h2>
          <div className="space-y-2">
            {bench.map(renderPlayer)}
          </div>
        </div>
      )}

      {filteredPlayers.length === 0 && (
        <Card data-testid="empty-state">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-empty-message">
              {positionFilter !== "all" 
                ? `No ${positionFilter} players on your roster`
                : "No players on your roster"}
            </p>
          </CardContent>
        </Card>
      )}

      {selectedPlayer && (
        <PlayerProfileModal
          open={!!selectedPlayer}
          onOpenChange={(open) => !open && setSelectedPlayer(null)}
          playerId={selectedPlayer.playerId}
          playerName={selectedPlayer.name}
          position={selectedPlayer.position}
          team={selectedPlayer.team}
        />
      )}
    </div>
  );
}
