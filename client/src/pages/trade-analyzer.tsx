import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeftRight, Loader2, Search, X, Check, AlertTriangle, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";

interface PlayerOption {
  playerId: string;
  name: string;
  position: string;
  team: string;
}

interface TradeAnalysis {
  verdict: string;
  grade: string;
  summary: string;
  giveSideAnalysis: string;
  getSideAnalysis: string;
  rosterImpact: string;
  counterSuggestion: string | null;
}

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  ACCEPT: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: ThumbsUp },
  REJECT: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: ThumbsDown },
  COUNTER: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: RotateCcw },
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400", "A": "text-emerald-400", "A-": "text-emerald-400",
  "B+": "text-green-400", "B": "text-green-400", "B-": "text-green-400",
  "C+": "text-amber-400", "C": "text-amber-400", "C-": "text-amber-400",
  "D+": "text-orange-400", "D": "text-orange-400", "D-": "text-orange-400",
  "F": "text-red-400",
};

export default function TradeAnalyzerPage() {
  usePageTitle("Trade Analyzer AI");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const [givePlayers, setGivePlayers] = useState<PlayerOption[]>([]);
  const [getPlayers, setGetPlayers] = useState<PlayerOption[]>([]);
  const [giveSearch, setGiveSearch] = useState("");
  const [getSearch, setGetSearch] = useState("");

  const { data: playersData } = useQuery<Record<string, any>>({
    queryKey: ["/api/sleeper/players"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai/trade-analyzer/${leagueId}`, {
        givePlayers: givePlayers.map(p => p.playerId),
        getPlayers: getPlayers.map(p => p.playerId),
      });
      return res.json();
    },
  });

  const searchPlayers = (query: string, exclude: string[]): PlayerOption[] => {
    if (!playersData || query.length < 2) return [];
    const excludeSet = new Set(exclude);
    const q = query.toLowerCase();
    return Object.entries(playersData)
      .filter(([id, p]: [string, any]) => {
        if (excludeSet.has(id)) return false;
        if (!["QB", "RB", "WR", "TE"].includes(p.position)) return false;
        return (p.full_name || "").toLowerCase().includes(q);
      })
      .slice(0, 8)
      .map(([id, p]: [string, any]) => ({
        playerId: id,
        name: p.full_name || id,
        position: p.position || "?",
        team: p.team || "FA",
      }));
  };

  const giveResults = searchPlayers(giveSearch, [...givePlayers, ...getPlayers].map(p => p.playerId));
  const getResults = searchPlayers(getSearch, [...givePlayers, ...getPlayers].map(p => p.playerId));

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to analyze trades</p>
      </div>
    );
  }

  const analysis: TradeAnalysis | null = analyzeMutation.data?.analysis || null;
  const verdictConfig = analysis ? VERDICT_CONFIG[analysis.verdict] || VERDICT_CONFIG.REJECT : null;

  return (
    <PremiumGate featureName="Trade Analyzer AI">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Trade Analyzer AI</h1>
            <p className="text-sm text-muted-foreground">Get AI-powered trade recommendations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-red-400">You Give</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players to give..."
                  value={giveSearch}
                  onChange={(e) => setGiveSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-give-search"
                />
              </div>
              {giveSearch.length >= 2 && giveResults.length > 0 && (
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {giveResults.map(p => (
                    <button
                      key={p.playerId}
                      onClick={() => { setGivePlayers(prev => [...prev, p]); setGiveSearch(""); }}
                      className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2"
                      data-testid={`button-add-give-${p.playerId}`}
                    >
                      <Badge variant="outline" className="text-xs">{p.position}</Badge>
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{p.team}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {givePlayers.map(p => (
                  <div key={p.playerId} className="flex items-center gap-2 p-2 rounded-md bg-red-500/5 border border-red-500/20">
                    <Badge variant="outline" className="text-xs">{p.position}</Badge>
                    <span className="text-sm flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.team}</span>
                    <Button variant="ghost" size="icon" onClick={() => setGivePlayers(prev => prev.filter(x => x.playerId !== p.playerId))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-emerald-400">You Get</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players to receive..."
                  value={getSearch}
                  onChange={(e) => setGetSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-get-search"
                />
              </div>
              {getSearch.length >= 2 && getResults.length > 0 && (
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {getResults.map(p => (
                    <button
                      key={p.playerId}
                      onClick={() => { setGetPlayers(prev => [...prev, p]); setGetSearch(""); }}
                      className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2"
                      data-testid={`button-add-get-${p.playerId}`}
                    >
                      <Badge variant="outline" className="text-xs">{p.position}</Badge>
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{p.team}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {getPlayers.map(p => (
                  <div key={p.playerId} className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                    <Badge variant="outline" className="text-xs">{p.position}</Badge>
                    <span className="text-sm flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.team}</span>
                    <Button variant="ghost" size="icon" onClick={() => setGetPlayers(prev => prev.filter(x => x.playerId !== p.playerId))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Button
          onClick={() => analyzeMutation.mutate()}
          disabled={givePlayers.length === 0 || getPlayers.length === 0 || analyzeMutation.isPending}
          className="w-full"
          data-testid="button-analyze-trade"
        >
          {analyzeMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing Trade...
            </>
          ) : (
            <>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Analyze Trade
            </>
          )}
        </Button>

        {analysis && verdictConfig && (
          <Card data-testid="card-trade-analysis">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className={`flex items-center gap-3 p-3 rounded-md border ${verdictConfig.bg}`}>
                  {(() => { const Icon = verdictConfig.icon; return <Icon className={`h-6 w-6 ${verdictConfig.color}`} />; })()}
                  <div>
                    <p className={`text-lg font-bold ${verdictConfig.color}`} data-testid="text-verdict">{analysis.verdict}</p>
                    <p className="text-xs text-muted-foreground">AI Recommendation</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${GRADE_COLORS[analysis.grade] || "text-muted-foreground"}`} data-testid="text-grade">{analysis.grade}</p>
                  <p className="text-xs text-muted-foreground">Trade Grade</p>
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  <p>Give: {analyzeMutation.data?.giveTotal?.toLocaleString()}</p>
                  <p>Get: {analyzeMutation.data?.getTotal?.toLocaleString()}</p>
                  <p className={analyzeMutation.data?.getTotal > analyzeMutation.data?.giveTotal ? "text-emerald-400" : "text-red-400"}>
                    Diff: {((analyzeMutation.data?.getTotal || 0) - (analyzeMutation.data?.giveTotal || 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-relaxed" data-testid="text-summary">{analysis.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <p className="text-xs font-medium text-red-400">Giving Away</p>
                  <p className="text-sm">{analysis.giveSideAnalysis}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <p className="text-xs font-medium text-emerald-400">Receiving</p>
                  <p className="text-sm">{analysis.getSideAnalysis}</p>
                </div>
              </div>

              {analysis.rosterImpact && (
                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <p className="text-xs font-medium text-primary">Roster Impact</p>
                  <p className="text-sm">{analysis.rosterImpact}</p>
                </div>
              )}

              {analysis.counterSuggestion && (
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <p className="text-xs font-medium text-amber-400">Counter Suggestion</p>
                  </div>
                  <p className="text-sm">{analysis.counterSuggestion}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PremiumGate>
  );
}
