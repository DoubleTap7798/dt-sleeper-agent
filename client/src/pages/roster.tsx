import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, AlertCircle, User, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";
import { getNFLTeamLogo } from "@/lib/team-logos";

interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  number: string;
  status: string | null;
  injuryStatus: string | null;
  ktcValue: number;
  projectedPoints: number;
  isStarter: boolean;
  slotPosition: string;
  starterIndex: number;
  headshot?: string | null;
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
}

const positionOrder: Record<string, number> = {
  QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6, FLEX: 7, BN: 8, IR: 9
};

export default function RosterPage() {
  const { league, isLoading: isLoadingLeagues } = useSelectedLeague();
  const leagueId = league?.league_id;

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

  const getPositionColor = () => {
    return "bg-muted text-muted-foreground border-border";
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status) return null;
    return (
      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
        {status}
      </Badge>
    );
  };

  const filteredPlayers = (data?.players || [])
    .filter(p => positionFilter === "all" || p.position === positionFilter);

  // Starters maintain Sleeper's lineup order (already sorted by starterIndex from server)
  // Bench sorted by natural position (already sorted by position then KTC from server)
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

  const renderPlayer = (player: RosterPlayer) => (
    <Card 
      key={player.playerId}
      className="hover-elevate transition-all cursor-pointer"
      onClick={() => setExpandedPlayer(expandedPlayer === player.playerId ? null : player.playerId)}
      data-testid={`player-card-${player.playerId}`}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0" data-testid={`avatar-${player.playerId}`}>
              <AvatarImage 
                src={player.headshot || getNFLTeamLogo(player.team) || undefined} 
                alt={player.name}
                onError={(e) => {
                  // If headshot fails, try team logo
                  const teamLogo = getNFLTeamLogo(player.team);
                  if (teamLogo && e.currentTarget.src !== teamLogo) {
                    e.currentTarget.src = teamLogo;
                  } else {
                    e.currentTarget.style.display = 'none';
                  }
                }}
              />
              <AvatarFallback className="text-xs bg-muted">
                {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <Badge variant="outline" className={`${getPositionColor()} text-xs shrink-0`} data-testid={`badge-pos-${player.playerId}`}>
              {player.isStarter ? player.slotPosition : player.position}
            </Badge>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm sm:text-base truncate" data-testid={`text-name-${player.playerId}`}>
                  {player.name}
                </span>
                {player.injuryStatus && getInjuryBadge(player.injuryStatus)}
              </div>
              <span className="text-xs text-muted-foreground" data-testid={`text-team-${player.playerId}`}>
                {player.team} #{player.number}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-sm font-medium" data-testid={`stat-value-${player.playerId}`}>
                {player.ktcValue.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground block">Dynasty Value</span>
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
                <span className="text-muted-foreground block text-xs">Dynasty Value</span>
                <span className="font-medium">{player.ktcValue.toFixed(1)}</span>
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
          {(["QB", "RB", "WR", "TE"] as const).map((pos) => {
            const ranking = data.positionRankings![pos];
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
