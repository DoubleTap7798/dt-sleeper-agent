import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import * as sleeperApi from "./sleeper-api";
import * as ktcValues from "./ktc-values";
import * as newsService from "./news-service";
import * as oddsService from "./odds-service";
import * as playerStatsService from "./player-stats-service";
import OpenAI from "openai";
import { z } from "zod";

// Validation schemas
const connectSleeperSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
});

const selectLeagueSchema = z.object({
  leagueId: z.string().min(1, "League ID is required").or(z.literal("all")),
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
  teamAName: z.string().optional(),
  teamBName: z.string().optional(),
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

  // Get league transactions
  app.get("/api/sleeper/transactions/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      const state = await sleeperApi.getState();
      const currentWeek = state?.week || 1;
      
      // Get transactions from the last few weeks
      const weeksToCheck = [];
      for (let w = currentWeek; w >= Math.max(1, currentWeek - 3); w--) {
        weeksToCheck.push(w);
      }
      
      const transactionPromises = weeksToCheck.map(week => sleeperApi.getLeagueTransactions(leagueId, week));
      const transactionArrays = await Promise.all(transactionPromises);
      const allTransactions = transactionArrays.flat();
      
      // Sort by timestamp descending
      allTransactions.sort((a, b) => (b.status_updated || b.created || 0) - (a.status_updated || a.created || 0));
      
      res.json({ transactions: allTransactions.slice(0, 20) });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get league info (settings and scoring)
  app.get("/api/sleeper/league-info/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const league = await sleeperApi.getLeague(leagueId);
      
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Parse roster positions to count each slot type
      const rosterPositions = league.roster_positions || [];
      const positionCounts: Record<string, number> = {};
      const starterPositions: string[] = [];
      const benchCount = rosterPositions.filter(p => p === "BN").length;
      
      rosterPositions.forEach(pos => {
        if (pos !== "BN") {
          starterPositions.push(pos);
        }
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      });

      // Format scoring settings into readable categories
      const scoring = league.scoring_settings || {};
      const scoringCategories = {
        passing: {
          passYards: scoring.pass_yd || 0,
          passTd: scoring.pass_td || 0,
          passInt: scoring.pass_int || 0,
          pass2pt: scoring.pass_2pt || 0,
        },
        rushing: {
          rushYards: scoring.rush_yd || 0,
          rushTd: scoring.rush_td || 0,
          rush2pt: scoring.rush_2pt || 0,
        },
        receiving: {
          reception: scoring.rec || 0,
          recYards: scoring.rec_yd || 0,
          recTd: scoring.rec_td || 0,
          rec2pt: scoring.rec_2pt || 0,
        },
        bonuses: {
          bonus100RushYards: scoring.bonus_rush_yd_100 || 0,
          bonus100RecYards: scoring.bonus_rec_yd_100 || 0,
          bonus300PassYards: scoring.bonus_pass_yd_300 || 0,
          bonus40RushTd: scoring.bonus_rush_td_40p || 0,
          bonus40RecTd: scoring.bonus_rec_td_40p || 0,
          bonus40PassTd: scoring.bonus_pass_td_40p || 0,
        },
        misc: {
          fumble: scoring.fum || 0,
          fumbleLost: scoring.fum_lost || 0,
          firstDown: scoring.rush_fd || scoring.rec_fd || 0,
        },
        dst: {
          sack: scoring.sack || 0,
          interception: scoring.def_int || scoring.int || 0,
          fumbleRecovery: scoring.fum_rec || 0,
          td: scoring.def_td || 0,
          safety: scoring.safe || 0,
          blockedKick: scoring.blk_kick || 0,
        },
        kicking: {
          fgMade: scoring.fgm || 0,
          fgMissed: scoring.fgmiss || 0,
          xpMade: scoring.xpm || 0,
          xpMissed: scoring.xpmiss || 0,
          fg40: scoring.fgm_40_49 || 0,
          fg50: scoring.fgm_50p || 0,
        },
      };

      // Determine league format (Redraft, Keeper, Dynasty)
      const leagueType = league.settings?.type || 0;
      let format = "Redraft";
      if (leagueType === 1) format = "Keeper";
      if (leagueType === 2) format = "Dynasty";

      // Determine waiver type
      const waiverType = league.settings?.waiver_type || 0;
      let waiverSystem = "Normal";
      if (waiverType === 1) waiverSystem = "Rolling";
      if (waiverType === 2) waiverSystem = "FAAB";

      res.json({
        leagueId: league.league_id,
        name: league.name,
        season: league.season,
        status: league.status,
        avatar: league.avatar,
        format,
        totalTeams: league.total_rosters,
        rosterSettings: {
          starterPositions,
          positionCounts,
          benchCount,
          totalStarters: starterPositions.length,
          totalRoster: rosterPositions.length,
        },
        leagueSettings: {
          playoffTeams: league.settings?.playoff_teams || 6,
          playoffWeekStart: league.settings?.playoff_week_start || 15,
          tradeDeadline: league.settings?.trade_deadline || 0,
          waiverSystem,
          waiverBudget: league.settings?.waiver_budget || 100,
        },
        scoringCategories,
        rawScoring: scoring,
      });
    } catch (error) {
      console.error("Error fetching league info:", error);
      res.status(500).json({ message: "Failed to fetch league info" });
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

      if (!rosters || !allPlayers) {
        return res.json({ players: [], week: state?.week || 1 });
      }

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

  // Get current week matchups with scoring
  app.get("/api/sleeper/matchups/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const requestedWeek = req.query.week ? parseInt(req.query.week as string) : null;

      const [league, state, rosters, users, allPlayers] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      if (!league || !state) {
        return res.status(404).json({ message: "League or state not found" });
      }

      const currentWeek = state.display_week || state.week || 1;
      const selectedWeek = requestedWeek || currentWeek;

      const matchupsRaw = await sleeperApi.getMatchups(leagueId, selectedWeek);

      if (!matchupsRaw || matchupsRaw.length === 0) {
        return res.json({
          matchups: [],
          currentWeek,
          selectedWeek,
          seasonType: "regular",
          gamesInProgress: false,
        });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));
      const playerData = allPlayers || {};

      // Group matchups by matchup_id
      const matchupGroups = new Map<number, typeof matchupsRaw>();
      for (const m of matchupsRaw) {
        if (m.matchup_id === null || m.matchup_id === undefined) continue;
        if (!matchupGroups.has(m.matchup_id)) {
          matchupGroups.set(m.matchup_id, []);
        }
        matchupGroups.get(m.matchup_id)!.push(m);
      }

      // Determine if games are in progress (rough heuristic based on current week)
      const gamesInProgress = selectedWeek === currentWeek && state.season === league.season;

      // Get roster positions from league settings (excludes bench positions)
      const rosterPositions = (league.roster_positions || []).filter((pos: string) => pos !== "BN");

      const formatTeam = (matchupData: sleeperApi.SleeperMatchup) => {
        const roster = rosterMap.get(matchupData.roster_id);
        const user = roster ? userMap.get(roster.owner_id) : null;

        const players = (matchupData.starters || []).map((playerId, idx) => {
          const player = playerData[playerId];
          const points = matchupData.starters_points?.[idx] || 0;
          const slotPosition = rosterPositions[idx] || "FLEX";

          return {
            playerId,
            name: player?.full_name || player?.first_name || playerId,
            position: player?.fantasy_positions?.[0] || "?",
            slotPosition, // The lineup slot (QB, RB, FLEX, SUPER_FLEX, etc.)
            team: player?.team || "?",
            points,
            isStarter: true,
          };
        });

        // Add bench players
        const starterIds = new Set(matchupData.starters || []);
        const benchPlayers = Object.entries(matchupData.players_points || {})
          .filter(([playerId]) => !starterIds.has(playerId))
          .map(([playerId, points]) => {
            const player = playerData[playerId];
            return {
              playerId,
              name: player?.full_name || player?.first_name || playerId,
              position: player?.fantasy_positions?.[0] || "?",
              slotPosition: "BN", // Bench
              team: player?.team || "?",
              points: points || 0,
              isStarter: false,
            };
          })
          .sort((a, b) => b.points - a.points);

        return {
          rosterId: matchupData.roster_id,
          ownerId: roster?.owner_id || "",
          ownerName: user?.display_name || user?.username || `Team ${matchupData.roster_id}`,
          avatar: user?.avatar ? sleeperApi.getAvatarUrl(user.avatar) : null,
          totalPoints: matchupData.points || 0,
          players: [...players, ...benchPlayers],
        };
      };

      const matchups = Array.from(matchupGroups.entries())
        .map(([matchupId, teams]) => {
          const teamA = teams[0] ? formatTeam(teams[0]) : null;
          const teamB = teams[1] ? formatTeam(teams[1]) : null;

          return {
            matchupId,
            teamA: teamA!,
            teamB,
          };
        })
        .filter((m) => m.teamA)
        .sort((a, b) => a.matchupId - b.matchupId);

      res.json({
        matchups,
        currentWeek,
        selectedWeek,
        seasonType: selectedWeek >= (league.settings?.playoff_week_start || 15) ? "playoff" : "regular",
        gamesInProgress,
      });
    } catch (error) {
      console.error("Error fetching matchups:", error);
      res.status(500).json({ message: "Failed to fetch matchups" });
    }
  });

  // Get user's schedule for the entire season
  app.get("/api/sleeper/schedule/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      // Get user profile to find their sleeper user id
      const profile = await storage.getUserProfile(userId);
      if (!profile || !profile.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [league, state, rosters, users] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      if (!league || !state) {
        return res.status(404).json({ message: "League or state not found" });
      }

      // Find user's roster
      const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
      if (!userRoster) {
        return res.status(404).json({ message: "User roster not found in this league" });
      }

      const userRosterId = userRoster.roster_id;
      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));

      const currentWeek = state.display_week || state.week || 1;
      const playoffWeekStart = league.settings?.playoff_week_start || 15;

      // Fetch matchups for all regular season weeks in parallel
      const regularSeasonWeeks = playoffWeekStart - 1;
      const weekPromises = Array.from({ length: regularSeasonWeeks }, (_, i) =>
        sleeperApi.getMatchups(leagueId, i + 1).then(matchups => ({ week: i + 1, matchups }))
      );
      const weekResults = await Promise.all(weekPromises);

      // Build schedule from matchups
      const schedule = weekResults.map(({ week, matchups }) => {
        if (!matchups || matchups.length === 0) {
          return {
            week,
            opponent: null,
            userPoints: 0,
            opponentPoints: 0,
            result: "upcoming" as const,
            isPastWeek: week < currentWeek,
            isCurrentWeek: week === currentWeek,
          };
        }

        // Find user's matchup
        const userMatchup = matchups.find(m => m.roster_id === userRosterId);
        if (!userMatchup || userMatchup.matchup_id === null || userMatchup.matchup_id === undefined) {
          return {
            week,
            opponent: null,
            userPoints: 0,
            opponentPoints: 0,
            result: "bye" as const,
            isPastWeek: week < currentWeek,
            isCurrentWeek: week === currentWeek,
          };
        }

        // Find opponent in the same matchup
        const opponentMatchup = matchups.find(
          m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRosterId
        );

        let opponent = null;
        let opponentPoints = 0;

        if (opponentMatchup) {
          const opponentRoster = rosterMap.get(opponentMatchup.roster_id);
          const opponentUser = opponentRoster ? userMap.get(opponentRoster.owner_id) : null;
          opponentPoints = opponentMatchup.points || 0;

          opponent = {
            rosterId: opponentMatchup.roster_id,
            ownerId: opponentRoster?.owner_id || "",
            ownerName: opponentUser?.display_name || opponentUser?.username || `Team ${opponentMatchup.roster_id}`,
            avatar: opponentUser?.avatar ? sleeperApi.getAvatarUrl(opponentUser.avatar) : null,
          };
        }

        const userPoints = userMatchup.points || 0;
        const isPastWeek = week < currentWeek;
        const isCurrentWeek = week === currentWeek;

        let result: "win" | "loss" | "tie" | "upcoming" | "in_progress" | "bye" = "upcoming";
        if (isPastWeek) {
          if (userPoints > opponentPoints) result = "win";
          else if (userPoints < opponentPoints) result = "loss";
          else result = "tie";
        } else if (isCurrentWeek) {
          result = "in_progress";
        }

        return {
          week,
          opponent,
          userPoints,
          opponentPoints,
          result,
          isPastWeek,
          isCurrentWeek,
        };
      });

      // Calculate record
      const wins = schedule.filter(s => s.result === "win").length;
      const losses = schedule.filter(s => s.result === "loss").length;
      const ties = schedule.filter(s => s.result === "tie").length;

      // Get user info for display
      const currentUser = userMap.get(profile.sleeperUserId);

      res.json({
        schedule,
        currentWeek,
        playoffWeekStart,
        record: { wins, losses, ties },
        user: {
          rosterId: userRosterId,
          ownerName: currentUser?.display_name || currentUser?.username || `Team ${userRosterId}`,
          avatar: currentUser?.avatar ? sleeperApi.getAvatarUrl(currentUser.avatar) : null,
        },
        leagueName: league.name,
        season: league.season,
      });
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  // Get playoff bracket
  app.get("/api/sleeper/bracket/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [league, bracket, rosters, users, state] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getPlayoffBracket(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));

      const getTeamInfo = (rosterId: number | null) => {
        if (rosterId === null) return null;
        const roster = rosterMap.get(rosterId);
        if (!roster) return { rosterId, ownerName: "TBD", avatar: null };
        const user = userMap.get(roster.owner_id);
        return {
          rosterId,
          ownerName: user?.display_name || "Unknown",
          avatar: user?.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : null,
        };
      };

      const playoffWeekStart = league.settings?.playoff_week_start || 15;
      const playoffTeams = league.settings?.playoff_teams || 6;
      const currentWeek = state?.display_week || state?.week || 1;

      // Determine number of rounds based on playoff teams
      const numRounds = Math.ceil(Math.log2(playoffTeams));

      // First pass: build a map of losers by round
      // Track which roster IDs lost in each round
      const losersByRound: Record<number, Set<number>> = {};
      (bracket || []).forEach((match) => {
        if (match.l !== null) {
          if (!losersByRound[match.r]) losersByRound[match.r] = new Set();
          losersByRound[match.r].add(match.l);
        }
      });

      // Transform bracket matchups
      const matchups = (bracket || []).map((match) => {
        // Check if metadata says both teams are from losers
        const isBothFromLosersMetadata = !!(match.t1_from?.l && match.t2_from?.l);
        
        // Also check if both teams in this matchup lost in the previous round
        // (for consolation games where Sleeper doesn't set the loser-feed metadata)
        const previousRound = match.r - 1;
        const previousRoundLosers = losersByRound[previousRound] || new Set();
        const team1LostPreviousRound = match.t1 !== null && previousRoundLosers.has(match.t1);
        const team2LostPreviousRound = match.t2 !== null && previousRoundLosers.has(match.t2);
        const isBothFromLosersByHistory = match.r > 1 && team1LostPreviousRound && team2LostPreviousRound;
        
        const isConsolation = isBothFromLosersMetadata || isBothFromLosersByHistory;
        
        return {
          round: match.r,
          matchId: match.m,
          team1: getTeamInfo(match.t1),
          team2: getTeamInfo(match.t2),
          winner: match.w,
          loser: match.l,
          team1From: match.t1_from,
          team2From: match.t2_from,
          isConsolation,
        };
      });

      // Championship bracket: exclude consolation games
      const championshipMatchups = matchups.filter((m) => !m.isConsolation);
      
      // All consolation games (where both teams lost in the previous round)
      const consolationMatchups = matchups
        .filter((m) => m.isConsolation)
        .map((m) => {
          // Determine placement label based on round
          // Final round consolation = 3rd place, semi-final round consolation = 5th place, etc.
          const roundsFromFinal = numRounds - m.round;
          let placementLabel = "";
          if (roundsFromFinal === 0) {
            placementLabel = "3rd Place Game";
          } else if (roundsFromFinal === 1) {
            placementLabel = "5th Place Game";
          } else if (roundsFromFinal === 2) {
            placementLabel = "7th Place Game";
          } else {
            placementLabel = `Consolation Round ${m.round}`;
          }
          return { ...m, placementLabel };
        })
        .sort((a, b) => b.round - a.round); // Sort by round descending (3rd place first, then 5th, etc.)

      // Group matchups by round (championship only)
      const rounds: Record<number, typeof championshipMatchups> = {};
      championshipMatchups.forEach((m) => {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
      });

      res.json({
        leagueId,
        leagueName: league.name,
        season: league.season,
        playoffWeekStart,
        playoffTeams,
        currentWeek,
        numRounds,
        rounds,
        matchups: championshipMatchups,
        consolationMatchups,
        isPlayoffsStarted: currentWeek >= playoffWeekStart,
        isComplete: league.status === "complete",
      });
    } catch (error) {
      console.error("Error fetching playoff bracket:", error);
      res.status(500).json({ message: "Failed to fetch playoff bracket" });
    }
  });

  // Get devy players with rankings and draft eligibility from KTC
  app.get("/api/sleeper/devy", isAuthenticated, async (req: any, res: Response) => {
    try {
      // Use KTC devy rankings instead of Sleeper data
      const devyPlayers = ktcValues.getDevyPlayers();

      // Transform to match expected format
      const rankedPlayers = devyPlayers.map((player, index) => ({
        playerId: player.id,
        name: player.name,
        position: player.position,
        positionRank: player.positionRank,
        college: player.college,
        draftEligibleYear: player.draftEligibleYear,
        tier: player.tier,
        trend30Day: player.trend30Day,
        value: player.value,
        rank: index + 1,
      }));

      // Get unique positions and years for filters
      const positions = Array.from(new Set(rankedPlayers.map(p => p.position))).sort();
      const years = Array.from(new Set(rankedPlayers.map(p => p.draftEligibleYear))).sort((a, b) => a - b);

      res.json({
        players: rankedPlayers,
        positions,
        years,
        totalCount: rankedPlayers.length,
        source: "KTC",
      });
    } catch (error) {
      console.error("Error fetching devy players:", error);
      res.status(500).json({ message: "Failed to fetch devy players" });
    }
  });

  // Get AI-generated insights for a devy player
  app.get("/api/sleeper/devy/:playerId/insights", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      
      // Get player from KTC data
      const player = ktcValues.getDevyPlayerById(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Generate AI insights about the player
      const prompt = `You are a college football and NFL draft expert providing dynasty fantasy football analysis. Generate a comprehensive scouting report for the following college prospect:

Player: ${player.name}
Position: ${player.position}
College: ${player.college}
Draft Eligible: ${player.draftEligibleYear}
KTC Ranking: #${player.rank} overall, ${player.position}${player.positionRank}
Dynasty Value Tier: ${player.tier}
KTC Value: ${player.value}
30-Day Trend: ${player.trend30Day > 0 ? '+' + player.trend30Day : player.trend30Day}

Please provide:
1. **Player Overview**: A 2-3 sentence summary of who this player is and their current status
2. **College Performance**: Key stats, achievements, and highlights from their college career (be specific with stats if known)
3. **Strengths**: 3-4 key strengths that make them a valuable dynasty asset
4. **Areas to Improve**: 2-3 areas where they need development
5. **NFL Comparison**: 1-2 NFL player comparisons for their play style
6. **Draft Outlook**: Expected draft position and landing spot analysis
7. **Dynasty Value**: Analysis of their fantasy football ceiling and floor, and whether they're a buy/hold/sell at current value

Format your response with clear section headers using markdown. Be concise but informative. Focus on actionable fantasy football insights.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert college football analyst and dynasty fantasy football advisor. Provide accurate, up-to-date information about college prospects. If you don't have specific information about a player, provide reasonable context based on their school, position, and ranking. Always be helpful and provide actionable dynasty fantasy advice."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const insights = response.choices[0]?.message?.content || "Unable to generate insights at this time.";

      res.json({
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          positionRank: player.positionRank,
          college: player.college,
          draftEligibleYear: player.draftEligibleYear,
          tier: player.tier,
          value: player.value,
          trend30Day: player.trend30Day,
          rank: player.rank,
        },
        insights,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating devy player insights:", error);
      res.status(500).json({ message: "Failed to generate player insights" });
    }
  });

  // Get devy player full profile with bio, college stats, game logs, and news
  app.get("/api/sleeper/devy/:playerId/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      
      const player = ktcValues.getDevyPlayerById(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Import college stats service
      const { getCollegePlayerProfile, getCollegePlayerHeadshotUrl } = await import("./college-stats-service");
      
      // Fetch real ESPN college stats
      const espnProfile = await getCollegePlayerProfile(player.name, player.college);
      
      // Format ESPN stats to our structure
      let collegeStats = { seasons: [] as any[], careerTotals: {} as Record<string, any> };
      let gameLogs: any[] = [];
      let bio = {
        height: "N/A",
        weight: "N/A",
        hometown: "N/A",
        highSchoolRank: "N/A",
        class: "N/A",
        conference: "N/A"
      };
      let headshot: string | null = null;
      
      if (espnProfile) {
        // Use real ESPN bio data
        bio = {
          height: espnProfile.bio.height || "N/A",
          weight: espnProfile.bio.weight || "N/A",
          hometown: espnProfile.bio.hometown || "N/A",
          highSchoolRank: "N/A", // ESPN doesn't provide this
          class: espnProfile.bio.class || "N/A",
          conference: "N/A" // Will be extracted from team if needed
        };
        
        headshot = espnProfile.bio.headshot || getCollegePlayerHeadshotUrl(espnProfile.espnId || "");
        
        // Format seasons from ESPN data
        collegeStats.seasons = espnProfile.seasons.map(s => ({
          year: s.year,
          games: s.games,
          stats: {
            passYds: s.stats["YDS"] || s.stats["PYDS"] || s.stats["PassingYDS"] || 0,
            passTd: s.stats["TD"] || s.stats["PTD"] || s.stats["PassingTD"] || 0,
            passInt: s.stats["INT"] || 0,
            completions: s.stats["CMP"] || s.stats["Completions"] || 0,
            attempts: s.stats["ATT"] || s.stats["Attempts"] || 0,
            rushYds: s.stats["RYDS"] || s.stats["RushingYDS"] || s.stats["YDS"] || 0,
            rushTd: s.stats["RTD"] || s.stats["RushingTD"] || s.stats["TD"] || 0,
            rushAtt: s.stats["CAR"] || s.stats["ATT"] || s.stats["Carries"] || 0,
            rushAvg: s.stats["AVG"] || s.stats["YPC"] || 0,
            rushLng: s.stats["LNG"] || s.stats["Long"] || 0,
            recYds: s.stats["RECYDS"] || s.stats["ReceivingYDS"] || 0,
            recTd: s.stats["RECTD"] || s.stats["ReceivingTD"] || 0,
            receptions: s.stats["REC"] || s.stats["Receptions"] || 0,
            targets: s.stats["TAR"] || s.stats["Targets"] || 0,
            recAvg: s.stats["RECAVG"] || s.stats["YPR"] || 0,
            recLng: s.stats["RECLNG"] || 0,
            fumbles: s.stats["FUM"] || 0,
            fumblesLost: s.stats["LOST"] || s.stats["FL"] || 0,
            ...s.stats // Include all raw stats too
          }
        }));
        
        // Format career totals
        collegeStats.careerTotals = {
          games: espnProfile.careerTotals["GP"] || espnProfile.careerTotals["G"] || 0,
          passYds: espnProfile.careerTotals["YDS"] || espnProfile.careerTotals["PYDS"] || 0,
          passTd: espnProfile.careerTotals["TD"] || espnProfile.careerTotals["PTD"] || 0,
          rushYds: espnProfile.careerTotals["RYDS"] || 0,
          rushTd: espnProfile.careerTotals["RTD"] || 0,
          rushAtt: espnProfile.careerTotals["CAR"] || 0,
          recYds: espnProfile.careerTotals["RECYDS"] || 0,
          recTd: espnProfile.careerTotals["RECTD"] || 0,
          receptions: espnProfile.careerTotals["REC"] || 0,
          ...espnProfile.careerTotals // Include all raw stats
        };
        
        // Format game logs from ESPN
        gameLogs = espnProfile.gameLogs.slice(0, 15).map(g => ({
          week: g.week,
          opponent: g.opponent,
          result: g.result || `${g.homeAway === "home" ? "vs" : "@"} ${g.score}`,
          stats: formatGameLogStats(g.stats, player.position),
          date: g.date,
          season: g.season
        }));
      }
      
      // Use AI only for scouting analysis (not stats)
      const scoutingPrompt = `You are a dynasty fantasy football expert analyzing ${player.name} (${player.position}) from ${player.college}.

Return a JSON object with this EXACT structure (no markdown, just valid JSON):
{
  "analysisNotes": [
    {
      "title": "Dynasty Fantasy Analysis Note",
      "insight": "Detailed insight about player's value, production, or projection",
      "category": "scouting|production|projection|concern"
    }
  ],
  "scoutingReport": {
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "nflComparison": "NFL player comparison",
    "draftProjection": "Round 1, top 15 pick",
    "fantasyOutlook": "Brief dynasty value outlook"
  },
  "highSchoolRank": "string like 5-star, #3 nationally or 4-star recruit",
  "conference": "string like SEC or Big Ten"
}

KTC Dynasty Value: ${player.value}
Draft Eligible: ${player.draftEligibleYear}
Position Rank: ${player.position}${player.positionRank}
Overall Rank: #${player.rank}

IMPORTANT:
- Include 3-4 analysis notes with dynasty fantasy insights (scouting observations, production analysis, projection notes, or concerns)
- Provide accurate high school recruiting ranking if known
- Provide their college conference (SEC, Big Ten, ACC, etc.)
Return ONLY valid JSON, no other text.`;

      let scoutingData: any = {
        analysisNotes: [],
        scoutingReport: { strengths: [], weaknesses: [], nflComparison: "N/A", draftProjection: "N/A", fantasyOutlook: "N/A" },
        highSchoolRank: "N/A",
        conference: "N/A"
      };

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a dynasty fantasy football analyst. Return ONLY valid JSON with no markdown formatting."
            },
            {
              role: "user",
              content: scoutingPrompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        cleanContent = cleanContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        scoutingData = JSON.parse(cleanContent);
      } catch (aiError) {
        console.error("Failed to get AI scouting data:", aiError);
      }

      // Merge AI scouting data with bio
      if (scoutingData.highSchoolRank && scoutingData.highSchoolRank !== "N/A") {
        bio.highSchoolRank = scoutingData.highSchoolRank;
      }
      if (scoutingData.conference && scoutingData.conference !== "N/A") {
        bio.conference = scoutingData.conference;
      }

      res.json({
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          positionRank: player.positionRank,
          college: player.college,
          draftEligibleYear: player.draftEligibleYear,
          tier: player.tier,
          value: player.value,
          trend30Day: player.trend30Day,
          rank: player.rank,
          headshot: headshot,
        },
        bio,
        collegeStats,
        gameLogs,
        analysisNotes: scoutingData.analysisNotes || [],
        scoutingReport: scoutingData.scoutingReport || { strengths: [], weaknesses: [], nflComparison: "N/A", draftProjection: "N/A", fantasyOutlook: "N/A" },
        news: [], // Backward compatibility
        espnId: espnProfile?.espnId || null,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching devy player profile:", error);
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // Helper function to format game log stats based on position
  function formatGameLogStats(stats: Record<string, any>, position: string): string {
    const parts: string[] = [];
    
    if (position === "QB") {
      if (stats["CMP"] || stats["ATT"]) parts.push(`${stats["CMP"] || 0}/${stats["ATT"] || 0}`);
      if (stats["YDS"] || stats["PYDS"]) parts.push(`${stats["YDS"] || stats["PYDS"]} yds`);
      if (stats["TD"] || stats["PTD"]) parts.push(`${stats["TD"] || stats["PTD"]} TD`);
      if (stats["INT"]) parts.push(`${stats["INT"]} INT`);
    } else if (position === "RB") {
      if (stats["CAR"]) parts.push(`${stats["CAR"]} car`);
      if (stats["YDS"] || stats["RYDS"]) parts.push(`${stats["YDS"] || stats["RYDS"]} yds`);
      if (stats["TD"] || stats["RTD"]) parts.push(`${stats["TD"] || stats["RTD"]} TD`);
      if (stats["REC"]) parts.push(`${stats["REC"]} rec`);
      if (stats["RECYDS"]) parts.push(`${stats["RECYDS"]} rec yds`);
    } else if (position === "WR" || position === "TE") {
      if (stats["REC"]) parts.push(`${stats["REC"]} rec`);
      if (stats["YDS"] || stats["RECYDS"]) parts.push(`${stats["YDS"] || stats["RECYDS"]} yds`);
      if (stats["TD"] || stats["RECTD"]) parts.push(`${stats["TD"] || stats["RECTD"]} TD`);
      if (stats["TAR"]) parts.push(`${stats["TAR"]} tar`);
    }
    
    return parts.length > 0 ? parts.join(", ") : "No stats";
  }

  // Get NFL players list (excluding devy players)
  app.get("/api/sleeper/players", isAuthenticated, async (req: any, res: Response) => {
    try {
      const leagueId = req.query.leagueId as string | undefined;
      
      // Get league scoring settings if leagueId provided
      let scoringSettings: Record<string, number> = {
        // Default PPR scoring if no league specified
        pass_yd: 0.04,
        pass_td: 4,
        pass_int: -2,
        rush_yd: 0.1,
        rush_td: 6,
        rec: 1,
        rec_yd: 0.1,
        rec_td: 6,
        fum_lost: -2,
      };
      
      if (leagueId) {
        const league = await sleeperApi.getLeague(leagueId);
        if (league?.scoring_settings) {
          scoringSettings = league.scoring_settings;
        }
      }

      // Get current state to determine the right season for stats
      const state = await sleeperApi.getState();
      
      // Determine the correct season for stats:
      // The NFL season runs Sep-Feb, so in Jan-Aug we should use the previous year's completed season
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)
      const currentYear = currentDate.getFullYear();
      
      // Before September, use the previous year's season (which has complete stats)
      // After September, use the current year's season
      let statsSeason: string;
      if (currentMonth < 8) { // Before September
        statsSeason = String(currentYear - 1);
      } else {
        statsSeason = String(currentYear);
      }
      
      // Position-specific reception bonuses
      const tePremium = scoringSettings.bonus_rec_te || 0;
      const rbBonus = scoringSettings.bonus_rec_rb || 0;
      const wrBonus = scoringSettings.bonus_rec_wr || 0;
      
      const [allPlayers, seasonStats] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getSeasonStats(statsSeason, "regular"),
      ]);
      
      const devyPlayerIds = new Set(ktcValues.KTC_DEVY_PLAYERS.map(p => p.id));
      
      // Filter to active NFL players (exclude devy/college players)
      const nflPlayers: any[] = [];
      const positions = ["QB", "RB", "WR", "TE"];
      
      Object.entries(allPlayers).forEach(([playerId, player]: [string, any]) => {
        // Skip devy players
        if (devyPlayerIds.has(playerId)) return;
        
        // Only include active NFL players with valid positions
        const position = player.position || player.fantasy_positions?.[0];
        if (!positions.includes(position)) return;
        
        // Must be on an NFL team
        if (!player.team) return;
        
        // Get player stats
        const playerStats = seasonStats[playerId];
        
        // Calculate fantasy points based on league scoring settings
        let fantasyPoints = sleeperApi.calculateFantasyPoints(playerStats, scoringSettings);
        
        // Apply position-specific reception bonuses
        const receptions = playerStats?.rec || 0;
        if (position === "TE" && tePremium > 0 && receptions > 0) {
          fantasyPoints += receptions * tePremium;
        }
        if (position === "RB" && rbBonus > 0 && receptions > 0) {
          fantasyPoints += receptions * rbBonus;
        }
        if (position === "WR" && wrBonus > 0 && receptions > 0) {
          fantasyPoints += receptions * wrBonus;
        }
        fantasyPoints = Math.round(fantasyPoints * 100) / 100;
        
        // Only include players with actual production (minimum 10 points)
        if (fantasyPoints < 10) return;
        
        // Get games played
        const gamesPlayed = playerStats?.gp || 0;
        const pointsPerGame = gamesPlayed > 0 ? Math.round((fantasyPoints / gamesPlayed) * 10) / 10 : 0;
        
        // Get KTC dynasty value for reference
        const dynastyValue = ktcValues.getPlayerValue(
          playerId,
          position,
          player.age,
          player.years_exp || 0
        );
        
        // ESPN headshot URL
        const headshot = player.espn_id 
          ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`
          : null;
        
        nflPlayers.push({
          id: playerId,
          name: player.position === "DEF" 
            ? `${player.first_name} ${player.last_name}`
            : `${player.first_name?.charAt(0) || ""}. ${player.last_name || ""}`.trim(),
          fullName: `${player.first_name || ""} ${player.last_name || ""}`.trim(),
          position,
          team: player.team,
          age: player.age,
          yearsExp: player.years_exp || 0,
          fantasyPoints,
          pointsPerGame,
          gamesPlayed,
          dynastyValue,
          injuryStatus: player.injury_status || null,
          number: player.number,
          college: player.college,
          height: player.height,
          weight: player.weight,
          headshot,
          snapPct: playerStats?.off_snp && playerStats?.tm_off_snp 
            ? Math.round((playerStats.off_snp / playerStats.tm_off_snp) * 100 * 10) / 10
            : null,
          stats: {
            passYd: playerStats?.pass_yd || 0,
            passTd: playerStats?.pass_td || 0,
            passInt: playerStats?.pass_int || 0,
            passAtt: playerStats?.pass_att || 0,
            passCmp: playerStats?.pass_cmp || 0,
            passFd: playerStats?.pass_fd || 0,
            rushYd: playerStats?.rush_yd || 0,
            rushTd: playerStats?.rush_td || 0,
            rushAtt: playerStats?.rush_att || 0,
            rushFd: playerStats?.rush_fd || 0,
            rec: playerStats?.rec || 0,
            recYd: playerStats?.rec_yd || 0,
            recTd: playerStats?.rec_td || 0,
            recTgt: playerStats?.rec_tgt || 0,
            recFd: playerStats?.rec_fd || 0,
          },
        });
      });
      
      // Sort by fantasy points descending (actual production)
      nflPlayers.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
      
      // Add overall rank and position rank
      const positionRanks: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      
      nflPlayers.forEach((player, index) => {
        player.overallRank = index + 1;
        positionRanks[player.position] = (positionRanks[player.position] || 0) + 1;
        player.positionRank = positionRanks[player.position];
      });
      
      // Determine scoring type label
      const scoringType = sleeperApi.getScoringType(scoringSettings);
      const scoringLabel = scoringType === "ppr" ? "PPR" : scoringType === "half_ppr" ? "Half PPR" : "Standard";
      
      // Check if this league has custom scoring beyond standard formats
      const hasPositionBonuses = tePremium !== 0 || rbBonus !== 0 || wrBonus !== 0;
      const hasNonStandardTds = (scoringSettings.pass_td || 4) !== 4;
      const isCustomScoring = hasPositionBonuses || hasNonStandardTds;
      
      res.json({
        players: nflPlayers,
        totalCount: nflPlayers.length,
        season: statsSeason,
        scoringType: isCustomScoring ? `${scoringLabel} (custom)` : scoringLabel,
        isCustomScoring,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching NFL players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  // Get player insights with real news from ESPN and AI-generated analysis
  app.get("/api/sleeper/players/:playerId/insights", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const [allPlayers, state] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);
      const player = allPlayers[playerId];
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      // Get current date and NFL week for context
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();
      const seasonType = state?.season_type || "regular"; // Sleeper returns: "regular", "post", "pre", or "off"
      
      // Use Sleeper's season_type to determine phase
      // Sleeper season_types: "pre" (preseason), "regular", "post" (playoffs), "off" (offseason)
      let seasonPhase: "regular" | "playoffs" | "offseason" = "regular";
      if (seasonType === "post") {
        seasonPhase = "playoffs";
      } else if (seasonType === "off" || seasonType === "pre") {
        seasonPhase = "offseason";
      }
      
      const position = player.position || player.fantasy_positions?.[0] || "N/A";
      const value = ktcValues.getPlayerValue(
        playerId,
        position,
        player.age,
        player.years_exp || 0
      );
      
      const playerName = `${player.first_name || ""} ${player.last_name || ""}`.trim();
      const team = player.team || "Free Agent";
      const age = player.age || "Unknown";
      const yearsExp = player.years_exp || 0;
      
      // Fetch real news from ESPN for this player
      const playerNews = await newsService.fetchPlayerNews(playerName, team);
      
      // Build news section from real articles
      let newsSection = "";
      if (playerNews.length > 0) {
        newsSection = playerNews.map(article => 
          `- ${article.title} (${article.source})`
        ).join("\n");
      } else {
        newsSection = "No recent news articles found for this player.";
      }
      
      // Build phase-appropriate prompt
      let phaseContext = "";
      let fantasyOutlookSection = "";
      // For offseason, the "next" season is the current season shown in Sleeper
      // During regular/post season, next season is current + 1
      const nextSeason = seasonPhase === "offseason" 
        ? currentSeason 
        : (parseInt(currentSeason) + 1).toString();
      
      if (seasonPhase === "playoffs") {
        phaseContext = `We are currently in the NFL Playoffs (Week ${currentWeek}). Teams are competing in the postseason with championship implications.`;
        fantasyOutlookSection = `**Fantasy Outlook**: Current playoff performance and championship impact. If their team is still competing, discuss their role and recent production. If eliminated, note their season summary.`;
      } else if (seasonPhase === "offseason") {
        phaseContext = `It is the ${nextSeason} NFL offseason. The regular season has ended and teams are in free agency/draft preparation mode.`;
        fantasyOutlookSection = `**${nextSeason} Outlook**: Next season projections including potential free agency moves, draft capital that could affect their role, offseason storylines, and early ${nextSeason} fantasy value expectations.`;
      } else {
        phaseContext = `We are in Week ${currentWeek} of the ${currentSeason} NFL regular season.`;
        fantasyOutlookSection = `**Fantasy Outlook**: Week ${currentWeek} fantasy value, current role on team, and upcoming matchup expectations.`;
      }
      
      const prompt = `Today is ${currentDate}. ${phaseContext}

You are a fantasy football expert. Provide a brief analysis for ${playerName}, ${position} for the ${team}.

Player Info:
- Age: ${age}
- Experience: ${yearsExp} year${yearsExp !== 1 ? 's' : ''} in the NFL
- Injury Status: ${player.injury_status || 'Healthy'}
- College: ${player.college || 'Unknown'}
- Dynasty Trade Value: ${value.toLocaleString()}

Provide a concise response with these 2 sections (keep each section to 2-3 sentences max):

${fantasyOutlookSection}

**Dynasty Analysis**: Long-term value, age curve considerations, and whether to buy/hold/sell.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      });

      const aiInsights = response.choices[0]?.message?.content || "Unable to generate insights.";
      
      // Combine real news with AI analysis
      const insights = `**Latest News**:\n${newsSection}\n\n${aiInsights}`;
      
      res.json({
        player: {
          id: playerId,
          name: playerName,
          position,
          team,
          age,
          yearsExp,
          value,
          injuryStatus: player.injury_status || null,
          number: player.number,
          college: player.college,
          height: player.height,
          weight: player.weight,
        },
        insights,
        news: playerNews, // Also include raw news articles for potential UI use
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating player insights:", error);
      res.status(500).json({ message: "Failed to generate player insights" });
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

      if (!rosters || rosters.length === 0) {
        return res.json({ rosters: [] });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const playerData = allPlayers || {};

      const rostersWithAssets = rosters.map((roster) => {
        const user = userMap.get(roster.owner_id);
        
        // Get player assets
        const players = (roster.players || []).map((playerId) => {
          const player = playerData[playerId];
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
        const picks = (draftPicks || [])
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
            if (!currentPicks.has(id) && !(draftPicks || []).find(
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

  // Get single team roster with players and picks
  app.get("/api/sleeper/team/:leagueId/:rosterId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId, rosterId } = req.params;
      const rosterIdNum = parseInt(rosterId);

      const [rosters, users, allPlayers, draftPicks, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueDraftPicks(leagueId),
        sleeperApi.getLeague(leagueId),
      ]);

      if (!rosters || rosters.length === 0) {
        return res.status(404).json({ message: "Rosters not found" });
      }

      const roster = rosters.find((r) => r.roster_id === rosterIdNum);
      if (!roster) {
        return res.status(404).json({ message: "Team not found" });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const playerData = allPlayers || {};
      const user = userMap.get(roster.owner_id);

      // Helper for display name
      const getDisplayName = (player: any): string => {
        if (player.position === "DEF") {
          return player.first_name + " " + player.last_name;
        }
        const firstName = player.first_name || "";
        const lastName = player.last_name || "";
        const firstInitial = firstName ? firstName.charAt(0) + "." : "";
        return `${firstInitial} ${lastName}`.trim();
      };

      // Get roster slot positions from league settings (excluding BN = bench)
      const rosterPositions = (league?.roster_positions || []).filter((pos: string) => pos !== "BN");
      
      // Build starters in slot order using roster.starters (which is already ordered by slot)
      const starters: any[] = [];
      const bench: any[] = [];
      const taxi: any[] = [];
      const ir: any[] = [];

      const starterIds = new Set(roster.starters || []);
      const taxiIds = new Set(roster.taxi || []);
      const reserveIds = new Set(roster.reserve || []);

      // Process starters in order to match with slot positions
      (roster.starters || []).forEach((playerId, index) => {
        if (!playerId) return; // Empty slot
        const player = playerData[playerId];
        if (!player) return;

        const position = player.position || player.fantasy_positions?.[0] || "N/A";
        const slotPosition = rosterPositions[index] || position;
        
        starters.push({
          id: playerId,
          name: getDisplayName(player),
          fullName: `${player.first_name} ${player.last_name}`,
          position,
          slotPosition,
          team: player.team || "FA",
          age: player.age,
          value: ktcValues.getPlayerValue(playerId, position, player.age, player.years_exp || 0),
        });
      });

      // Process non-starters (bench, taxi, IR)
      (roster.players || []).forEach((playerId) => {
        if (starterIds.has(playerId)) return; // Already processed as starter
        
        const player = playerData[playerId];
        if (!player) return;

        const position = player.position || player.fantasy_positions?.[0] || "N/A";
        const playerInfo = {
          id: playerId,
          name: getDisplayName(player),
          fullName: `${player.first_name} ${player.last_name}`,
          position,
          team: player.team || "FA",
          age: player.age,
          value: ktcValues.getPlayerValue(playerId, position, player.age, player.years_exp || 0),
        };

        if (taxiIds.has(playerId)) {
          taxi.push(playerInfo);
        } else if (reserveIds.has(playerId)) {
          ir.push(playerInfo);
        } else {
          bench.push(playerInfo);
        }
      });

      // Sort bench, taxi, IR by value descending (starters stay in slot order)
      const sortByValue = (a: any, b: any) => b.value - a.value;
      bench.sort(sortByValue);
      taxi.sort(sortByValue);
      ir.sort(sortByValue);

      // Get draft picks for this roster
      const tradedPicks = (draftPicks || []).filter((p) => p.owner_id === rosterIdNum);
      const totalRosters = league?.total_rosters || rosters.length;

      const picks: any[] = [];
      const currentYear = new Date().getFullYear();
      
      // Generate picks for next 3 years
      for (let season = currentYear; season <= currentYear + 2; season++) {
        for (let round = 1; round <= 5; round++) {
          const id = `${season}-${round}-${rosterIdNum}`;
          const tradedAway = tradedPicks.find(
            (p) => p.season === String(season) && p.round === round && p.previous_owner_id === rosterIdNum
          );
          const tradedIn = tradedPicks.find(
            (p) => p.season === String(season) && p.round === round && p.owner_id === rosterIdNum && p.previous_owner_id !== rosterIdNum
          );

          if (tradedAway && !tradedIn) {
            // Team traded this pick away, skip it
            continue;
          }

          if (tradedIn) {
            // Got a pick from another team
            const originalOwner = rosters.find((r) => r.roster_id === tradedIn.previous_owner_id);
            const originalUser = originalOwner ? userMap.get(originalOwner.owner_id) : null;
            picks.push({
              id: `${season}-${round}-${tradedIn.previous_owner_id}`,
              name: `${season} Round ${round} (from ${originalUser?.display_name || "Unknown"})`,
              season: String(season),
              round,
              originalOwner: originalUser?.display_name || "Unknown",
              isOwn: false,
              value: ktcValues.getPickValue(String(season), round),
            });
          } else {
            // Own pick
            picks.push({
              id,
              name: `${season} Round ${round}`,
              season: String(season),
              round,
              isOwn: true,
              value: ktcValues.getPickValue(String(season), round),
            });
          }
        }
      }

      // Calculate total roster value
      const allPlayers2 = [...starters, ...bench, ...taxi, ...ir];
      const totalPlayerValue = allPlayers2.reduce((sum, p) => sum + p.value, 0);
      const totalPickValue = picks.reduce((sum, p) => sum + p.value, 0);

      res.json({
        rosterId: roster.roster_id,
        ownerId: roster.owner_id,
        ownerName: user?.display_name || "Unknown",
        avatar: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
        record: {
          wins: roster.settings.wins || 0,
          losses: roster.settings.losses || 0,
          ties: roster.settings.ties || 0,
          pointsFor: (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100,
          pointsAgainst: (roster.settings.fpts_against || 0) + (roster.settings.fpts_against_decimal || 0) / 100,
          maxPoints: (roster.settings.ppts || 0) + (roster.settings.ppts_decimal || 0) / 100,
        },
        starters,
        bench,
        taxi,
        ir,
        picks,
        totalPlayerValue,
        totalPickValue,
        totalValue: totalPlayerValue + totalPickValue,
      });
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Analyze trade
  app.post("/api/trade/analyze", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = analyzeTradeSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid trade data" });
      }

      const { leagueId, teamAId, teamBId, teamAName, teamBName, teamAAssets, teamBAssets } = parsed.data;

      const teamADisplayName = teamAName || "Team A";
      const teamBDisplayName = teamBName || "Team B";

      const teamAValue = teamAAssets.reduce((sum: number, a) => sum + a.value, 0);
      const teamBValue = teamBAssets.reduce((sum: number, a) => sum + a.value, 0);

      const gradeResult = ktcValues.calculateTradeGrade(teamAValue, teamBValue);

      // Generate AI analysis
      let aiAnalysis = "";
      try {
        const teamAPlayerNames = teamAAssets.map((a: any) => a.name).join(", ");
        const teamBPlayerNames = teamBAssets.map((a: any) => a.name).join(", ");

        const prompt = `Analyze this fantasy football dynasty trade:

TRADE DETAILS:
- ${teamADisplayName} SENDS: ${teamAPlayerNames || "Nothing"} (value: ${teamAValue})
- ${teamADisplayName} RECEIVES: ${teamBPlayerNames || "Nothing"} (value: ${teamBValue})

- ${teamBDisplayName} SENDS: ${teamBPlayerNames || "Nothing"} (value: ${teamBValue})
- ${teamBDisplayName} RECEIVES: ${teamAPlayerNames || "Nothing"} (value: ${teamAValue})

Trade grade: ${gradeResult.grade}
Value difference: ${Math.abs(gradeResult.difference)} points (${gradeResult.percentageDiff.toFixed(1)}%)
${gradeResult.winner === "A" ? `${teamADisplayName} receives more value.` : gradeResult.winner === "B" ? `${teamBDisplayName} receives more value.` : "Trade is even."}

Provide a brief 2-3 sentence analysis. Be specific about who wins and what they're getting. Use the owner names ${teamADisplayName} and ${teamBDisplayName}, never "Team A" or "Team B".`;

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
          teamName: teamADisplayName,
          assets: teamAAssets,
          totalValue: teamAValue,
        },
        teamB: {
          teamId: teamBId,
          teamName: teamBDisplayName,
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

  // Get trade history (all seasons)
  app.get("/api/sleeper/trades/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [historicalTransactions, rosters, users, allPlayers] = await Promise.all([
        sleeperApi.getAllHistoricalTransactions(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      if (!historicalTransactions || !rosters) {
        return res.json({ 
          seasonTrades: [], 
          teamStats: [], 
          leagueHistory: [], 
          bestTrades: [], 
          totalTrades: 0,
          currentSeason: "2025"
        });
      }

      const userMap = new Map((users || []).map((u: sleeperApi.SleeperUser) => [u.user_id, u]));
      const rosterToOwner = new Map(rosters.map((r: sleeperApi.SleeperRoster) => [r.roster_id, r.owner_id]));
      const playerData = allPlayers || {};

      // Helper to format player names as "First Initial. Last Name"
      const formatPlayerName = (fullName: string): string => {
        if (!fullName) return "Unknown";
        const parts = fullName.split(" ");
        if (parts.length === 1) return fullName;
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        return `${firstName.charAt(0)}. ${lastName}`;
      };

      // Helper to get asset value using KTC values
      const getAssetValue = (asset: { type: string; id: string; name: string; position?: string }): number => {
        if (asset.type === "player") {
          const player = playerData[asset.id];
          const position = asset.position || player?.fantasy_positions?.[0] || "WR";
          const age = player?.age || 25;
          const yearsExp = player?.years_exp || 0;
          return ktcValues.getPlayerValue(asset.id, position, age, yearsExp);
        } else if (asset.type === "pick") {
          const match = asset.name.match(/(\d{4}) Round (\d+)/);
          if (match) {
            const year = match[1];
            const round = parseInt(match[2]);
            return ktcValues.getPickValue(year, round);
          }
        }
        return 0;
      };

      // Process trades by season
      const seasonTrades: any[] = [];
      const allTrades: any[] = [];

      for (const seasonData of historicalTransactions) {
        const tradesForSeason = seasonData.transactions
          .filter((t) => t.type === "trade" && t.status === "complete")
          .sort((a, b) => b.created - a.created)
          .map((trade) => {
            const [rosterId1, rosterId2] = trade.roster_ids;
            const ownerId1 = rosterToOwner.get(rosterId1);
            const ownerId2 = rosterToOwner.get(rosterId2);
            const user1 = ownerId1 ? userMap.get(ownerId1) : null;
            const user2 = ownerId2 ? userMap.get(ownerId2) : null;

            const team1Received: any[] = [];
            const team2Received: any[] = [];

            // Players
            if (trade.adds) {
              Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
                const player = playerData[playerId];
                const asset = {
                  id: playerId,
                  name: player?.full_name || playerId,
                  displayName: formatPlayerName(player?.full_name || playerId),
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
                  displayName: `'${pick.season.slice(-2)} Rd ${pick.round}`,
                  type: "pick" as const,
                };
                if (pick.owner_id === rosterId1) team1Received.push(asset);
                else if (pick.owner_id === rosterId2) team2Received.push(asset);
              });
            }

            // Calculate trade values
            const team1Value = team1Received.reduce((sum, a) => sum + getAssetValue(a), 0);
            const team2Value = team2Received.reduce((sum, a) => sum + getAssetValue(a), 0);
            const valueDiff = team1Value - team2Value;

            return {
              transactionId: trade.transaction_id,
              timestamp: trade.created,
              week: trade.leg,
              season: seasonData.season,
              team1: {
                rosterId: rosterId1,
                ownerName: user1?.display_name || user1?.username || "Unknown",
                avatar: sleeperApi.getAvatarUrl(user1?.avatar || null),
                received: team1Received,
                value: team1Value,
              },
              team2: {
                rosterId: rosterId2,
                ownerName: user2?.display_name || user2?.username || "Unknown",
                avatar: sleeperApi.getAvatarUrl(user2?.avatar || null),
                received: team2Received,
                value: team2Value,
              },
              valueDiff,
              absValueDiff: Math.abs(valueDiff),
            };
          });

        if (tradesForSeason.length > 0) {
          seasonTrades.push({
            season: seasonData.season,
            trades: tradesForSeason,
          });
          allTrades.push(...tradesForSeason);
        }
      }

      // Calculate team stats across all seasons
      const teamStats = new Map<string, any>();
      
      rosters.forEach((roster) => {
        const user = userMap.get(roster.owner_id);
        teamStats.set(roster.owner_id, {
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
          totalTrades: 0,
          tradingPartners: {},
        });
      });

      allTrades.forEach((trade) => {
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

      // Find best and worst trades (by value difference)
      const tradesWithValue = allTrades.filter(t => t.absValueDiff > 0);
      const sortedByDiff = [...tradesWithValue].sort((a, b) => b.absValueDiff - a.absValueDiff);
      const topTrades = sortedByDiff.slice(0, 5);

      // Generate AI analysis for top trades
      const generateTradeAnalysis = async (trade: any): Promise<string> => {
        const winner = trade.valueDiff > 0 ? trade.team1 : trade.team2;
        const loser = trade.valueDiff > 0 ? trade.team2 : trade.team1;
        const winnerAssets = winner.received.map((a: any) => a.displayName || a.name).join(", ");
        const loserAssets = loser.received.map((a: any) => a.displayName || a.name).join(", ");

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a dynasty fantasy football expert analyzing trade history. Give a brief, insightful analysis of this trade in 1-2 sentences. Focus on why the trade was good or bad for the winner.",
              },
              {
                role: "user",
                content: `In ${trade.season}, ${winner.ownerName} traded ${loserAssets} and received ${winnerAssets}. They gained ${trade.absValueDiff} in dynasty value. Why was this a good trade for them?`,
              },
            ],
            max_tokens: 100,
          });
          return response.choices[0]?.message?.content || "Trade analysis unavailable";
        } catch (error) {
          return "Trade analysis unavailable";
        }
      };

      // Generate AI analysis for top 3 trades only (to keep API costs down)
      const bestTradesWithAnalysis = await Promise.all(
        topTrades.slice(0, 3).map(async (trade) => {
          const analysis = await generateTradeAnalysis(trade);
          const winner = trade.valueDiff > 0 ? trade.team1.ownerName : trade.team2.ownerName;
          const loser = trade.valueDiff > 0 ? trade.team2.ownerName : trade.team1.ownerName;
          return {
            ...trade,
            winner,
            loser,
            aiAnalysis: analysis,
          };
        })
      );

      const league = await sleeperApi.getLeague(leagueId);
      const leagueHistory = await sleeperApi.getLeagueHistory(leagueId);

      res.json({
        seasonTrades,
        teamStats: Array.from(teamStats.values()),
        leagueHistory: leagueHistory.map(h => h.season),
        currentSeason: league?.season || "2025",
        bestTrades: bestTradesWithAnalysis,
        totalTrades: allTrades.length,
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

      const [league, leagueHistory, historicalRosters] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueHistory(leagueId),
        sleeperApi.getAllHistoricalRosters(leagueId),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Get playoff brackets for all seasons to find champions
      const bracketPromises = leagueHistory.map(async (h) => {
        const bracket = await sleeperApi.getPlayoffBracket(h.leagueId);
        return { season: h.season, leagueId: h.leagueId, bracket };
      });
      const allBrackets = await Promise.all(bracketPromises);

      // Build user map from all seasons (most recent data takes priority)
      const globalUserMap = new Map<string, sleeperApi.SleeperUser>();
      for (const seasonData of historicalRosters) {
        for (const user of seasonData.users) {
          if (!globalUserMap.has(user.user_id)) {
            globalUserMap.set(user.user_id, user);
          }
        }
      }

      // Find champions for each completed season
      const champions: { season: string; rosterId: number; ownerName: string; avatar: string | null }[] = [];
      for (const bracketData of allBrackets) {
        const championRosterId = sleeperApi.findChampionFromBracket(bracketData.bracket);
        if (championRosterId) {
          const seasonRosters = historicalRosters.find(sr => sr.season === bracketData.season);
          if (seasonRosters) {
            const championRoster = seasonRosters.rosters.find(r => r.roster_id === championRosterId);
            if (championRoster) {
              const user = globalUserMap.get(championRoster.owner_id);
              champions.push({
                season: bracketData.season,
                rosterId: championRosterId,
                ownerName: user?.display_name || user?.username || "Unknown",
                avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
              });
            }
          }
        }
      }
      champions.sort((a, b) => b.season.localeCompare(a.season));

      // Aggregate all-time stats by owner
      const ownerStats = new Map<string, {
        ownerId: string;
        ownerName: string;
        avatar: string | null;
        totalWins: number;
        totalLosses: number;
        totalTies: number;
        totalPointsFor: number;
        totalMaxPoints: number;
        championships: number;
        seasonRecords: { season: string; wins: number; losses: number; ties: number; pointsFor: number; maxPoints: number }[];
      }>();

      for (const seasonData of historicalRosters) {
        for (const roster of seasonData.rosters) {
          const user = globalUserMap.get(roster.owner_id);
          const fpts = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;
          const ppts = (roster.settings.ppts || 0) + (roster.settings.ppts_decimal || 0) / 100;
          
          const existing = ownerStats.get(roster.owner_id);
          if (existing) {
            existing.totalWins += roster.settings.wins || 0;
            existing.totalLosses += roster.settings.losses || 0;
            existing.totalTies += roster.settings.ties || 0;
            existing.totalPointsFor += fpts;
            existing.totalMaxPoints += ppts;
            existing.seasonRecords.push({
              season: seasonData.season,
              wins: roster.settings.wins || 0,
              losses: roster.settings.losses || 0,
              ties: roster.settings.ties || 0,
              pointsFor: fpts,
              maxPoints: ppts,
            });
          } else {
            ownerStats.set(roster.owner_id, {
              ownerId: roster.owner_id,
              ownerName: user?.display_name || user?.username || "Unknown",
              avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
              totalWins: roster.settings.wins || 0,
              totalLosses: roster.settings.losses || 0,
              totalTies: roster.settings.ties || 0,
              totalPointsFor: fpts,
              totalMaxPoints: ppts,
              championships: 0,
              seasonRecords: [{
                season: seasonData.season,
                wins: roster.settings.wins || 0,
                losses: roster.settings.losses || 0,
                ties: roster.settings.ties || 0,
                pointsFor: fpts,
                maxPoints: ppts,
              }],
            });
          }
        }
      }

      // Count championships per owner
      for (const champion of champions) {
        const seasonRosters = historicalRosters.find(sr => sr.season === champion.season);
        if (seasonRosters) {
          const championRoster = seasonRosters.rosters.find(r => r.roster_id === champion.rosterId);
          if (championRoster) {
            const stats = ownerStats.get(championRoster.owner_id);
            if (stats) {
              stats.championships += 1;
            }
          }
        }
      }

      // Build all-time records sorted by wins
      const allTimeRecords = Array.from(ownerStats.values()).map(stats => {
        const totalGames = stats.totalWins + stats.totalLosses + stats.totalTies;
        return {
          ownerId: stats.ownerId,
          ownerName: stats.ownerName,
          avatar: stats.avatar,
          totalWins: stats.totalWins,
          totalLosses: stats.totalLosses,
          totalTies: stats.totalTies,
          totalPointsFor: Math.round(stats.totalPointsFor * 100) / 100,
          totalMaxPoints: Math.round(stats.totalMaxPoints * 100) / 100,
          championships: stats.championships,
          winPercentage: totalGames > 0 ? stats.totalWins / totalGames : 0,
        };
      }).sort((a, b) => {
        if (a.totalWins !== b.totalWins) return b.totalWins - a.totalWins;
        return b.totalPointsFor - a.totalPointsFor;
      });

      // Calculate season records (best single-season performances)
      interface SeasonRecord {
        ownerName: string;
        avatar: string | null;
        season: string;
        value: number;
        record?: string;
      }
      
      let bestSeasonRecord: SeasonRecord | null = null;
      let bestSeasonPoints: SeasonRecord | null = null;
      let bestSeasonMaxPoints: SeasonRecord | null = null;

      for (const [ownerId, stats] of Array.from(ownerStats.entries())) {
        for (const sr of stats.seasonRecords) {
          const totalGames = sr.wins + sr.losses + sr.ties;
          if (totalGames === 0) continue;

          const winPct = sr.wins / totalGames;
          
          // Best win/loss record
          if (!bestSeasonRecord || winPct > bestSeasonRecord.value || 
              (winPct === bestSeasonRecord.value && sr.wins > (bestSeasonRecord.record?.split('-')[0] ? parseInt(bestSeasonRecord.record.split('-')[0]) : 0))) {
            bestSeasonRecord = {
              ownerName: stats.ownerName,
              avatar: stats.avatar,
              season: sr.season,
              value: winPct,
              record: `${sr.wins}-${sr.losses}${sr.ties > 0 ? `-${sr.ties}` : ''}`,
            };
          }

          // Best points for in a season
          if (!bestSeasonPoints || sr.pointsFor > bestSeasonPoints.value) {
            bestSeasonPoints = {
              ownerName: stats.ownerName,
              avatar: stats.avatar,
              season: sr.season,
              value: Math.round(sr.pointsFor * 100) / 100,
            };
          }

          // Best max points in a season
          if (!bestSeasonMaxPoints || sr.maxPoints > bestSeasonMaxPoints.value) {
            bestSeasonMaxPoints = {
              ownerName: stats.ownerName,
              avatar: stats.avatar,
              season: sr.season,
              value: Math.round(sr.maxPoints * 100) / 100,
            };
          }
        }
      }

      // Top all-time performers
      const topPointsFor = [...allTimeRecords].sort((a, b) => b.totalPointsFor - a.totalPointsFor)[0] || null;
      const topWinPercentage = [...allTimeRecords].filter(r => (r.totalWins + r.totalLosses + r.totalTies) >= 10)
        .sort((a, b) => b.winPercentage - a.winPercentage)[0] || allTimeRecords[0] || null;

      res.json({
        champions,
        allTimeRecords,
        topPointsFor,
        topWinPercentage,
        bestSeasonRecord,
        bestSeasonPoints,
        bestSeasonMaxPoints,
        leagueName: league.name,
        leagueAge: leagueHistory.length,
        seasons: leagueHistory.map(h => h.season).sort((a, b) => b.localeCompare(a)),
      });
    } catch (error) {
      console.error("Error fetching trophies:", error);
      res.status(500).json({ message: "Failed to fetch trophy room" });
    }
  });

  // Rivalry Head-to-Head Records
  app.get("/api/sleeper/rivalries/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      const league = await sleeperApi.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const leagueHistory = await sleeperApi.getLeagueHistory(leagueId);
      
      interface MatchupResult {
        season: string;
        week: number;
        roster1Points: number;
        roster2Points: number;
        winner: number;
      }

      interface RivalryRecord {
        rosterId1: number;
        rosterId2: number;
        owner1Name: string;
        owner2Name: string;
        owner1Avatar: string | null;
        owner2Avatar: string | null;
        owner1Wins: number;
        owner2Wins: number;
        ties: number;
        totalGames: number;
        owner1TotalPoints: number;
        owner2TotalPoints: number;
        matchups: MatchupResult[];
      }

      const rivalryMap = new Map<string, RivalryRecord>();
      
      for (const historyEntry of leagueHistory) {
        const rosters = await sleeperApi.getLeagueRosters(historyEntry.leagueId);
        const users = await sleeperApi.getLeagueUsers(historyEntry.leagueId);
        const seasonLeague = await sleeperApi.getLeague(historyEntry.leagueId);
        
        if (!rosters || !users || !seasonLeague) continue;

        const userMap = new Map(users.map(u => [u.user_id, u]));
        const rosterOwnerMap = new Map<number, { name: string; avatar: string | null }>();
        
        for (const roster of rosters) {
          const user = userMap.get(roster.owner_id);
          rosterOwnerMap.set(roster.roster_id, {
            name: user?.display_name || user?.username || `Team ${roster.roster_id}`,
            avatar: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
          });
        }

        const regularSeasonWeeks = seasonLeague.settings?.playoff_week_start 
          ? seasonLeague.settings.playoff_week_start - 1 
          : 14;

        for (let week = 1; week <= regularSeasonWeeks; week++) {
          const matchups = await sleeperApi.getMatchups(historyEntry.leagueId, week);
          if (!matchups || matchups.length === 0) continue;

          const matchupGroups = new Map<number, sleeperApi.SleeperMatchup[]>();
          for (const m of matchups) {
            if (m.matchup_id === null) continue;
            if (!matchupGroups.has(m.matchup_id)) {
              matchupGroups.set(m.matchup_id, []);
            }
            matchupGroups.get(m.matchup_id)!.push(m);
          }

          for (const [, group] of Array.from(matchupGroups)) {
            if (group.length !== 2) continue;
            
            const sortedGroup = [...group].sort((a: sleeperApi.SleeperMatchup, b: sleeperApi.SleeperMatchup) => a.roster_id - b.roster_id);
            const [m1, m2] = sortedGroup;
            const key = `${m1.roster_id}-${m2.roster_id}`;
            
            const owner1 = rosterOwnerMap.get(m1.roster_id);
            const owner2 = rosterOwnerMap.get(m2.roster_id);
            
            if (!owner1 || !owner2) continue;

            if (!rivalryMap.has(key)) {
              rivalryMap.set(key, {
                rosterId1: m1.roster_id,
                rosterId2: m2.roster_id,
                owner1Name: owner1.name,
                owner2Name: owner2.name,
                owner1Avatar: owner1.avatar,
                owner2Avatar: owner2.avatar,
                owner1Wins: 0,
                owner2Wins: 0,
                ties: 0,
                totalGames: 0,
                owner1TotalPoints: 0,
                owner2TotalPoints: 0,
                matchups: [],
              });
            }

            const rivalry = rivalryMap.get(key)!;
            rivalry.totalGames++;
            rivalry.owner1TotalPoints += m1.points || 0;
            rivalry.owner2TotalPoints += m2.points || 0;

            let winner: number;
            if ((m1.points || 0) > (m2.points || 0)) {
              rivalry.owner1Wins++;
              winner = m1.roster_id;
            } else if ((m2.points || 0) > (m1.points || 0)) {
              rivalry.owner2Wins++;
              winner = m2.roster_id;
            } else {
              rivalry.ties++;
              winner = 0;
            }

            rivalry.matchups.push({
              season: historyEntry.season,
              week,
              roster1Points: m1.points || 0,
              roster2Points: m2.points || 0,
              winner,
            });
          }
        }
      }

      const rivalries = Array.from(rivalryMap.values())
        .filter(r => r.totalGames > 0)
        .sort((a, b) => {
          // Sort by highest winning percentage (the dominant owner's win rate)
          const aMaxWinPct = Math.max(a.owner1Wins, a.owner2Wins) / a.totalGames;
          const bMaxWinPct = Math.max(b.owner1Wins, b.owner2Wins) / b.totalGames;
          if (bMaxWinPct !== aMaxWinPct) {
            return bMaxWinPct - aMaxWinPct;
          }
          // Tiebreaker: more total games first
          return b.totalGames - a.totalGames;
        });

      // Organize by team for accordion view
      interface TeamRecord {
        rosterId: number;
        ownerName: string;
        avatar: string | null;
        totalWins: number;
        totalLosses: number;
        totalTies: number;
        totalGames: number;
        opponents: {
          opponentRosterId: number;
          opponentName: string;
          opponentAvatar: string | null;
          wins: number;
          losses: number;
          ties: number;
          totalGames: number;
          winPct: number;
          matchups: MatchupResult[];
        }[];
      }

      const teamMap = new Map<number, TeamRecord>();

      for (const rivalry of rivalries) {
        // Add for owner1
        if (!teamMap.has(rivalry.rosterId1)) {
          teamMap.set(rivalry.rosterId1, {
            rosterId: rivalry.rosterId1,
            ownerName: rivalry.owner1Name,
            avatar: rivalry.owner1Avatar,
            totalWins: 0,
            totalLosses: 0,
            totalTies: 0,
            totalGames: 0,
            opponents: [],
          });
        }
        const team1 = teamMap.get(rivalry.rosterId1)!;
        team1.totalWins += rivalry.owner1Wins;
        team1.totalLosses += rivalry.owner2Wins;
        team1.totalTies += rivalry.ties;
        team1.totalGames += rivalry.totalGames;
        team1.opponents.push({
          opponentRosterId: rivalry.rosterId2,
          opponentName: rivalry.owner2Name,
          opponentAvatar: rivalry.owner2Avatar,
          wins: rivalry.owner1Wins,
          losses: rivalry.owner2Wins,
          ties: rivalry.ties,
          totalGames: rivalry.totalGames,
          winPct: rivalry.totalGames > 0 ? rivalry.owner1Wins / rivalry.totalGames : 0,
          matchups: rivalry.matchups.map(m => ({
            ...m,
            teamPoints: m.roster1Points,
            opponentPoints: m.roster2Points,
            won: m.winner === rivalry.rosterId1,
          })),
        });

        // Add for owner2
        if (!teamMap.has(rivalry.rosterId2)) {
          teamMap.set(rivalry.rosterId2, {
            rosterId: rivalry.rosterId2,
            ownerName: rivalry.owner2Name,
            avatar: rivalry.owner2Avatar,
            totalWins: 0,
            totalLosses: 0,
            totalTies: 0,
            totalGames: 0,
            opponents: [],
          });
        }
        const team2 = teamMap.get(rivalry.rosterId2)!;
        team2.totalWins += rivalry.owner2Wins;
        team2.totalLosses += rivalry.owner1Wins;
        team2.totalTies += rivalry.ties;
        team2.totalGames += rivalry.totalGames;
        team2.opponents.push({
          opponentRosterId: rivalry.rosterId1,
          opponentName: rivalry.owner1Name,
          opponentAvatar: rivalry.owner1Avatar,
          wins: rivalry.owner2Wins,
          losses: rivalry.owner1Wins,
          ties: rivalry.ties,
          totalGames: rivalry.totalGames,
          winPct: rivalry.totalGames > 0 ? rivalry.owner2Wins / rivalry.totalGames : 0,
          matchups: rivalry.matchups.map(m => ({
            ...m,
            teamPoints: m.roster2Points,
            opponentPoints: m.roster1Points,
            won: m.winner === rivalry.rosterId2,
          })),
        });
      }

      // Sort each team's opponents by win percentage (best to worst)
      Array.from(teamMap.values()).forEach((team: TeamRecord) => {
        team.opponents.sort((a, b) => b.winPct - a.winPct);
      });

      // Convert to array and sort teams by overall win percentage
      const teamRecords = Array.from(teamMap.values())
        .sort((a, b) => {
          const aWinPct = a.totalGames > 0 ? a.totalWins / a.totalGames : 0;
          const bWinPct = b.totalGames > 0 ? b.totalWins / b.totalGames : 0;
          return bWinPct - aWinPct;
        });

      res.json({
        rivalries,
        teamRecords,
        leagueName: league.name,
        totalSeasons: leagueHistory.length,
        seasons: leagueHistory.map(h => h.season).sort((a, b) => b.localeCompare(a)),
      });
    } catch (error) {
      console.error("Error fetching rivalries:", error);
      res.status(500).json({ message: "Failed to fetch rivalry data" });
    }
  });

  // ============================================
  // NOTIFICATIONS & REAL-TIME UPDATES
  // ============================================

  // Helper to verify user belongs to a league
  async function verifyUserInLeague(userId: string, leagueId: string): Promise<boolean> {
    try {
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUserId) return false;
      
      const leagues = await sleeperApi.getUserLeagues(profile.sleeperUserId, new Date().getFullYear().toString());
      return leagues?.some(l => l.league_id === leagueId) || false;
    } catch {
      return false;
    }
  }

  // Get notifications for a league
  app.get("/api/notifications/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      // Verify user has access to this league
      const hasAccess = await verifyUserInLeague(userId, leagueId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this league" });
      }
      
      const notifications = await storage.getNotificationsByLeague(leagueId, 50);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications for a user
  app.get("/api/notifications/:leagueId/unread", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      // Verify user has access to this league
      const hasAccess = await verifyUserInLeague(userId, leagueId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this league" });
      }
      
      const notifications = await storage.getUnreadNotifications(userId, leagueId);
      res.json({ notifications, unreadCount: notifications.length });
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ message: "Failed to fetch unread notifications" });
    }
  });

  // Mark notifications as read
  app.post("/api/notifications/mark-read", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { notificationIds, leagueId } = req.body;
      
      if (!Array.isArray(notificationIds)) {
        return res.status(400).json({ message: "notificationIds must be an array" });
      }
      
      if (!leagueId) {
        return res.status(400).json({ message: "leagueId is required" });
      }
      
      // Verify user has access to this league
      const hasAccess = await verifyUserInLeague(userId, leagueId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this league" });
      }
      
      // Verify the notifications belong to this league before marking as read
      const leagueNotifications = await storage.getNotificationsByLeague(leagueId, 100);
      const validIds = new Set(leagueNotifications.map(n => n.id));
      const filteredIds = notificationIds.filter(id => validIds.has(id));
      
      if (filteredIds.length > 0) {
        await storage.markNotificationsRead(userId, filteredIds);
      }
      
      res.json({ success: true, markedCount: filteredIds.length });
    } catch (error) {
      console.error("Error marking notifications read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // Check for new transactions and create notifications
  app.post("/api/notifications/:leagueId/sync", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      // Get current league state
      const [league, rosters, users, allPlayers] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
      ]);
      
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      
      const userMap = new Map((users || []).map((u: sleeperApi.SleeperUser) => [u.user_id, u]));
      const rosterUserMap = new Map((rosters || []).map((r: sleeperApi.SleeperRoster) => [r.roster_id, r.owner_id]));
      
      const getTeamName = (rosterId: number) => {
        const ownerId = rosterUserMap.get(rosterId);
        const user = ownerId ? userMap.get(ownerId) : null;
        return user?.metadata?.team_name || user?.display_name || `Team ${rosterId}`;
      };
      
      const getPlayerName = (playerId: string) => {
        const player = allPlayers?.[playerId];
        return player ? `${player.first_name} ${player.last_name}` : playerId;
      };
      
      // Get sync status
      const syncStatus = await storage.getSyncStatus(leagueId);
      const currentWeek = league.settings?.leg || 1;
      
      // Fetch recent transactions (last 3 weeks to catch any missed)
      const weeksToCheck = [currentWeek, Math.max(1, currentWeek - 1), Math.max(1, currentWeek - 2)];
      const transactionPromises = weeksToCheck.map(week => sleeperApi.getLeagueTransactions(leagueId, week));
      const transactionResults = await Promise.all(transactionPromises);
      const allTransactions = transactionResults.flat();
      
      // Filter to only completed transactions
      const completedTransactions = allTransactions.filter(t => t.status === "complete");
      
      // Sort by created timestamp (newest first)
      completedTransactions.sort((a, b) => (b.created || 0) - (a.created || 0));
      
      // Take only the most recent transactions (limit to 20)
      const recentTransactions = completedTransactions.slice(0, 20);
      
      let newNotifications = 0;
      
      for (const transaction of recentTransactions) {
        const transactionId = transaction.transaction_id;
        
        // Check if we already have a notification for this transaction
        const exists = await storage.notificationExists(transactionId);
        if (exists) continue;
        
        let title = "";
        let message = "";
        let type = transaction.type;
        
        if (transaction.type === "trade") {
          // Trade notification
          const rosterIds = transaction.roster_ids || [];
          const teamNames = rosterIds.map((id: number) => getTeamName(id));
          
          title = "Trade Completed";
          
          // Build trade details
          const adds = transaction.adds || {};
          const drops = transaction.drops || {};
          const draftPicks = transaction.draft_picks || [];
          
          const tradeDetails: string[] = [];
          
          rosterIds.forEach((rosterId: number, index: number) => {
            const teamName = teamNames[index];
            const received: string[] = [];
            
            // Players received
            Object.entries(adds).forEach(([playerId, rId]) => {
              if (rId === rosterId) {
                received.push(getPlayerName(playerId));
              }
            });
            
            // Picks received
            draftPicks.forEach((pick: any) => {
              if (pick.owner_id === rosterId) {
                received.push(`${pick.season} Round ${pick.round} pick`);
              }
            });
            
            if (received.length > 0) {
              tradeDetails.push(`${teamName} receives: ${received.join(", ")}`);
            }
          });
          
          message = tradeDetails.join(" | ");
        } else if (transaction.type === "waiver") {
          // Waiver claim
          const rosterId = transaction.roster_ids?.[0];
          const teamName = rosterId ? getTeamName(rosterId) : "Unknown";
          const adds = Object.keys(transaction.adds || {});
          const drops = Object.keys(transaction.drops || {});
          
          title = "Waiver Claim";
          
          const addedPlayers = adds.map(id => getPlayerName(id)).join(", ");
          const droppedPlayers = drops.map(id => getPlayerName(id)).join(", ");
          
          if (addedPlayers && droppedPlayers) {
            message = `${teamName} added ${addedPlayers} and dropped ${droppedPlayers}`;
          } else if (addedPlayers) {
            message = `${teamName} added ${addedPlayers}`;
          } else if (droppedPlayers) {
            message = `${teamName} dropped ${droppedPlayers}`;
          }
        } else if (transaction.type === "free_agent") {
          // Free agent pickup
          const rosterId = transaction.roster_ids?.[0];
          const teamName = rosterId ? getTeamName(rosterId) : "Unknown";
          const adds = Object.keys(transaction.adds || {});
          const drops = Object.keys(transaction.drops || {});
          
          title = "Free Agent Move";
          
          const addedPlayers = adds.map(id => getPlayerName(id)).join(", ");
          const droppedPlayers = drops.map(id => getPlayerName(id)).join(", ");
          
          if (addedPlayers && droppedPlayers) {
            message = `${teamName} added ${addedPlayers} and dropped ${droppedPlayers}`;
          } else if (addedPlayers) {
            message = `${teamName} added ${addedPlayers}`;
          } else if (droppedPlayers) {
            message = `${teamName} dropped ${droppedPlayers}`;
          }
        }
        
        if (title && message) {
          await storage.createNotification({
            leagueId,
            type,
            transactionId,
            title,
            message,
            metadata: {
              rosterIds: transaction.roster_ids,
              adds: transaction.adds,
              drops: transaction.drops,
              draftPicks: transaction.draft_picks,
              week: currentWeek,
            },
          });
          newNotifications++;
        }
      }
      
      // Update sync status
      await storage.updateSyncStatus(leagueId, {
        lastTransactionCheck: new Date(),
        lastKnownWeek: currentWeek,
      });
      
      // Return current notifications
      const notifications = await storage.getNotificationsByLeague(leagueId, 20);
      
      res.json({
        success: true,
        newNotifications,
        notifications,
      });
    } catch (error) {
      console.error("Error syncing notifications:", error);
      res.status(500).json({ message: "Failed to sync notifications" });
    }
  });

  // Fantasy News Feed - Real news from sports sources, personalized to user's roster
  app.get("/api/fantasy/news", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.query;
      const profile = await storage.getUserProfile(userId);
      
      const targetLeagueId = leagueId || profile?.selectedLeagueId;
      
      // Fetch all required data in parallel
      const [allPlayers, state, allRealNews, trendingPlayers] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
        newsService.fetchAllSportsNews(),
        newsService.fetchSleeperTrending(),
      ]);
      
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();
      
      let rosterPlayerNames: string[] = [];
      
      // If user has a selected league, get their roster player names for filtering news
      if (targetLeagueId && profile?.sleeperUserId) {
        const rosters = await sleeperApi.getLeagueRosters(targetLeagueId);
        const userRoster = rosters.find((r: any) => r.owner_id === profile.sleeperUserId);
        
        if (userRoster) {
          const rosterIds = [...(userRoster.starters || []), ...(userRoster.players || [])];
          const uniqueRosterIds = Array.from(new Set(rosterIds));
          
          rosterPlayerNames = uniqueRosterIds
            .map(id => allPlayers[id])
            .filter(p => p && ["QB", "RB", "WR", "TE", "K", "DEF"].includes(p.position))
            .map(p => p.full_name || `${p.first_name} ${p.last_name}`);
        }
      }
      
      // Filter real news for players on the roster (if available)
      let relevantNews = rosterPlayerNames.length > 0
        ? newsService.filterNewsForPlayers(allRealNews, rosterPlayerNames)
        : [];
      
      // Also include general NFL news if we don't have enough roster-specific news
      if (relevantNews.length < 5) {
        const generalNews = allRealNews.slice(0, 15 - relevantNews.length);
        relevantNews = [...relevantNews, ...generalNews];
      }
      
      // Add trending players from Sleeper as news items
      const trendingNews = trendingPlayers.slice(0, 5).map((trending: any, idx: number) => {
        const player = allPlayers[trending.player_id];
        if (!player) return null;
        return {
          id: `trending-${trending.player_id}`,
          title: `${player.full_name} Trending Up on Waiver Wire`,
          summary: `${player.full_name} (${player.position}, ${player.team || "FA"}) has been added in ${trending.count || "many"} leagues over the past 24 hours. Consider adding if available.`,
          source: "Sleeper Trending",
          url: "#",
          publishedAt: new Date(Date.now() - idx * 10 * 60000).toISOString(),
          category: "waiver",
          players: [player.full_name],
        };
      }).filter(Boolean);
      
      // Format real news items
      const formattedRealNews = relevantNews.map((item, idx) => ({
        id: `real-${Date.now()}-${idx}`,
        title: item.title,
        summary: item.summary,
        source: item.source,
        url: item.url,
        publishedAt: item.publishedAt,
        category: item.category,
        players: item.players,
      }));
      
      // Combine all news: real news first, then trending waiver adds
      const allNews = [
        ...formattedRealNews,
        ...trendingNews,
      ].slice(0, 20);
      
      // Sort by published date (most recent first)
      allNews.sort((a: any, b: any) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      res.json({
        news: allNews,
        lastUpdated: new Date().toISOString(),
        week: currentWeek,
        season: currentSeason,
      });
    } catch (error) {
      console.error("Error fetching fantasy news:", error);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });

  // NFL Game Odds - Vegas lines and spreads
  app.get("/api/fantasy/odds", isAuthenticated, async (req: any, res: Response) => {
    try {
      const odds = await oddsService.fetchNFLOdds();
      
      res.json({
        games: odds,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching NFL odds:", error);
      res.status(500).json({ message: "Failed to fetch odds" });
    }
  });

  // Player Trends - Multi-season analysis
  app.get("/api/fantasy/trends", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.query;
      const [allPlayers, state] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);
      
      // Get current date and season context
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentSeason = state?.season || new Date().getFullYear().toString();
      const currentWeek = state?.week || 1;
      
      // Get established players with stats
      const establishedPlayers = Object.entries(allPlayers)
        .filter(([_, p]: [string, any]) => 
          p && ["QB", "RB", "WR", "TE"].includes(p.position) && 
          p.team && p.years_exp && p.years_exp >= 2 &&
          p.search_rank && p.search_rank < 150
        )
        .map(([id, p]: [string, any]) => ({ id, ...p }))
        .slice(0, 40);

      const trendsPrompt = `Today is ${currentDate}. We are in Week ${currentWeek} of the ${currentSeason} NFL season.

Analyze multi-season trends for these NFL players and provide career trajectory analysis through the current point in the ${currentSeason} season.

Players: ${establishedPlayers.map(p => `${p.full_name} (${p.position}, ${p.team}, age ${p.age || "?"}, ${p.years_exp} years exp)`).join("; ")}

For each player provide:
- trend: "up" (improving), "down" (declining), or "stable" - based on their ${currentSeason} performance so far
- avgPpg: average PPG over career (realistic number based on position)
- careerHigh: best season PPG
- careerLow: worst season PPG  
- trajectory: 1-2 sentence analysis of their career arc including current season performance
- seasons: array of 3 most recent seasons with {season: "${currentSeason}", games: X, points: Y, ppg: Z, rank: N, positionRank: M}

Return JSON: {"players": [{playerId, name, position, team, age, trend, avgPpg, careerHigh, careerLow, trajectory, seasons}]}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: trendsPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });

      let trendData: any = { players: [] };
      try {
        const content = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(content);
        // Handle various response formats
        trendData = { 
          players: parsed.players || Object.values(parsed).find(v => Array.isArray(v)) || [] 
        };
      } catch (e) {
        console.error("Error parsing trends response:", e);
        trendData = { players: [] };
      }

      // Merge with player data
      const players = (trendData.players || []).map((trend: any, idx: number) => {
        const player = establishedPlayers[idx];
        return {
          playerId: player?.id || `player-${idx}`,
          name: trend.name || player?.full_name || "Unknown",
          position: trend.position || player?.position || "?",
          team: trend.team || player?.team || "FA",
          age: trend.age || player?.age || 25,
          trend: trend.trend || "stable",
          avgPpg: trend.avgPpg || 10,
          careerHigh: trend.careerHigh || 15,
          careerLow: trend.careerLow || 5,
          trajectory: trend.trajectory || "Consistent performer",
          seasons: trend.seasons || [],
        };
      });

      res.json({ players });
    } catch (error) {
      console.error("Error fetching player trends:", error);
      res.status(500).json({ message: "Failed to fetch trends" });
    }
  });

  // Player Comparison - Get players for comparison
  app.get("/api/fantasy/compare/players", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.query;
      const allPlayers = await sleeperApi.getAllPlayers();

      let stats: Record<string, any> = {};
      try {
        stats = await sleeperApi.getSeasonStats("2025", "regular");
      } catch (e) {
        stats = {};
      }

      const players = Object.entries(allPlayers)
        .filter(([_, p]: [string, any]) => 
          p && ["QB", "RB", "WR", "TE"].includes(p.position) && 
          p.team && p.search_rank && p.search_rank < 300
        )
        .map(([id, p]: [string, any]) => {
          const ktcValue = ktcValues.getPlayerValue(id, p.position, p.age, p.years_exp || 0);
          const playerStats = stats[id] || {};
          const games = playerStats.gp || 16;
          const points = playerStats.pts_ppr || 0;
          
          return {
            playerId: id,
            name: p.full_name || "Unknown",
            position: p.position || "?",
            team: p.team || "FA",
            age: p.age || 25,
            ktcValue,
            stats: {
              games,
              points,
              ppg: games > 0 ? points / games : 0,
              passYds: playerStats.pass_yd,
              passTds: playerStats.pass_td,
              rushYds: playerStats.rush_yd,
              rushTds: playerStats.rush_td,
              recYds: playerStats.rec_yd,
              recTds: playerStats.rec_td,
              receptions: playerStats.rec,
              targets: playerStats.rec_tgt,
            },
            projectedPoints: points * 1.05,
            upside: points * 1.2,
            floor: points * 0.8,
          };
        })
        .sort((a, b) => b.ktcValue - a.ktcValue)
        .slice(0, 200);

      res.json({ players });
    } catch (error) {
      console.error("Error fetching compare players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  // Lineup Advice - AI-powered start/sit recommendations
  app.get("/api/fantasy/lineup-advice", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.query;
      const profile = await storage.getUserProfile(userId);

      if (!leagueId && !profile?.selectedLeagueId) {
        return res.status(400).json({ message: "League ID required" });
      }

      const targetLeagueId = leagueId || profile?.selectedLeagueId;
      const [rosters, users, league, state, allPlayers] = await Promise.all([
        sleeperApi.getLeagueRosters(targetLeagueId),
        sleeperApi.getLeagueUsers(targetLeagueId),
        sleeperApi.getLeague(targetLeagueId),
        sleeperApi.getState(),
        sleeperApi.getAllPlayers(),
      ]);

      const userMap = new Map(users.map(u => [u.user_id, u]));
      const userRoster = rosters.find(r => r.owner_id === profile?.sleeperUserId);
      
      if (!userRoster) {
        return res.json({ 
          week: state?.week || 1,
          rosterId: 0,
          teamName: "Your Team",
          starters: [],
          bench: [],
          suggestions: [],
          overallAnalysis: "Could not find your roster in this league."
        });
      }

      const teamName = userMap.get(userRoster.owner_id)?.display_name || "Your Team";
      const starterIds = userRoster.starters || [];
      const benchIds = (userRoster.players || []).filter((p: string) => !starterIds.includes(p));

      // Get player info
      const getPlayerInfo = (playerId: string) => {
        const p = allPlayers[playerId];
        return p ? { id: playerId, name: p.full_name, position: p.position, team: p.team } : null;
      };

      const starters = starterIds.map(getPlayerInfo).filter(Boolean);
      const bench = benchIds.map(getPlayerInfo).filter(Boolean);

      // Get current date for context
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();

      const lineupPrompt = `Today is ${currentDate}. This is Week ${currentWeek} of the ${currentSeason} NFL season.

Provide start/sit recommendations for this fantasy football lineup based on THIS WEEK'S matchups and latest injury reports.

STARTERS: ${starters.map((p: any) => `${p.name} (${p.position}, ${p.team})`).join(", ")}
BENCH: ${bench.map((p: any) => `${p.name} (${p.position}, ${p.team})`).join(", ")}

For each player (starters and bench), provide:
- recommendation: "start", "sit", or "flex"
- confidence: 60-95 (percentage)
- matchup: {opponent: "vs DEN", opponentRank: 1-32, projected: points, ceiling: points, floor: points}
- reasoning: why start/sit based on Week ${currentWeek} matchup (1 sentence)
- gameScript: predicted game flow impact for this week's game (1 sentence)

Also provide:
- suggestions: array of {type: "swap"|"warning"|"opportunity", message: "suggestion text", players: ["names"]}
- overallAnalysis: 2-3 sentence Week ${currentWeek} lineup assessment

Return JSON with: {starters: [...], bench: [...], suggestions: [...], overallAnalysis: "..."}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: lineupPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 2500,
      });

      let advice: any = {};
      try {
        advice = JSON.parse(response.choices[0]?.message?.content || "{}");
      } catch (e) {
        advice = {};
      }

      // Merge AI advice with player data
      const mergeAdvice = (players: any[], adviceList: any[]) => {
        return players.map((p: any, idx: number) => {
          const a = adviceList?.[idx] || {};
          return {
            playerId: p.id,
            name: p.name,
            position: p.position,
            team: p.team,
            matchup: a.matchup || { opponent: "TBD", opponentRank: 16, projected: 10, ceiling: 15, floor: 5 },
            recommendation: a.recommendation || "flex",
            confidence: a.confidence || 70,
            reasoning: a.reasoning || "Standard play based on recent performance",
            gameScript: a.gameScript || "Neutral game script expected",
            injuryStatus: a.injuryStatus,
          };
        });
      };

      res.json({
        week: state?.week || 1,
        rosterId: userRoster.roster_id,
        teamName,
        starters: mergeAdvice(starters, advice.starters || []),
        bench: mergeAdvice(bench, advice.bench || []),
        suggestions: advice.suggestions || [],
        overallAnalysis: advice.overallAnalysis || "Review your lineup before kickoff.",
      });
    } catch (error) {
      console.error("Error generating lineup advice:", error);
      res.status(500).json({ message: "Failed to generate lineup advice" });
    }
  });

  // Advanced Projections - ROS outlook
  app.get("/api/fantasy/projections", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.query;
      const [allPlayers, state] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);

      // Get current date and season context
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();
      const remainingWeeks = Math.max(0, 18 - currentWeek); // NFL regular season is 18 weeks, clamp to 0 minimum

      let stats: Record<string, any> = {};
      try {
        stats = await sleeperApi.getSeasonStats(currentSeason, "regular");
      } catch (e) {
        stats = {};
      }

      // Get top players
      const topPlayers = Object.entries(allPlayers)
        .filter(([_, p]: [string, any]) => 
          p && ["QB", "RB", "WR", "TE"].includes(p.position) && 
          p.team && p.search_rank && p.search_rank < 150
        )
        .map(([id, p]: [string, any]) => {
          const playerStats = stats[id] || {};
          return {
            id,
            name: p.full_name,
            position: p.position,
            team: p.team,
            age: p.age || 25,
            points: playerStats.pts_ppr || 0,
            games: playerStats.gp || 0,
          };
        })
        .slice(0, 60);

      const projectionsPrompt = `Today is ${currentDate}. We are in Week ${currentWeek} of the ${currentSeason} NFL season with approximately ${remainingWeeks} weeks remaining.

Generate rest-of-season (ROS) fantasy projections for these NFL players from Week ${currentWeek + 1} through Week 17.

Players: ${topPlayers.map(p => `${p.name} (${p.position}, ${p.team}, age ${p.age})`).join("; ")}

For each player provide:
- projectedPoints: total ROS fantasy points for the remaining ${remainingWeeks} weeks
- projectedPpg: expected points per game ROS
- confidence: 50-95 (how confident in projection)
- upside: ceiling PPG ROS
- downside: floor PPG ROS
- trend: "up", "down", or "stable" based on recent performance
- outlook: 1-2 sentence ROS analysis including current form
- keyFactors: array of 2-3 key factors affecting remaining schedule outlook
- scheduleStrength: 1-10 (1=easiest, 10=hardest) for remaining games
- injuryRisk: "low", "medium", or "high"
- byeWeek: 5-14 (NFL bye week - mark as "past" if already happened)

Return JSON: {"players": [{...}]}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: projectionsPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      let projData: any = { players: [] };
      try {
        projData = JSON.parse(response.choices[0]?.message?.content || "{}");
      } catch (e) {
        projData = { players: [] };
      }

      // Merge with player data
      const players = (projData.players || []).map((proj: any, idx: number) => {
        const player = topPlayers[idx];
        return {
          playerId: player?.id || `player-${idx}`,
          name: proj.name || player?.name || "Unknown",
          position: proj.position || player?.position || "?",
          team: proj.team || player?.team || "FA",
          age: player?.age || 25,
          projectedPoints: proj.projectedPoints || 150,
          projectedPpg: proj.projectedPpg || 12,
          confidence: proj.confidence || 70,
          upside: proj.upside || 18,
          downside: proj.downside || 8,
          trend: proj.trend || "stable",
          outlook: proj.outlook || "Solid fantasy contributor",
          keyFactors: proj.keyFactors || ["Volume", "Talent"],
          scheduleStrength: proj.scheduleStrength || 5,
          injuryRisk: proj.injuryRisk || "low",
          byeWeek: proj.byeWeek || 9,
        };
      });

      res.json({ 
        players,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating projections:", error);
      res.status(500).json({ message: "Failed to generate projections" });
    }
  });

  // League Summary - Overall stats across leagues including ALL historical seasons
  // Cache for career summary data (keyed by sleeper user ID)
  const careerSummaryCache = new Map<string, { data: any; timestamp: number }>();
  const CAREER_CACHE_TTL = 1000 * 60 * 15; // 15 minutes

  app.get("/api/fantasy/summary", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.json({
          totalLeagues: 0,
          totalWins: 0,
          totalLosses: 0,
          totalTies: 0,
          championships: 0,
          runnerUps: 0,
          playoffAppearances: 0,
          bestFinish: "N/A",
          currentSeason: new Date().getFullYear().toString(),
          leagueStats: [],
        });
      }

      // Check cache first
      const cacheKey = userProfile.sleeperUserId;
      const cached = careerSummaryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CAREER_CACHE_TTL) {
        return res.json(cached.data);
      }

      const currentLeagues = await sleeperApi.getUserLeagues(userProfile.sleeperUserId);
      
      const processedLeagueIds = new Set<string>();
      // Cache league data to avoid duplicate API calls
      const leagueDataCache = new Map<string, any>();

      // Collect all league IDs and cache league data in a single pass
      const leagueIdsToProcess: { leagueId: string; leagueName: string }[] = [];
      
      // First pass: collect all league IDs by tracing back histories (and cache league data)
      const collectLeagueIds = async (startLeagueId: string, leagueName: string): Promise<string[]> => {
        const ids: string[] = [];
        let currentId: string | null = startLeagueId;
        
        while (currentId && currentId !== "0") {
          if (processedLeagueIds.has(currentId)) break;
          processedLeagueIds.add(currentId);
          ids.push(currentId);
          
          try {
            const league = await sleeperApi.getLeague(currentId);
            if (!league) break;
            // Cache for reuse in processing phase
            leagueDataCache.set(currentId, league);
            currentId = league.previous_league_id;
          } catch {
            break;
          }
        }
        return ids;
      };

      // Collect all league IDs from all current leagues in parallel
      const leagueIdResults = await Promise.all(
        currentLeagues.map(league => 
          collectLeagueIds(league.league_id, league.name).then(ids => 
            ids.map(id => ({ leagueId: id, leagueName: league.name }))
          )
        )
      );
      
      leagueIdResults.forEach(ids => leagueIdsToProcess.push(...ids));

      // Process all league seasons in parallel (use cached league data, fetch rosters + bracket)
      const processLeagueSeason = async (leagueId: string, leagueName: string) => {
        try {
          // Get league from cache (already fetched), only need rosters and bracket
          const league = leagueDataCache.get(leagueId);
          if (!league) return null;
          
          // Fetch rosters and bracket in parallel
          const [rosters, bracket] = await Promise.all([
            sleeperApi.getLeagueRosters(leagueId),
            sleeperApi.getPlayoffBracket(leagueId).catch(() => [])
          ]);
          
          if (!rosters) return null;
          
          const userRoster = rosters.find(r => r.owner_id === userProfile!.sleeperUserId);
          if (!userRoster) return null;
          
          const wins = userRoster.settings?.wins || 0;
          const losses = userRoster.settings?.losses || 0;
          const ties = userRoster.settings?.ties || 0;
          
          // Calculate rank
          const sortedRosters = [...rosters].sort((a, b) => {
            const winsA = a.settings?.wins || 0;
            const winsB = b.settings?.wins || 0;
            if (winsB !== winsA) return winsB - winsA;
            const fptsA = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
            const fptsB = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
            return fptsB - fptsA;
          });
          const rank = sortedRosters.findIndex(r => r.roster_id === userRoster.roster_id) + 1;
          
          const playoffTeams = league.settings?.playoff_teams || 6;
          const isPlayoffs = rank <= playoffTeams;
          
          // Determine championship status
          let isChampion = false;
          let isRunnerUp = false;
          
          if (bracket && bracket.length > 0) {
            const champMatch = bracket.reduce((max, match) => 
              (match.r > (max?.r || 0)) ? match : max, bracket[0]);
            
            if (champMatch && champMatch.w === userRoster.roster_id) {
              isChampion = true;
            } else if (champMatch && champMatch.l === userRoster.roster_id) {
              isRunnerUp = true;
            }
          } else if (league.status === "complete") {
            if (rank === 1) isChampion = true;
            else if (rank === 2) isRunnerUp = true;
          }
          
          return {
            leagueId,
            leagueName,
            season: league.season,
            wins,
            losses,
            ties,
            rank,
            totalTeams: rosters.length,
            isChampion,
            isPlayoffs,
            isRunnerUp,
          };
        } catch (e) {
          console.error(`Error processing league ${leagueId}:`, e);
          return null;
        }
      };

      // Process all leagues in parallel with concurrency limit
      const BATCH_SIZE = 10;
      const allResults: any[] = [];
      
      for (let i = 0; i < leagueIdsToProcess.length; i += BATCH_SIZE) {
        const batch = leagueIdsToProcess.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(({ leagueId, leagueName }) => processLeagueSeason(leagueId, leagueName))
        );
        allResults.push(...batchResults.filter(Boolean));
      }

      // Aggregate stats
      let totalWins = 0;
      let totalLosses = 0;
      let totalTies = 0;
      let championships = 0;
      let runnerUps = 0;
      let playoffAppearances = 0;
      
      for (const stat of allResults) {
        totalWins += stat.wins;
        totalLosses += stat.losses;
        totalTies += stat.ties;
        if (stat.isChampion) championships++;
        if (stat.isRunnerUp) runnerUps++;
        if (stat.isPlayoffs) playoffAppearances++;
      }

      // Sort league stats by season descending
      allResults.sort((a, b) => b.season.localeCompare(a.season));

      const result = {
        totalLeagues: currentLeagues.length,
        totalSeasons: allResults.length,
        totalWins,
        totalLosses,
        totalTies,
        championships,
        runnerUps,
        playoffAppearances,
        bestFinish: championships > 0 ? "Champion" : runnerUps > 0 ? "Runner-up" : playoffAppearances > 0 ? "Playoffs" : "N/A",
        currentSeason: new Date().getFullYear().toString(),
        leagueStats: allResults,
      };

      // Cache the result
      careerSummaryCache.set(cacheKey, { data: result, timestamp: Date.now() });

      res.json(result);
    } catch (error) {
      console.error("Error fetching summary:", error);
      res.status(500).json({ message: "Failed to fetch summary" });
    }
  });

  // League-Specific Summary - Stats for a single league across all its seasons
  app.get("/api/fantasy/league-summary/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "No Sleeper account connected" });
      }

      let totalWins = 0;
      let totalLosses = 0;
      let totalTies = 0;
      let championships = 0;
      let runnerUps = 0;
      let playoffAppearances = 0;
      const seasonStats: any[] = [];
      const processedLeagueIds = new Set<string>();

      // Trace back through league history for this specific league
      let currentLeagueId: string | null = leagueId;
      
      while (currentLeagueId && currentLeagueId !== "0" && !processedLeagueIds.has(currentLeagueId)) {
        processedLeagueIds.add(currentLeagueId);
        
        try {
          const league = await sleeperApi.getLeague(currentLeagueId);
          if (!league) break;
          
          const rosters = await sleeperApi.getLeagueRosters(currentLeagueId);
          
          // Find user's roster in this season
          const userRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
          if (userRoster) {
            const wins = userRoster.settings?.wins || 0;
            const losses = userRoster.settings?.losses || 0;
            const ties = userRoster.settings?.ties || 0;
            
            totalWins += wins;
            totalLosses += losses;
            totalTies += ties;
            
            // Calculate rank based on wins, then points for tie-breaking
            const sortedRosters = [...rosters].sort((a, b) => {
              const winsA = a.settings?.wins || 0;
              const winsB = b.settings?.wins || 0;
              if (winsB !== winsA) return winsB - winsA;
              const fptsA = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
              const fptsB = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
              return fptsB - fptsA;
            });
            const rank = sortedRosters.findIndex(r => r.roster_id === userRoster.roster_id) + 1;
            
            const playoffTeams = league.settings?.playoff_teams || 6;
            const isPlayoffs = rank <= playoffTeams;
            if (isPlayoffs) playoffAppearances++;
            
            let isChampion = false;
            let isRunnerUp = false;
            
            try {
              const bracket = await sleeperApi.getPlayoffBracket(currentLeagueId);
              if (bracket && bracket.length > 0) {
                const champMatch = bracket.reduce((max, match) => 
                  (match.r > (max?.r || 0)) ? match : max, bracket[0]);
                
                if (champMatch && champMatch.w === userRoster.roster_id) {
                  isChampion = true;
                  championships++;
                } else if (champMatch && champMatch.l === userRoster.roster_id) {
                  isRunnerUp = true;
                  runnerUps++;
                }
              }
            } catch (bracketError) {
              if (league.status === "complete" && rank === 1) {
                isChampion = true;
                championships++;
              } else if (league.status === "complete" && rank === 2) {
                isRunnerUp = true;
                runnerUps++;
              }
            }
            
            seasonStats.push({
              leagueId: currentLeagueId,
              season: league.season,
              wins,
              losses,
              ties,
              rank,
              totalTeams: rosters.length,
              isChampion,
              isPlayoffs,
              isRunnerUp,
            });
          }
          
          currentLeagueId = league.previous_league_id;
        } catch (e) {
          console.error(`Error processing league ${currentLeagueId}:`, e);
          break;
        }
      }

      // Sort by season descending
      seasonStats.sort((a, b) => b.season.localeCompare(a.season));

      // Get current league info for name
      const currentLeague = await sleeperApi.getLeague(leagueId);

      res.json({
        leagueName: currentLeague?.name || "Unknown League",
        totalSeasons: seasonStats.length,
        totalWins,
        totalLosses,
        totalTies,
        championships,
        runnerUps,
        playoffAppearances,
        bestFinish: championships > 0 ? "Champion" : runnerUps > 0 ? "Runner-up" : playoffAppearances > 0 ? "Playoffs" : "N/A",
        seasonStats,
      });
    } catch (error) {
      console.error("Error fetching league summary:", error);
      res.status(500).json({ message: "Failed to fetch league summary" });
    }
  });

  // Player Stats - Get comprehensive player profile with stats, game logs, splits
  app.get("/api/player/:playerId/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const profile = await playerStatsService.getPlayerProfile(playerId, playerName as string);
      
      if (!profile) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching player profile:", error);
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // Player Game Logs
  app.get("/api/player/:playerId/gamelogs", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName, season } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const gameLogs = await playerStatsService.getPlayerGameLogs(
        playerId, 
        playerName as string, 
        season as string | undefined
      );
      
      res.json({ gameLogs });
    } catch (error) {
      console.error("Error fetching game logs:", error);
      res.status(500).json({ message: "Failed to fetch game logs" });
    }
  });

  // Player Career Stats
  app.get("/api/player/:playerId/career", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const stats = await playerStatsService.getPlayerCareerStats(playerId, playerName as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching career stats:", error);
      res.status(500).json({ message: "Failed to fetch career stats" });
    }
  });

  // Player Splits
  app.get("/api/player/:playerId/splits", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const splits = await playerStatsService.getPlayerSplits(playerId, playerName as string);
      res.json({ splits });
    } catch (error) {
      console.error("Error fetching splits:", error);
      res.status(500).json({ message: "Failed to fetch splits" });
    }
  });

  // Roster - Get user's roster for selected league
  app.get("/api/fantasy/roster", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.query;
      
      console.log("[Roster] Request received - userId:", userId, "leagueId:", leagueId);
      
      const userProfile = await storage.getUserProfile(userId);
      console.log("[Roster] User profile - sleeperUserId:", userProfile?.sleeperUserId);
      
      if (!userProfile?.sleeperUserId || !leagueId) {
        console.log("[Roster] Missing data - sleeperUserId:", userProfile?.sleeperUserId, "leagueId:", leagueId);
        return res.status(400).json({ message: "League ID required" });
      }

      const [rosters, allPlayers, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId as string),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId as string),
      ]);
      const userRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      const leagueSize = rosters.length;
      
      // Get roster positions from league settings (excluding BN = bench)
      const rosterPositions = (league?.roster_positions || []).filter((pos: string) => pos !== "BN");
      
      if (!userRoster) {
        return res.json({ 
          players: [], 
          teamName: "My Team", 
          ownerId: "", 
          totalValue: 0, 
          starters: [],
          positionRankings: { QB: { rank: 0, total: leagueSize }, RB: { rank: 0, total: leagueSize }, WR: { rank: 0, total: leagueSize }, TE: { rank: 0, total: leagueSize } }
        });
      }

      // Calculate position group values for ALL teams
      const teamPositionValues: Record<string, { QB: number; RB: number; WR: number; TE: number }> = {};
      
      for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const rosterPlayers = roster.players || [];
        
        const posValues = { QB: 0, RB: 0, WR: 0, TE: 0 };
        
        for (const pid of rosterPlayers) {
          const player = allPlayers[pid];
          if (!player) continue;
          
          const pos = player.position as "QB" | "RB" | "WR" | "TE";
          if (pos in posValues) {
            const value = ktcValues.getPlayerValue(pid, pos, player.age || 25, player.years_exp || 0);
            posValues[pos] += value;
          }
        }
        
        teamPositionValues[ownerId] = posValues;
      }

      // Rank each position group
      const positions = ["QB", "RB", "WR", "TE"] as const;
      const positionRankings: Record<string, { rank: number; total: number; value: number }> = {};
      
      for (const pos of positions) {
        const sorted = Object.entries(teamPositionValues)
          .map(([oid, vals]) => ({ ownerId: oid, value: vals[pos] }))
          .sort((a, b) => b.value - a.value);
        
        const userIndex = sorted.findIndex(t => t.ownerId === userProfile.sleeperUserId);
        const userValue = userIndex >= 0 ? sorted[userIndex].value : 0;
        
        positionRankings[pos] = {
          rank: userIndex + 1,
          total: leagueSize,
          value: userValue,
        };
      }

      const starters = userRoster.starters || [];
      const playerIds = userRoster.players || [];

      const players = playerIds.map(playerId => {
        const player = allPlayers[playerId];
        const ktcValue = ktcValues.getPlayerValue(playerId, player?.position || "?", player?.age || 25, player?.years_exp || 0);
        const isStarter = starters.includes(playerId);
        const starterIndex = starters.indexOf(playerId);
        
        // Use league's roster_positions to determine slot position
        let slotPosition = "BN";
        if (isStarter && starterIndex >= 0 && starterIndex < rosterPositions.length) {
          slotPosition = rosterPositions[starterIndex];
        }
        
        // ESPN headshot URL from Sleeper's ESPN ID mapping
        let headshot: string | null = null;
        if (player?.espn_id) {
          headshot = `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`;
        }

        return {
          playerId,
          name: player?.full_name || player?.first_name + " " + player?.last_name || "Unknown",
          position: player?.position || "?",
          team: player?.team || "FA",
          age: player?.age || 0,
          number: player?.number || "",
          status: player?.status || null,
          injuryStatus: player?.injury_status || null,
          ktcValue,
          projectedPoints: Math.round((ktcValue / 800) * 10 + Math.random() * 5),
          isStarter,
          slotPosition,
          starterIndex: isStarter ? starterIndex : -1,
          headshot,
        };
      }).sort((a, b) => {
        // Starters first, then bench
        if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
        // Starters: maintain Sleeper's lineup order (starterIndex)
        if (a.isStarter && b.isStarter) return a.starterIndex - b.starterIndex;
        // Bench: sort by position, then KTC value
        const posOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6, DL: 7, LB: 8, DB: 9 };
        const posA = posOrder[a.position] || 10;
        const posB = posOrder[b.position] || 10;
        if (posA !== posB) return posA - posB;
        return b.ktcValue - a.ktcValue;
      });

      const totalValue = players.reduce((sum, p) => sum + p.ktcValue, 0);

      res.json({
        players,
        teamName: "My Team",
        ownerId: userProfile.sleeperUserId,
        totalValue,
        starters,
        positionRankings,
        leagueSize,
      });
    } catch (error) {
      console.error("Error fetching roster:", error);
      res.status(500).json({ message: "Failed to fetch roster" });
    }
  });

  return httpServer;
}
