import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, XCircle, Minus, Clock, CircleDot } from "lucide-react";
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

export default function SchedulePage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading, error } = useQuery<ScheduleData>({
    queryKey: ["/api/sleeper/schedule", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/sleeper/schedule/${leagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
    enabled: !!leagueId,
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
