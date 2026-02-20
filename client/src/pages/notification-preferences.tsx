import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  ArrowLeftRight,
  FileText,
  Heart,
  TrendingUp,
  UserPlus,
  Target,
  Megaphone,
  Save,
  Loader2,
} from "lucide-react";

interface NotificationPrefs {
  trades: boolean;
  waivers: boolean;
  injuries: boolean;
  scoringUpdates: boolean;
  freeAgents: boolean;
  draftPicks: boolean;
  leagueAnnouncements: boolean;
}

const NOTIFICATION_TYPES: Array<{
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  icon: any;
}> = [
  { key: "trades", label: "Trades", description: "Get notified when trades are proposed or completed", icon: ArrowLeftRight },
  { key: "waivers", label: "Waivers", description: "Waiver wire claims and processing alerts", icon: FileText },
  { key: "injuries", label: "Injuries", description: "Player injury reports and status changes", icon: Heart },
  { key: "scoringUpdates", label: "Scoring Updates", description: "Live scoring updates during game days", icon: TrendingUp },
  { key: "freeAgents", label: "Free Agents", description: "Notable free agent signings and drops", icon: UserPlus },
  { key: "draftPicks", label: "Draft Picks", description: "Draft pick trades and selections", icon: Target },
  { key: "leagueAnnouncements", label: "League Announcements", description: "Commissioner messages and league updates", icon: Megaphone },
];

const DEFAULT_PREFS: NotificationPrefs = {
  trades: true,
  waivers: true,
  injuries: true,
  scoringUpdates: true,
  freeAgents: true,
  draftPicks: true,
  leagueAnnouncements: true,
};

export default function NotificationPreferencesPage() {
  usePageTitle("Notification Preferences");
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery<NotificationPrefs>({
    queryKey: ["/api/notifications/preferences"],
  });

  useEffect(() => {
    if (data) {
      setPrefs(data);
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (newPrefs: NotificationPrefs) => {
      await apiRequest("PUT", "/api/notifications/preferences", newPrefs);
    },
    onSuccess: () => {
      toast({ title: "Preferences saved", description: "Your notification settings have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    },
  });

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = () => {
    saveMutation.mutate(prefs);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Notification Preferences</h1>
          <p className="text-sm text-muted-foreground">Choose which alerts you want to receive</p>
        </div>
      </div>

      <Card data-testid="card-notification-prefs">
        <CardHeader>
          <CardTitle className="text-base">Alert Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIFICATION_TYPES.map(({ key, label, description, icon: Icon }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 py-2"
              data-testid={`row-notification-${key}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <Label htmlFor={`switch-${key}`} className="text-sm font-medium cursor-pointer">
                    {label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Switch
                id={`switch-${key}`}
                checked={prefs[key]}
                onCheckedChange={() => handleToggle(key)}
                data-testid={`switch-${key}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={!hasChanges || saveMutation.isPending}
        className="w-full"
        data-testid="button-save-preferences"
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save Preferences
          </>
        )}
      </Button>
    </div>
  );
}
