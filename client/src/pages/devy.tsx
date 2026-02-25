import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { abbreviateName, getPositionColorClass } from "@/lib/utils";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Sparkles,
  Target,
  AlertTriangle,
  Shield,
  BarChart3,
  Briefcase,
} from "lucide-react";
import { DevyProfileModal } from "@/components/devy-profile-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { Link } from "wouter";
import type { DevyPlayer, DevyData } from "@/pages/devy-rankings";
import { calculateDVI } from "@/pages/devy-rankings";

export default function DevyPage() {
  usePageTitle("Devy Command Center");
  const [selectedPlayer, setSelectedPlayer] = useState<DevyPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery<DevyData>({
    queryKey: ["/api/sleeper/devy"],
    ...CACHE_TIMES.STABLE,
  });

  const { data: myDevyData } = useQuery<{
    ownedDevy: Array<{
      devyPlayerId: string;
      devyName: string;
      devyPosition: string;
      devySchool: string;
      leagueId: string;
      leagueName: string;
      matched: boolean;
    }>;
    leagues: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["/api/sleeper/devy/my-players"],
    ...CACHE_TIMES.STABLE,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="status-error-devy">
        <p className="text-muted-foreground" data-testid="text-error-devy">Failed to load devy data</p>
      </div>
    );
  }

  const { players } = data;

  const handlePlayerClick = (player: DevyPlayer) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  const playersWithDVI = players.map(p => ({ ...p, dvi: calculateDVI(p) }));

  const risingEV = [...playersWithDVI]
    .sort((a, b) => b.trend7Day - a.trend7Day)
    .filter(p => p.trend7Day > 0)
    .slice(0, 5);

  const undervalued = [...playersWithDVI]
    .map(p => ({ ...p, delta: (p.marketRank || p.rank) - (p.modelRank || p.rank) }))
    .filter(p => p.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  const bustRisk = [...playersWithDVI]
    .filter(p => p.bustPct > 20)
    .sort((a, b) => b.bustPct - a.bustPct)
    .slice(0, 5);

  const projectedFirstRounders = [...playersWithDVI]
    .filter(p => p.round1Pct > 50)
    .sort((a, b) => b.round1Pct - a.round1Pct);

  const draftYears = [2026, 2027, 2028, 2029];
  const classStrength = draftYears.map(year => {
    const classPlayers = playersWithDVI.filter(p => p.draftEligibleYear === year);
    const avgDVI = classPlayers.length > 0
      ? Math.round(classPlayers.reduce((sum, p) => sum + p.dvi, 0) / classPlayers.length)
      : 0;
    return { year, avgDVI, count: classPlayers.length };
  });
  const maxClassDVI = Math.max(...classStrength.map(c => c.avgDVI), 1);

  const fuzzyNameMatch = (name1: string, name2: string): boolean => {
    const a = name1.toLowerCase().trim();
    const b = name2.toLowerCase().trim();
    if (a === b) return true;
    const aParts = a.split(' ');
    const bParts = b.split(' ');
    const aLast = aParts[aParts.length - 1];
    const bLast = bParts[bParts.length - 1];
    if (aLast !== bLast) return false;
    const aFirst = aParts[0];
    const bFirst = bParts[0];
    if (aFirst.replace('.', '') === bFirst.replace('.', '')) return true;
    if (aFirst.length <= 2 && bFirst.startsWith(aFirst.replace('.', ''))) return true;
    if (bFirst.length <= 2 && aFirst.startsWith(bFirst.replace('.', ''))) return true;
    return false;
  };

  const ownedDevyPlayers = myDevyData?.ownedDevy
    ? playersWithDVI.filter(p =>
        myDevyData.ownedDevy.some(d =>
          d.devyPlayerId === p.playerId || fuzzyNameMatch(d.devyName, p.name)
        )
      )
    : [];
  const totalPortfolioEV = ownedDevyPlayers.reduce((sum, p) => sum + p.value, 0);
  const hasPortfolio = ownedDevyPlayers.length > 0;

  return (
    <PremiumGate featureName="Devy Command Center">
      <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="devy-page">
        <div className="relative overflow-hidden rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/40 via-stone-950/80 to-stone-950/60 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-700/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-700/20 border border-amber-700/30 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-amber-100" data-testid="text-devy-title">
                  Devy Command Center
                </h1>
                <p className="text-sm text-amber-200/60" data-testid="text-devy-subtitle">
                  Prospect intelligence dashboard &middot; {players.length} prospects tracked
                </p>
              </div>
            </div>
            <Link href="/league/devy/rankings">
              <Button variant="outline" className="gap-1.5" data-testid="link-full-rankings">
                View Full Rankings
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="dashboard-cards-grid">

          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-rising-ev">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-100">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Rising EV Prospects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {risingEV.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="text-no-risers">No rising prospects this week</p>
              ) : (
                risingEV.map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`row-rising-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="text-sm font-medium truncate">{abbreviateName(p.name)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">DVI {p.dvi}</span>
                      <span className="text-xs font-medium text-green-500">+{p.trend7Day}</span>
                    </div>
                  </div>
                ))
              )}
              <Link href="/league/devy/rankings">
                <Button variant="ghost" size="sm" className="w-full mt-1 gap-1 text-xs" data-testid="link-rising-more">
                  View Rankings <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-undervalued">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-100">
                <Target className="h-4 w-4 text-blue-500" />
                Most Undervalued
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {undervalued.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="text-no-undervalued">No mispriced prospects found</p>
              ) : (
                undervalued.map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`row-undervalued-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="text-sm font-medium truncate">{abbreviateName(p.name)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">Mkt #{p.marketRank || p.rank}</span>
                      <Badge variant="secondary" className="text-[10px] text-green-500">+{p.delta} spots</Badge>
                    </div>
                  </div>
                ))
              )}
              <Link href="/league/devy/market">
                <Button variant="ghost" size="sm" className="w-full mt-1 gap-1 text-xs" data-testid="link-undervalued-more">
                  Market Intelligence <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-bust-risk">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-100">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Bust Risk Watchlist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bustRisk.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="text-no-bust-risk">No high bust-risk prospects</p>
              ) : (
                bustRisk.map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`row-bust-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="text-sm font-medium truncate">{abbreviateName(p.name)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${Math.min(100, p.bustPct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-red-500">{p.bustPct}%</span>
                    </div>
                  </div>
                ))
              )}
              <Link href="/league/devy/rankings">
                <Button variant="ghost" size="sm" className="w-full mt-1 gap-1 text-xs" data-testid="link-bust-more">
                  Full Rankings <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-projected-first-rounders">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-100">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Projected 1st Rounders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectedFirstRounders.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="text-no-first-rounders">No strong Round 1 candidates</p>
              ) : (
                projectedFirstRounders.slice(0, 6).map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`row-r1-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="text-sm font-medium truncate">{abbreviateName(p.name)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${Math.min(100, p.round1Pct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-amber-500">{p.round1Pct}%</span>
                    </div>
                  </div>
                ))
              )}
              {projectedFirstRounders.length > 6 && (
                <p className="text-xs text-muted-foreground text-center" data-testid="text-more-first-rounders">
                  +{projectedFirstRounders.length - 6} more
                </p>
              )}
              <Link href="/league/devy/rankings">
                <Button variant="ghost" size="sm" className="w-full mt-1 gap-1 text-xs" data-testid="link-r1-more">
                  Full Rankings <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-class-strength">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-100">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                Draft Class Strength
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {classStrength.map(cs => (
                <div key={cs.year} className="space-y-1" data-testid={`row-class-${cs.year}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{cs.year}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{cs.count} prospects</span>
                      <span className="text-xs font-semibold text-amber-200">{cs.avgDVI}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all"
                      style={{ width: `${(cs.avgDVI / maxClassDVI) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <Link href="/league/devy/rankings">
                <Button variant="ghost" size="sm" className="w-full mt-1 gap-1 text-xs" data-testid="link-class-more">
                  View by Class <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {hasPortfolio ? (
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-portfolio-snapshot">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-100">
                  <Briefcase className="h-4 w-4 text-emerald-500" />
                  Devy Portfolio Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                  <span className="text-xs text-muted-foreground">Total Portfolio EV</span>
                  <span className="text-lg font-bold text-emerald-500" data-testid="text-portfolio-ev">{totalPortfolioEV.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2">
                  <span className="text-xs text-muted-foreground">Prospects Owned</span>
                  <span className="text-sm font-medium" data-testid="text-portfolio-count">{ownedDevyPlayers.length}</span>
                </div>
                {ownedDevyPlayers.slice(0, 3).map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => handlePlayerClick(p)}
                    data-testid={`row-portfolio-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getPositionColorClass(p.position)}`}>{p.position}</Badge>
                      <span className="text-sm font-medium truncate">{abbreviateName(p.name)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">DVI {p.dvi}</span>
                  </div>
                ))}
                {ownedDevyPlayers.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-portfolio-more">
                    +{ownedDevyPlayers.length - 3} more
                  </p>
                )}
                <Link href="/league/devy/portfolio">
                  <Button variant="ghost" size="sm" className="w-full mt-1 gap-1 text-xs" data-testid="link-portfolio-more">
                    Full Portfolio <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-portfolio-empty">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-100">
                  <Briefcase className="h-4 w-4 text-emerald-500" />
                  Devy Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
                <Shield className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground text-center" data-testid="text-no-portfolio">
                  No devy players owned yet. Connect your Sleeper leagues to see your portfolio.
                </p>
                <Link href="/league/devy/portfolio">
                  <Button variant="outline" size="sm" className="gap-1" data-testid="link-setup-portfolio">
                    Set Up Portfolio <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="devy-skeleton">
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72 mt-1" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
