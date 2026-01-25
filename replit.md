# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application for Sleeper leagues. It provides league management tools including trade calculators with custom dynasty values, waiver wire analysis, playoff predictions, trade history tracking, rivalry head-to-head records, and a trophy room for league achievements. The application integrates with the Sleeper API to fetch real-time league data and uses AI (OpenAI) for trade analysis and recommendations.

## Features
- **Career Stats (All Leagues)**: Default view showing aggregated statistics across ALL historical seasons - total W-L-T record, championships, runner-ups, playoff appearances, and season-by-season breakdown with navigation filtered to career-level pages
- **Standings**: League standings with playoff predictions, clickable teams show roster and draft picks
- **News Feed**: Real-time fantasy football news and analysis with injury updates, trade rumors, waiver recommendations, and player analysis - AI-generated with 5-minute refresh
- **Matchups**: Current week matchups with live scoring, expandable to see player breakdowns
- **Lineup Advice**: AI-powered start/sit recommendations with matchup analysis, projected points, confidence ratings, game script predictions, and smart swap suggestions
- **Schedule**: Full season schedule with week-by-week matchups, opponents, scores, and W/L/T results
- **Playoff Bracket**: Visual bracket display with matchups organized by round (Quarterfinals, Semifinals, Championship)
- **Rivalries**: Head-to-head records between teams across all seasons
- **Waiver Wire**: Available players and stats
- **NFL Players**: Player rankings by fantasy points with snap %, position-specific stats (1st downs, targets, attempts), click to view full player profile
- **Player Profile Modal**: Click any player to view comprehensive stats including bio (height, weight, college, draft info), career stats, season-by-season history, game logs, and performance splits (home/away, wins/losses)
- **Player Trends**: Multi-season performance tracking with year-over-year analysis, career trajectory visualization, and historical PPG trends
- **Player Comparison**: Side-by-side comparison tool for 2-4 players showing stats, dynasty values, projections, and visual stat comparisons for trade evaluation with full stats modal access
- **ROS Projections**: Advanced rest-of-season projections with AI-generated outlooks, confidence ratings, upside/floor analysis, schedule strength, injury risk, and key factors
- **Devy Rankings**: College prospects NOT yet drafted or rostered on an NFL team. Shows tier, value, trend, position ranks, draft eligibility years (2026-2028), and real ESPN college stats (bio, seasons, career totals, game logs) with AI scouting analysis. Dynamically filters out players who have since been drafted to the NFL.
- **Player Headshots**: ESPN CDN headshots displayed across all views (roster, players list, Devy profiles) with Avatar component fallback to initials when unavailable
- **Trade Calculator**: Calculate trade values with custom dynasty values (0-100 scale) and AI analysis
- **Trade History**: Historical trades from ALL league years with AI insights
- **Trophy Room**: Champions, all-time standings, season records
- **Real-Time Notifications**: Bell icon in header shows trades, waiver claims, and free agent pickups with auto-sync every 60 seconds

## User Preferences

- Preferred communication style: Simple, everyday language.
- Design: Strict pure grayscale theme (0% saturation) - no colored highlights, all UI elements use semantic grayscale tokens (text-muted-foreground, bg-muted, etc.)

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark/light mode support)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for development
- **API Design**: RESTful endpoints prefixed with `/api/`
- **Authentication**: Replit Auth integration with session management via connect-pg-simple
- **Build**: ESBuild for production bundling with selective dependency bundling

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all database models
- **Migrations**: Drizzle Kit for schema management (`db:push` command)
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple

### Key Design Patterns
- **Shared Types**: Database schemas in `shared/` are shared between frontend and backend
- **Storage Pattern**: Database operations abstracted through storage classes (e.g., `DatabaseStorage`, `AuthStorage`)
- **API Integration**: External API calls (Sleeper, OpenAI) wrapped in dedicated service modules
- **Authentication Middleware**: `isAuthenticated` middleware protects authenticated routes
- **User ID Access**: Authenticated routes must use `req.user.claims.sub` to get the user ID from OIDC claims (not `req.user.id`)
- **Auth Upsert with Email Conflict**: AuthStorage.upsertUser handles email conflicts by migrating related data (userProfiles, userNotificationStatus) to the new user ID atomically within a transaction before deleting the old user record
- **Notification Sync Pattern**: Home page uses POST `/api/notifications/:leagueId/sync` endpoint (instead of GET) because it includes formatted player names and doesn't have the strict year-based access check that can fail for previous seasons
- **Conditional Component Pattern**: Pages requiring leagueId (like Roster) use a parent/child component pattern - parent checks for valid leagueId and returns early if missing, child component only renders with valid leagueId to prevent React Query from firing without required parameters
- **QueryKey Array Format**: Use array format for React Query keys with variables like `["/api/fantasy/roster", leagueId]` instead of dynamic strings for proper cache invalidation
- **useSelectedLeague Hook**: Returns `{ league, isLoading }` object - pages should destructure with `const { league } = useSelectedLeague()` and optionally use `isLoading` for showing loading skeletons while leagues are being fetched

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components (shadcn/ui)
    hooks/        # Custom React hooks
    pages/        # Page components
    lib/          # Utilities and API client
server/           # Express backend
  replit_integrations/  # Replit-specific integrations (auth, chat, audio, image)
shared/           # Shared code between frontend/backend
  schema.ts       # Drizzle database schema
  models/         # Additional model definitions
```

## External Dependencies

### Third-Party APIs
- **Sleeper API**: Fantasy football league data (`https://api.sleeper.app/v1`)
- **ESPN API**: Player stats, game logs, career data, and splits (`https://site.api.espn.com`)
- **OpenAI API**: AI-powered trade analysis via Replit AI Integrations

### ESPN API Quirks
- **QB Interceptions**: ESPN's career stats API "interceptions" field represents defensive INTs caught (for all positions), not QB passing INTs thrown. For QBs, passing interceptions are ALWAYS calculated by aggregating from game logs which contain correct per-game passing INT data. The player-stats-service.ts applies this fix automatically for all QB profiles.
- **Player Profile Cache**: Currently at v13 - increment when fixing stat calculations to bust old cached data

### Season Handling
The Sleeper API returns two different season values in `/state/nfl`:
- **`season`**: The current NFL season (e.g., "2025" during playoffs)
- **`league_season`**: The season dynasty leagues have rolled into (e.g., "2026" after offseason rollover)

When fetching user leagues, the app uses `league_season` to ensure newly rolled-over dynasty leagues appear correctly. This is important during the NFL offseason when leagues transfer to the new year while the NFL season technically hasn't ended.

### Dynasty Value Engine
The custom dynasty value engine (`server/dynasty-value-engine.ts`) calculates player values on a 0-100 scale with 2 decimal precision:
- **Value Over Replacement (VOR)**: Position-based replacement levels calculated from roster settings
- **Age Curves by Position**: QB peaks 25-32 (slow decay), RB peaks 22-26 (fast decay), WR peaks 24-28, TE peaks 25-29
- **Injury Adjustments**: IR/Out = 0.90, Doubtful = 0.95, Questionable = 0.98 multipliers
- **Draft Pick Values**: 1st = 80, 2nd = 55, 3rd = 35, 4th = 18 base values with ~10% year decay
- **Devy Prospect Values**: Based on tier (1-5) and draft year proximity
- **Normalization**: All values normalized to 0-100 scale for consistent display

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: OpenID Connect authentication with session persistence
- **Required Environment Variables**: `DATABASE_URL`, `SESSION_SECRET`, `ISSUER_URL`, `REPL_ID`

### AI Services
- **OpenAI Integration**: Used for trade analysis, news generation, lineup advice, player trends, and ROS projections
- **Required Environment Variables**: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Development Tools
- **Vite**: Frontend development server with HMR
- **tsx**: TypeScript execution for Node.js
- **Drizzle Kit**: Database schema management