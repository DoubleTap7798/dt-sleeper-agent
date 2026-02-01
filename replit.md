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
- **Matchups**: Current week matchups with live scoring.
- **Lineup Advice**: AI-powered start/sit recommendations.
- **Schedule**: Full season schedule.
- **Playoff Bracket**: Visual bracket display.
- **Rivalries**: Head-to-head records.
- **Waiver Wire**: Available players with personalized recommendations.
- **Player Watchlist**: Track players and dynasty value changes.
- **Smart Trade Ideas**: AI-powered trade suggestions and fairness scoring.
- **NFL Players**: Player rankings and profiles.
- **Player Profile Modal**: Comprehensive player stats, bio, career history, game logs.
- **Player Trends**: Multi-season performance tracking.
- **Player Comparison**: Side-by-side comparison for trade evaluation.
- **ROS Projections**: Advanced rest-of-season projections with AI outlooks.
- **Devy Rankings**: College prospects with AI scouting analysis.
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

## External Dependencies

### Third-Party APIs
- **Sleeper API**: For fantasy football league data.
- **ESPN API**: For player statistics, game logs, and career data.
- **OpenAI API**: Integrated via Replit AI Integrations for advanced AI analysis (trade, news, lineup, projections).

### Database
- **PostgreSQL**: Primary database.

### Authentication
- **Replit Auth**: OpenID Connect authentication.

### Monetization
- **Stripe**: Payment gateway for premium subscriptions.
- **PayPal**: Alternative payment gateway for premium subscriptions.