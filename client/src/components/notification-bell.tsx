import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, ArrowRightLeft, UserPlus, RefreshCw, CheckCheck, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  leagueId: string;
  type: string;
  transactionId: string | null;
  title: string;
  message: string;
  metadata: any;
  createdAt: string;
}

interface NotificationsData {
  notifications: Notification[];
  unreadCount?: number;
}

interface NotificationBellProps {
  leagueId: string | undefined;
}

export function NotificationBell({ leagueId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const prevUnreadCount = useRef(0);

  const { data: allNotifications, isLoading } = useQuery<NotificationsData>({
    queryKey: [`/api/notifications/${leagueId}`],
    enabled: !!leagueId,
    refetchInterval: 60000,
  });

  const { data: unreadData } = useQuery<NotificationsData>({
    queryKey: [`/api/notifications/${leagueId}/unread`],
    enabled: !!leagueId,
    refetchInterval: 60000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!leagueId) return;
      return await apiRequest("POST", `/api/notifications/${leagueId}/sync`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${leagueId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${leagueId}/unread`] });
      if (data?.newNotifications > 0) {
        toast({
          title: "New Activity",
          description: `${data.newNotifications} new update${data.newNotifications > 1 ? "s" : ""} found`,
        });
      }
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!leagueId) return;
      return await apiRequest("POST", "/api/notifications/mark-read", { notificationIds, leagueId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${leagueId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${leagueId}/unread`] });
    },
  });

  useEffect(() => {
    if (leagueId) {
      syncMutation.mutate();
    }
  }, [leagueId]);

  useEffect(() => {
    const currentCount = unreadData?.unreadCount || 0;
    if (currentCount > prevUnreadCount.current && prevUnreadCount.current > 0) {
      toast({
        title: "New Activity",
        description: `${currentCount - prevUnreadCount.current} new notification${currentCount - prevUnreadCount.current > 1 ? "s" : ""}`,
      });
    }
    prevUnreadCount.current = currentCount;
  }, [unreadData?.unreadCount, toast]);

  const handleMarkAllRead = () => {
    if (unreadData?.notifications?.length) {
      const ids = unreadData.notifications.map((n) => n.id);
      markReadMutation.mutate(ids);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "trade":
        return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />;
      case "waiver":
      case "free_agent":
        return <UserPlus className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = unreadData?.unreadCount || 0;
  const notifications = allNotifications?.notifications || [];

  if (!leagueId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">League Activity</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-refresh-notifications"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs">Check back later for trades, waivers, and more</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 hover-elevate cursor-default"
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
