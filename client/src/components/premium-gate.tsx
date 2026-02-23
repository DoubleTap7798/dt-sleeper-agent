import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { Skeleton } from "@/components/ui/skeleton";

interface PremiumGateProps {
  children: React.ReactNode;
  featureName?: string;
}

export function PremiumGate({ children, featureName = "This feature" }: PremiumGateProps) {
  const [, setLocation] = useLocation();
  const { isPremium, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center border-primary/20 shadow-[0_0_40px_rgba(217,169,78,0.06)] premium-shine">
        <CardHeader className="pb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/20 shadow-[0_0_20px_rgba(217,169,78,0.15)]">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-lg">
            <Crown className="w-5 h-5 text-primary" />
            Premium Feature
          </CardTitle>
          <CardDescription className="text-sm mt-1">
            {featureName} is available exclusively for premium subscribers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary/70 mb-3">Premium includes</p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                Dynasty Trade Calculator with AI Analysis
              </li>
              <li className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                AI Lineup Advice & ROS Projections
              </li>
              <li className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                2026 Draft Board & Devy Rankings
              </li>
              <li className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                Waiver Wire, Player Trends & Comparison
              </li>
              <li className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                AI Fantasy News & Watchlist
              </li>
            </ul>
          </div>
          
          <Button 
            className="w-full bg-gradient-to-r from-primary via-amber-500 to-primary hover:from-primary/90 hover:via-amber-400/90 hover:to-primary/90 shadow-[0_0_16px_rgba(217,169,78,0.2)] hover:shadow-[0_0_24px_rgba(217,169,78,0.35)] transition-all duration-300"
            onClick={() => setLocation("/upgrade")}
            data-testid="button-upgrade-gate"
          >
            <Crown className="w-4 h-4 mr-2" />
            Start Free Trial
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
