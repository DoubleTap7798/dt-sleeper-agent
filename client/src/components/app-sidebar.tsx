import { useLocation, Link, useSearch } from "wouter";
import {
  Home,
  RefreshCw,
  History,
  Trophy,
  Users,
  LogOut,
  ChevronDown,
  Swords,
  Gamepad2,
  CalendarDays,
  GraduationCap,
  GitBranch,
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "./logo";
import { useAuth } from "@/hooks/use-auth";
import type { SleeperLeague } from "@/lib/sleeper-types";

interface AppSidebarProps {
  leagues: SleeperLeague[];
  selectedLeague: SleeperLeague | null;
  onLeagueChange: (league: SleeperLeague) => void;
}

const navigationItems = [
  {
    title: "Home",
    url: "/league",
    icon: Home,
    description: "League standings & playoff predictions",
  },
  {
    title: "Matchups",
    url: "/league/matchups",
    icon: Gamepad2,
    description: "Current week matchups & live scoring",
  },
  {
    title: "Schedule",
    url: "/league/schedule",
    icon: CalendarDays,
    description: "Your season schedule",
  },
  {
    title: "Playoff Bracket",
    url: "/league/bracket",
    icon: GitBranch,
    description: "Playoff matchups & bracket",
  },
  {
    title: "Waiver Wire",
    url: "/league/waivers",
    icon: Users,
    description: "Available players & stats",
  },
  {
    title: "Devy Rankings",
    url: "/league/devy",
    icon: GraduationCap,
    description: "College player rankings",
  },
  {
    title: "Trade Calculator",
    url: "/league/trade",
    icon: RefreshCw,
    description: "Calculate trade values",
  },
  {
    title: "Trade History",
    url: "/league/history",
    icon: History,
    description: "Historical trades & analysis",
  },
  {
    title: "Rivalries",
    url: "/league/rivalries",
    icon: Swords,
    description: "Head-to-head records",
  },
  {
    title: "Trophy Room",
    url: "/league/trophies",
    icon: Trophy,
    description: "Champions & records",
  },
];

export function AppSidebar({ leagues, selectedLeague, onLeagueChange }: AppSidebarProps) {
  const [location] = useLocation();
  const searchString = useSearch();
  const { user, logout } = useAuth();
  
  // Get leagueId from URL or selected league
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id") || selectedLeague?.league_id;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Logo size="sm" showText={true} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs uppercase tracking-wider text-sidebar-foreground/60">
            Select League
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-sidebar-accent border-sidebar-border text-sidebar-foreground"
                  data-testid="button-league-selector"
                >
                  <span className="truncate">
                    {selectedLeague?.name || "Select a league"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                {leagues.map((league) => (
                  <DropdownMenuItem
                    key={league.league_id}
                    onClick={() => onLeagueChange(league)}
                    className="cursor-pointer"
                    data-testid={`menu-item-league-${league.league_id}`}
                  >
                    <span className="truncate">{league.name}</span>
                    {league.season && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {league.season}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
                {leagues.length === 0 && (
                  <DropdownMenuItem disabled>
                    No leagues found
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-4 py-2 text-xs uppercase tracking-wider text-sidebar-foreground/60">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url === "/league" && location === "/league");
                const linkUrl = leagueId ? `${item.url}?id=${leagueId}` : item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.description}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <Link href={linkUrl}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profileImageUrl || undefined} alt="User avatar" />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.firstName || user?.email || "User"}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
