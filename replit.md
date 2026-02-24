# DT Sleeper Agent

## Overview

DT Sleeper Agent is a fantasy football companion application for Sleeper league users. It offers league management, advanced analytics, and AI-powered insights to improve the fantasy football experience. The application integrates with the Sleeper API for real-time data and leverages AI for intelligent analysis and recommendations, aiming to be the ultimate tool for fantasy football enthusiasts. Key capabilities include custom dynasty trade calculators, waiver wire analysis, playoff predictions, historical data tracking, and a trophy room for league achievements.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Design: Premium dark theme with black background and amber/gold accent color (HSL 38 75% 55%). Features gold glow effects on hover, amber-tinted borders, and warm gold accent highlights on key metrics and interactive elements.

## System Architecture

### UI/UX Decisions

The application features a Command Center (War Room) with a sticky identity header, Championship Equity hero section, and key performance indicators like Win Probability and Playoff Rate. A strategic snapshot provides primary constraints and highest EV actions. The interface includes a portfolio architecture with position strength bars and various gauges, a scenario simulator, and a title path visualization. A collapsible Signals panel offers AI insights and recommendations. The design uses a 3-color system (gold for primary/opportunity, green for positive, red for risk) with bold metrics and minimal text. A persistent league selector and hierarchical sidebar navigation with 4 strategic top-level categories are implemented for ease of use, designed with a quant-trading-dashboard aesthetic. Key pages are merged into tabbed interfaces to reduce cognitive load, with legacy routes redirecting to new containers. The overall theme is a premium dark theme with black background and amber/gold accents, gold glow effects, and amber-tinted borders. Distinct colors are used for player positions.

### Technical Implementations

The frontend is built with React, TypeScript, Vite, Wouter for routing, TanStack React Query for state management, Shadcn/ui for components, and Tailwind CSS for styling. The backend uses Express.js with TypeScript and Node.js, following a RESTful API design. Data is stored in PostgreSQL with Drizzle ORM. Authentication is handled via a custom Email/Password system with `bcrypt` and `express-session`, integrated with Replit Auth. ESBuild is used for production bundling.

Core features include career stats, standings, news feeds, matchups, lineup advice, schedule, playoff bracket, rivalries, waiver wire, player watchlist, smart trade ideas, NFL players, player profiles, player trends, comparisons, ROS projections, Devy Command Center, 2026 Draft Board, Trade Lab, Trade History, Trophy Room, AI Chat Assistant, real-time notifications, power rankings, lineup optimizer, export functionality, draft pick value charts, league history timeline, NFL stat leaders, share functionality, mobile navigation, strength of schedule analysis, season-long projections, usage trends, and injury tracker.

AI-powered premium features include a Trash Talk Generator, Boom/Bust Probability Cards, Trade Lab Strategy AI, Mid-Season Review, Taxi Squad Optimizer, Matchup Heat Maps, Draft Pick Predictions, Power Rankings Commentary, Draft Recap & Grades, AI Manager Profile, Live Draft Board, and Smart Draft Assistant. These features leverage GPT-4o-mini and are premium-gated.

The application utilizes offline caching with React Query persistence via `@tanstack/react-query-persist-client` and localStorage for faster repeat visits. Multi-league dashboard enhancements include sorting and quick-action links. A `parseDevyNote()` function extracts devy player details. An Elite Player Profile v2 offers 9-module structured player analysis including an archetype engine, Dynasty Asset Score, Monte Carlo distribution, age curve projection, correlation/stack risk calculator, market sentiment layer, stress test simulator, conditional devy prospect intel, and AI executive summary. A custom Dynasty Value Engine calculates player values based on multiple factors. A consolidation premium is applied in the trade calculator. A Friends System allows user interaction, and public user profiles display career stats and other information. A Community Leaderboard ranks users globally, and League Accounting tracks financial transactions per league. A Weekly Predictions Leaderboard allows users to compete on matchup predictions. A global Community Chat Room facilitates user communication. The AI Manager Profile analyzes manager behavior and provides insights. The Live Draft Board and Smart Draft Assistant provide real-time draft support and recommendations. Notification preferences are user-configurable. Mobile PWA enhancements include web manifest, service worker, and install prompts. A comprehensive Decision Engine provides a 5-layer optimization system for various fantasy football decisions, including matchup simulation, lineup optimization, trade evaluation, FAAB optimization, and season outlook. All AI explanations are derived from pre-computed structured data.

### System Design Choices

Shared types are used for database schemas and models across frontend and backend. Database operations are abstracted via storage classes, and external API calls are wrapped in dedicated service modules. Authentication uses `isAuthenticated` middleware and handles email conflicts. A POST request is used for notification synchronization. A conditional component pattern ensures `leagueId` validity. React Query keys use an array format for robust caching. A `useSelectedLeague` hook manages league selection state. The architecture supports multi-source data aggregation from DT Dynasty, DT Draft 2026, Dynasty Process, nflverse, CFBD, and FantasyPros Devy Rankings.

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

### SEO

-   **Static SEO**: `index.html` includes meta tags, Open Graph, Twitter cards, JSON-LD, canonical URL, robots meta.
-   **Dynamic Page Titles**: Managed with a `usePageTitle` hook for per-page document titles.