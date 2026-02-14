import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPositionColorClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight, UserPlus, Clock, Activity, Filter } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface ActivityPlayer {
  name: string;
  position: string;
  action: "added" | "dropped";
}

interface ActivityItem {
  id: string;
  type: "trade" | "waiver" | "free_agent";
  leagueId: string;
  leagueName: string;
  timestamp: number;
  description: string;
  players: ActivityPlayer[];
  draftPicks: string[];
  teams: string[];
}

interface ActivityFeedData {
  activities: ActivityItem[];
  lastUpdated: number;
}

type FilterType = "all" | "trade" | "waiver" | "free_agent";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default function ActivityFeedPage() {
  usePageTitle("Activity Feed");
  const [filter, setFilter] = useState<FilterType>("all");

  const { data, isLoading, error } = useQuery<ActivityFeedData>({
    queryKey: ["/api/fantasy/activity-feed"],
  });

  if (isLoading) {
    return <ActivityFeedSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground" data-testid="text-error">Failed to load activity feed</p>
      </div>
    );
  }

  const activities = data?.activities || [];
  const filtered = filter === "all" ? activities : activities.filter(a => a.type === filter);

  const filterOptions: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Trades", value: "trade" },
    { label: "Waivers", value: "waiver" },
    { label: "Free Agents", value: "free_agent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-activity-title">
          <Activity className="h-6 w-6 text-primary" />
          Activity Feed
        </h2>
        <p className="text-muted-foreground">
          Recent moves across all your leagues
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {filterOptions.map(opt => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(opt.value)}
            data-testid={`filter-${opt.value}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground" data-testid="text-empty-state">
                {activities.length === 0
                  ? "No recent activity found across your leagues"
                  : "No activities match the selected filter"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(activity => (
            <Card key={activity.id} data-testid={`card-activity-${activity.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {activity.type === "trade" ? (
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                        <ArrowLeftRight className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-emerald-500/10 flex items-center justify-center">
                        <UserPlus className="h-4 w-4 text-emerald-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-league-${activity.id}`}>
                        {activity.leagueName}
                      </Badge>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {activity.type === "trade" ? "Trade" : activity.type === "waiver" ? "Waiver" : "Free Agent"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </div>

                    <p className="text-sm" data-testid={`text-description-${activity.id}`}>
                      {activity.description}
                    </p>

                    {activity.players.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {activity.players.map((player, idx) => (
                          <div key={`${player.name}-${idx}`} className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getPositionColorClass(player.position)}`}>
                              {player.position}
                            </Badge>
                            <span className={`text-xs ${player.action === "added" ? "text-emerald-400" : "text-red-400"}`}>
                              {player.action === "added" ? "+" : "-"}{player.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activity.draftPicks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {activity.draftPicks.map((pick, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {pick}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-md shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
