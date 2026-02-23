import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, RefreshCw, TrendingUp, Shield, Target, Zap,
  ArrowRightLeft, Clock, Flame, BarChart3, Eye, AlertTriangle,
  Sparkles, ChevronRight, Lightbulb,
} from "lucide-react";

interface ManagerProfileData {
  managerStyle: string;
  positionPreferences: { favored: string[]; avoided: string[] };
  agePreference: string;
  riskTolerance: string;
  tradeFrequency: string;
  draftPickStrategy: string;
  waiverActivity: string;
  keyPatterns: string[];
  strengths: string[];
  blindSpots: string[];
  summary: string;
}

interface ProfileResponse {
  profile: ManagerProfileData | null;
  needsAnalysis?: boolean;
  stale?: boolean;
  lastUpdated?: string;
  tradesAnalyzed?: number;
  transactionsAnalyzed?: number;
}

const styleLabels: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  aggressive_trader: { label: "Aggressive Trader", icon: ArrowRightLeft, color: "text-red-400" },
  patient_builder: { label: "Patient Builder", icon: Clock, color: "text-blue-400" },
  win_now: { label: "Win-Now Mode", icon: Flame, color: "text-orange-400" },
  rebuilder: { label: "Rebuilder", icon: Target, color: "text-cyan-400" },
  balanced: { label: "Balanced", icon: BarChart3, color: "text-amber-400" },
  opportunistic: { label: "Opportunistic", icon: Zap, color: "text-yellow-400" },
};

const riskLabels: Record<string, { label: string; color: string }> = {
  high_risk: { label: "High Risk", color: "text-red-400" },
  moderate: { label: "Moderate", color: "text-amber-400" },
  conservative: { label: "Conservative", color: "text-green-400" },
};

const ageLabels: Record<string, string> = {
  youth_chaser: "Youth Chaser",
  prime_age: "Prime Age Focus",
  veteran_friendly: "Veteran Friendly",
  balanced: "Balanced",
};

const frequencyLabels: Record<string, { label: string; value: number }> = {
  very_active: { label: "Very Active", value: 95 },
  active: { label: "Active", value: 70 },
  moderate: { label: "Moderate", value: 45 },
  passive: { label: "Passive", value: 20 },
};

const pickLabels: Record<string, string> = {
  accumulator: "Pick Accumulator",
  spender: "Pick Spender",
  balanced: "Balanced",
};

const waiverLabels: Record<string, string> = {
  aggressive: "Aggressive",
  moderate: "Moderate",
  passive: "Passive",
};

export default function ManagerProfilePage() {
  const { league, isLoading: leagueLoading } = useSelectedLeague();
  const leagueId = league?.league_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  usePageTitle("Manager Profile");

  const { data, isLoading, error } = useQuery<ProfileResponse>({
    queryKey: ["/api/manager-profile", leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/manager-profile/${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!leagueId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/manager-profile/${leagueId}/analyze`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager-profile", leagueId] });
      toast({ title: "Profile Updated", description: "Your manager profile has been analyzed and updated." });
    },
    onError: (err: any) => {
      toast({ title: "Analysis Failed", description: err.message || "Could not analyze your transaction history.", variant: "destructive" });
    },
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="no-league-selected">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view your manager profile.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-60" />
      </div>
    );
  }

  const profile = data?.profile;
  const needsAnalysis = !profile || data?.needsAnalysis;

  if (needsAnalysis) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
            <Brain className="h-20 w-20 text-amber-400 relative" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-gold" data-testid="title-analyze-profile">AI Manager Profile</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            The AI will analyze your trade history, waiver moves, and transaction patterns to build a personalized manager profile. This profile helps tailor all AI recommendations to your style.
          </p>
          <Button
            size="lg"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="premium-shine bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold px-8"
            data-testid="button-analyze-profile"
          >
            {analyzeMutation.isPending ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Analyzing Transactions...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Analyze My History
              </>
            )}
          </Button>
          {analyzeMutation.isPending && (
            <p className="text-sm text-muted-foreground animate-pulse">
              Scanning up to 3 seasons of transactions... This may take a moment.
            </p>
          )}
        </div>
      </div>
    );
  }

  const style = styleLabels[profile.managerStyle] || styleLabels.balanced;
  const StyleIcon = style.icon;
  const risk = riskLabels[profile.riskTolerance] || riskLabels.moderate;
  const freq = frequencyLabels[profile.tradeFrequency] || frequencyLabels.moderate;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold flex items-center gap-3" data-testid="title-manager-profile">
            <Brain className="h-7 w-7 text-amber-400" />
            AI Manager Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Based on {data?.tradesAnalyzed || 0} trades and {data?.transactionsAnalyzed || 0} waiver moves
            {data?.lastUpdated && ` · Updated ${new Date(data.lastUpdated).toLocaleDateString()}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10"
          data-testid="button-refresh-profile"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {data?.stale && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
          <AlertTriangle className="h-4 w-4" />
          Your profile may be outdated. Click refresh to re-analyze your latest transactions.
        </div>
      )}

      <Card className="border-amber-500/20 bg-gradient-to-br from-card to-amber-950/10 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <StyleIcon className={`h-8 w-8 ${style.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold" data-testid="text-manager-style">{style.label}</h2>
                <Badge variant="outline" className={`${risk.color} border-current/30`} data-testid="badge-risk">{risk.label} Risk</Badge>
              </div>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-summary">{profile.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 hover-glow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
              Trade Frequency
            </div>
            <div className="font-semibold" data-testid="text-trade-frequency">{freq.label}</div>
            <Progress value={freq.value} className="h-1.5" />
          </CardContent>
        </Card>
        <Card className="border-border/50 hover-glow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Age Preference
            </div>
            <div className="font-semibold" data-testid="text-age-preference">{ageLabels[profile.agePreference] || "Balanced"}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 hover-glow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Draft Picks
            </div>
            <div className="font-semibold" data-testid="text-pick-strategy">{pickLabels[profile.draftPickStrategy] || "Balanced"}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 hover-glow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              Waiver Activity
            </div>
            <div className="font-semibold" data-testid="text-waiver-activity">{waiverLabels[profile.waiverActivity] || "Moderate"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {profile.positionPreferences && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Position Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.positionPreferences.favored?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Favored Positions</div>
                  <div className="flex flex-wrap gap-1.5" data-testid="badges-favored-positions">
                    {profile.positionPreferences.favored.map((pos, i) => (
                      <Badge key={i} variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">{pos}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.positionPreferences.avoided?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Less Targeted</div>
                  <div className="flex flex-wrap gap-1.5" data-testid="badges-avoided-positions">
                    {profile.positionPreferences.avoided.map((pos, i) => (
                      <Badge key={i} variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10">{pos}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {profile.keyPatterns?.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Key Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" data-testid="list-key-patterns">
                {profile.keyPatterns.map((pattern, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {profile.strengths?.length > 0 && (
          <Card className="border-green-500/20 bg-gradient-to-br from-card to-green-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" data-testid="list-strengths">
                {profile.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-green-400 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {profile.blindSpots?.length > 0 && (
          <Card className="border-amber-500/20 bg-gradient-to-br from-card to-amber-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" data-testid="list-blind-spots">
                {profile.blindSpots.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">How this works:</span> Your manager profile is built by AI analyzing your trade history, waiver moves, and transaction patterns across up to 3 seasons. This profile is then used to personalize all AI recommendations including the chat assistant, trade analyzer, and more.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}