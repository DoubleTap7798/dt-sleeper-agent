import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Users, TrendingUp, Calendar, Target, Crown, Medal, Activity, ArrowRightLeft, UserPlus } from "lucide-react";
import type { SleeperLeague } from "@/lib/sleeper-types";

interface CareerSummary {
  totalLeagues: number;
  totalSeasons: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  championships: number;
  runnerUps: number;
  playoffAppearances: number;
  bestFinish: string;
  currentSeason: string;
  leagueStats: {
    leagueId: string;
    leagueName: string;
    season: string;
    wins: number;
    losses: number;
    ties: number;
    rank: number;
    totalTeams: number;
    isChampion: boolean;
    isPlayoffs: boolean;
    isRunnerUp?: boolean;
  }[];
}

interface LeagueSummary {
  leagueName: string;
  totalSeasons: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  championships: number;
  runnerUps: number;
  playoffAppearances: number;
  bestFinish: string;
  seasonStats: {
    leagueId: string;
    season: string;
    wins: number;
    losses: number;
    ties: number;
    rank: number;
    totalTeams: number;
    isChampion: boolean;
    isPlayoffs: boolean;
    isRunnerUp?: boolean;
  }[];
}

interface Notification {
  id: string;
  leagueId: string;
  type: string;
  transactionId: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function HomePage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueIdFromUrl = urlParams.get("id");
  
  const isAllLeagues = !leagueIdFromUrl || leagueIdFromUrl === "all";

  const { data: leagues = [] } = useQuery<SleeperLeague[]>({
    queryKey: ["/api/sleeper/leagues"],
  });

  const selectedLeague = leagues.find((l) => l.league_id === leagueIdFromUrl) || null;

  // Fetch career stats for All Leagues view
  const { data: careerData, isLoading: careerLoading } = useQuery<CareerSummary>({
    queryKey: ["/api/fantasy/summary"],
    enabled: isAllLeagues,
  });

  // Fetch league-specific stats when a specific league is selected
  const { data: leagueData, isLoading: leagueLoading } = useQuery<LeagueSummary>({
    queryKey: [`/api/fantasy/league-summary/${leagueIdFromUrl}`],
    enabled: !!leagueIdFromUrl && leagueIdFromUrl !== "all",
  });

  // Fetch recent notifications for selected league (has formatted player names)
  // Use sync endpoint which doesn't have the strict access check
  const { data: notificationsData, isLoading: isLoadingActivity } = useQuery<{ notifications: Notification[] }>({
    queryKey: ["/api/notifications/sync", leagueIdFromUrl],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/${leagueIdFromUrl}/sync`, { 
        method: "POST",
        credentials: "include" 
      });
      if (!res.ok) return { notifications: [] };
      const data = await res.json();
      // Sync endpoint returns { success, newNotifications, notifications }
      return { notifications: data.notifications ?? [] };
    },
    enabled: !!leagueIdFromUrl && leagueIdFromUrl !== "all",
    staleTime: 60000, // Cache for 1 minute to avoid excessive syncs
  });

  const isLoading = isAllLeagues ? careerLoading : leagueLoading;
  const data = isAllLeagues ? careerData : leagueData;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const winRate = data && (data.totalWins + data.totalLosses) > 0
    ? ((data.totalWins / (data.totalWins + data.totalLosses)) * 100).toFixed(1)
    : "0";

  // ALL LEAGUES VIEW
  if (isAllLeagues) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Career Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
            Your fantasy football overview across all leagues
          </p>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-leagues">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Career Seasons</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold" data-testid="stat-total-leagues">
                {careerData?.totalSeasons || careerData?.leagueStats?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">{careerData?.totalLeagues || leagues?.length || 0} active leagues</p>
            </CardContent>
          </Card>

          <Card data-testid="card-record">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Overall Record</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold" data-testid="stat-record">
                {careerData?.totalWins || 0}-{careerData?.totalLosses || 0}
                {careerData?.totalTies ? `-${careerData.totalTies}` : ""}
              </div>
              <p className="text-xs text-muted-foreground">{winRate}% win rate</p>
            </CardContent>
          </Card>

          <Card data-testid="card-championships">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Championships</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold" data-testid="stat-championships">
                {careerData?.championships || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {careerData?.runnerUps ? `${careerData.runnerUps} runner-ups` : "Titles won"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-playoffs">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Playoff Apps</CardTitle>
              <Medal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold" data-testid="stat-playoffs">
                {careerData?.playoffAppearances || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total appearances</p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-league-breakdown">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">League Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {careerData?.leagueStats && careerData.leagueStats.length > 0 ? (
              <div className="space-y-3">
                {careerData.leagueStats.map((league, idx) => (
                  <div 
                    key={`${league.leagueId}-${league.season}`} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/50 gap-2"
                    data-testid={`league-row-${idx}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {league.isChampion && <Crown className="h-4 w-4 shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm sm:text-base" data-testid={`league-name-${idx}`}>
                          {league.leagueName}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`league-season-${idx}`}>
                          {league.season}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs" data-testid={`league-record-${idx}`}>
                        {league.wins}-{league.losses}{league.ties ? `-${league.ties}` : ""}
                      </Badge>
                      <Badge variant="secondary" className="text-xs" data-testid={`league-rank-${idx}`}>
                        #{league.rank} of {league.totalTeams}
                      </Badge>
                      {league.isPlayoffs && (
                        <Badge variant="outline" className="text-xs" data-testid={`league-playoffs-${idx}`}>
                          Playoffs
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : leagues && leagues.length > 0 ? (
              <div className="space-y-3">
                {leagues.map((league: any, idx: number) => (
                  <div 
                    key={league.league_id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/50 gap-2"
                    data-testid={`league-row-${idx}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base" data-testid={`league-name-${idx}`}>
                        {league.name}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`league-season-${idx}`}>
                        {league.season} Season
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs self-start sm:self-center" data-testid={`league-teams-${idx}`}>
                      {league.total_rosters} Teams
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-leagues">
                  No leagues connected. Connect your Sleeper account to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // SINGLE LEAGUE VIEW
  const recentActivity = notificationsData?.notifications?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={selectedLeague?.avatar ? `https://sleepercdn.com/avatars/${selectedLeague.avatar}` : undefined}
              alt={selectedLeague?.name || "League"}
            />
            <AvatarFallback className="text-xs">
              {(selectedLeague?.name || leagueData?.leagueName || "L").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">
            {selectedLeague?.name || leagueData?.leagueName || "League Dashboard"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
          Your history in this league
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-league-seasons">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Seasons</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-league-seasons">
              {leagueData?.totalSeasons || 1}
            </div>
            <p className="text-xs text-muted-foreground">In this league</p>
          </CardContent>
        </Card>

        <Card data-testid="card-league-record">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">League Record</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-league-record">
              {leagueData?.totalWins || 0}-{leagueData?.totalLosses || 0}
              {leagueData?.totalTies ? `-${leagueData.totalTies}` : ""}
            </div>
            <p className="text-xs text-muted-foreground">{winRate}% win rate</p>
          </CardContent>
        </Card>

        <Card data-testid="card-league-championships">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Championships</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-league-championships">
              {leagueData?.championships || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {leagueData?.runnerUps ? `${leagueData.runnerUps} runner-ups` : "Titles won"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-league-playoffs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Playoff Apps</CardTitle>
            <Medal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold" data-testid="stat-league-playoffs">
              {leagueData?.playoffAppearances || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total appearances</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-current-activity">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingActivity ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 animate-pulse">
                  <div className="shrink-0 w-4 h-4 rounded bg-muted-foreground/20" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
                    <div className="h-3 bg-muted-foreground/20 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity, idx) => (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  data-testid={`activity-row-${idx}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {activity.type === "trade" ? (
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    ) : activity.type === "waiver" ? (
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm" data-testid={`activity-message-${idx}`}>
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`activity-time-${idx}`}>
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 capitalize" data-testid={`activity-type-${idx}`}>
                    {activity.type.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-activity">
                No recent activity in this league
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLeague && (
        <Card data-testid="card-current-league-info">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">League Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Current Season</p>
                <p className="font-medium text-sm sm:text-base" data-testid="current-season">{selectedLeague.season}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teams</p>
                <p className="font-medium text-sm sm:text-base" data-testid="current-teams">{selectedLeague.total_rosters}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium text-sm sm:text-base capitalize" data-testid="current-status">{selectedLeague.status || "Active"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium text-sm sm:text-base capitalize" data-testid="current-type">
                  {selectedLeague.settings?.type === 2 ? "Dynasty" : "Redraft"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
