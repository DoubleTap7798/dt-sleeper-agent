import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Trophy, Users, TrendingUp, Calendar, Target, Crown, Medal, Activity, 
  ArrowRightLeft, UserPlus, RefreshCw, Zap, AlertTriangle, ChevronRight,
  ArrowUpRight, Rocket, Shield, Hourglass, HelpCircle, Lightbulb
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  takeoverSeason: number | null;
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

interface DashboardData {
  rosterStrength: { QB: number; RB: number; WR: number; TE: number };
  positionRanks: Record<string, { rank: number; total: number; value: number; maxValue: number }>;
  teamProfile: "contender" | "balanced" | "rebuild";
  biggestNeed: { position: string; rank: number; total: number; message: string } | null;
  recommendations: Array<{ 
    type: string; 
    priority: "high" | "medium" | "low"; 
    title: string; 
    description: string; 
    action?: string 
  }>;
  weeklyBlurb: string;
  avgAge: number;
  playerCount: number;
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

// Strength bar component with glow effect
function StrengthBar({ position, value, rank, total }: { position: string; value: number; rank: number; total: number }) {
  const positionColors: Record<string, string> = {
    QB: "from-red-500 to-red-600",
    RB: "from-green-500 to-green-600",
    WR: "from-blue-500 to-blue-600",
    TE: "from-yellow-500 to-yellow-600",
  };

  const glowColors: Record<string, string> = {
    QB: "shadow-red-500/50",
    RB: "shadow-green-500/50",
    WR: "shadow-blue-500/50",
    TE: "shadow-yellow-500/50",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{position}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground cursor-help">#{rank} of {total}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Your {position} room ranks #{rank} out of {total} teams in dynasty value</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${positionColors[position]} rounded-full transition-all duration-500 shadow-lg ${value >= 80 ? glowColors[position] : ""}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// Team profile badge component
function TeamProfileBadge({ profile, avgAge }: { profile: "contender" | "balanced" | "rebuild"; avgAge: number }) {
  const config = {
    contender: { 
      icon: Rocket, 
      label: "Contender", 
      color: "bg-green-500/20 text-green-400 border-green-500/50",
      description: "Your roster is built to win now"
    },
    balanced: { 
      icon: Shield, 
      label: "Balanced", 
      color: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      description: "Mix of youth and experience"
    },
    rebuild: { 
      icon: Hourglass, 
      label: "Rebuilding", 
      color: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      description: "Young roster with upside"
    },
  };

  const { icon: Icon, label, color, description } = config[profile];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${color} cursor-help`}>
          <Icon className="h-4 w-4" />
          <span className="font-medium text-sm">{label}</span>
          <Badge variant="outline" className="text-xs">{avgAge} avg</Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{description}</p>
        <p className="text-muted-foreground text-xs mt-1">Average player age: {avgAge} years</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Recommendation card component
function RecommendationCard({ rec, leagueId }: { rec: DashboardData["recommendations"][0]; leagueId: string }) {
  const priorityConfig = {
    high: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
    medium: { icon: Lightbulb, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
    low: { icon: ChevronRight, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  };

  const typeIcons: Record<string, any> = {
    waiver: UserPlus,
    trade: ArrowRightLeft,
    lineup: Zap,
  };

  const { icon: PriorityIcon, color, bg } = priorityConfig[rec.priority];
  const TypeIcon = typeIcons[rec.type] || ChevronRight;

  const content = (
    <div className={`p-4 rounded-lg border ${bg} hover-elevate transition-all group cursor-pointer`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-background/50 ${color}`}>
          <TypeIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{rec.title}</h4>
            {rec.priority === "high" && <PriorityIcon className={`h-4 w-4 ${color}`} />}
          </div>
          <p className="text-xs text-muted-foreground">{rec.description}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );

  if (rec.action) {
    return (
      <Link href={rec.action} data-testid={`rec-${rec.type}`}>
        {content}
      </Link>
    );
  }

  return content;
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

  // Fetch dashboard data for action-first view
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/fantasy/dashboard", leagueIdFromUrl],
    enabled: !!leagueIdFromUrl && leagueIdFromUrl !== "all",
  });

  // Fetch recent notifications for selected league
  const { data: notificationsData, isLoading: isLoadingActivity } = useQuery<{ notifications: Notification[] }>({
    queryKey: ["/api/notifications/sync", leagueIdFromUrl],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/${leagueIdFromUrl}/sync`, { 
        method: "POST",
        credentials: "include" 
      });
      if (!res.ok) return { notifications: [] };
      const data = await res.json();
      return { notifications: data.notifications ?? [] };
    },
    enabled: !!leagueIdFromUrl && leagueIdFromUrl !== "all",
    staleTime: 60000,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation to set takeover season
  const setTakeoverMutation = useMutation({
    mutationFn: async (takeoverSeason: number) => {
      return apiRequest("POST", `/api/league-takeover/${leagueIdFromUrl}`, { takeoverSeason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fantasy/league-summary/${leagueIdFromUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/fantasy/summary"] });
      toast({ title: "Takeover Set", description: "Your career stats now start from the takeover season." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set takeover season.", variant: "destructive" });
    },
  });

  // Mutation to clear takeover
  const clearTakeoverMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/league-takeover/${leagueIdFromUrl}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fantasy/league-summary/${leagueIdFromUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/fantasy/summary"] });
      toast({ title: "Takeover Cleared", description: "All historical seasons are now included." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear takeover season.", variant: "destructive" });
    },
  });

  const isLoading = isAllLeagues ? careerLoading : (leagueLoading || dashboardLoading);
  const data = isAllLeagues ? careerData : leagueData;
  
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 12 }, (_, i) => currentYear - 11 + i);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const winRate = data && (data.totalWins + data.totalLosses) > 0
    ? ((data.totalWins / (data.totalWins + data.totalLosses)) * 100).toFixed(1)
    : "0";

  // ALL LEAGUES VIEW - Career Stats
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

  // SINGLE LEAGUE VIEW - Action-First Dashboard
  const recentActivity = notificationsData?.notifications?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Header with league info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage 
              src={selectedLeague?.avatar ? `https://sleepercdn.com/avatars/${selectedLeague.avatar}` : undefined}
              alt={selectedLeague?.name || "League"}
            />
            <AvatarFallback className="text-sm font-bold">
              {(selectedLeague?.name || leagueData?.leagueName || "L").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">
              {selectedLeague?.name || leagueData?.leagueName || "Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedLeague?.season} Season
            </p>
          </div>
        </div>
        {dashboardData && (
          <TeamProfileBadge profile={dashboardData.teamProfile} avgAge={dashboardData.avgAge} />
        )}
      </div>

      {/* Weekly Insight */}
      {dashboardData?.weeklyBlurb && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-weekly-insight">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm">{dashboardData.weeklyBlurb}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Roster Strength */}
        <Card data-testid="card-roster-strength">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Roster Strength
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Shows your position group strength relative to other teams in your league, based on dynasty values.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Badge variant="outline" className="text-xs">{dashboardData?.playerCount || 0} players</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData ? (
              <>
                <StrengthBar 
                  position="QB" 
                  value={dashboardData.rosterStrength.QB} 
                  rank={dashboardData.positionRanks.QB?.rank || 0}
                  total={dashboardData.positionRanks.QB?.total || 0}
                />
                <StrengthBar 
                  position="RB" 
                  value={dashboardData.rosterStrength.RB} 
                  rank={dashboardData.positionRanks.RB?.rank || 0}
                  total={dashboardData.positionRanks.RB?.total || 0}
                />
                <StrengthBar 
                  position="WR" 
                  value={dashboardData.rosterStrength.WR} 
                  rank={dashboardData.positionRanks.WR?.rank || 0}
                  total={dashboardData.positionRanks.WR?.total || 0}
                />
                <StrengthBar 
                  position="TE" 
                  value={dashboardData.rosterStrength.TE} 
                  rank={dashboardData.positionRanks.TE?.rank || 0}
                  total={dashboardData.positionRanks.TE?.total || 0}
                />
              </>
            ) : (
              <div className="space-y-4">
                {["QB", "RB", "WR", "TE"].map(pos => (
                  <div key={pos} className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommended Actions */}
        <Card data-testid="card-recommendations">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboardData?.recommendations && dashboardData.recommendations.length > 0 ? (
              dashboardData.recommendations.map((rec, idx) => (
                <RecommendationCard key={idx} rec={rec} leagueId={leagueIdFromUrl || ""} />
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No actions needed right now</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Biggest Need Alert */}
      {dashboardData?.biggestNeed && dashboardData.biggestNeed.rank > (dashboardData.positionRanks[dashboardData.biggestNeed.position]?.total || 10) / 2 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5" data-testid="card-biggest-need">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-sm">Biggest Need: {dashboardData.biggestNeed.position}</p>
                  <p className="text-xs text-muted-foreground">{dashboardData.biggestNeed.message}</p>
                </div>
              </div>
              <Link href={`/league/waivers?id=${leagueIdFromUrl}&position=${dashboardData.biggestNeed.position}`}>
                <Button size="sm" variant="outline" data-testid="btn-address-need">
                  Find help <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-league-record">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs font-medium">League Record</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="stat-league-record">
              {leagueData?.totalWins || 0}-{leagueData?.totalLosses || 0}
              {leagueData?.totalTies ? `-${leagueData.totalTies}` : ""}
            </div>
            <p className="text-xs text-muted-foreground">{winRate}% win rate</p>
          </CardContent>
        </Card>

        <Card data-testid="card-league-championships">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs font-medium">Championships</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="stat-league-championships">
              {leagueData?.championships || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {leagueData?.runnerUps ? `${leagueData.runnerUps} runner-ups` : "Titles"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-league-playoffs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs font-medium">Playoff Apps</CardTitle>
            <Medal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="stat-league-playoffs">
              {leagueData?.playoffAppearances || 0}
            </div>
            <p className="text-xs text-muted-foreground">Appearances</p>
          </CardContent>
        </Card>

        <Card data-testid="card-league-seasons">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs font-medium">Seasons</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="stat-league-seasons">
              {leagueData?.totalSeasons || 1}
            </div>
            <p className="text-xs text-muted-foreground">In this league</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card data-testid="card-recent-activity">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingActivity ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
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
            <div className="text-center py-6">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Takeover (collapsed by default) */}
      <Card data-testid="card-team-takeover">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <CardTitle className="text-base font-semibold">Team Takeover</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Took over an orphan team? Set your start date to exclude previous owner stats.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Select
              value={leagueData?.takeoverSeason?.toString() || "all"}
              onValueChange={(value) => {
                if (value === "all") {
                  clearTakeoverMutation.mutate();
                } else {
                  setTakeoverMutation.mutate(parseInt(value));
                }
              }}
              disabled={setTakeoverMutation.isPending || clearTakeoverMutation.isPending}
            >
              <SelectTrigger className="w-[200px]" data-testid="select-takeover-season">
                <SelectValue placeholder="Select takeover season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year} Season
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {leagueData?.takeoverSeason && (
              <Badge variant="outline" className="text-xs" data-testid="badge-takeover-status">
                Stats start from {leagueData.takeoverSeason}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
