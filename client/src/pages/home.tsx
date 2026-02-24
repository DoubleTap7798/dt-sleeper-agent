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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Trophy, Users, TrendingUp, Calendar, Target, Crown, Medal, Activity, 
  ArrowRightLeft, UserPlus, RefreshCw, Zap, AlertTriangle, ChevronRight, ChevronDown,
  ArrowUpRight, ArrowUp, ArrowDown, Minus, Rocket, Shield, Hourglass, HelpCircle, Lightbulb, X,
  Share2, Copy, Check, Crosshair, Flame, BarChart3, Gauge, Brain, Bell,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SleeperLeague } from "@/lib/sleeper-types";

interface LeagueOverviewItem {
  leagueId: string;
  leagueName: string;
  leagueAvatar: string | null;
  leagueType: string;
  season: string;
  record: { wins: number; losses: number; ties: number };
  rank: number;
  totalTeams: number;
  pointsFor: number;
  upcomingMatchup: {
    week: number;
    opponentName: string;
    opponentAvatar: string | null;
    opponentRecord: string;
    userPoints: number;
    opponentPoints: number;
  } | null;
}

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
  adv_passing_yds: "QB Pass Yards",
  adv_passer_rating: "QB Passer Rating",
  adv_air_yds: "QB Air Yards",
  adv_air_per_att: "QB Air Yds/Att",
  adv_deep_20plus: "QB 20+ Yd Passes",
  adv_deep_30plus: "QB 30+ Yd Passes",
  adv_comp_pct: "QB Comp %",
  adv_ya: "QB Yards/Att",
  adv_sacks: "QB Sacks Taken",
  adv_knockdowns: "QB Knockdowns",
  adv_hurries: "QB Hurries",
  adv_poor_throws: "QB Poor Throws",
  adv_drops: "QB Drops (WR)",
  adv_pkt_time: "QB Pocket Time",
  adv_rz_att: "QB RZ Attempts",
  adv_wr_yds: "WR Rec Yards",
  adv_wr_yac: "WR YAC",
  adv_wr_yac_per_r: "WR YAC/Rec",
  adv_wr_air: "WR Air Yards",
  adv_wr_air_per_r: "WR Air Yds/Rec",
  adv_wr_tgt_share: "WR Tgt Share %",
  adv_wr_drops: "WR Drops",
  adv_wr_brktkl: "WR Broken Tackles",
  adv_wr_rz_tgt: "WR RZ Targets",
  adv_wr_deep_20plus: "WR 20+ Yd Catches",
  adv_rb_yds: "RB Rush Yards",
  adv_rb_ypc: "RB Yards/Carry",
  adv_rb_yacon: "RB YACon",
  adv_rb_yacon_per_att: "RB YACon/Att",
  adv_rb_brktkl: "RB Broken Tackles",
  adv_rb_att: "RB Attempts",
  adv_rb_rz_tgt: "RB RZ Targets",
  adv_rb_deep_20plus: "RB 20+ Yd Runs",
  adv_rb_lng: "RB Long Run",
  adv_rb_rec: "RB Receptions",
  adv_te_yds: "TE Rec Yards",
  adv_te_yac: "TE YAC",
  adv_te_yac_per_r: "TE YAC/Rec",
  adv_te_tgt_share: "TE Tgt Share %",
  adv_te_drops: "TE Drops",
  adv_te_brktkl: "TE Broken Tackles",
  adv_te_rz_tgt: "TE RZ Targets",
  adv_te_rec: "TE Receptions",
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
  if (["adv_wr_tgt_share", "adv_te_tgt_share"].includes(key)) {
    return value.toFixed(1) + "%";
  }
  if (["yards_per_carry", "wopr", "ppg_ppr", "rz_fpts_per_game", "adv_air_per_att", "adv_ya", "adv_pkt_time", "rz_rb_ya", "rz_wr_fpts_per_game", "rz_rb_fpts_per_game", "rz_te_fpts_per_game", "adv_wr_yac_per_r", "adv_wr_air_per_r", "adv_rb_ypc", "adv_rb_yacon_per_att", "adv_te_yac_per_r"].includes(key)) {
    return value.toFixed(1);
  }
  if (["receiving_yards", "rushing_yards", "passing_yards", "fantasy_points_ppr", "adv_passing_yds", "adv_air_yds", "rz_fpts", "rz_wr_fpts", "rz_rb_fpts", "rz_te_fpts", "adv_wr_yds", "adv_wr_yac", "adv_wr_air", "adv_rb_yds", "adv_rb_yacon", "adv_te_yds", "adv_te_yac"].includes(key)) {
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

const POSITION_FILTERS = ["All", "QB", "WR", "RB", "TE"] as const;

function getPositionKeyFilter(categoryKey: string, position: string): (key: string) => boolean {
  if (position === "All") return () => true;
  if (categoryKey === "redzone") {
    if (position === "QB") return (k: string) => k.startsWith("rz_") && !k.startsWith("rz_wr_") && !k.startsWith("rz_rb_") && !k.startsWith("rz_te_");
    if (position === "WR") return (k: string) => k.startsWith("rz_wr_");
    if (position === "RB") return (k: string) => k.startsWith("rz_rb_");
    if (position === "TE") return (k: string) => k.startsWith("rz_te_");
  }
  if (categoryKey === "advanced") {
    if (position === "QB") return (k: string) => k.startsWith("adv_") && !k.startsWith("adv_wr_") && !k.startsWith("adv_rb_") && !k.startsWith("adv_te_");
    if (position === "WR") return (k: string) => k.startsWith("adv_wr_");
    if (position === "RB") return (k: string) => k.startsWith("adv_rb_");
    if (position === "TE") return (k: string) => k.startsWith("adv_te_");
  }
  return () => true;
}

function PositionFilteredLeaderboards({ categoryKey, categoryData }: { categoryKey: string; categoryData: Record<string, StatLeader[]> }) {
  const [activePosition, setActivePosition] = useState("All");
  const filterFn = getPositionKeyFilter(categoryKey, activePosition);
  const filteredKeys = Object.keys(categoryData).filter(filterFn);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap" data-testid={`position-filters-${categoryKey}`}>
        {POSITION_FILTERS.map(pos => (
          <Button
            key={pos}
            size="sm"
            variant={activePosition === pos ? "default" : "outline"}
            onClick={() => setActivePosition(pos)}
            data-testid={`filter-${categoryKey}-${pos.toLowerCase()}`}
          >
            {pos}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredKeys.map(statKey => {
          const statLeaders = categoryData[statKey];
          if (!statLeaders || statLeaders.length === 0) return null;
          return <LeaderboardTable key={statKey} statKey={statKey} leaders={statLeaders} />;
        })}
      </div>
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
            const hasPositionGroups = cat.key === "redzone" || cat.key === "advanced";
            if (hasPositionGroups) {
              return (
                <TabsContent key={cat.key} value={cat.key} className="mt-4">
                  <PositionFilteredLeaderboards categoryKey={cat.key} categoryData={categoryData} />
                </TabsContent>
              );
            }
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
          className={`h-full bg-gradient-to-r ${positionColors[position]} rounded-full transition-all duration-500 shadow-lg ${value >= 8000 ? glowColors[position] : ""}`}
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
  const [leagueSort, setLeagueSort] = useState<string>("rank");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const { data: leagues = [] } = useQuery<SleeperLeague[]>({
    queryKey: ["/api/sleeper/leagues"],
  });

  const selectedLeague = leagues.find((l) => l.league_id === leagueIdFromUrl) || null;

  // Fetch career stats for All Leagues view
  const { data: careerData, isLoading: careerLoading } = useQuery<CareerSummary>({
    queryKey: ["/api/fantasy/summary"],
    enabled: isAllLeagues,
  });

  // Fetch league overview data (upcoming matchups, rankings) for All Leagues view
  const { data: leaguesOverview = [], isLoading: overviewLoading } = useQuery<LeagueOverviewItem[]>({
    queryKey: ["/api/sleeper/leagues-overview"],
    enabled: isAllLeagues,
    staleTime: 1000 * 60 * 5,
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
      <div className="space-y-6 min-w-0 overflow-x-hidden">
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
          <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-transparent" data-testid="card-total-leagues">
            <CardContent className="py-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 mb-1">Career Seasons</p>
              <div className="text-2xl font-bold text-gradient-gold" data-testid="stat-total-leagues">
                {careerData?.totalSeasons || careerData?.leagueStats?.length || 0}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{careerData?.totalLeagues || leagues?.length || 0} active leagues</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-transparent" data-testid="card-record">
            <CardContent className="py-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 mb-1">Overall Record</p>
              <div className="text-2xl font-bold" data-testid="stat-record">
                {careerData?.totalWins || 0}-{careerData?.totalLosses || 0}
                {careerData?.totalTies ? `-${careerData.totalTies}` : ""}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs font-medium ${Number(winRate) >= 60 ? "text-green-400" : Number(winRate) >= 45 ? "text-muted-foreground" : "text-red-400"}`}>
                  {winRate}%
                </span>
                <span className="text-[10px] text-muted-foreground">win rate</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-transparent" data-testid="card-championships">
            <CardContent className="py-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 mb-1">Championships</p>
              <div className="text-2xl font-bold text-gradient-gold" data-testid="stat-championships">
                {careerData?.championships || 0}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {careerData?.runnerUps ? `${careerData.runnerUps} runner-ups` : "Titles won"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-transparent" data-testid="card-playoffs">
            <CardContent className="py-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 mb-1">Playoff Apps</p>
              <div className="text-2xl font-bold" data-testid="stat-playoffs">
                {careerData?.playoffAppearances || 0}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Total appearances</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6" data-testid="all-leagues-content">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Leagues
                </h2>
                {leaguesOverview.length > 1 && (
                  <Select value={leagueSort} onValueChange={setLeagueSort}>
                    <SelectTrigger className="w-[140px]" data-testid="select-league-sort">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rank">Best Rank</SelectItem>
                      <SelectItem value="record">Best Record</SelectItem>
                      <SelectItem value="points">Most Points</SelectItem>
                      <SelectItem value="name">Name A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              {overviewLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3].map(i => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : leaguesOverview.length > 0 ? (
                <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 min-w-0" data-testid="leagues-overview-grid">
                  {[...leaguesOverview].sort((a, b) => {
                    switch (leagueSort) {
                      case "record": {
                        const aWinPct = (a.record.wins + a.record.losses) > 0 ? a.record.wins / (a.record.wins + a.record.losses) : 0;
                        const bWinPct = (b.record.wins + b.record.losses) > 0 ? b.record.wins / (b.record.wins + b.record.losses) : 0;
                        return bWinPct - aWinPct;
                      }
                      case "points": return b.pointsFor - a.pointsFor;
                      case "name": return a.leagueName.localeCompare(b.leagueName);
                      case "rank": default: return a.rank - b.rank;
                    }
                  }).map((lo, idx) => (
                      <Card
                        key={lo.leagueId}
                        className="hover-elevate cursor-pointer transition-colors overflow-hidden min-w-0"
                        data-testid={`card-league-overview-${idx}`}
                      >
                        <Link href={`/league?id=${lo.leagueId}`}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                                <AvatarImage src={lo.leagueAvatar || undefined} />
                                <AvatarFallback className="text-[10px] sm:text-xs font-bold">
                                  {lo.leagueName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate" data-testid={`text-league-name-${idx}`}>
                                  {lo.leagueName}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="secondary" className="text-[10px]">{lo.leagueType}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{lo.season}</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2">
                            <div className="text-center py-1.5 px-1 rounded bg-muted/50">
                              <p className="text-[10px] text-muted-foreground">Record</p>
                              <p className="font-bold text-xs sm:text-sm" data-testid={`text-league-record-${idx}`}>
                                {lo.record.wins}-{lo.record.losses}{lo.record.ties ? `-${lo.record.ties}` : ""}
                              </p>
                            </div>
                            <div className="text-center py-1.5 px-1 rounded bg-muted/50">
                              <p className="text-[10px] text-muted-foreground">Rank</p>
                              <p className="font-bold text-xs sm:text-sm" data-testid={`text-league-rank-${idx}`}>
                                #{lo.rank}<span className="text-muted-foreground font-normal">/{lo.totalTeams}</span>
                              </p>
                            </div>
                            <div className="text-center py-1.5 px-1 rounded bg-muted/50">
                              <p className="text-[10px] text-muted-foreground">Points</p>
                              <p className="font-bold text-xs sm:text-sm" data-testid={`text-league-pts-${idx}`}>
                                {lo.pointsFor > 0 ? lo.pointsFor.toFixed(1) : "--"}
                              </p>
                            </div>
                          </div>

                          {lo.upcomingMatchup ? (
                            <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded bg-muted/30 border border-border/50" data-testid={`matchup-preview-${idx}`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground mb-0.5">
                                  Wk {lo.upcomingMatchup.week}
                                </p>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] sm:text-xs font-medium">vs</span>
                                  <Avatar className="h-4 w-4 sm:h-5 sm:w-5 shrink-0">
                                    <AvatarImage src={lo.upcomingMatchup.opponentAvatar || undefined} />
                                    <AvatarFallback className="text-[7px] sm:text-[8px]">
                                      {lo.upcomingMatchup.opponentName.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[10px] sm:text-xs font-medium truncate">{lo.upcomingMatchup.opponentName}</span>
                                </div>
                              </div>
                              {(lo.upcomingMatchup.userPoints > 0 || lo.upcomingMatchup.opponentPoints > 0) && (
                                <div className="text-right shrink-0">
                                  <p className="text-[10px] sm:text-xs font-bold">
                                    {lo.upcomingMatchup.userPoints.toFixed(1)} - {lo.upcomingMatchup.opponentPoints.toFixed(1)}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded bg-muted/30 border border-border/50">
                              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                              <span className="text-[10px] sm:text-xs text-muted-foreground">No upcoming matchup</span>
                            </div>
                          )}
                        </CardContent>
                        </Link>

                        <div className="flex items-center gap-1 px-3 pb-2 sm:px-4 sm:pb-3 flex-wrap border-t border-border/20 pt-1.5" data-testid={`league-actions-${idx}`}>
                          <Link href={`/league/roster?id=${lo.leagueId}`}>
                            <Button variant="ghost" size="sm" className="text-[10px] sm:text-[11px] gap-0.5 sm:gap-1" data-testid={`link-roster-${idx}`}>
                              <Users className="h-3 w-3" />
                              Roster
                            </Button>
                          </Link>
                          <Link href={`/league/matchups?id=${lo.leagueId}`}>
                            <Button variant="ghost" size="sm" className="text-[10px] sm:text-[11px] gap-0.5 sm:gap-1" data-testid={`link-matchups-${idx}`}>
                              <Target className="h-3 w-3" />
                              Matchups
                            </Button>
                          </Link>
                          <Link href={`/league/standings?id=${lo.leagueId}`}>
                            <Button variant="ghost" size="sm" className="text-[10px] sm:text-[11px] gap-0.5 sm:gap-1" data-testid={`link-standings-${idx}`}>
                              <BarChart3 className="h-3 w-3" />
                              Standings
                            </Button>
                          </Link>
                        </div>
                      </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground" data-testid="text-no-leagues">
                        No leagues found. Connect your Sleeper account to get started.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <StatLeadersSection />
        </div>
      </div>
    );
  }

  // SINGLE LEAGUE VIEW - Quant Trading Terminal Dashboard
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

  const topRec = dashboardData?.recommendations?.[0];

  const parseInsightBullets = (blurb: string): string[] => {
    if (!blurb) return [];
    const sentences = blurb.split(/\.\s+/).filter(s => s.trim().length > 5);
    return sentences.slice(0, 4).map(s => s.endsWith(".") ? s : s + ".");
  };

  const insightBullets = parseInsightBullets(dashboardData?.weeklyBlurb || "");

  const getImpactLabel = (priority: string) => {
    const config: Record<string, { label: string; color: string }> = {
      high: { label: "HIGH", color: "bg-red-500/20 text-red-400 border-red-500/40" },
      medium: { label: "MED", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
      low: { label: "LOW", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
    };
    return config[priority] || config.medium;
  };

  return (
    <div className="space-y-10">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-1 ring-primary/15">
            <AvatarImage 
              src={selectedLeague?.avatar ? `https://sleepercdn.com/avatars/${selectedLeague.avatar}` : undefined}
              alt={selectedLeague?.name || "League"}
            />
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {(selectedLeague?.name || leagueData?.leagueName || "L").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-lg font-bold tracking-tight" data-testid="text-page-title">
              {selectedLeague?.name || leagueData?.leagueName || "Command Center"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedLeague?.season} Season
            </p>
          </div>
        </div>
        {dashboardData && (
          <TeamProfileBadge profile={dashboardData.teamProfile} avgAge={dashboardData.avgAge} />
        )}
      </div>

      {/* 1. TOP POWER STRIP - 4 Signal Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Win Probability */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-[0_0_20px_rgba(217,169,78,0.08)]" data-testid="card-win-probability">
          <CardContent className="py-5 px-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 mb-2">Win Probability</p>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-bold ${Number(winRate) >= 60 ? "text-green-400" : Number(winRate) >= 45 ? "text-foreground" : "text-red-400"}`} data-testid="stat-win-prob">
                {winRate}%
              </span>
              {Number(winRate) >= 50 ? (
                <ArrowUp className="h-4 w-4 text-green-400 mb-1" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-400 mb-1" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {leagueData?.totalWins || 0}W-{leagueData?.totalLosses || 0}L
            </p>
          </CardContent>
        </Card>

        {/* Playoff Odds */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-[0_0_20px_rgba(217,169,78,0.08)]" data-testid="card-playoff-odds">
          <CardContent className="py-5 px-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 mb-2">Playoff Odds</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gradient-gold" data-testid="stat-playoff-odds">
                {leagueData?.playoffAppearances || 0}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {leagueData?.totalSeasons || 1} seasons tracked
            </p>
          </CardContent>
        </Card>

        {/* Championship Equity - HERO card */}
        <Card className="border-primary/40 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent shadow-[0_0_32px_rgba(217,169,78,0.15)] lg:col-span-1 relative overflow-hidden" data-testid="card-championship-equity">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
          <CardContent className="py-5 px-4 relative">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">Championship Equity</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gradient-gold" data-testid="stat-championships">
                {leagueData?.championships || 0}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {leagueData?.runnerUps ? `${leagueData.runnerUps} runner-up finishes` : "Career titles"}
            </p>
            <Link href={`/league/decision-engine?tab=equity&id=${leagueIdFromUrl}`}>
              <Button size="sm" variant="ghost" className="mt-2 gap-1 text-xs text-primary/80 -ml-2" data-testid="btn-view-equity">
                View Tracker <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Team Risk Index */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-[0_0_20px_rgba(217,169,78,0.08)]" data-testid="card-risk-index">
          <CardContent className="py-5 px-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Gauge className="h-3.5 w-3.5 text-primary/60" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">Risk Index</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold capitalize" data-testid="stat-team-profile">
                {dashboardData?.teamProfile || "—"}
              </span>
            </div>
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  dashboardData?.teamProfile === "contender" ? "bg-green-500 w-[85%]" :
                  dashboardData?.teamProfile === "balanced" ? "bg-yellow-500 w-[50%]" :
                  "bg-purple-500 w-[25%]"
                }`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">{dashboardData?.playerCount || 0} rostered</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. STRATEGIC STATUS GRID - 2x2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* A. Roster Strength Breakdown */}
        <Card data-testid="card-roster-strength">
          <CardContent className="py-5 px-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary/70" />
                <span className="text-sm font-semibold">Roster Strength</span>
              </div>
              <Badge variant="outline" className="text-[10px]">{dashboardData?.playerCount || 0} players</Badge>
            </div>
            {dashboardData && dashboardData.playerCount > 0 ? (
              <div className="space-y-3">
                {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
                  <StrengthBar 
                    key={pos}
                    position={pos} 
                    value={dashboardData.rosterStrength[pos]} 
                    rank={dashboardData.positionRanks[pos]?.rank || 0}
                    total={dashboardData.positionRanks[pos]?.total || 0}
                    onClick={() => setSelectedPosition(pos)}
                  />
                ))}
                {dashboardData.biggestNeed && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    <span className="text-xs text-muted-foreground">{dashboardData.biggestNeed.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-7 w-7 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Rosters not yet available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* B. Market Position */}
        <Card data-testid="card-market-position">
          <CardContent className="py-5 px-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRightLeft className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-semibold">Market Position</span>
            </div>
            {tradeIdeasLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : tradeIdeasData?.tradeIdeas && tradeIdeasData.tradeIdeas.length > 0 ? (
              <div className="space-y-3">
                {tradeIdeasData.tradeIdeas.slice(0, 2).map((idea, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border/30 bg-muted/20 space-y-1.5" data-testid={`trade-idea-${idx}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={idea.tradePartner.avatar || undefined} />
                          <AvatarFallback className="text-[8px]">{idea.tradePartner.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{idea.tradePartner.name}</span>
                      </div>
                      <Badge variant={idea.fairnessScore >= 70 ? "default" : "outline"} className="text-[10px]">
                        {idea.fairnessScore}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-red-400">{idea.give.map(p => p.name).join(", ")}</span>
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-green-400">{idea.get.map(p => p.name).join(", ")}</span>
                    </div>
                  </div>
                ))}
                <Link href={`/league/trade?id=${leagueIdFromUrl}`}>
                  <Button size="sm" variant="ghost" className="w-full text-xs gap-1" data-testid="btn-view-trade-calc">
                    View All Ideas <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <ArrowRightLeft className="h-7 w-7 mx-auto text-muted-foreground mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">No trade signals detected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* C. Trend & Momentum */}
        <Card data-testid="card-trend-momentum">
          <CardContent className="py-5 px-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-semibold">Trend & Momentum</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Championships</span>
                <span className="text-sm font-bold text-gradient-gold">{leagueData?.championships || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Best Finish</span>
                <span className="text-sm font-medium">{leagueData?.bestFinish || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Playoff Rate</span>
                <span className={`text-sm font-medium ${
                  leagueData && leagueData.totalSeasons > 0 && (leagueData.playoffAppearances / leagueData.totalSeasons) >= 0.6 
                    ? "text-green-400" : "text-muted-foreground"
                }`}>
                  {leagueData && leagueData.totalSeasons > 0 
                    ? `${((leagueData.playoffAppearances / leagueData.totalSeasons) * 100).toFixed(0)}%` 
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Win Rate</span>
                <span className={`text-sm font-medium ${Number(winRate) >= 60 ? "text-green-400" : Number(winRate) < 45 ? "text-red-400" : "text-muted-foreground"}`}>
                  {winRate}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* D. League Edge Snapshot */}
        <Card data-testid="card-league-edge">
          <CardContent className="py-5 px-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-semibold">League Edge</span>
            </div>
            <div className="space-y-3">
              {dashboardData?.biggestNeed ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Weakness: {dashboardData.biggestNeed.position}</p>
                    <p className="text-[11px] text-muted-foreground">#{dashboardData.biggestNeed.rank} of {dashboardData.positionRanks[dashboardData.biggestNeed.position]?.total || "?"}</p>
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-2">
                <Shield className="h-3.5 w-3.5 text-primary/60 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Team Profile</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{dashboardData?.teamProfile || "Unknown"} • Avg age {dashboardData?.avgAge || "—"}</p>
                </div>
              </div>
              <Link href={`/league/decision-engine?tab=exploit&id=${leagueIdFromUrl}`}>
                <Button size="sm" variant="ghost" className="w-full text-xs gap-1 mt-1" data-testid="btn-exploit-report">
                  Exploit Report <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. RECOMMENDED ACTION PANEL - Full Width */}
      {topRec && (
        <Card className="border-primary/25 bg-gradient-to-r from-primary/8 via-primary/3 to-transparent" data-testid="card-recommended-action">
          <CardContent className="py-6 px-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">Recommended Action</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ml-auto ${getImpactLabel(topRec.priority).color}`} data-testid="badge-impact">
                {getImpactLabel(topRec.priority).label} IMPACT
              </Badge>
            </div>
            <h3 className="text-base font-bold mb-2" data-testid="text-top-action-title">{topRec.title}</h3>
            <ul className="space-y-1.5 mb-4">
              {topRec.description.split(/\.\s+/).filter(s => s.trim().length > 3).slice(0, 3).map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-primary/50 mt-0.5">•</span>
                  <span>{bullet.endsWith(".") ? bullet : bullet + "."}</span>
                </li>
              ))}
            </ul>
            {topRec.action && (
              <Link href={topRec.action}>
                <Button size="sm" className="gap-1.5 bg-primary/15 text-primary border border-primary/30" data-testid="btn-top-action">
                  Take Action <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Recommendations - Bullet Format */}
      {dashboardData?.recommendations && dashboardData.recommendations.length > 1 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dashboardData.recommendations.slice(1).map((rec, idx) => {
            const impact = getImpactLabel(rec.priority);
            return (
              <Card key={idx} className="border-border/30" data-testid={`card-rec-${idx + 1}`}>
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">{rec.title}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${impact.color}`}>
                      {impact.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.description}</p>
                  {rec.action && (
                    <Link href={rec.action}>
                      <Button size="sm" variant="ghost" className="text-xs gap-1 mt-2 -ml-2 text-primary/70" data-testid={`btn-rec-${idx + 1}`}>
                        Go <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 4. AI INSIGHT - Structured Bullets */}
      {insightBullets.length > 0 && (
        <Card className="border-border/30" data-testid="card-ai-insight">
          <CardContent className="py-5 px-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-primary/70" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">AI Signals</span>
            </div>
            <ul className="space-y-2">
              {insightBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                  <span className="text-primary/40 mt-0.5 shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 5. ALERTS & SIGNALS - Collapsible */}
      <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
        <Card className="border-border/20" data-testid="card-alerts-signals">
          <CollapsibleTrigger asChild>
            <CardContent className="py-4 px-5 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary/60" />
                  <span className="text-sm font-semibold">Alerts & Signals</span>
                  {recentActivity.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">{recentActivity.length}</Badge>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${alertsOpen ? "rotate-180" : ""}`} />
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-5">
              {isLoadingActivity ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((activity, idx) => (
                    <div 
                      key={activity.id} 
                      className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30"
                      data-testid={`activity-row-${idx}`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {activity.type === "trade" ? (
                          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : activity.type === "waiver" ? (
                          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium" data-testid={`activity-message-${idx}`}>{activity.message}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(activity.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0 capitalize">{activity.type.replace("_", " ")}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No recent alerts</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Team Takeover (collapsed by default) */}
      <Collapsible>
        <Card className="border-border/20" data-testid="card-team-takeover">
          <CollapsibleTrigger asChild>
            <CardContent className="py-4 px-5 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Team Takeover</span>
                  {leagueData?.takeoverSeason && (
                    <Badge variant="outline" className="text-[10px]">From {leagueData.takeoverSeason}</Badge>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-5">
              <p className="text-xs text-muted-foreground mb-3">
                Took over an orphan team? Set your start date to exclude previous owner stats.
              </p>
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
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
                      {player.dynastyValue.toLocaleString()} DV
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
