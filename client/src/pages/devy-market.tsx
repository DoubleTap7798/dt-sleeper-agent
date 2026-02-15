import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Zap, Target, Flame, Sparkles } from "lucide-react";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { calculateDVI } from "./devy-rankings";
import type { DevyPlayer, DevyData } from "./devy-rankings";

export default function DevyMarketPage() {
  usePageTitle("Market Intelligence");
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <MarketSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-market">
        <p className="text-muted-foreground">Failed to load market data</p>
      </div>
    );
  }

  const { players } = data;
  const handlePlayerClick = (player: DevyPlayer) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  const risers = players.filter(p => p.trend30Day >= 5).sort((a, b) => b.trend30Day - a.trend30Day).slice(0, 8);
  const fallers = players.filter(p => p.trend30Day <= -5).sort((a, b) => a.trend30Day - b.trend30Day).slice(0, 8);
  const breakouts = players.filter(p => p.ageClass === "young-breakout" && p.trend30Day > 0).slice(0, 6);
  const buyLow = players.filter(p => p.trend30Day <= -5 && p.elitePct >= 20 && p.tier <= 3).sort((a, b) => a.trend30Day - b.trend30Day).slice(0, 6);
  const sellHigh = players.filter(p => p.trend30Day >= 5 && p.bustPct >= 30).sort((a, b) => b.trend30Day - a.trend30Day).slice(0, 6);
  const valuePlays = players.filter(p => p.elitePct >= 25 && p.pickMultiplier <= 1.2 && p.tier <= 3).slice(0, 6);

  const PlayerRow = ({ player, badge }: { player: DevyPlayer; badge: JSX.Element }) => (
    <div
      className="flex items-center justify-between gap-3 p-3 hover-elevate cursor-pointer rounded-lg"
      onClick={() => handlePlayerClick(player)}
      data-testid={`market-row-${player.playerId}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(player.position)}`}>
          {player.position}
        </Badge>
        <div className="min-w-0">
          <span className="font-medium text-sm">{player.name}</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{player.college}</span>
            <span>#{player.rank}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <span className={`text-sm font-bold ${
            calculateDVI(player) >= 80 ? "text-green-500" :
            calculateDVI(player) >= 60 ? "text-amber-400" :
            calculateDVI(player) >= 40 ? "text-yellow-500" :
            "text-red-500"
          }`}>{calculateDVI(player)} DVI</span>
        </div>
        {badge}
      </div>
    </div>
  );

  return (
    <PremiumGate featureName="Market Intelligence">
    <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-market-page">
      <div className="relative overflow-hidden rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/40 via-stone-950/80 to-stone-950/60 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-700/10 via-transparent to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-amber-700/20 border border-amber-700/30 flex items-center justify-center">
            <Flame className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-amber-100" data-testid="text-market-title">
              Market Intelligence
            </h1>
            <p className="text-sm text-amber-200/60">
              30-day momentum trends, breakout alerts, and trade signals
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {risers.length > 0 && (
          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-rising-momentum">
            <CardContent className="p-0">
              <div className="p-4 border-b border-amber-800/20 bg-green-900/10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <h3 className="font-semibold text-amber-100">Rising Momentum</h3>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{risers.length}</Badge>
                </div>
              </div>
              <div className="divide-y divide-amber-800/10">
                {risers.map(p => (
                  <PlayerRow
                    key={p.playerId}
                    player={p}
                    badge={<Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">+{p.trend30Day}</Badge>}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {fallers.length > 0 && (
          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-falling-value">
            <CardContent className="p-0">
              <div className="p-4 border-b border-amber-800/20 bg-red-900/10">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                  <h3 className="font-semibold text-amber-100">Falling Value</h3>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{fallers.length}</Badge>
                </div>
              </div>
              <div className="divide-y divide-amber-800/10">
                {fallers.map(p => (
                  <PlayerRow
                    key={p.playerId}
                    player={p}
                    badge={<Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">{p.trend30Day}</Badge>}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {breakouts.length > 0 && (
        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-breakout-alerts">
          <CardContent className="p-0">
            <div className="p-4 border-b border-amber-800/20 bg-amber-900/10">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-amber-100">Breakout Alerts</h3>
                <Badge variant="secondary" className="text-[10px]">{breakouts.length}</Badge>
                <span className="text-xs text-amber-200/50 ml-auto">Young prospects with rising stock</span>
              </div>
            </div>
            <div className="divide-y divide-amber-800/10">
              {breakouts.map(p => (
                <PlayerRow
                  key={p.playerId}
                  player={p}
                  badge={<Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs gap-1"><Zap className="h-3 w-3" />Breakout</Badge>}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(buyLow.length > 0 || sellHigh.length > 0 || valuePlays.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-amber-100">Trade Signals</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {buyLow.length > 0 && (
              <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-buy-low">
                <CardContent className="p-0">
                  <div className="p-3 border-b border-amber-800/20">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      <span className="text-sm font-semibold text-amber-100">Buy Low Targets</span>
                    </div>
                  </div>
                  <div className="divide-y divide-amber-800/10">
                    {buyLow.map(p => (
                      <div
                        key={p.playerId}
                        className="flex items-center justify-between gap-2 p-3 text-sm cursor-pointer hover-elevate"
                        onClick={() => handlePlayerClick(p)}
                        data-testid={`signal-buy-${p.playerId}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                          <span className="font-medium">{abbreviateName(p.name)}</span>
                        </div>
                        <span className="text-green-500 text-xs font-medium">{p.elitePct}% elite</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {sellHigh.length > 0 && (
              <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-sell-high">
                <CardContent className="p-0">
                  <div className="p-3 border-b border-amber-800/20">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span className="text-sm font-semibold text-amber-100">Sell High Candidates</span>
                    </div>
                  </div>
                  <div className="divide-y divide-amber-800/10">
                    {sellHigh.map(p => (
                      <div
                        key={p.playerId}
                        className="flex items-center justify-between gap-2 p-3 text-sm cursor-pointer hover-elevate"
                        onClick={() => handlePlayerClick(p)}
                        data-testid={`signal-sell-${p.playerId}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                          <span className="font-medium">{abbreviateName(p.name)}</span>
                        </div>
                        <span className="text-red-500 text-xs font-medium">{p.bustPct}% bust</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {valuePlays.length > 0 && (
              <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-value-plays">
                <CardContent className="p-0">
                  <div className="p-3 border-b border-amber-800/20">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="text-sm font-semibold text-amber-100">Value Plays</span>
                    </div>
                  </div>
                  <div className="divide-y divide-amber-800/10">
                    {valuePlays.map(p => (
                      <div
                        key={p.playerId}
                        className="flex items-center justify-between gap-2 p-3 text-sm cursor-pointer hover-elevate"
                        onClick={() => handlePlayerClick(p)}
                        data-testid={`signal-value-${p.playerId}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                          <span className="font-medium">{abbreviateName(p.name)}</span>
                        </div>
                        <span className="text-blue-500 text-xs font-medium">T{p.tier} underpriced</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {risers.length === 0 && fallers.length === 0 && breakouts.length === 0 && buyLow.length === 0 && sellHigh.length === 0 && valuePlays.length === 0 && (
        <Card className="border-amber-800/20 bg-stone-950/60">
          <CardContent className="p-12 text-center">
            <Flame className="h-12 w-12 text-amber-700/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-amber-100">No Market Signals</h3>
            <p className="text-sm text-amber-200/50">
              No significant momentum changes detected in the last 30 days. Check back soon.
            </p>
          </CardContent>
        </Card>
      )}

      <DevyProfileModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedPlayer(null);
        }}
        player={selectedPlayer}
      />
    </div>
    </PremiumGate>
  );
}

function MarketSkeleton() {
  return (
    <div className="space-y-6" data-testid="devy-market-skeleton">
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-4 space-y-3">
            {[...Array(5)].map((_, j) => (
              <Skeleton key={j} className="h-14 w-full" />
            ))}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
