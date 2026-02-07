# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application designed for Sleeper league users. It aims to provide comprehensive league management tools, advanced analytics, and AI-powered insights to enhance the fantasy football experience. Key capabilities include custom dynasty trade calculators, waiver wire analysis, playoff predictions, historical data tracking, and a trophy room for league achievements. The application integrates with the Sleeper API for real-time data and leverages AI for intelligent analysis and recommendations, striving to be the ultimate tool for fantasy football enthusiasts.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Design: Modern tech theme with black background and electric blue/cyan accent color (#00D4FF, HSL 187 100% 50%). Features glow effects on hover, cyan-tinted borders, and accent highlights on key metrics and interactive elements.

## System Architecture

### UI/UX Decisions
- **Action-First Dashboard**: Prioritizes personalized recommendations, roster strength, team profile (Contender/Balanced/Rebuild), biggest need, and weekly AI insights.
- **Persistent League Selector**: Always visible for quick league switching.
- **Consolidated Navigation**: Grouped collapsible sections (League, My Team, Players, Trades).
- **Design Theme**: Modern tech theme with black background and electric blue/cyan accent color, featuring glow effects, cyan-tinted borders, and accent highlights.
- **Position Colors**: Distinct colors for player positions - QB (red), RB (green), WR/WRS (blue/cyan), TE (yellow), K (orange), EDGE (rose), DL/DL1T/DL3T/DL5T (amber/yellow), LB/ILB (cyan), CB (purple), S (pink), FLEX (pink), SUPERFLEX (teal).
- **League Breakdown**: Uniform grid layout showing League Name, Record, Place, Status, and Movement columns. Movement indicator shows "--" placeholder until accurate data source is available.

### Technical Implementations
- **Frontend**: React with TypeScript, Vite, Wouter for routing, TanStack React Query for state, Shadcn/ui (Radix UI) for components, Tailwind CSS for styling.
- **Backend**: Express.js with TypeScript, Node.js, RESTful API design.
- **Data Storage**: PostgreSQL with Drizzle ORM for database and session management.
- **Authentication**: Replit Auth integration with session management.
- **Build**: ESBuild for production bundling.

### Feature Specifications
- **Career Stats (All Leagues)**: Aggregated W-L-T, championships, playoff appearances across all historical seasons.
- **Standings**: League standings with playoff predictions.
- **News Feed**: Real-time AI-generated fantasy news, injury updates, waiver recommendations.
- **Matchups**: Current week matchups with live scoring, including Median Tracker for median leagues.
- **Median Tracker**: Detects `league_average_match` setting, tracks season W-L-T vs median, shows current week status (above/below median) with live 30-second updates during games.
- **Lineup Advice**: AI-powered start/sit recommendations.
- **Schedule**: Full season schedule.
- **Playoff Bracket**: Visual bracket display.
- **Rivalries**: Head-to-head records.
- **Waiver Wire**: Available players with personalized recommendations.
- **Player Watchlist**: Track players and dynasty value changes.
- **Smart Trade Ideas**: AI-powered trade suggestions and fairness scoring.
- **NFL Players**: Player rankings and profiles.
- **Player Profile Modal**: Comprehensive player stats, bio, career history, game logs. Analytics tab with nflverse advanced metrics (target share, air yards share, WOPR, PPG) for offensive players, plus Dynasty Process market values and ECR rankings.
- **Player Trends**: Multi-season performance tracking.
- **Player Comparison**: Side-by-side comparison for trade evaluation.
- **ROS Projections**: Advanced rest-of-season projections with AI outlooks.
- **Devy Rankings**: College prospects (2027+ draft eligible) with dynasty-specific metrics, AI scouting analysis, and CFBD advanced stats. Separated from current draft class.
- **2026 Draft Board**: Comprehensive draft page (merged Draft Board + War Room) for current NFL Draft class (~360 prospects) with Full Board tab (offense/defense/IDP filtering, sortable columns, position groups, stock movement indicators, intangibles) and Stock Watch tab (rising/falling prospects). Player profiles include bio, college stats, CFBD advanced analytics, combine data (TBD), intangibles, and scouting notes. Stored in `server/draft-2026-data.ts`.
- **Trade Calculator**: Custom dynasty value calculations with AI analysis.
- **Trade History**: Historical trades with AI insights.
- **Trophy Room**: League achievements.
- **Real-Time Notifications**: Bell icon for trades, waivers, free agent pickups.

### System Design Choices
- **Shared Types**: Database schemas and models are shared between frontend and backend.
- **Storage Pattern**: Database operations abstracted via storage classes.
- **API Integration**: External API calls are wrapped in dedicated service modules.
- **Authentication Middleware**: `isAuthenticated` protects routes; `req.user.claims.sub` for user ID.
- **Auth Upsert with Email Conflict**: Handles user data migration during email conflicts.
- **Notification Sync Pattern**: Uses POST for notification sync due to complex data needs.
- **Conditional Component Pattern**: Pages requiring `leagueId` ensure its validity before rendering child components.
- **React Query Keys**: Uses array format for robust caching.
- **`useSelectedLeague` Hook**: Centralized league selection state management.
- **Dynasty Value Engine**: Custom algorithm calculating player values (0-100 scale) based on multi-year VOR, age, role security, injury risk, production ceiling, volatility, draft capital, team context, scarcity bonus, and market calibration.
- **Consolidation Premium**: Trade calculator applies a star player premium (similar to KTC's "Value Adjustment") when trading fewer, higher-value assets for multiple pieces. Elite players (93+) receive ~35-42% boost, scaling down for lower tiers. Premium considers piece differential and value concentration.
- **Multi-Source Data Architecture**: Extensible system designed for future aggregation of player data from multiple sources:
  - **DT Dynasty (Curated Devy)**: Primary source for devy rankings (2027+ eligible) with hand-curated college prospect data, values, tiers, draft projections, and player comparisons.
  - **DT Draft 2026 (Curated)**: Current NFL Draft class data (~360 prospects) including IDP positions (EDGE, DL1T/DL3T/DL5T, ILB/LB, CB, S). Stored in `server/draft-2026-data.ts`.
  - **Dynasty Process (NFL Values)**: GitHub-hosted CSV with NFL player dynasty values, fetched with 24-hour cache. Weekly updates. Used for NFL player values in trade calculator, NOT for devy prospects.
  - **Dynasty Process ECR**: Expert Consensus Rankings aggregated from FantasyPros data, integrated into trade calculator's Market Comparison panel.
  - **nflverse (Production Stats)**: Open-source NFL play-by-play data from GitHub releases. Provides advanced metrics (target share, air yards share, WOPR, PPG, catch rate, yards per carry) for player profile Analytics tab. 24-hour cache.
  - **CFBD (College Advanced Stats)**: College Football Data API providing PPA metrics, usage rates by down/situation, and detailed season stats. Integrated into devy profile modal (Advanced tab) and draft profile modal. 24-hour cache, API key in secrets.
  - **Future Expansion**: Infrastructure ready for additional sources (e.g., FantasyPros consensus) when legitimate APIs become available. Most devy ranking sites (247Sports, Rivals) don't offer public APIs.

## External Dependencies

### Third-Party APIs
- **Sleeper API**: For fantasy football league data.
- **ESPN API**: For player statistics, game logs, and career data.
- **CFBD API**: College Football Data API for advanced college metrics (PPA, usage rates, season stats). API key stored in secrets.
- **OpenAI API**: Integrated via Replit AI Integrations for advanced AI analysis (trade, news, lineup, projections).

### Database
- **PostgreSQL**: Primary database.

### Authentication
- **Replit Auth**: OpenID Connect authentication.

### Monetization
- **Stripe**: Payment gateway for premium subscriptions ($3.99/week).
- **PremiumGate Component**: Wraps premium page content; shows upgrade prompt for free users.
- **Sidebar Crown Icons**: Premium features show a small crown icon for non-subscribers.
- **Free Features**: Dashboard, Standings, Matchups (basic), Roster, Schedule, Playoff Bracket, Trophy Room, Rivalries, League Info, NFL Players, Depth Charts.
- **Premium Features ($3.99/week)**: Trade Calculator, Trade History, Lineup Advice, Waiver Wire, Player Trends, Player Comparison, ROS Projections, 2026 Draft Board, Devy Rankings, Fantasy News, Watchlist.

### SEO
- **Static SEO**: index.html has meta description, keywords, Open Graph tags, Twitter cards, JSON-LD structured data, canonical URL, robots meta, and pre-rendered HTML content visible to crawlers.
- **Dynamic Page Titles**: `usePageTitle` hook in `client/src/hooks/use-page-title.ts` sets per-page document titles (e.g., "Trade Calculator | DT Sleeper Agent").