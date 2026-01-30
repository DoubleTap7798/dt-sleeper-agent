import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { user, isLoading: authLoading } = useAuth();

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
              <h1 className="text-lg font-semibold truncate" data-testid="text-league-name">
                {isAllLeagues ? "All Leagues" : selectedLeague?.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {!isAllLeagues && <NotificationBell leagueId={selectedLeague?.league_id} />}
              <PwaInstallButton />
              <ThemeToggle />
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
