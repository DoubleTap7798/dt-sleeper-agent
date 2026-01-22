import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
            <LeagueStandingsPage />
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
      <Route path="/league/rivalries">
        <AuthenticatedRoute>
          <LeagueLayout>
            <RivalryPage />
          </LeagueLayout>
        </AuthenticatedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
