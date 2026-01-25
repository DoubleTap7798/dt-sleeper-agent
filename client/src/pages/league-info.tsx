import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Users, Trophy, Calendar, DollarSign, Target, Shuffle, Shield, Zap, Crown } from "lucide-react";

interface LeagueInfo {
  leagueId: string;
  name: string;
  season: string;
  status: string;
  avatar: string | null;
  format: string;
  totalTeams: number;
  rosterSettings: {
    starterPositions: string[];
    positionCounts: Record<string, number>;
    benchCount: number;
    totalStarters: number;
    totalRoster: number;
  };
  leagueSettings: {
    playoffTeams: number;
    playoffWeekStart: number;
    tradeDeadline: number;
    waiverSystem: string;
    waiverBudget: number;
  };
  scoringCategories: {
    passing: Record<string, number>;
    rushing: Record<string, number>;
    receiving: Record<string, number>;
    bonuses: Record<string, number>;
    misc: Record<string, number>;
    dst: Record<string, number>;
    kicking: Record<string, number>;
  };
  rawScoring: Record<string, number>;
}

function LeagueInfoSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function LeagueInfoPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading, error } = useQuery<LeagueInfo>({
    queryKey: ["/api/sleeper/league-info", leagueId],
    enabled: !!leagueId && leagueId !== "all",
    ...CACHE_TIMES.STABLE,
  });

  if (!leagueId || leagueId === "all") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a specific league to view its settings</p>
      </div>
    );
  }

  if (isLoading) {
    return <LeagueInfoSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load league info</p>
      </div>
    );
  }

  const { rosterSettings, leagueSettings, scoringCategories } = data;

  const getSlotDisplayName = (pos: string): string => {
    const names: Record<string, string> = {
      QB: "Quarterback",
      RB: "Running Back",
      WR: "Wide Receiver",
      TE: "Tight End",
      FLEX: "Flex (RB/WR/TE)",
      SUPER_FLEX: "Superflex (QB/RB/WR/TE)",
      REC_FLEX: "Rec Flex (WR/TE)",
      K: "Kicker",
      DEF: "Defense/ST",
      IDP_FLEX: "IDP Flex",
      DL: "Defensive Line",
      LB: "Linebacker",
      DB: "Defensive Back",
      BN: "Bench",
    };
    return names[pos] || pos;
  };

  const formatScoringValue = (value: number): string => {
    if (value === 0) return "-";
    if (value > 0) return `+${value}`;
    return value.toString();
  };

  const starterSlotCounts: Record<string, number> = {};
  rosterSettings.starterPositions.forEach(pos => {
    starterSlotCounts[pos] = (starterSlotCounts[pos] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-league-info-title">
            League Info
          </h2>
          <p className="text-muted-foreground">
            {data.name} - {data.season} Season
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-format">{data.format}</Badge>
          <Badge variant="outline" data-testid="badge-teams">{data.totalTeams} Teams</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-roster-settings">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Roster Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Starting Lineup ({rosterSettings.totalStarters} slots)</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(starterSlotCounts).map(([pos, count]) => (
                  <Badge key={pos} variant="outline" className="text-xs" data-testid={`badge-slot-${pos.toLowerCase()}`}>
                    {count}x {pos}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium mb-2">Full Roster Breakdown</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(rosterSettings.positionCounts)
                  .sort(([a], [b]) => {
                    const order = ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "REC_FLEX", "K", "DEF", "BN"];
                    return order.indexOf(a) - order.indexOf(b);
                  })
                  .map(([pos, count]) => (
                    <div key={pos} className="flex justify-between text-muted-foreground" data-testid={`row-position-${pos.toLowerCase()}`}>
                      <span>{getSlotDisplayName(pos)}</span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="border-t pt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{rosterSettings.totalRoster}</span> total roster spots
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-league-settings">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              League Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm" data-testid="row-playoff-teams">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="h-4 w-4" />
                Playoff Teams
              </div>
              <span className="font-medium">{leagueSettings.playoffTeams}</span>
            </div>
            <div className="flex items-center justify-between text-sm" data-testid="row-playoff-start">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Playoffs Start
              </div>
              <span className="font-medium">Week {leagueSettings.playoffWeekStart}</span>
            </div>
            <div className="flex items-center justify-between text-sm" data-testid="row-trade-deadline">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shuffle className="h-4 w-4" />
                Trade Deadline
              </div>
              <span className="font-medium">
                {leagueSettings.tradeDeadline === 0 ? "None" : `Week ${leagueSettings.tradeDeadline}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm" data-testid="row-waiver-system">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                Waiver System
              </div>
              <span className="font-medium">{leagueSettings.waiverSystem}</span>
            </div>
            {leagueSettings.waiverSystem === "FAAB" && (
              <div className="flex items-center justify-between text-sm" data-testid="row-faab-budget">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  FAAB Budget
                </div>
                <span className="font-medium">${leagueSettings.waiverBudget}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm" data-testid="row-status">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                Status
              </div>
              <Badge variant="secondary" className="text-xs capitalize">{data.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2" data-testid="card-scoring-settings">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Scoring Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div data-testid="scoring-passing">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Passing
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Passing Yards</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.passing.passYards)} per yd</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Passing TD</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.passing.passTd)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Interception</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.passing.passInt)}</span>
                  </div>
                </div>
              </div>

              <div data-testid="scoring-rushing">
                <h4 className="text-sm font-medium mb-2">Rushing</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Rushing Yards</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.rushing.rushYards)} per yd</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Rushing TD</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.rushing.rushTd)}</span>
                  </div>
                </div>
              </div>

              <div data-testid="scoring-receiving">
                <h4 className="text-sm font-medium mb-2">Receiving</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Reception (PPR)</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.receiving.reception)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Receiving Yards</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.receiving.recYards)} per yd</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Receiving TD</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.receiving.recTd)}</span>
                  </div>
                </div>
              </div>

              <div data-testid="scoring-misc">
                <h4 className="text-sm font-medium mb-2">Misc / Turnovers</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fumble</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.misc.fumble)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fumble Lost</span>
                    <span className="font-medium text-foreground">{formatScoringValue(scoringCategories.misc.fumbleLost)}</span>
                  </div>
                </div>
              </div>
            </div>

            {(Object.values(scoringCategories.bonuses).some(v => v !== 0)) && (
              <div className="mt-6 pt-4 border-t" data-testid="scoring-bonuses">
                <h4 className="text-sm font-medium mb-2">Bonuses</h4>
                <div className="flex flex-wrap gap-3">
                  {scoringCategories.bonuses.bonus100RushYards !== 0 && (
                    <Badge variant="outline" className="text-xs">100+ Rush Yds: {formatScoringValue(scoringCategories.bonuses.bonus100RushYards)}</Badge>
                  )}
                  {scoringCategories.bonuses.bonus100RecYards !== 0 && (
                    <Badge variant="outline" className="text-xs">100+ Rec Yds: {formatScoringValue(scoringCategories.bonuses.bonus100RecYards)}</Badge>
                  )}
                  {scoringCategories.bonuses.bonus300PassYards !== 0 && (
                    <Badge variant="outline" className="text-xs">300+ Pass Yds: {formatScoringValue(scoringCategories.bonuses.bonus300PassYards)}</Badge>
                  )}
                  {scoringCategories.bonuses.bonus40RushTd !== 0 && (
                    <Badge variant="outline" className="text-xs">40+ Yd Rush TD: {formatScoringValue(scoringCategories.bonuses.bonus40RushTd)}</Badge>
                  )}
                  {scoringCategories.bonuses.bonus40RecTd !== 0 && (
                    <Badge variant="outline" className="text-xs">40+ Yd Rec TD: {formatScoringValue(scoringCategories.bonuses.bonus40RecTd)}</Badge>
                  )}
                  {scoringCategories.bonuses.bonus40PassTd !== 0 && (
                    <Badge variant="outline" className="text-xs">40+ Yd Pass TD: {formatScoringValue(scoringCategories.bonuses.bonus40PassTd)}</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}