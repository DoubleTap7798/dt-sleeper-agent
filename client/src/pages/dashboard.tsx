import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import type { SleeperLeague } from "@/lib/sleeper-types";
import { RefreshCw } from "lucide-react";

interface UserProfile {
  sleeperUsername: string | null;
  sleeperUserId: string | null;
  selectedLeagueId: string | null;
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  const { data: leagues, isLoading: leaguesLoading, error: leaguesError, refetch: refetchLeagues } = useQuery<SleeperLeague[]>({
    queryKey: ["/api/sleeper/leagues"],
    enabled: !!profile?.sleeperUserId,
    retry: 2,
  });

  usePageTitle("Dashboard");

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      setLocation("/auth");
      return;
    }

    if (!profile?.sleeperUsername) {
      setLocation("/setup");
      return;
    }

    if (leaguesLoading) return;

    if (leagues && leagues.length > 0) {
      const selectedLeagueId = profile.selectedLeagueId || leagues[0].league_id;
      setLocation(`/league?id=${selectedLeagueId}`);
      return;
    }

    setRedirectAttempted(true);
  }, [authLoading, profileLoading, leaguesLoading, user, profile, leagues, setLocation]);

  const isLoading = authLoading || profileLoading || leaguesLoading;
  const hasError = !!leaguesError || !!profileError;
  const noLeagues = redirectAttempted && !isLoading && (!leagues || leagues.length === 0) && !hasError;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center gap-6">
            <Logo size="lg" />
            
            {isLoading ? (
              <div className="w-full space-y-3">
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
                <div className="flex justify-center mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Loading your leagues...
                </p>
              </div>
            ) : hasError ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Having trouble connecting to Sleeper right now. This usually resolves quickly.
                </p>
                <Button
                  variant="outline"
                  onClick={() => refetchLeagues()}
                  data-testid="button-retry-leagues"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : noLeagues ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  No active leagues found for your Sleeper account. This can happen if your leagues haven't started yet for the current season.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => refetchLeagues()}
                    data-testid="button-refresh-leagues"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Leagues
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setLocation("/setup")}
                    data-testid="button-reconnect-sleeper"
                  >
                    Reconnect Sleeper Account
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground">
                  Welcome back! Redirecting to your leagues...
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
