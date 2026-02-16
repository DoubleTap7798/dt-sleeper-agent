import { Switch, Route, useLocation } from "wouter";
import { queryClient, localStoragePersister } from "./lib/queryClient";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import SleeperSetupPage from "@/pages/sleeper-setup";
import DashboardPage from "@/pages/dashboard";
import { LeagueLayout } from "@/pages/league-layout";
import LeagueStandingsPage from "@/pages/league-standings";
import WaiverWirePage from "@/pages/waiver-wire";
import TradeCalculatorPage from "@/pages/trade-calculator";
import TradeHistoryPage from "@/pages/trade-history";
import TrophyRoomPage from "@/pages/trophy-room";
import RivalryPage from "@/pages/rivalry";
import MatchupsPage from "@/pages/matchups";
import SchedulePage from "@/pages/schedule";
import DevyPage from "@/pages/devy";
import DevyRankingsPage from "@/pages/devy-rankings";
import DevyPortfolioPage from "@/pages/devy-portfolio";
import DevyMarketPage from "@/pages/devy-market";
import PlayoffBracketPage from "@/pages/playoff-bracket";
import PlayersPage from "@/pages/players";
import NewsFeedPage from "@/pages/news-feed";
import PlayerTrendsPage from "@/pages/player-trends";
import PlayerComparePage from "@/pages/player-compare";
import LineupAdvicePage from "@/pages/lineup-advice";
import LineupOptimizerPage from "@/pages/lineup-optimizer";
import ProjectionsPage from "@/pages/projections";
import HomePage from "@/pages/home";
import RosterPage from "@/pages/roster";
import LeagueInfoPage from "@/pages/league-info";
import DepthChartPage from "@/pages/depth-chart";
import WatchlistPage from "@/pages/watchlist";
import DraftBoardPage from "@/pages/draft-board";
import DraftWarRoomPage from "@/pages/draft-war-room";
import UpgradePage from "@/pages/upgrade";
import AdminPage from "@/pages/admin";
import AuthPage from "@/pages/auth";
import AIChatPage from "@/pages/ai-chat";
import PowerRankingsPage from "@/pages/power-rankings";
import DraftPickValuePage from "@/pages/draft-pick-value";
import LeagueTimelinePage from "@/pages/league-timeline";
import StatLeadersPage from "@/pages/stat-leaders";
import ActivityFeedPage from "@/pages/activity-feed";
import SeasonProjectionsPage from "@/pages/season-projections";
import UsageTrendsPage from "@/pages/usage-trends";
import InjuryTrackerPage from "@/pages/injury-tracker";
import TeamReportPage from "@/pages/team-report";
import NFLPage from "@/pages/nfl";
import { Skeleton } from "@/components/ui/skeleton";

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
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
    <Switch>
      <Route path="/">
        {isAuthenticated ? <DashboardPage /> : <LandingPage />}
      </Route>
      <Route path="/auth">
        {isAuthenticated ? <DashboardPage /> : <AuthPage />}
      </Route>
      <Route path="/setup">
        <AuthenticatedRoute>
          <SleeperSetupPage />
        </AuthenticatedRoute>
      </Route>
      <Route path="/dashboard">
        <AuthenticatedRoute>
          <DashboardPage />
        </AuthenticatedRoute>
      </Route>
      <Route path="/league">
        <AuthenticatedRoute>
          <LeagueLayout>
            <HomePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/info">
        <AuthenticatedRoute>
          <LeagueLayout>
            <LeagueInfoPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/activity">
        <AuthenticatedRoute>
          <LeagueLayout>
            <ActivityFeedPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/standings">
        <AuthenticatedRoute>
          <LeagueLayout>
            <LeagueStandingsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/power-rankings">
        <AuthenticatedRoute>
          <LeagueLayout>
            <PowerRankingsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/roster">
        <AuthenticatedRoute>
          <LeagueLayout>
            <RosterPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/matchups">
        <AuthenticatedRoute>
          <LeagueLayout>
            <MatchupsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/schedule">
        <AuthenticatedRoute>
          <LeagueLayout>
            <SchedulePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/waivers">
        <AuthenticatedRoute>
          <LeagueLayout>
            <WaiverWirePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/devy">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DevyRankingsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/devy/rankings">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DevyRankingsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/devy/portfolio">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DevyPortfolioPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/devy/market">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DevyMarketPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/draft-board">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DraftBoardPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/war-room">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DraftWarRoomPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/trade">
        <AuthenticatedRoute>
          <LeagueLayout>
            <TradeCalculatorPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/history">
        <AuthenticatedRoute>
          <LeagueLayout>
            <TradeHistoryPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/trophies">
        <AuthenticatedRoute>
          <LeagueLayout>
            <TrophyRoomPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/timeline">
        <AuthenticatedRoute>
          <LeagueLayout>
            <LeagueTimelinePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/rivalries">
        <AuthenticatedRoute>
          <LeagueLayout>
            <RivalryPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/bracket">
        <AuthenticatedRoute>
          <LeagueLayout>
            <PlayoffBracketPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/players">
        <AuthenticatedRoute>
          <LeagueLayout>
            <PlayersPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/nfl">
        <AuthenticatedRoute>
          <LeagueLayout>
            <NFLPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/news">
        <AuthenticatedRoute>
          <LeagueLayout>
            <NFLPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/trends">
        <AuthenticatedRoute>
          <LeagueLayout>
            <PlayerTrendsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/compare">
        <AuthenticatedRoute>
          <LeagueLayout>
            <PlayerComparePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/lineup">
        <AuthenticatedRoute>
          <LeagueLayout>
            <LineupAdvicePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/lineup-optimizer">
        <AuthenticatedRoute>
          <LeagueLayout>
            <LineupOptimizerPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/projections">
        <AuthenticatedRoute>
          <LeagueLayout>
            <ProjectionsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/depth-chart">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DepthChartPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/watchlist">
        <AuthenticatedRoute>
          <LeagueLayout>
            <WatchlistPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/ai-chat">
        <AuthenticatedRoute>
          <LeagueLayout>
            <AIChatPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/draft-pick-values">
        <AuthenticatedRoute>
          <LeagueLayout>
            <DraftPickValuePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/upgrade">
        <AuthenticatedRoute>
          <LeagueLayout>
            <UpgradePage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/season-projections">
        <AuthenticatedRoute>
          <LeagueLayout>
            <SeasonProjectionsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/usage-trends">
        <AuthenticatedRoute>
          <LeagueLayout>
            <UsageTrendsPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/injuries">
        <AuthenticatedRoute>
          <LeagueLayout>
            <InjuryTrackerPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/team-report">
        <AuthenticatedRoute>
          <LeagueLayout>
            <TeamReportPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/league/stat-leaders">
        <AuthenticatedRoute>
          <LeagueLayout>
            <StatLeadersPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/admin">
        <AuthenticatedRoute>
          <AdminPage />
        </AuthenticatedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: localStoragePersister,
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0] as string;
            if (typeof key !== "string") return false;
            const persistPaths = [
              "/api/sleeper/players",
              "/api/sleeper/league-info",
              "/api/sleeper/standings",
              "/api/fantasy/roster",
              "/api/user",
            ];
            return query.state.status === "success" && persistPaths.some((p) => key.startsWith(p));
          },
        },
      }}
    >
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
