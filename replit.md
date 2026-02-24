# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application designed for Sleeper league users. It provides comprehensive league management tools, advanced analytics, and AI-powered insights to enhance the fantasy football experience. Key capabilities include custom dynasty trade calculators, waiver wire analysis, playoff predictions, historical data tracking, and a trophy room for league achievements. The application integrates with the Sleeper API for real-time data and leverages AI for intelligent analysis and recommendations, aiming to be the ultimate tool for fantasy football enthusiasts.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Design: Premium dark theme with black background and amber/gold accent color (HSL 38 75% 55%). Features gold glow effects on hover, amber-tinted borders, and warm gold accent highlights on key metrics and interactive elements.

## System Architecture

### UI/UX Decisions
- **Command Center V2 (War Room)**: Sticky Identity Header with Championship Equity hero (gold gradient, sparkline, 7d delta badge) plus Win Probability, Playoff Rate, Risk Index KPIs. Strategic Snapshot (Primary Constraint + Highest EV Action left column, Momentum + League Pressure right column). Portfolio Architecture (position strength bars + fragility/volatility/diversification gauges). Scenario Simulator strip (4 cards linking to Decision Engine tabs). Title Path Visualization (season journey timeline + win-rate distribution chart). Collapsible Signals panel (max 3 visible, AI insights + recommendations + activity). 3-color system: gold (primary/opportunity), green (positive ≥60%), red (risk <45%). Signal-first with bold metrics, minimal text.
- **Persistent League Selector**: Always visible for quick league switching.
- **Hierarchical Sidebar Navigation**: 4 strategic top-level categories (Command Center, Game Day Engine, Market & Trades, Season Strategy) with collapsible accordion structure, plus Draft Central, Devy Command Center, and a "More" utility section. Subgroup headers in Market & Trades (Trade Lab/Market Intel/Waivers) and Season Strategy (Title Strategy/Risk & Capital/League Edge). Designed for quant-trading-dashboard aesthetic with reduced cognitive load.
- **Merged Pages**: Lineup Lab (`/league/lineup-lab`) merges Lineup Optimizer, Lineup Advice, Boom/Bust Cards, Predictions into tabbed interface. Game Context (`/league/game-context`) merges Schedule and Injury Report. Legacy routes redirect to new tab containers with query params.
- **Design Theme**: Premium dark theme with black background and amber/gold accent color, featuring gold glow effects, amber-tinted borders, and warm gold accent highlights.
- **Position Colors**: Distinct colors for player positions (QB, RB, WR, TE, K, EDGE, DL, LB, CB, S, FLEX, SUPERFLEX).
- **League Breakdown**: Uniform grid layout showing League Name, Record, Place, Status, and Movement.

### Technical Implementations
- **Frontend**: React with TypeScript, Vite, Wouter for routing, TanStack React Query for state, Shadcn/ui for components, Tailwind CSS for styling.
- **Backend**: Express.js with TypeScript, Node.js, RESTful API design.
- **Data Storage**: PostgreSQL with Drizzle ORM.
- **Authentication**: Custom Email/Password Auth with `bcrypt` and `express-session`, integrated with Replit Auth for session management.
- **Build**: ESBuild for production bundling.

### Feature Specifications
- **Core Features**: Career Stats (All Leagues), Standings, News Feed, Matchups with Median Tracker, Lineup Advice, Schedule, Playoff Bracket, Rivalries, Waiver Wire, Player Watchlist, Smart Trade Ideas, NFL Players, Player Profile Modal, Player Trends, Player Comparison, ROS Projections, Devy Command Center (tier visualization, portfolio view, market intelligence, enhanced player profiles with Outlook tab), 2026 Draft Board, Draft War Room, Trade Lab (unified: Quick Check + Impact Simulation + Strategy AI at `/league/trade-lab`), Trade History, Trophy Room, AI Chat Assistant, Real-Time Notifications, Power Rankings, Lineup Optimizer, Export Functionality, Draft Pick Value Chart, League History Timeline, NFL Stat Leaders (dedicated page at `/league/stat-leaders`), Share Website Button, Mobile Bottom Nav, Strength of Schedule Analysis, League Activity Feed, Season-Long Projections (Monte Carlo), Usage Trends, Injury Tracker, Shareable Team Reports.
- **AI-Powered Premium Features**: Trash Talk Generator (`/league/trash-talk`), Boom/Bust Probability Cards (in Lineup Lab), Trade Lab Strategy AI (in Trade Lab `/league/trade-lab?tab=strategy`), Mid-Season Review (`/league/mid-season-review`), Taxi Squad Optimizer (`/league/taxi-optimizer`), Matchup Heat Maps (`/league/matchup-heatmap`), Draft Pick Predictions (`/league/draft-predictions`), Power Rankings Commentary (integrated into power-rankings page). All use GPT-4o-mini and are premium-gated.
- **Offline Caching**: React Query persistence via `@tanstack/react-query-persist-client` with localStorage. Selectively caches players, league-info, standings, roster, and user data for faster repeat visits (24h max age).
- **Multi-League Dashboard Enhancements**: Sort leagues by rank/record/points/name, quick-action links (Roster/Matchups/Standings) per league card, matchup previews.
- **Export Coverage**: ExportButton on Power Rankings, Standings, Roster, Trade Calculator, Trade History, Matchups, Schedule, Players, Watchlist, Devy Rankings, Draft Board, Stat Leaders.
- **Devy Placeholder Detection**: `parseDevyNote()` function in `server/routes.ts` extracts devy player details from commissioner notes on roster and draft board views.
- **Elite Player Profile v2**: 9-module structured player analysis in player profile modal "Elite" tab. Modules: archetype engine (8 types), Dynasty Asset Score composite (6 weighted grades), Monte Carlo distribution (5K iterations with histogram), 3-year age curve projection, correlation/stack risk calculator, market sentiment layer, stress test simulator (5 scenarios with sensitivity), conditional devy prospect intel, AI executive summary from structured JSON inputs. Backend engine at `server/engine/player-profile-engine.ts`. All AI explanations derived from pre-computed structured data, never freeform LLM reasoning.
- **Dynasty Value Engine**: Custom algorithm calculating player values (0-10,000 scale) based on VOR, age, role security, injury risk, production ceiling, volatility, draft capital, team context, scarcity bonus, and 50/50 KTC consensus blend. Production-weighted: elite producers get 1.55-1.65x ceiling multiplier; youth bonus capped at 10%; draft capital decays within 3 years; unproven players with no snap data penalized at 0.82x role security.
- **Consolidation Premium**: Trade calculator applies a star player premium when trading fewer, higher-value assets for multiple pieces.
- **Friends System**: Users can search for other app users, send/accept/reject friend requests, and manage their friends list. Friend status shown on profile pages.
- **User Profile**: Public profile page (`/profile/:userId`) showing career stats, friend count, membership info, editable bio (500 char max), and favorite sports teams (NFL, NBA, MLB, NHL selection). Own profile includes friend management and user search.
- **Community Leaderboard**: Global rankings page (`/leaderboard`) aggregating stats across all registered users. Sortable by championships, wins, win%, points, or leagues. Stats computed from Sleeper API with 1-hour refresh cooldown.
- **League Accounting**: Per-league financial ledger (`/league/accounting`) for tracking dues, prizes, penalties. All-leagues summary page (`/accounting`) aggregates totals across all leagues.
- **Weekly Predictions Leaderboard**: Users predict matchup winners each week (`/league/predictions`), track accuracy, and compete on a predictions leaderboard. Premium-gated.
- **Community Chat Room**: Global chat room (`/chat`) for all app users, using Sleeper usernames. Polling-based real-time updates (5s refresh). Messages stored in database.
- **Draft Recap & Grades**: AI-powered post-draft analysis (`/league/draft-recap`) using GPT-4o-mini. Letter grades per team, best/worst pick analysis. Premium-gated.
- **AI Manager Profile**: AI-learned manager personality system (`/league/manager-profile`). Analyzes up to 3 seasons of trade history, waiver moves, and transaction patterns per league. v2 upgrade: dynasty-optimized with professional asset management language, quantified behavior metrics (trade percentile, pick exposure %, age curve bias with net delta), format detection (Dynasty/Redraft/Best Ball/Devy), radar chart (6 axes: variance/youth/picks/trades/balance/contender), positional investment bias vs league average, strategic tendencies, competitive advantages, strategic leaks, dynasty-only sections (Asset Portfolio Outlook with volatility/liquidity scores, Competitive Timeline Projection), redraft compatibility (Short-Term Competitive Index, Roster Stability Score). All metrics pre-computed server-side from raw transaction data; AI generates qualitative analysis from structured inputs. Profile context is injected into AI Chat and Trade Analyzer for personalized recommendations.
- **Live Draft Board**: Real-time draft board (`/league/live-draft`) pulling picks from Sleeper draft API. Auto-refreshes every 10 seconds. Premium-gated.
- **Smart Draft Assistant**: AI recommendations during active drafts (`/league/draft-assistant`). Shows upcoming picks, roster needs, suggested players. Premium-gated.
- **Notification Preferences**: User-level settings page (`/settings/notifications`) to toggle alerts for trades, waivers, injuries, scoring, free agents, draft picks, league announcements.
- **Mobile PWA Enhancements**: Web manifest, service worker for offline support, install-to-homescreen prompt banner for mobile users.
- **Decision Engine** (`/league/decision-engine`): Full fantasy football decision optimization system with 5-layer architecture (Data Ingestion → Projection Modeling → Monte Carlo Simulation → Decision Optimization → LLM Explanation). Features: Matchup Simulator (10K correlated Monte Carlo iterations with volatility/upset/confidence metrics), Lineup Optimizer (EV-maximizing lineup construction), Trade Evaluator (championship equity delta, ROS point delta, positional scarcity), FAAB Optimizer (game theory bidding with opponent simulation), Season Outlook (playoff/championship probabilities), Portfolio Risk Strategic Simulator (archetype classification with 6 types, impact translation layer mapping risk→weekly variance/playoff prob/title equity, stress tests on top 3 concentrated teams, 4 interactive what-if toggles with recalculated metrics, quantitative Bloomberg-style AI analysis), Championship Path Optimizer ("12% → 17% title odds"), Exploit Report (desperate teams, overconfident teams, bye-week crunch, low FAAB vulnerability, overexposed offenses), Regression & Market Edge Alerts (TD overperformance, usage spikes/declines, breakout candidates, regression risks), Title Equity Tracker (championship/playoff odds over time with bar charts). Enhanced correlation matrix: QB-WR (0.45), RB-DEF (-0.15), same-team WR cannibalization (-0.08), game stack (0.15). All computations are pure math - LLM only explains pre-computed metrics. Engine modules in `server/engine/`. DB tables: simulation_results, engine_risk_profiles, portfolio_snapshots, title_equity_snapshots. Premium-gated.

### System Design Choices
- **Shared Types**: Database schemas and models shared between frontend and backend.
- **Storage Pattern**: Database operations abstracted via storage classes.
- **API Integration**: External API calls wrapped in dedicated service modules.
- **Authentication Middleware**: `isAuthenticated` protects routes.
- **Auth Upsert with Email Conflict**: Handles user data migration during email conflicts.
- **Notification Sync Pattern**: Uses POST for notification sync.
- **Conditional Component Pattern**: Pages requiring `leagueId` ensure its validity before rendering.
- **React Query Keys**: Uses array format for robust caching.
- **`useSelectedLeague` Hook**: Centralized league selection state management.
- **Multi-Source Data Architecture**: Extensible system designed for aggregating player data from multiple sources including DT Dynasty (Curated Devy), DT Draft 2026 (Curated), Dynasty Process (NFL Values & ECR), nflverse (Production Stats), CFBD (College Advanced Stats), and FantasyPros Devy Rankings.

## External Dependencies

### Third-Party APIs
- **Sleeper API**: Fantasy football league data.
- **ESPN API**: Player statistics, game logs, career data.
- **CFBD API**: College Football Data API for advanced college metrics.
- **OpenAI API**: Via Replit AI Integrations for advanced AI analysis.

### Database
- **PostgreSQL**: Primary database for data and session management.

### Authentication
- **Custom Email/Password Auth**: With `bcrypt` password hashing and `express-session` for session management.

### Monetization
- **Stripe**: Payment gateway for premium subscriptions.
- **PremiumGate Component**: Manages access to premium content.

### SEO
- **Static SEO**: `index.html` includes meta tags, Open Graph, Twitter cards, JSON-LD, canonical URL, robots meta, and pre-rendered HTML.
- **Dynamic Page Titles**: `usePageTitle` hook sets per-page document titles.