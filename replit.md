# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application designed for Sleeper league users. It provides league management, advanced analytics, and AI-powered insights to enhance the fantasy football experience. The application integrates with the Sleeper API for real-time data and leverages AI for intelligent analysis and recommendations, aiming to be the ultimate tool for fantasy football enthusiasts. Key capabilities include custom dynasty trade calculators, waiver wire analysis, playoff predictions, historical data tracking, and a trophy room for league achievements.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Design: Premium dark theme with black background and amber/gold accent color (HSL 38 75% 55%). Features gold glow effects on hover, amber-tinted borders, and warm gold accent highlights on key metrics and interactive elements.

## System Architecture

### UI/UX Decisions

The application features a Command Center (War Room) with a sticky identity header, Championship Equity hero section, and key performance indicators like Win Probability and Playoff Rate. A strategic snapshot provides primary constraints and highest EV actions. The interface includes a portfolio architecture with position strength bars and various gauges, a scenario simulator, and a title path visualization. A collapsible Signals panel offers AI insights and recommendations. The design uses a 3-color system (gold for primary/opportunity, green for positive, red for risk) with bold metrics and minimal text. A persistent league selector and hierarchical sidebar navigation with 4 strategic top-level categories are implemented for ease of use, designed with a quant-trading-dashboard aesthetic. Key pages are merged into tabbed interfaces to reduce cognitive load, with legacy routes redirecting to new containers. The overall theme is a premium dark theme with black background and amber/gold accents, gold glow effects, and amber-tinted borders. Distinct colors are used for player positions.

### Technical Implementations

The frontend is built with React, TypeScript, Vite, Wouter for routing, TanStack React Query for state management, Shadcn/ui for components, and Tailwind CSS for styling. The backend uses Express.js with TypeScript and Node.js, following a RESTful API design. Data is stored in PostgreSQL with Drizzle ORM. Authentication is handled via a custom Email/Password system with `bcrypt` and `express-session`, integrated with Replit Auth. ESBuild is used for production bundling.

Core features include comprehensive player statistics, standings, news feeds, lineup advice, waiver wire tools, smart trade ideas, player profiles, historical data, and AI-powered premium features such as a Trash Talk Generator, Boom/Bust Probability Cards, Trade Lab Strategy AI, and a Live Draft Board. A Devy Command Center v2 provides predictive intelligence for dynasty prospect modeling, including enriched data models, dashboards, enhanced rankings, profile modals, market intelligence, a draft value lab, and portfolio analysis. **Devy vs Draft Class distinction**: Players with `draftEligibleYear === currentYear` are labeled "Draft" (blue badges), while `currentYear + 1` and beyond are "Devy" (purple badges). The API returns a `playerClass` field ("draft" | "devy") on each prospect. The `/api/sleeper/devy` endpoint includes both current-year draft class and future devy prospects (filters out `draftEligibleYear < currentYear` and already-drafted NFL players). The Dynasty AI Engine v3 provides the quantitative analytics backbone, encompassing player valuation, devy projection, franchise modeling, Unified Franchise Asset Scoring (UFAS), draft simulation, trade simulation, market dynamics, and a dual power rankings system (dynasty and in-season modes). An AI Explanation Service provides structured explanations for insights. The application uses a 3-Year Projection Model with position-specific aging models. Elite Player Profile v2 offers a 9-module structured player analysis including an archetype engine, Dynasty Asset Score, Monte Carlo distribution, and AI executive summary. A custom Dynasty Value Engine calculates player values. A Friends System, Community Leaderboard, League Accounting, Weekly Predictions Leaderboard, and global Community Chat Room enhance social interaction. The AI Manager Profile analyzes manager behavior, and a comprehensive Decision Engine provides a 5-layer optimization system for various fantasy football decisions.

**Dynasty Market Terminal** — Quant-trading-style market analytics with nonlinear pricing, volatility modeling, and arbitrage detection:
- **Service** (`server/engine/market-psychology-service.ts`): Computes sentimentScore (0-100), hypeVelocity (-100 to +100), demandIndex (0-100), supplyIndex/trueSupply (0-100, weighted formula), hypePremiumPct (tanh-based nonlinear curve, ±maxPremium where maxPremium = 15 + D-VIX/2), volatility14d (stddev proxy), betaScore (player vol / league avg vol), marketLabel (Momentum Breakout / Bubble Risk / Accumulation Zone / Distribution Phase), gapScore (fundamentalRank - marketRank for arbitrage), adjustedMarketValue, marketHeatLevel. Safety controls: 3-day rolling average. Exports `getHypeInflationMultiplier()` for FAAB and `getMarketFrictionModifier()` for trades. `computeMarketIndices()` calculates DMI, D-VIX, avgHypePremium from top 100 players. **IMPORTANT**: `hypePremiumPct` is stored as percentage points (e.g. 12.5 = 12.5%), NOT decimals.
- **Database**: `player_market_metrics` table with columns: sentimentScore, hypeVelocity, demandIndex, supplyIndex, hypePremiumPct, adjustedMarketValue, marketHeatLevel, volatility14d, betaScore, marketLabel, trueSupply, gapScore, fundamentalRank, marketRank. `market_index_cache` table: dynastyMarketIndex (DMI), dynastyVolatilityIndex (D-VIX), avgHypePremium, leagueTradeVolume7d, leagueAvgVolatility, lastUpdated.
- **Background Jobs** (`server/engine/market-psychology-refresh.ts`): Full player refresh 30s after startup + every 24hr. Market index cache refresh every 5 min via `refreshMarketIndices()`. **RULE**: Never import from `server/index.ts` in routes/refresh — all shared refresh logic in `market-psychology-refresh.ts`.
- **Trade Engine Integration** (`trade-eval.ts`): marketFrictionModifier (±5-15%), sentimentDelta, hypePremiumDelta, marketHeat per side.
- **FAAB Integration** (`faab-optimizer.ts`): hypeInflationMultiplier (0.80-1.35x).
- **Player Profile** (`player-profile-modal.tsx`): "Market" tab with metrics + color-coded hype premium (percentage point format) + heat badge.
- **Rankings** (`players.tsx`): Market Heat column with icons.
- **Market Terminal Page** (`market-psychology.tsx` at `/league/market-psychology`): Market Overview Panel (4 index cards: DMI, D-VIX, Avg Hype, Trade Volume), 7 tabs (Most Overhyped, Undervalued, Rising Fast, Panic Sells, Artificial Scarcity, Arbitrage, Portfolio Exposure). Premium-gated. Sidebar entry "Market Terminal".
- **API Routes**: `GET /api/market-psychology` (paginated list), `GET /api/market-psychology/categories` (5 categorized lists), `GET /api/market-psychology/:playerId`, `POST /api/market-psychology/refresh` (admin), `GET /api/market-terminal/overview` (DMI/D-VIX/indices from cache), `GET /api/market-terminal/arbitrage` (gap score sorted), `GET /api/market-terminal/portfolio-exposure/:leagueId` (roster beta/exposure analysis).

### System Design Choices

Shared types are used for database schemas and models across frontend and backend. Database operations are abstracted via storage classes, and external API calls are wrapped in dedicated service modules. Authentication uses `isAuthenticated` middleware and handles email conflicts. A conditional component pattern ensures `leagueId` validity. React Query keys use an array format for robust caching. A `useSelectedLeague` hook manages league selection state. The architecture supports multi-source data aggregation from DT Dynasty, DT Draft 2026, Dynasty Process, nflverse, CFBD, and FantasyPros Devy Rankings.

## External Dependencies

### Third-Party APIs

-   **Sleeper API**: For fantasy football league data.
-   **ESPN API**: For player statistics, game logs, and career data.
-   **CFBD API**: For advanced college football metrics.
-   **OpenAI API**: Utilized via Replit AI Integrations for AI analysis.

### Database

-   **PostgreSQL**: The primary database for data storage and session management.

### Authentication

-   **Custom Email/Password Auth**: Implemented with `bcrypt` for password hashing and `express-session` for session management.

### Monetization

-   **Stripe**: Used as the payment gateway for premium subscriptions.