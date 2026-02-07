import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Crown, Zap, LineChart, Users, Trophy, ArrowLeft, CreditCard, AlertCircle, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useEffect } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";

interface SubscriptionStatus {
  hasSubscription: boolean;
  status: string | null;
  periodEnd: string | null;
  isGrandfathered?: boolean;
  subscriptionSource?: string | null;
  subscriptionId?: string | null;
}

const PREMIUM_FEATURES = [
  { icon: LineChart, text: "Trade Calculator with AI Analysis" },
  { icon: Zap, text: "Draft War Room & Smart Recommendations" },
  { icon: Users, text: "AI-Powered Waiver Wire Suggestions" },
  { icon: Trophy, text: "Lineup Advice & Start/Sit Rankings" },
  { icon: Crown, text: "Player Watchlist & Value Tracking" },
  { icon: Check, text: "News Feed & Real-Time Alerts" },
  { icon: Check, text: "Trophy Room & Rivalries" },
  { icon: Check, text: "Player Trends & ROS Projections" },
];

export default function UpgradePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  usePageTitle("Upgrade to Premium");
  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const { isAuthenticated, user } = useAuth();

  const { isPremium: hookIsPremium, isGrandfathered: hookIsGrandfathered } = useSubscription();

  const { data: subStatus, isLoading: statusLoading, error: statusError, refetch: refetchStatus, isFetching: statusFetching } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    enabled: isAuthenticated,
    staleTime: 0,
  });

  const effectiveHasSubscription = subStatus?.hasSubscription || hookIsPremium;
  const effectiveIsGrandfathered = subStatus?.isGrandfathered || hookIsGrandfathered;



  useEffect(() => {
    if (success) {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      toast({
        title: "Payment Received!",
        description: "Your premium access will be activated within 1 hour.",
      });
      window.history.replaceState({}, document.title, "/upgrade");
    }
    if (canceled) {
      toast({
        title: "Checkout Cancelled",
        description: "You can try again anytime.",
        variant: "default",
      });
      window.history.replaceState({}, document.title, "/upgrade");
    }
  }, [success, canceled]);

  if (statusLoading || (statusFetching && !subStatus && !statusError)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (statusError && !effectiveHasSubscription) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")} 
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <Card className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <CardTitle>Unable to Load Subscription</CardTitle>
            </div>
            <CardDescription>
              We couldn't verify your subscription status. This is usually temporary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please try refreshing. If this keeps happening, try logging out and back in.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => refetchStatus()}
                data-testid="button-retry-status"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-go-home"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (effectiveHasSubscription) {
    if (effectiveIsGrandfathered) {
      return (
        <div className="p-6 max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")} 
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-primary" />
                <CardTitle>Premium Active</CardTitle>
                <Badge variant="outline" className="ml-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-0">
                  OG
                </Badge>
              </div>
              <CardDescription>
                You're one of our original supporters with lifetime premium access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/30">
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">Lifetime Access</p>
                </div>
                <Badge variant="outline" className="text-primary border-primary">
                  Grandfathered
                </Badge>
              </div>
              
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                <p className="text-sm">
                  As an early user, you have permanent lifetime access to all premium features at no cost.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")} 
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <Card className="border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" />
              <CardTitle>Premium Active</CardTitle>
            </div>
            <CardDescription>
              You have full access to all DT Sleeper Agent features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/30">
              <div>
                <p className="font-medium">Status</p>
                <p className="text-sm text-muted-foreground capitalize">{subStatus?.status || 'active'}</p>
              </div>
              <Badge variant="outline" className="text-primary border-primary">
                Active
              </Badge>
            </div>

            {subStatus?.subscriptionId && (
              <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/30">
                <div>
                  <p className="font-medium">Payment Method</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CreditCard className="w-4 h-4" />
                    Card (Stripe)
                  </p>
                </div>
              </div>
            )}
            
            {subStatus?.periodEnd && (
              <div className="p-4 bg-card/50 rounded-lg border border-border/30">
                <p className="font-medium">Next billing date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(subStatus.periodEnd).toLocaleDateString()}
                </p>
              </div>
            )}
            
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm text-center">
                Your premium access is active. Enjoy all features!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Button 
        variant="ghost" 
        onClick={() => setLocation("/")} 
        className="mb-4"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Upgrade to Premium</h1>
        <p className="text-muted-foreground">
          Unlock the full power of DT Sleeper Agent
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Premium Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {PREMIUM_FEATURES.map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">{feature.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Weekly Plan</CardTitle>
            <CardDescription>Full access, cancel anytime</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <span className="text-4xl font-bold">$3.99</span>
              <span className="text-muted-foreground">/week</span>
            </div>
            
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                All premium features included
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                Cancel anytime
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                Instant access
              </li>
            </ul>

            <div className="space-y-3 pt-2" data-testid="stripe-buy-button-container">
              <Button
                className="w-full"
                size="lg"
                onClick={() => window.open('https://buy.stripe.com/3cIbIT1Oj8kH8lX4AA3ZK00', '_blank')}
                data-testid="button-subscribe"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Subscribe Now - $3.99/week
              </Button>
            </div>

            <div className="mt-4 rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground text-center">
                After payment, your premium access will be activated within 1 hour. If you need immediate access, reach out and we'll get you set up right away.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Secure payments powered by Stripe. Cancel anytime from your account settings.
      </p>
    </div>
  );
}
