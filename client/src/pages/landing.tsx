import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { ArrowRight, TrendingUp, Users, Trophy, RefreshCw, BarChart3, History } from "lucide-react";

export default function LandingPage() {
  const { isLoading } = useAuth();

  const features = [
    {
      icon: BarChart3,
      title: "League Standings",
      description: "View real-time standings with AI-powered playoff predictions based on your league settings.",
    },
    {
      icon: RefreshCw,
      title: "Trade Calculator",
      description: "Calculate trade values using dynasty rankings with AI analysis and grade recommendations.",
    },
    {
      icon: Users,
      title: "Waiver Wire",
      description: "Browse available players with detailed stats and fantasy point projections.",
    },
    {
      icon: History,
      title: "Trade History",
      description: "Track all historical trades with AI insights on each team's best moves.",
    },
    {
      icon: Trophy,
      title: "Trophy Room",
      description: "Celebrate league champions and view all-time records and achievements.",
    },
    {
      icon: TrendingUp,
      title: "Dynasty Support",
      description: "Full support for 2026 rookies, Devy players, and future draft picks.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="sm" showText={false} />
          <div className="flex items-center gap-4">
            <PwaInstallButton />
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/api/login")}
              disabled={isLoading}
              data-testid="button-login"
            >
              Sign In
            </Button>
            <Button
              onClick={() => (window.location.href = "/api/login")}
              disabled={isLoading}
              data-testid="button-get-started"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Logo size="xl" className="mb-8" />
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Your ultimate companion for Sleeper fantasy football leagues. 
                Analyze trades, track waivers, predict playoffs, and dominate your league.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = "/api/login")}
                  disabled={isLoading}
                  className="text-lg px-8"
                  data-testid="button-hero-cta"
                >
                  Connect Your Sleeper Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Free to use • No API key required • Secure login
              </p>
            </div>
          </div>
        </section>

        <section className="py-20 bg-card/50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Everything You Need to Win
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 hover-elevate transition-all duration-200"
                  data-testid={`card-feature-${index}`}
                >
                  <feature.icon className="h-10 w-10 mb-4 text-foreground" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Dominate Your League?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Connect your Sleeper account once and access all your leagues instantly. 
              No more entering your username every time.
            </p>
            <Button
              size="lg"
              onClick={() => (window.location.href = "/api/login")}
              disabled={isLoading}
              data-testid="button-footer-cta"
            >
              Get Started Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} DT Sleeper Agent. All rights reserved.</p>
          <p className="mt-2">
            Not affiliated with Sleeper. Uses public Sleeper API.
          </p>
        </div>
      </footer>
    </div>
  );
}
