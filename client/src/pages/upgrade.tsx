import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Crown, Zap, LineChart, Users, Trophy, ArrowLeft, CreditCard, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useEffect } from "react";
import { useSubscription } from "@/hooks/use-subscription";

interface SubscriptionStatus {
  hasSubscription: boolean;
  status: string | null;
  periodEnd: string | null;
  isGrandfathered?: boolean;
  subscriptionSource?: string | null;
  subscriptionId?: string | null;
}

const WEEKLY_PRICE_ID = "price_1Sw0jYAfG2ju3f0JF1Vafcuz";

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

  const { isPremium: hookIsPremium, isGrandfathered: hookIsGrandfathered } = useSubscription();

  const { data: subStatus, isLoading: statusLoading, error: statusError } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    retry: 2,
    retryDelay: 1000,
  });

  const effectiveHasSubscription = subStatus?.hasSubscription || hookIsPremium;
  const effectiveIsGrandfathered = subStatus?.isGrandfathered || hookIsGrandfathered;


  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/create-checkout", { priceId: WEEKLY_PRICE_ID });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyPremium) {
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
        toast({ title: "You already have premium access!" });
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Unavailable",
        description: "Unable to connect to payment processor. Please try again later.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/create-portal");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open portal",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/sync-my-subscription");
      return res.json();
    },
  });

  useEffect(() => {
    if (success) {
      syncMutation.mutate(undefined, {
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
          toast({
            title: "Welcome to Premium!",
            description: "Your subscription is now active. Enjoy all features!",
          });
          window.history.replaceState({}, document.title, "/upgrade");
        },
      });
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

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            
            {subStatus?.subscriptionId ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-subscription"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Manage Subscription
              </Button>
            ) : (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                <p className="text-sm text-center">
                  Your premium access was activated manually. Enjoy all features!
                </p>
              </div>
            )}
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

            <div className="space-y-3 pt-2">
              <Button 
                className="w-full bg-gradient-to-r from-primary to-cyan-400"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                data-testid="button-subscribe"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                {checkoutMutation.isPending ? "Preparing checkout..." : "Subscribe Now"}
              </Button>
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
