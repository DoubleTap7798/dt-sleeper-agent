import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Zap, Target, Flame, AlertTriangle,
  ArrowDown, Shield, Activity
} from "lucide-react";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { calculateDVI } from "./devy-rankings";
import type { DevyPlayer, DevyData } from "./devy-rankings";

type MomentumPeriod = "7day" | "30day" | "season";

export default function DevyMarketPage() {
  usePageTitle("Market Intelligence");
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [momentumPeriod, setMomentumPeriod] = useState<MomentumPeriod>("30day");

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

  const getTrendValue = (p: DevyPlayer) => {
    if (momentumPeriod === "7day") return p.trend7Day;
    if (momentumPeriod === "season") return p.seasonChange;
    return p.trend30Day;
  };

  const risers = [...players]
    .filter(p => getTrendValue(p) >= 3)
    .sort((a, b) => getTrendValue(b) - getTrendValue(a))
    .slice(0, 10);

  const fallers = [...players]
    .filter(p => getTrendValue(p) <= -3)
    .sort((a, b) => getTrendValue(a) - getTrendValue(b))
    .slice(0, 10);

  const highR1LowDvi = players
    .filter(p => p.round1Pct >= 40 && calculateDVI(p) < 60)
    .sort((a, b) => b.round1Pct - a.round1Pct)
    .slice(0, 6);

  const eliteBreakoutLowRank = players
    .filter(p => (p.breakoutProbability || p.elitePct) >= 25 && p.marketRank > 20)
    .sort((a, b) => (b.breakoutProbability || b.elitePct) - (a.breakoutProbability || a.elitePct))
    .slice(0, 6);

  const sophomoreBreakout = players
    .filter(p => p.ageClass === "young-breakout" && p.trend30Day > 0 && p.rank > 15)
    .sort((a, b) => b.trend30Day - a.trend30Day)
    .slice(0, 6);

  const collapseRiskPlayers = players
    .filter(p => {
      const lostRole = p.depthRole === "backup" || p.depthRole === "committee";
      const highTransferRisk = (p.transferRisk || 0) >= 40;
      const highInjuryRisk = (p.injuryRisk || 0) >= 50;
      const bigDviDrop = p.trend30Day <= -10;
      return lostRole || highTransferRisk || highInjuryRisk || bigDviDrop;
    })
    .sort((a, b) => {
      const aRisk = (a.transferRisk || 0) + (a.injuryRisk || 0) + Math.abs(Math.min(0, a.trend30Day));
      const bRisk = (b.transferRisk || 0) + (b.injuryRisk || 0) + Math.abs(Math.min(0, b.trend30Day));
      return bRisk - aRisk;
    })
    .slice(0, 8);

  const getCollapseReasons = (p: DevyPlayer): string[] => {
    const reasons: string[] = [];
    if (p.depthRole === "backup" || p.depthRole === "committee") reasons.push("Role concern");
    if ((p.transferRisk || 0) >= 40) reasons.push("Transfer risk");
    if ((p.injuryRisk || 0) >= 50) reasons.push("Injury flag");
    if (p.trend30Day <= -10) reasons.push(`DVI drop (${p.trend30Day})`);
    return reasons;
  };

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

  const periodLabels: Record<MomentumPeriod, string> = {
    "7day": "7-Day",
    "30day": "30-Day",
    "season": "Season",
  };

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
              Momentum trends, mispricing alerts, and collapse risk monitoring
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap" data-testid="momentum-period-tabs">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Momentum Period:</span>
        {(["7day", "30day", "season"] as MomentumPeriod[]).map(period => (
          <Button
            key={period}
            variant={momentumPeriod === period ? "default" : "outline"}
            size="sm"
            onClick={() => setMomentumPeriod(period)}
            className="toggle-elevate"
            data-testid={`button-period-${period}`}
          >
            {periodLabels[period]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-rising-momentum">
          <CardContent className="p-0">
            <div className="p-4 border-b border-amber-800/20 bg-green-900/10">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <h3 className="font-semibold text-amber-100">Rising Momentum</h3>
                <Badge variant="secondary" className="text-[10px]">{periodLabels[momentumPeriod]}</Badge>
                <Badge variant="secondary" className="text-[10px] ml-auto">{risers.length}</Badge>
              </div>
            </div>
            <div className="divide-y divide-amber-800/10">
              {risers.length > 0 ? risers.map(p => (
                <PlayerRow
                  key={p.playerId}
                  player={p}
                  badge={<Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">+{getTrendValue(p)}</Badge>}
                />
              )) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No rising momentum detected</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-falling-value">
          <CardContent className="p-0">
            <div className="p-4 border-b border-amber-800/20 bg-red-900/10">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-amber-100">Falling Value</h3>
                <Badge variant="secondary" className="text-[10px]">{periodLabels[momentumPeriod]}</Badge>
                <Badge variant="secondary" className="text-[10px] ml-auto">{fallers.length}</Badge>
              </div>
            </div>
            <div className="divide-y divide-amber-800/10">
              {fallers.length > 0 ? fallers.map(p => (
                <PlayerRow
                  key={p.playerId}
                  player={p}
                  badge={<Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">{getTrendValue(p)}</Badge>}
                />
              )) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No falling value detected</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold text-amber-100" data-testid="text-mispricing-title">Mispricing Scanner</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-high-r1-low-dvi">
            <CardContent className="p-0">
              <div className="p-3 border-b border-amber-800/20">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-sm font-semibold text-amber-100">High R1 Prob + Low DVI</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Likely drafted high but undervalued in dynasty</p>
              </div>
              <div className="divide-y divide-amber-800/10">
                {highR1LowDvi.length > 0 ? highR1LowDvi.map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-3 text-sm cursor-pointer hover-elevate"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`signal-r1dvi-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="font-medium">{abbreviateName(p.name)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-blue-400 text-xs">{p.round1Pct}% R1</span>
                      <span className="text-muted-foreground text-xs">|</span>
                      <span className="text-amber-400 text-xs">{calculateDVI(p)} DVI</span>
                    </div>
                  </div>
                )) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">No mispricing detected</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-elite-breakout-low-rank">
            <CardContent className="p-0">
              <div className="p-3 border-b border-amber-800/20">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-sm font-semibold text-amber-100">Elite Breakout + Low Rank</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">High breakout upside ranked outside top 20</p>
              </div>
              <div className="divide-y divide-amber-800/10">
                {eliteBreakoutLowRank.length > 0 ? eliteBreakoutLowRank.map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-3 text-sm cursor-pointer hover-elevate"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`signal-breakout-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="font-medium">{abbreviateName(p.name)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-400 text-xs">{p.breakoutProbability || p.elitePct}% upside</span>
                      <span className="text-muted-foreground text-xs">Mkt #{p.marketRank}</span>
                    </div>
                  </div>
                )) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">No breakout plays detected</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-sophomore-breakout">
            <CardContent className="p-0">
              <div className="p-3 border-b border-amber-800/20">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm font-semibold text-amber-100">Sophomore Breakout</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Young breakout types with rising stock</p>
              </div>
              <div className="divide-y divide-amber-800/10">
                {sophomoreBreakout.length > 0 ? sophomoreBreakout.map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-3 text-sm cursor-pointer hover-elevate"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`signal-sophomore-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="font-medium">{abbreviateName(p.name)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      <span className="text-yellow-500 text-xs">+{p.trend30Day} trend</span>
                    </div>
                  </div>
                )) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">No sophomore breakouts detected</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-bold text-amber-100" data-testid="text-collapse-title">Collapse Risk Alerts</h2>
        </div>
        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-collapse-risk">
          <CardContent className="p-0">
            <div className="divide-y divide-amber-800/10">
              {collapseRiskPlayers.length > 0 ? collapseRiskPlayers.map(p => {
                const reasons = getCollapseReasons(p);
                return (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-3 p-3 hover-elevate cursor-pointer"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`collapse-row-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(p.position)}`}>
                        {p.position}
                      </Badge>
                      <div className="min-w-0">
                        <span className="font-medium text-sm">{p.name}</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>{p.college}</span>
                          <span>#{p.rank}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {reasons.map((reason, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]"
                        >
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              }) : (
                <div className="p-8 text-center">
                  <Shield className="h-8 w-8 text-green-500/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No collapse risks detected — all clear</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-16" />)}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-4 space-y-3">
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
