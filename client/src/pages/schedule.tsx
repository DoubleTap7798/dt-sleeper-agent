import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, XCircle, Minus, Clock, CircleDot } from "lucide-react";

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10" data-testid="avatar-user">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback>{user.ownerName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-schedule-title">
              {user.ownerName}'s Schedule
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-league-info">
              {leagueName} - {season} Season
            </p>
          </div>
        </div>

        <Card className="px-4 py-2" data-testid="card-record">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" data-testid="text-record-label">Record:</span>
            <span className="font-bold text-lg" data-testid="text-record">
              {record.wins}-{record.losses}{record.ties > 0 ? `-${record.ties}` : ""}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-3" data-testid="schedule-list">
        {schedule.map((game) => (
          <Card
            key={game.week}
            className={game.isCurrentWeek ? "ring-2 ring-foreground/20" : ""}
            data-testid={`card-game-week-${game.week}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex flex-col items-center justify-center w-12 shrink-0">
                    <span className="text-xs text-muted-foreground">Week</span>
                    <span className="font-bold text-lg" data-testid={`text-week-${game.week}`}>
                      {game.week}
                    </span>
                    {game.isCurrentWeek && (
                      <Badge variant="secondary" className="text-xs mt-1" data-testid={`badge-current-week-${game.week}`}>
                        Now
                      </Badge>
                    )}
                  </div>

                  <div className="h-8 w-px bg-border shrink-0" />

                  {game.result === "bye" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground italic" data-testid={`text-bye-week-${game.week}`}>
                        Bye Week
                      </span>
                    </div>
                  ) : game.opponent ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-muted-foreground text-sm shrink-0" data-testid={`text-vs-week-${game.week}`}>vs</span>
                      <Avatar className="h-8 w-8 shrink-0" data-testid={`avatar-opponent-week-${game.week}`}>
                        <AvatarImage src={game.opponent.avatar || undefined} />
                        <AvatarFallback>{game.opponent.ownerName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate" data-testid={`text-opponent-name-week-${game.week}`}>
                        {game.opponent.ownerName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground" data-testid={`text-tbd-week-${game.week}`}>
                      TBD
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {game.isPastWeek || game.isCurrentWeek ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-sm text-muted-foreground">You:</span>
                          <span className="font-medium" data-testid={`text-user-points-week-${game.week}`}>
                            {game.userPoints.toFixed(2)}
                          </span>
                        </div>
                        {game.opponent && (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-sm text-muted-foreground">Opp:</span>
                            <span className="font-medium" data-testid={`text-opponent-points-week-${game.week}`}>
                              {game.opponentPoints.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <Badge
                    variant="secondary"
                    className="min-w-[50px] justify-center"
                    data-testid={`badge-result-week-${game.week}`}
                  >
                    <span className="flex items-center gap-1">
                      {getResultIcon(game.result)}
                      {getResultText(game.result)}
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
