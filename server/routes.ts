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

      // Transform bracket matchups
      const matchups = (bracket || []).map((match) => {
        // A matchup is a consolation game if BOTH teams are fed from loser positions
        // A matchup is championship bracket if at least one team is from a winner or is a first-round team
        const isBothFromLosers = !!(match.t1_from?.l && match.t2_from?.l);
        
        return {
          round: match.r,
          matchId: match.m,
          team1: getTeamInfo(match.t1),
          team2: getTeamInfo(match.t2),
          winner: match.w,
          loser: match.l,
          team1From: match.t1_from,
          team2From: match.t2_from,
          isThirdPlaceGame: isBothFromLosers && match.r === numRounds,
          isConsolation: isBothFromLosers,
        };
      });

      // Championship bracket: exclude games where BOTH teams are from losers
      const championshipMatchups = matchups.filter((m) => !m.isConsolation);
      
      // 3rd place game: final round matchup where both teams are from losers
      const thirdPlaceGame = matchups.find((m) => m.isThirdPlaceGame) || null;

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
        thirdPlaceGame,
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

      // Get player assets with positions
      const starters: any[] = [];
      const bench: any[] = [];
      const taxi: any[] = [];
      const ir: any[] = [];

      const starterIds = new Set(roster.starters || []);
      const taxiIds = new Set(roster.taxi || []);
      const reserveIds = new Set(roster.reserve || []);

      (roster.players || []).forEach((playerId) => {
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

        if (starterIds.has(playerId)) {
          starters.push(playerInfo);
        } else if (taxiIds.has(playerId)) {
          taxi.push(playerInfo);
        } else if (reserveIds.has(playerId)) {
          ir.push(playerInfo);
        } else {
          bench.push(playerInfo);
        }
      });

      // Sort by value descending
      const sortByValue = (a: any, b: any) => b.value - a.value;
      starters.sort(sortByValue);
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

  return httpServer;
}
