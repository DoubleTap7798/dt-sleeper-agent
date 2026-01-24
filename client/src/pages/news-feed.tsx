import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Newspaper, RefreshCw, Search, ExternalLink, AlertTriangle, TrendingUp, Zap, DollarSign } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: "injury" | "trade" | "analysis" | "news" | "waiver";
  players?: string[];
  teams?: string[];
}

interface NewsResponse {
  news: NewsItem[];
  lastUpdated: string;
}

interface GameOdds {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  spread: {
    homeSpread: number;
    homeOdds: number;
    awaySpread: number;
    awayOdds: number;
  } | null;
  moneyline: {
    homeOdds: number;
    awayOdds: number;
  } | null;
  total: {
    over: number;
    overOdds: number;
    under: number;
    underOdds: number;
  } | null;
  bookmaker: string;
}

interface OddsResponse {
  games: GameOdds[];
  lastUpdated: string;
}

export default function NewsFeedPage() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const { data: newsData, isLoading: newsLoading, error: newsError, refetch: refetchNews, isFetching: newsFetching } = useQuery<NewsResponse>({
    queryKey: [`/api/fantasy/news`],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: oddsData, isLoading: oddsLoading, error: oddsError, refetch: refetchOdds, isFetching: oddsFetching } = useQuery<OddsResponse>({
    queryKey: [`/api/fantasy/odds`],
    refetchInterval: 10 * 60 * 1000,
    enabled: activeTab === "odds",
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "injury":
        return <AlertTriangle className="h-4 w-4" />;
      case "trade":
        return <RefreshCw className="h-4 w-4" />;
      case "analysis":
        return <TrendingUp className="h-4 w-4" />;
      case "waiver":
        return <Zap className="h-4 w-4" />;
      default:
        return <Newspaper className="h-4 w-4" />;
    }
  };

  const getCategoryColor = () => {
    return "bg-muted text-muted-foreground border-border";
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatGameTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatOdds = (odds: number) => {
    if (odds > 0) return `+${odds}`;
    return odds.toString();
  };

  const formatSpread = (spread: number) => {
    if (spread > 0) return `+${spread}`;
    return spread.toString();
  };

  const filteredNews = (newsData?.news || []).filter((item) => {
    const matchesSearch = searchTerm === "" || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.players?.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    if (activeTab === "all") return true;
    if (activeTab === "news") {
      return item.category === "news" || item.category === "analysis";
    }
    return true;
  });

  const isLoading = activeTab === "odds" ? oddsLoading : newsLoading;
  const isFetching = activeTab === "odds" ? oddsFetching : newsFetching;
  const lastUpdated = activeTab === "odds" ? oddsData?.lastUpdated : newsData?.lastUpdated;

  const handleRefresh = () => {
    if (activeTab === "odds") {
      refetchOdds();
    } else {
      refetchNews();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Fantasy News</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-news"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground" data-testid="text-last-updated">
              Updated {formatTimeAgo(lastUpdated)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {activeTab !== "odds" && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search news or players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-news"
            />
          </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="news" data-testid="tab-news">NFL News</TabsTrigger>
            <TabsTrigger value="odds" data-testid="tab-odds">
              <DollarSign className="h-4 w-4 mr-1" />
              Vegas Odds
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "odds" ? (
        oddsError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-error-message">Failed to load odds. Please try again.</p>
              <Button variant="outline" onClick={() => refetchOdds()} className="mt-4" data-testid="button-retry">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !oddsData?.games?.length ? (
          <Card>
            <CardContent className="py-12 text-center" data-testid="empty-state">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-empty-message">
                No upcoming games with odds available
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {oddsData.games.map((game) => (
              <Card 
                key={game.id} 
                className="hover-elevate transition-all"
                data-testid={`odds-game-${game.id}`}
              >
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {game.bookmaker}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatGameTime(game.commenceTime)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="sm:col-span-1">
                        <div className="space-y-2">
                          <div className="font-medium text-sm" data-testid={`away-team-${game.id}`}>
                            {game.awayTeam}
                          </div>
                          <div className="font-medium text-sm" data-testid={`home-team-${game.id}`}>
                            @ {game.homeTeam}
                          </div>
                        </div>
                      </div>
                      
                      <div className="sm:col-span-1 text-center">
                        <div className="text-xs text-muted-foreground mb-1">Spread</div>
                        {game.spread ? (
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="font-medium">{formatSpread(game.spread.awaySpread)}</span>
                              <span className="text-muted-foreground ml-1">({formatOdds(game.spread.awayOdds)})</span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">{formatSpread(game.spread.homeSpread)}</span>
                              <span className="text-muted-foreground ml-1">({formatOdds(game.spread.homeOdds)})</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">N/A</div>
                        )}
                      </div>
                      
                      <div className="sm:col-span-1 text-center">
                        <div className="text-xs text-muted-foreground mb-1">Moneyline</div>
                        {game.moneyline ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{formatOdds(game.moneyline.awayOdds)}</div>
                            <div className="text-sm font-medium">{formatOdds(game.moneyline.homeOdds)}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">N/A</div>
                        )}
                      </div>
                      
                      <div className="sm:col-span-1 text-center">
                        <div className="text-xs text-muted-foreground mb-1">Total</div>
                        {game.total ? (
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="font-medium">O {game.total.over}</span>
                              <span className="text-muted-foreground ml-1">({formatOdds(game.total.overOdds)})</span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">U {game.total.under}</span>
                              <span className="text-muted-foreground ml-1">({formatOdds(game.total.underOdds)})</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">N/A</div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        newsError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-error-message">Failed to load news. Please try again.</p>
              <Button variant="outline" onClick={() => refetchNews()} className="mt-4" data-testid="button-retry">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredNews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center" data-testid="empty-state">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-empty-message">
                {searchTerm 
                  ? "No news matching your search" 
                  : "No news available right now"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredNews.map((item) => (
              <Card 
                key={item.id} 
                className="hover-elevate transition-all cursor-pointer"
                data-testid={`news-item-${item.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`${getCategoryColor()} text-xs`}
                          data-testid={`badge-category-${item.id}`}
                        >
                          {getCategoryIcon(item.category)}
                          <span className="ml-1 capitalize">{item.category}</span>
                        </Badge>
                        <span className="text-xs text-muted-foreground" data-testid={`text-source-${item.id}`}>{item.source}</span>
                        <span className="text-xs text-muted-foreground" data-testid={`text-time-${item.id}`}>{formatTimeAgo(item.publishedAt)}</span>
                      </div>
                      <h3 className="font-semibold" data-testid={`text-news-title-${item.id}`}>{item.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-summary-${item.id}`}>{item.summary}</p>
                      {item.players && item.players.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.players.map((player, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs" data-testid={`badge-player-${item.id}-${idx}`}>
                              {player}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(item.url, "_blank")}
                      className="shrink-0"
                      data-testid={`button-open-${item.id}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
