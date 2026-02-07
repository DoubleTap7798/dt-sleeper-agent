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
      <Card className="max-w-md w-full text-center border-primary/30">
        <CardHeader>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Premium Feature
          </CardTitle>
          <CardDescription>
            {featureName} is available exclusively for premium subscribers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-card/50 rounded-lg border border-border/30 text-left">
            <p className="text-sm font-medium mb-2">Premium includes:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                Dynasty Trade Calculator with AI Analysis
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                AI Lineup Advice & ROS Projections
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                2026 Draft Board & Devy Rankings
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                Waiver Wire, Player Trends & Comparison
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                AI Fantasy News & Watchlist
              </li>
            </ul>
          </div>
          
          <Button 
            className="w-full bg-gradient-to-r from-primary to-cyan-400"
            onClick={() => setLocation("/upgrade")}
            data-testid="button-upgrade-gate"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade for $3.99/week
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
