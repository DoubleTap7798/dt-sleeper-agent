# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application for Sleeper leagues. It provides league management tools including trade calculators with KTC (Keep Trade Cut) values, waiver wire analysis, playoff predictions, trade history tracking, rivalry head-to-head records, and a trophy room for league achievements. The application integrates with the Sleeper API to fetch real-time league data and uses AI (OpenAI) for trade analysis and recommendations.

## Features
- **Standings**: League standings with playoff predictions, clickable teams show roster and draft picks
- **Rivalries**: Head-to-head records between teams across all seasons
- **Waiver Wire**: Available players and stats
- **Trade Calculator**: Calculate trade values with KTC dynasty values and AI analysis
- **Trade History**: Historical trades from ALL league years with AI insights
- **Trophy Room**: Champions, all-time standings, season records

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **OpenAI API**: AI-powered trade analysis via Replit AI Integrations
- **Keep Trade Cut (KTC)**: Dynasty trade values (implemented as value service in `server/ktc-values.ts`)

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: OpenID Connect authentication with session persistence
- **Required Environment Variables**: `DATABASE_URL`, `SESSION_SECRET`, `ISSUER_URL`, `REPL_ID`

### AI Services
- **OpenAI Integration**: Used for trade analysis
- **Required Environment Variables**: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Development Tools
- **Vite**: Frontend development server with HMR
- **tsx**: TypeScript execution for Node.js
- **Drizzle Kit**: Database schema management