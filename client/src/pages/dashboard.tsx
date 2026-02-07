import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import type { SleeperLeague } from "@/lib/sleeper-types";

interface UserProfile {
  sleeperUsername: string | null;
  sleeperUserId: string | null;
  selectedLeagueId: string | null;
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  const { data: leagues, isLoading: leaguesLoading } = useQuery<SleeperLeague[]>({
    queryKey: ["/api/sleeper/leagues"],
    enabled: !!profile?.sleeperUserId,
  });

  usePageTitle("Dashboard");

  useEffect(() => {
    if (!authLoading && !profileLoading) {
      if (!profile?.sleeperUsername) {
        setLocation("/setup");
        return;
      }
      if (leagues && leagues.length > 0) {
        const selectedLeagueId = profile.selectedLeagueId || leagues[0].league_id;
        setLocation(`/league?id=${selectedLeagueId}`);
      }
    }
  }, [authLoading, profileLoading, profile, leagues, setLocation]);

  const isLoading = authLoading || profileLoading || leaguesLoading;

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
