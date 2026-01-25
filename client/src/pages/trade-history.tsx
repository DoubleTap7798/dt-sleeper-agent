import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeftRight, Calendar, Trophy, Sparkles, TrendingUp } from "lucide-react";

interface TradeAssetDisplay {
  id: string;
  name: string;
  displayName?: string;
  type: "player" | "pick";
  position?: string;
}

interface TradeTeam {
  rosterId: number;
  ownerName: string;
  avatar: string | null;
  received: TradeAssetDisplay[];
  value: number;
}

interface Trade {
  transactionId: string;
  timestamp: number;
  season: string;
  team1: TradeTeam;
  team2: TradeTeam;
  week?: number;
  valueDiff: number;
  absValueDiff: number;
}

interface SeasonTrades {
  season: string;
  trades: Trade[];
}

interface BestTrade extends Trade {
  winner: string;
  loser: string;
  aiAnalysis: string;
}

interface TeamTradeStats {
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  totalTrades: number;
  tradingPartners: { [key: string]: number };
}

interface TradeHistoryData {
  seasonTrades: SeasonTrades[];
  teamStats: TeamTradeStats[];
  leagueHistory: string[];
  currentSeason: string;
  bestTrades: BestTrade[];
  totalTrades: number;
}

export default function TradeHistoryPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");

  const { data, isLoading, error } = useQuery<TradeHistoryData>({
    queryKey: ["/api/sleeper/trades", leagueId],
    enabled: !!leagueId,
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <TradeHistorySkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load trade history</p>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const allTrades = data.seasonTrades.flatMap(s => s.trades);
  const displayTrades = selectedSeason === "all" 
    ? allTrades 
    : data.seasonTrades.find(s => s.season === selectedSeason)?.trades || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-history-title">
          Trade History
        </h2>
        <p className="text-muted-foreground">
          {data.totalTrades} trades across {data.leagueHistory.length} season{data.leagueHistory.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={selectedSeason} onValueChange={setSelectedSeason}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="all" data-testid="tab-all-seasons">
                All Seasons
              </TabsTrigger>
              {data.leagueHistory.map((season) => (
                <TabsTrigger key={season} value={season} data-testid={`tab-season-${season}`}>
                  {season}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                {selectedSeason === "all" ? "All Trades" : `${selectedSeason} Season`} ({displayTrades.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {displayTrades.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No trades found for this {selectedSeason === "all" ? "league" : "season"}
                </p>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {displayTrades.map((trade, idx) => (
                      <Card key={`${trade.transactionId}-${idx}`} className="border" data-testid={`card-trade-${trade.transactionId}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(trade.timestamp)}</span>
                            <Badge variant="outline" className="text-xs">
                              {trade.season}
                            </Badge>
                            {trade.week && (
                              <Badge variant="secondary" className="text-xs">
                                Wk {trade.week}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
                            <TradeTeamColumn team={trade.team1} />
                            <div className="flex items-center justify-center pt-6">
                              <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <TradeTeamColumn team={trade.team2} />
                          </div>

                          {trade.absValueDiff > 0 && (
                            <div className="mt-3 pt-3 border-t flex items-center justify-center gap-2 text-xs text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              <span>
                                Value difference: <span className="font-mono font-medium text-foreground">{trade.absValueDiff.toLocaleString()}</span>
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Best Trades (AI Analysis)
              </CardTitle>
              <CardDescription>
                Top value trades identified by AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.bestTrades.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No trade analyses available yet
                </p>
              ) : (
                <Accordion type="single" collapsible className="space-y-2">
                  {data.bestTrades.map((trade, index) => (
                    <AccordionItem
                      key={`${trade.transactionId}-${index}`}
                      value={trade.transactionId}
                      className="border rounded-lg px-3"
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2 text-left">
                          <Badge variant="secondary" className="shrink-0">
                            {trade.season}
                          </Badge>
                          <span className="text-sm font-medium truncate">{trade.winner}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0 pb-3 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Value gained: <span className="font-semibold">+{trade.absValueDiff.toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {trade.aiAnalysis}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Most Active Traders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.teamStats
                .sort((a, b) => b.totalTrades - a.totalTrades)
                .slice(0, 6)
                .map((team, index) => (
                  <div
                    key={team.ownerId}
                    className="flex items-center gap-3"
                    data-testid={`active-trader-${index}`}
                  >
                    <span className="text-muted-foreground w-4 text-sm">{index + 1}.</span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={team.avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {team.ownerName?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.ownerName}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {team.totalTrades} trades
                    </Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TradeTeamColumn({ team }: { team: TradeTeam }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={team.avatar || undefined} />
          <AvatarFallback className="text-[10px]">
            {team.ownerName?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate max-w-[120px]" title={team.ownerName}>
          {team.ownerName}
        </span>
      </div>
      <div className="pl-8">
        <p className="text-xs text-muted-foreground mb-1">Received:</p>
        <div className="space-y-1">
          {team.received.map((asset, idx) => (
            <div key={`${asset.id}-${idx}`} className="flex items-center gap-1.5">
              {asset.position && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                  {asset.position}
                </Badge>
              )}
              <span 
                className="text-sm leading-tight" 
                title={asset.name}
              >
                {asset.displayName || asset.name}
              </span>
            </div>
          ))}
          {team.received.length === 0 && (
            <span className="text-sm text-muted-foreground italic">Nothing</span>
          )}
        </div>
        {team.value > 0 && (
          <div className="mt-1 text-xs text-muted-foreground font-mono">
            Value: {team.value.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeHistorySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
