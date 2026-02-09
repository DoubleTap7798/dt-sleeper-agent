import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { usePageTitle } from "@/hooks/use-page-title";
import { 
  ArrowRight, 
  Users, 
  Trophy, 
  RefreshCw, 
  Zap,
  Shield,
  Brain,
  Target,
  ChevronRight,
  Sparkles,
  LineChart,
  Eye
} from "lucide-react";

export default function LandingPage() {
  const { isLoading } = useAuth();
  usePageTitle();

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Trade Analysis",
      description: "Get instant trade grades with our custom dynasty value engine. Never lose a trade again with AI insights that analyze fairness and long-term value.",
    },
    {
      icon: Target,
      title: "Smart Trade Ideas",
      description: "AI scans your roster weaknesses and finds league-wide opportunities. Get personalized trade suggestions with fairness scores to maximize your team.",
    },
    {
      icon: Users,
      title: "Personalized Waiver Picks",
      description: "See fit scores for every available player based on YOUR roster needs. Know exactly who to target before your leaguemates do.",
    },
    {
      icon: Eye,
      title: "Player Watchlist",
      description: "Track players and monitor dynasty value changes over time. Get alerted when values shift so you can buy low and sell high.",
    },
    {
      icon: LineChart,
      title: "Advanced Projections",
      description: "AI-generated rest-of-season projections with confidence ratings, upside/floor analysis, and schedule strength considerations.",
    },
    {
      icon: Trophy,
      title: "League History & Records",
      description: "Explore your trophy room with all-time champions, rivalry records, and career stats across every season.",
    },
  ];

  const benefits = [
    {
      icon: Zap,
      title: "Instant Sync",
      description: "Connect once, access all your Sleeper leagues instantly",
    },
    {
      icon: Shield,
      title: "Premium Power",
      description: "3-day free trial, then just $3.99/week",
    },
    {
      icon: RefreshCw,
      title: "Real-Time Data",
      description: "Live scoring, transactions, and player updates",
    },
  ];


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 flex-wrap">
          <Logo size="sm" showText={false} />
          <div className="flex items-center gap-4 flex-wrap">
            <PwaInstallButton />
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/auth")}
              disabled={isLoading}
              data-testid="button-login"
            >
              Sign In
            </Button>
            <Button
              onClick={() => (window.location.href = "/auth")}
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
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 overflow-hidden">
          {/* Glow effects */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[hsl(var(--accent))]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[hsl(var(--accent))]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 flex-wrap px-4 py-2 rounded-full border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 mb-6" data-testid="badge-hero">
                <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
                <span className="text-sm text-[hsl(var(--accent))]">AI-Powered Fantasy Football Companion</span>
              </div>
              
              <Logo size="xl" className="mb-8" />
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Win Your Dynasty League with{" "}
                <span className="text-[hsl(var(--accent))] relative">
                  AI Intelligence
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-[hsl(var(--accent))]/50 blur-sm" />
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-foreground/90 mb-8 max-w-2xl mx-auto">
                Stop guessing on trades and waivers. DT Sleeper Agent analyzes your roster, 
                identifies weaknesses, and delivers personalized recommendations to build 
                your championship team.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = "/auth")}
                  disabled={isLoading}
                  data-testid="button-hero-cta"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-[hsl(var(--accent))]/80" data-testid="section-benefits">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 flex-wrap" data-testid={`text-benefit-${index}`}>
                    <benefit.icon className="h-4 w-4 text-[hsl(var(--accent))]" />
                    <span>{benefit.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>


        {/* Features Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything You Need to{" "}
                <span className="text-[hsl(var(--accent))]">Dominate</span>
              </h2>
              <p className="text-foreground/90 max-w-2xl mx-auto">
                Built by dynasty players, for dynasty players. Every feature designed to give you 
                an edge over your competition.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 hover-elevate border-[hsl(var(--accent))]/30"
                  data-testid={`card-feature-${index}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-[hsl(var(--accent))]/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-[hsl(var(--accent))]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--accent))]">{feature.title}</h3>
                  <p className="text-foreground/90 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Get Started in{" "}
                <span className="text-[hsl(var(--accent))]">30 Seconds</span>
              </h2>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    step: "1",
                    title: "Create Account",
                    description: "Sign up with your email in seconds - quick and easy",
                  },
                  {
                    step: "2",
                    title: "Connect Sleeper",
                    description: "Enter your Sleeper username once to link all your leagues",
                  },
                  {
                    step: "3",
                    title: "Start Winning",
                    description: "Get instant AI insights, trade analysis, and personalized picks",
                  },
                ].map((item, index) => (
                  <div key={index} className="relative text-center">
                    <div className="w-14 h-14 rounded-full bg-[hsl(var(--accent))]/10 border-2 border-[hsl(var(--accent))]/30 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-[hsl(var(--accent))]">{item.step}</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--accent))]">{item.title}</h3>
                    <p className="text-foreground/90 text-sm">{item.description}</p>
                    
                    {index < 2 && (
                      <ChevronRight className="hidden md:block absolute top-7 -right-4 h-6 w-6 text-[hsl(var(--accent))]/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>


        {/* Feature Highlights */}
        <section className="py-20 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Dynasty Values You Can{" "}
                  <span className="text-[hsl(var(--accent))]">Trust</span>
                </h2>
                <p className="text-foreground/90 mb-6">
                  Our custom dynasty value engine goes beyond simple rankings. We factor in:
                </p>
                <ul className="space-y-4">
                  {[
                    "Multi-year Value Over Replacement (VOR) with weighted projections",
                    "Age-adjusted curves specific to each position",
                    "Role security based on snap share and depth chart",
                    "Production ceiling and weekly consistency scores",
                    "Team context and offensive strength multipliers",
                    "Market calibration with consensus values",
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3 flex-wrap">
                      <div className="mt-1 h-5 w-5 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
                      </div>
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 bg-[hsl(var(--accent))]/5 rounded-2xl blur-xl" />
                <Card className="relative p-6 border-[hsl(var(--accent))]/20">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-background/50 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="w-10 h-10 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center text-sm font-bold text-[hsl(var(--accent))]">JJ</div>
                        <div>
                          <div className="font-semibold text-foreground">Ja'Marr Chase</div>
                          <div className="text-xs text-[hsl(var(--accent))]/70">WR - CIN</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[hsl(var(--accent))]">98.5</div>
                        <div className="text-xs text-[hsl(var(--accent))]/60">Dynasty Value</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded bg-background/50">
                        <div className="font-semibold text-[hsl(var(--accent))]">24</div>
                        <div className="text-[hsl(var(--accent))]/60">Age</div>
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <div className="font-semibold text-[hsl(var(--accent))]">95%</div>
                        <div className="text-[hsl(var(--accent))]/60">Snap Share</div>
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <div className="font-semibold text-[hsl(var(--accent))]">22.4</div>
                        <div className="text-[hsl(var(--accent))]/60">PPG</div>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20">
                      <div className="flex items-start gap-2 flex-wrap">
                        <Brain className="h-4 w-4 text-[hsl(var(--accent))] mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[hsl(var(--accent))]/80">
                          Elite WR1 in prime years. Top 3 snap share with elite efficiency. 
                          Hold as cornerstone asset or sell for 3+ premium picks.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--accent))]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="container mx-auto px-4 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Dominate Your League?
            </h2>
            <p className="text-foreground/90 mb-8 max-w-xl mx-auto">
              Start using AI to gain an edge in your dynasty leagues. 
              Your championship run starts here.
            </p>
            <Button
              size="lg"
              onClick={() => (window.location.href = "/auth")}
              disabled={isLoading}
              data-testid="button-footer-cta"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-xs text-[hsl(var(--accent))]/80 mt-4">
              Free basic features • Start with a 3-day free trial of Premium
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[hsl(var(--accent))]/20 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo size="sm" showText={false} />
              <span className="text-sm text-[hsl(var(--accent))]/80">
                &copy; {new Date().getFullYear()} DT Sleeper Agent
              </span>
            </div>
            <div className="text-sm text-[hsl(var(--accent))]/80 text-center md:text-right">
              <p>Built for dynasty players, by dynasty players.</p>
              <p className="text-xs mt-1 text-[hsl(var(--accent))]/60">
                Not affiliated with Sleeper. Uses public Sleeper API.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
