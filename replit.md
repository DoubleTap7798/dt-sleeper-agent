# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application for Sleeper leagues. It provides league management tools including trade calculators with custom dynasty values, waiver wire analysis, playoff predictions, trade history tracking, rivalry head-to-head records, and a trophy room for league achievements. The application integrates with the Sleeper API to fetch real-time league data and uses AI (OpenAI) for trade analysis and recommendations.

## Features

### UX Design Philosophy
- **Action-First Dashboard**: Home page prioritizes personalized recommendations over raw data - shows roster strength bars, team profile indicator (Contender/Balanced/Rebuild), biggest need, and weekly AI insights
- **Persistent League Selector**: Dropdown in header always visible for quick switching between leagues with avatars and season info
- **Consolidated Navigation**: Grouped collapsible sections (League, My Team, Players, Trades) reduce cognitive load while maintaining full feature access
- **Dashboard API**: `/api/fantasy/dashboard/:leagueId` returns roster strength percentages (0-100), position ranks, team profile classification, biggest need analysis, and action recommendations

### Core Features
- **Career Stats (All Leagues)**: Default view showing aggregated statistics across ALL historical seasons - total W-L-T record, championships, runner-ups, playoff appearances, and season-by-season breakdown with navigation filtered to career-level pages
- **Standings**: League standings with playoff predictions, clickable teams show roster and draft picks
- **News Feed**: Real-time fantasy football news and analysis with injury updates, trade rumors, waiver recommendations, and player analysis - AI-generated with 5-minute refresh
- **Matchups**: Current week matchups with live scoring, expandable to see player breakdowns
- **Lineup Advice**: AI-powered start/sit recommendations with matchup analysis, projected points, confidence ratings, game script predictions, and smart swap suggestions
- **Schedule**: Full season schedule with week-by-week matchups, opponents, scores, and W/L/T results
- **Playoff Bracket**: Visual bracket display with matchups organized by round (Quarterfinals, Semifinals, Championship)
- **Rivalries**: Head-to-head records between teams across all seasons
- **Waiver Wire**: Available players and stats with personalized "Recommended for You" section showing fit scores based on roster needs
- **Player Watchlist**: Track players and monitor dynasty value changes over time. Add/remove players, view value when added vs current value, with visual indicators for rising/falling values
- **Smart Trade Ideas**: AI-powered trade suggestions on dashboard analyzing roster weaknesses and league-wide opportunities with fairness scoring
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
- Design: Modern tech theme with black background and electric blue/cyan accent color (#00D4FF, HSL 187 100% 50%). Features glow effects on hover, cyan-tinted borders, and accent highlights on key metrics and interactive elements.

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
- **MetricTooltip Component**: Reusable tooltip component (`client/src/components/metric-tooltip.tsx`) for explaining advanced metrics like Dynasty Value, VOR, Fit Score. Uses accessible button trigger with aria-labels. Import and use with predefined metric keys or SimpleTooltip for custom definitions

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
- **QB Interceptions**: ESPN's career stats API "interceptions" field represents defensive INTs caught (for all positions), not QB passing INTs thrown. For QBs, passing interceptions are ALWAYS calculated by aggregating from game logs which contain correct per-game passing INT data. The `applyQbIntsFix()` helper function in player-stats-service.ts applies this fix in BOTH code paths (when ESPN bio succeeds AND when it fails and falls back to Sleeper data).
- **ESPN Bio Fallback**: When ESPN bio fetch fails, the code falls back to Sleeper data for bio info but still uses ESPN game logs/stats. The QB INT fix must be applied in this fallback path as well.
- **Player Profile Cache**: Currently at v16 - increment when fixing stat calculations to bust old cached data

### Season Handling
The Sleeper API returns two different season values in `/state/nfl`:
- **`season`**: The current NFL season (e.g., "2025" during playoffs)
- **`league_season`**: The season dynasty leagues have rolled into (e.g., "2026" after offseason rollover)

When fetching user leagues, the app uses `league_season` to ensure newly rolled-over dynasty leagues appear correctly. This is important during the NFL offseason when leagues transfer to the new year while the NFL season technically hasn't ended.

### Dynasty Value Engine (Upgraded Algorithm)
The custom dynasty value engine (`server/dynasty-value-engine.ts`) calculates player values on a 0-100 scale with 2 decimal precision:

**Step 1 - Multi-Year VOR**:
- Year 1 VOR: 50% weight
- Year 2 VOR: 30% weight, discounted by 8%
- Year 3 VOR: 20% weight, discounted by 15%
- Creates a weighted VOR score that values dynasty longevity

**Step 2 - Base Value**: Normalize weighted VOR to 0-100 scale relative to top player

**Multipliers Applied to Base Value**:
1. **Age Multiplier (0.65-1.15)**: Position-specific peak years with up to 15% youth bonus
   - QB peaks 25-32 (3% decay), RB peaks 22-27 (5% decay), WR peaks 24-29 (4% decay), TE peaks 25-30 (4% decay)
2. **Role Security (0.65-1.15)**: Based on snap share and depth chart
   - Elite starter (85%+ snaps): 1.10-1.15, Solid starter: 1.00-1.08, Committee: 0.90-0.98, Backup: 0.75-0.88
3. **Injury Risk**: Combines current status (IR=0.90, Doubtful=0.95, Questionable=0.98) × historical durability (0.93-1.00)
4. **Production Ceiling (1.00-1.50)**: PPG percentile-based (Top 5%: 1.40-1.50, Top 15%: 1.20-1.30, Top 30%: 1.05-1.15)
5. **Volatility (0.90-1.08)**: Weekly consistency bonus/penalty based on coefficient of variation
6. **Draft Capital (0.85-1.15)**: For players under 4 years - Rd1=1.15, Rd2=1.08, Rd3=1.02, Day3=0.90, UDFA=0.85 (decays 3%/year)
7. **Team Context (0.95-1.08)**: Offensive strength factor (Top 5 offense: 1.05-1.08, Bottom 10: 0.95-0.98)

**Light Scarcity Bonus** (only elite tiers since VOR handles scarcity):
- Superflex: Top 3 QBs get 8-12% boost
- All leagues: Top 3 TEs get 10-15% boost, Top 5 RBs get 5-10% boost

**Market Calibration**: 50% calculated value + 50% KTC consensus value

**Draft Pick Values**: 1st = 80, 2nd = 55, 3rd = 35, 4th = 18 base values with ~10% year decay

**Final Scaling**: All values clamped between 1-100

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