import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Snowflake,
  ThermometerSun,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Target,
  ShieldAlert,
  Zap,
  Clock,
  LineChart,
  Scale,
  Briefcase,
} from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";
import { PremiumGate } from "@/components/premium-gate";
import { usePageTitle } from "@/hooks/use-page-title";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSelectedLeague } from "@/pages/league-layout";
import type { PlayerMarketMetrics } from "@shared/schema";

interface CategoriesResponse {
  overhyped: PlayerMarketMetrics[];
  undervalued: PlayerMarketMetrics[];
  risingFast: PlayerMarketMetrics[];
  panicSells: PlayerMarketMetrics[];
  artificialScarcity: PlayerMarketMetrics[];
  lastUpdated: string | null;
}

interface MarketOverview {
  dynastyMarketIndex: number;
  dynastyVolatilityIndex: number;
  avgHypePremium: number;
  leagueTradeVolume7d: number;
  leagueAvgVolatility: number;
  lastUpdated: string | null;
}

interface ArbitragePlayer {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  gapScore: number;
  signal: "BUY" | "SELL";
  fundamentalRank: number;
  marketRank: number;
  baseDynastyValue: number;
  adjustedMarketValue: number;
  hypePremiumPct: number;
  marketLabel: string | null;
  volatility14d: number;
  betaScore: number;
}

interface PortfolioExposure {
  overexposedPct: number;
  underexposedPct: number;
  portfolioBeta: number;
  classification: "Aggressive" | "Balanced" | "Defensive";
  playerBreakdown: Array<{
    playerId: string;
    playerName: string;
    position: string;
    team: string;
    adjustedMarketValue: number;
    hypePremiumPct: number;
    betaScore: number;
    marketLabel: string | null;
    volatility14d: number;
    weight: number;
  }>;
}

type TabKey = "overhyped" | "undervalued" | "risingFast" | "panicSells" | "artificialScarcity" | "arbitrage" | "portfolio";

const TABS: { key: TabKey; label: string; description: string; icon: typeof BarChart3 }[] = [
  { key: "overhyped", label: "Overhyped", description: "Market values exceed fundamentals — hype-inflated assets", icon: TrendingUp },
  { key: "undervalued", label: "Undervalued", description: "Trading below fundamental value — buy-low targets", icon: TrendingDown },
  { key: "risingFast", label: "Rising", description: "Highest upward momentum in market sentiment", icon: ArrowUpRight },
  { key: "panicSells", label: "Panic Sells", description: "Rapid value decline with falling demand — potential overreactions", icon: ArrowDownRight },
  { key: "artificialScarcity", label: "Scarcity", description: "Low supply + high demand — owners holding tight", icon: ShieldAlert },
  { key: "arbitrage", label: "Arbitrage", description: "Fundamental vs market rank gaps — pricing inefficiencies", icon: Scale },
  { key: "portfolio", label: "Portfolio", description: "Your roster exposure to market risk and hype", icon: Briefcase },
];

function getHeatBadge(level: string) {
  switch (level) {
    case "HOT":
      return <Badge variant="destructive" data-testid="badge-heat-hot"><Flame className="h-3 w-3 mr-1" />HOT</Badge>;
    case "HEATING":
      return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" data-testid="badge-heat-heating"><ThermometerSun className="h-3 w-3 mr-1" />HEATING</Badge>;
    case "COLD":
      return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" data-testid="badge-heat-cold"><Snowflake className="h-3 w-3 mr-1" />COLD</Badge>;
    default:
      return <Badge variant="secondary" data-testid="badge-heat-neutral"><Minus className="h-3 w-3 mr-1" />NEUTRAL</Badge>;
  }
}

function getMarketLabelBadge(label: string | null) {
  if (!label) return null;
  switch (label) {
    case "Momentum Breakout":
      return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 text-[10px]"><Zap className="h-2.5 w-2.5 mr-0.5" />Breakout</Badge>;
    case "Bubble Risk":
      return <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 text-[10px]"><ShieldAlert className="h-2.5 w-2.5 mr-0.5" />Bubble</Badge>;
    case "Accumulation Zone":
      return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]"><Target className="h-2.5 w-2.5 mr-0.5" />Accumulate</Badge>;
    case "Distribution Phase":
      return <Badge className="bg-stone-500/15 text-stone-600 dark:text-stone-400 border-stone-500/30 text-[10px]"><Activity className="h-2.5 w-2.5 mr-0.5" />Distribute</Badge>;
    default:
      return null;
  }
}

function getHypePremiumDisplay(pct: number) {
  const formatted = pct.toFixed(1);
  if (pct > 15) return <span className="text-red-500 dark:text-red-400 font-semibold">+{formatted}%</span>;
  if (pct < -10) return <span className="text-green-500 dark:text-green-400 font-semibold">{formatted}%</span>;
  return <span className="text-muted-foreground">{pct > 0 ? "+" : ""}{formatted}%</span>;
}

function VelocityArrow({ velocity }: { velocity: number }) {
  if (velocity > 10) return <ArrowUp className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />;
  if (velocity < -10) return <ArrowDown className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function MetricBar({ value, max = 100, color = "bg-primary" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full bg-muted">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function getPositionColor(pos: string | null) {
  switch (pos) {
    case "QB": return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    case "RB": return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "WR": return "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30";
    case "TE": return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
    default: return "";
  }
}

function MarketOverviewPanel({ data, isLoading }: { data?: MarketOverview; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
        ))}
      </div>
    );
  }

  const indices = [
    {
      label: "Dynasty Market Index",
      abbr: "DMI",
      value: data?.dynastyMarketIndex ?? 0,
      format: (v: number) => v.toFixed(2),
      icon: LineChart,
      color: v => v > 0 ? "text-green-500 dark:text-green-400" : v < 0 ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400",
    },
    {
      label: "Volatility Index",
      abbr: "D-VIX",
      value: data?.dynastyVolatilityIndex ?? 0,
      format: (v: number) => v.toFixed(2),
      icon: Activity,
      color: v => v > 8 ? "text-red-500 dark:text-red-400" : v > 4 ? "text-amber-500 dark:text-amber-400" : "text-green-500 dark:text-green-400",
    },
    {
      label: "Avg Hype Premium",
      abbr: "AVG HP",
      value: data?.avgHypePremium ?? 0,
      format: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`,
      icon: BarChart3,
      color: v => v > 5 ? "text-red-500 dark:text-red-400" : v < -5 ? "text-green-500 dark:text-green-400" : "text-muted-foreground",
    },
    {
      label: "Trade Volume (7d)",
      abbr: "VOL 7D",
      value: data?.leagueTradeVolume7d ?? 0,
      format: (v: number) => v.toLocaleString(),
      icon: TrendingUp,
      color: () => "text-amber-500 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="panel-market-overview">
      {indices.map(({ label, abbr, value, format, icon: Icon, color }) => (
        <Card key={abbr} className="p-4 border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent" data-testid={`card-index-${abbr.toLowerCase().replace(/\s/g, "-")}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <Icon className="h-3.5 w-3.5 text-amber-500/70" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{abbr}</span>
          </div>
          <div className={`text-2xl font-bold font-mono ${(color as any)(value)}`} data-testid={`value-index-${abbr.toLowerCase().replace(/\s/g, "-")}`}>
            {format(value)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
        </Card>
      ))}
    </div>
  );
}

function PlayerRow({ player, onClick }: { player: PlayerMarketMetrics; onClick: () => void }) {
  return (
    <tr
      className="border-b border-border/50 cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`row-market-player-${player.playerId}`}
    >
      <td className="py-2.5 pr-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate" data-testid={`text-market-name-${player.playerId}`}>
            {player.playerName || player.playerId}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {player.position && (
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getPositionColor(player.position)}`}>
                {player.position}
              </Badge>
            )}
            {player.team && <span>{player.team}</span>}
            {getMarketLabelBadge(player.marketLabel)}
          </div>
        </div>
      </td>
      <td className="py-2.5 px-2 text-center hidden sm:table-cell">
        <span className="font-mono text-sm" data-testid={`text-sentiment-${player.playerId}`}>
          {player.sentimentScore.toFixed(0)}
        </span>
      </td>
      <td className="py-2.5 px-2 text-center hidden sm:table-cell">
        <div className="flex items-center justify-center gap-1">
          <VelocityArrow velocity={player.hypeVelocity} />
          <span className="font-mono text-sm" data-testid={`text-velocity-${player.playerId}`}>
            {player.hypeVelocity > 0 ? "+" : ""}{player.hypeVelocity.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-2 hidden md:table-cell">
        <div className="space-y-1 min-w-[80px]">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Demand</span>
            <span className="font-mono">{player.demandIndex.toFixed(0)}</span>
          </div>
          <MetricBar value={player.demandIndex} color="bg-green-500 dark:bg-green-400" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Supply</span>
            <span className="font-mono">{player.supplyIndex.toFixed(0)}</span>
          </div>
          <MetricBar value={player.supplyIndex} color="bg-blue-500 dark:bg-blue-400" />
        </div>
      </td>
      <td className="py-2.5 px-2 text-center" data-testid={`text-premium-${player.playerId}`}>
        {getHypePremiumDisplay(player.hypePremiumPct)}
      </td>
      <td className="py-2.5 px-2 text-center hidden lg:table-cell">
        <span className="font-mono text-xs">{player.volatility14d?.toFixed(1) ?? "—"}</span>
      </td>
      <td className="py-2.5 px-2 text-center hidden lg:table-cell">
        <span className={`font-mono text-xs ${(player.betaScore ?? 1) > 1.3 ? "text-red-500 dark:text-red-400" : (player.betaScore ?? 1) < 0.8 ? "text-blue-500 dark:text-blue-400" : "text-muted-foreground"}`}>
          {player.betaScore?.toFixed(2) ?? "—"}
        </span>
      </td>
      <td className="py-2.5 px-2 text-center hidden lg:table-cell">
        {getHeatBadge(player.marketHeatLevel)}
      </td>
      <td className="py-2.5 pl-2 text-right hidden sm:table-cell">
        <span className="font-mono font-semibold text-sm" data-testid={`text-adj-value-${player.playerId}`}>
          {player.adjustedMarketValue.toFixed(0)}
        </span>
      </td>
    </tr>
  );
}

function PlayerCard({ player, onClick }: { player: PlayerMarketMetrics; onClick: () => void }) {
  return (
    <Card
      className="p-3 cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-market-player-${player.playerId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">
            {player.playerName || player.playerId}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {player.position && (
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getPositionColor(player.position)}`}>
                {player.position}
              </Badge>
            )}
            {player.team && <span className="text-xs text-muted-foreground">{player.team}</span>}
            {getHeatBadge(player.marketHeatLevel)}
            {getMarketLabelBadge(player.marketLabel)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">Adj. Value</div>
          <div className="font-mono font-bold text-base">{player.adjustedMarketValue.toFixed(0)}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1.5 text-xs">
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Sent</div>
          <div className="font-mono font-medium">{player.sentimentScore.toFixed(0)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Vel</div>
          <div className="flex items-center justify-center gap-0.5">
            <VelocityArrow velocity={player.hypeVelocity} />
            <span className="font-mono font-medium">{player.hypeVelocity.toFixed(1)}</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Premium</div>
          {getHypePremiumDisplay(player.hypePremiumPct)}
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Vol</div>
          <div className="font-mono font-medium">{player.volatility14d?.toFixed(1) ?? "—"}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Beta</div>
          <div className={`font-mono font-medium ${(player.betaScore ?? 1) > 1.3 ? "text-red-500" : (player.betaScore ?? 1) < 0.8 ? "text-blue-500" : ""}`}>
            {player.betaScore?.toFixed(2) ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12">Demand</span>
          <MetricBar value={player.demandIndex} color="bg-green-500 dark:bg-green-400" />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12">Supply</span>
          <MetricBar value={player.supplyIndex} color="bg-blue-500 dark:bg-blue-400" />
        </div>
      </div>
    </Card>
  );
}

function ArbitrageTable({ onOpenProfile }: { onOpenProfile: (p: ArbitragePlayer) => void }) {
  const { data, isLoading } = useQuery<{ arbitrage: ArbitragePlayer[] }>({
    queryKey: ["/api/market-terminal/arbitrage"],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <MarketSkeleton />;
  if (!data?.arbitrage?.length) return <EmptyState message="No arbitrage opportunities detected" />;

  return (
    <div className="overflow-x-auto" data-testid="table-arbitrage">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-2"><span className="text-[10px] font-medium text-muted-foreground uppercase">Player</span></th>
            <th className="text-center py-2 px-2"><span className="text-[10px] font-medium text-muted-foreground uppercase">Signal</span></th>
            <th className="text-center py-2 px-2 hidden sm:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Gap</span></th>
            <th className="text-center py-2 px-2 hidden md:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Fund. Rank</span></th>
            <th className="text-center py-2 px-2 hidden md:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Mkt Rank</span></th>
            <th className="text-center py-2 px-2 hidden lg:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Premium</span></th>
            <th className="text-center py-2 px-2 hidden lg:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Vol</span></th>
            <th className="text-center py-2 px-2 hidden lg:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Beta</span></th>
            <th className="text-right py-2 pl-2 hidden sm:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Value</span></th>
          </tr>
        </thead>
        <tbody>
          {data.arbitrage.map((p) => (
            <tr
              key={p.playerId}
              className="border-b border-border/50 cursor-pointer hover-elevate"
              onClick={() => onOpenProfile(p)}
              data-testid={`row-arb-${p.playerId}`}
            >
              <td className="py-2.5 pr-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{p.playerName}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {p.position && <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getPositionColor(p.position)}`}>{p.position}</Badge>}
                    {p.team && <span>{p.team}</span>}
                    {getMarketLabelBadge(p.marketLabel)}
                  </div>
                </div>
              </td>
              <td className="py-2.5 px-2 text-center">
                <Badge className={p.signal === "BUY"
                  ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
                  : "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                } data-testid={`badge-signal-${p.playerId}`}>
                  {p.signal}
                </Badge>
              </td>
              <td className="py-2.5 px-2 text-center hidden sm:table-cell">
                <span className={`font-mono font-semibold ${p.gapScore > 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {p.gapScore > 0 ? "+" : ""}{p.gapScore}
                </span>
              </td>
              <td className="py-2.5 px-2 text-center hidden md:table-cell font-mono text-xs">{p.fundamentalRank}</td>
              <td className="py-2.5 px-2 text-center hidden md:table-cell font-mono text-xs">{p.marketRank}</td>
              <td className="py-2.5 px-2 text-center hidden lg:table-cell">{getHypePremiumDisplay(p.hypePremiumPct)}</td>
              <td className="py-2.5 px-2 text-center hidden lg:table-cell font-mono text-xs">{p.volatility14d.toFixed(1)}</td>
              <td className="py-2.5 px-2 text-center hidden lg:table-cell">
                <span className={`font-mono text-xs ${p.betaScore > 1.3 ? "text-red-500 dark:text-red-400" : p.betaScore < 0.8 ? "text-blue-500 dark:text-blue-400" : "text-muted-foreground"}`}>
                  {p.betaScore.toFixed(2)}
                </span>
              </td>
              <td className="py-2.5 pl-2 text-right hidden sm:table-cell font-mono font-semibold text-sm">{p.adjustedMarketValue.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioExposurePanel({ leagueId }: { leagueId: string | null }) {
  const { data, isLoading } = useQuery<PortfolioExposure>({
    queryKey: ["/api/market-terminal/portfolio-exposure", leagueId],
    queryFn: async () => {
      if (!leagueId) throw new Error("No league selected");
      const res = await fetch(`/api/market-terminal/portfolio-exposure/${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio exposure");
      return res.json();
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });

  if (!leagueId) return <EmptyState message="Select a league to view portfolio exposure" />;
  if (isLoading) return <MarketSkeleton />;
  if (!data) return <EmptyState message="No portfolio data available" />;

  const classColor = data.classification === "Aggressive"
    ? "text-red-500 dark:text-red-400 bg-red-500/15 border-red-500/30"
    : data.classification === "Defensive"
    ? "text-blue-500 dark:text-blue-400 bg-blue-500/15 border-blue-500/30"
    : "text-amber-500 dark:text-amber-400 bg-amber-500/15 border-amber-500/30";

  return (
    <div className="space-y-4" data-testid="panel-portfolio-exposure">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Classification</div>
          <div className="mt-1">
            <Badge className={`${classColor} text-sm`} data-testid="badge-classification">{data.classification}</Badge>
          </div>
        </Card>
        <Card className="p-3 border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Portfolio Beta</div>
          <div className={`text-xl font-bold font-mono mt-1 ${data.portfolioBeta > 1.3 ? "text-red-500 dark:text-red-400" : data.portfolioBeta < 0.8 ? "text-blue-500 dark:text-blue-400" : "text-foreground"}`} data-testid="value-portfolio-beta">
            {data.portfolioBeta.toFixed(2)}
          </div>
        </Card>
        <Card className="p-3 border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Overexposed</div>
          <div className={`text-xl font-bold font-mono mt-1 ${data.overexposedPct > 30 ? "text-red-500 dark:text-red-400" : "text-foreground"}`} data-testid="value-overexposed">
            {data.overexposedPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground">Assets with &gt;15% hype premium</div>
        </Card>
        <Card className="p-3 border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Underexposed</div>
          <div className={`text-xl font-bold font-mono mt-1 ${data.underexposedPct > 30 ? "text-green-500 dark:text-green-400" : "text-foreground"}`} data-testid="value-underexposed">
            {data.underexposedPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground">Assets with &lt;-10% discount</div>
        </Card>
      </div>

      {data.playerBreakdown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2"><span className="text-[10px] font-medium text-muted-foreground uppercase">Asset</span></th>
                <th className="text-center py-2 px-2 hidden sm:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Weight</span></th>
                <th className="text-center py-2 px-2"><span className="text-[10px] font-medium text-muted-foreground uppercase">Premium</span></th>
                <th className="text-center py-2 px-2 hidden md:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Beta</span></th>
                <th className="text-center py-2 px-2 hidden md:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Vol</span></th>
                <th className="text-right py-2 pl-2"><span className="text-[10px] font-medium text-muted-foreground uppercase">Value</span></th>
              </tr>
            </thead>
            <tbody>
              {data.playerBreakdown.map((p) => (
                <tr key={p.playerId} className="border-b border-border/50" data-testid={`row-portfolio-${p.playerId}`}>
                  <td className="py-2 pr-2">
                    <div className="font-medium text-sm truncate">{p.playerName}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {p.position && <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getPositionColor(p.position)}`}>{p.position}</Badge>}
                      {p.team && <span>{p.team}</span>}
                      {getMarketLabelBadge(p.marketLabel)}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center hidden sm:table-cell font-mono text-xs">{p.weight.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-center">{getHypePremiumDisplay(p.hypePremiumPct)}</td>
                  <td className="py-2 px-2 text-center hidden md:table-cell">
                    <span className={`font-mono text-xs ${p.betaScore > 1.3 ? "text-red-500 dark:text-red-400" : p.betaScore < 0.8 ? "text-blue-500 dark:text-blue-400" : ""}`}>
                      {p.betaScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center hidden md:table-cell font-mono text-xs">{p.volatility14d.toFixed(1)}</td>
                  <td className="py-2 pl-2 text-right font-mono font-semibold text-sm">{p.adjustedMarketValue.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48">
      <p className="text-muted-foreground text-sm" data-testid="text-empty">{message}</p>
    </div>
  );
}

function MarketTerminalContent() {
  const isMobile = useIsMobile();
  const { league: selectedLeague } = useSelectedLeague();
  const [activeTab, setActiveTab] = useState<TabKey>("overhyped");
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [profilePlayerName, setProfilePlayerName] = useState("");
  const [profilePosition, setProfilePosition] = useState("");
  const [profileTeam, setProfileTeam] = useState("");

  const { data: overview, isLoading: overviewLoading } = useQuery<MarketOverview>({
    queryKey: ["/api/market-terminal/overview"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useQuery<CategoriesResponse>({
    queryKey: ["/api/market-psychology/categories"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const openProfile = useCallback((player: { playerId: string; playerName?: string | null; position?: string | null; team?: string | null }) => {
    setProfilePlayerId(player.playerId);
    setProfilePlayerName(player.playerName || player.playerId);
    setProfilePosition(player.position || "");
    setProfileTeam(player.team || "");
  }, []);

  const isCategoryTab = ["overhyped", "undervalued", "risingFast", "panicSells", "artificialScarcity"].includes(activeTab);
  const activeTabConfig = TABS.find(t => t.key === activeTab)!;
  const players = (isCategoryTab && categories) ? (categories[activeTab as keyof CategoriesResponse] as PlayerMarketMetrics[] || []) : [];

  return (
    <div className="space-y-4" data-testid="page-market-terminal">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LineChart className="h-5 w-5 text-amber-500" />
            Dynasty Market Terminal
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Market structure, volatility modeling & arbitrage detection
          </p>
        </div>
        {categories?.lastUpdated && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0" data-testid="text-last-updated">
            <Clock className="h-3 w-3" />
            Updated {new Date(categories.lastUpdated).toLocaleDateString()}
          </div>
        )}
      </div>

      <MarketOverviewPanel data={overview} isLoading={overviewLoading} />

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className="shrink-0"
              data-testid={`tab-${tab.key}`}
            >
              <Icon className="h-3.5 w-3.5 mr-1" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground" data-testid="text-tab-description">
        {activeTabConfig.description}
      </p>

      {activeTab === "arbitrage" ? (
        <ArbitrageTable onOpenProfile={(p) => openProfile(p)} />
      ) : activeTab === "portfolio" ? (
        <PortfolioExposurePanel leagueId={selectedLeague?.league_id || null} />
      ) : categoriesLoading ? (
        <MarketSkeleton />
      ) : categoriesError || !categories ? (
        <EmptyState message="Failed to load market data" />
      ) : players.length === 0 ? (
        <EmptyState message="No players in this category yet" />
      ) : isMobile ? (
        <div className="space-y-2" data-testid="grid-market-players">
          {players.map((player) => (
            <PlayerCard
              key={player.playerId}
              player={player}
              onClick={() => openProfile(player)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto" data-testid="table-market-players">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2 min-w-[140px]"><span className="text-[10px] font-medium text-muted-foreground uppercase">Player</span></th>
                <th className="text-center py-2 px-2 hidden sm:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Sentiment</span></th>
                <th className="text-center py-2 px-2 hidden sm:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Velocity</span></th>
                <th className="text-center py-2 px-2 hidden md:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Demand / Supply</span></th>
                <th className="text-center py-2 px-2"><span className="text-[10px] font-medium text-muted-foreground uppercase">Premium</span></th>
                <th className="text-center py-2 px-2 hidden lg:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Vol</span></th>
                <th className="text-center py-2 px-2 hidden lg:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Beta</span></th>
                <th className="text-center py-2 px-2 hidden lg:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Heat</span></th>
                <th className="text-right py-2 pl-2 hidden sm:table-cell"><span className="text-[10px] font-medium text-muted-foreground uppercase">Adj. Value</span></th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <PlayerRow
                  key={player.playerId}
                  player={player}
                  onClick={() => openProfile(player)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {profilePlayerId && (
        <PlayerProfileModal
          open={!!profilePlayerId}
          onOpenChange={(open) => { if (!open) setProfilePlayerId(null); }}
          playerId={profilePlayerId}
          playerName={profilePlayerName}
          position={profilePosition}
          team={profileTeam}
        />
      )}
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function MarketPsychologyPage() {
  usePageTitle("Dynasty Market Terminal");

  return (
    <PremiumGate featureName="Dynasty Market Terminal">
      <MarketTerminalContent />
    </PremiumGate>
  );
}
