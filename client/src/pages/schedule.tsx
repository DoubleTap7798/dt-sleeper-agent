import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Calendar, Trophy, XCircle, Minus, Clock, CircleDot, BarChart3, TrendingUp, TrendingDown, Shield } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface Opponent {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
}

interface ScheduleGame {
  week: number;
  opponent: Opponent | null;
  userPoints: number;
  opponentPoints: number;
  result: "win" | "loss" | "tie" | "upcoming" | "in_progress" | "bye";
  isPastWeek: boolean;
  isCurrentWeek: boolean;
}

interface ScheduleData {
  schedule: ScheduleGame[];
  currentWeek: number;
  playoffWeekStart: number;
  record: { wins: number; losses: number; ties: number };
  user: {
    rosterId: number;
    ownerName: string;
    avatar: string | null;
  };
  leagueName: string;
  season: string;
}

interface SosGame {
  week: number;
  opponentId: number;
  opponentName: string;
  opponentAvatar: string | null;
  opponentRecord: string;
  opponentPowerRank: number;
  opponentPowerScore: number;
  difficulty: string;
}

interface TeamSos {
  rosterId: number;
  ownerName: string;
  avatar: string | null;
  record: string;
  sosScore: number;
  sosRank: number;
  remainingGames: SosGame[];
  avgOpponentPowerRank: number;
}

interface SosData {
  leagueName: string;
  season: string;
  currentWeek: number;
  playoffWeekStart: number;
  totalTeams: number;
  userRosterId: number;
  userSos: TeamSos | null;
  allTeamsSos: TeamSos[];
  powerRankings: { rosterId: number; ownerName: string; rank: number; score: number }[];
}

export default function SchedulePage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  const [activeTab, setActiveTab] = useState("schedule");

  const { data, isLoading, error } = useQuery<ScheduleData>({
    queryKey: ["/api/sleeper/schedule", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/sleeper/schedule/${leagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
    enabled: !!leagueId,
  });

  const { data: sosData, isLoading: sosLoading } = useQuery<SosData>({
    queryKey: ["/api/sleeper/strength-of-schedule", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/sleeper/strength-of-schedule/${leagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch SOS");
      return res.json();
    },
    enabled: !!leagueId && activeTab === "sos",
  });

  usePageTitle("Schedule");

  if (isLoading) {
    return <ScheduleSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-schedule">
        <p className="text-muted-foreground" data-testid="text-error-schedule">Failed to load schedule</p>
      </div>
    );
  }

  const { schedule, currentWeek, record, user, leagueName, season } = data;

  const getResultIcon = (result: ScheduleGame["result"]) => {
    switch (result) {
      case "win":
        return <Trophy className="h-4 w-4" />;
      case "loss":
        return <XCircle className="h-4 w-4" />;
      case "tie":
        return <Minus className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "bye":
        return <CircleDot className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getResultText = (result: ScheduleGame["result"]) => {
    switch (result) {
      case "win": return "W";
      case "loss": return "L";
      case "tie": return "T";
      case "in_progress": return "Live";
      case "bye": return "BYE";
      default: return "-";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Hard": return "text-red-400 bg-red-500/10 border-red-500/30";
      case "Easy": return "text-green-400 bg-green-500/10 border-green-500/30";
      default: return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    }
  };

  return (
    <div className="space-y-6" data-testid="schedule-page">
      <div className="space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" data-testid="avatar-user">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="text-xs sm:text-sm">{user.ownerName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold truncate" data-testid="text-schedule-title">
              {user.ownerName}'s Schedule
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate" data-testid="text-league-info">
              {leagueName} - {season}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-sm sm:text-base px-2 sm:px-3 py-1" data-testid="card-record">
            <span className="font-bold" data-testid="text-record">
              {record.wins}-{record.losses}{record.ties > 0 ? `-${record.ties}` : ""}
            </span>
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2" data-testid="tabs-schedule">
          <TabsTrigger value="schedule" data-testid="tab-schedule">
            <Calendar className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Schedule</span>
            <span className="sm:hidden">Sched</span>
          </TabsTrigger>
          <TabsTrigger value="sos" data-testid="tab-sos">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Strength of Schedule</span>
            <span className="sm:hidden">SOS</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <div className="grid gap-3" data-testid="schedule-list">
            {schedule.map((game) => (
              <Card
                key={game.week}
                className={game.isCurrentWeek ? "ring-2 ring-foreground/20" : ""}
                data-testid={`card-game-week-${game.week}`}
              >
                <CardContent className="p-2 sm:p-4">
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center justify-center w-8 sm:w-12">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Wk</span>
                        <span className="font-bold text-sm sm:text-lg" data-testid={`text-week-${game.week}`}>
                          {game.week}
                        </span>
                        {game.isCurrentWeek && (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs mt-0.5 px-1" data-testid={`badge-current-week-${game.week}`}>
                            Now
                          </Badge>
                        )}
                      </div>
                      <div className="h-6 sm:h-8 w-px bg-border" />
                    </div>

                    <div className="min-w-0">
                      {game.result === "bye" ? (
                        <span className="text-muted-foreground italic text-xs sm:text-sm" data-testid={`text-bye-week-${game.week}`}>
                          Bye
                        </span>
                      ) : game.opponent ? (
                        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                          <span className="text-muted-foreground text-[10px] sm:text-xs" data-testid={`text-vs-week-${game.week}`}>vs</span>
                          <Avatar className="h-5 w-5 sm:h-8 sm:w-8 shrink-0" data-testid={`avatar-opponent-week-${game.week}`}>
                            <AvatarImage src={game.opponent.avatar || undefined} />
                            <AvatarFallback className="text-[10px] sm:text-xs">{game.opponent.ownerName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-xs sm:text-base truncate" data-testid={`text-opponent-name-week-${game.week}`}>
                            {game.opponent.ownerName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs sm:text-sm" data-testid={`text-tbd-week-${game.week}`}>
                          TBD
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                      {(game.isPastWeek || game.isCurrentWeek) && game.result !== "bye" ? (
                        <div className="text-right text-[10px] sm:text-sm leading-tight">
                          <div data-testid={`text-user-points-week-${game.week}`}>
                            {game.userPoints.toFixed(1)}
                          </div>
                          {game.opponent && (
                            <div className="text-muted-foreground" data-testid={`text-opponent-points-week-${game.week}`}>
                              {game.opponentPoints.toFixed(1)}
                            </div>
                          )}
                        </div>
                      ) : null}

                      <Badge
                        variant="secondary"
                        className="justify-center px-1 sm:px-2"
                        data-testid={`badge-result-week-${game.week}`}
                      >
                        <span className="flex items-center gap-0.5 sm:gap-1">
                          {getResultIcon(game.result)}
                          <span className="hidden sm:inline">{getResultText(game.result)}</span>
                        </span>
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sos" className="mt-4">
          {sosLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : sosData ? (
            <div className="space-y-4" data-testid="sos-section">
              {sosData.userSos && (
                <Card data-testid="card-user-sos">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Your Remaining Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">SOS Rank</p>
                        <p className="text-xl font-bold" data-testid="text-user-sos-rank">
                          #{sosData.userSos.sosRank}
                          <span className="text-sm font-normal text-muted-foreground">/{sosData.totalTeams}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {sosData.userSos.sosRank <= Math.ceil(sosData.totalTeams / 3) ? "Hardest" : sosData.userSos.sosRank > sosData.totalTeams - Math.ceil(sosData.totalTeams / 3) ? "Easiest" : "Average"}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">SOS Score</p>
                        <p className="text-xl font-bold" data-testid="text-user-sos-score">{sosData.userSos.sosScore}</p>
                        <p className="text-[10px] text-muted-foreground">out of 100</p>
                      </div>
                      <div className="text-center p-3 rounded bg-muted/50 col-span-2 sm:col-span-1">
                        <p className="text-xs text-muted-foreground mb-1">Avg Opp Rank</p>
                        <p className="text-xl font-bold" data-testid="text-avg-opp-rank">#{sosData.userSos.avgOpponentPowerRank.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground">of {sosData.totalTeams} teams</p>
                      </div>
                    </div>

                    {sosData.userSos.remainingGames.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Remaining Opponents</p>
                        <div className="grid gap-2">
                          {sosData.userSos.remainingGames.map((game) => (
                            <div key={game.week} className="flex items-center gap-2 sm:gap-3 p-2 rounded bg-muted/30" data-testid={`sos-game-week-${game.week}`}>
                              <div className="w-7 sm:w-10 text-center shrink-0">
                                <span className="text-[10px] text-muted-foreground block">Wk</span>
                                <span className="font-bold text-xs sm:text-sm">{game.week}</span>
                              </div>
                              <div className="h-5 w-px bg-border shrink-0" />
                              <Avatar className="h-5 w-5 sm:h-6 sm:w-6 shrink-0">
                                <AvatarImage src={game.opponentAvatar || undefined} />
                                <AvatarFallback className="text-[8px] sm:text-[10px]">{game.opponentName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium truncate">{game.opponentName}</p>
                                <p className="text-[10px] text-muted-foreground">{game.opponentRecord}</p>
                              </div>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="text-right shrink-0">
                                    <p className="text-[10px] text-muted-foreground">Pwr #{game.opponentPowerRank}</p>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>Power Score: {game.opponentPowerScore}</TooltipContent>
                              </Tooltip>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${getDifficultyColor(game.difficulty)}`} data-testid={`badge-difficulty-${game.week}`}>
                                {game.difficulty}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card data-testid="card-league-sos">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    League SOS Rankings
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Ranked by remaining schedule difficulty (hardest to easiest)</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sosData.allTeamsSos.map((team, idx) => {
                      const isUser = team.rosterId === sosData.userRosterId;
                      const maxScore = Math.max(...sosData.allTeamsSos.map(t => t.sosScore), 1);
                      return (
                        <div
                          key={team.rosterId}
                          className={`flex items-center gap-2 sm:gap-3 p-2 rounded ${isUser ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/30"}`}
                          data-testid={`sos-team-${idx}`}
                        >
                          <span className="w-6 text-center font-bold text-xs sm:text-sm text-muted-foreground" data-testid={`sos-rank-${idx}`}>
                            #{team.sosRank}
                          </span>
                          <Avatar className="h-5 w-5 sm:h-6 sm:w-6 shrink-0">
                            <AvatarImage src={team.avatar || undefined} />
                            <AvatarFallback className="text-[8px] sm:text-[10px]">{team.ownerName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className={`text-xs sm:text-sm font-medium truncate ${isUser ? "font-bold" : ""}`} data-testid={`sos-team-name-${idx}`}>
                                {team.ownerName}
                              </p>
                              {isUser && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={(team.sosScore / maxScore) * 100} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground shrink-0 w-8 text-right">{team.sosScore}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground">{team.record}</p>
                            <div className="flex items-center gap-0.5 justify-end">
                              {team.sosRank <= Math.ceil(sosData.totalTeams / 3) ? (
                                <TrendingUp className="h-3 w-3 text-red-400" />
                              ) : team.sosRank > sosData.totalTeams - Math.ceil(sosData.totalTeams / 3) ? (
                                <TrendingDown className="h-3 w-3 text-green-400" />
                              ) : (
                                <Minus className="h-3 w-3 text-yellow-400" />
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {team.remainingGames.length} games
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground text-sm">No strength of schedule data available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-6" data-testid="schedule-skeleton">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <Skeleton className="h-12 w-32" />
      </div>

      <div className="grid gap-3">
        {Array.from({ length: 14 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12" />
                  <Skeleton className="h-1 w-px" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-8 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
