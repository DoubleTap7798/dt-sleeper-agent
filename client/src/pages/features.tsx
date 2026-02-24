import { useEffect } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Brain,
  Trophy,
  ArrowRightLeft,
  LayoutList,
  Swords,
  DollarSign,
  Users,
  Crown,
  Sparkles,
  ChevronRight,
  Search,
  GraduationCap,
  Layers,
  Settings,
} from "lucide-react";

interface FeatureCategory {
  title: string;
  description: string;
  icon: any;
  features: {
    name: string;
    description: string;
    premium?: boolean;
    aiPowered?: boolean;
  }[];
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    title: "Decision Engine",
    description: "Advanced Monte Carlo simulation system for optimal fantasy decisions",
    icon: Brain,
    features: [
      { name: "Matchup Simulator", description: "10,000+ correlated Monte Carlo iterations using Cholesky decomposition to simulate weekly matchup outcomes with win probabilities, score distributions, and positional advantage breakdowns", premium: true, aiPowered: true },
      { name: "Lineup Optimizer", description: "EV-maximizing lineup construction that finds the statistically optimal starter/bench configuration across all roster positions including FLEX slots", premium: true, aiPowered: true },
      { name: "Trade Evaluator", description: "Full trade analysis with championship equity delta, ROS point projections, positional scarcity impact, and risk assessment. Uses player search with autocomplete", premium: true, aiPowered: true },
      { name: "FAAB Optimizer", description: "Game-theory based waiver bidding with opponent simulation, optimal bid calculation, minimum viable bid, and win probability estimates", premium: true, aiPowered: true },
      { name: "Season Outlook", description: "Full-season Monte Carlo simulation projecting playoff probability, championship odds, expected wins/finish, week-by-week win probabilities, and cumulative playoff odds", premium: true, aiPowered: true },
      { name: "Portfolio Risk Analysis", description: "Roster diversification scoring, fragility analysis, volatility measurement, playoff leverage assessment, and NFL team concentration breakdown", premium: true, aiPowered: true },
      { name: "Championship Path Optimizer", description: "Maps the path from current odds to championship, identifying key weeks, projected odds improvement, and actionable roster moves to maximize title probability", premium: true, aiPowered: true },
    ],
  },
  {
    title: "Dynasty Trade Tools",
    description: "Comprehensive trade analysis and value calculation for dynasty leagues",
    icon: ArrowRightLeft,
    features: [
      { name: "Dynasty Trade Calculator", description: "Custom algorithm calculating player values (0-10,000 scale) based on VOR, age, role security, injury risk, production ceiling, volatility, draft capital, team context, scarcity bonus, and KTC consensus blend" },
      { name: "Trade History", description: "Complete league trade history with date, players exchanged, and draft picks involved" },
      { name: "Smart Trade Ideas", description: "AI-generated trade suggestions based on roster needs, positional scarcity, and league tendencies" },
      { name: "Consolidation Premium", description: "Star player premium applied when trading fewer high-value assets for multiple pieces" },
      { name: "Trade Analyzer AI", description: "Deep AI analysis of proposed trades with multi-factor evaluation", premium: true, aiPowered: true },
    ],
  },
  {
    title: "League Management",
    description: "Complete league tracking, standings, and competitive analysis",
    icon: Trophy,
    features: [
      { name: "Multi-League Dashboard", description: "Unified dashboard across all Sleeper leagues with sort by rank/record/points/name, quick-action links, and matchup previews" },
      { name: "Career Stats (All Leagues)", description: "Aggregated career statistics across every league including wins, losses, championships, and points scored" },
      { name: "Standings", description: "Live league standings with win/loss records, points for/against, and playoff positioning" },
      { name: "Power Rankings", description: "Algorithmic power rankings with AI-generated commentary", premium: true, aiPowered: true },
      { name: "Rivalry Tracker", description: "Head-to-head records and rivalry history between league managers" },
      { name: "League Activity Feed", description: "Real-time feed of all league transactions, trades, waivers, and roster moves" },
      { name: "League History Timeline", description: "Visual timeline of league milestones, champions, and notable events" },
      { name: "League Accounting", description: "Per-league financial ledger for tracking dues, prizes, and penalties with all-leagues summary aggregation" },
      { name: "Trophy Room", description: "Showcase of league achievements, championships, and awards" },
    ],
  },
  {
    title: "Roster & Lineup Tools",
    description: "Roster management, lineup optimization, and player analysis",
    icon: LayoutList,
    features: [
      { name: "Roster View", description: "Full roster breakdown with player values, positions, and status indicators" },
      { name: "Lineup Advice", description: "Weekly start/sit recommendations based on matchup analysis" },
      { name: "Lineup Optimizer", description: "Automated optimal lineup construction for maximum expected points" },
      { name: "Waiver Wire", description: "Top available players with projected values and roster fit analysis" },
      { name: "Player Watchlist", description: "Track players of interest with alerts and value changes" },
      { name: "Taxi Squad Optimizer", description: "AI recommendations for taxi squad management in dynasty leagues", premium: true, aiPowered: true },
      { name: "Depth Chart", description: "NFL team depth charts with fantasy-relevant annotations" },
    ],
  },
  {
    title: "Weekly Competition",
    description: "Matchup analysis, predictions, and weekly game tools",
    icon: Swords,
    features: [
      { name: "Matchups with Median Tracker", description: "Weekly matchup view with median scoring line and win probability" },
      { name: "Schedule", description: "Full season schedule with strength-of-schedule analysis" },
      { name: "Playoff Bracket", description: "Interactive playoff bracket with seeding and matchup projections" },
      { name: "Matchup Heat Maps", description: "Visual heat map of positional advantages across all weekly matchups", premium: true, aiPowered: true },
      { name: "Weekly Predictions Leaderboard", description: "Predict matchup winners each week and compete on accuracy leaderboard", premium: true },
      { name: "Boom/Bust Probability Cards", description: "Per-player probability distributions for boom and bust outcomes", premium: true, aiPowered: true },
    ],
  },
  {
    title: "Player Intelligence",
    description: "Deep player analytics, trends, and comparison tools",
    icon: Search,
    features: [
      { name: "NFL Players Database", description: "Searchable database of all NFL players with fantasy-relevant stats and profiles" },
      { name: "Player Profile Modal", description: "Detailed player profiles with stats, news, value trends, and ownership data" },
      { name: "Player Trends", description: "Weekly scoring trends and trajectory analysis for any player" },
      { name: "Player Comparison", description: "Side-by-side player comparison across all fantasy-relevant metrics" },
      { name: "ROS Projections", description: "Rest-of-season point projections using statistical modeling" },
      { name: "Season-Long Projections", description: "Full-season Monte Carlo point projections with confidence intervals" },
      { name: "NFL Stat Leaders", description: "Dedicated stat leaders page for all major NFL statistical categories" },
      { name: "Injury Tracker", description: "Real-time injury status tracking with fantasy impact analysis" },
      { name: "Usage Trends", description: "Snap counts, target share, and usage rate trend analysis" },
    ],
  },
  {
    title: "Devy Command Center",
    description: "Complete prospect tracking and college player analysis for dynasty leagues",
    icon: GraduationCap,
    features: [
      { name: "Tier Visualization", description: "Visual tier-based prospect rankings with position filtering" },
      { name: "Portfolio View", description: "Track your devy investments across all leagues in one view" },
      { name: "Market Intelligence", description: "Prospect valuation trends and market movement tracking" },
      { name: "Enhanced Player Profiles", description: "Detailed prospect profiles with Outlook tab and college stats" },
      { name: "Devy Placeholder Detection", description: "Automatic detection and display of devy players from commissioner notes" },
      { name: "College Advanced Stats", description: "CFBD-powered college performance metrics and advanced analytics" },
      { name: "Transfer Portal Tracker", description: "Track college transfer portal movement with dynasty impact analysis" },
    ],
  },
  {
    title: "Draft Central",
    description: "Complete draft preparation, live draft tools, and post-draft analysis",
    icon: Layers,
    features: [
      { name: "2026 Draft Board", description: "Comprehensive draft board with prospect rankings and team needs" },
      { name: "Draft War Room", description: "Pre-draft preparation with value-based drafting strategy tools" },
      { name: "Draft Pick Value Chart", description: "Quantified draft pick values for trade evaluation" },
      { name: "Live Draft Board", description: "Real-time draft board pulling picks from Sleeper draft API with auto-refresh", premium: true },
      { name: "Smart Draft Assistant", description: "AI recommendations during active drafts showing roster needs and suggested picks", premium: true, aiPowered: true },
      { name: "Draft Pick Predictions", description: "AI predictions for upcoming draft picks based on team needs and tendencies", premium: true, aiPowered: true },
      { name: "Draft Recap & Grades", description: "AI-powered post-draft analysis with letter grades per team and best/worst pick analysis", premium: true, aiPowered: true },
    ],
  },
  {
    title: "AI-Powered Analysis",
    description: "GPT-4o-mini powered insights and analysis across the platform",
    icon: Sparkles,
    features: [
      { name: "AI Chat Assistant", description: "Conversational AI assistant that answers fantasy football questions with context from your league and roster data", premium: true, aiPowered: true },
      { name: "AI Manager Profile", description: "AI-learned manager personality system analyzing trade history, waiver moves, and transaction patterns. Builds a profile injected into AI Chat and Trade Analyzer for personalized recommendations", premium: true, aiPowered: true },
      { name: "Trash Talk Generator", description: "AI-generated custom trash talk based on league matchups and rivalry history", premium: true, aiPowered: true },
      { name: "Mid-Season Review", description: "Comprehensive AI-powered mid-season team analysis with actionable recommendations", premium: true, aiPowered: true },
      { name: "Shareable Team Reports", description: "AI-generated team analysis reports that can be shared with league members" },
    ],
  },
  {
    title: "Community & Social",
    description: "Connect with other managers and track global rankings",
    icon: Users,
    features: [
      { name: "Friends System", description: "Search for other users, send/accept friend requests, and manage your friends list" },
      { name: "User Profile", description: "Public profile page with career stats, friend count, editable bio (500 char max), and favorite sports teams (NFL, NBA, MLB, NHL)" },
      { name: "Community Leaderboard", description: "Global rankings aggregating stats across all registered users, sortable by championships, wins, win%, points, or leagues" },
      { name: "Community Chat Room", description: "Global chat room for all app users with real-time polling updates" },
      { name: "Share Website Button", description: "Quick share functionality to spread the word about the app" },
    ],
  },
  {
    title: "Platform Features",
    description: "Technical capabilities that enhance the overall experience",
    icon: Settings,
    features: [
      { name: "Mobile PWA", description: "Progressive Web App with offline support, install-to-homescreen prompt, and native-like mobile experience" },
      { name: "Mobile Bottom Navigation", description: "Optimized bottom navigation bar for mobile users" },
      { name: "Offline Caching", description: "React Query persistence with localStorage for instant loading on repeat visits (24h cache)" },
      { name: "Notification Preferences", description: "User-level settings to toggle alerts for trades, waivers, injuries, scoring, and more" },
      { name: "Export Functionality", description: "Export data from Power Rankings, Standings, Roster, Trade Calculator, and more" },
      { name: "Strength of Schedule Analysis", description: "Remaining schedule difficulty analysis for all teams" },
      { name: "News Feed", description: "Aggregated fantasy-relevant NFL news and updates" },
    ],
  },
];

export default function FeaturesPage() {
  usePageTitle("All Features");

  useEffect(() => {
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (name.startsWith("og:")) {
          el.setAttribute("property", name);
        } else {
          el.setAttribute("name", name);
        }
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", "DT Sleeper Agent - The ultimate dynasty fantasy football companion for Sleeper. 80+ features including Monte Carlo simulations, AI-powered insights, dynasty trade calculator, and advanced analytics.");
    setMeta("og:title", "DT Sleeper Agent - All Features");
    setMeta("og:description", "Advanced dynasty fantasy football analytics with Monte Carlo simulations, AI-powered insights, trade calculator, and 80+ features for Sleeper leagues.");
    setMeta("og:type", "website");
  }, []);

  const totalFeatures = FEATURE_CATEGORIES.reduce((sum, cat) => sum + cat.features.length, 0);
  const premiumFeatures = FEATURE_CATEGORIES.reduce((sum, cat) => sum + cat.features.filter(f => f.premium).length, 0);
  const aiFeatures = FEATURE_CATEGORIES.reduce((sum, cat) => sum + cat.features.filter(f => f.aiPowered).length, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Crown className="h-10 w-10 text-amber-400" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent" data-testid="text-features-title">
              DT Sleeper Agent
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The ultimate dynasty fantasy football companion for Sleeper. Advanced analytics, AI-powered insights, and Monte Carlo simulations to dominate your league.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 px-3 py-1" data-testid="badge-total-features">
              {totalFeatures} Features
            </Badge>
            <Badge variant="outline" className="text-purple-400 border-purple-500/30 px-3 py-1" data-testid="badge-ai-features">
              {aiFeatures} AI-Powered
            </Badge>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 px-3 py-1" data-testid="badge-premium-features">
              {premiumFeatures} Premium
            </Badge>
          </div>
        </div>

        <Card className="border-amber-500/20 bg-zinc-950">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-amber-400 mb-3">Technical Architecture</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Frontend</p>
                <p>React + TypeScript, Vite, TanStack Query, Shadcn/ui, Tailwind CSS</p>
              </div>
              <div>
                <p className="text-muted-foreground">Backend</p>
                <p>Express.js + TypeScript, Node.js, RESTful API</p>
              </div>
              <div>
                <p className="text-muted-foreground">Database</p>
                <p>PostgreSQL with Drizzle ORM</p>
              </div>
              <div>
                <p className="text-muted-foreground">AI Engine</p>
                <p>GPT-4o-mini via OpenAI API</p>
              </div>
              <div>
                <p className="text-muted-foreground">Simulation Engine</p>
                <p>Monte Carlo (10K+ iterations), Cholesky decomposition, Box-Muller transform</p>
              </div>
              <div>
                <p className="text-muted-foreground">Data Sources</p>
                <p>Sleeper API, ESPN API, CFBD API, FantasyPros, nflverse</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dynasty Values</p>
                <p>Custom VOR algorithm with 50/50 KTC blend (0-10,000 scale)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payments</p>
                <p>Stripe subscription billing</p>
              </div>
              <div>
                <p className="text-muted-foreground">Platform</p>
                <p>PWA with offline caching, mobile-optimized</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {FEATURE_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.title} className="border-zinc-800 bg-zinc-950" data-testid={`card-category-${category.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Icon className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-amber-400">{category.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs border-zinc-700">{category.features.length} features</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.features.map((feature) => (
                      <div
                        key={feature.name}
                        className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1"
                        data-testid={`feature-${feature.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{feature.name}</span>
                          {feature.premium && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-400 border-amber-500/30">PREMIUM</Badge>
                          )}
                          {feature.aiPowered && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-purple-400 border-purple-500/30">AI</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-amber-500/20 bg-zinc-950">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-amber-400 mb-3">Decision Engine Architecture (5 Layers)</h2>
            <div className="space-y-3">
              {[
                { layer: "1. Data Ingestion", desc: "Pulls rosters, matchups, projections, scoring settings, and standings from Sleeper API. Caches with configurable TTLs." },
                { layer: "2. Projection Modeling", desc: "Builds player projections from weekly game logs using league-specific scoring. Computes median, floor, ceiling, stdDev with Bessel's correction and minimum variance floors." },
                { layer: "3. Monte Carlo Simulation", desc: "10,000+ correlated iterations using Box-Muller normal sampling and Cholesky decomposition for player correlation (QB-WR stacks, etc). Positive-definite matrix correction with shrinkage." },
                { layer: "4. Decision Optimization", desc: "Lineup optimizer (greedy with FLEX handling), trade evaluator (ROS delta + championship equity), FAAB optimizer (game theory bidding), championship path (week-by-week odds progression)." },
                { layer: "5. LLM Explanation", desc: "GPT-4o-mini explains pre-computed mathematical results in natural language. The AI never generates statistics - it only narrates what the math already determined." },
              ].map((item) => (
                <div key={item.layer} className="flex gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 shrink-0 h-fit">{item.layer}</Badge>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-4">
          <Link href="/">
            <Button className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30" data-testid="button-back-home">
              Back to App
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
