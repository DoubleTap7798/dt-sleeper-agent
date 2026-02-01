import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Globe, User, Crown, LogOut, Settings } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, prefetchLeagueData, prefetchPlayerData } from "@/lib/queryClient";
import type { SleeperLeague } from "@/lib/sleeper-types";

interface LeagueLayoutProps {
  children: React.ReactNode;
}

interface UserProfile {
  sleeperUsername: string | null;
  sleeperUserId: string | null;
  selectedLeagueId: string | null;
}

export function LeagueLayout({ children }: LeagueLayoutProps) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { isPremium, isGrandfathered } = useSubscription();

  const urlParams = new URLSearchParams(searchString);
  const leagueIdFromUrl = urlParams.get("id");

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  const { data: leagues = [], isLoading: leaguesLoading } = useQuery<SleeperLeague[]>({
    queryKey: ["/api/sleeper/leagues"],
    enabled: !!profile?.sleeperUserId,
  });

  const [selectedLeague, setSelectedLeague] = useState<SleeperLeague | null>(null);
  const [isAllLeagues, setIsAllLeagues] = useState(true);

  const selectLeagueMutation = useMutation({
    mutationFn: async (leagueId: string) => {
      return await apiRequest("POST", "/api/user/select-league", { leagueId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
  });

  useEffect(() => {
    if (!authLoading && !profileLoading && !profile?.sleeperUsername) {
      setLocation("/setup");
      return;
    }

    if (leagues.length > 0) {
      // Check if URL has a specific league ID
      if (leagueIdFromUrl) {
        const league = leagues.find((l) => l.league_id === leagueIdFromUrl);
        if (league) {
          setSelectedLeague(league);
          setIsAllLeagues(false);
        }
      } else if (profile?.selectedLeagueId && profile.selectedLeagueId !== "all") {
        // Restore previously selected league from profile
        const savedLeague = leagues.find((l) => l.league_id === profile.selectedLeagueId);
        if (savedLeague) {
          setSelectedLeague(savedLeague);
          setIsAllLeagues(false);
        } else {
          // Saved league not found in current leagues, default to All
          setIsAllLeagues(true);
          setSelectedLeague(null);
        }
      } else {
        // Default to "All Leagues" view
        setIsAllLeagues(true);
        setSelectedLeague(null);
      }
    }
  }, [authLoading, profileLoading, profile, leagues, leagueIdFromUrl, setLocation]);

  // Prefetch common data when league is selected or on initial load
  const prefetchedLeaguesRef = useRef<Set<string>>(new Set());
  const hasPrefetchedPlayersRef = useRef(false);
  
  useEffect(() => {
    // Prefetch player data once when app loads
    if (!hasPrefetchedPlayersRef.current && leagues.length > 0) {
      hasPrefetchedPlayersRef.current = true;
      prefetchPlayerData();
    }
    
    // Prefetch data for selected league
    if (selectedLeague && !prefetchedLeaguesRef.current.has(selectedLeague.league_id)) {
      prefetchedLeaguesRef.current.add(selectedLeague.league_id);
      prefetchLeagueData(selectedLeague.league_id);
    }
    
    // Also prefetch first 2 leagues for quick switching
    leagues.slice(0, 2).forEach(league => {
      if (!prefetchedLeaguesRef.current.has(league.league_id)) {
        prefetchedLeaguesRef.current.add(league.league_id);
        prefetchLeagueData(league.league_id);
      }
    });
  }, [selectedLeague, leagues]);

  const handleLeagueChange = (league: SleeperLeague | null) => {
    if (league === null) {
      // "All Leagues" selected
      setIsAllLeagues(true);
      setSelectedLeague(null);
      selectLeagueMutation.mutate("all");
      setLocation("/league");
    } else {
      // Specific league selected
      setIsAllLeagues(false);
      setSelectedLeague(league);
      selectLeagueMutation.mutate(league.league_id);
      const currentPath = window.location.pathname;
      setLocation(`${currentPath}?id=${league.league_id}`);
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  if (authLoading || profileLoading || leaguesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          leagues={leagues}
          selectedLeague={selectedLeague}
          isAllLeagues={isAllLeagues}
          onLeagueChange={handleLeagueChange}
        />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {/* Persistent League Selector in Header */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 h-9 px-3 max-w-[200px] sm:max-w-[280px]"
                    data-testid="header-league-selector"
                  >
                    {isAllLeagues ? (
                      <Globe className="h-4 w-4 shrink-0 text-primary" />
                    ) : selectedLeague?.avatar ? (
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage 
                          src={`https://sleepercdn.com/avatars/${selectedLeague.avatar}`}
                          alt={selectedLeague.name}
                        />
                        <AvatarFallback className="text-[10px]">
                          {selectedLeague.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {(selectedLeague?.name || "L").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="font-semibold truncate text-sm">
                      {isAllLeagues ? "All Leagues" : selectedLeague?.name}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem
                    onClick={() => handleLeagueChange(null)}
                    className={`cursor-pointer ${isAllLeagues ? "bg-accent" : ""}`}
                    data-testid="header-menu-all-leagues"
                  >
                    <Globe className="h-4 w-4 mr-2 text-primary" />
                    <span className="font-medium">All Leagues</span>
                    <span className="ml-auto text-xs text-muted-foreground">Career</span>
                  </DropdownMenuItem>
                  <div className="h-px bg-border my-1" />
                  {leagues.map((league) => (
                    <DropdownMenuItem
                      key={league.league_id}
                      onClick={() => handleLeagueChange(league)}
                      className={`cursor-pointer ${selectedLeague?.league_id === league.league_id ? "bg-accent" : ""}`}
                      data-testid={`header-menu-league-${league.league_id}`}
                    >
                      <Avatar className="h-5 w-5 mr-2 shrink-0">
                        <AvatarImage 
                          src={league.avatar ? `https://sleepercdn.com/avatars/${league.avatar}` : undefined}
                          alt={league.name}
                        />
                        <AvatarFallback className="text-[10px]">
                          {league.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{league.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        {league.season}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              {!isAllLeagues && <NotificationBell leagueId={selectedLeague?.league_id} />}
              <PwaInstallButton />
              <ThemeToggle />
              
              {/* Profile/Account Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative"
                    data-testid="button-profile-menu"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {isPremium && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full flex items-center justify-center">
                        <Crown className="h-2 w-2 text-primary-foreground" />
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium truncate">
                      {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.email || "User"}
                    </p>
                    {isPremium && (
                      <Badge 
                        variant="outline" 
                        className="text-primary border-primary text-[10px] px-1.5 py-0 mt-1"
                      >
                        <Crown className="h-2.5 w-2.5 mr-0.5" />
                        {isGrandfathered ? "OG Member" : "PRO"}
                      </Badge>
                    )}
                  </div>
                  {!isPremium && (
                    <DropdownMenuItem
                      onClick={() => setLocation("/upgrade")}
                      className="cursor-pointer text-primary"
                      data-testid="menu-upgrade"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Premium
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setLocation("/upgrade")}
                    className="cursor-pointer"
                    data-testid="menu-account"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="cursor-pointer text-red-400"
                    data-testid="menu-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function useSelectedLeague() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlLeagueId = urlParams.get("id");

  const { data: leagues = [], isLoading: leaguesLoading } = useQuery<SleeperLeague[]>({
    queryKey: ["/api/sleeper/leagues"],
  });

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  // Priority: URL param > profile's selected league > first league in list
  const leagueId = urlLeagueId || (profile?.selectedLeagueId !== "all" ? profile?.selectedLeagueId : null);
  
  const selectedLeague = leagueId 
    ? leagues.find((l) => l.league_id === leagueId) || leagues[0] || null
    : leagues[0] || null;
    
  return { league: selectedLeague, isLoading: leaguesLoading || profileLoading };
}

// Backwards compatible hook that returns just the league (for components that don't need loading state)
export function useSelectedLeagueSimple() {
  const { league } = useSelectedLeague();
  return league;
}

export function useLeagues(): SleeperLeague[] {
  const { data: leagues = [] } = useQuery<SleeperLeague[]>({
    queryKey: ["/api/sleeper/leagues"],
  });

  return leagues;
}
