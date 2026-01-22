import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import * as sleeperApi from "./sleeper-api";
import * as ktcValues from "./ktc-values";
import OpenAI from "openai";
import { z } from "zod";

// Validation schemas
const connectSleeperSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
});

const selectLeagueSchema = z.object({
  leagueId: z.string().min(1, "League ID is required"),
});

const tradeAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["player", "pick"]),
  position: z.string().optional(),
  team: z.string().optional().nullable(),
  value: z.number(),
});

const analyzeTradeSchema = z.object({
  leagueId: z.string().min(1),
  teamAId: z.string().min(1),
  teamBId: z.string().min(1),
  teamAAssets: z.array(tradeAssetSchema),
  teamBAssets: z.array(tradeAssetSchema),
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // User Profile Routes
  app.get("/api/user/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        return res.json({
          sleeperUsername: null,
          sleeperUserId: null,
          selectedLeagueId: null,
        });
      }
      
      res.json({
        sleeperUsername: profile.sleeperUsername,
        sleeperUserId: profile.sleeperUserId,
        selectedLeagueId: profile.selectedLeagueId,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/user/select-league", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = selectLeagueSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      await storage.updateSelectedLeague(userId, parsed.data.leagueId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating selected league:", error);
      res.status(500).json({ message: "Failed to update selected league" });
    }
  });

  // Sleeper Connection
  app.post("/api/sleeper/connect", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = connectSleeperSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const sleeperUser = await sleeperApi.getSleeperUser(parsed.data.username);
      if (!sleeperUser) {
        return res.status(404).json({ message: "Sleeper username not found" });
      }

      await storage.upsertUserProfile({
        userId,
        sleeperUsername: sleeperUser.username,
        sleeperUserId: sleeperUser.user_id,
      });

      res.json({
        success: true,
        sleeperUsername: sleeperUser.username,
        sleeperUserId: sleeperUser.user_id,
      });
    } catch (error) {
      console.error("Error connecting Sleeper account:", error);
      res.status(500).json({ message: "Failed to connect Sleeper account" });
    }
  });

  // Get user's leagues
  app.get("/api/sleeper/leagues", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);

      if (!profile?.sleeperUserId) {
        return res.json([]);
      }

      const state = await sleeperApi.getState();
      const season = state?.season || "2025";
      const leagues = await sleeperApi.getUserLeagues(profile.sleeperUserId, season);

      res.json(leagues);
    } catch (error) {
      console.error("Error fetching leagues:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  // Get league standings
  app.get("/api/sleeper/standings/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [league, rosters, users, state] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const userMap = new Map(users.map((u) => [u.user_id, u]));
      const playoffTeams = league.settings?.playoff_teams || 6;
      const currentWeek = state?.week || 1;

      // Calculate playoff odds
      const playoffOdds = sleeperApi.calculatePlayoffOdds(rosters, playoffTeams, currentWeek);

      // Build standings
      const standings = rosters
        .map((roster) => {
          const user = userMap.get(roster.owner_id);
          const fpts = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;
          const fptsAgainst = (roster.settings.fpts_against || 0) + (roster.settings.fpts_against_decimal || 0) / 100;
          const maxPts = (roster.settings.ppts || 0) + (roster.settings.ppts_decimal || 0) / 100;
          const totalGames = (roster.settings.wins || 0) + (roster.settings.losses || 0) + (roster.settings.ties || 0);

          return {
            rosterId: roster.roster_id,
            ownerId: roster.owner_id,
            ownerName: user?.display_name || user?.username || "Unknown",
            avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
            wins: roster.settings.wins || 0,
            losses: roster.settings.losses || 0,
            ties: roster.settings.ties || 0,
            pointsFor: fpts,
            pointsAgainst: fptsAgainst,
            maxPoints: maxPts,
            winPercentage: totalGames > 0 ? (roster.settings.wins || 0) / totalGames : 0,
            playoffOdds: playoffOdds.get(roster.roster_id) || 50,
          };
        })
        .sort((a, b) => {
          if (a.wins !== b.wins) return b.wins - a.wins;
          return b.pointsFor - a.pointsFor;
        });

      res.json({
        standings,
        playoffTeams,
        currentWeek,
      });
    } catch (error) {
      console.error("Error fetching standings:", error);
      res.status(500).json({ message: "Failed to fetch standings" });
    }
  });

  // Get waiver wire players
  app.get("/api/sleeper/waivers/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [rosters, allPlayers, state] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);

      // Get all rostered player IDs
      const rosteredPlayers = new Set<string>();
      rosters.forEach((roster) => {
        (roster.players || []).forEach((p) => rosteredPlayers.add(p));
        (roster.reserve || []).forEach((p) => rosteredPlayers.add(p));
        (roster.taxi || []).forEach((p) => rosteredPlayers.add(p));
      });

      // Filter to available players
      const availablePlayers = Object.entries(allPlayers)
        .filter(([playerId, player]: [string, any]) => {
          if (rosteredPlayers.has(playerId)) return false;
          if (!player.fantasy_positions?.length) return false;
          const pos = player.fantasy_positions[0];
          return ["QB", "RB", "WR", "TE", "K", "DEF"].includes(pos);
        })
        .map(([playerId, player]: [string, any]) => ({
          playerId,
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.fantasy_positions?.[0] || "?",
          team: player.team,
          age: player.age,
          status: player.status || "Active",
          injuryStatus: player.injury_status,
          seasonPoints: Math.random() * 150, // Placeholder - would come from stats API
          avgPoints: Math.random() * 12,
          lastWeekPoints: Math.random() * 25,
          projectedPoints: Math.random() * 15,
          percentRostered: Math.floor(Math.random() * 30),
        }))
        .sort((a, b) => b.avgPoints - a.avgPoints)
        .slice(0, 200);

      res.json({
        players: availablePlayers,
        week: state?.week || 1,
      });
    } catch (error) {
      console.error("Error fetching waivers:", error);
      res.status(500).json({ message: "Failed to fetch waiver wire" });
    }
  });

  // Get rosters for trade calculator
  app.get("/api/sleeper/rosters/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [rosters, users, allPlayers, draftPicks] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueDraftPicks(leagueId),
      ]);

      const userMap = new Map(users.map((u) => [u.user_id, u]));

      const rostersWithAssets = rosters.map((roster) => {
        const user = userMap.get(roster.owner_id);
        
        // Get player assets
        const players = (roster.players || []).map((playerId) => {
          const player = allPlayers[playerId];
          if (!player) return null;
          
          const position = player.fantasy_positions?.[0] || "?";
          const value = ktcValues.getPlayerValue(
            playerId,
            position,
            player.age,
            player.years_exp || 0
          );

          return {
            id: playerId,
            name: player.full_name || `${player.first_name} ${player.last_name}`,
            type: "player" as const,
            position,
            team: player.team,
            value,
          };
        }).filter(Boolean);

        // Get draft pick assets for this roster
        const picks = draftPicks
          .filter((p) => p.owner_id === roster.roster_id)
          .map((pick) => {
            const originalOwner = pick.previous_owner_id !== pick.owner_id
              ? rosters.find((r) => r.roster_id === pick.previous_owner_id)
              : null;
            const originalOwnerUser = originalOwner 
              ? userMap.get(originalOwner.owner_id)
              : null;

            return {
              id: `${pick.season}-${pick.round}-${pick.roster_id}`,
              name: ktcValues.getPickName(
                pick.season,
                pick.round,
                originalOwnerUser?.display_name || originalOwnerUser?.username
              ),
              type: "pick" as const,
              value: ktcValues.getPickValue(pick.season, pick.round),
            };
          });

        // Add standard future picks (2025-2027, rounds 1-4)
        const currentPicks = new Set(picks.map((p) => p.id));
        ["2025", "2026", "2027"].forEach((season) => {
          [1, 2, 3, 4].forEach((round) => {
            const id = `${season}-${round}-${roster.roster_id}`;
            if (!currentPicks.has(id) && !draftPicks.find(
              (p) => p.season === season && p.round === round && p.previous_owner_id === roster.roster_id
            )) {
              picks.push({
                id,
                name: ktcValues.getPickName(season, round),
                type: "pick" as const,
                value: ktcValues.getPickValue(season, round),
              });
            }
          });
        });

        return {
          rosterId: roster.roster_id,
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          players: players.sort((a: any, b: any) => b.value - a.value),
          picks: picks.sort((a, b) => b.value - a.value),
        };
      });

      res.json({ rosters: rostersWithAssets });
    } catch (error) {
      console.error("Error fetching rosters:", error);
      res.status(500).json({ message: "Failed to fetch rosters" });
    }
  });

  // Analyze trade
  app.post("/api/trade/analyze", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = analyzeTradeSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid trade data" });
      }

      const { leagueId, teamAId, teamBId, teamAAssets, teamBAssets } = parsed.data;

      const teamAValue = teamAAssets.reduce((sum: number, a) => sum + a.value, 0);
      const teamBValue = teamBAssets.reduce((sum: number, a) => sum + a.value, 0);

      const gradeResult = ktcValues.calculateTradeGrade(teamAValue, teamBValue);

      // Generate AI analysis
      let aiAnalysis = "";
      try {
        const teamANames = teamAAssets.map((a: any) => a.name).join(", ");
        const teamBNames = teamBAssets.map((a: any) => a.name).join(", ");

        const prompt = `Analyze this fantasy football dynasty trade:

Team A gives up: ${teamANames || "Nothing"} (Total value: ${teamAValue})
Team B gives up: ${teamBNames || "Nothing"} (Total value: ${teamBValue})

Trade grade: ${gradeResult.grade}
Value difference: ${Math.abs(gradeResult.difference)} (${gradeResult.percentageDiff.toFixed(1)}%)

Provide a brief 2-3 sentence analysis of this trade, focusing on:
1. Whether it's fair
2. Who benefits more and why
3. Any strategic considerations

Keep it concise and actionable.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a fantasy football trade analyst. Provide brief, insightful trade analysis.",
            },
            { role: "user", content: prompt },
          ],
          max_completion_tokens: 200,
        });

        aiAnalysis = response.choices[0]?.message?.content || "";
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
        aiAnalysis = "AI analysis unavailable at this time.";
      }

      res.json({
        teamA: {
          teamId: teamAId,
          teamName: "Team A",
          assets: teamAAssets,
          totalValue: teamAValue,
        },
        teamB: {
          teamId: teamBId,
          teamName: "Team B",
          assets: teamBAssets,
          totalValue: teamBValue,
        },
        difference: gradeResult.difference,
        percentageDiff: gradeResult.percentageDiff,
        grade: gradeResult.grade,
        winner: gradeResult.winner,
        aiAnalysis,
      });
    } catch (error) {
      console.error("Error analyzing trade:", error);
      res.status(500).json({ message: "Failed to analyze trade" });
    }
  });

  // Get trade history
  app.get("/api/sleeper/trades/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [allTransactions, rosters, users, allPlayers] = await Promise.all([
        sleeperApi.getAllLeagueTransactions(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const userMap = new Map(users.map((u) => [u.user_id, u]));
      const rosterToOwner = new Map(rosters.map((r) => [r.roster_id, r.owner_id]));

      // Filter to trades only
      const trades = allTransactions
        .filter((t) => t.type === "trade" && t.status === "complete")
        .sort((a, b) => b.created - a.created)
        .map((trade) => {
          const [rosterId1, rosterId2] = trade.roster_ids;
          const ownerId1 = rosterToOwner.get(rosterId1);
          const ownerId2 = rosterToOwner.get(rosterId2);
          const user1 = ownerId1 ? userMap.get(ownerId1) : null;
          const user2 = ownerId2 ? userMap.get(ownerId2) : null;

          // Parse assets received by each team
          const team1Received: any[] = [];
          const team2Received: any[] = [];

          // Players
          if (trade.adds) {
            Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
              const player = allPlayers[playerId];
              const asset = {
                id: playerId,
                name: player?.full_name || playerId,
                type: "player" as const,
                position: player?.fantasy_positions?.[0],
              };
              if (rosterId === rosterId1) team1Received.push(asset);
              else if (rosterId === rosterId2) team2Received.push(asset);
            });
          }

          // Draft picks
          if (trade.draft_picks) {
            trade.draft_picks.forEach((pick) => {
              const asset = {
                id: `${pick.season}-${pick.round}`,
                name: `${pick.season} Round ${pick.round}`,
                type: "pick" as const,
              };
              if (pick.owner_id === rosterId1) team1Received.push(asset);
              else if (pick.owner_id === rosterId2) team2Received.push(asset);
            });
          }

          return {
            transactionId: trade.transaction_id,
            timestamp: trade.created,
            week: trade.leg,
            team1: {
              rosterId: rosterId1,
              ownerName: user1?.display_name || user1?.username || "Unknown",
              avatar: sleeperApi.getAvatarUrl(user1?.avatar || null),
              received: team1Received,
            },
            team2: {
              rosterId: rosterId2,
              ownerName: user2?.display_name || user2?.username || "Unknown",
              avatar: sleeperApi.getAvatarUrl(user2?.avatar || null),
              received: team2Received,
            },
          };
        });

      // Calculate team stats
      const teamStats = new Map<string, any>();
      
      rosters.forEach((roster) => {
        const user = userMap.get(roster.owner_id);
        teamStats.set(roster.owner_id, {
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
          totalTrades: 0,
          tradingPartners: {},
          bestTrade: null,
        });
      });

      trades.forEach((trade) => {
        const stats1 = teamStats.get(rosterToOwner.get(trade.team1.rosterId) || "");
        const stats2 = teamStats.get(rosterToOwner.get(trade.team2.rosterId) || "");

        if (stats1) {
          stats1.totalTrades++;
          stats1.tradingPartners[trade.team2.ownerName] = 
            (stats1.tradingPartners[trade.team2.ownerName] || 0) + 1;
        }
        if (stats2) {
          stats2.totalTrades++;
          stats2.tradingPartners[trade.team1.ownerName] = 
            (stats2.tradingPartners[trade.team1.ownerName] || 0) + 1;
        }
      });

      const league = await sleeperApi.getLeague(leagueId);

      res.json({
        trades,
        teamStats: Array.from(teamStats.values()),
        season: league?.season || "2025",
      });
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trade history" });
    }
  });

  // Get trophy room data
  app.get("/api/sleeper/trophies/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [league, rosters, users] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const userMap = new Map(users.map((u) => [u.user_id, u]));

      // Build all-time records from current season data
      // In a real app, you'd aggregate across multiple seasons
      const allTimeRecords = rosters.map((roster) => {
        const user = userMap.get(roster.owner_id);
        const fpts = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;
        const totalGames = (roster.settings.wins || 0) + (roster.settings.losses || 0) + (roster.settings.ties || 0);

        return {
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
          totalWins: roster.settings.wins || 0,
          totalLosses: roster.settings.losses || 0,
          totalTies: roster.settings.ties || 0,
          totalPointsFor: fpts,
          championships: 0, // Would come from historical data
          winPercentage: totalGames > 0 ? (roster.settings.wins || 0) / totalGames : 0,
        };
      }).sort((a, b) => {
        if (a.totalWins !== b.totalWins) return b.totalWins - a.totalWins;
        return b.totalPointsFor - a.totalPointsFor;
      });

      // Find top performers
      const topPointsFor = [...allTimeRecords].sort((a, b) => b.totalPointsFor - a.totalPointsFor)[0] || null;
      const topWinPercentage = [...allTimeRecords].sort((a, b) => b.winPercentage - a.winPercentage)[0] || null;

      // Champions would come from historical data
      // For now, we'll simulate with current leader
      const champions = allTimeRecords.length > 0 ? [{
        season: league.season,
        rosterId: rosters.find((r) => r.owner_id === allTimeRecords[0].ownerId)?.roster_id || 0,
        ownerName: allTimeRecords[0].ownerName,
        avatar: allTimeRecords[0].avatar,
      }] : [];

      res.json({
        champions,
        allTimeRecords,
        topPointsFor,
        topWinPercentage,
        leagueName: league.name,
        leagueAge: 1, // Would calculate from first season
      });
    } catch (error) {
      console.error("Error fetching trophies:", error);
      res.status(500).json({ message: "Failed to fetch trophy room" });
    }
  });

  return httpServer;
}
