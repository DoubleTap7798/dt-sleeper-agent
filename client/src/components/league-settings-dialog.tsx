import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, GraduationCap, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LeagueSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  leagueName: string;
}

export function LeagueSettingsDialog({ open, onOpenChange, leagueId, leagueName }: LeagueSettingsDialogProps) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<{ devyEnabled: boolean; idpEnabled: boolean }>({
    queryKey: ["/api/league-settings", leagueId],
    enabled: open && !!leagueId,
  });

  const mutation = useMutation({
    mutationFn: async (updates: { devyEnabled?: boolean; idpEnabled?: boolean }) => {
      await apiRequest("PUT", `/api/league-settings/${leagueId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/league-settings", leagueId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-settings-title">
            <Settings className="w-5 h-5" />
            League Settings
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{leagueName}</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
            <div className="flex items-center justify-between gap-4 p-3 rounded-md border border-border/50" data-testid="setting-devy-toggle">
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="devy-toggle" className="text-sm font-medium cursor-pointer">
                    Devy Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show Devy Command Center for this league
                  </p>
                </div>
              </div>
              <Switch
                id="devy-toggle"
                checked={settings?.devyEnabled !== false}
                onCheckedChange={(checked) => mutation.mutate({ devyEnabled: checked })}
                disabled={mutation.isPending}
                data-testid="switch-devy-enabled"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-md border border-border/50" data-testid="setting-idp-toggle">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="idp-toggle" className="text-sm font-medium cursor-pointer">
                    IDP League
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show IDP positions and defensive player data
                  </p>
                </div>
              </div>
              <Switch
                id="idp-toggle"
                checked={settings?.idpEnabled !== false}
                onCheckedChange={(checked) => mutation.mutate({ idpEnabled: checked })}
                disabled={mutation.isPending}
                data-testid="switch-idp-enabled"
              />
            </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
