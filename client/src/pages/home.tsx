import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Users, TrendingUp, Calendar, Target, Crown, Medal, Activity, 
  ArrowRightLeft, UserPlus, RefreshCw, Zap, AlertTriangle, ChevronRight,
  ArrowUpRight, ArrowUp, ArrowDown, Minus, Rocket, Shield, Hourglass, HelpCircle, Lightbulb, X,
  Share2, Copy, Check, Crosshair, Flame, BarChart3, Gauge, Brain
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
    prevRank?: number;
    totalTeams: number;
    isChampion: boolean;
    isPlayoffs: boolean;
    isRunnerUp?: boolean;
    isCurrentSeason?: boolean;
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

interface TradeIdea {
  tradePartner: { name: string; avatar: string | null; ownerId: string };
  give: Array<{ name: string; pos: string; value: number }>;
  get: Array<{ name: string; pos: string; value: number }>;
  reason: string;
  fairnessScore: number;
}

interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  dynastyValue: number;
  injuryStatus: string | null;
}

interface RosterResponse {
  players: RosterPlayer[];
  teamName: string;
  totalValue: number;
}

interface StatLeader {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  value: number;
  games_played?: number;
}

interface StatLeadersResponse {
  season: number;
  categories: {
    receiving: Record<string, StatLeader[]>;
    rushing: Record<string, StatLeader[]>;
    passing: Record<string, StatLeader[]>;
    explosive: Record<string, StatLeader[]>;
    efficiency: Record<string, StatLeader[]>;
    fantasy: Record<string, StatLeader[]>;
    redzone: Record<string, StatLeader[]>;
    advanced: Record<string, StatLeader[]>;
  };
}

const STAT_LABELS: Record<string, string> = {
  targets: "Targets",
  receptions: "Receptions",
  receiving_yards: "Receiving Yards",
  receiving_tds: "Receiving TDs",
  receiving_first_downs: "Receiving 1st Downs",
  carries: "Carries",
  rushing_yards: "Rushing Yards",
  rushing_tds: "Rushing TDs",
  rushing_first_downs: "Rushing 1st Downs",
  passing_yards: "Passing Yards",
  passing_tds: "Passing TDs",
  completions: "Completions",
  rushing_20plus: "20+ Yard Runs",
  rushing_30plus: "30+ Yard Runs",
  rushing_40plus: "40+ Yard Runs",
  receiving_20plus: "20+ Yard Catches",
  receiving_30plus: "30+ Yard Catches",
  receiving_40plus: "40+ Yard Catches",
  passing_20plus: "20+ Yard Passes",
  passing_30plus: "30+ Yard Passes",
  passing_40plus: "40+ Yard Passes",
  target_share: "Target Share",
  yards_per_carry: "Yards/Carry",
  catch_rate: "Catch Rate",
  wopr: "WOPR",
  ppg_ppr: "PPG (PPR)",
  fantasy_points_ppr: "Total PPR Points",
  rz_total_td: "RZ Total TDs",
  rz_pass_td: "RZ Pass TDs",
  rz_rush_td: "RZ Rush TDs",
  rz_fpts_per_game: "RZ FPTS/G",
  rz_fpts: "RZ Fantasy Pts",
  rz_att: "RZ Attempts",
  rz_comp_pct: "RZ Comp %",
  rz_wr_td: "WR RZ TDs",
  rz_wr_tgt: "WR RZ Targets",
  rz_wr_rec: "WR RZ Receptions",
  rz_wr_yds: "WR RZ Yards",
  rz_wr_fpts: "WR RZ Fantasy Pts",
  rz_wr_fpts_per_game: "WR RZ FPTS/G",
  rz_rb_td: "RB RZ TDs",
  rz_rb_att: "RB RZ Carries",
  rz_rb_rush_yds: "RB RZ Rush Yards",
  rz_rb_ya: "RB RZ Yards/Att",
  rz_rb_fpts: "RB RZ Fantasy Pts",
  rz_rb_fpts_per_game: "RB RZ FPTS/G",
  rz_te_td: "TE RZ TDs",
  rz_te_tgt: "TE RZ Targets",
  rz_te_rec: "TE RZ Receptions",
  rz_te_yds: "TE RZ Yards",
  rz_te_fpts: "TE RZ Fantasy Pts",
  rz_te_fpts_per_game: "TE RZ FPTS/G",
  adv_passing_yds: "Passing Yards",
  adv_passer_rating: "Passer Rating",
  adv_air_yds: "Air Yards",
  adv_air_per_att: "Air Yds/Att",
  adv_deep_20plus: "20+ Yd Passes",
  adv_deep_30plus: "30+ Yd Passes",
  adv_comp_pct: "Comp %",
  adv_ya: "Yards/Att",
  adv_sacks: "Sacks Taken",
  adv_knockdowns: "Knockdowns",
  adv_hurries: "Hurries",
  adv_poor_throws: "Poor Throws",
  adv_drops: "Drops (WR)",
  adv_pkt_time: "Pocket Time",
  adv_rz_att: "RZ Attempts",
};

const POSITION_COLORS: Record<string, string> = {
  QB: "text-red-400",
  RB: "text-green-400",
  WR: "text-blue-400",
  TE: "text-yellow-400",
};

function formatStatValue(key: string, value: number): string {
  if (["target_share", "catch_rate"].includes(key)) {
    return (value * 100).toFixed(1) + "%";
  }
  if (["rz_comp_pct", "adv_comp_pct"].includes(key)) {
    return value.toFixed(1) + "%";
  }
  if (["yards_per_carry", "wopr", "ppg_ppr", "rz_fpts_per_game", "adv_air_per_att", "adv_ya", "adv_pkt_time", "rz_rb_ya", "rz_wr_fpts_per_game", "rz_rb_fpts_per_game", "rz_te_fpts_per_game"].includes(key)) {
    return value.toFixed(1);
  }
  if (["receiving_yards", "rushing_yards", "passing_yards", "fantasy_points_ppr", "adv_passing_yds", "adv_air_yds", "rz_fpts", "rz_wr_fpts", "rz_rb_fpts", "rz_te_fpts"].includes(key)) {
    return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return String(Math.round(value));
}

function LeaderboardTable({ statKey, leaders }: { statKey: string; leaders: StatLeader[] }) {
  return (
    <div className="space-y-1" data-testid={`leaderboard-${statKey}`}>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">{STAT_LABELS[statKey] || statKey}</h4>
      {leaders.slice(0, 5).map((player, idx) => (
        <div
          key={player.player_id || idx}
          className="flex items-center gap-2 py-1 px-2 rounded bg-muted/30 text-xs"
          data-testid={`leader-${statKey}-${idx}`}
        >
          <span className="w-4 text-muted-foreground font-medium">{idx + 1}</span>
          <span className={`w-7 font-medium ${POSITION_COLORS[player.position] || "text-muted-foreground"}`}>
            {player.position || "--"}
          </span>
          <span className="flex-1 truncate font-medium">{player.player_name}</span>
          <span className="text-muted-foreground text-[11px] shrink-0">{player.team}</span>
          <span className="font-bold text-[hsl(var(--accent))] w-14 text-right shrink-0">
            {formatStatValue(statKey, player.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatLeadersSection() {
  const { data: leaders, isLoading, error } = useQuery<StatLeadersResponse>({
    queryKey: ["/api/nfl/stat-leaders"],
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-stat-leaders-loading">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            NFL Stat Leaders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !leaders) {
    return (
      <Card data-testid="card-stat-leaders-error">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            NFL Stat Leaders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Unable to load NFL stats at this time. Try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const categoryConfig = [
    { key: "receiving" as const, label: "Receiving", icon: Crosshair },
    { key: "rushing" as const, label: "Rushing", icon: Zap },
    { key: "passing" as const, label: "Passing", icon: Target },
    { key: "explosive" as const, label: "Big Plays", icon: Flame },
    { key: "efficiency" as const, label: "Efficiency", icon: TrendingUp },
    { key: "fantasy" as const, label: "Fantasy", icon: Trophy },
    { key: "redzone" as const, label: "Red Zone", icon: Gauge },
    { key: "advanced" as const, label: "Advanced", icon: Brain },
  ];

  return (
    <Card data-testid="card-stat-leaders">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            NFL Stat Leaders
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">{leaders.season} Season</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="receiving">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 py-1">
            {categoryConfig.map(cat => (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="text-xs gap-1"
                data-testid={`tab-leaders-${cat.key}`}
              >
                <cat.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{cat.label}</span>
                <span className="sm:hidden">{cat.label.slice(0, 4)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {categoryConfig.map(cat => {
            const categoryData = leaders.categories[cat.key];
            if (!categoryData) return null;
            const statKeys = Object.keys(categoryData);
            return (
              <TabsContent key={cat.key} value={cat.key} className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {statKeys.map(statKey => {
                    const statLeaders = categoryData[statKey];
                    if (!statLeaders || statLeaders.length === 0) return null;
                    return <LeaderboardTable key={statKey} statKey={statKey} leaders={statLeaders} />;
                  })}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    const url = window.location.origin;

    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        const shareData: ShareData = {
          title: "DT Sleeper Agent",
          text: "Check out DT Sleeper Agent - the ultimate fantasy football companion for Sleeper leagues!",
          url,
        };

        try {
          const response = await fetch("/icon-512.png");
          const blob = await response.blob();
          const file = new File([blob], "dt-sleeper-agent.png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        } catch {
          // Logo fetch failed, share without image
        }

        await navigator.share(shareData);
      } catch (err) {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast({ title: "Link Copied", description: "Website link copied to clipboard!" });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({ title: "Copy Failed", description: "Could not copy link.", variant: "destructive" });
      }
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="gap-1.5"
      data-testid="button-share-website"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
    </Button>
  );
}

// Strength bar component with glow effect - clickable to show players
function StrengthBar({ position, value, rank, total, onClick }: { position: string; value: number; rank: number; total: number; onClick?: () => void }) {
  const positionColors: Record<string, string> = {
    QB: "from-red-600 to-red-700",
    RB: "from-green-600 to-green-700",
    WR: "from-blue-600 to-blue-700",
    TE: "from-orange-500 to-orange-600",
  };

  const glowColors: Record<string, string> = {
    QB: "shadow-red-600/50",
    RB: "shadow-green-600/50",
    WR: "shadow-blue-600/50",
    TE: "shadow-orange-500/50",
  };

  const positionBorderColors: Record<string, string> = {
    QB: "border-red-600 text-red-500 dark:text-red-400",
    RB: "border-green-600 text-green-600 dark:text-green-400",
    WR: "border-blue-600 text-blue-600 dark:text-blue-400",
    TE: "border-orange-500 text-orange-600 dark:text-orange-400",
  };

  return (
    <div 
      className="space-y-1 cursor-pointer hover-elevate rounded-lg p-2 -mx-2 transition-colors" 
      onClick={onClick}
      data-testid={`strength-bar-${position}`}
    >
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium px-2 py-0.5 rounded border bg-transparent ${positionBorderColors[position]}`}>{position}</span>
        <span className="text-muted-foreground">#{rank} of {total}</span>
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

// Movement indicator component
function MovementIndicator({ rank, prevRank, isCurrentSeason }: { rank: number; prevRank?: number; isCurrentSeason?: boolean }) {
  // Only show movement for current season with verified previous rank data
  // prevRank must be defined, positive, and different from current rank
  if (!isCurrentSeason || prevRank === undefined || prevRank <= 0 || prevRank === rank) {
    return <span className="text-muted-foreground text-xs">--</span>;
  }
  
  const movement = prevRank - rank; // Positive = moved up, Negative = moved down
  const isUp = movement > 0;
  const Icon = isUp ? ArrowUp : ArrowDown;
  const colorClass = isUp ? "text-green-500" : "text-red-500";
  const spots = Math.abs(movement);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1 ${colorClass} text-xs font-medium cursor-help`}>
          <Icon className="h-3 w-3" />
          <span>{isUp ? "+" : "-"}{spots}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {isUp ? "Moved up" : "Moved down"} {spots} spot{spots !== 1 ? "s" : ""} from last week
        </p>
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
  
  // State for position player modal (must be at top level before any returns)
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

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

  // Fetch smart trade ideas
  const { data: tradeIdeasData, isLoading: tradeIdeasLoading } = useQuery<{ tradeIdeas: TradeIdea[] }>({
    queryKey: ["/api/fantasy/trade-ideas", leagueIdFromUrl],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/trade-ideas?leagueId=${leagueIdFromUrl}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch trade ideas");
      return res.json();
    },
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

  // Fetch roster data for position player modal
  const { data: rosterData, isLoading: rosterLoading } = useQuery<RosterResponse>({
    queryKey: ["/api/fantasy/roster", leagueIdFromUrl],
    queryFn: async () => {
      const res = await fetch(`/api/fantasy/roster?leagueId=${leagueIdFromUrl}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch roster");
      return res.json();
    },
    enabled: !!leagueIdFromUrl && leagueIdFromUrl !== "all",
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Target className="h-6 w-6" />
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Career Dashboard</h1>
            </div>
            <ShareButton />
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
              (() => {
                // Filter to only show current year (2026)
                const currentYear = new Date().getFullYear().toString();
                const currentYearLeagues = careerData.leagueStats.filter(league => league.season === currentYear);
                
                if (currentYearLeagues.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <p className="text-[hsl(var(--accent))]">No active leagues for {currentYear}</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-1">
                    {/* Table header - horizontal compact */}
                    <div className="hidden sm:grid sm:grid-cols-[1fr_70px_70px_80px_50px] gap-1 px-2 py-1 text-xs text-[hsl(var(--accent))]/80 font-medium border-b border-[hsl(var(--accent))]/20">
                      <div>League</div>
                      <div className="text-center">Record</div>
                      <div className="text-center">Place</div>
                      <div className="text-center">Status</div>
                      <div className="text-center">Move</div>
                    </div>
                    {currentYearLeagues.map((league, idx) => (
                      <div 
                        key={`${league.leagueId}-${league.season}`} 
                        className="grid grid-cols-[1fr_70px_70px_80px_50px] gap-1 items-center px-2 py-1.5 rounded bg-muted/30"
                        data-testid={`league-row-${idx}`}
                      >
                        {/* League name - horizontal */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          {league.isChampion && <Crown className="h-3.5 w-3.5 shrink-0 text-yellow-500" />}
                          {league.isRunnerUp && <Medal className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                          <p className="font-medium truncate text-sm text-[hsl(var(--accent))]" data-testid={`league-name-${idx}`}>
                            {league.leagueName}
                          </p>
                        </div>
                        
                        {/* Record */}
                        <div className="flex justify-center">
                          <span className="text-xs font-medium text-foreground" data-testid={`league-record-${idx}`}>
                            {league.wins}-{league.losses}{league.ties ? `-${league.ties}` : ""}
                          </span>
                        </div>
                        
                        {/* Place */}
                        <div className="flex justify-center">
                          <span className="text-xs font-medium text-foreground" data-testid={`league-rank-${idx}`}>
                            #{league.rank}/{league.totalTeams}
                          </span>
                        </div>
                        
                        {/* Status badges */}
                        <div className="flex justify-center flex-wrap">
                          {league.isChampion ? (
                            <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                              Champ
                            </Badge>
                          ) : league.isRunnerUp ? (
                            <span className="text-xs text-[hsl(var(--accent))]">2nd</span>
                          ) : league.isPlayoffs ? (
                            <span className="text-xs text-green-400">Playoffs</span>
                          ) : (
                            <span className="text-xs text-[hsl(var(--accent))]/60">--</span>
                          )}
                        </div>
                        
                        {/* Movement indicator */}
                        <div className="flex justify-center" data-testid={`league-movement-${idx}`}>
                          <MovementIndicator 
                            rank={league.rank} 
                            prevRank={league.prevRank}
                            isCurrentSeason={true}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : leagues && leagues.length > 0 ? (
              (() => {
                const currentYear = new Date().getFullYear().toString();
                const currentYearLeagues = leagues.filter((l: any) => l.season === currentYear);
                
                if (currentYearLeagues.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <p className="text-[hsl(var(--accent))]">No active leagues for {currentYear}</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-1">
                    {/* Table header - horizontal compact */}
                    <div className="hidden sm:grid sm:grid-cols-[1fr_70px_70px_80px_50px] gap-1 px-2 py-1 text-xs text-[hsl(var(--accent))]/80 font-medium border-b border-[hsl(var(--accent))]/20">
                      <div>League</div>
                      <div className="text-center">Record</div>
                      <div className="text-center">Teams</div>
                      <div className="text-center">Status</div>
                      <div className="text-center">Move</div>
                    </div>
                    {currentYearLeagues.map((league: any, idx: number) => (
                      <div 
                        key={league.league_id} 
                        className="grid grid-cols-[1fr_70px_70px_80px_50px] gap-1 items-center px-2 py-1.5 rounded bg-muted/30"
                        data-testid={`league-row-${idx}`}
                      >
                        <p className="font-medium truncate text-sm text-[hsl(var(--accent))]" data-testid={`league-name-${idx}`}>
                          {league.name}
                        </p>
                        <div className="flex justify-center">
                          <span className="text-xs text-foreground">--</span>
                        </div>
                        <div className="flex justify-center">
                          <span className="text-xs text-foreground" data-testid={`league-teams-${idx}`}>
                            {league.total_rosters}
                          </span>
                        </div>
                        <div className="flex justify-center">
                          <span className="text-xs text-[hsl(var(--accent))]/60">--</span>
                        </div>
                        <div className="flex justify-center">
                          <span className="text-xs text-[hsl(var(--accent))]/60">--</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-[hsl(var(--accent))]/50 mb-4" />
                <p className="text-[hsl(var(--accent))]" data-testid="text-no-leagues">
                  No leagues connected. Connect your Sleeper account to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <StatLeadersSection />
      </div>
    );
  }

  // SINGLE LEAGUE VIEW - Action-First Dashboard
  // Deduplicate recent activity by transactionId to avoid showing same transaction twice
  // Use id as fallback if transactionId is missing
  const recentActivity = (() => {
    const notifications = notificationsData?.notifications || [];
    const seen = new Set<string>();
    return notifications.filter(n => {
      const key = n.transactionId || n.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  })();

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
              dashboardData.playerCount === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Rosters not yet available for this season</p>
                  <p className="text-xs mt-1">Check back when the season starts</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Tap a position to see your players</p>
                  <StrengthBar 
                    position="QB" 
                    value={dashboardData.rosterStrength.QB} 
                    rank={dashboardData.positionRanks.QB?.rank || 0}
                    total={dashboardData.positionRanks.QB?.total || 0}
                    onClick={() => setSelectedPosition("QB")}
                  />
                  <StrengthBar 
                    position="RB" 
                    value={dashboardData.rosterStrength.RB} 
                    rank={dashboardData.positionRanks.RB?.rank || 0}
                    total={dashboardData.positionRanks.RB?.total || 0}
                    onClick={() => setSelectedPosition("RB")}
                  />
                  <StrengthBar 
                    position="WR" 
                    value={dashboardData.rosterStrength.WR} 
                    rank={dashboardData.positionRanks.WR?.rank || 0}
                    total={dashboardData.positionRanks.WR?.total || 0}
                    onClick={() => setSelectedPosition("WR")}
                  />
                  <StrengthBar 
                    position="TE" 
                    value={dashboardData.rosterStrength.TE} 
                    rank={dashboardData.positionRanks.TE?.rank || 0}
                    total={dashboardData.positionRanks.TE?.total || 0}
                    onClick={() => setSelectedPosition("TE")}
                  />
                </>
              )
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

      {/* Smart Trade Ideas */}
      <Card data-testid="card-trade-ideas">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Smart Trade Ideas</CardTitle>
            </div>
            <Link href={`/league/trade?id=${leagueIdFromUrl}`}>
              <Button size="sm" variant="ghost" data-testid="btn-view-trade-calc">
                Trade Calculator <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {tradeIdeasLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : tradeIdeasData?.tradeIdeas && tradeIdeasData.tradeIdeas.length > 0 ? (
            <div className="space-y-4">
              {tradeIdeasData.tradeIdeas.slice(0, 3).map((idea, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-2"
                  data-testid={`trade-idea-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={idea.tradePartner.avatar || undefined} alt={idea.tradePartner.name} />
                        <AvatarFallback className="text-[10px]">
                          {idea.tradePartner.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{idea.tradePartner.name}</span>
                    </div>
                    <Badge 
                      variant={idea.fairnessScore >= 70 ? "default" : idea.fairnessScore >= 50 ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {idea.fairnessScore >= 70 ? "Fair" : idea.fairnessScore >= 50 ? "Close" : "Reach"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">You give</p>
                      {idea.give.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          <Badge variant="outline" className="text-xs font-normal">
                            {p.pos}
                          </Badge>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-xs">({p.value})</span>
                        </span>
                      ))}
                    </div>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">You get</p>
                      {idea.get.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          <Badge variant="outline" className="text-xs font-normal">
                            {p.pos}
                          </Badge>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-xs">({p.value})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{idea.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <ArrowRightLeft className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No trade suggestions right now. Check back after more roster analysis.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Position Players Modal */}
      <Dialog open={!!selectedPosition} onOpenChange={(open) => !open && setSelectedPosition(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-white text-sm ${
                selectedPosition === "QB" ? "bg-red-500" :
                selectedPosition === "RB" ? "bg-green-500" :
                selectedPosition === "WR" ? "bg-blue-500" :
                "bg-yellow-500"
              }`}>
                {selectedPosition}
              </span>
              <span>Players</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              List of your {selectedPosition} players sorted by dynasty value
            </DialogDescription>
          </DialogHeader>
          
          {rosterLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {rosterData?.players
                ?.filter(p => p.position === selectedPosition)
                .sort((a, b) => b.dynastyValue - a.dynastyValue)
                .map((player, idx) => (
                  <div 
                    key={player.playerId} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`modal-player-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-5">{idx + 1}.</span>
                      <div>
                        <p className="font-medium text-sm">{player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.team} • Age {player.age}
                          {player.injuryStatus && <span className="ml-1 text-yellow-500">({player.injuryStatus})</span>}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {player.dynastyValue.toFixed(0)} DV
                    </Badge>
                  </div>
                ))}
              {rosterData?.players?.filter(p => p.position === selectedPosition).length === 0 && (
                <p className="text-center py-6 text-muted-foreground">
                  No {selectedPosition} players on your roster
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
