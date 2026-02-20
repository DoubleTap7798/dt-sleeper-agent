import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Copy, Check, Flame, Heart, Swords, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StandingsTeam {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
}

type Tone = "witty" | "savage" | "friendly";

const TONE_CONFIG: Record<Tone, { label: string; icon: any; description: string }> = {
  witty: { label: "Witty", icon: MessageSquare, description: "Sharp, clever humor" },
  savage: { label: "Savage", icon: Flame, description: "No mercy roasting" },
  friendly: { label: "Friendly", icon: Heart, description: "Fun ribbing" },
};

export default function TrashTalkPage() {
  usePageTitle("Trash Talk Generator");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const { toast } = useToast();

  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<Tone>("witty");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const { data: standingsData, isLoading: standingsLoading } = useQuery<{ standings: StandingsTeam[] }>({
    queryKey: ["/api/sleeper/standings", leagueId],
    enabled: !!leagueId,
  });

  const trashTalkMutation = useMutation({
    mutationFn: async ({ opponentOwnerId, tone }: { opponentOwnerId: string; tone: string }) => {
      const res = await apiRequest("POST", `/api/ai/trash-talk/${leagueId}`, { opponentOwnerId, tone });
      return res.json();
    },
  });

  const handleGenerate = () => {
    if (!selectedOpponent) return;
    trashTalkMutation.mutate({ opponentOwnerId: selectedOpponent, tone: selectedTone });
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast({ title: "Copied to clipboard!", description: "Paste it in your league chat" });
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to generate trash talk</p>
      </div>
    );
  }

  return (
    <PremiumGate featureName="Trash Talk Generator">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Swords className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Trash Talk Generator</h1>
            <p className="text-sm text-muted-foreground">AI-powered trash talk for your league mates</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pick Your Target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {standingsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(standingsData?.standings || []).map((team) => (
                  <button
                    key={team.ownerId}
                    onClick={() => setSelectedOpponent(team.ownerId)}
                    className={`flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                      selectedOpponent === team.ownerId
                        ? "border-primary bg-primary/10"
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`button-opponent-${team.ownerId}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={team.avatar || undefined} />
                      <AvatarFallback className="text-xs">{team.ownerName?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{team.ownerName}</p>
                      <p className="text-xs text-muted-foreground">{team.wins}-{team.losses}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Select Tone</p>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(TONE_CONFIG) as [Tone, typeof TONE_CONFIG[Tone]][]).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      key={key}
                      variant={selectedTone === key ? "default" : "outline"}
                      onClick={() => setSelectedTone(key)}
                      data-testid={`button-tone-${key}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedOpponent || trashTalkMutation.isPending}
              className="w-full"
              data-testid="button-generate-trash-talk"
            >
              {trashTalkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cooking up some heat...
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 mr-2" />
                  Generate Trash Talk
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {trashTalkMutation.data && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                Your Ammo vs {trashTalkMutation.data.opponent?.name}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={trashTalkMutation.isPending}
                data-testid="button-regenerate"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                New Ones
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                <span>{trashTalkMutation.data.myTeam?.name} ({trashTalkMutation.data.myTeam?.record})</span>
                <Badge variant="outline">vs</Badge>
                <span>{trashTalkMutation.data.opponent?.name} ({trashTalkMutation.data.opponent?.record})</span>
              </div>
              {(trashTalkMutation.data.messages || []).map((msg: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 rounded-md bg-muted/50 border border-border"
                  data-testid={`text-trash-talk-${idx}`}
                >
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{msg}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(msg, idx)}
                    data-testid={`button-copy-${idx}`}
                  >
                    {copiedIdx === idx ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PremiumGate>
  );
}
