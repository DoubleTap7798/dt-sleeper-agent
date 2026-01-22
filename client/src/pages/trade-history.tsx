import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeftRight, Calendar, Trophy, Sparkles } from "lucide-react";

interface TradeAssetDisplay {
  id: string;
  name: string;
  type: "player" | "pick";
  position?: string;
}

interface Trade {
  transactionId: string;
  timestamp: number;
  team1: {
    rosterId: number;
    ownerName: string;
    avatar: string | null;
    received: TradeAssetDisplay[];
  };
  team2: {
    rosterId: number;
    ownerName: string;
    avatar: string | null;
    received: TradeAssetDisplay[];
  };
  week?: number;
}

interface TeamTradeStats {
  ownerId: string;
  ownerName: string;
  avatar: string | null;
  totalTrades: number;
  tradingPartners: { [key: string]: number };
  bestTrade?: {
    trade: Trade;
    analysis: string;
  };
}

interface TradeHistoryData {
  trades: Trade[];
  teamStats: TeamTradeStats[];
  season: string;
}

export default function TradeHistoryPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading, error } = useQuery<TradeHistoryData>({
    queryKey: ["/api/sleeper/trades", leagueId],
    enabled: !!leagueId,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-history-title">
          Trade History
        </h2>
        <p className="text-muted-foreground">
          All trades and analysis for this league
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Recent Trades ({data.trades.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.trades.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No trades found for this league
                </p>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {data.trades.map((trade) => (
                      <Card key={trade.transactionId} className="border" data-testid={`card-trade-${trade.transactionId}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(trade.timestamp)}</span>
                            {trade.week && (
                              <Badge variant="outline" className="text-xs">
                                Week {trade.week}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
                            <TradeTeamColumn team={trade.team1} />
                            <div className="flex items-center justify-center pt-6">
                              <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <TradeTeamColumn team={trade.team2} />
                          </div>
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

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Best Trades (AI)
              </CardTitle>
              <CardDescription>
                Top trades identified by AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {data.teamStats
                  .filter((t) => t.bestTrade)
                  .slice(0, 4)
                  .map((team, index) => (
                    <AccordionItem
                      key={team.ownerId}
                      value={team.ownerId}
                      className="border rounded-lg px-3"
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={team.avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {team.ownerName?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{team.ownerName}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0 pb-3">
                        <p className="text-sm text-muted-foreground">
                          {team.bestTrade?.analysis || "Trade analysis not available"}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
              </Accordion>
              {data.teamStats.filter((t) => t.bestTrade).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No trade analyses available yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TradeTeamColumn({ team }: { team: Trade["team1"] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={team.avatar || undefined} />
          <AvatarFallback className="text-xs">
            {team.ownerName?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate">{team.ownerName}</span>
      </div>
      <div className="pl-8">
        <p className="text-xs text-muted-foreground mb-1">Received:</p>
        <div className="space-y-1">
          {team.received.map((asset) => (
            <div key={asset.id} className="flex items-center gap-1.5">
              {asset.position && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {asset.position}
                </Badge>
              )}
              <span className="text-sm truncate">{asset.name}</span>
            </div>
          ))}
          {team.received.length === 0 && (
            <span className="text-sm text-muted-foreground italic">Nothing</span>
          )}
        </div>
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
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
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
