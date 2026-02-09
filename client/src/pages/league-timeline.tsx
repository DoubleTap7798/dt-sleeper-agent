import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Zap, TrendingUp, ArrowLeftRight, Users } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface TimelineEvent {
  type: string;
  title: string;
  description: string;
  ownerName: string | null;
  avatar: string | null;
}

interface TimelineSeason {
  season: string;
  leagueId: string;
  leagueName: string;
  totalTeams: number;
  events: TimelineEvent[];
}

interface TimelineData {
  leagueName: string;
  seasons: TimelineSeason[];
}

function getEventIcon(type: string) {
  switch (type) {
    case "championship":
      return <Trophy className="h-4 w-4" />;
    case "top_scorer":
      return <Zap className="h-4 w-4" />;
    case "best_record":
      return <TrendingUp className="h-4 w-4" />;
    case "trade":
      return <ArrowLeftRight className="h-4 w-4" />;
    default:
      return <Users className="h-4 w-4" />;
  }
}

function getEventColor(type: string) {
  switch (type) {
    case "championship":
      return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
    case "top_scorer":
      return "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30";
    case "best_record":
      return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30";
    case "trade":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getNodeColor(type: string) {
  switch (type) {
    case "championship":
      return "bg-yellow-500";
    case "top_scorer":
      return "bg-cyan-500";
    case "best_record":
      return "bg-green-500";
    case "trade":
      return "bg-muted-foreground/50";
    default:
      return "bg-muted-foreground/50";
  }
}

export default function LeagueTimelinePage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  usePageTitle("League History");

  const { data, isLoading, error } = useQuery<TimelineData>({
    queryKey: ["/api/sleeper/league-timeline", leagueId],
    enabled: !!leagueId,
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="timeline-error">
        <p className="text-muted-foreground">Failed to load league history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="timeline-container">
      <h2 className="text-xl font-semibold" data-testid="text-timeline-title">
        League History
      </h2>
      <p className="text-sm text-muted-foreground" data-testid="text-timeline-subtitle">
        {data.leagueName} &middot; {data.seasons.length} season{data.seasons.length !== 1 ? "s" : ""}
      </p>

      <div className="relative">
        {data.seasons.map((season, seasonIndex) => (
          <div key={season.leagueId} className="relative" data-testid={`timeline-season-${season.season}`}>
            {seasonIndex < data.seasons.length - 1 && (
              <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border" />
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                {season.season.slice(-2)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" data-testid={`badge-season-${season.season}`}>
                  {season.season} Season
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {season.totalTeams} teams &middot; {season.leagueName}
                </span>
              </div>
            </div>

            <div className="ml-[19px] pl-8 pb-8 space-y-3">
              {season.events.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No events recorded</p>
              ) : (
                season.events.map((event, eventIndex) => (
                  <div key={`${season.season}-${event.type}-${eventIndex}`} className="relative">
                    <div className={`absolute -left-8 top-3 h-2.5 w-2.5 rounded-full ${getNodeColor(event.type)}`} />

                    <Card data-testid={`card-event-${season.season}-${event.type}-${eventIndex}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${getEventColor(event.type)}`}>
                            {getEventIcon(event.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm" data-testid={`text-event-title-${season.season}-${eventIndex}`}>
                                {event.title}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1" data-testid={`text-event-desc-${season.season}-${eventIndex}`}>
                              {event.description}
                            </p>
                          </div>

                          {event.avatar && (
                            <Avatar className="h-8 w-8 shrink-0" data-testid={`avatar-event-${season.season}-${eventIndex}`}>
                              <AvatarImage src={event.avatar} alt={event.ownerName || ""} />
                              <AvatarFallback>{(event.ownerName || "?")[0]}</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4" data-testid="timeline-skeleton">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-32" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 pl-12 pb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-20 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
