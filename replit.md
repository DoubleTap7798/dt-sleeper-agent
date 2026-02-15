# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application designed for Sleeper league users. It provides comprehensive league management tools, advanced analytics, and AI-powered insights to enhance the fantasy football experience. Key capabilities include custom dynasty trade calculators, waiver wire analysis, playoff predictions, historical data tracking, and a trophy room for league achievements. The application integrates with the Sleeper API for real-time data and leverages AI for intelligent analysis and recommendations, aiming to be the ultimate tool for fantasy football enthusiasts.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Design: Modern tech theme with black background and electric blue/cyan accent color (#00D4FF, HSL 187 100% 50%). Features glow effects on hover, cyan-tinted borders, and accent highlights on key metrics and interactive elements.

## System Architecture

### UI/UX Decisions
- **Action-First Dashboard**: Prioritizes personalized recommendations, roster strength, team profile, biggest need, and weekly AI insights.
- **Persistent League Selector**: Always visible for quick league switching.
- **Consolidated Navigation**: Grouped collapsible sections (League, My Team, Players, Trades).
- **Design Theme**: Modern tech theme with black background and electric blue/cyan accent color, featuring glow effects, cyan-tinted borders, and accent highlights.
- **Position Colors**: Distinct colors for player positions (QB, RB, WR, TE, K, EDGE, DL, LB, CB, S, FLEX, SUPERFLEX).
- **League Breakdown**: Uniform grid layout showing League Name, Record, Place, Status, and Movement.

### Technical Implementations
- **Frontend**: React with TypeScript, Vite, Wouter for routing, TanStack React Query for state, Shadcn/ui for components, Tailwind CSS for styling.
- **Backend**: Express.js with TypeScript, Node.js, RESTful API design.
- **Data Storage**: PostgreSQL with Drizzle ORM.
- **Authentication**: Custom Email/Password Auth with `bcrypt` and `express-session`, integrated with Replit Auth for session management.
- **Build**: ESBuild for production bundling.

### Feature Specifications
- **Core Features**: Career Stats (All Leagues), Standings, News Feed, Matchups with Median Tracker, Lineup Advice, Schedule, Playoff Bracket, Rivalries, Waiver Wire, Player Watchlist, Smart Trade Ideas, NFL Players, Player Profile Modal, Player Trends, Player Comparison, ROS Projections, Devy Command Center (tier visualization, portfolio view, market intelligence, enhanced player profiles with Outlook tab), 2026 Draft Board, Draft War Room, Trade Calculator, Trade History, Trophy Room, AI Chat Assistant, Real-Time Notifications, Power Rankings, Lineup Optimizer, Export Functionality, Draft Pick Value Chart, League History Timeline, NFL Stat Leaders (dedicated page at `/league/stat-leaders`), Share Website Button, Mobile Bottom Nav, Strength of Schedule Analysis, League Activity Feed, Season-Long Projections (Monte Carlo), Usage Trends, Injury Tracker, Shareable Team Reports.
- **Offline Caching**: React Query persistence via `@tanstack/react-query-persist-client` with localStorage. Selectively caches players, league-info, standings, roster, and user data for faster repeat visits (24h max age).
- **Multi-League Dashboard Enhancements**: Sort leagues by rank/record/points/name, quick-action links (Roster/Matchups/Standings) per league card, matchup previews.
- **Export Coverage**: ExportButton on Power Rankings, Standings, Roster, Trade Calculator, Trade History, Matchups, Schedule, Players, Watchlist, Devy Rankings, Draft Board, Stat Leaders.
- **Devy Placeholder Detection**: `parseDevyNote()` function in `server/routes.ts` extracts devy player details from commissioner notes on roster and draft board views.
- **Dynasty Value Engine**: Custom algorithm calculating player values (0-10,000 scale) based on VOR, age, role security, injury risk, production ceiling, volatility, draft capital, team context, scarcity bonus, and 50/50 KTC consensus blend. Production-weighted: elite producers get 1.55-1.65x ceiling multiplier; youth bonus capped at 10%; draft capital decays within 3 years; unproven players with no snap data penalized at 0.82x role security.
- **Consolidation Premium**: Trade calculator applies a star player premium when trading fewer, higher-value assets for multiple pieces.

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