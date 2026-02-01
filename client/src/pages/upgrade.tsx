import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Crown, Zap, LineChart, Users, Trophy, ArrowLeft, CreditCard } from "lucide-react";
import { SiPaypal } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface SubscriptionStatus {
  hasSubscription: boolean;
  status: string | null;
  periodEnd: string | null;
  isGrandfathered?: boolean;
  subscriptionSource?: string | null;
}

interface PriceRow {
  id: string;
  name: string;
  description: string;
  price_id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string; interval_count: number } | null;
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
  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalProcessing, setPaypalProcessing] = useState(false);

  const { data: subStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
  });

  const { data: pricesData, isLoading: pricesLoading } = useQuery<{ prices: PriceRow[] }>({
    queryKey: ["/api/subscription/prices"],
  });

  const { data: paypalConfig } = useQuery<{ planId: string; clientId: string; mode: string }>({
    queryKey: ["/api/paypal/config"],
  });

  const verifyPaypalMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await apiRequest("POST", "/api/paypal/verify-subscription", { subscriptionId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      toast({
        title: "Success",
        description: "Your premium subscription is now active!",
      });
      setLocation("/upgrade?success=true");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to verify subscription",
        variant: "destructive",
      });
      setPaypalProcessing(false);
    },
  });

  // Load PayPal SDK
  useEffect(() => {
    if (!paypalConfig?.planId || !paypalConfig?.clientId || paypalLoaded || subStatus?.hasSubscription) return;

    // Check if script already exists
    const existingScript = document.querySelector(`script[src*="paypal.com/sdk"]`);
    if (existingScript) {
      if (window.paypal) {
        renderPayPalButton();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&vault=true&intent=subscription`;
    script.setAttribute("data-sdk-integration-source", "button-factory");
    script.async = true;
    script.onload = () => {
      setPaypalLoaded(true);
      renderPayPalButton();
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, [paypalConfig?.planId, paypalConfig?.clientId, subStatus?.hasSubscription]);

  const renderPayPalButton = () => {
    if (!window.paypal || !paypalContainerRef.current || !paypalConfig?.planId) return;
    
    // Clear any existing buttons
    paypalContainerRef.current.innerHTML = "";
    
    try {
      window.paypal.Buttons({
        style: {
          shape: "rect",
          color: "gold",
          layout: "vertical",
          label: "subscribe"
        },
        createSubscription: function(_data: any, actions: any) {
          console.log("Creating PayPal subscription with plan:", paypalConfig.planId);
          return actions.subscription.create({
            plan_id: paypalConfig.planId
          });
        },
        onApprove: function(data: { subscriptionID: string }) {
          console.log("PayPal subscription approved:", data.subscriptionID);
          setPaypalProcessing(true);
          verifyPaypalMutation.mutate(data.subscriptionID);
        },
        onCancel: function() {
          console.log("PayPal subscription cancelled by user");
          toast({
            title: "Cancelled",
            description: "You cancelled the PayPal checkout.",
            variant: "default",
          });
        },
        onError: function(err: any) {
          console.error("PayPal onError callback:", err);
          const errorMessage = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
          console.error("PayPal error details:", errorMessage);
          toast({
            title: "PayPal Error",
            description: `PayPal error: ${errorMessage.substring(0, 100)}`,
            variant: "destructive",
          });
        }
      }).render(paypalContainerRef.current).catch((renderErr: any) => {
        console.error("PayPal render error:", renderErr);
        toast({
          title: "PayPal Error",
          description: `Failed to load PayPal: ${renderErr?.message || 'Unknown error'}`,
          variant: "destructive",
        });
      });
    } catch (err: any) {
      console.error("PayPal initialization error:", err);
      toast({
        title: "PayPal Error",
        description: `Failed to initialize PayPal: ${err?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Re-render PayPal button when data is available
  useEffect(() => {
    if (paypalLoaded && paypalConfig?.planId && !subStatus?.hasSubscription) {
      renderPayPalButton();
    }
  }, [paypalLoaded, paypalConfig?.planId, subStatus?.hasSubscription]);

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/subscription/create-checkout", { priceId });
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
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/create-portal", {});
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
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  if (statusLoading || pricesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const weeklyPrice = pricesData?.prices?.find(p => p.recurring?.interval === "week");

  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-primary/50">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Welcome to Premium!</h2>
            <p className="text-muted-foreground mb-6">
              Your subscription is now active. Enjoy full access to all features.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Checkout Canceled</h2>
            <p className="text-muted-foreground mb-6">
              No worries! You can upgrade anytime.
            </p>
            <Button variant="outline" onClick={() => setLocation("/upgrade")} data-testid="button-try-again">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subStatus?.hasSubscription) {
    // Special view for grandfathered (lifetime) users
    if (subStatus.isGrandfathered) {
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
                <CardTitle>Lifetime Premium</CardTitle>
              </div>
              <CardDescription>
                Thank you for being an early supporter!
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

    // Regular subscription view
    const isPayPalSubscription = subStatus.subscriptionSource === 'paypal';
    
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
                <p className="text-sm text-muted-foreground capitalize">{subStatus.status}</p>
              </div>
              <Badge variant="outline" className="text-primary border-primary">
                Active
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/30">
              <div>
                <p className="font-medium">Payment Method</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  {isPayPalSubscription ? (
                    <>
                      <SiPaypal className="w-4 h-4" />
                      PayPal
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Card (Stripe)
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {subStatus.periodEnd && (
              <div className="p-4 bg-card/50 rounded-lg border border-border/30">
                <p className="font-medium">Next billing date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(subStatus.periodEnd).toLocaleDateString()}
                </p>
              </div>
            )}
            
            {isPayPalSubscription ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open("https://www.paypal.com/myaccount/autopay", "_blank")}
                data-testid="button-manage-paypal"
              >
                <SiPaypal className="w-4 h-4 mr-2" />
                Manage on PayPal
              </Button>
            ) : (
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
              <p className="text-xs text-muted-foreground text-center font-medium">Choose your payment method:</p>
              
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => weeklyPrice && checkoutMutation.mutate(weeklyPrice.price_id)}
                disabled={checkoutMutation.isPending || !weeklyPrice}
                data-testid="button-subscribe-stripe"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Pay with Card
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {paypalProcessing ? (
                <div className="flex items-center justify-center py-4 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">Processing PayPal subscription...</span>
                </div>
              ) : (
                <div 
                  ref={paypalContainerRef} 
                  data-testid="paypal-button-container"
                  className="min-h-[45px]"
                />
              )}
            </div>
            
            {!weeklyPrice && !paypalConfig?.planId && (
              <p className="text-xs text-muted-foreground text-center">
                Loading payment options...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Secure payments. Cancel anytime from your account settings.
      </p>
    </div>
  );
}
