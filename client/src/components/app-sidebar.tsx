import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link, useSearch } from "wouter";
import { LeagueSettingsDialog } from "./league-settings-dialog";
import {
  Home,
  RefreshCw,
  History,
  Trophy,
  Users,
  LogOut,
  ChevronDown,
  ChevronRight,
  Swords,
  Gamepad2,
  CalendarDays,
  GraduationCap,
  GitBranch,
  UserCircle,
  Newspaper,
  Shield,
  Activity,
  GitCompare,
  Target,
  BarChart3,
  Settings,
  Layers,
  LayoutDashboard,
  UserCog,
  TrendingUp,
  Search,
  Eye,
  Crown,
  Sparkles,
  Bot,
  Zap,
  Clock,
  ShieldAlert,
  Share2,
  Briefcase,
  Flame,
  Heart,
  ArrowLeftRight,
  MessageSquare,
  Gauge,
  Map as MapIcon,
  ListChecks,
  Brain,
  DollarSign,
  Bell,
  Radio,
  Award,
  Cpu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Logo } from "./logo";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import type { SleeperLeague } from "@/lib/sleeper-types";

interface AppSidebarProps {
  leagues: SleeperLeague[];
  selectedLeague: SleeperLeague | null;
  isAllLeagues: boolean;
  onLeagueChange: (league: SleeperLeague | null) => void;
}

interface NavItem {
  title: string;
  url: string;
  icon: any;
  description?: string;
  requiresLeague?: boolean;
  allLeaguesOnly?: boolean;
  premium?: boolean;
  subgroup?: string;
}

interface NavGroup {
  title: string;
  icon: any;
  items: NavItem[];
  requiresLeague?: boolean;
  isDevy?: boolean;
  subgroups?: string[];
}

const navigationGroups: NavGroup[] = [
  {
    title: "Command Center",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", url: "/league", icon: LayoutDashboard, description: "Home & overview" },
      { title: "League Overview", url: "/league/standings", icon: BarChart3, requiresLeague: true },
      { title: "Roster", url: "/league/roster", icon: Users, requiresLeague: true },
      { title: "Title Equity", url: "/league/decision-engine?tab=equity", icon: TrendingUp, requiresLeague: true, premium: true, description: "Championship odds tracker" },
      { title: "Manager Profile", url: "/league/manager-profile", icon: Brain, requiresLeague: true },
      { title: "AI Assistant", url: "/league/ai-chat", icon: Bot, premium: true, description: "AI fantasy advisor" },
      { title: "Power Rankings", url: "/league/power-rankings", icon: Zap, requiresLeague: true },
      { title: "Activity Feed", url: "/league/activity", icon: Activity },
      { title: "Trophy Room", url: "/league/trophies", icon: Trophy, requiresLeague: true },
      { title: "Leaderboard", url: "/leaderboard", icon: Crown },
      { title: "NFL", url: "/league/nfl", icon: Shield },
    ],
  },
  {
    title: "Game Day Engine",
    icon: Cpu,
    requiresLeague: true,
    items: [
      { title: "Matchup Simulator", url: "/league/matchups", icon: Gamepad2, requiresLeague: true },
      { title: "Lineup Lab", url: "/league/lineup-lab", icon: Zap, requiresLeague: true, premium: true, description: "Optimizer, advice, boom/bust & predictions" },
      { title: "Matchup Heat Map", url: "/league/matchup-heatmap", icon: MapIcon, requiresLeague: true, premium: true },
      { title: "Game Context", url: "/league/game-context", icon: CalendarDays, requiresLeague: true, description: "Schedule & injuries" },
    ],
  },
  {
    title: "Market & Trades",
    icon: ArrowLeftRight,
    subgroups: ["Trade Lab", "Market Intel", "Waivers"],
    items: [
      { title: "Trade Lab", url: "/league/trade-lab", icon: ArrowLeftRight, requiresLeague: true, premium: true, subgroup: "Trade Lab", description: "Value check, impact sim & AI strategy" },
      { title: "Trade History", url: "/league/history", icon: History, requiresLeague: true, premium: true, subgroup: "Trade Lab" },
      { title: "Market Terminal", url: "/league/market-psychology", icon: Brain, premium: true, subgroup: "Market Intel", description: "Volatility, arbitrage & market structure" },
      { title: "Player Trends", url: "/league/trends", icon: Activity, premium: true, subgroup: "Market Intel" },
      { title: "ROS Projections", url: "/league/projections", icon: TrendingUp, requiresLeague: true, premium: true, subgroup: "Market Intel" },
      { title: "Depth Charts", url: "/league/depth-chart", icon: Layers, subgroup: "Market Intel" },
      { title: "Stat Leaders", url: "/league/stat-leaders", icon: BarChart3, subgroup: "Market Intel" },
      { title: "Compare", url: "/league/compare", icon: GitCompare, premium: true, subgroup: "Market Intel" },
      { title: "Waiver Wire", url: "/league/waivers", icon: UserCog, requiresLeague: true, premium: true, subgroup: "Waivers" },
      { title: "Watchlist", url: "/league/watchlist", icon: Eye, premium: true, subgroup: "Waivers" },
      { title: "NFL Players", url: "/league/players", icon: UserCircle, subgroup: "Market Intel" },
    ],
  },
  {
    title: "Season Strategy",
    icon: Trophy,
    requiresLeague: true,
    subgroups: ["Title Strategy", "Risk & Capital", "League Edge"],
    items: [
      { title: "Championship Path", url: "/league/decision-engine?tab=championship", icon: Trophy, requiresLeague: true, premium: true, subgroup: "Title Strategy", description: "Path to the title" },
      { title: "Season Projections", url: "/league/season-projections", icon: TrendingUp, requiresLeague: true, premium: true, subgroup: "Title Strategy" },
      { title: "Playoff Bracket", url: "/league/bracket", icon: GitBranch, requiresLeague: true, subgroup: "Title Strategy" },
      { title: "Portfolio Risk", url: "/league/decision-engine?tab=portfolio", icon: ShieldAlert, requiresLeague: true, premium: true, subgroup: "Risk & Capital" },
      { title: "FAAB Optimizer", url: "/league/decision-engine?tab=faab", icon: DollarSign, requiresLeague: true, premium: true, subgroup: "Risk & Capital" },
      { title: "Taxi Optimizer", url: "/league/taxi-optimizer", icon: ListChecks, requiresLeague: true, premium: true, subgroup: "Risk & Capital" },
      { title: "Exploit Report", url: "/league/decision-engine?tab=exploit", icon: Target, requiresLeague: true, premium: true, subgroup: "League Edge" },
      { title: "Rivalries", url: "/league/rivalries", icon: Swords, requiresLeague: true, subgroup: "League Edge" },
      { title: "Mid-Season Review", url: "/league/mid-season-review", icon: Gauge, requiresLeague: true, premium: true, subgroup: "League Edge" },
      { title: "Usage Trends", url: "/league/usage-trends", icon: Activity, requiresLeague: true, premium: true, subgroup: "League Edge" },
      { title: "Team Report", url: "/league/team-report", icon: Share2, requiresLeague: true, premium: true, subgroup: "League Edge" },
    ],
  },
];

const devyGroup: NavGroup = {
  title: "Devy Command Center",
  icon: GraduationCap,
  isDevy: true,
  items: [
    { title: "Rankings", url: "/league/devy/rankings", icon: Layers, premium: true },
    { title: "My Portfolio", url: "/league/devy/portfolio", icon: Briefcase, premium: true },
    { title: "Market Intel", url: "/league/devy/market", icon: Flame, premium: true },
    { title: "College Stats", url: "/league/devy/college-stats", icon: BarChart3, premium: true },
    { title: "Transfer Portal", url: "/league/devy/transfer-portal", icon: ArrowLeftRight, premium: true },
  ],
};

const draftGroup: NavGroup = {
  title: "Draft Central",
  icon: Target,
  items: [
    { title: "2026 Draft Board", url: "/league/draft-board", icon: Target, premium: true },
    { title: "Draft Command Center", url: "/league/live-draft", icon: Radio, requiresLeague: true, premium: true },
    { title: "Draft Recap", url: "/league/draft-recap", icon: Award, requiresLeague: true, premium: true },
    { title: "Pick Values", url: "/league/draft-pick-values", icon: TrendingUp },
  ],
};

const socialItems: NavItem[] = [
  { title: "Trash Talk", url: "/league/trash-talk", icon: MessageSquare, premium: true, requiresLeague: true },
  { title: "Community Chat", url: "/chat", icon: MessageSquare },
];

const settingsToolsItems: NavItem[] = [
  { title: "Accounting", url: "/league/accounting", icon: DollarSign, requiresLeague: true },
  { title: "Accounting", url: "/accounting", icon: DollarSign, allLeaguesOnly: true },
  { title: "League Info", url: "/league/info", icon: Settings, requiresLeague: true },
  { title: "History", url: "/league/timeline", icon: Clock, requiresLeague: true },
  { title: "Notifications", url: "/settings/notifications", icon: Bell },
];

export function AppSidebar({ leagues, selectedLeague, isAllLeagues, onLeagueChange }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, logout } = useAuth();
  const { isPremium, isGrandfathered, isLoading: subLoading } = useSubscription();
  
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["Command Center"]));
  const [userClosedGroups, setUserClosedGroups] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: leagueSettingsData } = useQuery<{ devyEnabled: boolean }>({
    queryKey: ["/api/league-settings", selectedLeague?.league_id],
    enabled: !!selectedLeague?.league_id,
  });

  const devyEnabled = leagueSettingsData?.devyEnabled !== false;
  
  const urlParams = new URLSearchParams(searchString);
  const leagueId = isAllLeagues ? null : (urlParams.get("id") || selectedLeague?.league_id);

  const toggleGroup = (groupTitle: string, isOpen: boolean) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (isOpen) {
        next.add(groupTitle);
      } else {
        next.delete(groupTitle);
      }
      return next;
    });
    setUserClosedGroups(prev => {
      const next = new Set(prev);
      if (!isOpen) {
        next.add(groupTitle);
      } else {
        next.delete(groupTitle);
      }
      return next;
    });
  };

  const isItemActive = (itemUrl: string) => {
    return location === itemUrl || location.startsWith(itemUrl + "/");
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  const allGroups = [
    ...navigationGroups,
    draftGroup,
    ...(devyEnabled ? [devyGroup] : []),
  ];

  const visibleGroups = allGroups.filter(group => 
    !group.requiresLeague || !isAllLeagues
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border/50">
        <Logo size="md" showText={true} />
      </SidebarHeader>

      <SidebarContent>
        {/* League Selector */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs uppercase tracking-wider text-sidebar-foreground/60">
            Select League
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 justify-between bg-sidebar-accent border-sidebar-border text-sidebar-foreground"
                  data-testid="button-league-selector"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {!isAllLeagues && selectedLeague && (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage 
                          src={selectedLeague.avatar ? `https://sleepercdn.com/avatars/${selectedLeague.avatar}` : undefined} 
                          alt={selectedLeague.name}
                        />
                        <AvatarFallback className="text-xs">
                          {selectedLeague.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="truncate">
                      {isAllLeagues ? "All Leagues" : (selectedLeague?.name || "Select a league")}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] max-h-[70vh] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => onLeagueChange(null)}
                  className="cursor-pointer font-medium"
                  data-testid="menu-item-all-leagues"
                >
                  <span>All Leagues</span>
                  <span className="ml-auto text-xs text-muted-foreground">Career Stats</span>
                </DropdownMenuItem>
                {(() => {
                  const grouped = new Map<string, Map<string, typeof leagues>>();
                  leagues.forEach((league) => {
                    const commish = league.commissioner_name || "Unknown";
                    const type = league.league_type || "Redraft";
                    if (!grouped.has(commish)) grouped.set(commish, new Map());
                    const typeMap = grouped.get(commish)!;
                    if (!typeMap.has(type)) typeMap.set(type, []);
                    typeMap.get(type)!.push(league);
                  });

                  const entries: React.ReactNode[] = [];
                  grouped.forEach((typeMap, commish) => {
                    entries.push(
                      <DropdownMenuSeparator key={`sep-${commish}`} />,
                      <DropdownMenuLabel key={`label-${commish}`} className="text-xs text-muted-foreground font-normal px-2 py-1">
                        Commish: {commish}
                      </DropdownMenuLabel>
                    );
                    const typeOrder = ["Dynasty", "Best Ball", "Keeper", "Redraft"];
                    const sortedTypes = Array.from(typeMap.keys()).sort((a, b) => {
                      const ai = typeOrder.indexOf(a);
                      const bi = typeOrder.indexOf(b);
                      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                    });
                    sortedTypes.forEach((type) => {
                      const typeLeagues = typeMap.get(type)!;
                      typeLeagues.forEach((league) => {
                        entries.push(
                          <DropdownMenuItem
                            key={league.league_id}
                            onClick={() => onLeagueChange(league)}
                            className="cursor-pointer"
                            data-testid={`menu-item-league-${league.league_id}`}
                          >
                            <Avatar className="h-6 w-6 mr-2 shrink-0">
                              <AvatarImage
                                src={league.avatar ? `https://sleepercdn.com/avatars/${league.avatar}` : undefined}
                                alt={league.name}
                              />
                              <AvatarFallback className="text-xs">
                                {league.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{league.name}</span>
                            <Badge variant="outline" className="ml-auto shrink-0 text-[10px] px-1.5 py-0">
                              {type}
                            </Badge>
                          </DropdownMenuItem>
                        );
                      });
                    });
                  });
                  return entries;
                })()}
              </DropdownMenuContent>
            </DropdownMenu>
            {!isAllLeagues && selectedLeague && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="shrink-0"
                data-testid="button-league-settings"
                title="League Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleGroups.map((group) => {
          const isOpen = openGroups.has(group.title);
          const hasActiveItem = group.items.some(item => isItemActive(item.url));
          const visibleItems = group.items.filter(item => !item.requiresLeague || !isAllLeagues);
          
          if (visibleItems.length === 0) return null;
          const isExpanded = userClosedGroups.has(group.title) ? false : (isOpen || hasActiveItem);

          return (
            <SidebarGroup key={group.title} className="py-1">
              <SidebarGroupContent className="px-2">
                <Collapsible open={isExpanded} onOpenChange={(open) => toggleGroup(group.title, open)}>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          className={hasActiveItem ? "bg-sidebar-accent" : ""}
                          data-testid={`nav-group-${group.title.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <group.icon className="h-4 w-4 text-primary/80" />
                          <span className="font-semibold text-sm tracking-wide">{group.title}</span>
                          <ChevronRight className={`ml-auto h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {group.subgroups ? (
                            group.subgroups.map((subgroupName) => {
                              const subgroupItems = visibleItems.filter(item => item.subgroup === subgroupName);
                              if (subgroupItems.length === 0) return null;
                              return (
                                <div key={subgroupName}>
                                  <div className="px-3 pt-3 pb-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                                      {subgroupName}
                                    </span>
                                  </div>
                                  {subgroupItems.map((item) => {
                                    const isActive = isItemActive(item.url);
                                    const linkUrl = leagueId ? (item.url.includes("?") ? `${item.url}&id=${leagueId}` : `${item.url}?id=${leagueId}`) : item.url;
                                    return (
                                      <SidebarMenuSubItem key={item.title}>
                                        <SidebarMenuSubButton
                                          asChild
                                          isActive={isActive}
                                          data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                                        >
                                          <Link href={linkUrl} title={item.description}>
                                            <item.icon className="h-3.5 w-3.5" />
                                            <span className="flex-1 text-[13px]">{item.title}</span>
                                            {item.premium && !isPremium && (
                                              <Crown className="h-3 w-3 text-primary/60 shrink-0" />
                                            )}
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </div>
                              );
                            })
                          ) : (
                            visibleItems.map((item) => {
                              const isActive = isItemActive(item.url);
                              const linkUrl = leagueId ? (item.url.includes("?") ? `${item.url}&id=${leagueId}` : `${item.url}?id=${leagueId}`) : item.url;
                              return (
                                <SidebarMenuSubItem key={item.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isActive}
                                    data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                                  >
                                    <Link href={linkUrl} title={item.description}>
                                      <item.icon className="h-3.5 w-3.5" />
                                      <span className="flex-1 text-[13px]">{item.title}</span>
                                      {item.premium && !isPremium && (
                                        <Crown className="h-3 w-3 text-primary/60 shrink-0" />
                                      )}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </Collapsible>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {socialItems.filter(item => !item.requiresLeague || !isAllLeagues).length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="px-4 py-1 text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
              Social
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <SidebarMenu>
                {socialItems
                  .filter(item => !item.requiresLeague || !isAllLeagues)
                  .map((item) => {
                  const isActive = location === item.url;
                  const linkUrl = leagueId ? `${item.url}?id=${leagueId}` : item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <Link href={linkUrl}>
                          <item.icon className="h-3.5 w-3.5" />
                          <span className="flex-1 text-[13px]">{item.title}</span>
                          {item.premium && !isPremium && (
                            <Crown className="h-3 w-3 text-primary/60 shrink-0" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="px-4 py-1 text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
            Settings / Tools
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <SidebarMenu>
              {settingsToolsItems
                .filter(item => (!item.requiresLeague || !isAllLeagues) && (!item.allLeaguesOnly || isAllLeagues))
                .map((item) => {
                const isActive = location === item.url;
                const linkUrl = leagueId ? `${item.url}?id=${leagueId}` : item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <Link href={linkUrl}>
                        <item.icon className="h-3.5 w-3.5" />
                        <span className="flex-1 text-[13px]">{item.title}</span>
                        {item.premium && !isPremium && (
                          <Crown className="h-3 w-3 text-primary/60 shrink-0" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-3 space-y-2">
        {!subLoading && !isPremium && (
          <Button
            onClick={() => setLocation("/upgrade")}
            className="w-full bg-gradient-to-r from-primary via-amber-500 to-primary hover:from-primary/90 hover:via-amber-400/90 hover:to-primary/90 shadow-[0_0_16px_rgba(217,169,78,0.2)] hover:shadow-[0_0_24px_rgba(217,169,78,0.35)] transition-all duration-300"
            data-testid="button-upgrade"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade to Premium
          </Button>
        )}
        <a
          href="https://buy.stripe.com/eVqfZ90Kf7gDdGh6II3ZK02"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          data-testid="link-donate"
        >
          <Button
            variant="outline"
            className="w-full border-primary/40 text-primary"
          >
            <Heart className="h-4 w-4 mr-2" />
            Donate to Support
          </Button>
        </a>
        
        <div className="flex items-center gap-2">
          <Link href={user?.id ? `/profile/${user.id}` : "#"} data-testid="link-my-profile">
            <Avatar className="h-8 w-8 cursor-pointer shrink-0">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Link href={user?.id ? `/profile/${user.id}` : "#"} className="hover:underline min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-user-name">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || "User"}
                </p>
              </Link>
              {isPremium && (
                <Badge variant="outline" className="text-primary border-primary text-[10px] px-1.5 py-0 shrink-0" data-testid="badge-premium">
                  <Crown className="h-3 w-3 mr-0.5" />
                  {isGrandfathered ? "OG" : "PRO"}
                </Badge>
              )}
            </div>
            {user?.email && user?.firstName && (
              <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
                {user.email}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin")}
            className="shrink-0"
            data-testid="button-admin"
            title="Admin Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="shrink-0"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>

      {selectedLeague && (
        <LeagueSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          leagueId={selectedLeague.league_id}
          leagueName={selectedLeague.name}
        />
      )}
    </Sidebar>
  );
}
